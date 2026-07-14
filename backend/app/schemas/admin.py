"""Admin schemas: user management, datasets, training, model versions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import Role


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: Role


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    filename: str
    row_count: int
    status: Literal["uploaded", "validated", "invalid", "used"]
    validation_errors: list[str] | None = None
    created_at: datetime


class TrainingStartRequest(BaseModel):
    dataset_id: int


class TrainingStartResponse(BaseModel):
    experiment_id: int
    status: Literal["running"] = "running"


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    mlflow_run_id: str | None = None
    dataset_id: int | None = None
    model_type: str
    params: dict[str, Any]
    metrics: dict[str, Any]
    status: Literal["running", "completed", "failed"]
    started_at: datetime
    finished_at: datetime | None = None


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    version: str
    model_type: str
    metrics: dict[str, Any]
    is_active: bool
    created_at: datetime
