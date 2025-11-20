from typing import List, Tuple
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline


def build_auto_pipeline(df: pd.DataFrame, scale_numeric: bool = True) -> Tuple[Pipeline, List[str]]:
    df = df.copy()
    # Infer numeric/categorical columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in df.columns if c not in numeric_cols]

    num_steps = [("imputer", SimpleImputer(strategy="median"))]
    if scale_numeric:
        num_steps.append(("scaler", StandardScaler()))

    cat_steps = [
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline(num_steps), numeric_cols),
            ("cat", Pipeline(cat_steps), categorical_cols),
        ],
        remainder="drop",
    )

    pipeline = Pipeline(steps=[("preprocessor", preprocessor)])

    # Fit to capture feature names
    pipeline.fit(df)

    # Compute feature names after transform
    feature_names: List[str] = []
    if numeric_cols:
        feature_names.extend(numeric_cols)
    if categorical_cols:
        onehot = pipeline.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"]
        cat_feature_names = onehot.get_feature_names_out(categorical_cols).tolist()
        feature_names.extend(cat_feature_names)

    return pipeline, feature_names


def transform_to_dataframe(pipeline: Pipeline, df: pd.DataFrame, feature_names: List[str]) -> pd.DataFrame:
    x = pipeline.transform(df)
    out = pd.DataFrame(x, columns=feature_names)
    return out
