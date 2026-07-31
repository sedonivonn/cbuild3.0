/**
 * pitchSim.js — deterministic 2D top-down football simulation.
 *
 * Single source of truth for match events. Used both by the headless
 * `simulateMatch()` in matchEngine.js (which loops until the game is over
 * to compute the definitive score/events) AND by CanvasMatch.tsx (which
 * runs the exact same physics at real-time using a fixed-dt accumulator
 * so the visible pitch and the tournament's stored result stay perfectly
 * synchronised).
 *
 * Determinism guarantees:
 *   - The only random source is `state.rng` (mulberry32 seeded PRNG).
 *   - No `Math.random`, no `performance.now`, no `Date.now` reads.
 *   - dt is always the fixed step FIXED_DT.
 *   - Ordering of events is stable per tick.
 *
 * Public API:
 *   FIXED_DT, TOTAL_TICKS, MATCH_MINUTES
 *   mulberry32(seed) → () => float in [0,1)
 *   createPitchState({ home, away, homePlayers, awayPlayers, ... }) → SimState
 *   stepPitch(state) → { events: Event[], gameOver: boolean, minute: number }
 */

// ---------------------------------------------------------------------------
// Time model
// ---------------------------------------------------------------------------
// Physics runs at 60Hz. A 90-minute match compresses to ~30 real seconds so
// each viewing feels tight but readable. 20 ticks == 1 game-minute.
export const FIXED_DT = 1 / 60;
export const MATCH_MINUTES = 90;
export const TICKS_PER_MINUTE = 20;
export const TOTAL_TICKS = MATCH_MINUTES * TICKS_PER_MINUTE; // 1800

// ---------------------------------------------------------------------------
// World constants (world units 0..PITCH_W × 0..PITCH_H)
// ---------------------------------------------------------------------------
export const PITCH_W = 100;
export const PITCH_H = 60;
export const GOAL_TOP = 25;
export const GOAL_BOT = 35;
export const R = 1.35;
export const BALL_R = 0.65;

const HOME_FORMATION = [
  [ 6, 30],
  [18,  8], [18, 22], [18, 38], [18, 52],
  [32, 18], [32, 30], [32, 42],
  [46,  9], [50, 30], [46, 51],
];
const mirrorX = (p) => [PITCH_W - p[0], p[1]];
const AWAY_FORMATION = HOME_FORMATION.map(mirrorX);

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — small, fast, well-distributed.
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Extract a rough "overall" rating from an XI-slot player object. Falls back
// to 78 for unknown discs so opponents without players data still feel varied.
function ovrOf(p) {
  if (!p) return 78;
  return Math.max(60, Math.min(99, p.overall || 78));
}

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------
/**
 * @param {{
 *   homeName: string, awayName: string,
 *   homePlayers: any[]|null, awayPlayers: any[]|null,
 *   homeStrength?: { attack:number, midfield:number, defense:number, keeper:number },
 *   awayStrength?: { attack:number, midfield:number, defense:number, keeper:number },
 *   seed: number,
 * }} cfg
 */
