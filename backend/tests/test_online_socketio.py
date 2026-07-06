"""Socket.IO transport migration tests (iteration 24).

Covers:
- Old raw WebSocket endpoint removal
- Socket.IO handshake availability
- join event acks (success/not_a_member/room_not_found)
- REST -> `state` broadcast
- Host leave -> `closed` broadcast
- `ping` custom event -> `pong` ack
- Disconnect flips `connected: false` and broadcasts state
- REST regression: existing endpoints still work
"""
from __future__ import annotations

import asyncio
import os
import sys
import pytest
import requests
import socketio

# Ensure /app/backend is importable if the test is run outside pytest.ini's rootdir.
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env (test env may only have that)
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"
SIO_PATH = "/api/socket.io"


# --------------------------------------------------------------------- helpers
def _pool():
    """Minimal valid pool: 2 teams x 11 players covering GK/DEF/MID/FWD roles."""
    teams = []
    for t in range(2):
        players = []
        for i in range(11):
            if i == 0:
                pos = "GK"
            elif i < 5:
                pos = "DEF"
            elif i < 9:
                pos = "MID"
            else:
                pos = "FWD"
            players.append({"name": f"T{t}P{i}", "primary": pos, "secondary": []})
        teams.append({"name": f"Team{t}", "players": players})
    return teams


