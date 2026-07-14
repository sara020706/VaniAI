"""Dataset upload/validation service (CONTRACTS.md section 7, admin.py).

Handles persisting an uploaded CSV under ``UPLOAD_DIR/datasets/``, parsing it
with pandas, running it through ``ml.data.validation.validate_dataframe``, and
recording the resulting ``datasets`` row with status ``validated`` or ``invalid``.
"""

from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.ml import Dataset
from app.repositories.dataset_repository import DatasetRepository
from app.schemas.common import Page, PageParams
from ml.data.validation import validate_dataframe

logger = logging.getLogger(__name__)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class DatasetService:
    """Upload, validate, and list training datasets."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = DatasetRepository(db)
        self.settings = get_settings()

    @property
    def _datasets_dir(self) -> Path:
        directory = Path(self.settings.upload_dir) / "datasets"
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Reduce an uploaded filename to a safe basename ending in ``.csv``."""
        base = Path(filename or "dataset.csv").name
        cleaned = _SAFE_NAME.sub("_", base).strip("._") or "dataset.csv"
        if not cleaned.lower().endswith(".csv"):
            cleaned = f"{cleaned}.csv"
        return cleaned

    def upload(
        self,
        *,
        filename: str,
        content: bytes,
        uploaded_by: int,
        name: str | None = None,
    ) -> Dataset:
        """Persist an uploaded CSV, validate it, and record the dataset row.

        Raises ``ValidationError`` when the payload is empty or cannot be parsed
        as CSV at all (a *malformed* upload, distinct from a well-formed CSV that
        merely fails schema validation — that produces an ``invalid`` row).
        """
        if not content:
            raise ValidationError("Uploaded file is empty")

        safe_name = self._sanitize_filename(filename)
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        file_path = self._datasets_dir / stored_name
        file_path.write_bytes(content)

        try:
            frame = pd.read_csv(file_path)
        except Exception as exc:  # noqa: BLE001 - surface any parse failure uniformly
            file_path.unlink(missing_ok=True)
            raise ValidationError(f"File could not be parsed as CSV: {exc}") from exc

        row_count = int(len(frame))
        ok, errors = validate_dataframe(frame)
        status = "validated" if ok else "invalid"
        validation_errors = None if ok else [str(e) for e in errors]

        dataset = self.repo.create(
            name=name or safe_name,
            filename=safe_name,
            file_path=str(file_path),
            row_count=row_count,
            status=status,
            uploaded_by=uploaded_by,
            validation_errors=validation_errors,
        )
        self.db.commit()
        self.db.refresh(dataset)
        logger.info(
            "Dataset %s uploaded (rows=%d, status=%s)", dataset.id, row_count, status
        )
        return dataset

    def list(self, params: PageParams) -> Page[dict[str, Any]]:
        """Return a paginated page of ``DatasetOut`` dicts."""
        rows, total = self.repo.list_paginated(offset=params.offset, limit=params.page_size)
        items = [self.repo.serialize(dataset) for dataset in rows]
        return Page[dict[str, Any]](
            items=items, total=total, page=params.page, page_size=params.page_size
        )

    def get_or_404(self, dataset_id: int) -> Dataset:
        """Fetch a dataset by id or raise ``NotFoundError``."""
        dataset = self.repo.get(dataset_id)
        if dataset is None:
            raise NotFoundError(f"Dataset {dataset_id} not found")
        return dataset

    def serialize(self, dataset: Dataset) -> dict[str, Any]:
        """Public passthrough to the repository's ``DatasetOut`` serializer."""
        return self.repo.serialize(dataset)