export function createPitchState(cfg) {
  const {
    homeName, awayName,
    homePlayers, awayPlayers,
    homeStrength, awayStrength,
    seed,
  } = cfg;

  const rng = mulberry32(seed);

  const buildSide = (side, formation, players) => {
    return formation.map((p, i) => ({
      side,
      number: i + 1,
      isGK: i === 0,
      x: p[0], y: p[1],
      vx: 0, vy: 0,
      home: [p[0], p[1]],
      ovr: ovrOf(players?.[i]),
      lastTouchTick: -1, // used for assist attribution
    }));
  };

  const discs = [
    ...buildSide("home", HOME_FORMATION, homePlayers),
    ...buildSide("away", AWAY_FORMATION, awayPlayers),
  ];

  const ball = {
    x: PITCH_W / 2, y: PITCH_H / 2,
    vx: 0, vy: 0,
    ownerIdx: null,
    prevOwnerIdx: null,       // for assists
    prevOwnerSide: null,
    prevOwnerTick: -999,
    holdTime: 0,
  };

  return {
    seed,
    rng,
    tick: 0,
    discs,
    ball,
    // Team meta
    homeName, awayName,
    homePlayers: homePlayers || null,
    awayPlayers: awayPlayers || null,
    strH: homeStrength || { attack: 80, midfield: 80, defense: 80, keeper: 80 },
    strA: awayStrength || { attack: 80, midfield: 80, defense: 80, keeper: 80 },
    // Live tally
    aScore: 0, bScore: 0,
    aShots: 0, bShots: 0,
    aOnTarget: 0, bOnTarget: 0,
    aPossessionTicks: 0, bPossessionTicks: 0,
    // Play state
    possession: "home",              // whose kickoff / who last held the ball
    sinceLastPass: 0,                // seconds since last pass
    kickoffTimer: 0.8,               // brief freeze at kickoffs
    kickoffFor: "home",              // team that kicks off
    pendingShotTick: -1,             // tick when a shot was fired (for save physics)
    shooterIdxAtShot: null,
    shotTypePlanned: null,           // "GOAL" | "SAVE" | "SHOT" hint for keeper AI
    gameOver: false,
    minute: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findNearestDisc(state, x, y, side) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < state.discs.length; i++) {
    const d = state.discs[i];
    if (side && d.side !== side) continue;
    const dd = dist(d.x, d.y, x, y);
    if (dd < bestD) { bestD = dd; best = i; }
  }
  return { idx: best, dist: bestD };
}

function playerNameFor(state, disc) {
  const list = disc.side === "home" ? state.homePlayers : state.awayPlayers;
  const idx = disc.number - 1;
  return list && list[idx] ? list[idx].name : null;
}
function teamNameFor(state, side) {
  return side === "home" ? state.homeName : state.awayName;
}

// Kickoff freeze: recentre ball, hand to `sideKickoff`, retreat discs.
function resetKickoff(state, sideKickoff) {
  state.ball.x = PITCH_W / 2;
  state.ball.y = PITCH_H / 2;
  state.ball.vx = 0; state.ball.vy = 0;
  state.ball.ownerIdx = null;
  state.ball.prevOwnerIdx = null;
  state.ball.prevOwnerSide = null;
  state.ball.prevOwnerTick = -999;
  state.ball.holdTime = 0;
  state.possession = sideKickoff;
  state.sinceLastPass = 0;
  state.kickoffTimer = 0.8;
  state.kickoffFor = sideKickoff;
  // Discs snap toward their home positions during the freeze.
}

