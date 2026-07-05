"""Online multiplayer room router.

Provides REST endpoints for room CRUD and a WebSocket endpoint for real-time
lobby state synchronization. Storage: MongoDB collection `online_rooms`.

Design notes:
- Rooms live in MongoDB so they survive backend restarts, but the *live*
  socket fan-out uses a small in-memory registry (`ConnectionManager`).
- Every mutation goes through `_update_and_broadcast` so REST callers and
  WS clients see identical state.
- Room code is a 5-char uppercase alphanumeric string, easy to type/share.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pydantic import BaseModel, Field, field_validator

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/online", tags=["online"])

# ---------------------------------------------------------------------------
# Mongo bootstrap (module-level — reused across requests / sockets)
# ---------------------------------------------------------------------------
_client: Optional[AsyncIOMotorClient] = None


def _rooms() -> AsyncIOMotorCollection:
    global _client
    if _client is None:
        if not settings.mongo_url:
            raise RuntimeError("MONGO_URL is not configured")
        _client = AsyncIOMotorClient(settings.mongo_url)
    db = _client[settings.db_name]
    return db["online_rooms"]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
GAME_MODES = {"group", "league"}
PICK_SECONDS_OPTIONS = {15, 30, 45}
MIN_PLAYERS = 2
MAX_PLAYERS = 8
NICKNAME_MIN = 2
NICKNAME_MAX = 16
CODE_ALPHABET = string.ascii_uppercase + string.digits  # excludes lowercase


class CreateRoomBody(BaseModel):
    nickname: str = Field(..., min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)
    max_players: int = Field(..., ge=MIN_PLAYERS, le=MAX_PLAYERS)
    mode: str = Field(..., description="group | league")
    pick_seconds: int = Field(default=30, description="Per-pick timer: 15|30|45")

    @field_validator("mode")
    @classmethod
    def _mode_ok(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in GAME_MODES:
            raise ValueError("mode must be one of: group, league")
        return v

    @field_validator("pick_seconds")
    @classmethod
    def _pick_ok(cls, v: int) -> int:
        if v not in PICK_SECONDS_OPTIONS:
            raise ValueError("pick_seconds must be one of: 15, 30, 45")
        return v

    @field_validator("nickname")
    @classmethod
    def _nick_clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("nickname required")
        return v


class JoinRoomBody(BaseModel):
    nickname: str = Field(..., min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)

    @field_validator("nickname")
    @classmethod
    def _nick_clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("nickname required")
        return v


class PlayerSlot(BaseModel):
    id: str
    nickname: str
    is_host: bool = False
    connected: bool = True
    ready: bool = False
    joined_at: str


class RoomState(BaseModel):
    code: str
    status: str  # lobby | started | closed
    host_id: str
    max_players: int
    mode: str
    pick_seconds: int
    players: List[PlayerSlot]
    created_at: str
    updated_at: str
    started_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_code(length: int = 5) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip mongo _id and normalize into a JSON-safe dict."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


async def _get_room(code: str) -> Optional[Dict[str, Any]]:
    doc = await _rooms().find_one({"code": code.upper()})
    return _serialize(doc) if doc else None


async def _find_unique_code() -> str:
    """Generate a code that doesn't yet exist. 5 alphanumeric = 60M options."""
    for _ in range(12):
        c = _gen_code(5)
        if not await _rooms().find_one({"code": c}, projection={"_id": 1}):
            return c
    # extremely unlikely: expand length
    return _gen_code(6)


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Tracks live WebSocket clients per room code.

    Kept in-process (single-worker deployment). For multi-worker scaling swap
    with Redis pub/sub — the API surface below is small enough to make that
    change trivial.
    """

    def __init__(self) -> None:
        # code -> { player_id -> websocket }
        self._rooms: Dict[str, Dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, code: str, player_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms.setdefault(code, {})[player_id] = ws

    async def disconnect(self, code: str, player_id: str) -> None:
        async with self._lock:
            bucket = self._rooms.get(code)
            if bucket and player_id in bucket:
                bucket.pop(player_id, None)
                if not bucket:
                    self._rooms.pop(code, None)

    async def broadcast(self, code: str, payload: Dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._rooms.get(code, {}).items())
        dead: List[str] = []
        for pid, ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:  # pragma: no cover - network flakiness
                dead.append(pid)
        for pid in dead:
            await self.disconnect(code, pid)


manager = ConnectionManager()


async def _broadcast_state(code: str) -> Optional[Dict[str, Any]]:
    room = await _get_room(code)
    if not room:
        return None
    await manager.broadcast(code, {"type": "state", "room": room})
    return room


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
@router.post("/rooms")
async def create_room(body: CreateRoomBody) -> Dict[str, Any]:
    """Create a new lobby. The caller becomes the host."""
    code = await _find_unique_code()
    host_id = secrets.token_urlsafe(9)
    now = _now_iso()
    host_slot = {
        "id": host_id,
        "nickname": body.nickname,
        "is_host": True,
        "connected": False,  # flips true when WS connects
        "ready": True,       # host is implicitly ready
        "joined_at": now,
    }
    room = {
        "code": code,
        "status": "lobby",
        "host_id": host_id,
        "max_players": body.max_players,
        "mode": body.mode,
        "pick_seconds": body.pick_seconds,
        "players": [host_slot],
        "created_at": now,
        "updated_at": now,
        "started_at": None,
    }
    await _rooms().insert_one(dict(room))
    return {"room": _serialize(room), "you": host_slot}


@router.get("/rooms/{code}")
async def get_room(code: str) -> Dict[str, Any]:
    room = await _get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": room}


@router.post("/rooms/{code}/join")
async def join_room(code: str, body: JoinRoomBody) -> Dict[str, Any]:
    """Add a new player to the room. Rejects when full or already started."""
    code = code.upper()
    room = await _get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["status"] != "lobby":
        raise HTTPException(status_code=409, detail="Room already started")
    if len(room["players"]) >= room["max_players"]:
        raise HTTPException(status_code=409, detail="Room is full")

    # allow same nickname only if suffix-unique — keep simple, dedupe with #n
    existing_nicks = {p["nickname"].lower() for p in room["players"]}
    nick = body.nickname
    if nick.lower() in existing_nicks:
        i = 2
        while f"{nick}#{i}".lower() in existing_nicks:
            i += 1
        nick = f"{nick}#{i}"

    pid = secrets.token_urlsafe(9)
    slot = {
        "id": pid,
        "nickname": nick,
        "is_host": False,
        "connected": False,
        "ready": False,
        "joined_at": _now_iso(),
    }

    result = await _rooms().find_one_and_update(
        {"code": code, "status": "lobby",
         "$expr": {"$lt": [{"$size": "$players"}, "$max_players"]}},
        {"$push": {"players": slot}, "$set": {"updated_at": _now_iso()}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=409, detail="Room is full or closed")

    await _broadcast_state(code)
    return {"room": _serialize(result), "you": slot}


class StartRoomBody(BaseModel):
    player_id: str


class ReadyBody(BaseModel):
    player_id: str
    ready: bool = True


@router.post("/rooms/{code}/ready")
async def set_ready(code: str, body: ReadyBody) -> Dict[str, Any]:
    """Toggle a player's ready flag. Host is always ready and cannot un-ready."""
    code = code.upper()
    room = await _get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["status"] != "lobby":
        raise HTTPException(status_code=409, detail="Room already started")
    if not any(p["id"] == body.player_id for p in room["players"]):
        raise HTTPException(status_code=404, detail="Player not in room")
    # Host is force-ready.
    ready = True if body.player_id == room["host_id"] else bool(body.ready)
    await _rooms().update_one(
        {"code": code, "players.id": body.player_id},
        {"$set": {"players.$.ready": ready, "updated_at": _now_iso()}},
    )
    room = await _broadcast_state(code)
    return {"room": room}


