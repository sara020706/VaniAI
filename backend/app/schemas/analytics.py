"""Cross-cohort analytics schemas: distributions, departments, skills."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import BucketCount, Department, RiskDistribution, SkillAverages


class Distributions(BaseModel):
    probability: list[BucketCount]
    readiness: list[BucketCount]
    resume_score: list[BucketCount]
    risk: RiskDistribution


class DepartmentAnalytics(BaseModel):
    department: Department
    student_count: int
    average_cgpa: float | None = None
    average_probability: float | None = None
    average_readiness: float | None = None
    ready_count: int
    at_risk_count: int


class SkillDistributionItem(BaseModel):
    skill: str
    buckets: list[BucketCount]


class SkillAnalytics(BaseModel):
    skill_averages: SkillAverages
    skill_distribution: list[SkillDistributionItem]
