"""Backend tests for the Online multiplayer feature.

Covers REST endpoints for /api/online/rooms/* and WS /api/online/ws/{code}.
Updated for iteration 22: pick_seconds field + ready-check flow.
"""
import asyncio
import json
import os
import re
import time
from urllib.parse import urlparse

import pytest
import requests
import websockets


def _mk_p(name, primary, sec=None, ovr=80):
    return {"name": name, "primary": primary, "secondary": sec or primary, "overall": ovr, "nationality": "N"}


def _legacy_pool():
    """A minimal legal pool (2 teams, 11 players each) for start_room()."""
    core = [
        _mk_p("GK", "GK"), _mk_p("LB", "LB"), _mk_p("CB1", "CB"), _mk_p("CB2", "CB"), _mk_p("RB", "RB"),
        _mk_p("CM1", "CM"), _mk_p("CM2", "CM"), _mk_p("CM3", "CM"),
        _mk_p("LW", "LW"), _mk_p("ST", "ST"), _mk_p("RW", "RW"),
    ]
    return [
        {"season": 2024, "team": {"club": "TEST_LEGACY_A", "country": "X", "crest": "", "players": [dict(p) for p in core]}},
        {"season": 2024, "team": {"club": "TEST_LEGACY_B", "country": "X", "crest": "", "players": [dict(p) for p in core]}},
    ]

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break

API = f"{BASE_URL}/api/online"


def _ws_base() -> str:
    p = urlparse(BASE_URL)
    scheme = "wss" if p.scheme == "https" else "ws"
    return f"{scheme}://{p.netloc}"


# ---------------------- Room creation ----------------------
class TestCreateRoom:
    def test_create_room_valid(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_host", "max_players": 4, "mode": "group", "pick_seconds": 30},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "room" in data and "you" in data
        room = data["room"]
        assert re.fullmatch(r"[A-Z0-9]{5,6}", room["code"]), room["code"]
        assert room["status"] == "lobby"
        assert room["max_players"] == 4
        assert room["mode"] == "group"
        assert room["pick_seconds"] == 30
        # duration_sec should be gone
        assert "duration_sec" not in room
        assert len(room["players"]) == 1
        assert room["players"][0]["is_host"] is True
        # Host is implicitly ready
        assert room["players"][0]["ready"] is True
        assert data["you"]["id"] == room["host_id"]

    def test_create_room_pick_seconds_15(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p15", "max_players": 4, "mode": "group", "pick_seconds": 15},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["room"]["pick_seconds"] == 15

    def test_create_room_pick_seconds_45(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p45", "max_players": 4, "mode": "league", "pick_seconds": 45},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["room"]["pick_seconds"] == 45

    def test_create_room_pick_seconds_invalid_90(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p90", "max_players": 4, "mode": "group", "pick_seconds": 90},
            timeout=10,
        )
        assert r.status_code == 422, r.text

    def test_create_room_pick_seconds_invalid_20(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p20", "max_players": 4, "mode": "group", "pick_seconds": 20},
            timeout=10,
        )
        assert r.status_code == 422

    def test_create_room_default_pick_seconds(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_defp", "max_players": 4, "mode": "group"},
            timeout=10,
        )
        assert r.status_code == 200
        # Default is 30
        assert r.json()["room"]["pick_seconds"] == 30

    def test_create_room_invalid_mode(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_bad", "max_players": 4, "mode": "battle"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_create_room_short_nickname(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "a", "max_players": 4, "mode": "group"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_create_room_invalid_max(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_h3", "max_players": 1, "mode": "group"},
            timeout=10,
        )
        assert r.status_code == 422
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_h4", "max_players": 9, "mode": "group"},
            timeout=10,
        )
        assert r.status_code == 422


# ---------------------- Get / 404 ----------------------
class TestGetRoom:
    def test_get_existing(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_get", "max_players": 3, "mode": "group"})
        code = r.json()["room"]["code"]
        g = requests.get(f"{API}/rooms/{code}")
        assert g.status_code == 200
        assert g.json()["room"]["code"] == code

    def test_get_unknown_404(self):
        r = requests.get(f"{API}/rooms/XXXXX")
        assert r.status_code == 404


# ---------------------- Join ----------------------
class TestJoinRoom:
    def _create(self, mx=4, mode="group"):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_host", "max_players": mx, "mode": mode})
        return r.json()["room"]["code"], r.json()["you"]

    def test_join_adds_player_not_ready(self):
        code, _ = self._create(mx=3)
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_bob"})
        assert j.status_code == 200
        room = j.json()["room"]
        assert len(room["players"]) == 2
        # Guest should NOT be ready by default
        guest = [p for p in room["players"] if p["nickname"] == "TEST_bob"][0]
        assert guest["ready"] is False

    def test_join_duplicate_nickname_suffixed(self):
        code, _ = self._create(mx=4)
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_host"})
        assert j.status_code == 200
        me = j.json()["you"]
        assert me["nickname"] == "TEST_host#2"

    def test_join_full_room_returns_409(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 2, "mode": "group"})
        code = r.json()["room"]["code"]
        j1 = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_a"})
        assert j1.status_code == 200
        j2 = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_b"})
        assert j2.status_code == 409

    def test_join_unknown_room_404(self):
        j = requests.post(f"{API}/rooms/ZZZZZ/join", json={"nickname": "TEST_x"})
        assert j.status_code == 404

    def test_join_started_room_returns_409(self):
        code, host = self._create(mx=4)
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_p2"})
        # Mark guest ready so start succeeds
        requests.post(f"{API}/rooms/{code}/ready", json={"player_id": j.json()["you"]["id"], "ready": True})
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host["id"], "pool": _legacy_pool()})
        assert s.status_code == 200
        j2 = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_late"})
        assert j2.status_code == 409


