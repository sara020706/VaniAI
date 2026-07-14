"""VaniAI FastAPI application factory and entrypoint (``uvicorn app.main:app``)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.models  # noqa: F401  (imports every model so Base.metadata knows all tables)
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.exceptions import (
    ConflictError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.logging_conf import configure_logging
from app.core.metrics import setup_instrumentator

logger = logging.getLogger(__name__)

_STATUS_BY_EXCEPTION: dict[type[DomainError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    PermissionDeniedError: status.HTTP_403_FORBIDDEN,
    ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    ConflictError: status.HTTP_409_CONFLICT,
}


def _make_domain_handler(
    status_code: int,
) -> Callable[[Request, Exception], Awaitable[JSONResponse]]:
    """Build a handler that maps a domain exception to ``{"detail": message}``."""

    async def _handler(request: Request, exc: Exception) -> JSONResponse:
        message = exc.message if isinstance(exc, DomainError) else str(exc)
        return JSONResponse(status_code=status_code, content={"detail": message})

    return _handler


def _register_exception_handlers(application: FastAPI) -> None:
    """Map domain exceptions to their HTTP status codes (contracts section 11)."""
    for exc_class, status_code in _STATUS_BY_EXCEPTION.items():
        application.add_exception_handler(exc_class, _make_domain_handler(status_code))


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Startup: ensure artifact/upload directories exist; optionally create tables."""
    settings = get_settings()
    Path(settings.model_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
        logger.info("AUTO_CREATE_TABLES=true - database tables ensured")
    logger.info("VaniAI backend started (environment=%s)", settings.environment)
    yield
    logger.info("VaniAI backend shutting down")


def create_app() -> FastAPI:
    """Build the fully configured FastAPI application."""
    configure_logging()
    settings = get_settings()

    application = FastAPI(
        title="VaniAI",
        description="AI-powered Placement Prediction & Career Readiness platform",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _register_exception_handlers(application)
    setup_instrumentator(application)

    application.include_router(api_router, prefix="/api/v1")

    @application.get("/health", tags=["health"], include_in_schema=True)
    def health() -> dict[str, str]:
        """Liveness probe used by docker-compose and load balancers."""
        return {"status": "ok"}

    return application


app = create_app()
