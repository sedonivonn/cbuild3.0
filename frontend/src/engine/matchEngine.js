import { TACTICS } from "../data/tactics";
import { pickScorerAndAssist, computePlayerRatings } from "./playerStats";

// -----------------------------------------------------------------------------
// Seeded PRNG (mulberry32). Keeps simulateMatch fully deterministic per seed.
// -----------------------------------------------------------------------------
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scoring / assist tendency by pitch slot. Local copies so we can use the
// seeded RNG (playerStats.js still uses Math.random for its public helper).
const SLOT_SCORE_WEIGHTS = {
  ST: 6.0, CF: 5.5, CAM: 3.0,
  LW: 4.0, RW: 4.0, LM: 2.8, RM: 2.8,
  CM: 1.8, CDM: 0.9,
  LB: 0.7, RB: 0.7, LWB: 0.9, RWB: 0.9,
  CB: 0.6, GK: 0.04,
};
const SLOT_ASSIST_WEIGHTS = {
  CAM: 5.0, CM: 3.5, CDM: 2.2,
  LW: 4.0, RW: 4.0, LM: 3.4, RM: 3.4,
  ST: 2.0, CF: 2.0,
  LB: 2.5, RB: 2.5, LWB: 2.8, RWB: 2.8,
  CB: 0.6, GK: 0.1,
};
function seededPick(rng, players, table, exclude = null) {
  if (!players || players.length === 0) return null;
  const cand = exclude ? players.filter((p) => p !== exclude) : players;
  if (cand.length === 0) return null;
  const weights = cand.map((p) => {
    const slot = p._slot || p.primary || "CM";
    const base = table[slot] ?? 1.0;
    const ovr = p.overall ?? 75;
    return base * Math.pow(Math.max(1, ovr - 55), 1.4);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return cand[0];
  let r = rng() * total;
  for (let i = 0; i < cand.length; i++) {
    r -= weights[i];
    if (r <= 0) return cand[i];
  }
  return cand[cand.length - 1];
}
function pickGK(players) {
  if (!players || players.length === 0) return null;
  return players.find((p) => (p._slot || p.primary) === "GK") || players[0];
}
function poisson(rng, lam) {
  // Knuth's algorithm — fine for our small lambdas (~10-14).
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

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

// The simulator produces a stream of chronological events (goals, saves,
// missed opportunities) from the two teams' resolved strength stats. Given
// the same seed it always produces the exact same events, which lets the
// tournament's stored result and the on-screen text replay stay in sync.
//
// Public API + return shape are intentionally identical to the previous
// version — tournamentEngine, leagueEngine, TournamentScreen and
// LeagueTournamentScreen all keep working without any change on their side.
// (`_homeStrength` / `_awayStrength` are still surfaced so any downstream
// consumer can reason about relative team strength if it wants to.)
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
  const rng = mulberry32(usedSeed);

  // --- Attempt counts ------------------------------------------------------
  // Each side generates ~9-16 attempts; the difference is nudged by the
  // midfield gap so the dominant side gets more chances.
  const meanShots = (S, O) =>
    Math.max(4, 11 + 0.16 * (S.midfield - O.midfield) + 0.06 * (S.attack - O.defense));
  const homeMean = meanShots(homeStrength, awayStrength);
  const awayMean = meanShots(awayStrength, homeStrength);
  const homeAttempts = Math.max(3, poisson(rng, homeMean));
  const awayAttempts = Math.max(3, poisson(rng, awayMean));

  // Per-shot expected goal probability. Grounded on the attacker's edge over
  // the opposing defence/keeper mix; clamped so extreme mismatches still
  // produce believable scorelines.
  const xgBase = (S, O) => {
    const edge = S.attack - (O.defense * 0.55 + O.keeper * 0.45);
    return Math.max(0.06, Math.min(0.22, 0.115 + 0.006 * edge));
  };
  const homeXg = xgBase(homeStrength, awayStrength);
  const awayXg = xgBase(awayStrength, homeStrength);

  // --- Build the timeline -------------------------------------------------
  const attempts = [];
  const push = (side, count, xgMean, players) => {
    for (let i = 0; i < count; i++) {
      const minute = 1 + Math.floor(rng() * 90);
      const second = Math.floor(rng() * 60);
      // Chance quality varies per shot (0.4×mean … 1.6×mean).
      const chance = Math.max(0.03, Math.min(0.55, xgMean * (0.4 + rng() * 1.6)));
      attempts.push({ side, minute, second, chance, players });
    }
  };
  push("home", homeAttempts, homeXg, homePlayers);
  push("away", awayAttempts, awayXg, awayPlayers);
  attempts.sort((x, y) => x.minute - y.minute || x.second - y.second);

  // --- Resolve each attempt -----------------------------------------------
  const events = [];
  let aScore = 0, bScore = 0;
  let aOn = 0, bOn = 0;
  let aShots = 0, bShots = 0;
  let aXgSum = 0, bXgSum = 0;

  const SAVE_BAND = 0.28;   // portion of "not-goal" that lands on-target
  const MISS_BAND = 0.55;   // portion of "not-goal" that leaves a visible chance

  for (const att of attempts) {
    const teamName = att.side === "home" ? home.name : away.name;
    const oppPlayers = att.side === "home" ? awayPlayers : homePlayers;
    const oppTeamName = att.side === "home" ? away.name : home.name;
    if (att.side === "home") { aShots++; aXgSum += att.chance; }
    else { bShots++; bXgSum += att.chance; }

    const roll = rng();
    if (roll < att.chance) {
      // GOAL
      if (att.side === "home") { aScore++; aOn++; } else { bScore++; bOn++; }
      let scorerName = null, assistName = null;
      if (att.players && att.players.length) {
        const scorer = seededPick(rng, att.players, SLOT_SCORE_WEIGHTS);
        if (scorer) scorerName = scorer.name;
        if (rng() < 0.65) {
          const asst = seededPick(rng, att.players, SLOT_ASSIST_WEIGHTS, scorer);
          if (asst) assistName = asst.name;
        }
      }
      events.push({
        minute: att.minute,
        second: att.second,
        side: att.side,
        type: "GOAL",
        player: scorerName || teamName,
        teamName,
        text: scorerName
          ? `${att.minute}' ${scorerName} GOL${assistName ? ` · asist: ${assistName}` : ""}`
          : `${att.minute}' ${teamName} GOL`,
        scorer: scorerName,
        assist: assistName,
        critical: true,
      });
    } else if (roll < att.chance + SAVE_BAND) {
      // ON-TARGET → keeper save. Attributed to the DEFENDING keeper.
      if (att.side === "home") aOn++; else bOn++;
      const gk = pickGK(oppPlayers);
      const gkName = gk ? gk.name : `${oppTeamName} kalecisi`;
      const shooter = att.players && att.players.length
        ? seededPick(rng, att.players, SLOT_SCORE_WEIGHTS) : null;
      events.push({
        minute: att.minute,
        second: att.second,
        // SAVE lives on the defending side so the events panel shows it on
        // the keeper's row, matching the reference design.
        side: att.side === "home" ? "away" : "home",
        type: "SAVE",
        player: gkName,
        teamName: oppTeamName,
        text: `${att.minute}' ${gkName} KURTARIŞ`,
        shooter: shooter?.name || null,
        critical: att.chance > 0.16,
      });
    } else if (roll < att.chance + MISS_BAND) {
      // Off-target opportunity (FIRSAT).
      const shooter = att.players && att.players.length
        ? seededPick(rng, att.players, SLOT_SCORE_WEIGHTS) : null;
      const shooterName = shooter ? shooter.name : teamName;
      events.push({
        minute: att.minute,
        second: att.second,
        side: att.side,
        type: "CHANCE",
        player: shooterName,
        teamName,
        text: `${att.minute}' ${shooterName} FIRSAT`,
        shooter: shooterName,
      });
    }
    // else: blocked / cleared before it becomes an event — still counted as
    // a shot for the tally row, but nothing surfaces to the timeline.
  }

  events.sort((a, b) => a.minute - b.minute || (a.second || 0) - (b.second || 0));

  // Possession: nudged by the midfield gap with a bit of noise.
  const possBase = 0.5 + 0.007 * (homeStrength.midfield - awayStrength.midfield);
  const possessionHome = Math.max(30, Math.min(70,
    Math.round(possBase * 100 + (rng() - 0.5) * 6)
  ));

  const aXg = +aXgSum.toFixed(2);
  const bXg = +bXgSum.toFixed(2);

  const homePlayerStats = buildSidePlayerStats(homePlayers, events, "home", aScore, bScore, home.name);
  const awayPlayerStats = buildSidePlayerStats(awayPlayers, events, "away", bScore, aScore, away.name);
  let userPlayerStats = null;
  if (homeIsUser && homePlayerStats) userPlayerStats = homePlayerStats;
  else if (awayIsUser && awayPlayerStats) userPlayerStats = awayPlayerStats;

  return {
    home: { name: home.name, score: aScore, shots: aShots, onTarget: aOn, xg: aXg, possession: possessionHome },
    away: { name: away.name, score: bScore, shots: bShots, onTarget: bOn, xg: bXg, possession: 100 - possessionHome },
    events,
    full: { aScore, bScore },
    homePlayerStats,
    awayPlayerStats,
    userPlayerStats,
    _homePlayers: homePlayers,
    _awayPlayers: awayPlayers,
    _homeStrength: homeStrength,
    _awayStrength: awayStrength,
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