def _create_room(nick="TEST_sio_host", max_players=2, pick_seconds=30):
    r = requests.post(
        f"{API}/online/rooms",
        json={"nickname": nick, "max_players": max_players, "mode": "group", "pick_seconds": pick_seconds},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _join_rest(code, nick="TEST_sio_guest"):
    r = requests.post(f"{API}/online/rooms/{code}/join", json={"nickname": nick}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


async def _new_client():
    sio = socketio.AsyncClient(logger=False, engineio_logger=False, reconnection=False)
    await sio.connect(BASE_URL, socketio_path=SIO_PATH, transports=["websocket"], wait_timeout=10)
    return sio


# ============================================================ transport basics
class TestTransport:
    def test_old_ws_endpoint_removed(self):
        # Simple GET (no upgrade) — the old route should not exist.
        r = requests.get(f"{API}/online/ws/ABCDE", timeout=10)
        assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}"

    def test_handshake_ok(self):
        r = requests.get(f"{BASE_URL}{SIO_PATH}/?EIO=4&transport=polling", timeout=10)
        assert r.status_code == 200
        # engine.io opens with a "0" then JSON with sid/upgrades
        assert r.text.startswith("0{")
        assert '"sid"' in r.text
        assert '"upgrades"' in r.text


# ================================================================= join event
class TestJoin:
    @pytest.mark.asyncio
    async def test_join_success(self):
        created = _create_room("TEST_sio_ok_host")
        code = created["room"]["code"]
        pid = created["you"]["id"]
        sio = await _new_client()
        try:
            ack = await sio.call("join", {"code": code, "player_id": pid}, timeout=10)
            assert isinstance(ack, dict)
            assert ack.get("ok") is True
            assert ack["room"]["code"] == code
        finally:
            await sio.disconnect()

    @pytest.mark.asyncio
    async def test_join_not_a_member(self):
        created = _create_room("TEST_sio_notmem_host")
        code = created["room"]["code"]
        sio = await _new_client()
        err_msgs = []
        sio.on("error", lambda p: err_msgs.append(p))
        try:
            ack = await sio.call("join", {"code": code, "player_id": "ghost_player_id"}, timeout=10)
            assert ack.get("ok") is False
            assert ack.get("error") == "not_a_member"
            # Give the server a beat to emit the error event
            await asyncio.sleep(0.3)
            assert any("member" in (m.get("message", "").lower()) for m in err_msgs), err_msgs
        finally:
            await sio.disconnect()

    @pytest.mark.asyncio
    async def test_join_room_not_found(self):
        sio = await _new_client()
        try:
            ack = await sio.call("join", {"code": "ZZZZZ", "player_id": "x"}, timeout=10)
            assert ack.get("ok") is False
            assert ack.get("error") == "room_not_found"
        finally:
            await sio.disconnect()


# ======================================================== state broadcast fanout
class TestBroadcast:
    @pytest.mark.asyncio
    async def test_rest_join_triggers_state(self):
        created = _create_room("TEST_sio_bc_host")
        code = created["room"]["code"]
        pid = created["you"]["id"]

        sio = await _new_client()
        states = []
        sio.on("state", lambda p: states.append(p))
        try:
            ack = await sio.call("join", {"code": code, "player_id": pid}, timeout=10)
            assert ack["ok"]
            states.clear()  # ignore the initial post-join broadcast
            # REST mutation: a second player joins
            _join_rest(code, "TEST_sio_bc_guest")
            # wait for broadcast
            for _ in range(20):
                await asyncio.sleep(0.1)
                if states:
                    break
            assert states, "no state event received after REST join"
            room = states[-1]["room"]
            assert len(room["players"]) == 2
        finally:
            await sio.disconnect()

    @pytest.mark.asyncio
    async def test_rest_ready_triggers_state(self):
        created = _create_room("TEST_sio_ready_host", max_players=3)
        code = created["room"]["code"]
        pid_host = created["you"]["id"]
        joined = _join_rest(code, "TEST_sio_ready_guest")
        pid_guest = joined["you"]["id"]

        sio = await _new_client()
        states = []
        sio.on("state", lambda p: states.append(p))
        try:
            ack = await sio.call("join", {"code": code, "player_id": pid_host}, timeout=10)
            assert ack["ok"]
            states.clear()
            requests.post(f"{API}/online/rooms/{code}/ready",
                          json={"player_id": pid_guest, "ready": True}, timeout=10)
            for _ in range(20):
                await asyncio.sleep(0.1)
                if states:
                    break
            assert states, "no state event received after ready toggle"
            room = states[-1]["room"]
            guest_slot = next(p for p in room["players"] if p["id"] == pid_guest)
            assert guest_slot["ready"] is True
        finally:
            await sio.disconnect()

    @pytest.mark.asyncio
    async def test_host_delete_broadcasts_closed(self):
        created = _create_room("TEST_sio_close_host")
        code = created["room"]["code"]
        pid = created["you"]["id"]
        sio = await _new_client()
        closed_evts = []
        sio.on("closed", lambda p=None: closed_evts.append(p or {}))
        try:
            ack = await sio.call("join", {"code": code, "player_id": pid}, timeout=10)
            assert ack["ok"]
            r = requests.delete(f"{API}/online/rooms/{code}/players/{pid}", timeout=10)
            assert r.status_code == 200
            assert r.json().get("closed") is True
            for _ in range(20):
                await asyncio.sleep(0.1)
                if closed_evts:
                    break
            assert closed_evts, "no closed event received"
        finally:
            await sio.disconnect()


# ================================================================== ping/pong
class TestPing:
    @pytest.mark.asyncio
    async def test_ping_pong(self):
        sio = await _new_client()
        try:
            ack = await sio.call("ping", {}, timeout=10)
            assert isinstance(ack, dict)
            assert ack.get("type") == "pong"
        finally:
            await sio.disconnect()


# ============================================================ disconnect flip
class TestDisconnect:
    @pytest.mark.asyncio
    async def test_disconnect_flips_connected(self):
        created = _create_room("TEST_sio_dc_host", max_players=3)
        code = created["room"]["code"]
        pid_host = created["you"]["id"]
        joined = _join_rest(code, "TEST_sio_dc_guest")
        pid_guest = joined["you"]["id"]

        # Observer socket stays connected to receive state after guest disconnects.
        observer = await _new_client()
        states = []
        observer.on("state", lambda p: states.append(p))
        await observer.call("join", {"code": code, "player_id": pid_host}, timeout=10)

        # Guest socket connects, joins (flipping connected=True), then disconnects.
        guest = await _new_client()
        ack = await guest.call("join", {"code": code, "player_id": pid_guest}, timeout=10)
        assert ack["ok"]
        # Confirm connected is True after join
        r = requests.get(f"{API}/online/rooms/{code}", timeout=10)
        guest_slot = next(p for p in r.json()["room"]["players"] if p["id"] == pid_guest)
        assert guest_slot["connected"] is True

        states.clear()
        await guest.disconnect()
        # Wait for the state broadcast triggered by disconnect handler
        for _ in range(30):
            await asyncio.sleep(0.1)
            if states:
                break

        await observer.disconnect()

        # Verify from REST that the guest's connected flipped to False
        r = requests.get(f"{API}/online/rooms/{code}", timeout=10)
        guest_slot = next(p for p in r.json()["room"]["players"] if p["id"] == pid_guest)
        assert guest_slot["connected"] is False, "guest.connected did not flip to False after disconnect"
        # And we should have received at least one broadcast from that transition
        assert states, "no state broadcast received on disconnect"


# ============================================================== REST regression
class TestRestRegression:
    def test_full_rest_flow_still_works(self):
        # POST /rooms
        created = _create_room("TEST_reg_host", max_players=2, pick_seconds=15)
        code = created["room"]["code"]
        pid_host = created["you"]["id"]

        # GET /rooms/{code}
        r = requests.get(f"{API}/online/rooms/{code}", timeout=10)
        assert r.status_code == 200
        assert r.json()["room"]["code"] == code

        # /join
        joined = _join_rest(code, "TEST_reg_guest")
        pid_guest = joined["you"]["id"]

        # /ready
        r = requests.post(f"{API}/online/rooms/{code}/ready",
                          json={"player_id": pid_guest, "ready": True}, timeout=10)
        assert r.status_code == 200

        # /start
        r = requests.post(f"{API}/online/rooms/{code}/start",
                          json={"player_id": pid_host, "pool": _pool(), "setup": {}}, timeout=15)
        assert r.status_code == 200, r.text
        room = r.json()["room"]
        assert room["status"] == "started"
        assert room["game"]["phase"] == "draft"

        # /game/pick — pick any valid GK from the current roll for host
        draft = room["game"]["drafts"][pid_host]
        current_team = draft["current_roll"]
        pool_team = next(t for t in room["game"]["pool"] if t["name"] == current_team)
        gk = next(p for p in pool_team["players"] if p["primary"] == "GK")
        r = requests.post(f"{API}/online/rooms/{code}/game/pick",
                          json={"player_id": pid_host, "slot_index": 0,
                                "player_name": gk["name"]}, timeout=10)
        assert r.status_code == 200, r.text

        # /game/change — use a lucky change
        r = requests.post(f"{API}/online/rooms/{code}/game/change",
                          json={"player_id": pid_host, "lucky": True}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["draft"]["changes_remaining"] == 2
        assert r.json()["draft"]["lucky_remaining"] == 0

        # DELETE guest — non-host leaving is allowed and does not close the room
        r = requests.delete(f"{API}/online/rooms/{code}/players/{pid_guest}", timeout=10)
        assert r.status_code == 200
        assert r.json().get("left") is True
