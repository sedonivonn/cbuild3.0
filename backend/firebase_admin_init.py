"""Firebase Admin SDK bootstrap.

Safe-to-import even without credentials: if FIREBASE_ENABLED is false or the
credentials cannot be loaded, we simply do not initialize the app. Callers
must check `is_firebase_ready()` before using auth / firestore.

Supports 3 credential modes (checked in order):
  1. FIREBASE_SERVICE_ACCOUNT_JSON  -> inline JSON string (base64 or raw)
  2. GOOGLE_APPLICATION_CREDENTIALS  -> path to service account file
  3. Application Default Credentials (ADC) -> Cloud Run runtime SA
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials

from config import settings

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None
_init_error: Optional[str] = None


def _load_inline_json(raw: str) -> dict:
    raw = raw.strip()
    # Try base64 first (common for Cloud Run env vars)
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        pass
    # Fallback: raw JSON string
    return json.loads(raw)


def init_firebase() -> Optional[firebase_admin.App]:
    """Initialize Firebase Admin once. Returns the app or None."""
    global _firebase_app, _init_error

    if _firebase_app is not None:
        return _firebase_app

    if not settings.firebase_enabled:
        logger.info("Firebase disabled via FIREBASE_ENABLED=false. Skipping init.")
        return None

    try:
        cred = None

        if settings.firebase_service_account_json:
            try:
                svc_json = _load_inline_json(settings.firebase_service_account_json)
                cred = credentials.Certificate(svc_json)
                logger.info("Firebase: using inline service account JSON.")
            except Exception as e:
                logger.error(
                    "Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: %s", e
                )
                raise

        elif settings.google_application_credentials:
            cred = credentials.Certificate(settings.google_application_credentials)
            logger.info(
                "Firebase: using service account file at %s",
                settings.google_application_credentials,
            )

        else:
            # Application Default Credentials (Cloud Run runtime SA)
            cred = credentials.ApplicationDefault()
            logger.info("Firebase: using Application Default Credentials.")

        options = {}
        if settings.firebase_project_id:
            options["projectId"] = settings.firebase_project_id

        _firebase_app = firebase_admin.initialize_app(cred, options or None)
        logger.info("Firebase Admin initialized successfully.")
        return _firebase_app

    except Exception as e:
        _init_error = str(e)
        logger.error("Firebase Admin init failed: %s", e)
        _firebase_app = None
        return None


def is_firebase_ready() -> bool:
    return _firebase_app is not None


def get_init_error() -> Optional[str]:
    return _init_error
