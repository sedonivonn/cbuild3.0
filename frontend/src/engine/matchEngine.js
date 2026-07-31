import { TACTICS } from "../data/tactics";
import { pickScorerAndAssist, computePlayerRatings } from "./playerStats";
import { createPitchState, stepPitch, TOTAL_TICKS } from "./pitchSim";

// After ET events are appended to a leg, recompute the leg's per-side player
// stats so that goals/assists scored in extra time are credited correctly.
// Generic: re-derives both home & away player stats from the current events.
function recomputeUserStatsFromEvents(leg, userPlayers, side) {
  if (!leg) return;
  // Re-derive homePlayerStats / awayPlayerStats based on whatever players we
  // were originally given for each side (stored on the leg by simulateMatch).
  if (leg._homePlayers) {
    leg.homePlayerStats = buildSidePlayerStats(
      leg._homePlayers, leg.events, "home", leg.home.score, leg.away.score, leg.home.name
    );
  }
  if (leg._awayPlayers) {
    leg.awayPlayerStats = buildSidePlayerStats(
      leg._awayPlayers, leg.events, "away", leg.away.score, leg.home.score, leg.away.name
    );
  }
  // Keep the legacy `userPlayerStats` alias pointing at whichever side is the user.
  if (side === "home") leg.userPlayerStats = leg.homePlayerStats || null;
  else if (side === "away") leg.userPlayerStats = leg.awayPlayerStats || null;
}

// Build per-player stats for a single side of a single leg.
function buildSidePlayerStats(players, allEvents, side, goalsFor, goalsAgainst, teamName) {
  if (!players || players.length === 0) return null;
  const sideGoalEvents = (allEvents || []).filter((e) => e.side === side && e.type === "GOAL");
  const { ratings, goalsMap, assistsMap } = computePlayerRatings(players, sideGoalEvents, goalsFor, goalsAgainst);
  return players.map((p) => ({
    name: p.name,
    slot: p._slot || p.primary,
    season: p._season,
    teamName,
    goals: goalsMap[p.name] || 0,
    assists: assistsMap[p.name] || 0,
    rating: ratings[p.name] || 6.5,
  }));
}

// Deterministic-ish RNG so games feel fair but varied
function rng() { return Math.random(); }

function applyTactic(stats, tacticId) {
  const t = TACTICS[tacticId] || TACTICS.TIKI_TAKA;
  const mods = t.mods;
  return {
    attack:   stats.attack + mods.attack,
    midfield: stats.midfield + mods.midfield,
    defense:  stats.defense + mods.defense,
    keeper:   stats.keeper + mods.keeper,
    overall:  stats.overall,
    tactic:   t,
  };
}

function counterBonus(aId, bId) {
  const a = TACTICS[aId];
  return (a?.counters?.[bId]) || 0;
}

// HARD MODE (C, tuned 62/100): user chemistry +1 per line (was +2).
const USER_CHEMISTRY = { attack: 1, midfield: 1, defense: 1, keeper: 1, overall: 1 };

// HARD MODE (C): underdog boost removed — no free help when facing stronger sides.
function underdogBoost() {
  return 0;
}

function applyChemistry(stats, isUser) {
  if (!isUser) return stats;
  return {
    ...stats,
    attack:   stats.attack   + USER_CHEMISTRY.attack,
    midfield: stats.midfield + USER_CHEMISTRY.midfield,
    defense:  stats.defense  + USER_CHEMISTRY.defense,
    keeper:   stats.keeper   + USER_CHEMISTRY.keeper,
    overall:  stats.overall  + USER_CHEMISTRY.overall,
  };
}

