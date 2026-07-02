"""FastAPI auth dependencies.

- `get_current_user`  -> required. 401 if the ID token is missing/invalid.
- `get_optional_user` -> optional. Returns None instead of raising.

Both verify Firebase ID tokens via `firebase_admin.auth.verify_id_token`.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth

from firebase_admin_init import init_firebase, is_firebase_ready

logger = logging.getLogger(__name__)


class AuthUser:
    def __init__(self, uid: str, email: Optional[str], claims: dict):
        self.uid = uid
        self.email = email
        self.claims = claims
        self.name = claims.get("name")
        self.picture = claims.get("picture")
        self.email_verified = bool(claims.get("email_verified", False))
        self.provider = (
            claims.get("firebase", {}).get("sign_in_provider") if claims else None
        )

    def to_dict(self) -> dict:
        return {
            "uid": self.uid,
            "email": self.email,
            "name": self.name,
            "picture": self.picture,
            "email_verified": self.email_verified,
            "provider": self.provider,
        }


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _verify_token(token: str) -> AuthUser:
    if not is_firebase_ready():
        # Lazy init on first request in case app started before Firebase was ready.
        init_firebase()
    if not is_firebase_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin is not configured on the server.",
        )
    try:
        decoded = fb_auth.verify_id_token(token)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except fb_auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token revoked.")
    except fb_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Auth failed.")

    return AuthUser(
        uid=decoded["uid"],
        email=decoded.get("email"),
        claims=decoded,
    )


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> AuthUser:
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization: Bearer <ID_TOKEN> header.",
        )
    return _verify_token(token)


async def get_optional_user(
    authorization: Optional[str] = Header(None),
) -> Optional[AuthUser]:
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        return _verify_token(token)
    except HTTPException:
        return None
