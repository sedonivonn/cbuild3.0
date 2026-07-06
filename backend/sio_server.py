"""Socket.IO server for real-time multiplayer.

Design:
- Single AsyncServer, exposed as an ASGI app that FastAPI mounts under
  `/api/socket.io` (Kubernetes ingress already routes /api/* -> port 8001).
- One Socket.IO "room" per game room code, so `sio.emit(event, data,
  room=code)` fans out to every client currently in that room.
- Clients call `join` with `{code, player_id}` right after connecting;
  the server verifies membership against MongoDB, marks the player as
  connected, joins them to the Socket.IO room and broadcasts the
  refreshed state. On disconnect the reverse happens.

Server -> Client events:
  - `state`   { room }             full room snapshot (game phase, players, drafts)
  - `error`   { message }          soft error (e.g. not-a-member on join)
  - `closed`  {}                   host closed the room

Client -> Server events:
  - `join`    { code, player_id }
  - `leave`   {}                   voluntary leave (rare — REST is preferred)
  - `ping`    {}                   keepalive; server replies with `pong`
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import socketio

logger = logging.getLogger(__name__)

# The `cors_allowed_origins='*'` is safe here because our REST layer already
# gates room membership; the socket only receives IDs the caller provided
# out-of-band.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_interval=25,
    ping_timeout=60,
    logger=False,
    engineio_logger=False,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Helpers — lazy Mongo access via the online router (single source of truth)
# ---------------------------------------------------------------------------
async def _get_room(code: str) -> Optional[Dict[str, Any]]:
    # Local import to avoid a circular dep at module import time.
    from routers.online import _get_room as get_room  # noqa: WPS433
    return await get_room(code)


async def _rooms():
    from routers.online import _rooms as rooms_col  # noqa: WPS433
    return rooms_col()


async def broadcast_state(code: str) -> Optional[Dict[str, Any]]:
    """Fetch fresh room state from Mongo and emit `state` to the room.

    This is the public API used by REST handlers whenever they mutate.
    """
    room = await _get_room(code)
    if not room:
        return None
    await sio.emit("state", {"room": room}, room=code)
    return room


async def broadcast_closed(code: str) -> None:
    await sio.emit("closed", {}, room=code)


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------
@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]] = None) -> None:  # noqa: D401
    """Accept the TCP connection; membership is verified on `join`."""
    logger.debug("sio connect sid=%s", sid)


@sio.event
async def disconnect(sid: str) -> None:  # noqa: D401
    """Flip the player's `connected` flag off and rebroadcast."""
    session = await sio.get_session(sid)
    code = session.get("code") if session else None
    player_id = session.get("player_id") if session else None
    if not code or not player_id:
        return
    col = await _rooms()
    await col.update_one(
        {"code": code, "players.id": player_id},
        {"$set": {"players.$.connected": False, "updated_at": _now_iso()}},
    )
    await broadcast_state(code)


@sio.event
async def join(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Client subscribes to a room's real-time feed.

    Returns an ack payload `{ok, room?}` — Socket.IO delivers it back to
    the sender via the callback. Broadcasts `state` to everyone.
    """
    code = str((data or {}).get("code", "")).upper()
    player_id = str((data or {}).get("player_id", ""))
    if not code or not player_id:
        return {"ok": False, "error": "code and player_id required"}

    room = await _get_room(code)
    if not room:
        await sio.emit("error", {"message": "Room not found"}, to=sid)
        return {"ok": False, "error": "room_not_found"}
    if not any(p["id"] == player_id for p in room.get("players", [])):
        await sio.emit("error", {"message": "Not a member"}, to=sid)
        return {"ok": False, "error": "not_a_member"}

    await sio.enter_room(sid, code)
    await sio.save_session(sid, {"code": code, "player_id": player_id})

    col = await _rooms()
    await col.update_one(
        {"code": code, "players.id": player_id},
        {"$set": {"players.$.connected": True, "updated_at": _now_iso()}},
    )
    room = await broadcast_state(code)
    return {"ok": True, "room": room}


@sio.event
async def leave(sid: str, _data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    session = await sio.get_session(sid)
    code = session.get("code") if session else None
    if code:
        await sio.leave_room(sid, code)
    return {"ok": True}


@sio.event
async def ping(sid: str, _data: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    return {"type": "pong"}


# ---------------------------------------------------------------------------
# ASGI wrapper — server.py mounts this at the app root
# ---------------------------------------------------------------------------
def make_asgi_app(other_asgi_app: Any) -> Any:
    return socketio.ASGIApp(
        socketio_server=sio,
        other_asgi_app=other_asgi_app,
        socketio_path="/api/socket.io",
    )
