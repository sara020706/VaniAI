"""Prediction pipeline schemas: readiness, SHAP explanation, gaps, recommendations."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Priority, RiskLevel


class Readiness(BaseModel):
    """Career-readiness scores, all 0-100."""

    academic: float = Field(ge=0, le=100)
    technical: float = Field(ge=0, le=100)
    communication: float = Field(ge=0, le=100)
    industry: float = Field(ge=0, le=100)
    overall: float = Field(ge=0, le=100)


class ExplanationFactor(BaseModel):
    """A signed SHAP contribution for a single feature."""

    feature: str
    label: str
    impact: float


class FeatureImportanceItem(BaseModel):
    """Mean absolute SHAP importance for a single feature."""

    feature: str
    label: str
    importance: float


class Explanation(BaseModel):
    """SHAP explanation payload for a prediction."""

    top_positive: list[ExplanationFactor]
    top_negative: list[ExplanationFactor]
    feature_importance: list[FeatureImportanceItem]


class SkillGap(BaseModel):
    skill: str
    current: float
    target: float
    gap: float
    severity: Priority


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    priority: Priority
    text: str


class CareerRecommendation(BaseModel):
    role: str
    match_score: float = Field(ge=0, le=100)
    reasons: list[str]


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    student_id: int
    model_version: str
    created_at: datetime
    placement_probability: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    risk_reasons: list[str]
    readiness: Readiness
    explanation: Explanation
    skill_gaps: list[SkillGap]
    recommendations: list[RecommendationOut]
    career_recommendations: list[CareerRecommendation]


class PredictionHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    created_at: datetime
    placement_probability: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    readiness_overall: float = Field(ge=0, le=100)
    model_version: str
