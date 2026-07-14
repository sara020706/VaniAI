"""Authentication routes (CONTRACTS.md §7 auth.py).

Router carries its own ``/auth`` prefix; mounted under ``/api/v1`` by the app.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.common import DetailResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserOut:
    """Create a student user and an empty student profile in one transaction."""
    service = AuthService(db)
    user = service.register(payload)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse, summary="Log in with email + password")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Verify credentials and return access + refresh tokens with the user."""
    service = AuthService(db)
    return service.login(payload)


@router.post("/refresh", response_model=TokenResponse, summary="Rotate a refresh token")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Rotate the presented refresh token and return a fresh token pair."""
    service = AuthService(db)
    return service.refresh(payload.refresh_token)


@router.post("/logout", response_model=DetailResponse, summary="Revoke a refresh token")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DetailResponse:
    """Revoke the presented refresh token for the authenticated user."""
    service = AuthService(db)
    service.logout(payload.refresh_token)
    return DetailResponse(detail="Logged out")


@router.get("/me", response_model=UserOut, summary="Current authenticated user")
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the profile of the authenticated user."""
    return UserOut.model_validate(current_user)
