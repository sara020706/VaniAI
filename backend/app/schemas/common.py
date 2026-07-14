"""Shared schema primitives: enums-as-literals, pagination envelope, common shapes."""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["student", "faculty", "placement_officer", "admin"]
Department = Literal["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]
RiskLevel = Literal["low", "medium", "high"]
ConfidenceLevel = Literal["low", "medium", "high"]
Priority = Literal["high", "medium", "low"]

ROLES: tuple[str, ...] = ("student", "faculty", "placement_officer", "admin")
DEPARTMENTS: tuple[str, ...] = ("CSE", "IT", "ECE", "EEE", "MECH", "CIVIL")
RISK_LEVELS: tuple[str, ...] = ("low", "medium", "high")

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Standard pagination envelope: {items, total, page, page_size}."""

    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    """Standard pagination query parameters (?page=1&page_size=20)."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class DetailResponse(BaseModel):
    """FastAPI-style message envelope: {"detail": "..."}."""

    detail: str


class BucketCount(BaseModel):
    """Histogram bucket, e.g. {"bucket": "0-10", "count": 4}."""

    model_config = ConfigDict(from_attributes=True)

    bucket: str
    count: int


class RiskDistribution(BaseModel):
    """Counts of students per risk level."""

    low: int = 0
    medium: int = 0
    high: int = 0


class SkillAverages(BaseModel):
    """Cohort-average skill scores (0-100)."""

    coding: float = 0.0
    aptitude: float = 0.0
    communication: float = 0.0
    technical: float = 0.0
    leadership: float = 0.0
