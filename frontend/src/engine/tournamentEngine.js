import { simulateMatch, simulateKnockout } from "./matchEngine";
import { stubChampionStats } from "./overallEngine";

// HARD MODE (C, full): per-match form modifier applied to the user's XI.
// Players tend to UNDER-perform on most match-days (range tilted negative).
function applyMatchForm(userStats) {
  if (!userStats) return userStats;
  const r = (lo, hi) => lo + Math.random() * (hi - lo);
  return {
    ...userStats,
    overall:  Math.max(50, Math.round(userStats.overall  + r(-3, 1))),
    attack:   Math.max(50, Math.round(userStats.attack   + r(-3, 1))),
    midfield: Math.max(50, Math.round(userStats.midfield + r(-3, 1))),
    defense:  Math.max(50, Math.round(userStats.defense  + r(-3, 1))),
    keeper:   Math.max(50, Math.round(userStats.keeper   + r(-3, 1))),
  };
}

// HARD MODE (C, full): 15% chance of a "knock" in a knockout tie — small line debuff.
function maybeInjury(userStats) {
  if (Math.random() >= 0.15) return userStats;
  return {
    ...userStats,
    overall:  Math.max(50, userStats.overall  - 3),
    attack:   Math.max(50, userStats.attack   - 3),
    midfield: Math.max(50, userStats.midfield - 2),
    defense:  Math.max(50, userStats.defense  - 2),
  };
}

// Compute table from a group of matches
export function computeStandings(group, matches) {
  const table = group.map((team) => ({ team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }));
  const get = (t) => table.find((r) => r.team.id === t.id);
  for (const m of matches) {
    const a = get(m.home);
    const b = get(m.away);
    if (!a || !b) continue;
    a.P++; b.P++;
    a.GF += m.result.home.score;
    a.GA += m.result.away.score;
    b.GF += m.result.away.score;
    b.GA += m.result.home.score;
    if (m.result.home.score > m.result.away.score) { a.W++; b.L++; a.Pts += 3; }
    else if (m.result.home.score < m.result.away.score) { b.W++; a.L++; b.Pts += 3; }
    else { a.D++; b.D++; a.Pts += 1; b.Pts += 1; }
    a.GD = a.GF - a.GA;
    b.GD = b.GF - b.GA;
  }
  table.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF);
  return table;
}

// Build knockout bracket from group winners + runners-up
export function buildR16(standings) {
  const winners = standings.map((s) => s[0].team); // 8 group winners
  const runners = standings.map((s) => s[1].team); // 8 group runners-up
  // Simple cross-pairing: W(group i) vs R(group (i+1)%8) but never from same group
  const pairs = [];
  for (let i = 0; i < 8; i++) {
    pairs.push({ home: winners[i], away: runners[(i + 4) % 8] });
  }
  return pairs;
}

// Apply tactic for opponent: AI picks a tactic depending on overall diff vs user
export function aiPickTactic(opponentStats, userStats) {
  const diff = opponentStats.overall - userStats.overall;
  if (diff > 4) return "TIKI_TAKA"; // dominant team controls
  if (diff < -4) return "PARK_THE_BUS"; // weaker side parks
  // mid: random
  const opts = ["GEGENPRESS", "TIKI_TAKA", "PARK_THE_BUS"];
  return opts[Math.floor(Math.random() * opts.length)];
}

export function playGroupMatch(homeRef, awayRef, userStats, userTacticId, isUserTeam) {
  // Apply per-match form to user XI (HARD MODE C).
  const userForm = applyMatchForm(userStats);
  // Build per-side stats
  const home = isUserTeam(homeRef) ? { ...userForm, name: homeRef.label } : { ...stubChampionStats(homeRef), name: homeRef.label };
  const away = isUserTeam(awayRef) ? { ...userForm, name: awayRef.label } : { ...stubChampionStats(awayRef), name: awayRef.label };
  const homeTactic = isUserTeam(homeRef) ? userTacticId : aiPickTactic(home, away);
  const awayTactic = isUserTeam(awayRef) ? userTacticId : aiPickTactic(away, home);
  const result = simulateMatch({
    home, away, homeTacticId: homeTactic, awayTacticId: awayTactic,
    homeIsUser: isUserTeam(homeRef), awayIsUser: isUserTeam(awayRef),
  });
  return { home: homeRef, away: awayRef, result, homeTactic, awayTactic };
}

export function playKnockout(homeRef, awayRef, userStats, userTacticId, isUserTeam, twoLeg = true, stageBonus = 0) {
  // HARD MODE (C): form + possible injury for user team this tie.
  const userForm = maybeInjury(applyMatchForm(userStats));
  const home = isUserTeam(homeRef) ? { ...userForm, name: homeRef.label } : { ...stubChampionStats(homeRef, stageBonus), name: homeRef.label };
  const away = isUserTeam(awayRef) ? { ...userForm, name: awayRef.label } : { ...stubChampionStats(awayRef, stageBonus), name: awayRef.label };
  const homeTactic = isUserTeam(homeRef) ? userTacticId : aiPickTactic(home, away);
  const awayTactic = isUserTeam(awayRef) ? userTacticId : aiPickTactic(away, home);
  const tie = simulateKnockout({
    home, away, homeTacticId: homeTactic, awayTacticId: awayTactic, twoLeg,
    homeIsUser: isUserTeam(homeRef), awayIsUser: isUserTeam(awayRef),
  });
  return { home: homeRef, away: awayRef, tie, homeTactic, awayTactic };
}
