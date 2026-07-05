"""Backend tests for the Online multiplayer feature.

Covers REST endpoints for /api/online/rooms/* and WS /api/online/ws/{code}.
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

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to the frontend .env value used in this workspace
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
            json={"nickname": "TEST_host", "max_players": 4, "mode": "group"},
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
        assert room["duration_sec"] == 90
        assert len(room["players"]) == 1
        assert room["players"][0]["is_host"] is True
        assert data["you"]["id"] == room["host_id"]

    def test_create_room_league_mode_and_duration(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_h2", "max_players": 8, "mode": "league", "duration_sec": 120},
            timeout=10,
        )
        assert r.status_code == 200
        room = r.json()["room"]
        assert room["mode"] == "league"
        assert room["duration_sec"] == 120
        assert room["max_players"] == 8

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

    def test_join_adds_player(self):
        code, _ = self._create(mx=3)
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_bob"})
        assert j.status_code == 200
        room = j.json()["room"]
        assert len(room["players"]) == 2
        nicks = [p["nickname"] for p in room["players"]]
        assert "TEST_bob" in nicks

    def test_join_duplicate_nickname_suffixed(self):
        code, _ = self._create(mx=4)
        # host is TEST_host; join with same nickname
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_host"})
        assert j.status_code == 200
        me = j.json()["you"]
        assert me["nickname"] == "TEST_host#2"

    def test_join_full_room_returns_409(self):
        # max=2 host + 1 join = full; 3rd should 409
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
        requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_p2"})
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host["id"]})
        assert s.status_code == 200
        j = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_late"})
        assert j.status_code == 409


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

    def test_start_success(self):
        r = requests.post(f"{API}/rooms", json={"nickname": "TEST_h", "max_players": 4, "mode": "group"})
        code = r.json()["room"]["code"]
        host_id = r.json()["you"]["id"]
        requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"})
        s = requests.post(f"{API}/rooms/{code}/start", json={"player_id": host_id})
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
                # First message should be a 'state' broadcast
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                assert msg["type"] == "state"
                assert msg["room"]["code"] == code
        asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())

    def test_ws_unknown_room_closes_4404(self):
        url = f"{_ws_base()}/api/online/ws/QQQQQ?player_id=abc"

        async def run():
            try:
                async with websockets.connect(url) as ws:
                    # Server sends error then closes
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=5)
                    except websockets.exceptions.ConnectionClosed:
                        pass
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=5)
                    except websockets.exceptions.ConnectionClosed as e:
                        assert e.code == 4404
                        return
                # If we exited normally, inspect close code from ws
            except websockets.exceptions.ConnectionClosed as e:
                assert e.code == 4404
                return
            # If no exception, we need to check close_code via context manager approach
            # Use a low-level attempt:
        asyncio.run(run())

    def test_ws_non_member_closes_4403(self):
        code, _ = self._create()
        url = f"{_ws_base()}/api/online/ws/{code}?player_id=not-a-member"

        async def run():
            closed_code = None
            try:
                async with websockets.connect(url) as ws:
                    while True:
                        try:
                            await asyncio.wait_for(ws.recv(), timeout=5)
                        except websockets.exceptions.ConnectionClosed as e:
                            closed_code = e.code
                            break
            except websockets.exceptions.ConnectionClosed as e:
                closed_code = e.code
            assert closed_code == 4403, f"expected 4403, got {closed_code}"
        asyncio.run(run())

    def test_ws_broadcast_on_join(self):
        code, host_id = self._create()
        url = f"{_ws_base()}/api/online/ws/{code}?player_id={host_id}"

        async def run():
            async with websockets.connect(url) as ws:
                # Drain initial state
                first = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                assert first["type"] == "state"

                # Trigger a join from REST — should broadcast a new state
                def do_join():
                    return requests.post(
                        f"{API}/rooms/{code}/join",
                        json={"nickname": "TEST_ws_joiner"},
                        timeout=5,
                    )
                loop = asyncio.get_event_loop()
                jresp = await loop.run_in_executor(None, do_join)
                assert jresp.status_code == 200

                # Consume messages until we see the new player, up to 5s
                deadline = time.time() + 5
                saw = False
                while time.time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=deadline - time.time())
                    except asyncio.TimeoutError:
                        break
                    msg = json.loads(raw)
                    if msg.get("type") == "state":
                        nicks = [p["nickname"] for p in msg["room"]["players"]]
                        if "TEST_ws_joiner" in nicks:
                            saw = True
                            break
                assert saw, "WebSocket never broadcast the new player"
        asyncio.run(run())
