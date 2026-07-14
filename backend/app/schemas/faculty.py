"""Faculty analytics, comparison, and interview-score schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ConfidenceLevel, RiskDistribution, SkillAverages
from app.schemas.prediction import Readiness
from app.schemas.student import SkillsInfo, StudentListItem


class FacultyAnalytics(BaseModel):
    student_count: int
    average_cgpa: float | None = None
    average_readiness: float | None = None
    average_probability: float | None = None
    at_risk_count: int
    skill_averages: SkillAverages
    top_performers: list[StudentListItem]
    weak_students: list[StudentListItem]
    risk_distribution: RiskDistribution


class StudentCompareItem(StudentListItem):
    """StudentListItem enriched with full skill and readiness objects."""

    skills: SkillsInfo
    readiness: Readiness | None = None


class CompareResponse(BaseModel):
    students: list[StudentCompareItem]


class InterviewScoreCreate(BaseModel):
    student_id: int
    mock_interview_score: float = Field(ge=0, le=100)
    confidence_level: ConfidenceLevel
    notes: str | None = None


class InterviewReadiness(BaseModel):
    """0.6 * mock_interview + 0.25 * communication + 0.15 * aptitude."""

    score: float = Field(ge=0, le=100)
    confidence_level: ConfidenceLevel
    suggestions: list[str]


class InterviewScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    mock_interview_score: float = Field(ge=0, le=100)
    confidence_level: ConfidenceLevel
    interview_readiness: InterviewReadiness
