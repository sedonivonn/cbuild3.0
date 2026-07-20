/**
 * CanvasMatch — 2D top-down HTML5 Canvas match simulation.
 *
 * Visual layer only. The authoritative match result (goals, scorer/assist,
 * saves, minute timeline) is still produced by `matchEngine.js` and drip-fed
 * from the parent (MatchScreen) via props. This component reacts:
 *   - score prop bumps → green goal-zone flash on the scoring side
 *   - each new event → commentary log line + occasional visual shot cue
 *   - speed picker  → dt multiplier for the AI simulation
 *
 * Between engine events the 22 discs free-play a haxball-flavoured AI:
 *   - Possessing team's carrier drifts toward opponent goal
 *   - Teammates spread into passing lanes
 *   - Nearest defenders press the carrier
 *   - Carrier passes to the best-placed teammate every ~1.5s
 *   - Occasional cosmetic shots
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, FastForward, Zap, Pause } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
type SpeedKey = "slow" | "normal" | "fast" | "ultra";
const SPEED_MULT: Record<SpeedKey, number> = {
  slow: 1,
  normal: 2,
  fast: 4,
  ultra: 8,
};
const SPEEDS: { key: SpeedKey; label: string; icon: any }[] = [
  { key: "slow",   label: "YAVAŞ",  icon: Pause },
  { key: "normal", label: "NORMAL", icon: Gauge },
  { key: "fast",   label: "HIZLI",  icon: FastForward },
  { key: "ultra",  label: "ULTRA",  icon: Zap },
];

export type MatchEventLite = {
  minute: number;
  side: "home" | "away";
  type: "GOAL" | "SAVE" | "SHOT" | string;
  text: string;
  critical?: boolean;
  scorer?: string | null;
  assist?: string | null;
  shooter?: string | null;
};

type CanvasMatchProps = {
  stageLabel: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  liveMinute: number | null;
  events: MatchEventLite[];        // events revealed so far
  latestEvent: MatchEventLite | null;
  speedKey: SpeedKey;
  onSpeedChange: (k: SpeedKey) => void;
};

// World coordinates: 0..PITCH_W × 0..PITCH_H (rendered onto whatever
// canvas.clientWidth/Height gives us).
const PITCH_W = 100;
const PITCH_H = 60;
const GOAL_TOP = 25;   // goal spans y=25..35 (world units)
const GOAL_BOT = 35;
const PEN_BOX = 16;    // penalty box depth in world units
const PEN_HEIGHT = 34; // penalty box height y ~ (13..47)
const PEN_TOP = 13;
const PEN_BOT = 47;

// Player disc radius in world units
const R = 1.35;
const BALL_R = 0.65;

// Base 4-3-3 formation for HOME (attacking → right).
// Away is a mirror across x = PITCH_W/2.
const HOME_FORMATION: [number, number][] = [
  [ 6, 30],  // GK
  [18,  8], [18, 22], [18, 38], [18, 52],   // back 4
  [32, 18], [32, 30], [32, 42],              // mid 3
  [46,  9], [50, 30], [46, 51],              // front 3
];
const mirror = (p: [number, number]): [number, number] => [PITCH_W - p[0], p[1]];
const AWAY_FORMATION: [number, number][] = HOME_FORMATION.map(mirror) as any;

// Colour palette
const COL = {
  turfDark:  "#0d5f2b",
  turfLight: "#118a3f",
  line:      "#ffffff",
  homeFill:  "#1e3a8a",  // dark blue
  homeBord:  "#ffffff",
  homeTxt:   "#ffffff",
  awayFill:  "#f5f5f5",  // near white
  awayBord:  "#374151",  // dark gray
  awayTxt:   "#111827",
  ball:      "#ffffff",
  ballShadow:"#000000",
  goalGlow:  "#22ff77",
};

// ---------------------------------------------------------------------------
// Filler-commentary strings that the canvas AI generates for "between-goal"
// atmosphere so the log never stalls.
// ---------------------------------------------------------------------------
const FILLER_PASS   = ["Pas.", "Kısa pas.", "Uzun top.", "Kanattan orta.", "Topla oynuyor."];
const FILLER_PRESS  = ["Baskı.", "Yüksek baskı!", "Sıkı takip.", "Faul yaptırıyor."];
const FILLER_CORNER = ["Korner kullanılıyor.", "Köşe vuruşu."];
const FILLER_THROW  = ["Taç atışı.", "Yan atışı."];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// Player + Ball state
// ---------------------------------------------------------------------------
type Disc = {
  side: "home" | "away";
  number: number;
  isGK: boolean;
  x: number; y: number;
  vx: number; vy: number;
  home: [number, number]; // base formation coord
};

type Ball = {
  x: number; y: number;
  vx: number; vy: number;
  trail: { x: number; y: number; a: number }[];
  ownerIdx: number | null; // index into discs array
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const CanvasMatch: React.FC<CanvasMatchProps> = ({
  stageLabel,
  homeName,
  awayName,
  homeScore,
  awayScore,
  liveMinute,
  events,
  latestEvent,
  speedKey,
  onSpeedChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const speedRef = useRef<SpeedKey>(speedKey);
  useEffect(() => { speedRef.current = speedKey; }, [speedKey]);

  // Goal-flash triggers (green pulse on the scoring side, ~700ms).
  const [homeFlashAt, setHomeFlashAt] = useState<number>(0);
  const [awayFlashAt, setAwayFlashAt] = useState<number>(0);
  const prevHomeScoreRef = useRef<number>(homeScore);
  const prevAwayScoreRef = useRef<number>(awayScore);

  useEffect(() => {
    if (homeScore > prevHomeScoreRef.current) setHomeFlashAt(performance.now());
    prevHomeScoreRef.current = homeScore;
  }, [homeScore]);
  useEffect(() => {
    if (awayScore > prevAwayScoreRef.current) setAwayFlashAt(performance.now());
    prevAwayScoreRef.current = awayScore;
  }, [awayScore]);

  // ------- Discs + Ball, held in a ref so the RAF loop never restarts.
  const stateRef = useRef<{ discs: Disc[]; ball: Ball; kickoffSide: "home" | "away"; sinceLastPass: number; sinceLastFiller: number } | null>(null);
  if (stateRef.current === null) {
    const discs: Disc[] = [];
    HOME_FORMATION.forEach((p, i) => {
      discs.push({ side: "home", number: i + 1, isGK: i === 0, x: p[0], y: p[1], vx: 0, vy: 0, home: p });
    });
    AWAY_FORMATION.forEach((p, i) => {
      discs.push({ side: "away", number: i + 1, isGK: i === 0, x: p[0], y: p[1], vx: 0, vy: 0, home: p });
    });
    const ball: Ball = { x: PITCH_W / 2, y: PITCH_H / 2, vx: 0, vy: 0, trail: [], ownerIdx: null };
    stateRef.current = { discs, ball, kickoffSide: "home", sinceLastPass: 0, sinceLastFiller: 0 };
  }

  // ------- Commentary log (fed by props + filler AI)
  const [log, setLog] = useState<{ text: string; minute: number | null; kind: "goal" | "save" | "shot" | "filler" | "info" }[]>([]);
  const appendLog = (entry: { text: string; minute: number | null; kind: any }) => {
    setLog((L) => {
      const next = [...L, entry];
      // Keep last 40 entries — the UI renders ~7 latest.
      return next.length > 40 ? next.slice(-40) : next;
    });
  };
  const lastEventKeyRef = useRef<string>("");
  useEffect(() => {
    if (!latestEvent) return;
    const key = `${latestEvent.minute}-${latestEvent.type}-${latestEvent.text}`;
    if (key === lastEventKeyRef.current) return;
    lastEventKeyRef.current = key;
    const kind: any = latestEvent.type === "GOAL" ? "goal" : latestEvent.type === "SAVE" ? "save" : "shot";
    appendLog({ text: latestEvent.text, minute: latestEvent.minute, kind });
    // Give the canvas a nudge: put ball possession on the shooting team so
    // the next few seconds feel connected to the commentary line.
    const st = stateRef.current!;
    const side = latestEvent.side;
    // Pick a forward-most attacker on that side and hand them the ball.
    const attackers = st.discs
      .map((d, i) => ({ d, i }))
      .filter((o) => o.d.side === side && !o.d.isGK)
      .sort((a, b) => (side === "home" ? b.d.x - a.d.x : a.d.x - b.d.x));
    if (attackers.length > 0) {
      const target = attackers[0];
      st.ball.x = target.d.x;
      st.ball.y = target.d.y;
      st.ball.ownerIdx = target.i;
      // If it's a shot / save / goal, launch the ball toward the goal.
      const goalX = side === "home" ? PITCH_W - 0.5 : 0.5;
      const goalY = 30 + (Math.random() - 0.5) * 6;
      const dx = goalX - st.ball.x;
      const dy = goalY - st.ball.y;
      const dlen = Math.hypot(dx, dy) || 1;
      const shotSpeed = latestEvent.type === "GOAL" ? 78 : 66;
      st.ball.vx = (dx / dlen) * shotSpeed;
      st.ball.vy = (dy / dlen) * shotSpeed;
      st.ball.ownerIdx = null;
      st.sinceLastPass = 0;
    }
  }, [latestEvent]);

  // ------- Canvas render + AI game loop -------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI sizing.
    const dpr = window.devicePixelRatio || 1;
    const fitCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      (ctx as any).imageSmoothingEnabled = false;
    };
    fitCanvas();
    const ro = new ResizeObserver(fitCanvas);
    ro.observe(container);

    const loop = (ts: number) => {
      const prev = lastTsRef.current || ts;
      const rawDt = Math.min(64, ts - prev); // clamp long stalls to 64ms
      lastTsRef.current = ts;
      const mult = SPEED_MULT[speedRef.current] || 1;
      const dt = (rawDt / 1000) * mult; // seconds of "sim time"

      stepAI(stateRef.current!, dt, (msg, kind) => {
        appendLog({ text: msg, minute: null, kind });
      });
      draw(ctx, canvas, stateRef.current!, {
        homeFlashAt,
        awayFlashAt,
        now: ts,
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // We deliberately keep the effect stable across speed/score changes; the
    // loop reads those via refs so it never has to restart.
  }, [homeFlashAt, awayFlashAt]);

  // ------- Rendered UI ------------------------------------------------------
  const renderedLog = useMemo(() => log.slice(-7), [log]);

  return (
    <div className="w-full" data-testid="canvas-match">
      {/* Integrated scoreboard */}
      <div className="grid grid-cols-3 items-center gap-3 mb-2">
        {/* Left: stage label */}
        <div className="font-mono text-[10px] md:text-xs tracking-widest text-amber-300 truncate" data-testid="canvas-stage">
          {stageLabel}
        </div>
        {/* Center: score */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-right font-display text-sm md:text-base tracking-tight truncate max-w-[140px]" data-testid="canvas-home-name">{homeName}</div>
          <div className="font-display text-2xl md:text-3xl text-amber-300 tabular-nums" data-testid="canvas-score">
            {homeScore} <span className="text-white/30">·</span> {awayScore}
          </div>
          <div className="text-left font-display text-sm md:text-base tracking-tight truncate max-w-[140px]" data-testid="canvas-away-name">{awayName}</div>
          {liveMinute !== null && (
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/20 border border-red-400/40 text-red-200 font-mono text-[10px] tracking-widest" data-testid="canvas-minute">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {`[${liveMinute}']`}
            </div>
          )}
        </div>
        {/* Right: speed picker */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-0.5 bg-white/5 rounded-full p-0.5 border border-white/10" data-testid="canvas-speed-picker">
            {SPEEDS.map((s) => {
              const Icon = s.icon;
              const active = s.key === speedKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSpeedChange(s.key)}
                  data-testid={`canvas-speed-${s.key}`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono tracking-wider transition-colors ${
                    active ? "bg-amber-300 text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Icon size={11} />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pitch container with fixed aspect ratio so canvas scales cleanly. */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-white/15 bg-black"
        style={{ aspectRatio: `${PITCH_W} / ${PITCH_H}` }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Commentary log overlay (bottom-right) */}
        <div
          className="absolute right-2 bottom-2 w-[220px] md:w-[260px] max-h-[42%] overflow-hidden pointer-events-none"
          data-testid="canvas-commentary"
        >
          <div className="rounded-md bg-black/60 border border-white/10 px-2 py-1.5 font-mono text-[10px] md:text-[11px] leading-snug backdrop-blur-sm">
            {renderedLog.length === 0 ? (
              <div className="text-white/40">Maç başladı...</div>
            ) : (
              renderedLog.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.kind === "goal"
                      ? "text-amber-300"
                      : entry.kind === "save"
                      ? "text-emerald-300"
                      : entry.kind === "shot"
                      ? "text-white"
                      : "text-white/55"
                  }
                >
                  {entry.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// AI + Physics — pure functions on the ref state
// ===========================================================================

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function findNearestDisc(state: { discs: Disc[] }, x: number, y: number, side?: "home" | "away") {
  let best = -1;
  let bestD = Infinity;
  state.discs.forEach((d, i) => {
    if (side && d.side !== side) return;
    const dd = dist(d.x, d.y, x, y);
    if (dd < bestD) { bestD = dd; best = i; }
  });
  return { idx: best, dist: bestD };
}

function stepAI(
  state: { discs: Disc[]; ball: Ball; kickoffSide: "home" | "away"; sinceLastPass: number; sinceLastFiller: number },
  dt: number,
  emitFiller: (msg: string, kind: "filler" | "shot" | "save" | "goal" | "info") => void
) {
  const { discs, ball } = state;

  // Move ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  // Drag
  const drag = 0.42;
  ball.vx *= Math.exp(-drag * dt);
  ball.vy *= Math.exp(-drag * dt);

  // Trail (positions history for the translucent tail)
  ball.trail.push({ x: ball.x, y: ball.y, a: 1 });
  if (ball.trail.length > 14) ball.trail.shift();
  ball.trail.forEach((t) => (t.a *= Math.max(0.85, 1 - 1.6 * dt)));

  // Bounce off pitch edges (top/bottom) — sides handled by "goal or wide" reset
  if (ball.y < 1) { ball.y = 1; ball.vy = Math.abs(ball.vy) * 0.6; }
  if (ball.y > PITCH_H - 1) { ball.y = PITCH_H - 1; ball.vy = -Math.abs(ball.vy) * 0.6; }

  // If ball leaves side lines, reset via goal-kick / throw commentary.
  if (ball.x < 0 || ball.x > PITCH_W) {
    // Was it in the goal mouth? If yes, the parent has already updated the
    // score via the engine; we still just reset play.
    ball.x = PITCH_W / 2;
    ball.y = PITCH_H / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.ownerIdx = null;
    state.sinceLastPass = 0;
    emitFiller(pick(FILLER_THROW), "filler");
  }

  // Ball possession — if slow enough, nearest disc grabs it.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 6 && ball.ownerIdx === null) {
    const near = findNearestDisc(state, ball.x, ball.y);
    if (near.dist < 1.6) {
      ball.ownerIdx = near.idx;
      ball.vx = 0;
      ball.vy = 0;
    }
  } else if (ball.ownerIdx !== null) {
    // Carrier is dragging the ball with them.
    const owner = discs[ball.ownerIdx];
    ball.x = owner.x + owner.vx * 0.02;
    ball.y = owner.y + owner.vy * 0.02;
  }

  // ------ Disc movement rules -------------------------------------------------
  // Rule per side: carrier attacks; teammates spread ahead of ball; opponents
  // press ball carrier and mark forwards.

  const owner = ball.ownerIdx !== null ? discs[ball.ownerIdx] : null;
  const owningSide: "home" | "away" | null = owner ? owner.side : null;

  discs.forEach((d, i) => {
    if (d.isGK) {
      // Keeper stays on his goal line and slides toward ball y (clamped).
      const gx = d.side === "home" ? 5 : PITCH_W - 5;
      const targetY = clamp(ball.y, 22, 38);
      const dxk = gx - d.x;
      const dyk = targetY - d.y;
      d.vx = dxk * 3.0;
      d.vy = dyk * 4.5;
    } else if (owner && d === owner) {
      // Carrier — drift toward opponent goal, avoiding own edges.
      const goalX = d.side === "home" ? PITCH_W - 8 : 8;
      const targetY = 30 + (Math.sin((performance.now() / 800) + i) * 8);
      d.vx = (goalX - d.x) * 0.9;
      d.vy = (targetY - d.y) * 0.9;
    } else if (owningSide === d.side) {
      // Teammate of carrier — move to attacking position (spread across
      // opponent half), keeping some link to home coord for balance.
      const attackShift = d.side === "home" ? 12 : -12;
      const tx = clamp(d.home[0] + attackShift, 6, PITCH_W - 6);
      const ty = d.home[1];
      d.vx = (tx - d.x) * 1.4;
      d.vy = (ty - d.y) * 1.4;
    } else if (owningSide && owningSide !== d.side) {
      // Defending team — nearest 2 press ball carrier, others fall back into
      // their home shape and shift toward ball on the y-axis.
      const rank = discs
        .map((o, oi) => ({ o, oi, dd: o.side === d.side && !o.isGK ? dist(o.x, o.y, ball.x, ball.y) : Infinity }))
        .filter((r) => r.o.side === d.side && !r.o.isGK)
        .sort((a, b) => a.dd - b.dd)
        .findIndex((r) => r.oi === i);
      if (rank >= 0 && rank < 2) {
        d.vx = (ball.x - d.x) * 3.0;
        d.vy = (ball.y - d.y) * 3.0;
      } else {
        const shiftY = (ball.y - 30) * 0.4;
        const tx = d.home[0];
        const ty = clamp(d.home[1] + shiftY, 4, PITCH_H - 4);
        d.vx = (tx - d.x) * 1.3;
        d.vy = (ty - d.y) * 1.3;
      }
    } else {
      // Loose ball — nearest disc chases, rest hold shape.
      const near = findNearestDisc(state, ball.x, ball.y, d.side);
      if (near.idx === i) {
        d.vx = (ball.x - d.x) * 3.5;
        d.vy = (ball.y - d.y) * 3.5;
      } else {
        d.vx = (d.home[0] - d.x) * 1.2;
        d.vy = (d.home[1] - d.y) * 1.2;
      }
    }
  });

  // Integrate positions with speed cap
  const MAX_SPD = 22; // world units per second
  discs.forEach((d) => {
    const s = Math.hypot(d.vx, d.vy);
    const cap = d.isGK ? MAX_SPD * 0.75 : MAX_SPD;
    if (s > cap) { d.vx = (d.vx / s) * cap; d.vy = (d.vy / s) * cap; }
    d.x = clamp(d.x + d.vx * dt, 1, PITCH_W - 1);
    d.y = clamp(d.y + d.vy * dt, 1, PITCH_H - 1);
  });

  // Simple disc-vs-disc separation so they don't stack.
  for (let a = 0; a < discs.length; a++) {
    for (let b = a + 1; b < discs.length; b++) {
      const A = discs[a], B = discs[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      const min = R * 2;
      if (d2 > 0 && d2 < min * min) {
        const dd = Math.sqrt(d2);
        const push = (min - dd) * 0.5;
        const nx = dx / dd, ny = dy / dd;
        A.x -= nx * push; A.y -= ny * push;
        B.x += nx * push; B.y += ny * push;
      }
    }
  }

  // ------ Carrier logic: pass / shot decisions -------------------------------
  state.sinceLastPass += dt;
  if (owner && state.sinceLastPass > 1.2) {
    // Look for a teammate closer to opponent goal — pick the best-placed one.
    const goalX = owner.side === "home" ? PITCH_W - 2 : 2;
    const candidates = discs
      .map((t, ti) => ({ t, ti }))
      .filter((c) => c.t.side === owner.side && c.t !== owner && !c.t.isGK)
      .map((c) => {
        const toGoal = Math.abs(goalX - c.t.x);
        const fromCarrier = dist(c.t.x, c.t.y, owner.x, owner.y);
        // Prefer teammates that are ahead of the carrier and not too far away.
        const aheadBonus = owner.side === "home"
          ? Math.max(0, c.t.x - owner.x)
          : Math.max(0, owner.x - c.t.x);
        return { c, score: -toGoal + aheadBonus * 1.2 - fromCarrier * 0.15 };
      })
      .sort((a, b) => b.score - a.score);
    const best = candidates[0]?.c;
    if (best) {
      // Decide shot vs pass: within 20 units of opponent goal → shoot (visual).
      const closeToGoal = Math.abs(goalX - owner.x) < 22;
      const shouldShoot = closeToGoal && Math.random() < 0.28;
      if (shouldShoot) {
        const gx = owner.side === "home" ? PITCH_W - 0.5 : 0.5;
        const gy = 30 + (Math.random() - 0.5) * 12;
        const dx = gx - ball.x, dy = gy - ball.y;
        const dlen = Math.hypot(dx, dy) || 1;
        ball.vx = (dx / dlen) * 55;
        ball.vy = (dy / dlen) * 55;
      } else {
        const dx = best.t.x - ball.x, dy = best.t.y - ball.y;
        const dlen = Math.hypot(dx, dy) || 1;
        const passSpd = 24 + Math.random() * 14;
        ball.vx = (dx / dlen) * passSpd;
        ball.vy = (dy / dlen) * passSpd;
      }
      ball.ownerIdx = null;
      state.sinceLastPass = 0;
    }
  }

  // Filler commentary trickle (every ~4-6s of sim time), tone-matched to state.
  state.sinceLastFiller += dt;
  if (state.sinceLastFiller > 3.5 + Math.random() * 2.5) {
    state.sinceLastFiller = 0;
    if (owner) {
      const bucket = Math.random() < 0.65 ? FILLER_PASS : FILLER_PRESS;
      emitFiller(pick(bucket), "filler");
    } else if (Math.hypot(ball.vx, ball.vy) > 30) {
      // fast-moving loose ball — probably a shot flying about
      emitFiller("Şut denemesi!", "shot");
    }
  }
}

// ===========================================================================
// Renderer
// ===========================================================================

type DrawCtx = {
  homeFlashAt: number;
  awayFlashAt: number;
  now: number;
};

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: { discs: Disc[]; ball: Ball },
  d: DrawCtx
) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const sx = W / PITCH_W;
  const sy = H / PITCH_H;

  // ---- Turf ------------------------------------------------------------------
  const stripes = 16;
  const stripeW = W / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? COL.turfDark : COL.turfLight;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, H);
  }
  // subtle vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ---- Lines -----------------------------------------------------------------
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = 2;
  // outer boundary
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  // halfway line
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  // centre circle
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 9 * sx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = COL.line;
  ctx.fill();
  // penalty boxes (left + right)
  ctx.strokeStyle = COL.line;
  ctx.strokeRect(0, PEN_TOP * sy, PEN_BOX * sx, (PEN_BOT - PEN_TOP) * sy);
  ctx.strokeRect((PITCH_W - PEN_BOX) * sx, PEN_TOP * sy, PEN_BOX * sx, (PEN_BOT - PEN_TOP) * sy);
  // small goal area
  ctx.strokeRect(0, (PEN_TOP + 8) * sy, (PEN_BOX / 2) * sx, (PEN_BOT - PEN_TOP - 16) * sy);
  ctx.strokeRect((PITCH_W - PEN_BOX / 2) * sx, (PEN_TOP + 8) * sy, (PEN_BOX / 2) * sx, (PEN_BOT - PEN_TOP - 16) * sy);

  // ---- Goals + optional green glow ------------------------------------------
  const drawGoal = (isRight: boolean, flashAt: number) => {
    const gx = isRight ? W : 0;
    const gy0 = GOAL_TOP * sy;
    const gy1 = GOAL_BOT * sy;
    const width = 6;
    const age = flashAt ? (d.now - flashAt) : Infinity;
    if (age < 900) {
      const t = 1 - age / 900;
      ctx.fillStyle = `rgba(34,255,119,${0.45 * t})`;
      ctx.fillRect(isRight ? gx - 26 : 0, gy0 - 10, 26, (gy1 - gy0) + 20);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(isRight ? gx - width : 0, gy0, width, gy1 - gy0);
  };
  drawGoal(false, awayFlashSide()); // away flash sits on the left goal (home concedes)
  drawGoal(true, homeFlashSide());  // home scores → right goal flashes

  function homeFlashSide() { return d.homeFlashAt; }
  function awayFlashSide() { return d.awayFlashAt; }

  // ---- Ball trail ------------------------------------------------------------
  state.ball.trail.forEach((t) => {
    ctx.fillStyle = `rgba(255,255,255,${0.10 * t.a})`;
    ctx.beginPath();
    ctx.arc(t.x * sx, t.y * sy, BALL_R * sx * 0.9, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- Discs -----------------------------------------------------------------
  state.discs.forEach((disc) => {
    const cx = disc.x * sx;
    const cy = disc.y * sy;
    const rPx = R * sx;
    ctx.fillStyle = disc.side === "home" ? COL.homeFill : COL.awayFill;
    ctx.strokeStyle = disc.side === "home" ? COL.homeBord : COL.awayBord;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // number
    ctx.fillStyle = disc.side === "home" ? COL.homeTxt : COL.awayTxt;
    ctx.font = `bold ${Math.max(9, Math.floor(rPx * 1.1))}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(disc.number), cx, cy + 1);
  });

  // ---- Ball ------------------------------------------------------------------
  const bx = state.ball.x * sx;
  const by = state.ball.y * sy;
  const bR = BALL_R * sx;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.arc(bx + 1.5, by + 1.5, bR * 1.15, 0, Math.PI * 2);
  ctx.fill();
  // ball body — pixel-cluster feel: main disc + darker centre dot
  ctx.fillStyle = COL.ball;
  ctx.beginPath();
  ctx.arc(bx, by, bR * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(bx, by, bR * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

export default CanvasMatch;
