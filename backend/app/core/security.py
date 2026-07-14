"""Password hashing and JWT creation/verification (contracts section 4)."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    """Raised when a JWT is missing, malformed, expired, or of the wrong type."""

    def __init__(self, message: str = "Could not validate credentials") -> None:
        self.message = message
        super().__init__(message)


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plaintext password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_refresh_token(token: str) -> str:
    """SHA-256 digest used to persist refresh tokens (never store raw tokens)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(subject: str, role: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    settings = get_settings()
    return jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: int | str, role: str) -> str:
    """Create a short-lived access token. Claims: sub=str(user_id), role, type='access', exp."""
    settings = get_settings()
    return _create_token(
        subject=str(user_id),
        role=role,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int | str, role: str) -> str:
    """Create a long-lived refresh token. Claims: sub=str(user_id), role, type='refresh', exp."""
    settings = get_settings()
    return _create_token(
        subject=str(user_id),
        role=role,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """Decode and validate a JWT.

    Raises TokenError with a clear message when the token is expired, malformed,
    missing required claims, or of the wrong type.
    """
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except ExpiredSignatureError as exc:
        raise TokenError("Token has expired") from exc
    except JWTError as exc:
        raise TokenError("Invalid token") from exc

    if "sub" not in payload or "type" not in payload:
        raise TokenError("Token is missing required claims")
    if expected_type is not None and payload["type"] != expected_type:
        raise TokenError(f"Invalid token type: expected '{expected_type}'")
    return payload
