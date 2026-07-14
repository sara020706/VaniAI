"""Dataset cleaning for training inputs (CONTRACTS.md §6.2).

``clean_dataframe(df)`` produces a model-ready copy of a validated (or merely
plausible) training frame:

1. Coerce every required column to numeric (non-numeric → NaN).
2. Clip values into their valid ranges (CGPA 0–10, percentages/scores 0–100,
   counts >= 0, target 0/1).
3. Impute remaining NaNs with each column's median (falling back to a sensible
   default when a column is entirely null).
4. Round count columns to whole numbers and coerce the target to ``int`` 0/1.
5. Drop exact duplicate rows.

The function never mutates its input; it returns a new frame containing exactly
the required columns in canonical order (base features + target).
"""

from __future__ import annotations

import pandas as pd

from ml.features.engineering import (
    COUNT_COLUMNS,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    default_feature_value,
)

#: Required columns in canonical order (base features + target).
REQUIRED_COLUMNS: list[str] = [*FEATURE_COLUMNS, TARGET_COLUMN]

_PERCENT_SCORE_COLUMNS: set[str] = {
    "tenth_percentage",
    "twelfth_percentage",
    "attendance_percentage",
    "coding_score",
    "aptitude_score",
    "communication_score",
    "technical_skill_score",
    "leadership_score",
    "resume_score",
    "mock_interview_score",
}


def _bounds(column: str) -> tuple[float, float | None]:
    """Return the clip ``(lower, upper)`` range for a required column."""
    if column == "cgpa":
        return (0.0, 10.0)
    if column in COUNT_COLUMNS:
        return (0.0, None)
    if column in _PERCENT_SCORE_COLUMNS:
        return (0.0, 100.0)
    if column == TARGET_COLUMN:
        return (0.0, 1.0)
    return (0.0, None)


def _fallback_value(column: str) -> float:
    """Default used when a column is entirely null (no median available)."""
    if column == TARGET_COLUMN:
        return 0.0
    return float(default_feature_value(column))


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Return a cleaned, model-ready copy of ``df``.

    Missing required columns are created (fully imputed from their fallback
    default) so downstream feature engineering always receives the full
    canonical schema.
    """
    if df is None:
        raise ValueError("clean_dataframe received None; expected a DataFrame.")

    out = pd.DataFrame(index=df.index)

    for column in REQUIRED_COLUMNS:
        if column in df.columns:
            series = pd.to_numeric(df[column], errors="coerce")
        else:
            series = pd.Series([pd.NA] * len(df), index=df.index, dtype="float64")

        lower, upper = _bounds(column)
        series = series.clip(lower=lower, upper=upper)

        # --- Impute -------------------------------------------------------
        median = series.median()
        if pd.isna(median):
            median = _fallback_value(column)
        series = series.fillna(median)

        # --- Column-specific normalization -------------------------------
        if column in COUNT_COLUMNS:
            series = series.round().clip(lower=0.0).astype("int64")
        elif column == TARGET_COLUMN:
            series = series.round().clip(lower=0.0, upper=1.0).astype("int64")
        else:
            series = series.astype("float64")

        out[column] = series

    # --- Drop exact duplicate rows ---------------------------------------
    out = out.drop_duplicates().reset_index(drop=True)

    return out
