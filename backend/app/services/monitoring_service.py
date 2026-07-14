"""System-health and drift-monitoring service (CONTRACTS.md sections 6.6 & 7).

- Health: DB ping, predictor state (loaded / version / fallback) via
  ``ml.inference.predictor.get_predictor``, MLflow configuration, and uptime.
- Drift: builds a reference frame from ``MODEL_DIR/reference/reference.csv`` and a
  current frame from the latest feature snapshot of every student, runs
  ``ml.monitoring.drift.run_drift_report`` + ``run_prediction_drift`` over stored
  prediction probabilities, persists ``monitoring_logs`` rows, and publishes the
  ``vaniai_drift_share`` Prometheus gauge.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.metrics import set_drift_share
from app.models.common import utcnow
from app.repositories.monitoring_repository import MonitoringRepository
from ml.features.engineering import FEATURE_COLUMNS, MODEL_COLUMNS, build_feature_frame
from ml.inference.predictor import get_predictor
from ml.monitoring.drift import run_drift_report, run_prediction_drift

logger = logging.getLogger(__name__)

#: Process start time; ``uptime_seconds`` is measured against this.
_START_TIME: float = time.monotonic()


class MonitoringService:
    """Report system health and run/store data- and prediction-drift checks."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = MonitoringRepository(db)
        self.settings = get_settings()

    # --- Health ----------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Assemble the ``MonitoringHealth`` payload (contracts section 7)."""
        database_ok = self._database_ok()

        model_loaded = False
        model_version = "unknown"
        is_fallback = True
        try:
            predictor = get_predictor(self.settings.model_dir)
            model_version = predictor.model_version
            is_fallback = bool(getattr(predictor, "is_fallback", True))
            model_loaded = not is_fallback
        except Exception:  # noqa: BLE001 - health must never raise
            logger.exception("health: predictor unavailable")

        return {
            "status": "ok",
            "database": database_ok,
            "model_loaded": model_loaded,
            "model_version": model_version,
            "is_fallback": is_fallback,
            "mlflow_configured": bool(self.settings.mlflow_tracking_uri.strip()),
            "uptime_seconds": round(time.monotonic() - _START_TIME, 3),
        }

    def _database_ok(self) -> bool:
        """Return ``True`` if a trivial ``SELECT 1`` succeeds."""
        try:
            self.db.execute(text("SELECT 1"))
            return True
        except Exception:  # noqa: BLE001 - report unhealthy rather than raise
            logger.exception("health: database ping failed")
            return False

    # --- Drift ------------------------------------------------------------------------

    def _reference_path(self) -> Path:
        return Path(self.settings.model_dir) / "reference" / "reference.csv"

    def _load_reference_frame(self) -> pd.DataFrame | None:
        """Load the training baseline frame written by the registry, if present."""
        path = self._reference_path()
        if not path.exists():
            return None
        try:
            return pd.read_csv(path)
        except Exception:  # noqa: BLE001 - a corrupt baseline just disables data drift
            logger.exception("drift: failed to read reference frame at %s", path)
            return None

    def _build_current_frame(self) -> pd.DataFrame | None:
        """Rebuild the current feature frame from every student's latest records."""
        rows = self.repo.latest_feature_rows()
        if not rows:
            return None
        return build_feature_frame(rows)

    @staticmethod
    def _align_columns(reference: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
        """Restrict the reference frame to the feature columns present in current.

        The stored reference frame may carry the target column and register
        metadata; drift is only meaningful over the shared model features.
        """
        shared = [c for c in MODEL_COLUMNS if c in reference.columns and c in current.columns]
        if not shared:
            shared = [c for c in FEATURE_COLUMNS if c in reference.columns and c in current.columns]
        return reference[shared]

    def run_drift(self) -> dict[str, Any]:
        """Run data- and prediction-drift checks, persist logs, return ``DriftStatus``."""
        checked_at = utcnow()
        data_drift = self._run_data_drift(checked_at)
        prediction_drift = self._run_prediction_drift(checked_at)
        self.db.commit()

        return {
            "data_drift": data_drift,
            "prediction_drift": prediction_drift,
            "history": self._history(),
        }

    def _run_data_drift(self, checked_at: datetime) -> dict[str, Any] | None:
        """Run the Evidently data-drift report and persist a ``data_drift`` log."""
        reference = self._load_reference_frame()
        current = self._build_current_frame()
        if reference is None or current is None or current.empty:
            logger.info("drift: skipping data drift (missing reference or current data)")
            return None

        aligned_reference = self._align_columns(reference, current)
        aligned_current = current[[c for c in aligned_reference.columns]]

        try:
            report = run_drift_report(aligned_reference, aligned_current)
        except Exception:  # noqa: BLE001 - never let a drift backend crash the endpoint
            logger.exception("drift: data drift report failed")
            return None

        detected = bool(report.get("data_drift_detected", False))
        share = float(report.get("share_drifted", 0.0))
        drifted_features = [str(f) for f in report.get("drifted_features", [])]

        payload = {
            "data_drift_detected": detected,
            "share_drifted": share,
            "drifted_features": drifted_features,
            "n_features": int(report.get("n_features", len(aligned_reference.columns))),
            "checked_at": checked_at.isoformat(),
        }
        self.repo.create_log(
            metric_type="data_drift", payload=payload, drift_detected=detected
        )
        set_drift_share(share)

        return {
            "data_drift_detected": detected,
            "share_drifted": share,
            "drifted_features": drifted_features,
            "checked_at": checked_at,
        }

    def _run_prediction_drift(self, checked_at: datetime) -> dict[str, Any] | None:
        """Compute PSI over stored probabilities vs. the reference distribution."""
        current_probs = self.repo.recent_prediction_probabilities(limit=500)
        reference_probs = self._reference_probabilities()
        if not current_probs or not reference_probs:
            logger.info("drift: skipping prediction drift (insufficient probabilities)")
            return None

        try:
            result = run_prediction_drift(reference_probs, current_probs)
        except Exception:  # noqa: BLE001 - PSI failure should not break the endpoint
            logger.exception("drift: prediction drift computation failed")
            return None

        psi = float(result.get("psi", 0.0))
        detected = bool(result.get("drift_detected", False))
        payload = {
            "psi": psi,
            "drift_detected": detected,
            "n_reference": len(reference_probs),
            "n_current": len(current_probs),
            "checked_at": checked_at.isoformat(),
        }
        self.repo.create_log(
            metric_type="prediction_drift", payload=payload, drift_detected=detected
        )
        return {"psi": psi, "drift_detected": detected, "checked_at": checked_at}

    def _reference_probabilities(self) -> list[float]:
        """Reference probability distribution: predictor scores over the baseline frame.

        Uses the trained (or fallback) predictor to score every reference-frame row,
        giving a stable baseline distribution to compare recent live predictions against.
        """
        reference = self._load_reference_frame()
        if reference is None or reference.empty:
            return []
        available = [c for c in FEATURE_COLUMNS if c in reference.columns]
        if not available:
            return []
        try:
            predictor = get_predictor(self.settings.model_dir)
        except Exception:  # noqa: BLE001
            logger.exception("drift: predictor unavailable for reference probabilities")
            return []

        probabilities: list[float] = []
        for record in reference[available].to_dict(orient="records"):
            try:
                probabilities.append(float(predictor.predict_proba(record)))
            except Exception:  # noqa: BLE001 - skip any row the predictor rejects
                continue
        return probabilities

    def status(self) -> dict[str, Any]:
        """Return the current ``DriftStatus`` from the most recent stored logs.

        Used by ``GET /monitoring/drift`` without recomputing: reads the latest
        persisted ``data_drift`` / ``prediction_drift`` logs plus recent history.
        """
        data_drift = self._latest_data_drift()
        prediction_drift = self._latest_prediction_drift()
        return {
            "data_drift": data_drift,
            "prediction_drift": prediction_drift,
            "history": self._history(),
        }

    def _latest_data_drift(self) -> dict[str, Any] | None:
        log = self.repo.latest_log("data_drift")
        if log is None:
            return None
        payload = log.payload or {}
        return {
            "data_drift_detected": bool(payload.get("data_drift_detected", log.drift_detected)),
            "share_drifted": float(payload.get("share_drifted", 0.0)),
            "drifted_features": [str(f) for f in payload.get("drifted_features", [])],
            "checked_at": log.created_at,
        }

    def _latest_prediction_drift(self) -> dict[str, Any] | None:
        log = self.repo.latest_log("prediction_drift")
        if log is None:
            return None
        payload = log.payload or {}
        return {
            "psi": float(payload.get("psi", 0.0)),
            "drift_detected": bool(payload.get("drift_detected", log.drift_detected)),
            "checked_at": log.created_at,
        }

    def _history(self) -> list[dict[str, Any]]:
        """Recent monitoring-log summaries for the drift status ``history`` list."""
        return [
            {
                "id": log.id,
                "metric_type": log.metric_type,
                "drift_detected": log.drift_detected,
                "created_at": log.created_at,
            }
            for log in self.repo.recent_logs(limit=20)
        ]
