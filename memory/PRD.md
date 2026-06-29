# Ultimate Champions League Draft Builder — PRD

## Original Problem Statement
A web-based football draft & simulation game inspired by 38-0.online. Players randomly draft 11 footballers from UEFA Champions League semifinalist squads (1995-2025), select a formation and tactic, then compete in a 32-team Champions League tournament against the 31 historic UCL champions to lift the trophy.

## User Choices (gathered via ask_human)
- Data: Full set (all seasons, all semifinalists) — 31 seasons × 4 teams
- Player cards: FIFA UT–style with initial-based avatars (no real photos)
- Architecture: Frontend-only (React/HTML/JS), localStorage save
- Sound: ON by default, with toggle to mute
- Design: EA FC + Football Manager hybrid (dark theme, FUT cards, FM-style ticker)

## Latest Tweaks — Feb 2026
- Pitch center line: vertical → horizontal dashed (correct top-down view)
- Hard Mode difficulty rebalanced: AI legacy+stage bonus × 0.75 (was effectively 70/100, now ~55/100)

## Implementation Status — Feb 2026
### ✅ Done (MVP)
- Dataset: 31 seasons of UCL semifinalists with squads & overall ratings (1995–2025)
- 31 historic UCL champion teams metadata + base overalls
- Formations: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 5-3-2 (with pitch coords + compatibility penalties)
- Tactics: GEGENPRESS / TIKI-TAKA / PARK THE BUS (each with attack/midfield/defense/keeper modifiers, tempo, xG modifiers, counters)
- Match engine: chance generation, xG, possession, minute-by-minute events, two-leg ties, extra time, penalties
- Tournament engine: group stage drawing, fixtures, knockout brackets, AI tactic selection
- Draft engine: random + "lucky change" (1 of 3 changes biased toward strong teams)
- Sound engine: synthesized WebAudio sounds (dice, card reveal, goal, whistles, trophy)
- UI: Home, Formation select, Draft, Tactics, Tournament (groups + brackets), live Match modal with ticker, Trophy ceremony
- localStorage save/load + reset

### Architecture Notes
- All data in /app/frontend/src/data/
- Engines in /app/frontend/src/engine/
- Components in /app/frontend/src/components/
- Screens in /app/frontend/src/screens/
- Backend (FastAPI/MongoDB) untouched — pure frontend MVP

## P1 Backlog (next iterations)
- Expand player squads (add more depth for smaller clubs/older seasons)
- Background music
- Match minute-by-minute simulation timer (instead of instant ticker)
- Leaderboard (would require backend)
- Custom team naming
- Player kit colors / team color theming on FUT cards

## P2 Backlog
- Online PvP
- Card packs
- Daily quests
- Transfer mode
