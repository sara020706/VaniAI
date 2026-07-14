"""Faculty service: cohort analytics, student comparison, interview scoring.

Implements CONTRACTS.md §7 faculty.py:
- ``/faculty/analytics``: cohort aggregates (counts, averages, skill averages,
  top / weak performers, risk distribution) with optional dept/batch filters.
- ``/faculty/compare``: side-by-side StudentListItem + skills + readiness.
- ``/faculty/interview-scores``: persist an interview score row (which becomes
  the student's current mock_interview_score — latest row wins) and return a
  rule-based interview-readiness assessment where
  ``readiness = 0.6*mock + 0.25*communication + 0.15*aptitude``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.student_repository import StudentRepository
from app.schemas.common import RiskDistribution, SkillAverages
from app.schemas.faculty import (
    CompareResponse,
    FacultyAnalytics,
    InterviewReadiness,
    InterviewScoreCreate,
    InterviewScoreOut,
    StudentCompareItem,
)
from app.schemas.prediction import Readiness
from app.schemas.student import SkillsInfo, StudentListItem

# A student counts as "ready" when their latest placement probability ≥ 0.70.
_READY_PROBABILITY = 0.70
_TOP_N = 5


class FacultyService:
    """Cohort-level analytics and interview scoring for faculty/admin users."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = StudentRepository(session)

    # --- Analytics -------------------------------------------------------------------

    def analytics(
        self, *, department: str | None, batch: str | None
    ) -> FacultyAnalytics:
        """Aggregate cohort analytics over the (optionally filtered) students."""
        # Pull every matching student's joined row (large page to cover the cohort).
        rows, total = self.repo.list_students(
            department=department,
            batch=batch,
            risk_level=None,
            search=None,
            offset=0,
            limit=1_000_000,
        )

        cgpas = [row["cgpa"] for row in rows if row["cgpa"] is not None]
        readiness_values = [
            row["readiness_overall"]
            for row in rows
            if row["readiness_overall"] is not None
        ]
        probabilities = [
            row["placement_probability"]
            for row in rows
            if row["placement_probability"] is not None
        ]

        risk_distribution = RiskDistribution()
        at_risk_count = 0
        for row in rows:
            level = row["risk_level"]
            if level == "low":
                risk_distribution.low += 1
            elif level == "medium":
                risk_distribution.medium += 1
            elif level == "high":
                risk_distribution.high += 1
                at_risk_count += 1

        skill_avg = self.repo.cohort_skill_averages(department=department, batch=batch)

        # Rank by placement probability (missing predictions sort last).
        ranked = sorted(
            rows,
            key=lambda r: (
                r["placement_probability"] is not None,
                r["placement_probability"] if r["placement_probability"] is not None else 0.0,
            ),
            reverse=True,
        )
        top_performers = [StudentListItem(**row) for row in ranked[:_TOP_N]]
        weak_students = [
            StudentListItem(**row) for row in list(reversed(ranked))[:_TOP_N]
        ]

        return FacultyAnalytics(
            student_count=total,
            average_cgpa=self._mean(cgpas),
            average_readiness=self._mean(readiness_values),
            average_probability=self._mean(probabilities),
            at_risk_count=at_risk_count,
            skill_averages=SkillAverages(**skill_avg),
            top_performers=top_performers,
            weak_students=weak_students,
            risk_distribution=risk_distribution,
        )

    # --- Compare ---------------------------------------------------------------------

    def compare(self, student_ids: list[int]) -> CompareResponse:
        """Return comparison items for the requested students (skills + readiness)."""
        items: list[StudentCompareItem] = []
        for student_id in student_ids:
            student = self.repo.get_by_id(student_id)
            if student is None:
                raise NotFoundError(f"Student {student_id} not found")

            academic = self.repo.latest_academic_record(student_id)
            skill_record = self.repo.latest_skill_record(student_id)
            prediction = self.repo.latest_prediction(student_id)

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

            readiness_obj = None
            probability = None
            readiness_overall = None
            risk_level = None
            if prediction is not None:
                probability = prediction.placement_probability
                risk_level = prediction.risk_level
                readiness_json = (
                    prediction.readiness if isinstance(prediction.readiness, dict) else {}
                )
                if readiness_json:
                    readiness_obj = Readiness(
                        academic=float(readiness_json.get("academic", 0.0)),
                        technical=float(readiness_json.get("technical", 0.0)),
                        communication=float(readiness_json.get("communication", 0.0)),
                        industry=float(readiness_json.get("industry", 0.0)),
                        overall=float(readiness_json.get("overall", 0.0)),
                    )
                    readiness_overall = readiness_obj.overall

            items.append(
                StudentCompareItem(
                    id=student.id,
                    full_name=student.user.full_name,
                    register_number=student.register_number,
                    department=student.department,  # type: ignore[arg-type]
                    batch=student.batch,
                    semester=student.semester,
                    cgpa=academic.cgpa if academic else None,
                    placement_probability=probability,
                    readiness_overall=readiness_overall,
                    risk_level=risk_level,  # type: ignore[arg-type]
                    skills=skills,
                    readiness=readiness_obj,
                )
            )
        return CompareResponse(students=items)

    # --- Interview scoring -----------------------------------------------------------

    def submit_interview_score(
        self, payload: InterviewScoreCreate, entered_by: int
    ) -> InterviewScoreOut:
        """Persist an interview score and return the readiness assessment.

        The new row becomes the student's current mock_interview_score (latest
        row wins). Readiness blends the mock score with the student's latest
        communication and aptitude skill scores.
        """
        student = self.repo.get_by_id(payload.student_id)
        if student is None:
            raise NotFoundError(f"Student {payload.student_id} not found")

        skill_record = self.repo.latest_skill_record(payload.student_id)
        communication = skill_record.communication_score if skill_record else 0.0
        aptitude = skill_record.aptitude_score if skill_record else 0.0

        score_row = self.repo.add_interview_score(
            student_id=payload.student_id,
            mock_interview_score=payload.mock_interview_score,
            confidence_level=payload.confidence_level,
            notes=payload.notes,
            entered_by=entered_by,
        )
        self.session.commit()

        readiness_score = round(
            0.6 * payload.mock_interview_score + 0.25 * communication + 0.15 * aptitude,
            1,
        )
        suggestions = self._interview_suggestions(
            mock=payload.mock_interview_score,
            communication=communication,
            aptitude=aptitude,
            confidence_level=payload.confidence_level,
            readiness_score=readiness_score,
        )

        return InterviewScoreOut(
            id=score_row.id,
            student_id=score_row.student_id,
            mock_interview_score=score_row.mock_interview_score,
            confidence_level=score_row.confidence_level,  # type: ignore[arg-type]
            interview_readiness=InterviewReadiness(
                score=readiness_score,
                confidence_level=self._confidence_band(readiness_score),
                suggestions=suggestions,
            ),
        )

    # --- Helpers ---------------------------------------------------------------------

    @staticmethod
    def _mean(values: list[float]) -> float | None:
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    @staticmethod
    def _confidence_band(score: float) -> str:
        """Map an interview-readiness score (0-100) to a confidence band."""
        if score >= 70:
            return "high"
        if score >= 40:
            return "medium"
        return "low"

    @staticmethod
    def _interview_suggestions(
        *,
        mock: float,
        communication: float,
        aptitude: float,
        confidence_level: str,
        readiness_score: float,
    ) -> list[str]:
        """Rule-based, actionable interview-preparation suggestions."""
        suggestions: list[str] = []
        if mock < 60:
            suggestions.append(
                "Schedule regular mock interviews to build fluency answering "
                "technical and behavioural questions."
            )
        if communication < 60:
            suggestions.append(
                "Practise structured spoken answers (STAR method) and record "
                "yourself to sharpen clarity and pacing."
            )
        if aptitude < 60:
            suggestions.append(
                "Dedicate 30 minutes daily to aptitude and logical-reasoning "
                "drills to speed up problem solving."
            )
        if confidence_level == "low":
            suggestions.append(
                "Rehearse a two-minute self-introduction and prepare answers to "
                "common questions to boost confidence."
            )
        if readiness_score >= 70 and not suggestions:
            suggestions.append(
                "Strong interview readiness — focus on advanced system-design and "
                "domain-specific questions to stand out."
            )
        if not suggestions:
            suggestions.append(
                "Maintain steady practice across mock interviews, communication, "
                "and aptitude to keep improving."
            )
        return suggestions
