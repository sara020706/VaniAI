"""Backend test suite for VaniAI.

Tests run entirely offline against a SQLite database (via a ``get_db`` dependency
override) and the heuristic fallback predictor — no PostgreSQL, network access,
or trained model artifact is required.
"""
