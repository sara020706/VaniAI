"""Pagination helpers producing the contract's ``Page`` envelope (CONTRACTS.md §3).

Response shape: ``{"items": [...], "total": int, "page": int, "page_size": int}``.
Query params ``?page=1&page_size=20``.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar

from app.schemas.common import Page

T = TypeVar("T")


def paginate(items: Sequence[T], total: int, page: int, page_size: int) -> Page[T]:
    """Wrap an already-sliced page of ``items`` into the standard envelope.

    ``items`` must be the rows for the requested page (already offset/limited);
    ``total`` is the unpaginated row count.
    """
    return Page[T](items=list(items), total=total, page=page, page_size=page_size)


def offset_for(page: int, page_size: int) -> int:
    """SQL OFFSET for a 1-based ``page`` of size ``page_size``."""
    return (page - 1) * page_size
