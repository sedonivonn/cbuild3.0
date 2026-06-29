// Per-goal attribution + per-match player ratings for the USER side.
// Opponent (CPU) side goals stay anonymous since we don't model their XI.
//
// Goal scorer is picked by weighted random across the user's 11 (position-bias × OVR).
// Assist is picked from the remaining 10 (separate passer weights), with ~65% probability.
// Player ratings are computed from a 6.5 baseline plus bonuses for goals/assists/clean sheet.

import { effOverall } from "../data/ballonDor";

// Slot label → scoring tendency (higher = more likely to score).
const SCORE_WEIGHTS = {
  ST: 6.0, CF: 5.5, CAM: 3.0,
  LW: 4.0, RW: 4.0, LM: 2.8, RM: 2.8,
  CM: 1.8, CDM: 0.9,
  LB: 0.7, RB: 0.7, LWB: 0.9, RWB: 0.9,
  CB: 0.6, GK: 0.04,
};

// Slot label → passing/creator tendency (higher = more likely to assist).
const ASSIST_WEIGHTS = {
  CAM: 5.0, CM: 3.5, CDM: 2.2,
  LW: 4.0, RW: 4.0, LM: 3.4, RM: 3.4,
  ST: 2.0, CF: 2.0,
  LB: 2.5, RB: 2.5, LWB: 2.8, RWB: 2.8,
  CB: 0.6, GK: 0.1,
};

function weightFor(player, table) {
  const slot = player._slot || player.primary || "CM";
  const base = table[slot] ?? 1.0;
  const ovr = effOverall(player, player._season);
  // Skew the bias toward high-OVR players. Subtract 55 floor.
  const ovrFactor = Math.pow(Math.max(1, ovr - 55), 1.4);
  return base * ovrFactor;
}

function weightedPick(players, table, exclude = null) {
  const candidates = exclude ? players.filter((p) => p !== exclude) : players;
  const weights = candidates.map((p) => weightFor(p, table));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[0];
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Attribute a single goal: return { scorer, assist?: string|null }
export function pickScorerAndAssist(userPlayers) {
  if (!userPlayers || userPlayers.length === 0) return { scorer: null, assist: null };
  const scorer = weightedPick(userPlayers, SCORE_WEIGHTS);
  const assist = Math.random() < 0.65 ? weightedPick(userPlayers, ASSIST_WEIGHTS, scorer) : null;
  return { scorer, assist };
}

// Build per-player rating map for a single match given events + match summary.
// events: array of { side, type, scorer, assist } — only events with side === "user".
// matchSummary: { goalsFor, goalsAgainst } for the user side.
export function computePlayerRatings(userPlayers, userEvents, goalsFor, goalsAgainst) {
  const ratings = {};
  const goalsMap = {};
  const assistsMap = {};

  for (const p of userPlayers) {
    const id = p.name;
    ratings[id] = 6.5 + (Math.random() - 0.5) * 0.6; // base ±0.3
    goalsMap[id] = 0;
    assistsMap[id] = 0;
  }

  for (const ev of userEvents || []) {
    if (ev.type !== "GOAL") continue;
    if (ev.scorer) {
      ratings[ev.scorer] = (ratings[ev.scorer] || 6.5) + 0.7;
      goalsMap[ev.scorer] = (goalsMap[ev.scorer] || 0) + 1;
    }
    if (ev.assist) {
      ratings[ev.assist] = (ratings[ev.assist] || 6.5) + 0.4;
      assistsMap[ev.assist] = (assistsMap[ev.assist] || 0) + 1;
    }
  }

  // Defense / GK adjustments
  const cleanSheet = goalsAgainst === 0;
  const heavyConceded = goalsAgainst >= 3;
  for (const p of userPlayers) {
    const slot = p._slot || p.primary;
    const isGK = slot === "GK";
    const isDef = ["CB", "LB", "RB", "LWB", "RWB"].includes(slot);
    if (isGK) {
      if (cleanSheet) ratings[p.name] += 0.6;
      if (heavyConceded) ratings[p.name] -= 0.6;
      if (goalsAgainst === 1 || goalsAgainst === 2) ratings[p.name] -= 0.15;
    } else if (isDef) {
      if (cleanSheet) ratings[p.name] += 0.35;
      if (heavyConceded) ratings[p.name] -= 0.3;
    }
    // Heavy wins boost everyone slightly
    if (goalsFor - goalsAgainst >= 3) ratings[p.name] += 0.2;
    if (goalsAgainst - goalsFor >= 3) ratings[p.name] -= 0.25;
  }

  // Clamp ratings to [5.0, 10.0] and round to 1 decimal
  for (const id of Object.keys(ratings)) {
    ratings[id] = Math.max(5.0, Math.min(10.0, Math.round(ratings[id] * 10) / 10));
  }

  return { ratings, goalsMap, assistsMap };
}
