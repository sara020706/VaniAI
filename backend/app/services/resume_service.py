"""Resume upload + analysis service.

Validates an uploaded PDF (type + size), stores it under ``UPLOAD_DIR/resumes/``,
runs the ML resume analyzer, and persists a ``resume_analyses`` row. The newest
analysis' ``resume_score`` is what the prediction pipeline reads as the student's
current resume score (see ``prediction_service.build_student_profile``).
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.student import ResumeAnalysis, Student
from app.repositories.resume_repository import ResumeRepository
from ml.resume.analyzer import analyze_resume

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
_PDF_MAGIC = b"%PDF-"


def _resumes_dir() -> Path:
    settings = get_settings()
    directory = Path(settings.upload_dir) / "resumes"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _validate_upload(filename: str | None, content_type: str | None, content: bytes) -> None:
    """Reject anything that is not a non-empty PDF within the size limit."""
    if not content:
        raise ValidationError("Uploaded file is empty")
    if len(content) > MAX_RESUME_BYTES:
        raise ValidationError("Resume exceeds the 5MB size limit")

    name = (filename or "").lower()
    is_pdf_name = name.endswith(".pdf")
    is_pdf_type = content_type is not None and content_type.lower() in _ALLOWED_CONTENT_TYPES
    is_pdf_magic = content.startswith(_PDF_MAGIC)

    # Require a PDF signal from either the declared type/extension AND the file
    # actually beginning with the PDF magic bytes — guards against mislabeled files.
    if not is_pdf_magic or not (is_pdf_name or is_pdf_type):
        raise ValidationError("Only PDF resumes are accepted")


def analyze_and_store_resume(
    db: Session,
    *,
    student_id: int,
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> ResumeAnalysis:
    """Validate, store, analyze, and persist a resume for a student.

    Returns the persisted :class:`ResumeAnalysis`. Raises
    :class:`NotFoundError` if the student is missing and
    :class:`ValidationError` on an invalid upload.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")

    _validate_upload(filename, content_type, content)

    safe_name = Path(filename or "resume.pdf").name
    stored_name = f"{student_id}_{uuid.uuid4().hex}.pdf"
    stored_path = _resumes_dir() / stored_name
    stored_path.write_bytes(content)

    try:
        result: dict[str, Any] = analyze_resume(str(stored_path))
    except Exception as exc:  # noqa: BLE001 — surface any parse failure as validation error
        stored_path.unlink(missing_ok=True)
        raise ValidationError(f"Could not analyze the uploaded resume: {exc}") from exc

    repo = ResumeRepository(db)
    analysis = repo.create(
        student_id=student_id,
        filename=safe_name,
        file_path=str(stored_path),
        resume_score=float(result.get("resume_score", 0.0)),
        ats_score=float(result.get("ats_score", 0.0)),
        extracted=dict(result.get("extracted", {})),
        missing_sections=[str(item) for item in result.get("missing_sections", [])],
        suggestions=[str(item) for item in result.get("suggestions", [])],
    )
    db.commit()
    db.refresh(analysis)
    return analysis


def get_latest_analysis(db: Session, student_id: int) -> ResumeAnalysis:
    """Return the newest resume analysis for a student.

    Raises :class:`NotFoundError` if the student or an analysis is missing.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")

    repo = ResumeRepository(db)
    analysis = repo.get_latest_for_student(student_id)
    if analysis is None:
        raise NotFoundError("No resume analysis found for this student")
    return analysis
