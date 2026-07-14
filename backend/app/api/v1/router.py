"""API v1 aggregate router.

Convention for route modules (auth, students, faculty, predictions, resume, placement,
analytics, reports, admin, monitoring): each module exposes a module-level ``router``
that ALREADY carries its own resource prefix, e.g.::

    router = APIRouter(prefix="/auth", tags=["auth"])

This aggregator therefore includes each router without adding any extra prefix;
``app.main`` mounts the aggregate under ``/api/v1``.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    analytics,
    auth,
    faculty,
    monitoring,
    placement,
    predictions,
    reports,
    resume,
    students,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(students.router)
api_router.include_router(faculty.router)
api_router.include_router(predictions.router)
api_router.include_router(resume.router)
api_router.include_router(placement.router)
api_router.include_router(analytics.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(monitoring.router)