// ---------------------------------------------------------------------------
// Core AI + physics step. Advances one FIXED_DT tick.
// Returns { events: [...], gameOver, minute }.
// ---------------------------------------------------------------------------
export function stepPitch(state) {
  const dt = FIXED_DT;
  const rng = state.rng;
  const events = [];

  state.tick += 1;
  state.minute = Math.min(MATCH_MINUTES, Math.floor(state.tick / TICKS_PER_MINUTE));
  if (state.tick >= TOTAL_TICKS) state.gameOver = true;

  const { discs, ball } = state;

  // ---- Kickoff freeze ---------------------------------------------------
  if (state.kickoffTimer > 0) {
    state.kickoffTimer -= dt;
    discs.forEach((d) => {
      d.vx = (d.home[0] - d.x) * 3.0;
      d.vy = (d.home[1] - d.y) * 3.0;
      // Speed cap
      const s = Math.hypot(d.vx, d.vy);
      if (s > 22) { d.vx = (d.vx / s) * 22; d.vy = (d.vy / s) * 22; }
      d.x = clamp(d.x + d.vx * dt, 1, PITCH_W - 1);
      d.y = clamp(d.y + d.vy * dt, 1, PITCH_H - 1);
    });
    // Ball parked at centre during freeze.
    ball.x = PITCH_W / 2; ball.y = PITCH_H / 2; ball.vx = 0; ball.vy = 0;
    // At the end of the freeze, hand ball to the mid-centre disc of the kickoff side.
    if (state.kickoffTimer <= 0) {
      const centres = discs
        .map((d, i) => ({ d, i }))
        .filter((o) => o.d.side === state.kickoffFor && !o.d.isGK)
        .sort((a, b) => Math.abs(PITCH_W / 2 - a.d.x) - Math.abs(PITCH_W / 2 - b.d.x));
      if (centres.length > 0) {
        const c = centres[0];
        ball.x = c.d.x; ball.y = c.d.y;
        ball.ownerIdx = c.i;
        c.d.lastTouchTick = state.tick;
        state.possession = c.d.side;
      }
    }
    return { events, gameOver: state.gameOver, minute: state.minute };
  }

  // ---- 1) Ball physics --------------------------------------------------
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const drag = 0.55;
  ball.vx *= Math.exp(-drag * dt);
  ball.vy *= Math.exp(-drag * dt);
  if (ball.y < 0.6) { ball.y = 0.6; ball.vy = Math.abs(ball.vy) * 0.5; }
  if (ball.y > PITCH_H - 0.6) { ball.y = PITCH_H - 0.6; ball.vy = -Math.abs(ball.vy) * 0.5; }

  // ---- 2) Goal detection (ball crosses either goal line inside the frame)
  const crossedLeft  = ball.x <= 0.4 && ball.y > GOAL_TOP && ball.y < GOAL_BOT;
  const crossedRight = ball.x >= PITCH_W - 0.4 && ball.y > GOAL_TOP && ball.y < GOAL_BOT;
  if (crossedLeft || crossedRight) {
    const scoringSide = crossedRight ? "home" : "away";
    // Attribute scorer/assist based on who last touched the ball.
    let scorerName = null, assistName = null;
    const shooter = state.shooterIdxAtShot != null ? discs[state.shooterIdxAtShot] : null;
    if (shooter && shooter.side === scoringSide) {
      scorerName = playerNameFor(state, shooter);
      const prev = ball.prevOwnerIdx;
      if (prev != null && discs[prev].side === scoringSide && prev !== state.shooterIdxAtShot) {
        assistName = playerNameFor(state, discs[prev]);
      }
    }
    if (scoringSide === "home") { state.aScore += 1; state.aOnTarget += 1; state.aShots += 1; }
    else { state.bScore += 1; state.bOnTarget += 1; state.bShots += 1; }
    const teamName = teamNameFor(state, scoringSide);
    const text = scorerName
      ? `${state.minute}' GOL! ${scorerName} (${teamName}) ${state.aScore}-${state.bScore}${assistName ? ` · asist: ${assistName}` : ""}`
      : `${state.minute}' GOL! ${teamName} ${state.aScore}-${state.bScore}`;
    events.push({
      minute: state.minute, side: scoringSide, type: "GOAL", text,
      scorer: scorerName, assist: assistName, critical: true,
    });
    // Restart with kickoff to the conceding team.
    resetKickoff(state, scoringSide === "home" ? "away" : "home");
    state.pendingShotTick = -1;
    state.shooterIdxAtShot = null;
    state.shotTypePlanned = null;
    return { events, gameOver: state.gameOver, minute: state.minute };
  }

  // Out of play beyond the goal line (off target) → SHOT event + throw-in.
  if (ball.x < 0 || ball.x > PITCH_W) {
    if (state.shooterIdxAtShot != null) {
      const shooter = discs[state.shooterIdxAtShot];
      const shooterName = playerNameFor(state, shooter);
      const teamName = teamNameFor(state, shooter.side);
      const text = shooterName
        ? `${state.minute}' Şut auta gitti — ${shooterName} (${teamName}).`
        : `${state.minute}' Şut auta gitti — ${teamName}.`;
      events.push({
        minute: state.minute, side: shooter.side, type: "SHOT", text,
        shooter: shooterName, critical: false,
      });
      if (shooter.side === "home") state.aShots += 1; else state.bShots += 1;
    }
    // Ball reset at conceding side's goal area with the keeper.
    const kickerSide = ball.x < 0 ? "home" : "away";
    const gk = discs.find((d) => d.isGK && d.side === kickerSide);
    if (gk) {
      ball.x = gk.x + (kickerSide === "home" ? 3 : -3);
      ball.y = gk.y;
      ball.vx = 0; ball.vy = 0;
      ball.ownerIdx = discs.indexOf(gk);
      gk.lastTouchTick = state.tick;
      state.possession = kickerSide;
    }
    state.pendingShotTick = -1;
    state.shooterIdxAtShot = null;
    state.shotTypePlanned = null;
  }

  // ---- 3) Ownership acquisition (loose ball) ----------------------------
  const bspeed = Math.hypot(ball.vx, ball.vy);
  if (ball.ownerIdx === null) {
    const near = findNearestDisc(state, ball.x, ball.y);
    // Goalkeeper claim: if a keeper reaches the ball while a shot is in the
    // air and it's within his box, count as SAVE.
    if (near.idx !== -1 && near.dist < 1.85) {
      const claimer = discs[near.idx];
      if (
        state.pendingShotTick > -1 &&
        claimer.isGK &&
        claimer.side !== (state.shooterIdxAtShot != null ? discs[state.shooterIdxAtShot].side : null)
      ) {
        // SAVE!
        const shooter = discs[state.shooterIdxAtShot];
        const shooterName = playerNameFor(state, shooter);
        const teamName = teamNameFor(state, shooter.side);
        if (shooter.side === "home") { state.aShots += 1; state.aOnTarget += 1; }
        else { state.bShots += 1; state.bOnTarget += 1; }
        const text = shooterName
          ? `${state.minute}' Kaçan fırsat: ${shooterName} (${teamName}) — kaleci kurtardı.`
          : `${state.minute}' Müthiş kurtarış! ${teamName} pozisyondan dönüyor.`;
        events.push({
          minute: state.minute, side: shooter.side, type: "SAVE", text,
          shooter: shooterName, critical: rng() < 0.4,
        });
        // Keeper claims the ball.
        ball.ownerIdx = near.idx;
        ball.prevOwnerIdx = state.shooterIdxAtShot;
        ball.prevOwnerSide = shooter.side;
        ball.prevOwnerTick = state.tick;
        ball.holdTime = 0;
        ball.vx = 0; ball.vy = 0;
        claimer.lastTouchTick = state.tick;
        state.possession = claimer.side;
        state.pendingShotTick = -1;
        state.shooterIdxAtShot = null;
        state.shotTypePlanned = null;
      } else if (bspeed < 5) {
        // Normal loose-ball pickup at low speed.
        const newOwner = claimer;
        // Tackle/interception commentary if it flips possession from a
        // recent carrier.
        const prevSide = ball.prevOwnerSide;
        if (prevSide && prevSide !== newOwner.side && state.tick - ball.prevOwnerTick < 30) {
          const cutterName = playerNameFor(state, newOwner);
          const teamName = teamNameFor(state, newOwner.side);
          const text = cutterName
            ? `${state.minute}' Top kesildi — ${cutterName} (${teamName}) baskıyı bozdu.`
            : `${state.minute}' Top kesildi — ${teamName}.`;
          events.push({
            minute: state.minute, side: newOwner.side, type: "TACKLE", text,
            shooter: cutterName, critical: false,
          });
        }
        ball.ownerIdx = near.idx;
        ball.prevOwnerIdx = state.shooterIdxAtShot != null ? state.shooterIdxAtShot : ball.prevOwnerIdx;
        ball.holdTime = 0;
        ball.vx = 0; ball.vy = 0;
        newOwner.lastTouchTick = state.tick;
        state.possession = newOwner.side;
        state.pendingShotTick = -1;
        state.shooterIdxAtShot = null;
        state.shotTypePlanned = null;
      }
    }
  } else {
    // Owner drags the ball with them.
    const owner = discs[ball.ownerIdx];
    ball.x = owner.x + owner.vx * 0.02;
    ball.y = owner.y + owner.vy * 0.02;
    ball.holdTime += dt;
  }

  // ---- 4) Disc AI -------------------------------------------------------
  const owner = ball.ownerIdx != null ? discs[ball.ownerIdx] : null;
  const owningSide = owner ? owner.side : state.possession;
  if (owningSide === "home") state.aPossessionTicks += 1; else state.bPossessionTicks += 1;

  const attackingRight = owningSide === "home";
  const goalX = attackingRight ? PITCH_W - 2 : 2;

  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    if (d.isGK) {
      // Anticipate incoming shots when the ball is in the box moving toward
      // this keeper's goal. Better keepers move faster and further.
      const isMyGoalSide = d.side === "home" ? ball.x < 25 : ball.x > PITCH_W - 25;
      const inbound = isMyGoalSide && (
        (d.side === "home" && ball.vx < -8) ||
        (d.side === "away" && ball.vx >  8)
      );
      let targetX = d.side === "home" ? 5 : PITCH_W - 5;
      let targetY = clamp(ball.y, 22, 38);
      if (inbound) {
        // Reflex proportional to keeper OVR. 78 = 1.0×, 90 = 1.3×.
        const reflex = 0.6 + Math.max(0, (d.ovr - 70)) / 40;
        targetX = d.side === "home"
          ? clamp(ball.x + 0.4, 3.5, 6.5)
          : clamp(ball.x - 0.4, PITCH_W - 6.5, PITCH_W - 3.5);
        targetY = clamp(ball.y + ball.vy * 0.15, GOAL_TOP - 1.5, GOAL_BOT + 1.5);
        d.vx = (targetX - d.x) * 4.5 * reflex;
        d.vy = (targetY - d.y) * 6.0 * reflex;
      } else {
        d.vx = (targetX - d.x) * 4.0;
        d.vy = (targetY - d.y) * 5.0;
      }
    } else if (owner && d === owner) {
      // Carrier drifts toward opponent goal, slower with pressure nearby.
      const nearestOpp = findNearestDisc(state, d.x, d.y, d.side === "home" ? "away" : "home");
      const pressure = nearestOpp.dist < 3.5 ? 0.4 : 1.0;
      const tx = attackingRight ? Math.min(d.x + 8, PITCH_W - 8) : Math.max(d.x - 8, 8);
      // Deterministic lateral wobble via tick+number (no time-based random).
      const wob = Math.sin((state.tick * 0.11) + (d.number * 0.7)) * 4;
      const ty = clamp(30 + wob, 6, PITCH_H - 6);
      d.vx = (tx - d.x) * 0.6 * pressure;
      d.vy = (ty - d.y) * 0.9;
    } else if (owningSide === d.side) {
      // Attacking teammate: spread ahead but keep depth on defenders.
      const isForward = d.home[0] > 40 && d.home[0] < 60;
      const shiftBase = d.side === "home" ? 10 : -10;
      const shift = isForward ? shiftBase * 1.5 : shiftBase * 0.4;
      const tx = clamp(d.home[0] + shift, 6, PITCH_W - 6);
      const wob = Math.sin((state.tick * 0.05) + (i * 0.5)) * 2;
      const ty = clamp(d.home[1] + wob, 4, PITCH_H - 4);
      d.vx = (tx - d.x) * 1.7;
      d.vy = (ty - d.y) * 1.7;
    } else {
      // Defending team: nearest 2 press ball, others shift zonally.
      // Deterministic rank calculation.
      let myRank = 0;
      const myDist = dist(d.x, d.y, ball.x, ball.y);
      for (let k = 0; k < discs.length; k++) {
        const o = discs[k];
        if (o === d || o.side !== d.side || o.isGK) continue;
        if (dist(o.x, o.y, ball.x, ball.y) < myDist) myRank += 1;
      }
      if (myRank < 2) {
        d.vx = (ball.x - d.x) * 3.4;
        d.vy = (ball.y - d.y) * 3.4;
      } else {
        const shiftY = (ball.y - 30) * 0.35;
        const tx = d.home[0];
        const ty = clamp(d.home[1] + shiftY, 4, PITCH_H - 4);
        d.vx = (tx - d.x) * 1.4;
        d.vy = (ty - d.y) * 1.4;
      }
    }
  }

  // ---- 5) Integrate discs + speed cap -----------------------------------
  const MAX_SPD = 20;
  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    const s = Math.hypot(d.vx, d.vy);
    const cap = d.isGK ? MAX_SPD * 0.9 : MAX_SPD;
    if (s > cap) { d.vx = (d.vx / s) * cap; d.vy = (d.vy / s) * cap; }
    d.x = clamp(d.x + d.vx * dt, 1, PITCH_W - 1);
    d.y = clamp(d.y + d.vy * dt, 1, PITCH_H - 1);
  }
  // Separation
  const MIN_SEP = R * 2;
  for (let a = 0; a < discs.length; a++) {
    for (let b = a + 1; b < discs.length; b++) {
      const A = discs[a], B = discs[b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < MIN_SEP * MIN_SEP) {
        const dd = Math.sqrt(d2);
        const push = (MIN_SEP - dd) * 0.5;
        const nx = dx / dd, ny = dy / dd;
        A.x -= nx * push; A.y -= ny * push;
        B.x += nx * push; B.y += ny * push;
      }
    }
  }

  // ---- 6) Pass / shot decision ------------------------------------------
  state.sinceLastPass += dt;
  if (owner && ball.holdTime > 0.7 && state.sinceLastPass > 1.1) {
    const oppSide = owner.side === "home" ? "away" : "home";
    const nearestOpp = findNearestDisc(state, owner.x, owner.y, oppSide);
    const underPressure = nearestOpp.dist < 3.0;
    const distToGoal = Math.abs(goalX - owner.x);
    const inShootRange = distToGoal < 26;

    // Shooting probability grows near goal and with attacker OVR.
    const shotBase = inShootRange ? 0.35 + (owner.ovr - 78) * 0.01 : 0;
    const willShoot = shotBase > 0 && rng() < shotBase && !owner.isGK;

    if (willShoot) {
      fireShot(state, owner, events);
      state.sinceLastPass = 0;
    } else if (underPressure || state.sinceLastPass > 2.0 + rng() * 0.6) {
      choosePass(state, owner, events);
      state.sinceLastPass = 0;
    }
  }

  return { events, gameOver: state.gameOver, minute: state.minute };
}

