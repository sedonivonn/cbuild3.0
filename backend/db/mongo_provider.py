"""MongoDB (motor) provider."""
from __future__ import annotations

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient

from db.base import DBProvider

logger = logging.getLogger(__name__)


class MongoProvider(DBProvider):
    name = "mongo"

    def __init__(self, mongo_url: str, db_name: str):
        self._client = AsyncIOMotorClient(mongo_url)
        self._db = self._client[db_name]
        logger.info("MongoProvider ready (db=%s)", db_name)

    async def insert_one(self, collection: str, doc: dict) -> None:
        await self._db[collection].insert_one(doc)

    async def find_many(self, collection: str, limit: int = 1000) -> list[dict]:
        docs = await self._db[collection].find({}, {"_id": 0}).to_list(limit)
        return docs

    async def find_one(self, collection: str, doc_id: str) -> Optional[dict]:
        doc = await self._db[collection].find_one({"id": doc_id}, {"_id": 0})
        return doc

    async def upsert_by_id(self, collection: str, doc_id: str, doc: dict) -> None:
        await self._db[collection].update_one(
            {"id": doc_id}, {"$set": doc}, upsert=True
        )

    async def close(self) -> None:
        self._client.close()