// The single source of truth for a regulation match is now the physical
// pitch simulation in `pitchSim.js`. `simulateMatch` runs that simulation
// HEADLESSLY (same code path CanvasMatch uses in real-time) and derives the
// events + score from the emergent physics. Given the same seed it always
// produces the exact same events, which is how the canvas replay and the
// tournament's stored result stay perfectly synchronised.
//
// Public API + return shape are intentionally identical to the pre-physics
// version — tournamentEngine, leagueEngine, TournamentScreen and
// LeagueTournamentScreen all keep working without any change on their side.
export function simulateMatch({ home, away, homeTacticId, awayTacticId, neutral = false, homeIsUser = false, awayIsUser = false, homePlayers = null, awayPlayers = null, seed = null }) {
  const A = applyTactic(applyChemistry(home, homeIsUser), homeTacticId);
  const B = applyTactic(applyChemistry(away, awayIsUser), awayTacticId);

  // Home advantage baked into home's attack strength.
  const ha = neutral ? 0 : 1.5;
  const aCounter = counterBonus(homeTacticId, awayTacticId);
  const bCounter = counterBonus(awayTacticId, homeTacticId);

  const homeStrength = {
    attack:   A.attack + ha + aCounter,
    midfield: A.midfield,
    defense:  A.defense,
    keeper:   A.keeper,
  };
  const awayStrength = {
    attack:   B.attack + bCounter,
    midfield: B.midfield,
    defense:  B.defense,
    keeper:   B.keeper,
  };

  // Deterministic seed — callers may pass one for perfect reproducibility.
  const usedSeed = (seed != null) ? (seed >>> 0) : (Math.floor(Math.random() * 0x7fffffff) >>> 0);

  const state = createPitchState({
    homeName: home.name,
    awayName: away.name,
    homePlayers,
    awayPlayers,
    homeStrength,
    awayStrength,
    seed: usedSeed,
  });

  const events = [];
  let safety = 0;
  while (!state.gameOver && safety < TOTAL_TICKS + 60) {
    const out = stepPitch(state);
    if (out.events.length > 0) events.push(...out.events);
    safety += 1;
  }

  // Filter to the shapes tournamentEngine already understands. Legacy
  // consumers only look at GOAL / SAVE / SHOT — the physics-only TACKLE
  // lines stay in the events array too (CanvasMatch shows them as pale
  // filler; tournament code ignores unknown types).
  events.sort((a, b) => a.minute - b.minute);

  const aScore = state.aScore;
  const bScore = state.bScore;
  // Legacy xG cosmetic — approximate from on-target attempts.
  const aXg = +(state.aOnTarget * 0.32 + (state.aShots - state.aOnTarget) * 0.05).toFixed(2);
  const bXg = +(state.bOnTarget * 0.32 + (state.bShots - state.bOnTarget) * 0.05).toFixed(2);

  const totalPoss = state.aPossessionTicks + state.bPossessionTicks || 1;
  const possessionHome = Math.round((state.aPossessionTicks / totalPoss) * 100);

  const homePlayerStats = buildSidePlayerStats(homePlayers, events, "home", aScore, bScore, home.name);
  const awayPlayerStats = buildSidePlayerStats(awayPlayers, events, "away", bScore, aScore, away.name);
  let userPlayerStats = null;
  if (homeIsUser && homePlayerStats) userPlayerStats = homePlayerStats;
  else if (awayIsUser && awayPlayerStats) userPlayerStats = awayPlayerStats;

  return {
    home: { name: home.name, score: aScore, shots: state.aShots, onTarget: state.aOnTarget, xg: aXg, possession: possessionHome },
    away: { name: away.name, score: bScore, shots: state.bShots, onTarget: state.bOnTarget, xg: bXg, possession: 100 - possessionHome },
    events,
    full: { aScore, bScore },
    homePlayerStats,
    awayPlayerStats,
    userPlayerStats,
    // Stash the player arrays on the leg so ET recompute can rebuild stats.
    _homePlayers: homePlayers,
    _awayPlayers: awayPlayers,
    // Stash the resolved (tactic+chemistry+HA+counter) strength stats so
    // CanvasMatch can rebuild the exact same pitch state for its replay.
    _homeStrength: homeStrength,
    _awayStrength: awayStrength,
    // Seed lets CanvasMatch reproduce the exact same physics run visually.
    seed: usedSeed,
  };
}

