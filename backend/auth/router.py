"""Auth-related HTTP routes.

All endpoints are mounted under /api/auth by server.py.

Exposed contract:
  POST /api/auth/sync      -> upsert current user into Firestore `users`.
  GET  /api/auth/me        -> return current user profile (from Firestore).
  POST /api/auth/logout    -> stateless no-op (client drops the token).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from auth.dependencies import AuthUser, get_current_user
from config import settings
from db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    email_verified: bool = False
    provider: Optional[str] = None
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/sync", response_model=UserProfile)
async def sync_user(current: AuthUser = Depends(get_current_user)) -> UserProfile:
    """Upsert the current user into the `users` collection.

    Frontends should call this right after login/register to guarantee that
    a user document exists before reading /me.
    """
    db = get_db()
    coll = settings.firestore_users_collection

    existing = await db.find_one(coll, current.uid)
    now = _now_iso()

    doc = {
        "id": current.uid,
        "email": current.email,
        "name": current.name,
        "picture": current.picture,
        "email_verified": current.email_verified,
        "provider": current.provider,
        "last_login_at": now,
    }

    if existing:
        doc["created_at"] = existing.get("created_at") or now
    else:
        doc["created_at"] = now

    await db.upsert_by_id(coll, current.uid, doc)
    return UserProfile(**doc)


@router.get("/me", response_model=UserProfile)
async def get_me(current: AuthUser = Depends(get_current_user)) -> UserProfile:
    db = get_db()
    coll = settings.firestore_users_collection
    profile = await db.find_one(coll, current.uid)

    if not profile:
        # First-time hit: auto-sync so /me always returns something after login.
        now = _now_iso()
        profile = {
            "id": current.uid,
            "email": current.email,
            "name": current.name,
            "picture": current.picture,
            "email_verified": current.email_verified,
            "provider": current.provider,
            "created_at": now,
            "last_login_at": now,
        }
        await db.upsert_by_id(coll, current.uid, profile)

    return UserProfile(**profile)


@router.post("/logout")
async def logout(current: AuthUser = Depends(get_current_user)) -> dict:
    # JWTs are stateless. The client simply drops the token. This endpoint
    # exists so the frontend can log the event or extend it later
    # (e.g. revoke refresh tokens via fb_auth.revoke_refresh_tokens).
    return {"ok": True, "uid": current.uid}
