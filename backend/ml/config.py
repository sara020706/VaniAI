"""Standalone configuration for the VaniAI ML package.

Resolves default paths (model artifacts, datasets, params file) from
environment variables with sane defaults. This module must stay importable on
a bare Python installation (stdlib only) and must never import from ``app.*``.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

# --- Filesystem anchors ------------------------------------------------------

ML_PACKAGE_DIR: Path = Path(__file__).resolve().parent  # <repo>/backend/ml
BACKEND_DIR: Path = ML_PACKAGE_DIR.parent  # <repo>/backend
PROJECT_ROOT: Path = BACKEND_DIR.parent  # <repo>


# --- Environment-driven settings ----------------------------------------------


def get_model_dir() -> Path:
    """Directory holding versioned model artifacts (env: ``MODEL_DIR``)."""
    return Path(os.getenv("MODEL_DIR", str(BACKEND_DIR / "ml_artifacts")))


def get_data_dir() -> Path:
    """Directory holding datasets (env: ``DATA_DIR``)."""
    return Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))


def get_default_dataset_path() -> Path:
    """Default training CSV (env: ``DATASET_PATH``)."""
    return Path(os.getenv("DATASET_PATH", str(get_data_dir() / "sample_students.csv")))


def get_mlflow_tracking_uri() -> str:
    """MLflow tracking URI; empty string means "log to local ``./mlruns``"."""
    return os.getenv("MLFLOW_TRACKING_URI", "").strip()


def get_params_path() -> Path:
    """Location of the flat ``params.yaml`` holding training hyperparameters."""
    return Path(os.getenv("PARAMS_PATH", str(PROJECT_ROOT / "params.yaml")))


# Convenience snapshots evaluated at import time.
MODEL_DIR: Path = get_model_dir()
DATA_DIR: Path = get_data_dir()
DEFAULT_DATASET_PATH: Path = get_default_dataset_path()
MLFLOW_TRACKING_URI: str = get_mlflow_tracking_uri()
PARAMS_PATH: Path = get_params_path()

EXPERIMENT_NAME: str = os.getenv("MLFLOW_EXPERIMENT_NAME", "vaniai-placement")


# --- Training hyperparameters ---------------------------------------------------

DEFAULT_PARAMS: dict[str, int | float] = {
    "test_size": 0.2,
    "random_state": 42,
    "rf_n_estimators": 300,
    "xgb_n_estimators": 300,
    "xgb_max_depth": 5,
    "xgb_learning_rate": 0.1,
    "logreg_max_iter": 1000,
}


def _parse_scalar(raw: str) -> int | float | bool | str:
    """Parse a single flat YAML scalar without needing PyYAML."""
    text = raw.strip().strip('"').strip("'")
    lowered = text.lower()
    if lowered in {"true", "yes", "on"}:
        return True
    if lowered in {"false", "no", "off"}:
        return False
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        return text


def load_params(path: str | Path | None = None) -> dict[str, Any]:
    """Read flat ``key: value`` pairs from ``params.yaml``.

    PyYAML is not a project dependency, so this is a minimal hand parser for
    the flat keys defined in the repository-root ``params.yaml``. Unknown keys
    are kept, missing keys fall back to :data:`DEFAULT_PARAMS`, and a missing
    or unreadable file simply yields the defaults so training always runs.
    """
    params: dict[str, Any] = dict(DEFAULT_PARAMS)
    params_path = Path(path) if path is not None else get_params_path()
    try:
        text = params_path.read_text(encoding="utf-8")
    except OSError:
        return params
    for line in text.splitlines():
        if line.startswith((" ", "\t")):  # nested keys are not flat params
            continue
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue
        key, _, value = stripped.partition(":")
        value = value.partition("#")[0]
        if not key.strip() or not value.strip():
            continue
        params[key.strip()] = _parse_scalar(value)
    return params
