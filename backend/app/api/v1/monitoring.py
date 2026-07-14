"""Monitoring API (CONTRACTS.md section 7, monitoring.py [B4]).

Endpoints (all require the ``admin`` role):
- ``GET /monitoring/health`` — DB ping, predictor state, MLflow config, uptime.
- ``GET /monitoring/drift`` — latest persisted data/prediction drift + history.
- ``POST /monitoring/drift/run`` — recompute drift now, persist a log, return status.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.monitoring import DriftStatus, MonitoringHealth
from app.services.monitoring_service import MonitoringService

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

AdminUser = Annotated[User, Depends(require_roles("admin"))]
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/health", response_model=MonitoringHealth)
def health(_admin: AdminUser, db: DbSession) -> MonitoringHealth:
    """Report backend health: database, model, MLflow configuration, and uptime."""
    service = MonitoringService(db)
    return MonitoringHealth.model_validate(service.health())


@router.get("/drift", response_model=DriftStatus)
def drift_status(_admin: AdminUser, db: DbSession) -> DriftStatus:
    """Return the most recent persisted drift status plus recent history."""
    service = MonitoringService(db)
    return DriftStatus.model_validate(service.status())


@router.post("/drift/run", response_model=DriftStatus)
def run_drift(_admin: AdminUser, db: DbSession) -> DriftStatus:
    """Run a fresh drift check now (reference vs. current), persist, and return it."""
    service = MonitoringService(db)
    return DriftStatus.model_validate(service.run_drift())
