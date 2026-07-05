# championsbuild — PRD

## Original problem statement (2026-07-05)
Implement the "Online Kapışma" (Online Multi-Player Room) feature in the
existing championsbuild React (CRA) + FastAPI + MongoDB app. Config UI with
tabs (+ ODA KUR / KATIL), nickname, MAX OYUNCU 2–8, OYUN MODU
(GRUP FORMATI / LİG FORMATI). Lobby screen with 5-char room code, copy /
WhatsApp / share actions, dynamic `?room=CODE` URL, live player list with
BOŞ SLOT placeholders, EV SAHİBİ crown, connection dot; BAŞLAT button
(host-only). Real-time sync across clients.

## Architecture
| Layer     | Choice                                | Notes                                          |
|-----------|---------------------------------------|------------------------------------------------|
| Frontend  | React 19 (CRA + craco), Tailwind      | Existing stack — no Vite migration             |
| Backend   | FastAPI + Motor (async MongoDB)       | Existing app; added new router                 |
| Real-time | **FastAPI WebSockets**                | Native — no extra service, no ping-pong worries |
| Storage   | MongoDB collection `online_rooms`     | Documents include players[], settings, status  |

If the user later migrates to Vite + Netlify, the recommended swap is
**Supabase Realtime** (WebSocket + row-level Postgres replication) — the
frontend hook + API client structure is portable.

## Room schema (MongoDB `online_rooms`)
```
{
  code:         "SNBTT3",      // 5-char [A-Z0-9], unique
  status:       "lobby|started|closed",
  host_id:      "abc123",
  max_players:  4,             // 2..8
  mode:         "group|league",
  duration_sec: 90,
  players: [
    { id, nickname, is_host, connected, joined_at }
  ],
  created_at, updated_at, started_at
}
```

## API surface
| Method | Path                                                    | Purpose                          |
|--------|---------------------------------------------------------|----------------------------------|
| POST   | `/api/online/rooms`                                     | Create room (host)               |
| GET    | `/api/online/rooms/{code}`                              | Fetch state                      |
| POST   | `/api/online/rooms/{code}/join`                         | Join as guest                    |
| POST   | `/api/online/rooms/{code}/start`                        | Host starts the match            |
| DELETE | `/api/online/rooms/{code}/players/{player_id}`          | Leave (host leave = close room)  |
| WS     | `/api/online/ws/{code}?player_id=…`                     | Real-time state feed             |

## What's implemented
### 2026-07-05 (v1)
- Backend router `/app/backend/routers/online.py` with REST + WS,
  `ConnectionManager` for fan-out, MongoDB persistence, and full input
  validation (nickname 2–16, max_players 2–8, mode ∈ {group,league}).
- Frontend API client `/app/frontend/src/lib/onlineApi.js`.
- WebSocket hook `/app/frontend/src/hooks/useRoomSocket.js` with
  reconnect (5-attempt backoff) and 25s heartbeat.
- `OnlineScreen.jsx` — two-tab config UI matching the requested design
  (red #ff3b30 active state, dark bg, uppercase Bebas Neue).
- `OnlineLobbyScreen.jsx` — room code hero, share URL bar, copy /
  WhatsApp / native share buttons, real-time slot list with BOŞ SLOT
  placeholders, connection dot, host crown, status pills
  (SÜRE / O.MAX / MOD), BAŞLAT / AYRIL actions.
- `App.js` — new `online` and `online_lobby` screens, `?room=CODE`
  URL detection on load, cleanup on leave.
- `HomeScreen.jsx` — activated the previously-disabled ONLINE button.
- Tested: 21/21 backend cases, 100% frontend flows.

### 2026-07-05 (v3 — Phase 1: Server-Authoritative Draft)
- **60s option** added to per-pick timer (15/30/45/60).
- **Server-authoritative draft engine** (`/app/backend/game_engine.py`):
  8 formations + slot-compat helpers, `roll_random`/`roll_lucky`,
  `init_player_draft`/`make_pick`/`apply_change`/`auto_pick`, and a
  `DraftTimerManager` that schedules per-player asyncio auto-pick tasks
  when a pick deadline expires.
- **Frozen pool contract**: `POST /rooms/{code}/start` now REQUIRES the
  host to upload the full team pool (built via `buildPoolSnapshot()` on
  the client). From that moment forward the server owns every dice
  roll, every pick validation, every timer — the client can no longer
  inject arbitrary players.
- **New endpoints**: `/game/pick`, `/game/change`, `/game/start_tournament`.
  All picks are validated against the current server roll (name+slot
  compat). Draft phase auto-transitions to `draft_complete` when every
  player fills 11 slots; host can then flip the room to `tournament`.
- **New frontend screen** `OnlineDraftScreen.jsx`: live progress board
  (X/11 per player, red border on self, crown on host), current team
  roll with sorted player cards (placeable / already-picked states),
  DEĞİŞTİR / ŞANSLI DEĞİŞTİR with counters, TimerPill counting down
  from the server-issued deadline (pulses red under 5s), mini pitch
  with legal-slot highlighting.
- **BAŞLAT rewired**: no longer drops each client into a local solo
  draft. Both host and guests transition to the same server draft
  session.
- **Tournament kickoff**: when `phase="draft_complete"`, host sees
  TURNUVAYA BAŞLA. Clicking it flips the phase to `tournament`; each
  client boots into their existing local TournamentScreen/LeagueTournamentScreen
  with their server-drafted squad. *Phase 2 (next iteration) will
  replace this with a synchronized server-authoritative match sim.*
- Tested: 46/46 backend, 100% frontend flows; only issue was a
  non-blocking React duplicate-key warning (fixed post-test).

## Roadmap
### Phase 2 (next iteration) — Server-authoritative Tournament
- Team-placement engine: for League mode remove N random AI from a
  32/36-team master fixture and slot real players in; same for Group.
- Port `matchEngine.js` to Python; every match result computed on the
  server with a deterministic seed so all clients see identical events.
- Broadcast per-round schedule; host `Continue` gate between rounds.
- Waiting screens between matches; watch-mode for synchronized live
  viewing when two humans meet.

### Phase 3 — Knockouts + endgame
- Server-side bracket generation (last 16 → final).
- Host-elimination handling (game continues, host becomes spectator).
- Auto-complete tournament when all humans are eliminated.
- Awards computation (golden boot, best XI, etc.) on the server.
- Room lifecycle hardening: TTL index, reconnect tokens, Redis pubsub
  for multi-worker scaling.

## Backlog / P1
- Fully synchronized per-pick draft over WebSocket (currently BAŞLAT
  drops each client into the local DraftScreen with the room's mode).
- Chat channel in the lobby ("MESAJLAŞ" already in the subtitle).
- LİG TABLOSU (persistent leaderboard) across online sessions.
- Auto-reap stale/closed rooms (TTL index on `updated_at`).
- Redis pub/sub if the backend scales beyond 1 worker.

## P2 / nice-to-have
- Room-owner kick action.
- Custom timer configuration in the UI (`duration_sec` currently fixed to 90s).
- Ready-check state before BAŞLAT enables.
