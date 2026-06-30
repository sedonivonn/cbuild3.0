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
      { id: "LCM", pos: "CM",  top: 48, left: 22 },
      { id: "CM",  pos: "CM",  top: 58, left: 50 },
      { id: "RCM", pos: "CM",  top: 48, left: 78 },
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

// Tactic-based ROLE + POSITION overrides per formation (FC 26 styled presets).
// Keys: formation id → tactic id → { slotId: { pos?, top?, left? } }
// - pos: override the displayed label only (placement compatibility still uses slot.pos)
// - top / left: absolute pitch coordinates that REPLACE the group shift for that slot
//
// Football logic:
// - GEGENPRESS  ≈ FC26 "ATAK"  (high block, attacking presets, #10 pushed up)
// - TIKI_TAKA   ≈ FC26 "DENGE" / possession (single pivot anchor, controlled)
// - PARK_THE_BUS ≈ FC26 "SAVUNMA" (deep block, double pivot, compact mid)
export const TACTIC_POS_OVERRIDES = {
  "4-3-3": {
    // Base: LCM(top:48), CM(top:58, deepest), RCM(top:48), LW(22), ST(14), RW(22)
    GEGENPRESS: {
      // 4-3-3 ATAK: deepest central mid becomes a #10 and jumps ahead of the other two CMs
      CM:  { pos: "CAM", top: 34 },
      LCM: { top: 50 },
      RCM: { top: 50 },
      LW:  { top: 18 },
      RW:  { top: 18 },
      ST:  { top: 10 },
    },
    TIKI_TAKA: {
      // 4-3-3 DENGE: single pivot in front of the back four, two free 8s
      CM:  { pos: "CDM", top: 62 },
      LCM: { top: 46 },
      RCM: { top: 46 },
    },
    PARK_THE_BUS: {
      // 4-5-1 shell: triple pivot deep, wingers tracked back
      LCM: { pos: "CDM", top: 58 },
      CM:  { pos: "CDM", top: 64 },
      RCM: { pos: "CDM", top: 58 },
      LW:  { top: 34 },
      RW:  { top: 34 },
      ST:  { top: 26 },
    },
  },
  "4-2-3-1": {
    // Base: LDM(58, CDM), RDM(58, CDM), CAM(36), LM(32, LW), RM(32, RW), ST(14)
    GEGENPRESS: {
      // Box-to-box pivots push higher, CAM hugs the ST
      LDM: { pos: "CM", top: 50 },
      RDM: { pos: "CM", top: 50 },
      CAM: { top: 28 },
      ST:  { top: 10 },
    },
    TIKI_TAKA: {
      // Asymmetric pivot: one CDM holds, the other plays as a CM
      LDM: { pos: "CDM", top: 60 },
      RDM: { pos: "CM",  top: 52 },
    },
    PARK_THE_BUS: {
      // CAM drops to CM, wide attackers track as wide midfielders
      CAM: { pos: "CM", top: 48 },
      LM:  { pos: "LM", top: 42 },
      RM:  { pos: "RM", top: 42 },
      ST:  { top: 22 },
    },
  },
  "4-4-2": {
    // Base: LM(46), LCM(50), RCM(50), RM(46), LST(18), RST(18)
    GEGENPRESS: {
      // 4-4-2 ATAK: asymmetric — one CM advances to a #10 role
      LCM: { top: 48 },
      RCM: { pos: "CAM", top: 32 },
      LST: { top: 12 },
      RST: { top: 12 },
    },
    TIKI_TAKA: {
      // Holding mid + box-to-box (Pirlo-style deep playmaker on the left)
      LCM: { pos: "CDM", top: 58 },
      RCM: { top: 48 },
    },
    PARK_THE_BUS: {
      // Flat 4-4-2 block, double pivot
      LCM: { pos: "CDM", top: 58 },
      RCM: { pos: "CDM", top: 58 },
      LM:  { top: 52 },
      RM:  { top: 52 },
      LST: { top: 24 },
      RST: { top: 24 },
    },
  },
  "3-5-2": {
    // Base: LCM(54, CM), CM(58, CDM), RCM(54, CM), LWB(50), RWB(50), LST(18), RST(18)
    GEGENPRESS: {
      // Mezzala duo high, single pivot holds the middle
      LCM: { pos: "CAM", top: 36 },
      RCM: { pos: "CAM", top: 36 },
      CM:  { pos: "CM",  top: 52 },
      LWB: { top: 42 },
      RWB: { top: 42 },
      LST: { top: 14 },
      RST: { top: 14 },
    },
    TIKI_TAKA: {
      // Diamond-ish: CDM anchor, two CMs balanced
      LCM: { top: 50 },
      RCM: { top: 50 },
    },
    PARK_THE_BUS: {
      // Triple defensive mid in front of back three
      LCM: { pos: "CDM", top: 58 },
      CM:  { pos: "CDM", top: 62 },
      RCM: { pos: "CDM", top: 58 },
      LWB: { top: 58 },
      RWB: { top: 58 },
    },
  },
  "5-3-2": {
    // Base: LWB(64), LCB(74), CCB(76), RCB(74), RWB(64), LCM(48), CM(52, CDM), RCM(48), LST(18), RST(18)
    GEGENPRESS: {
      // Push wing-backs much higher, mezzalas as attacking mids
      LCM: { pos: "CAM", top: 36 },
      RCM: { pos: "CAM", top: 36 },
      CM:  { top: 50 },
      LWB: { top: 46 },
      RWB: { top: 46 },
      LST: { top: 12 },
      RST: { top: 12 },
    },
    TIKI_TAKA: {
      // Controlled — keep the anchor, mids stay balanced
      LCM: { top: 48 },
      RCM: { top: 48 },
    },
    PARK_THE_BUS: {
      // Ultra-deep block, double pivot in front of back five
      LCM: { pos: "CDM", top: 56 },
      RCM: { pos: "CDM", top: 56 },
      LWB: { top: 70 },
      RWB: { top: 70 },
      LST: { top: 26 },
      RST: { top: 26 },
    },
  },
};

export function applyTacticShift(slot, tacticId, formationId = null) {
  if (!tacticId || !TACTIC_SHIFTS[tacticId]) {
    return { ...slot, displayPos: slot.pos };
  }
  // Look up explicit override for this slot under this formation+tactic
  let override = null;
  if (formationId && TACTIC_POS_OVERRIDES[formationId]) {
    const map = TACTIC_POS_OVERRIDES[formationId][tacticId] || {};
    override = map[slot.id] || null;
  }
  // Default top: apply the group shift unless override gives an absolute value
  let newTop;
  if (override && typeof override.top === "number") {
    newTop = override.top;
  } else {
    const group = POS_GROUP[slot.pos] || "MID";
    const dy = TACTIC_SHIFTS[tacticId][group] || 0;
    newTop = slot.top + dy;
  }
  newTop = Math.max(6, Math.min(92, newTop));
  const newLeft = override && typeof override.left === "number" ? override.left : slot.left;
  const displayPos = override && override.pos ? override.pos : slot.pos;
  return { ...slot, top: newTop, left: newLeft, displayPos };
}
