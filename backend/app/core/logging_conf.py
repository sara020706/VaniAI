"""Structured (JSON) logging configuration for the backend."""

from __future__ import annotations

import json
import logging
import logging.config
import sys
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            payload["exception"] = self.formatException(record.exc_info)
        for key in ("method", "path", "status_code", "duration_ms", "user_id", "request_id"):
            value = record.__dict__.get(key)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    """Human-friendly formatter used in development."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )


def configure_logging() -> None:
    """Configure root logging: JSON in production, readable console output otherwise."""
    settings = get_settings()
    formatter: logging.Formatter = (
        JsonFormatter() if settings.is_production else ConsoleFormatter()
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if settings.environment.lower() == "development" else logging.INFO)

    # Tame noisy third-party loggers.
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "shap"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    # Keep uvicorn error/startup messages flowing through our handler.
    for uv_logger in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(uv_logger)
        logger.handlers.clear()
        logger.propagate = True


def get_logger(name: str) -> logging.Logger:
    """Convenience accessor so modules do not import the logging module directly."""
    return logging.getLogger(name)
