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

## 2026-07-16 UPDATE — OSM-style match simulation
Redesigned `/app/frontend/src/screens/MatchScreen.jsx` to feel like the OSM
match view without changing the underlying simulation engine.

New building blocks (all in `MatchScreen.jsx`):
- `phase === "prematch"` — first phase now. `PreMatchLineups` renders two
  `TeamLineupPanel` columns (home / away) side-by-side. Each panel shows
  name + subtitle, an 11-row player list (jersey #, name, OVR badge) and a
  `MiniPitch` with 11 position dots derived from `FORMATIONS[formationId]`.
  Opponent XI → 4-3-3 template via `buildOpponentXi()` (matches primary/
  secondary positions with wing-family fallback).
- User must click `start-match-button` ("MAÇI BAŞLAT") to kick off. Speed
  picker retained (`YAVAŞ / NORMAL / HIZLI / ULTRA`) with the same testids.
- OSM-style ticker: home events left-aligned, away events right-aligned
  (`TickerRow`). Interleaved chronologically (regulation → ET).
- `ShotAnimation` overlay plays before every GOAL/SAVE event (except in
  ULTRA speed). A football glides toward the target net (right net for
  home, left net for away). On GOAL: golden "GOOOL" flash + accent glow.
  On SAVE: red X stamped on the net. Duration scales with speed
  (slow=1200ms / normal=700ms / fast=380ms). Testids: `shot-anim-goal`,
  `shot-anim-save`.
- App.js passes `userXi`, `userFormationId`, `userTeamName` into the match
  prop so `PreMatchLineups` can render the user side.

Verified by testing_agent_v3 (iteration 24): 7/7 acceptance criteria pass,
including regression that HomeScreen has no online button.

## 2026-07-16 UPDATE — Cinematic shot animation + bigger prematch pitch
Follow-up polish on the OSM match view based on user feedback:

MatchScreen (`/app/frontend/src/screens/MatchScreen.jsx`)
- **Prematch MiniPitch** now stacks under each team's player list, spans full
  panel width (aspect ratio 0.72:1, max 300px). Each of the 11 dots shows:
  position label above the dot, jersey number inside a white circle, player's
  short last-name below. Penalty boxes drawn on both ends.
- **Shot animation trigger** narrowed to `critical` events only. In
  `matchEngine.js`, all GOAL events carry `critical:true` and ~40% of
  regulation saves (~45% of ET saves) are randomly marked critical, so the
  animation feels like a rare highlight instead of firing on every shot.
  Non-critical saves render only in the ticker.
- **Animation duration is now a fixed 2400ms** (`SHOT_ANIM_MS`) regardless of
  the speed picker — even ULTRA plays the highlight cinematically. Reverts
  the iter-24 behavior where ULTRA skipped the animation entirely.
- **New animation timeline**: 0–0.55s "KRİTİK ATAK · <team>" banner slides in
  and fades out; 0.55–1.95s ball flight (cubic-bezier ease-out slowing near
  the goal, scaling 0.55→1.5 to convey perspective); 1.95–2.40s impact —
  golden "GOOOL" burst for goals OR big red X for saves.
- **Classic B+W ball**: rewrote `BallSVG` with proper pentagon panels and a
  subtle highlight, drop-shadow.
- **White net** with visible goal-frame posts (rgba 0.75 grid lines + 3px
  glowing posts on the target side).
- **Net ripple on GOAL only**: net wrapper motion animates
  `scaleX/Y/x` [1,1,1.10,1.03,1.005,1.0] around impact — mimicking the
  mesh tensioning back after the ball hits.
- **Player card**: bottom of animation shows scorer + "Asist: <name>" for
  goals, or shooter for saves; falls back to team name when the attacker
  has no known XI attribution.

matchEngine.js
- SAVE + SHOT events now carry a `shooter` string field (weighted pick by
  scoring tendency × OVR from the attacking side's players).
- Ticker text for saves reads "Kaçan fırsat: <name> (<team>) — kaleci
  kurtardı." when a shooter is attributed.

Verified by testing_agent_v3 (iteration 25): 8/8 acceptance criteria pass
including MiniPitch measurements, fixed 2400ms duration at ULTRA, critical
filter, KRİTİK ATAK banner, both-sides triggers, ticker shooter attribution,
ripple-on-goal-only, regression of online-removal + prematch-gate.

## 2026-07-20 UPDATE — Prematch cleanup + cancel routes
User feedback: mini-pitch under the player list wasn't landing visually — and
there was no way to back out of the prematch modal once opened.

MatchScreen (`/app/frontend/src/screens/MatchScreen.jsx`)
- **Removed the `MiniPitch` component entirely** and the render call under
  each `TeamLineupPanel`. Prematch now only shows the header + 11-row player
  list per team.
- **New prematch cancel routes** (only active while `phase === "prematch"`):
  - `← GERİ` button (`data-testid="prematch-cancel-button"`) placed next to
    `MAÇI BAŞLAT →`.
  - Escape key closes the modal.
  - Backdrop click (outside the modal card) closes the modal.
  - Once the match starts (phase moves past prematch), all three routes are
    disabled — the simulation must run to completion so the tournament
    state stays consistent with the already-applied result.
- `handleClose` guarded by `finishedRef` so ESC + backdrop double-fire is
  safe.

Verified by testing_agent_v3 (iteration 26): 9/9 tests pass — no mini-pitch
in DOM, GERİ button visible & closes modal, ESC closes, backdrop closes,
inside-card clicks preserved, cancel routes disabled after start.
