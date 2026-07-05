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

### 2026-07-05 (v2 — this iteration)
- **Per-pick timer**: `CreateRoomBody.pick_seconds` (∈ {15, 30, 45})
  replaces old `duration_sec`. UI: new "OYUNCU BAŞINA SÜRE" selector
  in `OnlineScreen`. Lobby SÜRE pill now reflects the chosen value.
- **Ready-check flow**: `PlayerSlot.ready` flag; new endpoint
  `POST /rooms/{code}/ready`. Host is force-ready. `POST /start` now
  returns 409 unless every player has `ready=true`. Guests see a
  big "HAZIRIM" toggle button in place of the passive waiting block;
  host BAŞLAT is disabled with a "DİĞER OYUNCULAR HAZIR VERMEYİ
  BEKLİYOR" hint until all guests are ready.
- **Quick-join via URL**: opening `?room=CODE` no longer lands on the
  config screen. Instead a compact `quickjoin-form` shows the code +
  a single nickname field. If a nickname is saved in localStorage
  the join fires automatically on mount — one click to lobby.
- Tested: 29/29 backend cases, 100% frontend flows.

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
