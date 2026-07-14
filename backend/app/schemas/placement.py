"""Placement-officer dashboard and at-risk schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import BucketCount, Department, RiskDistribution
from app.schemas.student import StudentListItem


class DepartmentComparison(BaseModel):
    department: Department
    average_probability: float | None = None
    average_readiness: float | None = None
    student_count: int
    ready_count: int


class SkillAverageItem(BaseModel):
    skill: str
    average: float


class WeakSkillItem(BaseModel):
    skill: str
    students_below_target: int


class RiskHeatmapCell(BaseModel):
    department: Department
    batch: str
    high_risk_count: int
    student_count: int


class PlacementDashboard(BaseModel):
    total_students: int
    placement_ready_count: int
    average_probability: float | None = None
    probability_distribution: list[BucketCount]
    department_comparison: list[DepartmentComparison]
    risk_distribution: RiskDistribution
    top_skills: list[SkillAverageItem]
    common_weak_skills: list[WeakSkillItem]
    risk_heatmap: list[RiskHeatmapCell]


class AtRiskStudent(StudentListItem):
    """StudentListItem plus the risk reasons from the latest prediction."""

    risk_reasons: list[str] = Field(default_factory=list)
