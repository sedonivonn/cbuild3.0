"""Database provider abstraction.

Exposes an async interface that both MongoDB (motor) and Firestore
(google-cloud-firestore async client) implement, so the routers don't care
which backend is in use.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class DBProvider(ABC):
    """Minimal async CRUD surface used by our routers."""

    name: str = "base"

    @abstractmethod
    async def insert_one(self, collection: str, doc: dict) -> None: ...

    @abstractmethod
    async def find_many(
        self, collection: str, limit: int = 1000
    ) -> list[dict]: ...

    @abstractmethod
    async def find_one(
        self, collection: str, doc_id: str
    ) -> Optional[dict]: ...

    @abstractmethod
    async def upsert_by_id(
        self, collection: str, doc_id: str, doc: dict
    ) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...
