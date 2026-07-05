"""Backend tests for the server-authoritative Online Draft (Phase 1).

Covers:
- POST /api/online/rooms with pick_seconds=60 accepted, 90 rejected.
- POST /api/online/rooms/{code}/start requiring a valid non-empty pool.
- Start transitions: room.status='started', game.phase='draft',
  per-player drafts with current_roll + deadline.
- /game/pick success + failure paths (409 for illegal picks).
- /game/change (normal and lucky) decrement counters and re-roll.
- Auto-transition to phase='draft_complete' when all players finish.
- /game/start_tournament host-only, only from draft_complete.
- Server-side auto-pick fires around the pick_seconds deadline (WS broadcast).
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from urllib.parse import urlparse

import pytest
import requests
import websockets

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


# ---------- helpers ----------
def _mk_player(name, primary, secondary=None, overall=80):
    return {
        "name": name,
        "primary": primary,
        "secondary": secondary or primary,
        "overall": overall,
        "nationality": "N",
    }


def _mk_team(club, players):
    return {"club": club, "country": "XX", "crest": "🏳", "players": players}


def _players_11():
    # A legal 11 for 4-3-3 formation: GK, LB, CB, CB, RB, CM, CM, CM, LW, ST, RW.
    return [
        _mk_player("A GK", "GK"),
        _mk_player("A LB", "LB"),
        _mk_player("A CB1", "CB"),
        _mk_player("A CB2", "CB"),
        _mk_player("A RB", "RB"),
        _mk_player("A CM1", "CM"),
        _mk_player("A CM2", "CM"),
        _mk_player("A CM3", "CM"),
        _mk_player("A LW", "LW"),
        _mk_player("A ST", "ST"),
        _mk_player("A RW", "RW"),
        _mk_player("A EXTRA", "CM"),
    ]


def _players_11_b():
    return [
        _mk_player("B GK", "GK"),
        _mk_player("B LB", "LB"),
        _mk_player("B CB1", "CB"),
        _mk_player("B CB2", "CB"),
        _mk_player("B RB", "RB"),
        _mk_player("B CM1", "CM"),
        _mk_player("B CM2", "CM"),
        _mk_player("B CM3", "CM"),
        _mk_player("B LW", "LW"),
        _mk_player("B ST", "ST"),
        _mk_player("B RW", "RW"),
        _mk_player("B EXTRA", "CM"),
    ]


def _small_pool():
    return [
        {"season": 2024, "team": _mk_team("TEST_A_FC", _players_11())},
        {"season": 2024, "team": _mk_team("TEST_B_FC", _players_11_b())},
    ]


def _create_ready_room(pick_seconds=30):
    """Create a room with host + 1 ready guest and return (code, host_id, guest_id)."""
    r = requests.post(
        f"{API}/rooms",
        json={"nickname": "TEST_ghost", "max_players": 4, "mode": "group",
              "pick_seconds": pick_seconds},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    code = r.json()["room"]["code"]
    host_id = r.json()["you"]["id"]
    j = requests.post(f"{API}/rooms/{code}/join",
                      json={"nickname": "TEST_gguest"}, timeout=10)
    assert j.status_code == 200
    gid = j.json()["you"]["id"]
    rr = requests.post(f"{API}/rooms/{code}/ready",
                       json={"player_id": gid, "ready": True}, timeout=10)
    assert rr.status_code == 200
    return code, host_id, gid


# ---------- pick_seconds=60 accepted ----------
class TestPickSeconds60:
    def test_create_room_pick_seconds_60_ok(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p60", "max_players": 4, "mode": "group", "pick_seconds": 60},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["room"]["pick_seconds"] == 60

    def test_create_room_pick_seconds_90_rejected(self):
        r = requests.post(
            f"{API}/rooms",
            json={"nickname": "TEST_p90", "max_players": 4, "mode": "group", "pick_seconds": 90},
            timeout=10,
        )
        assert r.status_code == 422


# ---------- Start requires valid pool ----------
class TestStartPoolValidation:
    def test_start_missing_pool_returns_400(self):
        code, host_id, _ = _create_ready_room()
        s = requests.post(f"{API}/rooms/{code}/start",
                          json={"player_id": host_id}, timeout=10)
        assert s.status_code == 400, s.text
        assert "pool" in s.json().get("detail", "").lower()

    def test_start_empty_pool_returns_400(self):
        code, host_id, _ = _create_ready_room()
        s = requests.post(f"{API}/rooms/{code}/start",
                          json={"player_id": host_id, "pool": []}, timeout=10)
        assert s.status_code == 400
        assert "non-empty" in s.json().get("detail", "").lower() or "pool" in s.json().get("detail", "").lower()

    def test_start_pool_too_few_players_returns_400(self):
        code, host_id, _ = _create_ready_room()
        bad_pool = [{"season": 2024, "team": _mk_team("BAD", [_mk_player("only", "GK")])}]
        s = requests.post(f"{API}/rooms/{code}/start",
                          json={"player_id": host_id, "pool": bad_pool}, timeout=10)
        assert s.status_code == 400

    def test_start_valid_pool_transitions_to_draft(self):
        code, host_id, gid = _create_ready_room(pick_seconds=45)
        s = requests.post(
            f"{API}/rooms/{code}/start",
            json={"player_id": host_id, "pool": _small_pool(),
                  "setup": {"formation_id": "4-3-3"}},
            timeout=10,
        )
        assert s.status_code == 200, s.text
        room = s.json()["room"]
        assert room["status"] == "started"
        assert room["game"]["phase"] == "draft"
        drafts = room["game"]["drafts"]
        assert host_id in drafts and gid in drafts
        for pid in (host_id, gid):
            d = drafts[pid]
            assert d["current_roll"] is not None
            assert d["current_roll"]["team"]["club"] in ("TEST_A_FC", "TEST_B_FC")
            assert d["deadline"]  # ISO string
            assert d["changes_remaining"] == 3
            assert d["lucky_remaining"] == 1
            assert d["complete"] is False
            assert len(d["xi"]) == 11
            assert all(x is None for x in d["xi"])


# ---------- Pick endpoint ----------
class TestGamePick:
    def _start(self, pick_seconds=30):
        code, host_id, gid = _create_ready_room(pick_seconds=pick_seconds)
        s = requests.post(
            f"{API}/rooms/{code}/start",
            json={"player_id": host_id, "pool": _small_pool(),
                  "setup": {"formation_id": "4-3-3"}},
            timeout=10,
        )
        assert s.status_code == 200
        return code, host_id, gid, s.json()["room"]

    def _fetch_draft(self, code, pid):
        r = requests.get(f"{API}/rooms/{code}", timeout=10)
        return r.json()["room"]["game"]["drafts"][pid]

    def test_pick_slot_out_of_range_returns_422(self):
        # slot_index has Field(ge=0, le=20). Try 99 -> pydantic rejects at 422.
        code, host_id, _, _ = self._start()
        r = requests.post(f"{API}/rooms/{code}/game/pick",
                          json={"player_id": host_id, "slot_index": 99,
                                "player_name": "X"}, timeout=10)
        assert r.status_code == 422

    def test_pick_invalid_player_returns_409(self):
        code, host_id, _, _ = self._start()
        r = requests.post(f"{API}/rooms/{code}/game/pick",
                          json={"player_id": host_id, "slot_index": 0,
                                "player_name": "Not-In-Pool"}, timeout=10)
        assert r.status_code == 409
        assert "player not in current pool" in r.json()["detail"].lower()

    def test_pick_wrong_position_returns_409(self):
        # Slot 0 is GK. Roll the current team. Try to pick a non-GK into slot 0.
        code, host_id, _, room = self._start()
        draft = room["game"]["drafts"][host_id]
        team_players = draft["current_roll"]["team"]["players"]
        # find a player whose primary is not GK
        non_gk = next(p for p in team_players if p["primary"] != "GK")
        r = requests.post(f"{API}/rooms/{code}/game/pick",
                          json={"player_id": host_id, "slot_index": 0,
                                "player_name": non_gk["name"]}, timeout=10)
        assert r.status_code == 409
        assert "cannot fill" in r.json()["detail"].lower()

    def test_pick_success_advances_roll_and_deadline(self):
        code, host_id, _, room = self._start(pick_seconds=45)
        d0 = room["game"]["drafts"][host_id]
        gk_name = next(p for p in d0["current_roll"]["team"]["players"]
                       if p["primary"] == "GK")["name"]
        deadline0 = d0["deadline"]
        r = requests.post(f"{API}/rooms/{code}/game/pick",
                          json={"player_id": host_id, "slot_index": 0,
                                "player_name": gk_name}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["phase"] == "draft"
        d1 = body["draft"]
        assert d1["xi"][0] is not None
        assert d1["xi"][0]["name"] == gk_name
        assert gk_name in d1["picked_names"]
        # New roll issued
        assert d1["current_roll"] is not None
        # Deadline refreshed to be later than the previous one
        assert d1["deadline"] and d1["deadline"] > deadline0

    def test_pick_duplicate_slot_returns_409(self):
        code, host_id, _, room = self._start()
        # First, pick a GK legally.
        d0 = room["game"]["drafts"][host_id]
        gk_name = next(p for p in d0["current_roll"]["team"]["players"]
                       if p["primary"] == "GK")["name"]
        r1 = requests.post(f"{API}/rooms/{code}/game/pick",
                           json={"player_id": host_id, "slot_index": 0,
                                 "player_name": gk_name}, timeout=10)
        assert r1.status_code == 200
        # Then try to pick a different player into the same slot 0 (already filled).
        # Fetch new roll to find another GK-eligible... but the slot itself is filled.
        d_new = self._fetch_draft(code, host_id)
        any_player = d_new["current_roll"]["team"]["players"][0]["name"]
        r2 = requests.post(f"{API}/rooms/{code}/game/pick",
                           json={"player_id": host_id, "slot_index": 0,
                                 "player_name": any_player}, timeout=10)
        assert r2.status_code == 409
        assert "slot already filled" in r2.json()["detail"].lower()


# ---------- Change endpoint ----------
class TestGameChange:
    def _start(self):
        code, host_id, gid = _create_ready_room()
        s = requests.post(
            f"{API}/rooms/{code}/start",
            json={"player_id": host_id, "pool": _small_pool(),
                  "setup": {"formation_id": "4-3-3"}},
            timeout=10,
        )
        assert s.status_code == 200
        return code, host_id, gid

    def test_change_decrements_changes(self):
        code, host_id, _ = self._start()
        r = requests.post(f"{API}/rooms/{code}/game/change",
                          json={"player_id": host_id, "lucky": False}, timeout=10)
        assert r.status_code == 200
        d = r.json()["draft"]
        assert d["changes_remaining"] == 2
        assert d["lucky_remaining"] == 1  # unchanged

    def test_lucky_change_decrements_both(self):
        code, host_id, _ = self._start()
        r = requests.post(f"{API}/rooms/{code}/game/change",
                          json={"player_id": host_id, "lucky": True}, timeout=10)
        assert r.status_code == 200
        d = r.json()["draft"]
        assert d["changes_remaining"] == 2
        assert d["lucky_remaining"] == 0

    def test_change_exhausted_returns_409(self):
        code, host_id, _ = self._start()
        for _ in range(3):
            requests.post(f"{API}/rooms/{code}/game/change",
                          json={"player_id": host_id, "lucky": False}, timeout=10)
        r = requests.post(f"{API}/rooms/{code}/game/change",
                         json={"player_id": host_id, "lucky": False}, timeout=10)
        assert r.status_code == 409


# ---------- Full draft flow -> draft_complete + start_tournament ----------
class TestFullDraftAndTournament:
    """Complete an 11-pick draft for both players and start tournament."""

    def _start(self):
        code, host_id, gid = _create_ready_room()
        s = requests.post(
            f"{API}/rooms/{code}/start",
            json={"player_id": host_id, "pool": _small_pool(),
                  "setup": {"formation_id": "4-3-3"}},
            timeout=10,
        )
        assert s.status_code == 200
        return code, host_id, gid

    def _fill_11(self, code, pid, max_attempts=60):
        # Slot->positions for 4-3-3: [GK, LB, CB, CB, RB, CM, CM, CM, LW, ST, RW]
        target_pos = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"]
        room = requests.get(f"{API}/rooms/{code}", timeout=10).json()["room"]
        draft = room["game"]["drafts"][pid]
        attempts = 0
        while not draft["complete"] and attempts < max_attempts:
            attempts += 1
            xi = draft["xi"]
            # Find first empty slot
            empty_idx = next((i for i, x in enumerate(xi) if x is None), None)
            if empty_idx is None:
                break
            needed_pos = target_pos[empty_idx]
            team_players = draft["current_roll"]["team"]["players"]
            picked = set(draft["picked_names"])
            match = next(
                (p for p in team_players
                 if p["name"] not in picked and (p["primary"] == needed_pos or p.get("secondary") == needed_pos)),
                None,
            )
            if match is None:
                # Reroll
                changes_left = draft["changes_remaining"]
                if changes_left <= 0:
                    # Fall back to any legal placement in first empty slot instead
                    # (auto_pick style). Try each empty slot with each pool player.
                    # Just try to place any player in any legal slot.
                    placed = False
                    for i, x in enumerate(xi):
                        if x is not None:
                            continue
                        for p in team_players:
                            if p["name"] in picked:
                                continue
                            # Any position mapping via can_place is complex;
                            # here we try if primary matches slot's target pos
                            if p["primary"] == target_pos[i] or p.get("secondary") == target_pos[i]:
                                r = requests.post(f"{API}/rooms/{code}/game/pick",
                                                  json={"player_id": pid, "slot_index": i,
                                                        "player_name": p["name"]}, timeout=10)
                                if r.status_code == 200:
                                    draft = r.json()["draft"]
                                    placed = True
                                    break
                        if placed:
                            break
                    if not placed:
                        # Wait for server auto-pick? Just break to avoid infinite loop.
                        break
                    continue
                cr = requests.post(f"{API}/rooms/{code}/game/change",
                                   json={"player_id": pid, "lucky": False}, timeout=10)
                if cr.status_code == 200:
                    draft = cr.json()["draft"]
                    continue
                break
            r = requests.post(f"{API}/rooms/{code}/game/pick",
                              json={"player_id": pid, "slot_index": empty_idx,
                                    "player_name": match["name"]}, timeout=10)
            if r.status_code == 200:
                draft = r.json()["draft"]
            else:
                # Advance the roll to try again
                cr = requests.post(f"{API}/rooms/{code}/game/change",
                                   json={"player_id": pid, "lucky": False}, timeout=10)
                if cr.status_code != 200:
                    break
                draft = cr.json()["draft"]
        return draft

    def test_full_flow_transitions_to_tournament(self):
        code, host_id, gid = self._start()
        # Complete drafts for both. Use a very tolerant pool that has all
        # needed positions in both teams.
        d_host = self._fill_11(code, host_id)
        d_guest = self._fill_11(code, gid)
        assert d_host["complete"] is True, f"host draft not complete: xi={d_host['xi']}"
        assert d_guest["complete"] is True, f"guest draft not complete: xi={d_guest['xi']}"

        # Room phase should now be draft_complete
        room = requests.get(f"{API}/rooms/{code}", timeout=10).json()["room"]
        assert room["game"]["phase"] == "draft_complete"

        # Guest cannot start the tournament
        r = requests.post(f"{API}/rooms/{code}/game/start_tournament",
                          json={"player_id": gid}, timeout=10)
        assert r.status_code == 403

        # Host starts tournament -> phase flips
        r = requests.post(f"{API}/rooms/{code}/game/start_tournament",
                          json={"player_id": host_id}, timeout=10)
        assert r.status_code == 200
        assert r.json()["room"]["game"]["phase"] == "tournament"

    def test_start_tournament_before_complete_returns_409(self):
        code, host_id, _ = self._start()
        r = requests.post(f"{API}/rooms/{code}/game/start_tournament",
                          json={"player_id": host_id}, timeout=10)
        assert r.status_code == 409


# ---------- Auto-pick timer ----------
class TestAutoPick:
    def test_auto_pick_fires_and_broadcasts(self):
        """With pick_seconds=15, start game and idle. Server must auto-pick
        within ~17s and broadcast a 'state' with an incremented auto_picks."""
        code, host_id, gid = _create_ready_room(pick_seconds=15)
        s = requests.post(
            f"{API}/rooms/{code}/start",
            json={"player_id": host_id, "pool": _small_pool(),
                  "setup": {"formation_id": "4-3-3"}},
            timeout=10,
        )
        assert s.status_code == 200

        url = f"{_ws_base()}/api/online/ws/{code}?player_id={host_id}"

        async def run():
            async with websockets.connect(url) as ws:
                # Drain initial state
                await asyncio.wait_for(ws.recv(), timeout=5)
                deadline = time.time() + 25
                saw_autopick = False
                while time.time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=deadline - time.time())
                    except asyncio.TimeoutError:
                        break
                    msg = json.loads(raw)
                    if msg.get("type") != "state":
                        continue
                    drafts = (msg.get("room", {}).get("game", {}) or {}).get("drafts", {})
                    host_draft = drafts.get(host_id)
                    if host_draft and host_draft.get("auto_picks", 0) >= 1:
                        # Ensure XI reflects the auto-pick too
                        assert any(x is not None for x in host_draft["xi"])
                        saw_autopick = True
                        break
                assert saw_autopick, "auto-pick broadcast never observed within 25s"
        asyncio.run(run())
