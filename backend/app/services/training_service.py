"""Model training orchestration (CONTRACTS.md section 7, admin.py).

``TrainingService`` creates the ``experiments`` row (status ``running``) and the
module-level ``run_training`` executes the actual training in a FastAPI
``BackgroundTasks`` worker: it opens its own DB session, calls
``ml.training.train.train_and_register``, updates the experiment, inserts a
``model_versions`` row, flips the new version active (others inactive), and
reloads the inference predictor so the newly trained model serves immediately.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.exceptions import NotFoundError, ValidationError
from app.core.metrics import set_active_model
from app.models.ml import Experiment
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.model_repository import ModelRepository
from ml.inference.predictor import reload_predictor
from ml.training.train import train_and_register

logger = logging.getLogger(__name__)


class TrainingService:
    """Create training experiments and expose the training-history/model queries."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.datasets = DatasetRepository(db)
        self.models = ModelRepository(db)

    def start_training(self, dataset_id: int) -> Experiment:
        """Validate the dataset and create a ``running`` experiment row.

        The heavy training work is dispatched separately via ``run_training`` in
        a background task; this method only sets up the experiment record.
        """
        dataset = self.datasets.get(dataset_id)
        if dataset is None:
            raise NotFoundError(f"Dataset {dataset_id} not found")
        if dataset.status not in ("validated", "used"):
            raise ValidationError(
                f"Dataset {dataset_id} is not usable for training (status={dataset.status})"
            )
        experiment = self.models.create_experiment(
            dataset_id=dataset.id,
            model_type="pending",
            params={"dataset_id": dataset.id, "dataset_path": dataset.file_path},
            metrics={},
            status="running",
        )
        self.db.commit()
        self.db.refresh(experiment)
        logger.info("Training experiment %s started for dataset %s", experiment.id, dataset.id)
        return experiment

    def start_retraining(self) -> Experiment:
        """Create a ``running`` experiment for the latest usable dataset.

        Raises ``ValidationError`` when no ``used``/``validated`` dataset exists.
        """
        dataset = self.datasets.latest_usable()
        if dataset is None:
            raise ValidationError("No validated or used dataset available for retraining")
        return self.start_training(dataset.id)

    def list_history(self, *, offset: int, limit: int) -> tuple[list[Experiment], int]:
        """Return a page of experiments (newest first) and the total count."""
        rows, total = self.models.list_experiments_paginated(offset=offset, limit=limit)
        return list(rows), total

    def list_models(self) -> list[Any]:
        """Return all model versions, newest first."""
        return list(self.models.list_versions())


def run_training(experiment_id: int) -> None:
    """Background worker: train, register, activate, and reload the predictor.

    Runs in a fresh DB session because the request-scoped session that created
    the experiment is already closed by the time the background task executes.
    Any failure marks the experiment ``failed`` (never crashes the worker).
    """
    settings = get_settings()
    session = SessionLocal()
    try:
        models = ModelRepository(session)
        datasets = DatasetRepository(session)

        experiment = models.get_experiment(experiment_id)
        if experiment is None:
            logger.error("run_training: experiment %s not found", experiment_id)
            return

        dataset = datasets.get(experiment.dataset_id) if experiment.dataset_id else None
        if dataset is None:
            _fail_experiment(session, models, experiment, "Dataset not found")
            return

        logger.info(
            "run_training: training experiment %s on dataset %s (%s)",
            experiment_id,
            dataset.id,
            dataset.file_path,
        )
        result = train_and_register(
            dataset_path=dataset.file_path,
            model_dir=settings.model_dir,
        )

        version = str(result["version"])
        model_type = str(result["model_type"])
        metrics: dict[str, Any] = dict(result.get("metrics") or {})
        candidates: dict[str, Any] = dict(result.get("candidates") or {})
        mlflow_run_id = result.get("mlflow_run_id")

        # Finalize the experiment record.
        models.complete_experiment(
            experiment,
            status="completed",
            model_type=model_type,
            params={
                "dataset_id": dataset.id,
                "dataset_path": dataset.file_path,
                "candidates": list(candidates.keys()),
            },
            metrics={"selected": metrics, "candidates": candidates},
            mlflow_run_id=str(mlflow_run_id) if mlflow_run_id is not None else None,
        )

        # Insert (or update) the model_versions row and activate it exclusively.
        existing = models.get_by_version(version)
        artifact_path = f"{settings.model_dir}/versions/{version}/model.joblib"
        if existing is None:
            models.create_version(
                version=version,
                model_type=model_type,
                metrics=metrics,
                artifact_path=artifact_path,
                mlflow_run_id=str(mlflow_run_id) if mlflow_run_id is not None else None,
                is_active=False,
            )
        else:
            existing.model_type = model_type
            existing.metrics = metrics
            existing.artifact_path = artifact_path
            session.add(existing)
            session.flush()

        models.set_active(version)

        # Mark the dataset as used now that a model was trained on it.
        datasets.set_status(dataset, "used")

        session.commit()

        # Refresh the in-process predictor and Prometheus gauge post-deploy.
        reload_predictor(settings.model_dir)
        set_active_model(version)
        logger.info(
            "run_training: experiment %s completed -> model %s (%s)",
            experiment_id,
            version,
            model_type,
        )
    except Exception:  # noqa: BLE001 - background worker must never crash
        logger.exception("run_training: experiment %s failed", experiment_id)
        session.rollback()
        try:
            models = ModelRepository(session)
            experiment = models.get_experiment(experiment_id)
            if experiment is not None:
                _fail_experiment(session, models, experiment, "Training failed")
        except Exception:  # noqa: BLE001 - swallow secondary failures
            logger.exception("run_training: failed to mark experiment %s failed", experiment_id)
    finally:
        session.close()


def _fail_experiment(
    session: Session,
    models: ModelRepository,
    experiment: Experiment,
    message: str,
) -> None:
    """Mark an experiment ``failed`` and commit."""
    models.complete_experiment(
        experiment,
        status="failed",
        metrics={"error": message},
    )
    session.commit()
