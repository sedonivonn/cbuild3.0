"""Server-authoritative draft engine for Online Multiplayer.

Design principles:
- Server holds the ONLY source of truth for the pool, dice rolls, timers,
  picks and validation.
- The client uploads the team pool ONCE (when the host starts the game).
  The client copies its own JS pool verbatim. From that moment forward the
  server rolls its own dice on this frozen snapshot — clients cannot inject
  arbitrary players.
- Draft is parallelized per player: every player has their own current roll,
  their own countdown, their own 3 changes. This mirrors the existing
  single-player flow and gives all players an even start.
- Timers use asyncio tasks. When a task fires past the deadline, the server
  autopicks a legal player at random into a legal slot. Manual pick /
  change / auto-pick all cancel the previous timer and schedule the next.

State lives on the room document in Mongo (`online_rooms.game`).
Broadcasting to WS clients is done by the caller (see `online.py`).
"""
from __future__ import annotations

import asyncio
import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Formation registry (mirrors /app/frontend/src/data/formations.js).
# Slot order MUST match the JS slots array so that the client can map
# indices 1:1 for rendering.
# ---------------------------------------------------------------------------
FORMATIONS: Dict[str, List[Dict[str, str]]] = {
    "4-3-3": [
        {"id": "GK",  "pos": "GK"},
        {"id": "LB",  "pos": "LB"},
        {"id": "LCB", "pos": "CB"},
        {"id": "RCB", "pos": "CB"},
        {"id": "RB",  "pos": "RB"},
        {"id": "LCM", "pos": "CM"},
        {"id": "CM",  "pos": "CM"},
        {"id": "RCM", "pos": "CM"},
        {"id": "LW",  "pos": "LW"},
        {"id": "ST",  "pos": "ST"},
        {"id": "RW",  "pos": "RW"},
    ],
    "4-2-3-1": [
        {"id": "GK",  "pos": "GK"},
        {"id": "LB",  "pos": "LB"}, {"id": "LCB", "pos": "CB"},
        {"id": "RCB", "pos": "CB"}, {"id": "RB",  "pos": "RB"},
        {"id": "LDM", "pos": "CDM"}, {"id": "RDM", "pos": "CDM"},
        {"id": "CAM", "pos": "CAM"},
        {"id": "LM",  "pos": "LW"}, {"id": "RM",  "pos": "RW"},
        {"id": "ST",  "pos": "ST"},
    ],
    "4-4-2": [
        {"id": "GK", "pos": "GK"},
        {"id": "LB", "pos": "LB"}, {"id": "LCB", "pos": "CB"},
        {"id": "RCB", "pos": "CB"}, {"id": "RB", "pos": "RB"},
        {"id": "LM", "pos": "LM"}, {"id": "LCM", "pos": "CM"},
        {"id": "RCM", "pos": "CM"}, {"id": "RM", "pos": "RM"},
        {"id": "LST", "pos": "ST"}, {"id": "RST", "pos": "ST"},
    ],
    "3-5-2": [
        {"id": "GK", "pos": "GK"},
        {"id": "LCB", "pos": "CB"}, {"id": "CCB", "pos": "CB"}, {"id": "RCB", "pos": "CB"},
        {"id": "LWB", "pos": "LB"}, {"id": "LCM", "pos": "CM"},
        {"id": "CM", "pos": "CDM"}, {"id": "RCM", "pos": "CM"},
        {"id": "RWB", "pos": "RB"},
        {"id": "LST", "pos": "ST"}, {"id": "RST", "pos": "ST"},
    ],
    "5-3-2": [
        {"id": "GK", "pos": "GK"},
        {"id": "LWB", "pos": "LB"}, {"id": "LCB", "pos": "CB"},
        {"id": "CCB", "pos": "CB"}, {"id": "RCB", "pos": "CB"},
        {"id": "RWB", "pos": "RB"},
        {"id": "LCM", "pos": "CM"}, {"id": "CM", "pos": "CDM"},
        {"id": "RCM", "pos": "CM"},
        {"id": "LST", "pos": "ST"}, {"id": "RST", "pos": "ST"},
    ],
    "4-2-4": [
        {"id": "GK", "pos": "GK"},
        {"id": "LB", "pos": "LB"}, {"id": "LCB", "pos": "CB"},
        {"id": "RCB", "pos": "CB"}, {"id": "RB", "pos": "RB"},
        {"id": "LCM", "pos": "CM"}, {"id": "RCM", "pos": "CM"},
        {"id": "LW", "pos": "LW"}, {"id": "LST", "pos": "ST"},
        {"id": "RST", "pos": "ST"}, {"id": "RW", "pos": "RW"},
    ],
    "4-5-1": [
        {"id": "GK", "pos": "GK"},
        {"id": "LB", "pos": "LB"}, {"id": "LCB", "pos": "CB"},
        {"id": "RCB", "pos": "CB"}, {"id": "RB", "pos": "RB"},
        {"id": "LM", "pos": "LM"}, {"id": "LCM", "pos": "CM"},
        {"id": "CM", "pos": "CDM"}, {"id": "RCM", "pos": "CM"},
        {"id": "RM", "pos": "RM"}, {"id": "ST", "pos": "ST"},
    ],
    "3-4-3": [
        {"id": "GK", "pos": "GK"},
        {"id": "LCB", "pos": "CB"}, {"id": "CCB", "pos": "CB"}, {"id": "RCB", "pos": "CB"},
        {"id": "LM", "pos": "LM"}, {"id": "LCM", "pos": "CM"},
        {"id": "RCM", "pos": "CM"}, {"id": "RM", "pos": "RM"},
        {"id": "LW", "pos": "LW"}, {"id": "ST", "pos": "ST"}, {"id": "RW", "pos": "RW"},
    ],
}

