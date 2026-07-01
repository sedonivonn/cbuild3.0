// League-phase engine (Swiss-model). Isolated from tournamentEngine so the
// legacy group-mode is not affected. Actual match simulation still delegates
// to the existing playGroupMatch / playKnockout in tournamentEngine.js.

import { computeStandings } from "./tournamentEngine";

// --- Public API ---------------------------------------------------------
//
//  drawLeaguePhase(teams)          → { teams (potIndex tagged), pairings, homeAwayById }
//  generateLeagueFixtures(draw)    → [[matchdayMatches...] x 8]  (each match = {home, away})
//  computeLeagueStandings(teams, resultsFlat)
//                                  → sorted table of 32 rows
//  getDirectQualifiers(standings)  → top 8 rows
//  getPlayoffTeams(standings)      → 8 pairs (seed 9v24, 10v23, ... 16v17)
//                                    higher-seeded team hosts leg 2
//  getEliminated(standings)        → rows 25-32
//  buildR16FromLeague(qualifiers, playoffWinnersBySeed)
//                                  → 8 pairs for the Round of 16
// -----------------------------------------------------------------------

// Group teams into 4 pots of 8 by baseOverall (highest first).
function buildPots(teams) {
  const sorted = [...teams].sort(
    (a, b) => (b.baseOverall || 80) - (a.baseOverall || 80)
  );
  return [sorted.slice(0, 8), sorted.slice(8, 16), sorted.slice(16, 24), sorted.slice(24, 32)];
}

// Standard circle-method round-robin for 32 teams (works for any even n).
// Returns 31 rounds, each with 16 matches. Rotation keeps team[0] fixed.
function circleRoundRobin(teamsList) {
  const n = teamsList.length;
  if (n % 2 !== 0) throw new Error("Round-robin needs even number of teams");
  const arr = teamsList.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      matches.push({ home: arr[i], away: arr[n - 1 - i] });
    }
    rounds.push(matches);
    // Rotate all but arr[0] one position to the right.
    const last = arr.pop();
    arr.splice(1, 0, last);
  }
  return rounds;
}

// Draw the league phase for 32 teams.
// Uses a simplified schedule: pot-based shuffle + circle round-robin first 8 rounds.
// Each team plays 8 distinct opponents, home/away alternates per round for balance.
export function drawLeaguePhase(teams) {
  if (teams.length !== 32) {
    throw new Error(`drawLeaguePhase expects 32 teams, got ${teams.length}`);
  }

  const pots = buildPots(teams);

  // Interleave pots: pot0[0], pot1[0], pot2[0], pot3[0], pot0[1], ... to
  // spread strengths through the initial ordering so each team's opponents
  // in the first 8 rounds tend to come from various pots.
  const seed = [];
  for (let i = 0; i < 8; i++) {
    for (let p = 0; p < 4; p++) seed.push(pots[p][i]);
  }

  // Shuffle each pot lightly so consecutive matchdays don't feel deterministic.
  const shuffled = seed.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Only shuffle within the same pot (every 4th item).
    const j = i - (i % 4) + Math.floor(Math.random() * 4);
    if (j !== i && j >= 0 && j < shuffled.length) {
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }

  const potIndex = {};
  teams.forEach((t) => {
    for (let p = 0; p < 4; p++) if (pots[p].some((x) => x.id === t.id)) potIndex[t.id] = p;
  });

  return { teams, potIndex, orderedTeams: shuffled, pots };
}

// Generate 8-week fixture list from the draw.
// Returns [[md1matches], [md2matches], ..., [md8matches]].
// Each match: { home, away }.
export function generateLeagueFixtures(draw) {
  const allRounds = circleRoundRobin(draw.orderedTeams);
  const first8 = allRounds.slice(0, 8);
  // Alternate home/away per round for balance.
  const balanced = first8.map((round, ri) =>
    round.map((m) => (ri % 2 === 0 ? m : { home: m.away, away: m.home }))
  );
  return balanced;
}

// Compute the single 32-team standings table.
// Uses the same sort order as computeStandings: Pts, GD, GF.
export function computeLeagueStandings(teams, allResults) {
  return computeStandings(teams, allResults);
}

// Top 8 rows advance directly to the Round of 16.
export function getDirectQualifiers(standings) {
  return standings.slice(0, 8);
}

// Rows 9-24 play a 2-legged play-off (seeds 9v24, 10v23, ..., 16v17).
// The higher-seeded team (lower index) hosts the SECOND leg.
export function getPlayoffTeams(standings) {
  const playoffPool = standings.slice(8, 24); // 16 rows
  const pairs = [];
  for (let i = 0; i < 8; i++) {
    const higherSeed = playoffPool[i];             // rows 9..16 (0-indexed 0..7)
    const lowerSeed = playoffPool[15 - i];         // rows 24..17 (0-indexed 15..8)
    pairs.push({
      higherSeed,
      lowerSeed,
      // Leg 1 at lower-seed's ground, Leg 2 at higher-seed's ground.
      home: lowerSeed.team,   // leg 1 home
      away: higherSeed.team,  // leg 1 away
      // Convenience: who hosts the return leg (used by simulateKnockout as
      // "home" if we wanted single-match; for 2-leg the tie is symmetric).
      returnHost: higherSeed.team,
    });
  }
  return pairs;
}

// Rows 25-32 are eliminated at the league phase.
export function getEliminated(standings) {
  return standings.slice(24);
}

// Build the Round of 16 pairings from the 8 direct qualifiers and the 8
// play-off winners. Uses standard tournament seeding: 1v16, 2v15, ..., 8v9,
// where seeds 9-16 are the play-off winners ordered by their original league
// rank (playoffWinnersBySeed[0] = winner of the 9v24 tie, etc.).
export function buildR16FromLeague(qualifierStandings, playoffWinnersBySeed) {
  // Direct qualifiers keep seeds 1-8. Play-off winners get seeds 9-16 in the
  // order of their pre-playoff league rank (i.e. the seed-9 team, if it won,
  // becomes seed 9 in the R16 bracket; if the seed-24 team upset it, that team
  // still slots into seed 9's bracket spot).
  const seeded = [];
  for (let i = 0; i < 8; i++) seeded.push(qualifierStandings[i].team);          // 1..8
  for (let i = 0; i < 8; i++) seeded.push(playoffWinnersBySeed[i]);              // 9..16

  // Pair 1v16, 2v15, ..., 8v9. Higher seed hosts leg 2 by convention (we mark
  // leg-1 home = lower seed).
  const pairs = [];
  for (let i = 0; i < 8; i++) {
    const high = seeded[i];        // seeds 1..8
    const low = seeded[15 - i];    // seeds 16..9
    pairs.push({ home: low, away: high });
  }
  return pairs;
}
