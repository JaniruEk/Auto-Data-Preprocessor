import io
import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, Query
from fastapi.responses import JSONResponse, StreamingResponse

from ..services.store import store
from ..pipeline import build_auto_pipeline, transform_to_dataframe

DATA_DIR = os.path.join("app", "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

router = APIRouter()


def _read_csv_upload(upload: UploadFile) -> pd.DataFrame:
    if not upload.filename or not upload.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")
    data = upload.file.read()
    try:
        df = pd.read_csv(io.BytesIO(data))
    except Exception:
        # Try with different encoding as fallback
        upload.file.seek(0)
        df = pd.read_csv(io.BytesIO(data), encoding_errors="ignore")
    return df


@router.post("/upload")
def upload_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    df = _read_csv_upload(file)
    dataset_id = store.add(df)

    # Save original file to disk (optional)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(UPLOAD_DIR, f"{dataset_id}.csv")
    df.to_csv(save_path, index=False)

    head = df.head(20).fillna("").astype(str).values.tolist()
    return {
        "dataset_id": dataset_id,
        "rows": len(df),
        "cols": df.shape[1],
        "preview": {
            "columns": df.columns.tolist(),
            "rows": head,
        },
    }


@router.get("/preview")
def preview(dataset_id: str = Query(...)) -> Dict[str, Any]:
    df = store.get(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    head = df.head(50).fillna("").astype(str).values.tolist()
    return {
        "columns": df.columns.tolist(),
        "rows": head,
    }


@router.get("/profile")
def profile(dataset_id: str = Query(...)) -> Dict[str, Any]:
    df = store.get(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Basic stats
    info = {
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "dtypes": {c: str(t) for c, t in df.dtypes.to_dict().items()},
        "missing": {c: int(df[c].isna().sum()) for c in df.columns},
        "unique": {c: int(df[c].nunique(dropna=True)) for c in df.columns},
    }

    # Numeric stats
    numeric_df = df.select_dtypes(include=[np.number])
    describe = numeric_df.describe(include="all").to_dict() if not numeric_df.empty else {}

    # Correlation (limit to avoid huge matrices)
    corr_pairs: List[Dict[str, Any]] = []
    if numeric_df.shape[1] >= 2:
        corr = numeric_df.corr(numeric_only=True)
        # Flatten top 20 abs correlations (excluding self)
        pairs = []
        cols = corr.columns
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                pairs.append({
                    "col_x": cols[i],
                    "col_y": cols[j],
                    "corr": float(corr.iloc[i, j]),
                    "abs_corr": float(abs(corr.iloc[i, j]))
                })
        pairs.sort(key=lambda x: x["abs_corr"], reverse=True)
        corr_pairs = pairs[:20]

    return {
        "info": info,
        "numeric_describe": describe,
        "top_correlations": corr_pairs,
    }


@router.get("/visual/hist")
def histogram(dataset_id: str = Query(...), column: str = Query(...), bins: int = 20) -> Dict[str, Any]:
    df = store.get(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if column not in df.columns:
        raise HTTPException(status_code=400, detail="Column not found")

    series = df[column].dropna()
    if series.empty:
        return {"bins": [], "counts": []}
    # Try numeric bins else category counts
    if np.issubdtype(series.dtype, np.number):
        counts, bin_edges = np.histogram(series, bins=bins)
        return {"bins": bin_edges.tolist(), "counts": counts.tolist()}
    else:
        counts = series.value_counts().head(30)  # cap categories
        return {"bins": counts.index.astype(str).tolist(), "counts": counts.values.tolist()}


@router.post("/preprocess")
def preprocess(dataset_id: str = Query(...), scale_numeric: bool = True) -> Dict[str, Any]:
    df = store.get(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    pipeline, feature_names = build_auto_pipeline(df, scale_numeric=scale_numeric)
    out_df = transform_to_dataframe(pipeline, df, feature_names)

    # Save processed dataframe and pipeline
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    processed_path = os.path.join(PROCESSED_DIR, f"{dataset_id}.csv")
    out_df.to_csv(processed_path, index=False)

    pipeline_path = os.path.join(PROCESSED_DIR, f"{dataset_id}.joblib")
    joblib.dump(pipeline, pipeline_path)

    store.set_processed(dataset_id, out_df)
    store.set_pipeline_path(dataset_id, pipeline_path)

    head = out_df.head(20).values.tolist()
    return {
        "processed_preview": {
            "columns": out_df.columns.tolist(),
            "rows": head,
        },
        "download_url": f"/api/download?dataset_id={dataset_id}&type=processed",
        "pipeline_saved": True,
    }


@router.get("/download")
async def download(dataset_id: str = Query(...), type: str = Query("original")):
    if type not in {"original", "processed"}:
        raise HTTPException(status_code=400, detail="type must be 'original' or 'processed'")

    if type == "original":
        df = store.get(dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
    else:
        df = store.get_processed(dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Processed dataset not found. Run /preprocess first")

    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(iter([stream.getvalue().encode()]), media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename={type}_{dataset_id}.csv"
    })