# Position compatibility (mirrors formations.js FAMILY table). Used by
# `can_place()` to accept "close enough" positions without penalty rules;
# for MP we only care about legality, not the OVR penalty (that's tallied
# later during simulation).
_FAMILY: Dict[str, List[str]] = {
    "GK": ["GK"],
    "LB": ["LB", "LWB", "LM", "CB"],
    "RB": ["RB", "RWB", "RM", "CB"],
    "LWB": ["LWB", "LB", "LM"],
    "RWB": ["RWB", "RB", "RM"],
    "CB": ["CB", "CDM"],
    "CDM": ["CDM", "CM", "CB"],
    "CM": ["CM", "CDM", "CAM"],
    "CAM": ["CAM", "CM", "CF"],
    "LM": ["LM", "LW", "LB"],
    "RM": ["RM", "RW", "RB"],
    "LW": ["LW", "LM", "ST", "CAM"],
    "RW": ["RW", "RM", "ST", "CAM"],
    "ST": ["ST", "CF", "LW", "RW"],
    "CF": ["CF", "ST", "CAM"],
}
_WING_GROUP = {"LW", "RW", "LM", "RM"}
_WING_MIRROR = {"LW": "RW", "RW": "LW", "LM": "RM", "RM": "LM"}


def can_place(slot_pos: str, player: Dict[str, Any]) -> bool:
    """Return True iff `player` can legally occupy a slot with the given pos.

    Mirrors `canPlace()` in frontend/formations.js.
    """
    if not player:
        return False
    primary = (player.get("primary") or "").upper()
    secondary = (player.get("secondary") or "").upper()
    if slot_pos in (primary, secondary):
        return True
    if slot_pos in _WING_GROUP and (primary in _WING_GROUP or secondary in _WING_GROUP):
        return True
    if slot_pos == _WING_MIRROR.get(primary):
        return True
    if slot_pos == _WING_MIRROR.get(secondary):
        return True
    return False


def has_available_slot(formation_id: str, xi: List[Optional[Dict[str, Any]]], player: Dict[str, Any]) -> bool:
    slots = FORMATIONS.get(formation_id, [])
    for idx, slot in enumerate(slots):
        if xi[idx] is None and can_place(slot["pos"], player):
            return True
    return False


# ---------------------------------------------------------------------------
# Pool utilities
# ---------------------------------------------------------------------------
STRONG_TEAM_KEYS = {
    "2009-Barcelona", "2011-Barcelona", "2015-Barcelona",
    "2008-Manchester United", "1999-Manchester United",
    "2003-AC Milan", "2007-AC Milan", "2005-AC Milan",
    "2014-Real Madrid", "2016-Real Madrid", "2017-Real Madrid",
    "2018-Real Madrid", "2022-Real Madrid", "2024-Real Madrid",
    "2013-Bayern Munich", "2020-Bayern Munich", "2010-Inter",
    "2019-Liverpool", "2002-Real Madrid", "2003-Juventus",
    "2025-Paris Saint-Germain", "2023-Manchester City", "2018-Liverpool",
}


