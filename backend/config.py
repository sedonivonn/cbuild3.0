"""Runtime configuration loaded from environment variables.

Keeps a single source of truth for env-driven flags so the rest of the app
never calls os.environ directly.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


def _get_bool(key: str, default: bool = False) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # --- App ---
    app_env: str = os.environ.get("APP_ENV", "development")
    cors_origins: list[str] = [
        o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()
    ]

    # --- DB provider ---
    db_provider: str = os.environ.get("DB_PROVIDER", "mongo").strip().lower()

    # --- MongoDB ---
    mongo_url: str | None = os.environ.get("MONGO_URL")
    db_name: str = os.environ.get("DB_NAME", "championsbuild")

    # --- Firebase / Firestore ---
    firebase_enabled: bool = _get_bool("FIREBASE_ENABLED", False)
    firebase_project_id: str | None = os.environ.get("FIREBASE_PROJECT_ID") or None
    google_application_credentials: str | None = (
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or None
    )
    firebase_service_account_json: str | None = (
        os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or None
    )

    # --- Firestore collections ---
    firestore_users_collection: str = os.environ.get(
        "FIRESTORE_USERS_COLLECTION", "users"
    )
    firestore_status_collection: str = os.environ.get(
        "FIRESTORE_STATUS_COLLECTION", "status_checks"
    )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