@router.post("/rooms/{code}/start")
async def start_room(code: str, body: StartRoomBody) -> Dict[str, Any]:
    code = code.upper()
    room = await _get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != body.player_id:
        raise HTTPException(status_code=403, detail="Only the host can start")
    if room["status"] != "lobby":
        raise HTTPException(status_code=409, detail="Room already started")
    if len(room["players"]) < MIN_PLAYERS:
        raise HTTPException(status_code=409, detail="Need at least 2 players")
    if not all(p.get("ready") for p in room["players"]):
        raise HTTPException(
            status_code=409,
            detail="All players must be READY before starting",
        )

    now = _now_iso()
    await _rooms().update_one(
        {"code": code},
        {"$set": {"status": "started", "started_at": now, "updated_at": now}},
    )
    room = await _broadcast_state(code)
    return {"room": room}


@router.delete("/rooms/{code}/players/{player_id}")
async def leave_room(code: str, player_id: str) -> Dict[str, Any]:
    """Explicit leave. Also called implicitly on WS disconnect for guests."""
    code = code.upper()
    room = await _get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # If host leaves the lobby, close the whole room.
    if player_id == room["host_id"] and room["status"] == "lobby":
        await _rooms().update_one(
            {"code": code},
            {"$set": {"status": "closed", "updated_at": _now_iso()}},
        )
        await manager.broadcast(code, {"type": "closed"})
        return {"closed": True}

    await _rooms().update_one(
        {"code": code},
        {"$pull": {"players": {"id": player_id}},
         "$set": {"updated_at": _now_iso()}},
    )
    await _broadcast_state(code)
    return {"left": True}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@router.websocket("/ws/{code}")
async def ws_room(websocket: WebSocket, code: str, player_id: str) -> None:
    """Live lobby feed. Query params: `player_id`.

    On connect: marks the player as connected and pushes the current state.
    On disconnect: marks the player as disconnected (does NOT auto-remove
    them so page-refresh reconnects work; host must explicitly leave).
    Incoming client messages: `{ "type": "ping" }` for keepalive.
    """
    code = code.upper()
    await websocket.accept()
    room = await _get_room(code)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close(code=4404)
        return
    if not any(p["id"] == player_id for p in room["players"]):
        await websocket.send_json({"type": "error", "message": "Not a member"})
        await websocket.close(code=4403)
        return

    await manager.connect(code, player_id, websocket)
    await _rooms().update_one(
        {"code": code, "players.id": player_id},
        {"$set": {"players.$.connected": True, "updated_at": _now_iso()}},
    )
    await _broadcast_state(code)

    try:
        while True:
            msg = await websocket.receive_json()
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:  # pragma: no cover
        logger.warning("WS error in room %s: %s", code, e)
    finally:
        await manager.disconnect(code, player_id)
        await _rooms().update_one(
            {"code": code, "players.id": player_id},
            {"$set": {"players.$.connected": False, "updated_at": _now_iso()}},
        )
        await _broadcast_state(code)
