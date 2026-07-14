"""Domain exceptions raised by services and mapped to HTTP responses in app.main."""

from __future__ import annotations


class DomainError(Exception):
    """Base class for all VaniAI domain errors."""

    default_message: str = "Domain error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundError(DomainError):
    """Requested resource does not exist. Mapped to HTTP 404."""

    default_message = "Resource not found"


class PermissionDeniedError(DomainError):
    """Caller lacks permission for this action. Mapped to HTTP 403."""

    default_message = "Permission denied"


class ValidationError(DomainError):
    """Input failed domain-level validation. Mapped to HTTP 422."""

    default_message = "Validation failed"


class ConflictError(DomainError):
    """State conflict (e.g. duplicate unique value). Mapped to HTTP 409."""

    default_message = "Conflict"
