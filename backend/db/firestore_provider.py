"""Google Cloud Firestore async provider.

Uses google.cloud.firestore.AsyncClient which is a native async SDK, sharing
credentials with firebase-admin (Application Default Credentials on Cloud Run
or a service account file locally).
"""
from __future__ import annotations

import logging
from typing import Optional

from google.cloud import firestore
from google.oauth2 import service_account

from config import settings
from db.base import DBProvider
from firebase_admin_init import _load_inline_json  # reuse the same JSON loader

logger = logging.getLogger(__name__)


def _build_async_client() -> firestore.AsyncClient:
    """Instantiate an AsyncClient using whatever credentials are available."""
    project = settings.firebase_project_id

    if settings.firebase_service_account_json:
        svc_json = _load_inline_json(settings.firebase_service_account_json)
        creds = service_account.Credentials.from_service_account_info(svc_json)
        return firestore.AsyncClient(project=project or svc_json.get("project_id"), credentials=creds)

    if settings.google_application_credentials:
        creds = service_account.Credentials.from_service_account_file(
            settings.google_application_credentials
        )
        return firestore.AsyncClient(project=project, credentials=creds)

    # ADC (Cloud Run runtime SA)
    return firestore.AsyncClient(project=project) if project else firestore.AsyncClient()


class FirestoreProvider(DBProvider):
    name = "firestore"

    def __init__(self) -> None:
        self._client = _build_async_client()
        logger.info("FirestoreProvider ready (project=%s)", self._client.project)

    async def insert_one(self, collection: str, doc: dict) -> None:
        # Prefer the `id` field as the document id when present.
        doc_id = doc.get("id")
        col_ref = self._client.collection(collection)
        if doc_id:
            await col_ref.document(doc_id).set(doc)
        else:
            await col_ref.add(doc)

    async def find_many(self, collection: str, limit: int = 1000) -> list[dict]:
        col_ref = self._client.collection(collection)
        results: list[dict] = []
        async for snap in col_ref.limit(limit).stream():
            data = snap.to_dict() or {}
            data.setdefault("id", snap.id)
            results.append(data)
        return results

    async def find_one(self, collection: str, doc_id: str) -> Optional[dict]:
        snap = await self._client.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data.setdefault("id", snap.id)
        return data

    async def upsert_by_id(self, collection: str, doc_id: str, doc: dict) -> None:
        await self._client.collection(collection).document(doc_id).set(
            doc, merge=True
        )

    async def close(self) -> None:
        # AsyncClient has no explicit close; underlying gRPC channel is cleaned
        # up by garbage collection. This is a no-op for symmetry.
        return None
