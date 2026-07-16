# championsbuild — PRD

## Original problem statement (2026-07-05)
Implement the "Online Kapışma" (Online Multi-Player Room) feature in the
existing championsbuild React (CRA) + FastAPI + MongoDB app.

## 2026-07-16 UPDATE — Online/Multiplayer removed (rollback)
User feedback: the online/multiplayer feature was rushed and hard to
maintain. They decided to **suspend the online mode entirely** and, when
they revisit it later, start from scratch step-by-step. Everything
online-related has been removed from the codebase. Single-player flows
(GRUP FORMATI, LİG FORMATI, Hall of Fame, Auth, Trophy, Match sim,
Formation/Draft/Tactics) are untouched.

### What was removed
Backend:
- `backend/sio_server.py` (Socket.IO server)
- `backend/game_engine.py` (server-authoritative draft engine)
- `backend/routers/online.py` (REST + WS lifecycle)
- `backend/tests/test_online.py`, `test_online_game.py`, `test_online_socketio.py`
- `backend/server.py`: removed `online_router`, `sio` mount, `SelectiveCORSMiddleware`. Replaced with standard `CORSMiddleware`.
- `backend/requirements.txt`: dropped `python-socketio`

Frontend:
- `src/screens/OnlineScreen.jsx`, `OnlineLobbyScreen.jsx`, `OnlineDraftScreen.jsx`
- `src/hooks/useRoomSocket.js`
- `src/lib/onlineApi.js`, `src/lib/poolSnapshot.js`
- `src/App.js`: removed online state (`onlineMe`, `onlineCode`, `onlinePrefill`),
  `?room=CODE` URL handler, screens (`online`, `online_lobby`, `online_draft`)
- `src/screens/HomeScreen.jsx`: removed the `ONLİNE (CANLI)` button and `Wifi` icon import; removed `onOnline` prop
- `package.json`: dropped `socket.io-client`

### Restart path (future)
When the user wants online back, we start from zero: choose transport
(FastAPI WebSockets or Supabase Realtime), design room schema, wire host/join
lobby, then real-time draft. No leftover assumptions from the removed code.

## Architecture (current, single-player only)
| Layer    | Choice                                |
|----------|---------------------------------------|
| Frontend | React 19 (CRA + craco), Tailwind      |
| Backend  | FastAPI + Motor (async MongoDB)       |
| Auth     | Firebase Admin (optional, off in dev) |
| Storage  | MongoDB (Hall of Fame, saves)         |

## Core features (live)
- Home screen: GRUP FORMATI, LİG FORMATI, KAYDA DEVAM ET, Hall of Fame
- Draft screen (dice pool, formation, tactic, 3 changes + 1 lucky)
- Tournament (group) & League (Swiss) modes
- Match simulation + Trophy + Hall of Fame persistence
- Firebase optional auth

## Backlog / Next
- P1: (future) Design online multiplayer from scratch — decide transport, schema, then implement lobby → draft → tournament sync incrementally.
- P2: Improve match sim visuals & shareable trophy card.

## Verified 2026-07-16
- `GET /api/health` → `{status: ok}` (backend clean start, no socketio import)
- Home page renders with only GRUP/LİG buttons — no ONLİNE button
- No frontend imports or references to removed modules (grep clean)
