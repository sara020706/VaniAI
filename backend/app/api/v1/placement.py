"""Placement-officer dashboard, at-risk, and CSV export endpoints (contracts 7)."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.common import Page
from app.schemas.placement import AtRiskStudent, PlacementDashboard
from app.services import analytics_service

router = APIRouter(prefix="/placement", tags=["placement"])

_CSV_COLUMNS = [
    "id",
    "full_name",
    "register_number",
    "department",
    "batch",
    "semester",
    "cgpa",
    "placement_probability",
    "readiness_overall",
    "risk_level",
]


@router.get(
    "/dashboard",
    response_model=PlacementDashboard,
    summary="Placement-officer dashboard aggregates",
)
def placement_dashboard(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("placement_officer", "admin")),
) -> PlacementDashboard:
    return PlacementDashboard.model_validate(analytics_service.placement_dashboard(db))


@router.get(
    "/at-risk",
    response_model=Page[AtRiskStudent],
    summary="Paginated list of at-risk students with risk reasons",
)
def at_risk(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("placement_officer", "faculty", "admin")),
) -> Page[AtRiskStudent]:
    result = analytics_service.at_risk_students(db, page=page, page_size=page_size)
    return Page[AtRiskStudent].model_validate(result)


@router.get(
    "/export",
    summary="Export all students as a CSV file",
)
def export_csv(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("placement_officer", "admin")),
) -> StreamingResponse:
    rows = analytics_service.export_rows(db)

    def _iter_csv() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=_CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in _CSV_COLUMNS})
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        _iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="placement_students.csv"'},
    )
