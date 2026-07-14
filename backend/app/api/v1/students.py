"""Student profile routes (CONTRACTS.md §7 students.py).

Router carries its own ``/students`` prefix; mounted under ``/api/v1``.
Ordering note: literal ``/students/me`` and ``/students/me/...`` routes are
declared before the ``/students/{student_id}`` parameter routes so they are
matched first.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.common import Department, Page, RiskLevel
from app.schemas.student import (
    CertificationCreate,
    CertificationOut,
    HackathonCreate,
    HackathonOut,
    InternshipCreate,
    InternshipOut,
    ProjectCreate,
    ProjectOut,
    StudentListItem,
    StudentOut,
    StudentProgress,
    StudentUpdate,
)
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])


# --- Own profile ---------------------------------------------------------------------


@router.get("/me", response_model=StudentOut, summary="Get my student profile")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> StudentOut:
    """Return the authenticated student's own profile."""
    return StudentService(db).get_my_profile(current_user)


@router.put("/me", response_model=StudentOut, summary="Update my student profile")
def update_my_profile(
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> StudentOut:
    """Update profile fields; changed academic/skill values append a snapshot."""
    return StudentService(db).update_my_profile(current_user, payload)


# --- Sub-resource creation (self-only) -----------------------------------------------


@router.post(
    "/me/projects",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a project",
)
def add_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> ProjectOut:
    return StudentService(db).add_project(current_user, payload)


@router.post(
    "/me/internships",
    response_model=InternshipOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an internship",
)
def add_internship(
    payload: InternshipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> InternshipOut:
    return StudentService(db).add_internship(current_user, payload)


@router.post(
    "/me/certifications",
    response_model=CertificationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a certification",
)
def add_certification(
    payload: CertificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> CertificationOut:
    return StudentService(db).add_certification(current_user, payload)


@router.post(
    "/me/hackathons",
    response_model=HackathonOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a hackathon",
)
def add_hackathon(
    payload: HackathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> HackathonOut:
    return StudentService(db).add_hackathon(current_user, payload)


# --- Sub-resource deletion (self-only) -----------------------------------------------


@router.delete(
    "/me/projects/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
def delete_project(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> None:
    StudentService(db).delete_subresource(current_user, "projects", item_id)


@router.delete(
    "/me/internships/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an internship",
)
def delete_internship(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> None:
    StudentService(db).delete_subresource(current_user, "internships", item_id)


@router.delete(
    "/me/certifications/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a certification",
)
def delete_certification(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> None:
    StudentService(db).delete_subresource(current_user, "certifications", item_id)


@router.delete(
    "/me/hackathons/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a hackathon",
)
def delete_hackathon(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> None:
    StudentService(db).delete_subresource(current_user, "hackathons", item_id)


# --- Cohort listing (privileged roles) -----------------------------------------------


@router.get(
    "",
    response_model=Page[StudentListItem],
    summary="List students (paginated, filterable)",
)
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("faculty", "placement_officer", "admin")
    ),
    department: Department | None = Query(default=None),
    batch: str | None = Query(default=None),
    risk_level: RiskLevel | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[StudentListItem]:
    """List students with department/batch/risk/search filters and pagination."""
    return StudentService(db).list_students(
        department=department,
        batch=batch,
        risk_level=risk_level,
        search=search,
        page=page,
        page_size=page_size,
    )


# --- Single student (any role; students only themselves) -----------------------------


@router.get(
    "/{student_id}",
    response_model=StudentOut,
    summary="Get a student by id",
)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudentOut:
    """Return a student profile (students may only fetch their own)."""
    return StudentService(db).get_student(student_id, current_user)


@router.get(
    "/{student_id}/progress",
    response_model=StudentProgress,
    summary="Get a student's academic / skill / prediction history",
)
def get_progress(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudentProgress:
    """Return history series used by the progress charts."""
    return StudentService(db).get_progress(student_id, current_user)
