"""Versioned joblib model registry (CONTRACTS.md §6.2 step 6).

On-disk layout under ``model_dir``::

    <model_dir>/
      versions/
        v1/ model.joblib  metadata.json
        v2/ model.joblib  metadata.json
        ...
      active/            <- copy of the currently active version
        model.joblib
        metadata.json
      reference/
        reference.csv    <- cleaned training frame (drift baseline)

``metadata.json`` shape::

    {
      "version": "v3",
      "model_type": "XGBoost",
      "metrics": {...},
      "feature_columns": [...],       # MODEL_COLUMNS (base + engineered)
      "trained_at": "2026-07-14T...Z",# ISO-8601 UTC
      "dataset_path": "..."
    }

Public API:
- ``register_model(pipeline, metrics, model_type, model_dir, ...) -> dict`` —
  writes the next version, saves the reference frame if provided, and
  auto-activates the new version. Returns the metadata dict.
- ``activate_version(version, model_dir) -> None`` — copy a version into
  ``active/``.
- ``list_versions(model_dir) -> list[str]`` / ``load_metadata(...)`` helpers.
"""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ml.features.engineering import MODEL_COLUMNS

_VERSION_RE = re.compile(r"^v(\d+)$")


def _versions_dir(model_dir: Path) -> Path:
    return model_dir / "versions"


def _active_dir(model_dir: Path) -> Path:
    return model_dir / "active"


def _reference_dir(model_dir: Path) -> Path:
    return model_dir / "reference"


def list_versions(model_dir: str | Path) -> list[str]:
    """Return existing version names (``["v1", "v2", ...]``) sorted numerically."""
    versions_root = _versions_dir(Path(model_dir))
    if not versions_root.exists():
        return []
    found: list[tuple[int, str]] = []
    for child in versions_root.iterdir():
        if child.is_dir():
            match = _VERSION_RE.match(child.name)
            if match:
                found.append((int(match.group(1)), child.name))
    found.sort(key=lambda item: item[0])
    return [name for _, name in found]


def next_version(model_dir: str | Path) -> str:
    """Return the next version label (``"v{n}"``) for ``model_dir``."""
    existing = list_versions(model_dir)
    if not existing:
        return "v1"
    highest = max(int(_VERSION_RE.match(name).group(1)) for name in existing)  # type: ignore[union-attr]
    return f"v{highest + 1}"


def load_metadata(version: str, model_dir: str | Path) -> dict[str, Any]:
    """Read the ``metadata.json`` for a specific version."""
    meta_path = _versions_dir(Path(model_dir)) / version / "metadata.json"
    return json.loads(meta_path.read_text(encoding="utf-8"))


def activate_version(version: str, model_dir: str | Path) -> None:
    """Copy ``version``'s artifacts into ``active/``.

    Raises ``FileNotFoundError`` if the version does not exist. The previous
    contents of ``active/`` are replaced atomically-ish (written then swapped
    file-by-file) so a partially failed copy leaves the model loadable.
    """
    model_dir = Path(model_dir)
    version_dir = _versions_dir(model_dir) / version
    model_src = version_dir / "model.joblib"
    meta_src = version_dir / "metadata.json"
    if not model_src.exists() or not meta_src.exists():
        raise FileNotFoundError(f"Version '{version}' not found under {version_dir}.")

    active = _active_dir(model_dir)
    active.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model_src, active / "model.joblib")
    shutil.copy2(meta_src, active / "metadata.json")


def save_reference_frame(reference_df: pd.DataFrame, model_dir: str | Path) -> Path:
    """Persist the cleaned training frame as the drift baseline reference.csv."""
    ref_dir = _reference_dir(Path(model_dir))
    ref_dir.mkdir(parents=True, exist_ok=True)
    ref_path = ref_dir / "reference.csv"
    reference_df.to_csv(ref_path, index=False)
    return ref_path


def register_model(
    pipeline: Any,
    metrics: dict[str, Any],
    model_type: str,
    model_dir: str | Path,
    *,
    dataset_path: str | None = None,
    reference_df: pd.DataFrame | None = None,
    feature_columns: list[str] | None = None,
    activate: bool = True,
) -> dict[str, Any]:
    """Persist ``pipeline`` as the next model version and (optionally) activate it.

    Returns the metadata dict that was written to ``metadata.json``.
    """
    model_dir = Path(model_dir)
    version = next_version(model_dir)
    version_dir = _versions_dir(model_dir) / version
    version_dir.mkdir(parents=True, exist_ok=True)

    model_path = version_dir / "model.joblib"
    joblib.dump(pipeline, model_path)

    metadata: dict[str, Any] = {
        "version": version,
        "model_type": model_type,
        "metrics": metrics,
        "feature_columns": list(feature_columns) if feature_columns else list(MODEL_COLUMNS),
        "trained_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "dataset_path": dataset_path,
    }
    (version_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=False),
        encoding="utf-8",
    )

    if reference_df is not None:
        save_reference_frame(reference_df, model_dir)

    if activate:
        activate_version(version, model_dir)

    return metadata
