"""Data access for users and persisted refresh tokens (CONTRACTS.md §4, §5)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.user import RefreshToken, User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """User rows plus the refresh-token lifecycle (create, rotate, revoke)."""

    def __init__(self, session: Session) -> None:
        super().__init__(session, User)

    # --- Users -----------------------------------------------------------------------

    def get_by_email(self, email: str) -> User | None:
        """Fetch a user by exact email (unique), or ``None``."""
        stmt = select(User).where(User.email == email).limit(1)
        return self.session.execute(stmt).scalar_one_or_none()

    def email_exists(self, email: str) -> bool:
        """Whether a user already exists with this email."""
        stmt = select(func.count()).select_from(User).where(User.email == email)
        return int(self.session.execute(stmt).scalar_one()) > 0

    def create(
        self,
        *,
        email: str,
        hashed_password: str,
        full_name: str,
        role: str,
        is_active: bool = True,
    ) -> User:
        """Insert a new user and flush to populate its primary key."""
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            is_active=is_active,
        )
        return self.add(user)

    def list_users(
        self,
        *,
        role: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[User], int]:
        """Paginated, filterable user listing used by the admin API.

        Filters: exact ``role``; ``search`` matches email or full name (ILIKE).
        Returns ``(rows, total)``.
        """
        conditions = []
        if role is not None:
            conditions.append(User.role == role)
        if search:
            pattern = f"%{search.strip()}%"
            conditions.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

        base = select(User)
        count_stmt = select(func.count()).select_from(User)
        for condition in conditions:
            base = base.where(condition)
            count_stmt = count_stmt.where(condition)

        total = int(self.session.execute(count_stmt).scalar_one())
        rows = (
            self.session.execute(
                base.order_by(User.id.asc()).offset(offset).limit(limit)
            )
            .scalars()
            .all()
        )
        return rows, total

    # --- Refresh tokens --------------------------------------------------------------

    def add_refresh_token(
        self, *, user_id: int, token_hash: str, expires_at: datetime
    ) -> RefreshToken:
        """Persist a hashed refresh token for a user."""
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked=False,
        )
        self.session.add(token)
        self.session.flush()
        return token

    def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        """Look up a stored refresh token by its sha256 hash.

        Two JWTs minted in the same second with identical claims are byte-equal
        and therefore share a hash. Order non-revoked rows first (then newest),
        so a rapid refresh chain always resolves to the live token rather than a
        previously-revoked collision.
        """
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .order_by(RefreshToken.revoked.asc(), RefreshToken.id.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def revoke_refresh_token(self, token: RefreshToken) -> None:
        """Mark a single refresh token revoked (idempotent)."""
        token.revoked = True
        self.session.flush()

    def is_refresh_token_active(self, token: RefreshToken) -> bool:
        """A refresh token is usable only if not revoked and not expired."""
        if token.revoked:
            return False
        expires_at = token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        return expires_at > datetime.now(UTC)
