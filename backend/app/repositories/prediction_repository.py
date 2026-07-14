"""Data-access helpers for predictions and recommendations.

These repositories encapsulate all SQLAlchemy queries needed by the prediction
pipeline and the placement/analytics dashboards. They deliberately avoid N+1
patterns by relying on window functions / correlated subqueries to compute the
"latest prediction per student" set in a single round-trip.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.prediction import Prediction, Recommendation


class PredictionRepository:
    """Read/write access to ``predictions`` and ``recommendations`` rows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Writes ----------------------------------------------------------------------

    def create_prediction(
        self,
        *,
        student_id: int,
        model_version: str,
        placement_probability: float,
        risk_level: str,
        risk_reasons: list[str],
        readiness: dict[str, Any],
        explanation: dict[str, Any],
    ) -> Prediction:
        """Insert and flush a new prediction row (id populated, not committed)."""
        prediction = Prediction(
            student_id=student_id,
            model_version=model_version,
            placement_probability=placement_probability,
            risk_level=risk_level,
            risk_reasons=risk_reasons,
            readiness=readiness,
            explanation=explanation,
        )
        self.db.add(prediction)
        self.db.flush()
        return prediction

    def create_recommendations(
        self,
        *,
        prediction_id: int,
        student_id: int,
        items: Sequence[dict[str, Any]],
    ) -> list[Recommendation]:
        """Bulk-insert recommendation rows tied to a prediction."""
        rows = [
            Recommendation(
                prediction_id=prediction_id,
                student_id=student_id,
                category=str(item["category"]),
                priority=str(item["priority"]),
                text=str(item["text"]),
                status="active",
            )
            for item in items
        ]
        self.db.add_all(rows)
        self.db.flush()
        return rows

    # --- Reads -----------------------------------------------------------------------

    def get_latest_for_student(self, student_id: int) -> Prediction | None:
        """Return the most recent prediction for a student, or ``None``."""
        stmt = (
            select(Prediction)
            .where(Prediction.student_id == student_id)
            .order_by(Prediction.created_at.desc(), Prediction.id.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_history_for_student(self, student_id: int) -> list[Prediction]:
        """Return all predictions for a student, newest first."""
        stmt = (
            select(Prediction)
            .where(Prediction.student_id == student_id)
            .order_by(Prediction.created_at.desc(), Prediction.id.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_recommendations_for_prediction(self, prediction_id: int) -> list[Recommendation]:
        """Return recommendations attached to a specific prediction, id order."""
        stmt = (
            select(Recommendation)
            .where(Recommendation.prediction_id == prediction_id)
            .order_by(Recommendation.id.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    # --- Latest-per-student building block ------------------------------------------

    @staticmethod
    def latest_prediction_id_subquery() -> Select[tuple[int]]:
        """Subquery selecting the id of the newest prediction for each student.

        Uses a grouped ``MAX(id)`` (ids are monotonically increasing per insert),
        which lets callers join the full latest-prediction row per student without
        a per-student query. Returns a ``Select`` of prediction ids.
        """
        return select(func.max(Prediction.id)).group_by(Prediction.student_id)

    def latest_predictions_all(self) -> list[Prediction]:
        """Return the newest prediction row for every student in one query."""
        latest_ids = self.latest_prediction_id_subquery().scalar_subquery()
        stmt = select(Prediction).where(Prediction.id.in_(latest_ids))
        return list(self.db.execute(stmt).scalars().all())
