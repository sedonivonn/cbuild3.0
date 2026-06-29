import { TACTICS } from "../data/tactics";

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

// HARD MODE (C): user chemistry removed entirely. AI gets legacy bonus elsewhere.
const USER_CHEMISTRY = { attack: 0, midfield: 0, defense: 0, keeper: 0, overall: 0 };

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
export function simulateMatch({ home, away, homeTacticId, awayTacticId, neutral = false, homeIsUser = false, awayIsUser = false }) {
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
    // HARD MODE (C, tuned): slightly widened cap so elite teams can decisively
    // beat weaker sides without making every mismatch a blowout.
    let v = 0.10 + Math.max(-0.07, Math.min(0.13, diff * 0.012));
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
    if (goal) {
      if (sh.side === "home") aScore++;
      else bScore++;
      events.push({ minute: sh.minute, side: sh.side, type: "GOAL", text: `${sh.minute}' GOL! ${sh.side === "home" ? home.name : away.name} ${aScore}-${bScore}` });
    } else if (onTarget) {
      events.push({ minute: sh.minute, side: sh.side, type: "SAVE", text: `${sh.minute}' Müthiş kurtarış! ${sh.side === "home" ? home.name : away.name} pozisyondan dönüyor.` });
    } else if (rng() < 0.55) {
      events.push({ minute: sh.minute, side: sh.side, type: "SHOT", text: `${sh.minute}' Şut auta gitti — ${sh.side === "home" ? home.name : away.name}.` });
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

  return {
    home: { name: home.name, score: aScore, shots: aShots, onTarget: aOnTarget, xg: aXg, possession: Math.round(possessionHome) },
    away: { name: away.name, score: bScore, shots: bShots, onTarget: bOnTarget, xg: bXg, possession: 100 - Math.round(possessionHome) },
    events,
    full: { aScore, bScore },
  };
}

// Knockout: handles ET + penalties if needed
export function simulateKnockout({ home, away, homeTacticId, awayTacticId, twoLeg = true, homeIsUser = false, awayIsUser = false }) {
  if (twoLeg) {
    const leg1 = simulateMatch({ home, away, homeTacticId, awayTacticId, homeIsUser, awayIsUser });
    const leg2 = simulateMatch({ home: away, away: home, homeTacticId: awayTacticId, awayTacticId: homeTacticId, homeIsUser: awayIsUser, awayIsUser: homeIsUser });
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
    const et = simulateExtraTime({ home: away, away: home, homeTacticId: awayTacticId, awayTacticId: homeTacticId, homeIsUser: awayIsUser, awayIsUser: homeIsUser });
    leg2.home.score += et.home;
    leg2.away.score += et.away;
    leg2.events = [...(leg2.events || []), ...et.events];
    const aggA2 = leg1.home.score + leg2.away.score;
    const aggB2 = leg1.away.score + leg2.home.score;
    if (aggA2 !== aggB2) {
      return { legs: [leg1, leg2], aggregate: { a: aggA2, b: aggB2 }, et, winner: aggA2 > aggB2 ? "home" : "away", decidedBy: "extra_time" };
    }
    const pen = simulatePenalties(home, away, homeIsUser, awayIsUser);
    return { legs: [leg1, leg2], aggregate: { a: aggA2 + pen.a, b: aggB2 + pen.b }, et, penalties: pen, winner: pen.a > pen.b ? "home" : "away", decidedBy: "penalties" };
  }
  // Single match - Final
  const match = simulateMatch({ home, away, homeTacticId, awayTacticId, neutral: true, homeIsUser, awayIsUser });
  if (match.home.score !== match.away.score) {
    return { match, winner: match.home.score > match.away.score ? "home" : "away", decidedBy: "regulation" };
  }
  const et = simulateExtraTime({ home, away, homeTacticId, awayTacticId, homeIsUser, awayIsUser });
  match.home.score += et.home;
  match.away.score += et.away;
  match.events = [...(match.events || []), ...et.events];
  if (match.home.score !== match.away.score) {
    return { match, et, winner: match.home.score > match.away.score ? "home" : "away", decidedBy: "extra_time" };
  }
  const pen = simulatePenalties(home, away, homeIsUser, awayIsUser);
  return { match, et, penalties: pen, winner: pen.a > pen.b ? "home" : "away", decidedBy: "penalties" };
}

function simulateExtraTime({ home, away, homeTacticId, awayTacticId, homeIsUser = false, awayIsUser = false }) {
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
      events.push({ minute: sh.minute, side: sh.side, type: "GOAL", text: `${sh.minute}' UZATMADA GOL! ${sh.side === "home" ? home.name : away.name}` });
    } else if (Math.random() < 0.4) {
      events.push({ minute: sh.minute, side: sh.side, type: "SAVE", text: `${sh.minute}' UZATMA kurtarış!` });
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