def validate_pool(raw: Any) -> List[Dict[str, Any]]:
    """Validate & normalize an uploaded pool.

    Accepts the pool as a flat list of `{season:int, team:{club, country,
    crest, players:[{name, primary, secondary, overall, nationality?}]}}`.
    Raises ValueError with a friendly message if malformed.
    """
    if not isinstance(raw, list) or len(raw) == 0:
        raise ValueError("pool must be a non-empty list")
    out: List[Dict[str, Any]] = []
    for i, entry in enumerate(raw):
        if not isinstance(entry, dict):
            raise ValueError(f"pool[{i}] is not an object")
        season = entry.get("season")
        team = entry.get("team")
        if not isinstance(season, int):
            raise ValueError(f"pool[{i}].season must be int")
        if not isinstance(team, dict):
            raise ValueError(f"pool[{i}].team must be object")
        players = team.get("players")
        if not isinstance(players, list) or len(players) < 11:
            raise ValueError(f"pool[{i}].team.players must have >= 11 entries")
        # sanitize player dicts: strip unknown keys, coerce types
        clean_players = []
        for p in players:
            clean_players.append({
                "name": str(p.get("name", ""))[:64],
                "primary": str(p.get("primary", ""))[:6].upper(),
                "secondary": str(p.get("secondary", "") or p.get("primary", ""))[:6].upper(),
                "overall": int(p.get("overall", 75)),
                "nationality": str(p.get("nationality", ""))[:8],
            })
        out.append({
            "season": season,
            "team": {
                "club": str(team.get("club", ""))[:48],
                "country": str(team.get("country", ""))[:8],
                "crest": str(team.get("crest", ""))[:8],
                "players": clean_players,
            },
        })
    return out


def team_key(entry: Dict[str, Any]) -> str:
    return f"{entry['season']}-{entry['team']['club']}"


