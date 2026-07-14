"""Dataset utilities: synthetic generation, validation, and cleaning.

Import submodules directly (``ml.data.generate_dataset``,
``ml.data.validation``, ``ml.data.cleaning``). This package init deliberately
imports nothing so that ``python -m ml.data.generate_dataset`` — a
stdlib-only entry point — runs on a bare Python installation without pandas
or scikit-learn installed.
"""

__all__ = ["cleaning", "generate_dataset", "validation"]