// ---------------------------------------------------------------------------
// Pass / shot mechanics
// ---------------------------------------------------------------------------
function choosePass(state, owner, events) {
  const { ball, discs, rng } = state;
  const attackingRight = owner.side === "home";
  const goalX = attackingRight ? PITCH_W - 2 : 2;
  const oppSide = owner.side === "home" ? "away" : "home";

  // Score every teammate by (ahead-bonus + space - toGoal - farFromCarrier).
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < discs.length; i++) {
    const t = discs[i];
    if (t === owner || t.side !== owner.side || t.isGK) continue;
    const opp = findNearestDisc(state, t.x, t.y, oppSide);
    const space = opp.dist;
    const aheadBonus = attackingRight ? (t.x - owner.x) : (owner.x - t.x);
    const toGoal = Math.abs(goalX - t.x);
    const fromCarrier = dist(t.x, t.y, owner.x, owner.y);
    const score = aheadBonus * 1.0 + space * 1.3 - toGoal * 0.7 - fromCarrier * 0.25;
    if (score > bestScore) { bestScore = score; best = { t, i }; }
  }
  if (!best) return;

  // 22% chance to pick a safer backward option for rhythm.
  if (rng() < 0.22) {
    let safe = null; let safeScore = -Infinity;
    for (let i = 0; i < discs.length; i++) {
      const t = discs[i];
      if (t === owner || t.side !== owner.side || t.isGK) continue;
      const back = attackingRight ? (owner.x - t.x) : (t.x - owner.x);
      if (back > 3 && dist(t.x, t.y, owner.x, owner.y) < 20) {
        const opp = findNearestDisc(state, t.x, t.y, oppSide);
        const s = opp.dist + back * 0.5;
        if (s > safeScore) { safeScore = s; safe = { t, i }; }
      }
    }
    if (safe) best = safe;
  }

  const dx = best.t.x - ball.x;
  const dy = best.t.y - ball.y;
  const dlen = Math.hypot(dx, dy) || 1;

  // Pass accuracy: perfect at OVR 90+, drifts more at 70. Aim at teammate
  // position with a Gaussian-ish jitter proportional to (1 - accuracy).
  const acc = 0.65 + (owner.ovr - 70) * 0.02; // 0.65..0.95
  const errMag = (1 - clamp(acc, 0.4, 0.98)) * Math.min(12, dlen * 0.4);
  const jitterX = (rng() - 0.5) * errMag;
  const jitterY = (rng() - 0.5) * errMag;

  const passSpd = 16 + rng() * 10 + Math.min(10, dlen * 0.15);
  ball.vx = (dx / dlen) * passSpd + jitterX;
  ball.vy = (dy / dlen) * passSpd + jitterY;

  ball.prevOwnerIdx = state.discs.indexOf(owner);
  ball.prevOwnerSide = owner.side;
  ball.prevOwnerTick = state.tick;
  ball.ownerIdx = null;
  ball.holdTime = 0;
  owner.lastTouchTick = state.tick;
  // No event emitted for regular passes — filler commentary lives in canvas.
}

