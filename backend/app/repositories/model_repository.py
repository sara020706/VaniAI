"""Data-access layer for experiments and model versions (CONTRACTS.md section 5)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.common import utcnow
from app.models.ml import Experiment, ModelVersion


class ModelRepository:
    """CRUD/query helpers for training experiments and the model registry."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Experiments -----------------------------------------------------------------

    def create_experiment(
        self,
        *,
        dataset_id: int | None,
        model_type: str,
        params: dict[str, Any],
        metrics: dict[str, Any],
        status: str,
        mlflow_run_id: str | None = None,
    ) -> Experiment:
        """Create an experiment row (typically ``status="running"``)."""
        experiment = Experiment(
            dataset_id=dataset_id,
            model_type=model_type,
            params=params,
            metrics=metrics,
            status=status,
            mlflow_run_id=mlflow_run_id,
        )
        self.db.add(experiment)
        self.db.flush()
        self.db.refresh(experiment)
        return experiment

    def get_experiment(self, experiment_id: int) -> Experiment | None:
        """Return an experiment by id, or ``None``."""
        return self.db.get(Experiment, experiment_id)

    def complete_experiment(
        self,
        experiment: Experiment,
        *,
        status: str,
        model_type: str | None = None,
        params: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        mlflow_run_id: str | None = None,
        finished_at: datetime | None = None,
    ) -> Experiment:
        """Finalize an experiment: set terminal status, metrics, and finish time."""
        experiment.status = status
        if model_type is not None:
            experiment.model_type = model_type
        if params is not None:
            experiment.params = params
        if metrics is not None:
            experiment.metrics = metrics
        if mlflow_run_id is not None:
            experiment.mlflow_run_id = mlflow_run_id
        experiment.finished_at = finished_at or utcnow()
        self.db.add(experiment)
        self.db.flush()
        return experiment

    def list_experiments_paginated(
        self, *, offset: int, limit: int
    ) -> tuple[Sequence[Experiment], int]:
        """Return a page of experiments (newest first) and the total count."""
        total = self.db.scalar(select(func.count()).select_from(Experiment)) or 0
        stmt = (
            select(Experiment)
            .order_by(Experiment.started_at.desc(), Experiment.id.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = self.db.scalars(stmt).all()
        return rows, int(total)

    # --- Model versions --------------------------------------------------------------

    def create_version(
        self,
        *,
        version: str,
        model_type: str,
        metrics: dict[str, Any],
        artifact_path: str,
        mlflow_run_id: str | None = None,
        is_active: bool = False,
    ) -> ModelVersion:
        """Insert a model_versions row."""
        model_version = ModelVersion(
            version=version,
            model_type=model_type,
            metrics=metrics,
            artifact_path=artifact_path,
            mlflow_run_id=mlflow_run_id,
            is_active=is_active,
        )
        self.db.add(model_version)
        self.db.flush()
        self.db.refresh(model_version)
        return model_version

    def get_by_version(self, version: str) -> ModelVersion | None:
        """Return a model version by its string tag (e.g. ``"v3"``), or ``None``."""
        stmt = select(ModelVersion).where(ModelVersion.version == version)
        return self.db.scalars(stmt).first()

    def list_versions(self) -> Sequence[ModelVersion]:
        """All model versions, newest first."""
        stmt = select(ModelVersion).order_by(
            ModelVersion.created_at.desc(), ModelVersion.id.desc()
        )
        return self.db.scalars(stmt).all()

    def active_version(self) -> ModelVersion | None:
        """The currently active model version, if any."""
        stmt = select(ModelVersion).where(ModelVersion.is_active.is_(True))
        return self.db.scalars(stmt).first()

    def deactivate_all(self) -> None:
        """Mark every model version inactive (used before activating a new one)."""
        for version in self.db.scalars(select(ModelVersion)).all():
            if version.is_active:
                version.is_active = False
                self.db.add(version)
        self.db.flush()

    def set_active(self, version: str) -> ModelVersion | None:
        """Activate ``version`` exclusively, flipping all others inactive.

        Returns the activated ``ModelVersion`` or ``None`` if it does not exist.
        """
        target = self.get_by_version(version)
        if target is None:
            return None
        self.deactivate_all()
        target.is_active = True
        self.db.add(target)
        self.db.flush()
        return target