# ---------------------- Ready ----------------------
class TestReady:
    def _create_with_guest(self, mx=4):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": mx, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        guest_id = j.json()["you"]["id"]
        return code, host_id, guest_id

    def test_guest_ready_true(self):
        code, _, gid = self._create_with_guest()
        r = requests.post(f"{API}/rooms/{code}/ready", json={"player_id": gid, "ready": True})
        assert r.status_code == 200
        room = r.json()["room"]
        guest = [p for p in room["players"] if p["id"] == gid][0]
        assert guest["ready"] is True

    def test_guest_ready_toggle_off(self):
        code, _, gid = self._create_with_guest()
        requests.post(f"{API}/rooms/{code}/ready", json={"player_id": gid, "ready": True})
        r = requests.post(f"{API}/rooms/{code}/ready", json={"player_id": gid, "ready": False})
        assert r.status_code == 200
        guest = [p for p in r.json()["room"]["players"] if p["id"] == gid][0]
        assert guest["ready"] is False

    def test_host_cannot_be_unreadied(self):
        code, host_id, _ = self._create_with_guest()
        # Attempt to set host ready=false — should be forced to true by server.
        r = requests.post(f"{API}/rooms/{code}/ready", json={"player_id": host_id, "ready": False})
        assert r.status_code == 200
        host = [p for p in r.json()["room"]["players"] if p["id"] == host_id][0]
        assert host["ready"] is True

    def test_ready_unknown_player_404(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        rr = requests.post(f"{API}/rooms/{code}/ready", json={"player_id": "nope-id", "ready": True})
        assert rr.status_code == 404

    def test_ready_unknown_room_404(self):
        r = requests.post(f"{API}/rooms/ZZZZZ/ready", json={"player_id": "x", "ready": True})
        assert r.status_code == 404


# ---------------------- Start ----------------------
class TestStartRoom:
    def test_start_requires_host(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        guest_id = j.json()["you"]["id"]
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": guest_id})
        assert s.status_code == 403

    def test_start_needs_min_players(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host_id})
        assert s.status_code == 409

    def test_start_blocked_when_guest_not_ready(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host_id})
        assert s.status_code == 409
        assert "READY" in s.json().get("detail", "").upper()

    def test_start_success_after_all_ready(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        gid = j.json()["you"]["id"]
        # Mark guest ready
        requests.post(f"{API}/rooms/{code}/ready", json={"player_id": gid, "ready": True})
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host_id, "pool": _legacy_pool()})
        assert s.status_code == 200
        assert s.json()["room"]["status"] == "started"


# ---------------------- Leave ----------------------
class TestLeaveRoom:
    def test_guest_leave_removes_player(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        gid = j.json()["you"]["id"]
        d = requests.delete(f"{API}/rooms/{code}/players/{gid}")
        assert d.status_code == 200
        got = requests.get(f"{API}/rooms/{code}").json()["room"]
        assert all(p["id"] != gid for p in got["players"])
        assert got["status"] == "lobby"

    def test_host_leave_closes_room(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        d = requests.delete(f"{API}/rooms/{code}/players/{host_id}")
        assert d.status_code == 200
        assert d.json().get("closed") is True
        got = requests.get(f"{API}/rooms/{code}").json()["room"]
        assert got["status"] == "closed"


# ---------------------- WebSocket ----------------------
class TestWebSocket:
    def _create(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_wsh", "max_players": 4, "mode": "group"})
        return r.json()["room"]["code"], r.json()["you"]["id"]

    def test_ws_connect_initial_state(self):
        code, host_id = self._create()
        url = f"{_ws_base()}/api/online/ws/{code}?player_id={host_id}"

        async def run():
            async with websockets.connect(url) as ws:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                assert msg["type"] == "state"
                assert msg["room"]["code"] == code
        asyncio.run(run())

    def test_ws_broadcast_on_ready_toggle(self):
        code, host_id = self._create()
        # Add a guest first
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_wsg"})
        gid = j.json()["you"]["id"]
        url = f"{_ws_base()}/api/online/ws/{code}?player_id={host_id}"

        async def run():
            async with websockets.connect(url) as ws:
                # Drain existing state messages
                await asyncio.wait_for(ws.recv(), timeout=5)

                def do_ready():
                    return requests.post(
                        f"{API}/rooms/{code}/ready",
                        json={"player_id": gid, "ready": True},
                        timeout=5,
                    )
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, do_ready)

                deadline = time.time() + 5
                saw = False
                while time.time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=deadline - time.time())
                    except asyncio.TimeoutError:
                        break
                    msg = json.loads(raw)
                    if msg.get("type") == "state":
                        guest = [p for p in msg["room"]["players"] if p["id"] == gid]
                        if guest and guest[0]["ready"] is True:
                            saw = True
                            break
                assert saw, "WebSocket never broadcast the ready flip"
        asyncio.run(run())
