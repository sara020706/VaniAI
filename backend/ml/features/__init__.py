"""Feature engineering for the VaniAI placement model.

Import the binding names from :mod:`ml.features.engineering`
(``FEATURE_COLUMNS``, ``TARGET_COLUMN``, ``FEATURE_LABELS``,
``ENGINEERED_COLUMNS``, ``add_engineered_features``, ``build_feature_row``,
``build_feature_frame``). This package init deliberately imports nothing so
that stdlib-only entry points elsewhere in ``ml.*`` never pull in pandas.
"""

__all__ = ["engineering"]
