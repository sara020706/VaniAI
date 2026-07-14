"""PDF report endpoints (contracts 7, reports.py [B3])."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.student import Student
from app.models.user import User
from app.schemas.common import Department
from app.services import report_service
from app.services.report_service import GeneratedReport

router = APIRouter(prefix="/reports", tags=["reports"])


def _authorize_student_access(db: Session, student_id: int, current_user: User) -> Student:
    """Faculty/placement/admin may access any student; a student only their own."""
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if current_user.role == "student" and student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only download your own report",
        )
    return student


def _pdf_response(report: GeneratedReport) -> FileResponse:
    return FileResponse(
        path=report.file_path,
        media_type="application/pdf",
        filename=report.filename,
    )


@router.get(
    "/students/{student_id}",
    summary="Download a student's career-readiness PDF report",
)
def student_report(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    _authorize_student_access(db, student_id, current_user)
    report = report_service.generate_student_report(
        db, student_id=student_id, generated_by=current_user.id
    )
    return _pdf_response(report)


@router.get(
    "/department/{department}",
    summary="Download an aggregate department PDF report",
)
def department_report(
    department: Department,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("faculty", "placement_officer", "admin")),
) -> FileResponse:
    report = report_service.generate_department_report(
        db, department=department, generated_by=current_user.id
    )
    return _pdf_response(report)


@router.get(
    "/placement",
    summary="Download the institution-wide placement PDF report",
)
def placement_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("placement_officer", "admin")),
) -> FileResponse:
    report = report_service.generate_placement_report(db, generated_by=current_user.id)
    return _pdf_response(report)
