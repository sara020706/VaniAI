"""Student profile service: read/update profile, list, progress, sub-resources.

Business rules (CONTRACTS.md §7):
- ``PUT /students/me`` appends a NEW academic_records / skill_records snapshot
  whenever any academic or skill value changes (history for progress charts),
  rather than mutating rows in place.
- ``GET /students`` joins each student's latest prediction for the
  probability / readiness / risk fields, with department/batch/risk/search
  filters and standard pagination.
- Access control: students may only read/update their own profile and
  sub-resources; faculty / placement_officer / admin may read any student.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.models.student import Student
from app.models.user import User
from app.repositories.student_repository import SUBRESOURCE_MODELS, StudentRepository
from app.schemas.common import Page
from app.schemas.student import (
    AcademicInfo,
    CertificationCreate,
    CertificationOut,
    ExperienceInfo,
    HackathonCreate,
    HackathonOut,
    InternshipCreate,
    InternshipOut,
    ProfessionalInfo,
    ProjectCreate,
    ProjectOut,
    SkillsInfo,
    StudentListItem,
    StudentOut,
    StudentProgress,
    StudentUpdate,
)
from app.utils.pagination import paginate
from app.utils.prediction_serialization import prediction_to_out

# Fields on StudentUpdate that live on academic_records snapshots.
_ACADEMIC_FIELDS = (
    "cgpa",
    "tenth_percentage",
    "twelfth_percentage",
    "attendance_percentage",
)
# Fields on StudentUpdate that live on skill_records snapshots.
_SKILL_FIELDS = (
    "coding_score",
    "aptitude_score",
    "communication_score",
    "technical_skill_score",
    "leadership_score",
)
# Fields on StudentUpdate that live directly on the student/user row.
_PROFILE_FIELDS = ("department", "batch", "semester")

_READ_ALL_ROLES = frozenset({"faculty", "placement_officer", "admin"})


class StudentService:
    """Orchestrates the student repository into the students API responses."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = StudentRepository(session)

    # --- Reads -----------------------------------------------------------------------

    def get_my_profile(self, current_user: User) -> StudentOut:
        """Return the authenticated student's own profile."""
        student = self.repo.get_by_user_id(current_user.id)
        if student is None:
            raise NotFoundError("Student profile not found")
        return self._build_student_out(student)

    def get_student(self, student_id: int, current_user: User) -> StudentOut:
        """Return a student profile, enforcing self-only access for students."""
        student = self.repo.get_by_id(student_id)
        if student is None:
            raise NotFoundError("Student not found")
        self._authorize_read(student, current_user)
        return self._build_student_out(student)

    def list_students(
        self,
        *,
        department: str | None,
        batch: str | None,
        risk_level: str | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> Page[StudentListItem]:
        """Paginated, filtered student list (StudentListItem rows)."""
        offset = (page - 1) * page_size
        rows, total = self.repo.list_students(
            department=department,
            batch=batch,
            risk_level=risk_level,
            search=search,
            offset=offset,
            limit=page_size,
        )
        items = [StudentListItem(**row) for row in rows]
        return paginate(items, total=total, page=page, page_size=page_size)

    def get_progress(self, student_id: int, current_user: User) -> StudentProgress:
        """Academic / skill / prediction history for progress charts."""
        student = self.repo.get_by_id(student_id)
        if student is None:
            raise NotFoundError("Student not found")
        self._authorize_read(student, current_user)

        academic_history = [
            {
                "recorded_at": rec.recorded_at,
                "cgpa": rec.cgpa,
                "attendance_percentage": rec.attendance_percentage,
            }
            for rec in self.repo.academic_history(student_id)
        ]
        skill_history = [
            {
                "recorded_at": rec.recorded_at,
                "coding_score": rec.coding_score,
                "aptitude_score": rec.aptitude_score,
                "communication_score": rec.communication_score,
                "technical_skill_score": rec.technical_skill_score,
                "leadership_score": rec.leadership_score,
            }
            for rec in self.repo.skill_history(student_id)
        ]
        prediction_history = []
        for pred in self.repo.prediction_history(student_id):
            readiness = pred.readiness if isinstance(pred.readiness, dict) else {}
            prediction_history.append(
                {
                    "created_at": pred.created_at,
                    "placement_probability": pred.placement_probability,
                    "readiness_overall": float(readiness.get("overall", 0.0)),
                }
            )
        return StudentProgress(
            academic_history=academic_history,
            skill_history=skill_history,
            prediction_history=prediction_history,
        )

    # --- Update (snapshot-on-change) -------------------------------------------------

    def update_my_profile(
        self, current_user: User, payload: StudentUpdate
    ) -> StudentOut:
        """Update the authenticated student's profile.

        Profile fields (department/batch/semester) and the user's full_name are
        updated in place; changed academic or skill values append a new snapshot
        row so progress history is preserved.
        """
        student = self.repo.get_by_user_id(current_user.id)
        if student is None:
            raise NotFoundError("Student profile not found")

        data = payload.model_dump(exclude_unset=True)

        # --- Direct profile fields on the student row ---
        for field in _PROFILE_FIELDS:
            if field in data and data[field] is not None:
                setattr(student, field, data[field])

        # --- full_name lives on the linked user row ---
        if "full_name" in data and data["full_name"] is not None:
            student.user.full_name = data["full_name"]

        # --- Academic snapshot: append when any academic value changes ---
        academic_updates = {
            f: data[f] for f in _ACADEMIC_FIELDS if f in data and data[f] is not None
        }
        if academic_updates:
            self._append_academic_snapshot(student.id, academic_updates)

        # --- Skill snapshot: append when any skill value changes ---
        skill_updates = {
            f: data[f] for f in _SKILL_FIELDS if f in data and data[f] is not None
        }
        if skill_updates:
            self._append_skill_snapshot(student.id, skill_updates)

        self.session.commit()

        # Re-load with fresh relationships for the response.
        refreshed = self.repo.get_by_id(student.id)
        assert refreshed is not None  # just updated it
        return self._build_student_out(refreshed)

    def _append_academic_snapshot(
        self, student_id: int, updates: dict[str, float]
    ) -> None:
        """Create a new academic snapshot merging changes over current values."""
        current = self.repo.latest_academic_record(student_id)
        base = {
            "cgpa": current.cgpa if current else 0.0,
            "tenth_percentage": current.tenth_percentage if current else 0.0,
            "twelfth_percentage": current.twelfth_percentage if current else 0.0,
            "attendance_percentage": current.attendance_percentage if current else 0.0,
        }
        base.update(updates)
        # No-op guard: skip if nothing actually differs from the latest snapshot.
        if current is not None and all(
            getattr(current, key) == value for key, value in base.items()
        ):
            return
        self.repo.add_academic_record(student_id=student_id, **base)

    def _append_skill_snapshot(self, student_id: int, updates: dict[str, float]) -> None:
        """Create a new skill snapshot merging changes over current values."""
        current = self.repo.latest_skill_record(student_id)
        base = {
            "coding_score": current.coding_score if current else 0.0,
            "aptitude_score": current.aptitude_score if current else 0.0,
            "communication_score": current.communication_score if current else 0.0,
            "technical_skill_score": current.technical_skill_score if current else 0.0,
            "leadership_score": current.leadership_score if current else 0.0,
        }
        base.update(updates)
        if current is not None and all(
            getattr(current, key) == value for key, value in base.items()
        ):
            return
        self.repo.add_skill_record(student_id=student_id, **base)

    # --- Sub-resource CRUD (self-only) -----------------------------------------------

    def _my_student(self, current_user: User) -> Student:
        student = self.repo.get_by_user_id(current_user.id)
        if student is None:
            raise NotFoundError("Student profile not found")
        return student

    def add_project(self, current_user: User, payload: ProjectCreate) -> ProjectOut:
        student = self._my_student(current_user)
        project = self.repo.add_project(
            student_id=student.id,
            title=payload.title,
            description=payload.description,
            tech_stack=payload.tech_stack,
            url=payload.url,
        )
        self.session.commit()
        return ProjectOut.model_validate(project)

    def add_internship(
        self, current_user: User, payload: InternshipCreate
    ) -> InternshipOut:
        student = self._my_student(current_user)
        internship = self.repo.add_internship(
            student_id=student.id,
            company=payload.company,
            role=payload.role,
            duration_months=payload.duration_months,
            description=payload.description,
        )
        self.session.commit()
        return InternshipOut.model_validate(internship)

    def add_certification(
        self, current_user: User, payload: CertificationCreate
    ) -> CertificationOut:
        student = self._my_student(current_user)
        certification = self.repo.add_certification(
            student_id=student.id,
            name=payload.name,
            issuer=payload.issuer,
            issued_date=payload.issued_date,
            credential_url=payload.credential_url,
        )
        self.session.commit()
        return CertificationOut.model_validate(certification)

    def add_hackathon(
        self, current_user: User, payload: HackathonCreate
    ) -> HackathonOut:
        student = self._my_student(current_user)
        hackathon = self.repo.add_hackathon(
            student_id=student.id,
            name=payload.name,
            position=payload.position,
            event_date=payload.event_date,
        )
        self.session.commit()
        return HackathonOut.model_validate(hackathon)

    def delete_subresource(
        self, current_user: User, resource: str, item_id: int
    ) -> None:
        """Delete a sub-resource item owned by the authenticated student."""
        if resource not in SUBRESOURCE_MODELS:
            raise ValidationError(f"Unknown sub-resource: {resource}")
        student = self._my_student(current_user)
        entity = self.repo.get_subresource(resource, student.id, item_id)
        if entity is None:
            raise NotFoundError(f"{resource[:-1].capitalize()} not found")
        self.repo.delete_entity(entity)
        self.session.commit()

    # --- Authorization ---------------------------------------------------------------

    def _authorize_read(self, student: Student, current_user: User) -> None:
        """Students may read only their own profile; privileged roles read all."""
        if current_user.role in _READ_ALL_ROLES:
            return
        if current_user.role == "student" and student.user_id == current_user.id:
            return
        raise PermissionDeniedError("You may only access your own student profile")

    # --- Assembly --------------------------------------------------------------------

    def _build_student_out(self, student: Student) -> StudentOut:
        """Assemble the full StudentOut from latest records + experience + prediction."""
        academic_record = self.repo.latest_academic_record(student.id)
        skill_record = self.repo.latest_skill_record(student.id)
        resume = self.repo.latest_resume_analysis(student.id)
        interview = self.repo.latest_interview_score(student.id)

        academic = AcademicInfo(
            cgpa=academic_record.cgpa if academic_record else None,
            tenth_percentage=academic_record.tenth_percentage if academic_record else None,
            twelfth_percentage=(
                academic_record.twelfth_percentage if academic_record else None
            ),
            attendance_percentage=(
                academic_record.attendance_percentage if academic_record else None
            ),
        )
        skills = SkillsInfo(
            coding_score=skill_record.coding_score if skill_record else None,
            aptitude_score=skill_record.aptitude_score if skill_record else None,
            communication_score=(
                skill_record.communication_score if skill_record else None
            ),
            technical_skill_score=(
                skill_record.technical_skill_score if skill_record else None
            ),
            leadership_score=skill_record.leadership_score if skill_record else None,
        )
        experience = ExperienceInfo(
            internship_count=len(student.internships),
            project_count=len(student.projects),
            certification_count=len(student.certifications),
            hackathon_count=len(student.hackathons),
            projects=[ProjectOut.model_validate(p) for p in student.projects],
            internships=[InternshipOut.model_validate(i) for i in student.internships],
            certifications=[
                CertificationOut.model_validate(c) for c in student.certifications
            ],
            hackathons=[HackathonOut.model_validate(h) for h in student.hackathons],
        )
        professional = ProfessionalInfo(
            resume_score=resume.resume_score if resume else None,
            mock_interview_score=interview.mock_interview_score if interview else None,
        )

        prediction = self.repo.latest_prediction(student.id)
        latest_prediction = None
        if prediction is not None:
            recommendations = self.repo.recommendations_for_prediction(prediction.id)
            latest_prediction = prediction_to_out(prediction, recommendations)

        return StudentOut(
            id=student.id,
            user_id=student.user_id,
            full_name=student.user.full_name,
            email=student.user.email,
            register_number=student.register_number,
            department=student.department,  # type: ignore[arg-type]
            batch=student.batch,
            semester=student.semester,
            academic=academic,
            skills=skills,
            experience=experience,
            professional=professional,
            latest_prediction=latest_prediction,
        )