def roll_random(pool: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Pick a random pool entry uniformly."""
    return random.choice(pool)


def roll_lucky(pool: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Boosted-strong-team roll — 65% chance a strong team, else uniform."""
    if random.random() < 0.65:
        strong = [e for e in pool if team_key(e) in STRONG_TEAM_KEYS]
        if strong:
            return random.choice(strong)
    return roll_random(pool)


# ---------------------------------------------------------------------------
# Draft mutation helpers (functional — return updated state)
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def deadline_from_now(seconds: int) -> str:
    return (now_utc() + timedelta(seconds=seconds)).isoformat()


def init_player_draft(formation_id: str, tactic_id: Optional[str], team_name: str,
                      pool: List[Dict[str, Any]], pick_seconds: int) -> Dict[str, Any]:
    """Build the initial per-player draft doc with the first random roll."""
    slots = FORMATIONS.get(formation_id, FORMATIONS["4-3-3"])
    roll = roll_random(pool)
    return {
        "formation_id": formation_id if formation_id in FORMATIONS else "4-3-3",
        "tactic_id": tactic_id or "GEGENPRESS",
        "team_name": (team_name or "").strip()[:24] or "DRAFT",
        "xi": [None] * len(slots),        # slot idx -> picked player or None
        "picked_names": [],               # for dedupe convenience
        "changes_remaining": 3,
        "lucky_remaining": 1,
        "current_roll": roll,             # {season, team}
        "deadline": deadline_from_now(pick_seconds),
        "complete": False,
        "auto_picks": 0,                  # how many times server auto-picked
    }


def make_pick(player_draft: Dict[str, Any], slot_index: int, player_name: str,
              pool: List[Dict[str, Any]], pick_seconds: int) -> Tuple[bool, str]:
    """Attempt to record a pick. Returns (ok, error_message).

    Mutates `player_draft` in place. On success schedules the next roll +
    deadline for the following round (or marks complete on the 11th pick).
    """
    if player_draft.get("complete"):
        return False, "draft already complete"
    slots = FORMATIONS.get(player_draft["formation_id"], [])
    if slot_index < 0 or slot_index >= len(slots):
        return False, "invalid slot"
    if player_draft["xi"][slot_index] is not None:
        return False, "slot already filled"
    roll = player_draft.get("current_roll") or {}
    team = roll.get("team") or {}
    players_in_team = team.get("players") or []
    match = next((p for p in players_in_team if p.get("name") == player_name), None)
    if not match:
        return False, "player not in current pool"
    if match["name"] in player_draft["picked_names"]:
        return False, "player already picked"
    slot = slots[slot_index]
    if not can_place(slot["pos"], match):
        return False, "player cannot fill this slot"

    # Freeze the picked player with season/club metadata for later stages.
    picked = dict(match)
    picked.update({
        "_season": roll.get("season"),
        "_club": team.get("club"),
        "_crest": team.get("crest"),
        "_country": team.get("country"),
        "_slot": slot["pos"],
    })
    player_draft["xi"][slot_index] = picked
    player_draft["picked_names"].append(match["name"])

    filled = sum(1 for x in player_draft["xi"] if x is not None)
    total = len(slots)
    if filled >= total:
        player_draft["complete"] = True
        player_draft["current_roll"] = None
        player_draft["deadline"] = None
    else:
        player_draft["current_roll"] = roll_random(pool)
        player_draft["deadline"] = deadline_from_now(pick_seconds)
    return True, ""


def apply_change(player_draft: Dict[str, Any], lucky: bool,
                 pool: List[Dict[str, Any]], pick_seconds: int) -> Tuple[bool, str]:
    """Consume a 'change' to reroll the current pool for the same round."""
    if player_draft.get("complete"):
        return False, "draft already complete"
    if player_draft["changes_remaining"] <= 0:
        return False, "no changes left"
    if lucky and player_draft["lucky_remaining"] <= 0:
        lucky = False  # silently downgrade to normal change
    player_draft["changes_remaining"] -= 1
    if lucky:
        player_draft["lucky_remaining"] -= 1
        player_draft["current_roll"] = roll_lucky(pool)
    else:
        player_draft["current_roll"] = roll_random(pool)
    # Reset deadline so a change buys the user the full pick window again.
    player_draft["deadline"] = deadline_from_now(pick_seconds)
    return True, ""


def auto_pick(player_draft: Dict[str, Any], pool: List[Dict[str, Any]],
              pick_seconds: int) -> Tuple[bool, str]:
    """Server-side fallback when the pick timer expires.

    Rules:
    1. Prefer a player from the current roll that can fill an empty slot.
    2. If none, keep rerolling (up to 12 attempts) — very unlikely to fail
       because the pool has hundreds of players.
    3. Place them into the FIRST empty legal slot in formation order.
    """
    if player_draft.get("complete"):
        return False, "already complete"
    slots = FORMATIONS.get(player_draft["formation_id"], [])
    xi = player_draft["xi"]

    for attempt in range(12):
        roll = player_draft.get("current_roll") if attempt == 0 else roll_random(pool)
        team = (roll or {}).get("team") or {}
        candidates = [p for p in (team.get("players") or [])
                      if p.get("name") not in player_draft["picked_names"]]
        # try to find a (player, slot_idx) that fits
        random.shuffle(candidates)
        for cand in candidates:
            for idx, slot in enumerate(slots):
                if xi[idx] is None and can_place(slot["pos"], cand):
                    # commit
                    player_draft["current_roll"] = roll
                    ok, err = make_pick(player_draft, idx, cand["name"], pool, pick_seconds)
                    if ok:
                        player_draft["auto_picks"] += 1
                        return True, "auto"
    return False, "no legal candidate found (pool exhausted?)"


# ---------------------------------------------------------------------------
# Timer registry — schedules per-player auto-pick tasks
# ---------------------------------------------------------------------------
class DraftTimerManager:
    """Runs one asyncio task per active player-in-draft.

    Callers pass in an async `on_expire(code, player_id)` callback that
    handles the auto-pick + broadcast. The manager guarantees only one
    task per (code, player_id) is alive at any moment.
    """

    def __init__(self) -> None:
        self._tasks: Dict[Tuple[str, str], asyncio.Task] = {}

    def cancel(self, code: str, player_id: str) -> None:
        key = (code, player_id)
        task = self._tasks.pop(key, None)
        if task and not task.done():
            task.cancel()

    def cancel_room(self, code: str) -> None:
        for key in [k for k in self._tasks.keys() if k[0] == code]:
            self.cancel(*key)

    def schedule(self, code: str, player_id: str, deadline_iso: str,
                 on_expire: Callable[[str, str], "asyncio.Future"]) -> None:
        self.cancel(code, player_id)
        try:
            dt = datetime.fromisoformat(deadline_iso)
        except Exception:
            return
        delay = max(0.05, (dt - now_utc()).total_seconds())

        async def _runner() -> None:
            try:
                await asyncio.sleep(delay)
                await on_expire(code, player_id)
            except asyncio.CancelledError:
                return
            except Exception:
                # Never let a background task crash silently kill the loop.
                import logging
                logging.getLogger(__name__).exception(
                    "auto-pick task failed for %s/%s", code, player_id
                )

        self._tasks[(code, player_id)] = asyncio.create_task(_runner())


timer_manager = DraftTimerManager()
