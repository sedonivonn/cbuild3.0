import { TACTICS } from "../data/tactics";
import { pickScorerAndAssist, computePlayerRatings } from "./playerStats";

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

// xG model: each side accumulates expected goals based on attack vs (defense + keeper).
// Tempo and risk influence variance and number of chances.
// Optional `homePlayers` / `awayPlayers` arrays (user XI) enable goal attribution.
export function simulateMatch({ home, away, homeTacticId, awayTacticId, neutral = false, homeIsUser = false, awayIsUser = false, homePlayers = null, awayPlayers = null }) {
  const A = applyTactic(applyChemistry(home, homeIsUser), homeTacticId);
  const B = applyTactic(applyChemistry(away, awayIsUser), awayTacticId);

  // home advantage
  const ha = neutral ? 0 : 1.5;

  // Counter modifiers (small)
  const aCounter = counterBonus(homeTacticId, awayTacticId);
  const bCounter = counterBonus(awayTacticId, homeTacticId);

  // Base attacking strength differential
  const aAtk = A.attack + ha + aCounter;
  const bAtk = B.attack       + bCounter;
  const aDef = (A.defense * 0.6 + A.keeper * 0.4);
  const bDef = (B.defense * 0.6 + B.keeper * 0.4);

  // Chance count from midfield dominance and tempo
  const tempo = (A.tactic.mods.tempo + B.tactic.mods.tempo) / 2;
  const midDom = (A.midfield - B.midfield) / 10;
  const totalChances = Math.max(6, Math.round(13 * tempo + (rng() - 0.5) * 4));
  const aShare = 0.5 + Math.tanh(midDom / 2) * 0.22;
  const aShots = Math.max(2, Math.round(totalChances * aShare));
  const bShots = Math.max(2, totalChances - aShots);

  // xG per shot: depends on (Attack - Defense)
  const xgPerShot = (atk, def, tacticXgFor, oppoXgAgainst) => {
    const diff = atk - def;
    // HARD MODE (C, full): widened cap so elite teams decisively beat weaker sides.
    let v = 0.10 + Math.max(-0.08, Math.min(0.15, diff * 0.013));
    v *= tacticXgFor;
    v *= oppoXgAgainst;
    return Math.max(0.04, v);
  };

  let aXgPer = xgPerShot(aAtk, bDef, A.tactic.mods.xgFor, B.tactic.mods.xgAgainst);
  let bXgPer = xgPerShot(bAtk, aDef, B.tactic.mods.xgFor, A.tactic.mods.xgAgainst);
  // Underdog boost neutralised in HARD MODE — calls retained for signature compat.
  if (homeIsUser) aXgPer += underdogBoost();
  if (awayIsUser) bXgPer += underdogBoost();

  const aXg = +(aShots * aXgPer).toFixed(2);
  const bXg = +(bShots * bXgPer).toFixed(2);

  // Generate minute-by-minute events.
  const events = [];
  let aScore = 0, bScore = 0;
  let aOnTarget = 0, bOnTarget = 0;

  const minuteShots = [];
  for (let i = 0; i < aShots; i++) minuteShots.push({ side: "home", minute: 1 + Math.floor(rng() * 90) });
  for (let i = 0; i < bShots; i++) minuteShots.push({ side: "away", minute: 1 + Math.floor(rng() * 90) });
  minuteShots.sort((a, b) => a.minute - b.minute);

  for (const sh of minuteShots) {
    const xg = sh.side === "home" ? aXgPer : bXgPer;
    const onTarget = rng() < 0.42 + Math.min(0.18, xg);
    if (sh.side === "home") {
      if (onTarget) aOnTarget++;
    } else {
      if (onTarget) bOnTarget++;
    }
    const goal = onTarget && rng() < xg / Math.max(0.05, xg + 0.18);
    const shootingPlayers = sh.side === "home" ? homePlayers : awayPlayers;
    if (goal) {
      if (sh.side === "home") aScore++;
      else bScore++;
      // Attribute scorer/assist when the scoring side has a known XI (the user side).
      let scorerName = null;
      let assistName = null;
      if (shootingPlayers && shootingPlayers.length > 0) {
        const { scorer, assist } = pickScorerAndAssist(shootingPlayers);
        if (scorer) scorerName = scorer.name;
        if (assist) assistName = assist.name;
      }
      const teamName = sh.side === "home" ? home.name : away.name;
      const goalText = scorerName
        ? `${sh.minute}' GOL! ${scorerName} (${teamName}) ${aScore}-${bScore}${assistName ? ` · asist: ${assistName}` : ""}`
        : `${sh.minute}' GOL! ${teamName} ${aScore}-${bScore}`;
      events.push({
        minute: sh.minute, side: sh.side, type: "GOAL", text: goalText,
        scorer: scorerName, assist: assistName, critical: true,
      });
    } else if (onTarget) {
      // Attribute a shooter (weighted by scoring tendency × OVR) for the animation panel.
      let shooterName = null;
      if (shootingPlayers && shootingPlayers.length > 0) {
        const pick = pickScorerAndAssist(shootingPlayers);
        if (pick.scorer) shooterName = pick.scorer.name;
      }
      // ~40% of saves are marked "critical" → drive the shot-flight animation.
      const isCritical = rng() < 0.40;
      const teamName = sh.side === "home" ? home.name : away.name;
      const text = shooterName
        ? `${sh.minute}' Kaçan fırsat: ${shooterName} (${teamName}) — kaleci kurtardı.`
        : `${sh.minute}' Müthiş kurtarış! ${teamName} pozisyondan dönüyor.`;
      events.push({
        minute: sh.minute, side: sh.side, type: "SAVE", text,
        shooter: shooterName, critical: isCritical,
      });
    } else if (rng() < 0.55) {
      let shooterName = null;
      if (shootingPlayers && shootingPlayers.length > 0) {
        const pick = pickScorerAndAssist(shootingPlayers);
        if (pick.scorer) shooterName = pick.scorer.name;
      }
      const teamName = sh.side === "home" ? home.name : away.name;
      const text = shooterName
        ? `${sh.minute}' Şut auta gitti — ${shooterName} (${teamName}).`
        : `${sh.minute}' Şut auta gitti — ${teamName}.`;
      events.push({
        minute: sh.minute, side: sh.side, type: "SHOT", text,
        shooter: shooterName, critical: false,
      });
    }
  }

  // Possession from midfield + tempo of tiki-taka
  const possessionHome = Math.max(28, Math.min(72,
    50 + (A.midfield - B.midfield) * 0.7 +
    (A.tactic.id === "TIKI_TAKA" ? 6 : 0) -
    (B.tactic.id === "TIKI_TAKA" ? 6 : 0) -
    (A.tactic.id === "PARK_THE_BUS" ? 8 : 0) +
    (B.tactic.id === "PARK_THE_BUS" ? 8 : 0)
  ));

  events.sort((a, b) => a.minute - b.minute);

  // Per-player ratings for BOTH sides (when their XI is provided).
  // The user side keeps its legacy `userPlayerStats` alias for back-compat.
  const homePlayerStats = buildSidePlayerStats(homePlayers, events, "home", aScore, bScore, home.name);
  const awayPlayerStats = buildSidePlayerStats(awayPlayers, events, "away", bScore, aScore, away.name);
  let userPlayerStats = null;
  if (homeIsUser && homePlayerStats) userPlayerStats = homePlayerStats;
  else if (awayIsUser && awayPlayerStats) userPlayerStats = awayPlayerStats;

  return {
    home: { name: home.name, score: aScore, shots: aShots, onTarget: aOnTarget, xg: aXg, possession: Math.round(possessionHome) },
    away: { name: away.name, score: bScore, shots: bShots, onTarget: bOnTarget, xg: bXg, possession: 100 - Math.round(possessionHome) },
    events,
    full: { aScore, bScore },
    // Per-side player stats — used for POTM (best of either side).
    homePlayerStats,
    awayPlayerStats,
    userPlayerStats,
    // Stash the player arrays on the leg so ET recompute can rebuild stats.
    _homePlayers: homePlayers,
    _awayPlayers: awayPlayers,
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
