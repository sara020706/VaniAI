"""Data access for student profiles, record snapshots, and sub-resources.

Latest academic/skill records are the *current* values; new snapshots are
appended (never updated in place) so progress charts have history
(CONTRACTS.md §5, §7). The student list joins each student's latest prediction
for probability / readiness / risk fields.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.prediction import Prediction, Recommendation
from app.models.student import (
    AcademicRecord,
    Certification,
    Hackathon,
    Internship,
    InterviewScore,
    Project,
    ResumeAnalysis,
    SkillRecord,
    Student,
)
from app.repositories.base import BaseRepository

# Sub-resource model registry keyed by the URL segment used in the routes.
SUBRESOURCE_MODELS: dict[str, type] = {
    "projects": Project,
    "internships": Internship,
    "certifications": Certification,
    "hackathons": Hackathon,
}


class StudentRepository(BaseRepository[Student]):
    """Student aggregate: profile, record history, experience sub-resources."""

    def __init__(self, session: Session) -> None:
        super().__init__(session, Student)

    # --- Student lookups -------------------------------------------------------------

    def get_by_id(self, student_id: int) -> Student | None:
        """Fetch a student with experience sub-resources eagerly loaded."""
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(
                selectinload(Student.user),
                selectinload(Student.projects),
                selectinload(Student.internships),
                selectinload(Student.certifications),
                selectinload(Student.hackathons),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_user_id(self, user_id: int) -> Student | None:
        """Fetch the student profile owned by a user (unique), or ``None``."""
        stmt = (
            select(Student)
            .where(Student.user_id == user_id)
            .options(
                selectinload(Student.user),
                selectinload(Student.projects),
                selectinload(Student.internships),
                selectinload(Student.certifications),
                selectinload(Student.hackathons),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def register_number_exists(self, register_number: str) -> bool:
        """Whether the register number is already taken (unique constraint)."""
        stmt = (
            select(func.count())
            .select_from(Student)
            .where(Student.register_number == register_number)
        )
        return int(self.session.execute(stmt).scalar_one()) > 0

    def create(
        self,
        *,
        user_id: int,
        register_number: str,
        department: str,
        batch: str,
        semester: int,
    ) -> Student:
        """Insert an empty student profile linked to a user."""
        student = Student(
            user_id=user_id,
            register_number=register_number,
            department=department,
            batch=batch,
            semester=semester,
        )
        return self.add(student)

    # --- Record snapshots (history) --------------------------------------------------

    def latest_academic_record(self, student_id: int) -> AcademicRecord | None:
        """Most recent academic snapshot = current academic values."""
        stmt = (
            select(AcademicRecord)
            .where(AcademicRecord.student_id == student_id)
            .order_by(AcademicRecord.recorded_at.desc(), AcademicRecord.id.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def latest_skill_record(self, student_id: int) -> SkillRecord | None:
        """Most recent skill snapshot = current skill values."""
        stmt = (
            select(SkillRecord)
            .where(SkillRecord.student_id == student_id)
            .order_by(SkillRecord.recorded_at.desc(), SkillRecord.id.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def add_academic_record(
        self,
        *,
        student_id: int,
        cgpa: float,
        tenth_percentage: float,
        twelfth_percentage: float,
        attendance_percentage: float,
    ) -> AcademicRecord:
        """Append a new academic snapshot (history for progress charts)."""
        record = AcademicRecord(
            student_id=student_id,
            cgpa=cgpa,
            tenth_percentage=tenth_percentage,
            twelfth_percentage=twelfth_percentage,
            attendance_percentage=attendance_percentage,
        )
        self.session.add(record)
        self.session.flush()
        return record

    def add_skill_record(
        self,
        *,
        student_id: int,
        coding_score: float,
        aptitude_score: float,
        communication_score: float,
        technical_skill_score: float,
        leadership_score: float,
    ) -> SkillRecord:
        """Append a new skill snapshot (history for progress charts)."""
        record = SkillRecord(
            student_id=student_id,
            coding_score=coding_score,
            aptitude_score=aptitude_score,
            communication_score=communication_score,
            technical_skill_score=technical_skill_score,
            leadership_score=leadership_score,
        )
        self.session.add(record)
        self.session.flush()
        return record

    def academic_history(self, student_id: int) -> Sequence[AcademicRecord]:
        """All academic snapshots ordered oldest → newest."""
        stmt = (
            select(AcademicRecord)
            .where(AcademicRecord.student_id == student_id)
            .order_by(AcademicRecord.recorded_at.asc(), AcademicRecord.id.asc())
        )
        return self.session.execute(stmt).scalars().all()

    def skill_history(self, student_id: int) -> Sequence[SkillRecord]:
        """All skill snapshots ordered oldest → newest."""
        stmt = (
            select(SkillRecord)
            .where(SkillRecord.student_id == student_id)
            .order_by(SkillRecord.recorded_at.asc(), SkillRecord.id.asc())
        )
        return self.session.execute(stmt).scalars().all()

    # --- Professional signals --------------------------------------------------------

    def latest_resume_analysis(self, student_id: int) -> ResumeAnalysis | None:
        """Most recent resume analysis = current resume_score."""
        stmt = (
            select(ResumeAnalysis)
            .where(ResumeAnalysis.student_id == student_id)
            .order_by(ResumeAnalysis.created_at.desc(), ResumeAnalysis.id.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def latest_interview_score(self, student_id: int) -> InterviewScore | None:
        """Most recent interview score = current mock_interview_score (latest wins)."""
        stmt = (
            select(InterviewScore)
            .where(InterviewScore.student_id == student_id)
            .order_by(InterviewScore.created_at.desc(), InterviewScore.id.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def add_interview_score(
        self,
        *,
        student_id: int,
        mock_interview_score: float,
        confidence_level: str,
        notes: str | None,
        entered_by: int,
    ) -> InterviewScore:
        """Persist an interview score row (becomes the current mock score)."""
        score = InterviewScore(
            student_id=student_id,
            mock_interview_score=mock_interview_score,
            confidence_level=confidence_level,
            notes=notes,
            entered_by=entered_by,
        )
        self.session.add(score)
        self.session.flush()
        return score

    # --- Predictions -----------------------------------------------------------------

    def latest_prediction(self, student_id: int) -> Prediction | None:
        """Most recent prediction with its recommendations eagerly loaded."""
        stmt = (
            select(Prediction)
            .where(Prediction.student_id == student_id)
            .order_by(Prediction.created_at.desc(), Prediction.id.desc())
            .options(selectinload(Prediction.recommendations))
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def prediction_history(self, student_id: int) -> Sequence[Prediction]:
        """All predictions ordered oldest → newest (for progress charts)."""
        stmt = (
            select(Prediction)
            .where(Prediction.student_id == student_id)
            .order_by(Prediction.created_at.asc(), Prediction.id.asc())
        )
        return self.session.execute(stmt).scalars().all()

    def recommendations_for_prediction(
        self, prediction_id: int
    ) -> Sequence[Recommendation]:
        """Recommendation rows linked to a prediction, ordered by id."""
        stmt = (
            select(Recommendation)
            .where(Recommendation.prediction_id == prediction_id)
            .order_by(Recommendation.id.asc())
        )
        return self.session.execute(stmt).scalars().all()

    # --- Sub-resource CRUD -----------------------------------------------------------

    def add_project(
        self,
        *,
        student_id: int,
        title: str,
        description: str,
        tech_stack: str,
        url: str | None,
    ) -> Project:
        project = Project(
            student_id=student_id,
            title=title,
            description=description,
            tech_stack=tech_stack,
            url=url,
        )
        self.session.add(project)
        self.session.flush()
        return project

    def add_internship(
        self,
        *,
        student_id: int,
        company: str,
        role: str,
        duration_months: int,
        description: str | None,
    ) -> Internship:
        internship = Internship(
            student_id=student_id,
            company=company,
            role=role,
            duration_months=duration_months,
            description=description,
        )
        self.session.add(internship)
        self.session.flush()
        return internship

    def add_certification(
        self,
        *,
        student_id: int,
        name: str,
        issuer: str,
        issued_date: date | None,
        credential_url: str | None,
    ) -> Certification:
        certification = Certification(
            student_id=student_id,
            name=name,
            issuer=issuer,
            issued_date=issued_date,
            credential_url=credential_url,
        )
        self.session.add(certification)
        self.session.flush()
        return certification

    def add_hackathon(
        self,
        *,
        student_id: int,
        name: str,
        position: str | None,
        event_date: date | None,
    ) -> Hackathon:
        hackathon = Hackathon(
            student_id=student_id,
            name=name,
            position=position,
            event_date=event_date,
        )
        self.session.add(hackathon)
        self.session.flush()
        return hackathon

    def get_subresource(
        self, resource: str, student_id: int, item_id: int
    ) -> object | None:
        """Fetch a single sub-resource row scoped to its owning student.

        Returns ``None`` when the item does not exist or belongs to another student.
        """
        model = SUBRESOURCE_MODELS[resource]
        stmt = (
            select(model)
            .where(model.id == item_id, model.student_id == student_id)
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def delete_entity(self, entity: object) -> None:
        """Delete an already-fetched ORM entity."""
        self.session.delete(entity)
        self.session.flush()

    def experience_counts(self, student_id: int) -> dict[str, int]:
        """Counts of each experience sub-resource for a student."""
        return {
            "internship_count": self._count_children(Internship, student_id),
            "project_count": self._count_children(Project, student_id),
            "certification_count": self._count_children(Certification, student_id),
            "hackathon_count": self._count_children(Hackathon, student_id),
        }

    def _count_children(self, model: type, student_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(model)
            .where(model.student_id == student_id)
        )
        return int(self.session.execute(stmt).scalar_one())

    # --- Filtered / paginated listing joined with latest prediction ------------------

    def _latest_prediction_subquery(self) -> Select:
        """Subquery mapping each student to their latest prediction id."""
        latest_created = (
            select(
                Prediction.student_id.label("student_id"),
                func.max(Prediction.created_at).label("max_created"),
            )
            .group_by(Prediction.student_id)
            .subquery()
        )
        # Resolve ties on created_at by picking the highest prediction id.
        latest_id = (
            select(
                Prediction.student_id.label("student_id"),
                func.max(Prediction.id).label("prediction_id"),
            )
            .join(
                latest_created,
                and_(
                    Prediction.student_id == latest_created.c.student_id,
                    Prediction.created_at == latest_created.c.max_created,
                ),
            )
            .group_by(Prediction.student_id)
            .subquery()
        )
        return latest_id

    def list_students(
        self,
        *,
        department: str | None = None,
        batch: str | None = None,
        risk_level: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict[str, object]], int]:
        """Paginated student list joined with each student's latest prediction.

        Filters: ``department``, ``batch`` (exact), ``risk_level`` (on latest
        prediction), ``search`` (full name or register number, ILIKE).

        Returns ``(rows, total)`` where each row is a dict carrying the
        StudentListItem fields plus ``cgpa`` from the latest academic record.
        """
        from app.models.user import User  # local import avoids cycle at module load

        latest_pred = self._latest_prediction_subquery()

        # Latest academic record id per student (for cgpa).
        latest_acad_created = (
            select(
                AcademicRecord.student_id.label("student_id"),
                func.max(AcademicRecord.recorded_at).label("max_recorded"),
            )
            .group_by(AcademicRecord.student_id)
            .subquery()
        )
        latest_acad_id = (
            select(
                AcademicRecord.student_id.label("student_id"),
                func.max(AcademicRecord.id).label("record_id"),
            )
            .join(
                latest_acad_created,
                and_(
                    AcademicRecord.student_id == latest_acad_created.c.student_id,
                    AcademicRecord.recorded_at == latest_acad_created.c.max_recorded,
                ),
            )
            .group_by(AcademicRecord.student_id)
            .subquery()
        )

        pred_alias = Prediction
        acad_alias = AcademicRecord

        stmt = (
            select(
                Student.id,
                User.full_name,
                Student.register_number,
                Student.department,
                Student.batch,
                Student.semester,
                acad_alias.cgpa,
                pred_alias.placement_probability,
                pred_alias.readiness,
                pred_alias.risk_level,
            )
            .join(User, User.id == Student.user_id)
            .join(latest_pred, latest_pred.c.student_id == Student.id, isouter=True)
            .join(pred_alias, pred_alias.id == latest_pred.c.prediction_id, isouter=True)
            .join(latest_acad_id, latest_acad_id.c.student_id == Student.id, isouter=True)
            .join(acad_alias, acad_alias.id == latest_acad_id.c.record_id, isouter=True)
        )

        conditions = []
        if department is not None:
            conditions.append(Student.department == department)
        if batch is not None:
            conditions.append(Student.batch == batch)
        if risk_level is not None:
            conditions.append(pred_alias.risk_level == risk_level)
        if search:
            pattern = f"%{search.strip()}%"
            conditions.append(
                or_(User.full_name.ilike(pattern), Student.register_number.ilike(pattern))
            )
        for condition in conditions:
            stmt = stmt.where(condition)

        # Total count over the same filtered join.
        count_stmt = (
            select(func.count())
            .select_from(Student)
            .join(User, User.id == Student.user_id)
            .join(latest_pred, latest_pred.c.student_id == Student.id, isouter=True)
            .join(pred_alias, pred_alias.id == latest_pred.c.prediction_id, isouter=True)
        )
        for condition in conditions:
            count_stmt = count_stmt.where(condition)
        total = int(self.session.execute(count_stmt).scalar_one())

        stmt = stmt.order_by(Student.id.asc()).offset(offset).limit(limit)
        result = self.session.execute(stmt).all()

        rows: list[dict[str, object]] = []
        for row in result:
            readiness = row.readiness if isinstance(row.readiness, dict) else None
            readiness_overall = (
                float(readiness["overall"])
                if readiness is not None and "overall" in readiness
                else None
            )
            rows.append(
                {
                    "id": row.id,
                    "full_name": row.full_name,
                    "register_number": row.register_number,
                    "department": row.department,
                    "batch": row.batch,
                    "semester": row.semester,
                    "cgpa": row.cgpa,
                    "placement_probability": row.placement_probability,
                    "readiness_overall": readiness_overall,
                    "risk_level": row.risk_level,
                }
            )
        return rows, total

    def all_student_ids(
        self, *, department: str | None = None, batch: str | None = None
    ) -> list[int]:
        """All student ids optionally filtered by department/batch (for analytics)."""
        stmt = select(Student.id)
        if department is not None:
            stmt = stmt.where(Student.department == department)
        if batch is not None:
            stmt = stmt.where(Student.batch == batch)
        stmt = stmt.order_by(Student.id.asc())
        return [int(sid) for sid in self.session.execute(stmt).scalars().all()]

    def cohort_skill_averages(
        self, *, department: str | None = None, batch: str | None = None
    ) -> dict[str, float]:
        """Average of each student's latest skill snapshot across the cohort.

        Keys: ``coding``, ``aptitude``, ``communication``, ``technical``,
        ``leadership`` (0 when the cohort has no skill records).
        """
        latest_skill_recorded = (
            select(
                SkillRecord.student_id.label("student_id"),
                func.max(SkillRecord.recorded_at).label("max_recorded"),
            )
            .group_by(SkillRecord.student_id)
            .subquery()
        )
        latest_skill_id = (
            select(
                SkillRecord.student_id.label("student_id"),
                func.max(SkillRecord.id).label("record_id"),
            )
            .join(
                latest_skill_recorded,
                and_(
                    SkillRecord.student_id == latest_skill_recorded.c.student_id,
                    SkillRecord.recorded_at == latest_skill_recorded.c.max_recorded,
                ),
            )
            .group_by(SkillRecord.student_id)
            .subquery()
        )

        stmt = (
            select(
                func.avg(SkillRecord.coding_score),
                func.avg(SkillRecord.aptitude_score),
                func.avg(SkillRecord.communication_score),
                func.avg(SkillRecord.technical_skill_score),
                func.avg(SkillRecord.leadership_score),
            )
            .select_from(Student)
            .join(latest_skill_id, latest_skill_id.c.student_id == Student.id)
            .join(SkillRecord, SkillRecord.id == latest_skill_id.c.record_id)
        )
        if department is not None:
            stmt = stmt.where(Student.department == department)
        if batch is not None:
            stmt = stmt.where(Student.batch == batch)

        row = self.session.execute(stmt).one()
        return {
            "coding": float(row[0]) if row[0] is not None else 0.0,
            "aptitude": float(row[1]) if row[1] is not None else 0.0,
            "communication": float(row[2]) if row[2] is not None else 0.0,
            "technical": float(row[3]) if row[3] is not None else 0.0,
            "leadership": float(row[4]) if row[4] is not None else 0.0,
        }
