"""Authentication service: register, login, refresh (rotation), logout.

Implements the CONTRACTS.md §4 auth flow:
- Passwords hashed with bcrypt (via ``app.core.security``).
- Refresh tokens persisted sha256-hashed in ``refresh_tokens``.
- Refresh rotates the token (old revoked, new issued); logout revokes.
- Register creates the student user + an empty student profile in one
  transaction.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.user import User
from app.repositories.student_repository import StudentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

_INVALID_CREDENTIALS = "Incorrect email or password"
_INVALID_REFRESH = "Invalid or expired refresh token"


class AuthService:
    """Coordinates user/refresh-token repositories to fulfil the auth routes."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.students = StudentRepository(session)
        self.settings = get_settings()

    # --- Registration ----------------------------------------------------------------

    def register(self, payload: RegisterRequest) -> User:
        """Create a student user and an empty student profile atomically.

        Raises ``ConflictError`` if the email or register number is taken.
        """
        if self.users.email_exists(payload.email):
            raise ConflictError("A user with this email already exists")
        if self.students.register_number_exists(payload.register_number):
            raise ConflictError("A student with this register number already exists")

        user = self.users.create(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            role="student",
            is_active=True,
        )
        self.students.create(
            user_id=user.id,
            register_number=payload.register_number,
            department=payload.department,
            batch=payload.batch,
            semester=payload.semester,
        )
        self.session.commit()
        self.session.refresh(user)
        return user

    # --- Login -----------------------------------------------------------------------

    def login(self, payload: LoginRequest) -> TokenResponse:
        """Verify credentials and issue an access + persisted refresh token pair."""
        user = self.users.get_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise PermissionDeniedError(_INVALID_CREDENTIALS)
        if not user.is_active:
            raise PermissionDeniedError("This account is inactive")
        response = self._issue_tokens(user)
        self.session.commit()
        return response

    # --- Refresh (rotation) ----------------------------------------------------------

    def refresh(self, refresh_token: str) -> TokenResponse:
        """Rotate a refresh token: validate, revoke the old, issue a new pair.

        The token must be a valid, non-expired, non-revoked, persisted refresh
        JWT of type ``refresh``.
        """
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
        except TokenError as exc:
            raise PermissionDeniedError(_INVALID_REFRESH) from exc

        token_hash = hash_refresh_token(refresh_token)
        stored = self.users.get_refresh_token(token_hash)
        if stored is None or not self.users.is_refresh_token_active(stored):
            raise PermissionDeniedError(_INVALID_REFRESH)

        try:
            user_id = int(payload["sub"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PermissionDeniedError(_INVALID_REFRESH) from exc

        if stored.user_id != user_id:
            raise PermissionDeniedError(_INVALID_REFRESH)

        user = self.users.get(user_id)
        if user is None or not user.is_active:
            raise PermissionDeniedError(_INVALID_REFRESH)

        # Rotate: revoke the presented token, then mint a fresh pair.
        self.users.revoke_refresh_token(stored)
        response = self._issue_tokens(user)
        self.session.commit()
        return response

    # --- Logout ----------------------------------------------------------------------

    def logout(self, refresh_token: str) -> None:
        """Revoke a persisted refresh token (idempotent — unknown tokens no-op)."""
        token_hash = hash_refresh_token(refresh_token)
        stored = self.users.get_refresh_token(token_hash)
        if stored is not None and not stored.revoked:
            self.users.revoke_refresh_token(stored)
        self.session.commit()

    # --- Current user ----------------------------------------------------------------

    def get_current_user_out(self, user: User) -> UserOut:
        """Serialize the authenticated user for ``GET /auth/me``."""
        if user is None:
            raise NotFoundError("User not found")
        return UserOut.model_validate(user)

    # --- Internal helpers ------------------------------------------------------------

    def _issue_tokens(self, user: User) -> TokenResponse:
        """Mint an access token and a persisted (hashed) refresh token."""
        access_token = create_access_token(user.id, user.role)
        refresh_token = create_refresh_token(user.id, user.role)
        expires_at = datetime.now(UTC) + timedelta(
            days=self.settings.refresh_token_expire_days
        )
        self.users.add_refresh_token(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=expires_at,
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserOut.model_validate(user),
        )
