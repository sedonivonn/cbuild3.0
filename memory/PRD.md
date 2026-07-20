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

## 2026-07-20 UPDATE — Canvas match simulation (TypeScript)
User requested a full replacement of the in-play match view with a 2D
top-down HTML5 Canvas simulation, retro pixel-art aesthetic.

Design contract (settled with the user):
- Canvas replaces only the in-play area of `MatchScreen`. Prematch
  lineups, ET confirm, penalty shoot-out, POTM, aggregate, next-leg
  buttons all keep working.
- `matchEngine.js` stays authoritative for goals/scorer/assist/minute
  timeline; the canvas is a visualization layer that reacts to score
  props + `latestEvent`.
- Filler commentary ("Pas.", "Baskı.", "Korner kullanılıyor.") is
  generated by the canvas AI to keep the log alive between engine events.

New / changed files:
- `/app/frontend/tsconfig.json` (new). TypeScript added:
  `typescript@4.9.5`, `@types/react`, `@types/react-dom`, `@types/node`.
  Removed conflicting `jsconfig.json`.
- `/app/frontend/src/screens/match/CanvasMatch.tsx` (new, ~720 lines).
  RAF game loop reads speed via `speedRef` so the effect never restarts
  on prop changes; deps `[homeFlashAt, awayFlashAt]` only trigger the
  restart on goal pulses. Contents:
  - `stepAI` — pure function over ref state. Rules: keeper stays on his
    goal line & slides toward ball y; carrier drifts toward opponent
    goal, teammates spread ahead, nearest 2 defenders press ball
    carrier; carrier passes every ~1.2s of sim time to best-placed
    forward teammate; occasional cosmetic shots near opp box.
  - `draw` — turf stripes, boundary lines, centre circle, penalty
    boxes, goal glow, ball with translucent trail, discs with numbers.
    `imageSmoothingEnabled = false` for pixel-art feel.
  - Latest-event effect: hands ball to the shooting side and launches a
    shot toward goal center when a GOAL/SAVE/SHOT event arrives.
- `/app/frontend/src/screens/MatchScreen.jsx` — imports CanvasMatch;
  during phase in `{kickoff, playing, playing_et}` renders it in place
  of the old scoreboard+ticker+shot-anim block. Outer stage+SpeedPicker
  row is hidden in canvas phases. Removed `shotAnim` state,
  `isCriticalShot`, `SHOT_ANIM_MS`, `ShotAnimation`, `BallSVG`, `NetSVG`,
  `TickerRow`, and `eventClass` — all superseded by canvas.

Speed picker semantics:
- SLOW = 1x AI dt, NORMAL = 2x, FAST = 4x, ULTRA = 8x. The parent
  MatchScreen ticker still paces engine-event reveals at
  `speed.delay`, so speed feels consistent between AI + engine.

Data-testids exposed by CanvasMatch: `canvas-match`, `canvas-stage`,
`canvas-home-name`, `canvas-away-name`, `canvas-score`,
`canvas-minute`, `canvas-speed-picker`, `canvas-speed-{slow|normal|
fast|ultra}`, `canvas-commentary`.

Verified by testing_agent_v3 (iteration 27): 8/8 primary criteria pass.
Canvas renders at 710×426 CSS px, turf pixel at (25%,50%) = rgb(14,112,~)
matches `#0d5f2b`, RAF loop confirmed alive (`toDataURL` differs across
600ms), GOAL/SAVE/SHOT commentary color-coded correctly (amber/emerald/
white), speed picker persists to localStorage, POTM + close-match-button
still work post-match. Follow-up: tightened filler-commentary interval
from `3.5 + rand*2.5` to `1.4 + rand*1.6` seconds and expanded the
bucket to include corner mentions.

## 2026-07-20 UPDATE — Richer canvas AI + skip button (iter-28)
User feedback: iter-27 sim was too rushed ("santra → gol"), no visible pass
buildup, weak defensive shifts, no keeper reaction. Also asked to drop the
speed picker entirely (only the calm slow pace stays) and replace it with a
single "MAÇI ATLA" skip button.

CanvasMatch.tsx — full rewrite (~848 lines):
- New `SimState` fields: `pending` (buildupLeft + type + shooter), `celebration`
  (until + text + side), `restartAt` (post-goal calm-down window).
- **Pending-shot buildup**: on latestEvent, canvas queues {2.4s GOAL / 2.0s
  SAVE / 1.6s SHOT}. During buildup the ball actively passes among the
  shooting side's attackers. When timer expires, the current owner (or the
  most-forward attacker on that side) shoots with type-specific aim:
  GOAL aims away from the keeper, SAVE aims on target (keeper intercepts),
  SHOT aims wide. Kills the old teleport feel.
- **Keeper AI upgrade**: keepers now sprint out of their line to intercept
  along the ball's y-trajectory when a pending shot is in flight inside
  their box. Otherwise they hold the goal line and slide with `ball.y`.
- **Slower physics**: drag=0.55 (was 0.42), MAX_SPD=20 (was 22), pass
  speed 16-26 (was 24-38), shot 50-62 (was 55-78). Every action reads
  frame-by-frame instead of snapping.
- **Longer carrier hold**: pass gated by `holdTime > 0.9s` AND either
  `underPressure` (opponent within 3.2 units) OR `sinceLastPass > 2.2s +
  jitter`. 22% chance of a backward safety pass to vary rhythm.
- **Goal celebration**: 1.6s dark overlay + big "GOL!" text (`Press Start
  2P`, #f5c542, glow). Kickoff resets ball to centre and both teams retreat
  to home positions during a 900ms `restartAt` window.
- **Richer filler**: 5 buckets (FILLER_BUILDUP, FILLER_PRESS, FILLER_ATTACK,
  FILLER_KEEPER, FILLER_RESTART) with ~25 unique lines. Trickled at 1.5-3s.
- **Skip button** (`data-testid="canvas-skip-button"`, lucide SkipForward
  icon + "MAÇI ATLA" text) replaces the entire speed picker in the canvas
  top-right.

MatchScreen.jsx:
- Removed `SPEEDS`, `SpeedPicker`, `speedKey` state and `loadSpeed`/`saveSpeed`
  localStorage helpers (no more `ucl_match_speed_v1`).
- Single hard-coded `EVENT_DELAY_MS = 1600` for the reveal cadence.
- New `handleSkip()` fast-forwards the current phase's ticker to the end and
  transitions phase (playing → et_confirm | penalties | done; playing_et →
  penalties | done). Passed to CanvasMatch as `onSkip`.

Verified by testing_agent_v3 (iteration 28): 10/10 tests pass.
- Speed picker + all its testids fully absent
- canvas-skip-button visible + closes canvas within ~333ms → post-match UI
- EVENT_DELAY_MS=1600 confirmed; 13-event match ran ~21s naturally
- Celebration overlay detected via centre-pixel sampling after score bump
- Log richness: 35 distinct entries in 21s across all 5 filler buckets
- Keeper AI dive verified, RAF still alive, prematch cancel routes intact
