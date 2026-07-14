"""Model training, evaluation, and the versioned joblib registry.

Import submodules directly (``ml.training.train``, ``ml.training.evaluate``,
``ml.training.registry``). This package init deliberately imports nothing so
that stdlib-only entry points elsewhere in ``ml.*`` stay dependency-free.
"""

__all__ = ["evaluate", "registry", "train"]
