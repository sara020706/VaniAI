"""Dataset validation for training inputs (CONTRACTS.md §6.2).

``validate_dataframe(df)`` checks a candidate training frame and returns
``(ok, errors)`` where ``ok`` is ``True`` only when the list of human-readable
error strings is empty. Validation is *non-destructive* — it never mutates the
frame; cleaning/coercion is the job of :mod:`ml.data.cleaning`.

Checks performed:

- All required columns present (the 15 base features + the ``placed`` target).
- Each numeric column is coercible to a number (>= 90% of non-null values).
- Value ranges: CGPA 0–10; percentages & scores 0–100; counts >= 0;
  target strictly in ``{0, 1}``.
- At least 50 rows.
- Per-column null share below 20%.
"""

from __future__ import annotations

import pandas as pd

from ml.features.engineering import (
    COUNT_COLUMNS,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
)

#: Minimum number of rows required to train.
MIN_ROWS: int = 50

#: Maximum allowed share of nulls in any single required column.
MAX_NULL_SHARE: float = 0.20

#: Minimum share of values in a numeric column that must be coercible.
MIN_COERCIBLE_SHARE: float = 0.90

#: All columns that must exist in a valid training frame.
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


def _column_bounds(column: str) -> tuple[float, float | None]:
    """Return the ``(lower, upper)`` valid range for a required column."""
    if column == "cgpa":
        return (0.0, 10.0)
    if column in COUNT_COLUMNS:
        return (0.0, None)
    if column in _PERCENT_SCORE_COLUMNS:
        return (0.0, 100.0)
    if column == TARGET_COLUMN:
        return (0.0, 1.0)
    return (0.0, None)


def validate_dataframe(df: pd.DataFrame) -> tuple[bool, list[str]]:
    """Validate a training dataframe. Returns ``(ok, errors)``."""
    errors: list[str] = []

    if df is None:  # defensive: caller passed nothing
        return False, ["Dataset is None; expected a pandas DataFrame."]

    # --- Required columns -------------------------------------------------
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {', '.join(missing)}.")

    # --- Row count --------------------------------------------------------
    row_count = int(len(df))
    if row_count < MIN_ROWS:
        errors.append(
            f"Dataset has {row_count} rows; at least {MIN_ROWS} are required."
        )

    # Column-level checks only make sense for columns that exist.
    present = [col for col in REQUIRED_COLUMNS if col in df.columns]

    for column in present:
        series = df[column]

        # --- Null share ---------------------------------------------------
        if row_count > 0:
            null_share = float(series.isna().mean())
            if null_share > MAX_NULL_SHARE:
                errors.append(
                    f"Column '{column}' has {null_share:.0%} null values "
                    f"(max allowed {MAX_NULL_SHARE:.0%})."
                )

        # --- Coercibility -------------------------------------------------
        coerced = pd.to_numeric(series, errors="coerce")
        non_null = series.notna()
        non_null_total = int(non_null.sum())
        if non_null_total > 0:
            coercible = int((coerced.notna() & non_null).sum())
            coercible_share = coercible / non_null_total
            if coercible_share < MIN_COERCIBLE_SHARE:
                errors.append(
                    f"Column '{column}' is not numeric: only "
                    f"{coercible_share:.0%} of non-null values are coercible "
                    f"(min {MIN_COERCIBLE_SHARE:.0%})."
                )

        # --- Range --------------------------------------------------------
        valid = coerced.dropna()
        if not valid.empty:
            lower, upper = _column_bounds(column)
            below = int((valid < lower).sum())
            if below:
                errors.append(
                    f"Column '{column}' has {below} value(s) below the "
                    f"minimum of {lower:g}."
                )
            if upper is not None:
                above = int((valid > upper).sum())
                if above:
                    errors.append(
                        f"Column '{column}' has {above} value(s) above the "
                        f"maximum of {upper:g}."
                    )

        # --- Target must be strictly binary ------------------------------
        if column == TARGET_COLUMN and not valid.empty:
            distinct = set(int(v) for v in valid.round().unique() if v in (0, 1))
            invalid_labels = valid[~valid.round().isin([0, 1])]
            if len(invalid_labels) > 0:
                errors.append(
                    f"Target column '{TARGET_COLUMN}' must be 0/1; found "
                    f"{len(invalid_labels)} value(s) outside {{0, 1}}."
                )
            elif len(distinct) < 2:
                errors.append(
                    f"Target column '{TARGET_COLUMN}' has only one class; "
                    "both placed (1) and not-placed (0) examples are required."
                )

    return (len(errors) == 0), errors
