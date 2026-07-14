"""Data-access layer for dataset records (CONTRACTS.md section 5: ``datasets``)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ml import Dataset


class DatasetRepository:
    """CRUD/query helpers for uploaded training datasets."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        name: str,
        filename: str,
        file_path: str,
        row_count: int,
        status: str,
        uploaded_by: int,
        validation_errors: list[str] | None = None,
    ) -> Dataset:
        """Persist a new dataset row and return it (flushed, id populated)."""
        dataset = Dataset(
            name=name,
            filename=filename,
            file_path=file_path,
            row_count=row_count,
            status=status,
            validation_errors=validation_errors,
            uploaded_by=uploaded_by,
        )
        self.db.add(dataset)
        self.db.flush()
        self.db.refresh(dataset)
        return dataset

    def get(self, dataset_id: int) -> Dataset | None:
        """Return a dataset by primary key, or ``None`` if it does not exist."""
        return self.db.get(Dataset, dataset_id)

    def update_status(
        self,
        dataset: Dataset,
        *,
        status: str,
        validation_errors: list[str] | None = None,
    ) -> Dataset:
        """Update a dataset's status (and optional validation errors)."""
        dataset.status = status
        dataset.validation_errors = validation_errors
        self.db.add(dataset)
        self.db.flush()
        return dataset

    def set_status(self, dataset: Dataset, status: str) -> Dataset:
        """Update only the status field, leaving validation errors untouched."""
        dataset.status = status
        self.db.add(dataset)
        self.db.flush()
        return dataset

    def list_paginated(self, *, offset: int, limit: int) -> tuple[Sequence[Dataset], int]:
        """Return a page of datasets (newest first) and the total row count."""
        total = self.db.scalar(select(func.count()).select_from(Dataset)) or 0
        stmt = (
            select(Dataset)
            .order_by(Dataset.created_at.desc(), Dataset.id.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = self.db.scalars(stmt).all()
        return rows, int(total)

    def latest_usable(self) -> Dataset | None:
        """Most recent dataset eligible for (re)training: ``used`` or ``validated``.

        Prefers an already-``used`` dataset (the last one trained on); falls back
        to the newest ``validated`` dataset otherwise.
        """
        stmt = (
            select(Dataset)
            .where(Dataset.status.in_(("used", "validated")))
            .order_by(Dataset.created_at.desc(), Dataset.id.desc())
        )
        return self.db.scalars(stmt).first()

    def serialize(self, dataset: Dataset) -> dict[str, Any]:
        """Shape a dataset row into the ``DatasetOut`` dict (contracts section 7)."""
        errors = dataset.validation_errors
        return {
            "id": dataset.id,
            "name": dataset.name,
            "filename": dataset.filename,
            "row_count": dataset.row_count,
            "status": dataset.status,
            "validation_errors": list(errors) if errors is not None else None,
            "created_at": dataset.created_at,
        }