// Knockout: handles ET + penalties if needed
export function simulateKnockout({ home, away, homeTacticId, awayTacticId, twoLeg = true, homeIsUser = false, awayIsUser = false, homePlayers = null, awayPlayers = null }) {
  if (twoLeg) {
    const leg1 = simulateMatch({ home, away, homeTacticId, awayTacticId, homeIsUser, awayIsUser, homePlayers, awayPlayers });
    const leg2 = simulateMatch({ home: away, away: home, homeTacticId: awayTacticId, awayTacticId: homeTacticId, homeIsUser: awayIsUser, awayIsUser: homeIsUser, homePlayers: awayPlayers, awayPlayers: homePlayers });
    const aggA = leg1.home.score + leg2.away.score;
    const aggB = leg1.away.score + leg2.home.score;
    if (aggA !== aggB) {
      return {
        legs: [leg1, leg2],
        aggregate: { a: aggA, b: aggB },
        winner: aggA > aggB ? "home" : "away",
        decidedBy: "aggregate",
      };
    }
    // extra time on second leg
    const et = simulateExtraTime({ home: away, away: home, homeTacticId: awayTacticId, awayTacticId: homeTacticId, homeIsUser: awayIsUser, awayIsUser: homeIsUser, homePlayers: awayPlayers, awayPlayers: homePlayers });
    leg2.home.score += et.home;
    leg2.away.score += et.away;
    leg2.events = [...(leg2.events || []), ...et.events];
    // Re-compute leg2 user player stats including ET events so scorers are credited.
    recomputeUserStatsFromEvents(leg2, awayIsUser ? awayPlayers : homePlayers, awayIsUser ? "home" : "away");
    const aggA2 = leg1.home.score + leg2.away.score;
    const aggB2 = leg1.away.score + leg2.home.score;
    if (aggA2 !== aggB2) {
      return { legs: [leg1, leg2], aggregate: { a: aggA2, b: aggB2 }, et, winner: aggA2 > aggB2 ? "home" : "away", decidedBy: "extra_time" };
    }
    const pen = simulatePenalties(home, away, homeIsUser, awayIsUser);
    return { legs: [leg1, leg2], aggregate: { a: aggA2 + pen.a, b: aggB2 + pen.b }, et, penalties: pen, winner: pen.a > pen.b ? "home" : "away", decidedBy: "penalties" };
  }
  // Single match - Final
  const match = simulateMatch({ home, away, homeTacticId, awayTacticId, neutral: true, homeIsUser, awayIsUser, homePlayers, awayPlayers });
  if (match.home.score !== match.away.score) {
    return { match, winner: match.home.score > match.away.score ? "home" : "away", decidedBy: "regulation" };
  }
  const et = simulateExtraTime({ home, away, homeTacticId, awayTacticId, homeIsUser, awayIsUser, homePlayers, awayPlayers });
  match.home.score += et.home;
  match.away.score += et.away;
  match.events = [...(match.events || []), ...et.events];
  recomputeUserStatsFromEvents(match, homeIsUser ? homePlayers : awayPlayers, homeIsUser ? "home" : "away");
  if (match.home.score !== match.away.score) {
    return { match, et, winner: match.home.score > match.away.score ? "home" : "away", decidedBy: "extra_time" };
  }
  const pen = simulatePenalties(home, away, homeIsUser, awayIsUser);
  return { match, et, penalties: pen, winner: pen.a > pen.b ? "home" : "away", decidedBy: "penalties" };
}

