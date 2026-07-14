"""MLOps models: datasets, experiments, model versions, monitoring logs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.common import utcnow


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    validation_errors: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    experiments: Mapped[list[Experiment]] = relationship("Experiment", back_populates="dataset")


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mlflow_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dataset_id: Mapped[int | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), index=True, nullable=True
    )
    model_type: Mapped[str] = mapped_column(String(64), nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    dataset: Mapped[Dataset | None] = relationship("Dataset", back_populates="experiments")


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    model_type: Mapped[str] = mapped_column(String(64), nullable=False)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    mlflow_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_path: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


class MonitoringLog(Base):
    __tablename__ = "monitoring_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    metric_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    drift_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
