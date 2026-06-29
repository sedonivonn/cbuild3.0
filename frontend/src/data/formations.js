// Formation definitions - each player slot has pitch coordinates (top/left as %)
// Pitch orientation: bottom = goalkeeper (own goal), top = opponent goal
// left/top expressed in percentages.

export const FORMATIONS = {
  "4-3-3": {
    id: "4-3-3",
    label: "4-3-3",
    description: "Hücum odaklı, kanat oyununa dayalı klasik diziliş",
    slots: [
      { id: "GK",  pos: "GK",  top: 88, left: 50 },
      { id: "LB",  pos: "LB",  top: 70, left: 14 },
      { id: "LCB", pos: "CB",  top: 74, left: 36 },
      { id: "RCB", pos: "CB",  top: 74, left: 64 },
      { id: "RB",  pos: "RB",  top: 70, left: 86 },
      { id: "LCM", pos: "CM",  top: 50, left: 28 },
      { id: "CM",  pos: "CM",  top: 54, left: 50 },
      { id: "RCM", pos: "CM",  top: 50, left: 72 },
      { id: "LW",  pos: "LW",  top: 22, left: 18 },
      { id: "ST",  pos: "ST",  top: 14, left: 50 },
      { id: "RW",  pos: "RW",  top: 22, left: 82 },
    ],
  },
  "4-2-3-1": {
    id: "4-2-3-1",
    label: "4-2-3-1",
    description: "Dengeli, çift defansif orta saha ve oyun kurucu",
    slots: [
      { id: "GK",  pos: "GK",  top: 88, left: 50 },
      { id: "LB",  pos: "LB",  top: 70, left: 14 },
      { id: "LCB", pos: "CB",  top: 74, left: 36 },
      { id: "RCB", pos: "CB",  top: 74, left: 64 },
      { id: "RB",  pos: "RB",  top: 70, left: 86 },
      { id: "LDM", pos: "CDM", top: 58, left: 36 },
      { id: "RDM", pos: "CDM", top: 58, left: 64 },
      { id: "CAM", pos: "CAM", top: 36, left: 50 },
      { id: "LM",  pos: "LW",  top: 32, left: 18 },
      { id: "RM",  pos: "RW",  top: 32, left: 82 },
      { id: "ST",  pos: "ST",  top: 14, left: 50 },
    ],
  },
  "4-4-2": {
    id: "4-4-2",
    label: "4-4-2",
    description: "Klasik İngiliz dizilişi, iki forvetli",
    slots: [
      { id: "GK",  pos: "GK",  top: 88, left: 50 },
      { id: "LB",  pos: "LB",  top: 70, left: 14 },
      { id: "LCB", pos: "CB",  top: 74, left: 36 },
      { id: "RCB", pos: "CB",  top: 74, left: 64 },
      { id: "RB",  pos: "RB",  top: 70, left: 86 },
      { id: "LM",  pos: "LM",  top: 46, left: 14 },
      { id: "LCM", pos: "CM",  top: 50, left: 38 },
      { id: "RCM", pos: "CM",  top: 50, left: 62 },
      { id: "RM",  pos: "RM",  top: 46, left: 86 },
      { id: "LST", pos: "ST",  top: 18, left: 36 },
      { id: "RST", pos: "ST",  top: 18, left: 64 },
    ],
  },
  "3-5-2": {
    id: "3-5-2",
    label: "3-5-2",
    description: "Üç stoper, kanat bekleri ileride, hücumcu",
    slots: [
      { id: "GK",  pos: "GK",  top: 88, left: 50 },
      { id: "LCB", pos: "CB",  top: 74, left: 28 },
      { id: "CCB", pos: "CB",  top: 76, left: 50 },
      { id: "RCB", pos: "CB",  top: 74, left: 72 },
      { id: "LWB", pos: "LB",  top: 50, left: 10 },
      { id: "LCM", pos: "CM",  top: 54, left: 32 },
      { id: "CM",  pos: "CDM", top: 58, left: 50 },
      { id: "RCM", pos: "CM",  top: 54, left: 68 },
      { id: "RWB", pos: "RB",  top: 50, left: 90 },
      { id: "LST", pos: "ST",  top: 18, left: 36 },
      { id: "RST", pos: "ST",  top: 18, left: 64 },
    ],
  },
  "5-3-2": {
    id: "5-3-2",
    label: "5-3-2",
    description: "Savunma odaklı, beş arka, kontrol orta saha",
    slots: [
      { id: "GK",  pos: "GK",  top: 88, left: 50 },
      { id: "LWB", pos: "LB",  top: 64, left: 8 },
      { id: "LCB", pos: "CB",  top: 74, left: 30 },
      { id: "CCB", pos: "CB",  top: 76, left: 50 },
      { id: "RCB", pos: "CB",  top: 74, left: 70 },
      { id: "RWB", pos: "RB",  top: 64, left: 92 },
      { id: "LCM", pos: "CM",  top: 48, left: 30 },
      { id: "CM",  pos: "CDM", top: 52, left: 50 },
      { id: "RCM", pos: "CM",  top: 48, left: 70 },
      { id: "LST", pos: "ST",  top: 18, left: 36 },
      { id: "RST", pos: "ST",  top: 18, left: 64 },
    ],
  },
};

