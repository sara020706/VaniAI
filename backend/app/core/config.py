"""Application settings loaded from environment variables / .env via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration (see docs/CONTRACTS.md section 3)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=(),  # allow the MODEL_DIR -> model_dir field name
    )

    # --- Database ---
    database_url: str = "postgresql+psycopg2://vaniai:vaniai@localhost:5432/vaniai"

    # --- Auth / JWT ---
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # --- CORS (comma-separated string in env, parsed to list) ---
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- Filesystem locations ---
    model_dir: str = "./ml_artifacts"
    upload_dir: str = "./uploads"

    # --- MLOps ---
    mlflow_tracking_uri: str = ""

    # --- Runtime ---
    environment: str = "development"
    auto_create_tables: bool = True

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_cors(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS parsed from a comma-separated string into a list of origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — import and call this everywhere instead of Settings()."""
    return Settings()
