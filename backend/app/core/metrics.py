"""Custom Prometheus metrics and instrumentator setup (contracts section 7)."""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# Total number of placement predictions served.
PREDICTIONS_TOTAL = Counter(
    "vaniai_predictions_total",
    "Total number of placement predictions made",
)

# Distribution of predicted placement probabilities (0-1).
PREDICTION_PROBABILITY = Histogram(
    "vaniai_prediction_probability",
    "Distribution of predicted placement probabilities",
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
)

# Info-style gauge: set to 1 for the currently active model version label.
ACTIVE_MODEL_INFO = Gauge(
    "vaniai_active_model_info",
    "Currently active model version (value is 1 for the active version label)",
    ["version"],
)

# Share of drifted features from the most recent data-drift check (0-1).
DRIFT_SHARE = Gauge(
    "vaniai_drift_share",
    "Share of drifted features detected by the latest data drift check",
)


def record_prediction(probability: float) -> None:
    """Record a single prediction into the counter and probability histogram."""
    PREDICTIONS_TOTAL.inc()
    PREDICTION_PROBABILITY.observe(probability)


def set_active_model(version: str) -> None:
    """Mark ``version`` as the active model; clears previously set version labels."""
    ACTIVE_MODEL_INFO.clear()
    ACTIVE_MODEL_INFO.labels(version=version).set(1)


def set_drift_share(share: float) -> None:
    """Publish the share of drifted features from the latest drift report."""
    DRIFT_SHARE.set(share)


def setup_instrumentator(app: FastAPI) -> Instrumentator:
    """Attach prometheus-fastapi-instrumentator and expose GET /metrics."""
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/health"],
    )
    instrumentator.instrument(app)
    instrumentator.expose(app, endpoint="/metrics", include_in_schema=False)
    return instrumentator
