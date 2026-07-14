"""VaniAI standalone machine-learning package.

This package is intentionally decoupled from the FastAPI application: nothing
under ``ml.*`` may import from ``app.*``. Keep this module (and every
``__init__.py`` in the package) free of heavy third-party imports so that
stdlib-only entry points such as ``python -m ml.data.generate_dataset`` run on
a bare Python installation.
"""

__all__ = ["config", "data", "features", "training"]
