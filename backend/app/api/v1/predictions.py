"""Prediction pipeline endpoints (contracts 7, predictions.py [B3])."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.prediction import PredictionHistoryItem, PredictionOut
from app.services import prediction_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _authorize_student_access(db: Session, student_id: int, current_user: User) -> Student:
    """Ensure the caller may act on ``student_id``.

    Faculty / placement officers / admins may access any student. A student may
    only access their own record. Raises 404 if the student does not exist and
    403 if a student targets someone else's record.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if current_user.role == "student" and student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only access your own predictions",
        )
    return student


@router.post(
    "/students/{student_id}",
    response_model=PredictionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Run the full prediction pipeline for a student",
)
def run_prediction(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PredictionOut:
    _authorize_student_access(db, student_id, current_user)
    result = prediction_service.run_prediction_for_student(db, student_id)
    return PredictionOut.model_validate(result)


@router.get(
    "/students/{student_id}/latest",
    response_model=PredictionOut,
    summary="Get the latest prediction for a student",
)
def latest_prediction(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PredictionOut:
    _authorize_student_access(db, student_id, current_user)
    result = prediction_service.get_latest_prediction(db, student_id)
    return PredictionOut.model_validate(result)


@router.get(
    "/students/{student_id}/history",
    response_model=list[PredictionHistoryItem],
    summary="Get the prediction history for a student",
)
def prediction_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PredictionHistoryItem]:
    _authorize_student_access(db, student_id, current_user)
    history = prediction_service.get_prediction_history(db, student_id)
    return [PredictionHistoryItem.model_validate(item) for item in history]
