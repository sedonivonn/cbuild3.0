import { positionPenalty } from "../data/formations";
import { effOverall } from "../data/ballonDor";

// Returns team-overall + line strengths given an XI of {slot, player} mapping.
// xi: array of { slot: {pos}, player: {overall, primary, secondary} }
//
// HARD MODE penalty calibration (revize 21):
//   • Penalty kept MILD for defenders/attackers (-1 to -5 OVR)
//   • Midfield slots get NO position penalty (CDM/CM/CAM/LM/RM are flexible)
const PENALTY_MAP = { 0: 0, 1: 1, 2: 3, 3: 5, 6: 8 };
const MIDFIELD_SLOTS = new Set(["CDM", "CM", "CAM", "LM", "RM"]);

export function computeTeamStats(xi) {
  if (!xi || xi.length === 0) return null;

  const adjusted = xi.map(({ slot, player }) => {
    if (!player) return { value: 60, raw: 60, penalty: 6 };
    const baseOverall = effOverall(player, player._season);
    const penaltyTier = positionPenalty(slot.pos, player.primary, player.secondary);
    // No penalty for midfield slots (per user spec).
    const penaltyValue = MIDFIELD_SLOTS.has(slot.pos)
      ? 0
      : (PENALTY_MAP[penaltyTier] ?? 8);
    return {
      value: Math.max(40, baseOverall - penaltyValue),
      raw: baseOverall,
      penalty: penaltyTier,
      slot,
      player,
    };
  });

  const sum = adjusted.reduce((a, b) => a + b.value, 0);
  const overall = Math.round(sum / adjusted.length);

  // Line-by-line strengths
  const buckets = { keeper: [], defense: [], midfield: [], attack: [] };
  for (const it of adjusted) {
    const p = it.slot?.pos || "";
    if (p === "GK") buckets.keeper.push(it.value);
    else if (["CB", "LB", "RB", "LWB", "RWB"].includes(p)) buckets.defense.push(it.value);
    else if (["CDM", "CM", "CAM", "LM", "RM"].includes(p)) buckets.midfield.push(it.value);
    else buckets.attack.push(it.value);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

  return {
    overall,
    keeper: buckets.keeper[0] || 0,
    defense: avg(buckets.defense),
    midfield: avg(buckets.midfield),
    attack: avg(buckets.attack),
    adjusted,
  };
}

// For opponent (champion) teams - we have a precomputed baseOverall.
// Derive line strengths by sampling around baseOverall.
// HARD MODE (C, tuned 55/100): AI legacy reduced from +3 → +1, stage bonus halved.
// User chemistry restored to balance.
const HARD_MODE_FACTOR = 0.5;
export function stubChampionStats(champion, stageBonus = 0, legacyBonus = 1) {
  const o = champion.baseOverall + legacyBonus + stageBonus * HARD_MODE_FACTOR;
  // Slight variance, but tilted toward attack for higher-rated teams
  const rng = (seed) => {
    // deterministic pseudo-random per champion
    let h = 2166136261 ^ (champion.season * 31 + champion.club.length);
    h = Math.imul(h ^ seed, 16777619);
    return ((h >>> 0) % 1000) / 1000;
  };
  const variance = (s, range = 4) => Math.round(o + (rng(s) - 0.5) * range * 2);
  return {
    overall: o,
    keeper: Math.max(70, variance(1, 3)),
    defense: Math.max(70, variance(2, 4)),
    midfield: Math.max(70, variance(3, 4)),
    attack: Math.max(70, variance(4, 4)),
  };
}
