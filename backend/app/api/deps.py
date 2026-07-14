"""Shared FastAPI dependencies: DB session, current user, role guard."""

from __future__ import annotations

from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import TokenError, decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator[Session, None, None]:
    """Provide a request-scoped SQLAlchemy session."""
    yield from get_session()


def _credentials_exception(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a Bearer access token."""
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise _credentials_exception(exc.message) from exc

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise _credentials_exception() from exc

    user = db.get(User, user_id)
    if user is None:
        raise _credentials_exception("User not found")
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    """Dependency factory: allow only users whose role is in ``roles``.

    Usage: ``Depends(require_roles("faculty", "admin"))``.
    """
    allowed = set(roles)

    def _role_guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return _role_guard
