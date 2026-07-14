"""Resume upload + analysis endpoints (contracts 7, resume.py [B3])."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.student import Student
from app.models.user import User
from app.schemas.student import ResumeAnalysisOut
from app.services import resume_service

router = APIRouter(prefix="/resume", tags=["resume"])


def _current_student(db: Session, user: User) -> Student:
    """Resolve the Student profile belonging to the current user, or 404."""
    student = db.execute(
        select(Student).where(Student.user_id == user.id)
    ).scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for the current user",
        )
    return student


def _authorize_student_access(db: Session, student_id: int, current_user: User) -> Student:
    """Faculty/placement/admin may read any student; a student only their own."""
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if current_user.role == "student" and student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only access your own resume analysis",
        )
    return student


@router.post(
    "/upload",
    response_model=ResumeAnalysisOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and analyze a PDF resume (student only)",
)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> ResumeAnalysisOut:
    student = _current_student(db, current_user)
    content = await file.read()
    analysis = resume_service.analyze_and_store_resume(
        db,
        student_id=student.id,
        filename=file.filename,
        content_type=file.content_type,
        content=content,
    )
    return ResumeAnalysisOut.model_validate(analysis)


@router.get(
    "/students/{student_id}/latest",
    response_model=ResumeAnalysisOut,
    summary="Get the latest resume analysis for a student",
)
def latest_resume_analysis(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeAnalysisOut:
    _authorize_student_access(db, student_id, current_user)
    analysis = resume_service.get_latest_analysis(db, student_id)
    return ResumeAnalysisOut.model_validate(analysis)