function fireShot(state, shooter, events) {
  const { ball, discs, rng } = state;
  const attackingRight = shooter.side === "home";
  const goalX = attackingRight ? PITCH_W - 0.5 : 0.5;

  // Shot accuracy depends on shooter OVR and distance to goal.
  const dtg = Math.abs(goalX - shooter.x);
  const baseAcc = 0.55 + (shooter.ovr - 70) * 0.02 - Math.max(0, dtg - 20) * 0.015;
  const acc = clamp(baseAcc, 0.15, 0.92);

  // Aim: prefer to place away from keeper's y.
  const oppSide = shooter.side === "home" ? "away" : "home";
  const gk = discs.find((d) => d.isGK && d.side === oppSide);
  let aimY;
  if (gk) {
    aimY = gk.y > 30 ? 25.7 + rng() * 2.6 : 34.3 - rng() * 2.6;
  } else {
    aimY = 26 + rng() * 8;
  }
  // Off-target jitter based on inaccuracy.
  const errY = (rng() - 0.5) * (1 - acc) * 14;
  aimY += errY;

  const dx = goalX - ball.x;
  const dy = aimY - ball.y;
  const dlen = Math.hypot(dx, dy) || 1;
  const power = 58 + rng() * 12;
  ball.vx = (dx / dlen) * power;
  ball.vy = (dy / dlen) * power;

  ball.prevOwnerIdx = ball.ownerIdx;
  ball.prevOwnerSide = shooter.side;
  ball.prevOwnerTick = state.tick;
  ball.ownerIdx = null;
  ball.holdTime = 0;
  shooter.lastTouchTick = state.tick;

  state.pendingShotTick = state.tick;
  state.shooterIdxAtShot = discs.indexOf(shooter);
  state.shotTypePlanned = null;
  // The outcome (GOAL vs SAVE vs SHOT) is now purely physics.
}
