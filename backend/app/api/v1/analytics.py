"""Cross-cohort analytics endpoints (contracts 7, analytics.py [B3])."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.analytics import DepartmentAnalytics, Distributions, SkillAnalytics
from app.schemas.common import Department
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

_ANALYTICS_ROLES = ("faculty", "placement_officer", "admin")


@router.get(
    "/distributions",
    response_model=Distributions,
    summary="Probability / readiness / resume-score histograms + risk distribution",
)
def distributions(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(*_ANALYTICS_ROLES)),
) -> Distributions:
    return Distributions.model_validate(analytics_service.distributions(db))


@router.get(
    "/departments",
    response_model=list[DepartmentAnalytics],
    summary="Per-department analytics rows",
)
def departments(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(*_ANALYTICS_ROLES)),
) -> list[DepartmentAnalytics]:
    rows = analytics_service.department_analytics(db)
    return [DepartmentAnalytics.model_validate(row) for row in rows]


@router.get(
    "/skills",
    response_model=SkillAnalytics,
    summary="Skill averages + per-skill distribution (optionally by department)",
)
def skills(
    department: Department | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(*_ANALYTICS_ROLES)),
) -> SkillAnalytics:
    return SkillAnalytics.model_validate(
        analytics_service.skill_analytics(db, department=department)
    )