// Compatibility mapping: which secondary positions can fill a slot without penalty
// Penalty levels: 0 = perfect, 1 = minor (-2), 2 = major (-6)
const FAMILY = {
  GK: ["GK"],
  LB: ["LB", "LWB", "LM", "CB"],
  RB: ["RB", "RWB", "RM", "CB"],
  LWB: ["LWB", "LB", "LM"],
  RWB: ["RWB", "RB", "RM"],
  CB: ["CB", "CDM"],
  CDM: ["CDM", "CM", "CB"],
  CM: ["CM", "CDM", "CAM"],
  CAM: ["CAM", "CM", "CF"],
  LM: ["LM", "LW", "LB"],
  RM: ["RM", "RW", "RB"],
  LW: ["LW", "LM", "ST", "CAM"],
  RW: ["RW", "RM", "ST", "CAM"],
  ST: ["ST", "CF", "LW", "RW"],
  CF: ["CF", "ST", "CAM"],
};

export function positionPenalty(slotPos, primary, secondary) {
  if (!primary) return 6;
  if (primary === slotPos) return 0;
  if (secondary === slotPos) return 1;
  const fam = FAMILY[slotPos] || [];
  if (fam.includes(primary)) return 2;
  if (fam.includes(secondary)) return 3;
  return 6;
}

// Wide attackers / midfielders are all interchangeable across left/right and across LM↔LW etc.
const WING_GROUP = new Set(["LW", "RW", "LM", "RM"]);
const WING_MIRROR = { LW: "RW", RW: "LW", LM: "RM", RM: "LM" };

// STRICT placement rule with broad wing flexibility:
// A player can be placed where slot.pos matches their primary OR secondary,
// OR if both slot.pos and (player.primary or player.secondary) are wing positions
// — wingers and wide midfielders are interchangeable across all 4 flank slots.
export function canPlace(slotPos, player) {
  if (!player) return false;
  if (slotPos === player.primary || slotPos === player.secondary) return true;
  if (WING_GROUP.has(slotPos) && (WING_GROUP.has(player.primary) || WING_GROUP.has(player.secondary))) {
    return true;
  }
  // explicit mirror (covers cases above already, kept for clarity)
  if (slotPos === WING_MIRROR[player.primary]) return true;
  if (slotPos === WING_MIRROR[player.secondary]) return true;
  return false;
}

// Given a player and the formation+filled xi, returns true if there is at least
// one EMPTY slot in the formation where this player could legally be placed.
export function hasAvailableSlot(formation, xi, player) {
  if (!formation) return false;
  return formation.slots.some((slot, idx) => !xi[idx] && canPlace(slot.pos, player));
}


// Tactic-based positional shift. Returns a new slot with adjusted `top` (Y%).
// GEGENPRESS  → high block, attackers pinned higher up the pitch
// TIKI_TAKA   → compact, mid and attack pulled toward center
// PARK_THE_BUS → deep block, mid and attack drop back to defend
const TACTIC_SHIFTS = {
  GEGENPRESS: { GK: 0, DEF: -3, MID: -5, ATT: -4 },
  TIKI_TAKA:  { GK: 0, DEF: -2, MID:  0, ATT:  4 },
  PARK_THE_BUS:{GK: 0, DEF:  2, MID:  6, ATT:  8 },
};

const POS_GROUP = {
  GK: "GK",
  LB: "DEF", RB: "DEF", CB: "DEF", LWB: "DEF", RWB: "DEF", SW: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", LM: "MID", RM: "MID",
  LW: "ATT", RW: "ATT", ST: "ATT", CF: "ATT",
};

export function applyTacticShift(slot, tacticId) {
  if (!tacticId || !TACTIC_SHIFTS[tacticId]) return slot;
  const group = POS_GROUP[slot.pos] || "MID";
  const dy = TACTIC_SHIFTS[tacticId][group] || 0;
  // clamp top between 6 and 92 to keep within pitch bounds
  const newTop = Math.max(6, Math.min(92, slot.top + dy));
  return { ...slot, top: newTop };
}
