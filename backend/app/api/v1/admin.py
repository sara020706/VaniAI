"""Admin & MLOps API (CONTRACTS.md section 7, admin.py [B4]).

Endpoints (all require the ``admin`` role):
- Users CRUD (create / list / update / soft-delete).
- Dataset upload + list.
- Training start, training history, model registry list, deploy version, retrain.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.core.metrics import set_active_model
from app.core.security import hash_password
from app.models.user import User
from app.schemas.admin import (
    AdminUserCreate,
    AdminUserUpdate,
    DatasetOut,
    ExperimentOut,
    ModelVersionOut,
    TrainingStartRequest,
    TrainingStartResponse,
)
from app.schemas.auth import UserOut
from app.schemas.common import DetailResponse, Page, PageParams, Role
from app.services.dataset_service import DatasetService
from app.services.training_service import TrainingService, run_training
from ml.inference.predictor import reload_predictor
from ml.training.registry import activate_version

router = APIRouter(prefix="/admin", tags=["admin"])

AdminUser = Annotated[User, Depends(require_roles("admin"))]
DbSession = Annotated[Session, Depends(get_db)]

_MAX_CSV_BYTES = 25 * 1024 * 1024  # 25 MB upload ceiling for training CSVs


# --- Users --------------------------------------------------------------------------


@router.get("/users", response_model=Page[UserOut])
def list_users(
    _admin: AdminUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    role: Role | None = Query(default=None),
    search: str | None = Query(default=None),
) -> Page[UserOut]:
    """List users, filterable by ``role`` and a case-insensitive name/email ``search``."""
    params = PageParams(page=page, page_size=page_size)
    conditions = []
    if role is not None:
        conditions.append(User.role == role)
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    count_stmt = select(func.count()).select_from(User)
    list_stmt = select(User).order_by(User.created_at.desc(), User.id.desc())
    for condition in conditions:
        count_stmt = count_stmt.where(condition)
        list_stmt = list_stmt.where(condition)

    total = int(db.scalar(count_stmt) or 0)
    users = db.scalars(list_stmt.offset(params.offset).limit(params.page_size)).all()
    items = [UserOut.model_validate(user) for user in users]
    return Page[UserOut](items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, _admin: AdminUser, db: DbSession) -> UserOut:
    """Create a user with an explicit role. Emails must be unique."""
    existing = db.scalars(select(User).where(User.email == payload.email)).first()
    if existing is not None:
        raise ConflictError(f"A user with email {payload.email} already exists")

    user = User(
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: AdminUser,
    db: DbSession,
) -> UserOut:
    """Update a user's name, role, active flag, or password.

    An admin may not deactivate or demote *themselves* — this prevents locking
    the platform out of its last administrator by accident.
    """
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        if user.id == admin.id and payload.role != "admin":
            raise PermissionDeniedError("You cannot change your own admin role")
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == admin.id and payload.is_active is False:
            raise PermissionDeniedError("You cannot deactivate your own account")
        user.is_active = payload.is_active
    if payload.password is not None:
        user.hashed_password = hash_password(payload.password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", response_model=DetailResponse)
def deactivate_user(user_id: int, admin: AdminUser, db: DbSession) -> DetailResponse:
    """Soft-delete a user by setting ``is_active=False`` (never a hard delete)."""
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    if user.id == admin.id:
        raise PermissionDeniedError("You cannot deactivate your own account")
    user.is_active = False
    db.add(user)
    db.commit()
    return DetailResponse(detail=f"User {user_id} deactivated")


# --- Datasets -----------------------------------------------------------------------


@router.post("/datasets/upload", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    admin: AdminUser,
    db: DbSession,
    file: Annotated[UploadFile, File(description="Training dataset CSV")],
) -> DatasetOut:
    """Upload a training CSV; validates it via ``ml.data.validation``."""
    filename = file.filename or "dataset.csv"
    if not filename.lower().endswith(".csv"):
        raise ValidationError("Only .csv files are accepted")
    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise ValidationError("Uploaded file exceeds the 25MB limit")

    service = DatasetService(db)
    dataset = service.upload(filename=filename, content=content, uploaded_by=admin.id)
    return DatasetOut.model_validate(service.serialize(dataset))


@router.get("/datasets", response_model=Page[DatasetOut])
def list_datasets(
    _admin: AdminUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[DatasetOut]:
    """Paginated list of uploaded datasets (newest first)."""
    params = PageParams(page=page, page_size=page_size)
    service = DatasetService(db)
    page_result = service.list(params)
    items = [DatasetOut.model_validate(item) for item in page_result.items]
    return Page[DatasetOut](
        items=items,
        total=page_result.total,
        page=page_result.page,
        page_size=page_result.page_size,
    )


# --- Training & model registry ------------------------------------------------------


@router.post(
    "/training/start",
    response_model=TrainingStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_training(
    payload: TrainingStartRequest,
    _admin: AdminUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> TrainingStartResponse:
    """Kick off training on a validated dataset (runs in a background task)."""
    service = TrainingService(db)
    experiment = service.start_training(payload.dataset_id)
    background_tasks.add_task(run_training, experiment.id)
    return TrainingStartResponse(experiment_id=experiment.id, status="running")


@router.get("/training/history", response_model=Page[ExperimentOut])
def training_history(
    _admin: AdminUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[ExperimentOut]:
    """Paginated training-experiment history (newest first)."""
    params = PageParams(page=page, page_size=page_size)
    service = TrainingService(db)
    experiments, total = service.list_history(offset=params.offset, limit=params.page_size)
    items = [ExperimentOut.model_validate(exp) for exp in experiments]
    return Page[ExperimentOut](
        items=items, total=total, page=params.page, page_size=params.page_size
    )


@router.get("/models", response_model=list[ModelVersionOut])
def list_models(_admin: AdminUser, db: DbSession) -> list[ModelVersionOut]:
    """List every registered model version (newest first)."""
    service = TrainingService(db)
    return [ModelVersionOut.model_validate(version) for version in service.list_models()]


@router.post("/models/{version}/deploy", response_model=ModelVersionOut)
def deploy_model(version: str, _admin: AdminUser, db: DbSession) -> ModelVersionOut:
    """Activate a model version: copy artifacts to ``active/`` and reload the predictor."""
    service = TrainingService(db)
    model_version = service.models.get_by_version(version)
    if model_version is None:
        raise NotFoundError(f"Model version {version} not found")

    settings = get_settings()
    # Copy the version's artifacts into the active slot on disk.
    activate_version(version, settings.model_dir)
    # Flip DB active flags exclusively.
    service.models.set_active(version)
    db.commit()
    db.refresh(model_version)

    # Refresh the in-process predictor and the Prometheus gauge.
    reload_predictor(settings.model_dir)
    set_active_model(version)
    return ModelVersionOut.model_validate(model_version)


@router.post(
    "/retraining/trigger",
    response_model=TrainingStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_retraining(
    _admin: AdminUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> TrainingStartResponse:
    """Retrain on the latest used/validated dataset (background task)."""
    service = TrainingService(db)
    experiment = service.start_retraining()
    background_tasks.add_task(run_training, experiment.id)
    return TrainingStartResponse(experiment_id=experiment.id, status="running")
