"""Monitoring schemas: system health and drift status."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class MonitoringHealth(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ok"] = "ok"
    database: bool
    model_loaded: bool
    model_version: str
    is_fallback: bool
    mlflow_configured: bool
    uptime_seconds: float


class DataDriftResult(BaseModel):
    data_drift_detected: bool
    share_drifted: float
    drifted_features: list[str]
    checked_at: datetime


class PredictionDriftResult(BaseModel):
    psi: float
    drift_detected: bool
    checked_at: datetime


class MonitoringLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    metric_type: Literal["data_drift", "prediction_drift", "system"]
    drift_detected: bool
    created_at: datetime


class DriftStatus(BaseModel):
    data_drift: DataDriftResult | None = None
    prediction_drift: PredictionDriftResult | None = None
    history: list[MonitoringLogItem]
