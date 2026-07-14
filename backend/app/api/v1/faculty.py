"""Faculty analytics / comparison / interview-score routes (CONTRACTS.md §7 faculty.py).

Router carries its own ``/faculty`` prefix; mounted under ``/api/v1``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.exceptions import ValidationError
from app.models.user import User
from app.schemas.common import Department
from app.schemas.faculty import (
    CompareResponse,
    FacultyAnalytics,
    InterviewScoreCreate,
    InterviewScoreOut,
)
from app.services.faculty_service import FacultyService

router = APIRouter(prefix="/faculty", tags=["faculty"])

_MIN_COMPARE = 2
_MAX_COMPARE = 4


def _parse_student_ids(raw: str) -> list[int]:
    """Parse a comma-separated ``student_ids`` query value into ints.

    Enforces 2–4 unique, positive ids; raises ``ValidationError`` (→ 422) on
    malformed or out-of-range input.
    """
    parts = [chunk.strip() for chunk in raw.split(",") if chunk.strip()]
    ids: list[int] = []
    seen: set[int] = set()
    for part in parts:
        try:
            value = int(part)
        except ValueError as exc:
            raise ValidationError(f"Invalid student id: '{part}'") from exc
        if value <= 0:
            raise ValidationError(f"Student id must be positive: {value}")
        if value not in seen:
            seen.add(value)
            ids.append(value)
    if not (_MIN_COMPARE <= len(ids) <= _MAX_COMPARE):
        raise ValidationError(
            f"Provide between {_MIN_COMPARE} and {_MAX_COMPARE} distinct student ids"
        )
    return ids


@router.get(
    "/analytics",
    response_model=FacultyAnalytics,
    summary="Cohort analytics (faculty, admin)",
)
def analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("faculty", "admin")),
    department: Department | None = Query(default=None),
    batch: str | None = Query(default=None),
) -> FacultyAnalytics:
    """Aggregate analytics over the (optionally filtered) student cohort."""
    return FacultyService(db).analytics(department=department, batch=batch)


@router.get(
    "/compare",
    response_model=CompareResponse,
    summary="Compare 2–4 students (faculty, placement_officer, admin)",
)
def compare(
    student_ids: str = Query(..., description="Comma-separated student ids, e.g. 1,2,3"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("faculty", "placement_officer", "admin")
    ),
) -> CompareResponse:
    """Return side-by-side comparison data for the requested students."""
    ids = _parse_student_ids(student_ids)
    return FacultyService(db).compare(ids)


@router.post(
    "/interview-scores",
    response_model=InterviewScoreOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record an interview score (faculty, admin)",
)
def submit_interview_score(
    payload: InterviewScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("faculty", "admin")),
) -> InterviewScoreOut:
    """Persist an interview score and return the readiness assessment."""
    return FacultyService(db).submit_interview_score(payload, entered_by=current_user.id)
