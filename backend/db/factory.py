"""DB provider factory.

Selects Mongo or Firestore based on `settings.db_provider`. Lazy-initializes
on first `get_db()` call so importing this module never crashes even when
credentials are missing.
"""
from __future__ import annotations

import logging
from typing import Optional

from config import settings
from db.base import DBProvider

logger = logging.getLogger(__name__)

_provider: Optional[DBProvider] = None


def get_db() -> DBProvider:
    global _provider
    if _provider is not None:
        return _provider

    provider_name = settings.db_provider
    if provider_name == "firestore":
        from db.firestore_provider import FirestoreProvider

        _provider = FirestoreProvider()
    else:
        from db.mongo_provider import MongoProvider

        if not settings.mongo_url:
            raise RuntimeError(
                "DB_PROVIDER=mongo but MONGO_URL is not set. Fix backend/.env."
            )
        _provider = MongoProvider(settings.mongo_url, settings.db_name)

    logger.info("DB provider selected: %s", _provider.name)
    return _provider


async def close_db() -> None:
    global _provider
    if _provider is not None:
        await _provider.close()
        _provider = None
