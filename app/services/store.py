import uuid
from typing import Dict, Optional
import pandas as pd

class DatasetStore:
    def __init__(self) -> None:
        self._frames: Dict[str, pd.DataFrame] = {}
        self._processed_frames: Dict[str, pd.DataFrame] = {}
        self._pipeline_paths: Dict[str, str] = {}

    def add(self, df: pd.DataFrame) -> str:
        dataset_id = str(uuid.uuid4())
        self._frames[dataset_id] = df
        return dataset_id

    def get(self, dataset_id: str) -> Optional[pd.DataFrame]:
        return self._frames.get(dataset_id)

    def set_processed(self, dataset_id: str, df: pd.DataFrame) -> None:
        self._processed_frames[dataset_id] = df

    def get_processed(self, dataset_id: str) -> Optional[pd.DataFrame]:
        return self._processed_frames.get(dataset_id)

    def set_pipeline_path(self, dataset_id: str, path: str) -> None:
        self._pipeline_paths[dataset_id] = path

    def get_pipeline_path(self, dataset_id: str) -> Optional[str]:
        return self._pipeline_paths.get(dataset_id)

store = DatasetStore()
