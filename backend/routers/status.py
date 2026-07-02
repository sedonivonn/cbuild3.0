"""Legacy /api/status endpoints — preserved contract.

Backward-compatible with the original MongoDB-only implementation but now
routes through the DB provider abstraction so it works with Firestore too.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from config import settings
from db import get_db

router = APIRouter(tags=["status"])


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class StatusCheckCreate(BaseModel):
    client_name: str


@router.get("/")
async def root() -> dict:
    return {"message": "Hello World"}


@router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate) -> StatusCheck:
    obj = StatusCheck(**payload.model_dump())
    doc = obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await get_db().insert_one(settings.firestore_status_collection, doc)
    return obj


@router.get("/status", response_model=List[StatusCheck])
async def get_status_checks() -> List[StatusCheck]:
    docs = await get_db().find_many(
        settings.firestore_status_collection, limit=1000
    )
    for d in docs:
        ts = d.get("timestamp")
        if isinstance(ts, str):
            try:
                d["timestamp"] = datetime.fromisoformat(ts)
            except ValueError:
                pass
    return [StatusCheck(**d) for d in docs]