function simulateExtraTime({ home, away, homeTacticId, awayTacticId, homeIsUser = false, awayIsUser = false, homePlayers = null, awayPlayers = null }) {
  // 30 min (91-120), halved chances - returns events too
  const A = applyTactic(applyChemistry(home, homeIsUser), homeTacticId);
  const B = applyTactic(applyChemistry(away, awayIsUser), awayTacticId);
  const aXgPer = 0.09 + Math.max(-0.04, Math.min(0.10, (A.attack - (B.defense * 0.6 + B.keeper * 0.4)) * 0.01));
  const bXgPer = 0.09 + Math.max(-0.04, Math.min(0.10, (B.attack - (A.defense * 0.6 + A.keeper * 0.4)) * 0.01));
  const aShots = 2 + Math.floor(Math.random() * 3);
  const bShots = 2 + Math.floor(Math.random() * 3);
  const events = [];
  let aGoals = 0, bGoals = 0;
  const allShots = [];
  for (let i = 0; i < aShots; i++) allShots.push({ side: "home", minute: 91 + Math.floor(Math.random() * 29) });
  for (let i = 0; i < bShots; i++) allShots.push({ side: "away", minute: 91 + Math.floor(Math.random() * 29) });
  allShots.sort((x, y) => x.minute - y.minute);
  for (const sh of allShots) {
    const xg = sh.side === "home" ? aXgPer : bXgPer;
    if (Math.random() < xg * 1.4) {
      if (sh.side === "home") aGoals++; else bGoals++;
      // Attribute extra-time scorer/assist when the scoring side has user players.
      const scoringPlayers = sh.side === "home" ? homePlayers : awayPlayers;
      let scorerName = null;
      let assistName = null;
      if (scoringPlayers && scoringPlayers.length > 0) {
        const pick = pickScorerAndAssist(scoringPlayers);
        if (pick.scorer) scorerName = pick.scorer.name;
        if (pick.assist) assistName = pick.assist.name;
      }
      const teamName = sh.side === "home" ? home.name : away.name;
      const goalText = scorerName
        ? `${sh.minute}' UZATMADA GOL! ${scorerName} (${teamName})${assistName ? ` · asist: ${assistName}` : ""}`
        : `${sh.minute}' UZATMADA GOL! ${teamName}`;
      events.push({
        minute: sh.minute, side: sh.side, type: "GOAL", text: goalText,
        scorer: scorerName, assist: assistName, critical: true,
      });
    } else if (Math.random() < 0.4) {
      // Attribute a shooter for the animation panel; ~45% of ET saves are critical.
      const shootingPlayers = sh.side === "home" ? homePlayers : awayPlayers;
      let shooterName = null;
      if (shootingPlayers && shootingPlayers.length > 0) {
        const pick = pickScorerAndAssist(shootingPlayers);
        if (pick.scorer) shooterName = pick.scorer.name;
      }
      const teamName = sh.side === "home" ? home.name : away.name;
      const text = shooterName
        ? `${sh.minute}' UZATMA: ${shooterName} (${teamName}) — kaleci kurtardı.`
        : `${sh.minute}' UZATMA kurtarış!`;
      events.push({
        minute: sh.minute, side: sh.side, type: "SAVE", text,
        shooter: shooterName, critical: Math.random() < 0.45,
      });
    }
  }
  return { home: aGoals, away: bGoals, events };
}

function simulatePenalties(home, away, homeIsUser = false, awayIsUser = false) {
  const A = applyChemistry(home, homeIsUser);
  const B = applyChemistry(away, awayIsUser);
  const akeep = A.keeper, bkeep = B.keeper;
  const aatk = A.attack, batk = B.attack;
  let a = 0, b = 0;
  const shots = [];
  // 5 standard rounds (alternating home then away each round)
  for (let i = 0; i < 5; i++) {
    const aGoal = Math.random() < scorePenChance(aatk, bkeep);
    shots.push({ side: "home", scored: aGoal, round: i + 1, sudden: false });
    if (aGoal) a++;
    const bGoal = Math.random() < scorePenChance(batk, akeep);
    shots.push({ side: "away", scored: bGoal, round: i + 1, sudden: false });
    if (bGoal) b++;
  }
  // sudden death (cap 5 rounds)
  let r = 6;
  let safety = 0;
  while (a === b && safety < 5) {
    const aGoal = Math.random() < scorePenChance(aatk, bkeep);
    shots.push({ side: "home", scored: aGoal, round: r, sudden: true });
    if (aGoal) a++;
    const bGoal = Math.random() < scorePenChance(batk, akeep);
    shots.push({ side: "away", scored: bGoal, round: r, sudden: true });
    if (bGoal) b++;
    r++; safety++;
  }
  if (a === b) {
    // tie-break safety
    if (Math.random() < 0.5) { a++; shots.push({ side: "home", scored: true, round: r, sudden: true }); }
    else { b++; shots.push({ side: "away", scored: true, round: r, sudden: true }); }
  }
  return { a, b, shots };
}

function scorePenChance(atk, keeper) {
  // baseline ~0.75; modified by (atk - keeper) lightly
  const diff = atk - keeper;
  return Math.max(0.55, Math.min(0.9, 0.74 + diff * 0.005));
}
