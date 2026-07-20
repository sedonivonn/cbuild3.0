/**
 * CanvasMatch — 2D top-down HTML5 Canvas match simulation.
 *
 * Iteration 28 rewrite: richer AI (pass buildup, defensive shifts, keeper
 * dives), goal celebrations with kickoff resets, single "MAÇI ATLA" skip
 * button (all speed multipliers removed by request), and calmer ball
 * physics so every attack is legible frame-by-frame.
 *
 * Visual layer only — `matchEngine.js` still owns goals/scorer/assist/
 * minute. When an engine event arrives via `latestEvent`, the canvas
 * queues a "pending shot" and plays 2-3 seconds of buildup passes on
 * the shooting side before executing the visual shot with proper
 * keeper reaction. This kills the old "santra→gol" feel.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SkipForward } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  events: MatchEventLite[];
  latestEvent: MatchEventLite | null;
  onSkip: () => void;
};

// ---------------------------------------------------------------------------
// World constants
// ---------------------------------------------------------------------------
const PITCH_W = 100;
const PITCH_H = 60;
const GOAL_TOP = 25;
const GOAL_BOT = 35;
const PEN_BOX = 16;
const PEN_TOP = 13;
const PEN_BOT = 47;
const R = 1.35;
const BALL_R = 0.65;

const HOME_FORMATION: [number, number][] = [
  [ 6, 30],
  [18,  8], [18, 22], [18, 38], [18, 52],
  [32, 18], [32, 30], [32, 42],
  [46,  9], [50, 30], [46, 51],
];
const mirror = (p: [number, number]): [number, number] => [PITCH_W - p[0], p[1]];
const AWAY_FORMATION: [number, number][] = HOME_FORMATION.map(mirror) as any;

const COL = {
  turfDark:  "#0d5f2b",
  turfLight: "#118a3f",
  line:      "#ffffff",
  homeFill:  "#1e3a8a",
  homeBord:  "#ffffff",
  homeTxt:   "#ffffff",
  awayFill:  "#f5f5f5",
  awayBord:  "#374151",
  awayTxt:   "#111827",
  ball:      "#ffffff",
  goalGlow:  "#22ff77",
};

// Filler commentary buckets — organised so the log reads like a broadcast.
const FILLER_BUILDUP = [
  "Kısa pas alışverişi.",
  "Topla oynuyorlar.",
  "Kanattan orta bekleniyor.",
  "Uzun pas denemesi.",
  "Geri pas — kaleye emanet.",
  "Orta sahada dolaşıyorlar.",
];
const FILLER_PRESS = [
  "Yüksek baskı!",
  "Rakip topu geri kazandı.",
  "Defans oyuncusu top kesti.",
  "Sıkı takip.",
  "Faul yaptırıyor.",
];
const FILLER_ATTACK = [
  "Ceza sahasına giriş.",
  "Kanattan atak!",
  "Merkezden hızlı hücum.",
  "Ceza yayı önünde tehlike.",
];
const FILLER_KEEPER = [
  "Kaleci topu ayakla oynatıyor.",
  "Kaleci topla oyunu başlatıyor.",
  "Kaleciden uzun vuruş.",
];
const FILLER_RESTART = [
  "Korner kullanılıyor.",
  "Taç atışı.",
  "Serbest vuruş.",
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// ---------------------------------------------------------------------------
// State types (kept in a ref so the RAF effect never restarts on rerender)
// ---------------------------------------------------------------------------
type Disc = {
  side: "home" | "away";
  number: number;
  isGK: boolean;
  x: number; y: number;
  vx: number; vy: number;
  home: [number, number];
};

type Ball = {
  x: number; y: number;
  vx: number; vy: number;
  trail: { x: number; y: number; a: number }[];
  ownerIdx: number | null;
  holdTime: number; // seconds carrier has held the ball
};

type PendingShot = {
  side: "home" | "away";
  type: "GOAL" | "SAVE" | "SHOT";
  buildupLeft: number; // seconds remaining until the shot fires
  shooterIdx: number | null; // which disc will actually shoot
  scorer?: string | null;
  shooter?: string | null;
} | null;

type SimState = {
  discs: Disc[];
  ball: Ball;
  possession: "home" | "away";
  sinceLastPass: number;
  sinceLastFiller: number;
  pending: PendingShot;
  celebration: { until: number; text: string; side: "home" | "away" } | null;
  restartAt: number; // if > 0, wait until performance.now() > restartAt before resuming
};

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
  events, // eslint-disable-line no-unused-vars
  latestEvent,
  onSkip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const [homeFlashAt, setHomeFlashAt] = useState<number>(0);
  const [awayFlashAt, setAwayFlashAt] = useState<number>(0);
  const prevHomeScoreRef = useRef<number>(homeScore);
  const prevAwayScoreRef = useRef<number>(awayScore);
  useEffect(() => {
    if (homeScore > prevHomeScoreRef.current) {
      setHomeFlashAt(performance.now());
      const st = stateRef.current!;
      st.celebration = { until: performance.now() + 1600, text: "GOL!", side: "home" };
      // Kick off from centre for the conceding team.
      resetKickoff(st, "away");
    }
    prevHomeScoreRef.current = homeScore;
  }, [homeScore]);
  useEffect(() => {
    if (awayScore > prevAwayScoreRef.current) {
      setAwayFlashAt(performance.now());
      const st = stateRef.current!;
      st.celebration = { until: performance.now() + 1600, text: "GOL!", side: "away" };
      resetKickoff(st, "home");
    }
    prevAwayScoreRef.current = awayScore;
  }, [awayScore]);

  // Lazy-init the simulation state (discs + ball + phase).
  const stateRef = useRef<SimState | null>(null);
  if (stateRef.current === null) {
    const discs: Disc[] = [];
    HOME_FORMATION.forEach((p, i) => {
      discs.push({ side: "home", number: i + 1, isGK: i === 0, x: p[0], y: p[1], vx: 0, vy: 0, home: p });
    });
    AWAY_FORMATION.forEach((p, i) => {
      discs.push({ side: "away", number: i + 1, isGK: i === 0, x: p[0], y: p[1], vx: 0, vy: 0, home: p });
    });
    const ball: Ball = { x: PITCH_W / 2, y: PITCH_H / 2, vx: 0, vy: 0, trail: [], ownerIdx: null, holdTime: 0 };
    stateRef.current = {
      discs,
      ball,
      possession: "home",
      sinceLastPass: 0,
      sinceLastFiller: 0,
      pending: null,
      celebration: null,
      restartAt: 0,
    };
  }

  // Commentary log
  const [log, setLog] = useState<{ text: string; kind: "goal" | "save" | "shot" | "filler" | "info" }[]>([]);
  const appendLog = (entry: { text: string; kind: any }) => {
    setLog((L) => {
      const next = [...L, entry];
      return next.length > 60 ? next.slice(-60) : next;
    });
  };
  const lastEventKeyRef = useRef<string>("");

  useEffect(() => {
    if (!latestEvent) return;
    const key = `${latestEvent.minute}-${latestEvent.type}-${latestEvent.text}`;
    if (key === lastEventKeyRef.current) return;
    lastEventKeyRef.current = key;
    const kind: any = latestEvent.type === "GOAL" ? "goal" : latestEvent.type === "SAVE" ? "save" : "shot";
    appendLog({ text: latestEvent.text, kind });

    // Queue a pending shot with buildup — the canvas AI will play 2-3s of
    // buildup passes on the shooting side before the ball actually flies
    // toward the goal. This kills the "santra→gol" teleport.
    const st = stateRef.current!;
    const side = latestEvent.side;
    st.possession = side;
    // Nudge ball toward the attacking half if it isn't already there.
    const attackingHalf = side === "home"
      ? st.ball.x > PITCH_W * 0.35
      : st.ball.x < PITCH_W * 0.65;
    if (!attackingHalf) {
      // Hand ball to a mid-line disc on the attacking side.
      const midfielders = st.discs
        .map((d, i) => ({ d, i }))
        .filter((o) => o.d.side === side && !o.d.isGK)
        .sort((a, b) => Math.abs(PITCH_W / 2 - a.d.x) - Math.abs(PITCH_W / 2 - b.d.x));
      if (midfielders.length > 0) {
        const target = midfielders[0];
        st.ball.x = target.d.x;
        st.ball.y = target.d.y;
        st.ball.ownerIdx = target.i;
        st.ball.vx = 0; st.ball.vy = 0;
      }
    }

    const buildup = latestEvent.type === "GOAL" ? 2.4 : latestEvent.type === "SAVE" ? 2.0 : 1.6;
    st.pending = {
      side,
      type: latestEvent.type as any,
      buildupLeft: buildup,
      shooterIdx: null,
      scorer: latestEvent.scorer,
      shooter: latestEvent.shooter,
    };
  }, [latestEvent]);

  // ------- Canvas render + AI game loop -------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
      const rawDt = Math.min(64, ts - prev);
      lastTsRef.current = ts;
      const dt = rawDt / 1000; // fixed 1x speed — the "hızlı" picker was removed

      stepAI(stateRef.current!, dt, ts, (msg, kind) => {
        appendLog({ text: msg, kind });
      });
      draw(ctx, canvas, stateRef.current!, { homeFlashAt, awayFlashAt, now: ts });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [homeFlashAt, awayFlashAt]);

  const renderedLog = useMemo(() => log.slice(-8), [log]);

  return (
    <div className="w-full" data-testid="canvas-match">
      {/* Integrated scoreboard */}
      <div className="grid grid-cols-3 items-center gap-3 mb-2">
        <div className="font-mono text-[10px] md:text-xs tracking-widest text-amber-300 truncate" data-testid="canvas-stage">
          {stageLabel}
        </div>
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
        {/* Skip button — replaces the old speed picker */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            data-testid="canvas-skip-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 hover:bg-amber-300 hover:text-black border border-white/15 text-white/85 font-mono text-[10px] md:text-[11px] tracking-widest transition-colors"
            title="Simülasyonu atla ve sonuca geç"
          >
            <SkipForward size={12} />
            MAÇI ATLA
          </button>
        </div>
      </div>

      {/* Pitch */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-white/15 bg-black"
        style={{ aspectRatio: `${PITCH_W} / ${PITCH_H}` }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Commentary log overlay */}
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
// Kickoff helper — recentre both teams and hand possession to `side`.
// ===========================================================================
function resetKickoff(st: SimState, side: "home" | "away") {
  st.ball.x = PITCH_W / 2;
  st.ball.y = PITCH_H / 2;
  st.ball.vx = 0;
  st.ball.vy = 0;
  st.ball.ownerIdx = null;
  st.ball.holdTime = 0;
  st.ball.trail.length = 0;
  st.possession = side;
  st.sinceLastPass = 0;
  st.pending = null;
  // Give discs a moment to trot back to their home positions.
  st.restartAt = performance.now() + 900;
}

// ===========================================================================
// AI + Physics
// ===========================================================================

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
  st: SimState,
  dt: number,
  now: number,
  emit: (msg: string, kind: "filler" | "shot" | "save" | "goal" | "info") => void
) {
  const { discs, ball } = st;
  const inCelebration = st.celebration && now < st.celebration.until;
  const inRestart = now < st.restartAt;

  // 1) Ball physics (drag + edges)
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const drag = 0.55;
  ball.vx *= Math.exp(-drag * dt);
  ball.vy *= Math.exp(-drag * dt);
  ball.trail.push({ x: ball.x, y: ball.y, a: 1 });
  if (ball.trail.length > 16) ball.trail.shift();
  ball.trail.forEach((t) => (t.a *= Math.max(0.85, 1 - 1.4 * dt)));

  // Bounce off top/bottom
  if (ball.y < 1) { ball.y = 1; ball.vy = Math.abs(ball.vy) * 0.55; }
  if (ball.y > PITCH_H - 1) { ball.y = PITCH_H - 1; ball.vy = -Math.abs(ball.vy) * 0.55; }

  // If ball leaves goal lines: throw-in / goal kick reset (unless we're
  // handling a pending shot outcome).
  if (ball.x < 0 || ball.x > PITCH_W) {
    if (!inCelebration) {
      const isLeft = ball.x < 0;
      const kickerSide: "home" | "away" = isLeft ? "home" : "away";
      // Emit atmospheric line and restart from that keeper.
      const keeper = discs.find((d) => d.isGK && d.side === kickerSide);
      if (keeper) {
        ball.x = keeper.x + (kickerSide === "home" ? 3 : -3);
        ball.y = keeper.y;
        ball.vx = 0; ball.vy = 0;
        ball.ownerIdx = discs.indexOf(keeper);
        ball.holdTime = 0;
        st.possession = kickerSide;
        emit(pick(FILLER_KEEPER), "filler");
      }
    }
  }

  // 2) Possession — nearest disc grabs slow ball
  const bspeed = Math.hypot(ball.vx, ball.vy);
  if (bspeed < 4 && ball.ownerIdx === null && !inCelebration) {
    const near = findNearestDisc(st, ball.x, ball.y);
    if (near.dist < 1.8) {
      ball.ownerIdx = near.idx;
      ball.holdTime = 0;
      ball.vx = 0; ball.vy = 0;
      const newOwner = discs[near.idx];
      if (newOwner.side !== st.possession) {
        // Possession change — a tackle or interception.
        st.possession = newOwner.side;
        emit(pick(FILLER_PRESS), "filler");
      }
    }
  } else if (ball.ownerIdx !== null && !inCelebration) {
    const owner = discs[ball.ownerIdx];
    ball.x = owner.x + owner.vx * 0.02;
    ball.y = owner.y + owner.vy * 0.02;
    ball.holdTime += dt;
  }

  // 3) Disc movement per role
  const owner = ball.ownerIdx !== null ? discs[ball.ownerIdx] : null;
  const owningSide = owner ? owner.side : st.possession;
  const attackingRight = owningSide === "home";

  discs.forEach((d, i) => {
    if (inCelebration || inRestart) {
      // Trot back to home position during a stoppage.
      d.vx = (d.home[0] - d.x) * 2.0;
      d.vy = (d.home[1] - d.y) * 2.0;
      return;
    }

    if (d.isGK) {
      // Keeper: hold goal line, slide toward ball y. On a pending shot,
      // sprint out toward the ball's trajectory when it's in the box.
      const gx = d.side === "home" ? 5 : PITCH_W - 5;
      let targetX = gx;
      let targetY = clamp(ball.y, 22, 38);
      const shotIncoming =
        st.pending &&
        st.pending.side !== d.side &&
        Math.abs(ball.vx) > 12 &&
        ((d.side === "home" && ball.x < 25) || (d.side === "away" && ball.x > PITCH_W - 25));
      if (shotIncoming) {
        // Anticipate: intercept along the ball's y trajectory.
        const tSteps = 0.25; // look-ahead seconds
        targetX = d.side === "home" ? Math.max(3.5, ball.x - 2) : Math.min(PITCH_W - 3.5, ball.x + 2);
        targetY = clamp(ball.y + ball.vy * tSteps, GOAL_TOP - 1, GOAL_BOT + 1);
      }
      d.vx = (targetX - d.x) * 4.0;
      d.vy = (targetY - d.y) * 5.5;
    } else if (owner && d === owner) {
      // Carrier — drifts toward opponent goal but slows when defenders close
      // in, giving the buildup time to breathe.
      const goalX = attackingRight ? PITCH_W - 8 : 8;
      const targetY = 30 + (Math.sin((now / 800) + i) * 6);
      // Slow drift so passes have time to develop.
      d.vx = (goalX - d.x) * 0.55;
      d.vy = (targetY - d.y) * 0.9;
    } else if (owningSide === d.side) {
      // Teammate of carrier — spread into attacking positions but not all
      // at max shift; keep at least one deeper option for a safe pass.
      const isForward = d.home[0] >= 40 || d.home[0] <= 60; // rough
      const shiftBase = d.side === "home" ? 10 : -10;
      const shift = isForward ? shiftBase * 1.4 : shiftBase * 0.4;
      const tx = clamp(d.home[0] + shift, 6, PITCH_W - 6);
      const ty = d.home[1] + Math.sin((now / 1400) + i * 0.7) * 3;
      d.vx = (tx - d.x) * 1.6;
      d.vy = (ty - d.y) * 1.6;
    } else {
      // Defending team
      const myRankToBall = discs
        .map((o, oi) => ({ oi, dd: o.side === d.side && !o.isGK ? dist(o.x, o.y, ball.x, ball.y) : Infinity }))
        .filter((r) => discs[r.oi].side === d.side && !discs[r.oi].isGK)
        .sort((a, b) => a.dd - b.dd)
        .findIndex((r) => r.oi === i);
      if (myRankToBall >= 0 && myRankToBall < 2) {
        // Press the ball carrier / loose ball.
        d.vx = (ball.x - d.x) * 3.4;
        d.vy = (ball.y - d.y) * 3.4;
      } else {
        // Zonal shift: track home coord but shifted with ball y and slightly
        // back-marking the nearest attacker.
        const shiftY = (ball.y - 30) * 0.35;
        const tx = d.home[0];
        const ty = clamp(d.home[1] + shiftY, 4, PITCH_H - 4);
        d.vx = (tx - d.x) * 1.4;
        d.vy = (ty - d.y) * 1.4;
      }
    }
  });

  // 4) Integrate + separation
  const MAX_SPD = 20; // world/s. Slower than v1 for a calmer feel.
  discs.forEach((d) => {
    const s = Math.hypot(d.vx, d.vy);
    const cap = d.isGK ? MAX_SPD * 0.9 : MAX_SPD;
    if (s > cap) { d.vx = (d.vx / s) * cap; d.vy = (d.vy / s) * cap; }
    d.x = clamp(d.x + d.vx * dt, 1, PITCH_W - 1);
    d.y = clamp(d.y + d.vy * dt, 1, PITCH_H - 1);
  });
  for (let a = 0; a < discs.length; a++) {
    for (let b = a + 1; b < discs.length; b++) {
      const A = discs[a], B = discs[b];
      const dx = B.x - A.x, dy = B.y - A.y;
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

  // 5) Carrier passing logic — richer variety, slower pace.
  st.sinceLastPass += dt;
  if (owner && !inCelebration && !inRestart && st.sinceLastPass > 1.4 && ball.holdTime > 0.9) {
    // Detect nearest opponent → if very close, pass now.
    const nearestOpp = findNearestDisc(st, owner.x, owner.y, owner.side === "home" ? "away" : "home");
    const underPressure = nearestOpp.dist < 3.2;
    // Only pass if either enough time elapsed OR under pressure.
    const shouldPass = underPressure || st.sinceLastPass > 2.2 + Math.random() * 0.8;
    if (shouldPass) {
      chooseAndKickPass(st, owner, now, emit);
      st.sinceLastPass = 0;
      ball.holdTime = 0;
    }
  }

  // 6) Pending shot resolution — the buildup timer counts down; when it
  //    hits zero, whoever currently has the ball fires it at the goal.
  if (st.pending && !inCelebration && !inRestart) {
    st.pending.buildupLeft -= dt;
    if (st.pending.buildupLeft <= 0) {
      // Force ball onto a shooter (owner if on the right side, else the
      // most-forward attacker of the shooting side).
      const shootSide = st.pending.side;
      let shooter: Disc | null = null;
      let shooterIdx = -1;
      if (owner && owner.side === shootSide) {
        shooter = owner;
        shooterIdx = ball.ownerIdx!;
      } else {
        const attackers = discs
          .map((d, di) => ({ d, di }))
          .filter((o) => o.d.side === shootSide && !o.d.isGK)
          .sort((a, b) => shootSide === "home" ? b.d.x - a.d.x : a.d.x - b.d.x);
        if (attackers.length > 0) {
          shooter = attackers[0].d;
          shooterIdx = attackers[0].di;
          // Snap ball to shooter.
          ball.x = shooter.x;
          ball.y = shooter.y;
          ball.ownerIdx = shooterIdx;
        }
      }
      if (shooter) {
        const goalX = shootSide === "home" ? PITCH_W - 0.5 : 0.5;
        // Where does the shot go?
        let aimY: number;
        if (st.pending.type === "GOAL") {
          // Aim inside posts, away from keeper.
          const keeper = discs.find((d) => d.isGK && d.side !== shootSide);
          aimY = keeper
            ? keeper.y > 30 ? 26 + Math.random() * 3 : 34 - Math.random() * 3
            : 30;
        } else if (st.pending.type === "SAVE") {
          // Aim on target — keeper will intercept.
          aimY = 26 + Math.random() * 8;
        } else {
          // Miss — aim wide.
          aimY = Math.random() < 0.5 ? GOAL_TOP - 4 - Math.random() * 4 : GOAL_BOT + 4 + Math.random() * 4;
        }
        const dx = goalX - ball.x, dy = aimY - ball.y;
        const dlen = Math.hypot(dx, dy) || 1;
        const shotSpd = st.pending.type === "GOAL" ? 62 : st.pending.type === "SAVE" ? 55 : 50;
        ball.vx = (dx / dlen) * shotSpd;
        ball.vy = (dy / dlen) * shotSpd;
        ball.ownerIdx = null;
        // Tell the log.
        if (st.pending.type === "GOAL") {
          emit("Şut… " + (st.pending.scorer ? `${st.pending.scorer}!` : "kaleye!"), "goal");
        } else if (st.pending.type === "SAVE") {
          emit("Kaleci hazır!", "save");
        } else {
          emit("Şut auta gitti!", "shot");
        }
      }
      st.pending = null;
    } else {
      // Occasionally emit a buildup filler while the timer counts down.
      if (Math.random() < dt * 0.9) {
        emit(pick(FILLER_ATTACK), "filler");
      }
    }
  }

  // 7) Filler commentary trickle — keeps the log alive between engine events.
  st.sinceLastFiller += dt;
  if (!inCelebration && st.sinceLastFiller > 1.5 + Math.random() * 1.5) {
    st.sinceLastFiller = 0;
    if (owner) {
      const roll = Math.random();
      const bucket = roll < 0.5 ? FILLER_BUILDUP : roll < 0.8 ? FILLER_PRESS : FILLER_RESTART;
      emit(pick(bucket), "filler");
    }
  }
}

// Pick a pass target for `owner` and kick the ball toward it.
function chooseAndKickPass(
  st: SimState,
  owner: Disc,
  now: number,
  emit: (msg: string, kind: any) => void
) {
  const { ball, discs } = st;
  const attackingRight = owner.side === "home";
  const goalX = attackingRight ? PITCH_W - 2 : 2;

  const teammates = discs
    .map((t, ti) => ({ t, ti }))
    .filter((c) => c.t.side === owner.side && c.t !== owner && !c.t.isGK);

  // Score candidates: prefer ahead teammates in space (no defender nearby).
  const scored = teammates.map((c) => {
    const opp = findNearestDisc(st, c.t.x, c.t.y, owner.side === "home" ? "away" : "home");
    const space = opp.dist;
    const aheadBonus = attackingRight ? c.t.x - owner.x : owner.x - c.t.x;
    const toGoal = Math.abs(goalX - c.t.x);
    const distFromCarrier = dist(c.t.x, c.t.y, owner.x, owner.y);
    // Balance: prefer forward + in space + not too far.
    const score = aheadBonus * 1.0 + space * 1.4 - toGoal * 0.8 - distFromCarrier * 0.25;
    return { c, score };
  }).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return;

  // 20% of the time pick a safer backward option to vary rhythm.
  const useSafe = Math.random() < 0.22;
  const chosen = useSafe && scored.length > 3 ? scored[scored.length - 1].c : scored[0].c;
  const dx = chosen.t.x - ball.x;
  const dy = chosen.t.y - ball.y;
  const dlen = Math.hypot(dx, dy) || 1;
  const passSpd = 16 + Math.random() * 10 + Math.min(10, dlen * 0.15);
  ball.vx = (dx / dlen) * passSpd;
  ball.vy = (dy / dlen) * passSpd;
  ball.ownerIdx = null;
}

// ===========================================================================
// Renderer
// ===========================================================================

type DrawCtx = { homeFlashAt: number; awayFlashAt: number; now: number };

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  st: SimState,
  d: DrawCtx
) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const sx = W / PITCH_W;
  const sy = H / PITCH_H;

  // Turf
  const stripes = 16;
  const stripeW = W / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? COL.turfDark : COL.turfLight;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, H);
  }
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Lines
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 9 * sx, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 1.4, 0, Math.PI * 2); ctx.fillStyle = COL.line; ctx.fill();
  ctx.strokeStyle = COL.line;
  ctx.strokeRect(0, PEN_TOP * sy, PEN_BOX * sx, (PEN_BOT - PEN_TOP) * sy);
  ctx.strokeRect((PITCH_W - PEN_BOX) * sx, PEN_TOP * sy, PEN_BOX * sx, (PEN_BOT - PEN_TOP) * sy);
  ctx.strokeRect(0, (PEN_TOP + 8) * sy, (PEN_BOX / 2) * sx, (PEN_BOT - PEN_TOP - 16) * sy);
  ctx.strokeRect((PITCH_W - PEN_BOX / 2) * sx, (PEN_TOP + 8) * sy, (PEN_BOX / 2) * sx, (PEN_BOT - PEN_TOP - 16) * sy);

  // Goals + flash
  const drawGoal = (isRight: boolean, flashAt: number) => {
    const gx = isRight ? W : 0;
    const gy0 = GOAL_TOP * sy;
    const gy1 = GOAL_BOT * sy;
    const width = 6;
    const age = flashAt ? (d.now - flashAt) : Infinity;
    if (age < 900) {
      const t = 1 - age / 900;
      ctx.fillStyle = `rgba(34,255,119,${0.45 * t})`;
      ctx.fillRect(isRight ? gx - 30 : 0, gy0 - 12, 30, (gy1 - gy0) + 24);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(isRight ? gx - width : 0, gy0, width, gy1 - gy0);
  };
  drawGoal(false, d.awayFlashAt);
  drawGoal(true, d.homeFlashAt);

  // Ball trail
  st.ball.trail.forEach((t) => {
    ctx.fillStyle = `rgba(255,255,255,${0.14 * t.a})`;
    ctx.beginPath();
    ctx.arc(t.x * sx, t.y * sy, BALL_R * sx * 0.9, 0, Math.PI * 2);
    ctx.fill();
  });

  // Discs
  st.discs.forEach((disc) => {
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
    ctx.fillStyle = disc.side === "home" ? COL.homeTxt : COL.awayTxt;
    ctx.font = `bold ${Math.max(9, Math.floor(rPx * 1.1))}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(disc.number), cx, cy + 1);
  });

  // Ball
  const bx = st.ball.x * sx;
  const by = st.ball.y * sy;
  const bR = BALL_R * sx;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.arc(bx + 1.5, by + 1.5, bR * 1.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.ball;
  ctx.beginPath(); ctx.arc(bx, by, bR * 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.beginPath(); ctx.arc(bx, by, bR * 0.35, 0, Math.PI * 2); ctx.fill();

  // Celebration overlay
  if (st.celebration && d.now < st.celebration.until) {
    const life = 1 - (st.celebration.until - d.now) / 1600;
    ctx.fillStyle = `rgba(0,0,0,${0.35 + life * 0.15})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f5c542";
    ctx.font = `bold ${Math.floor(H * 0.28)}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#f5c542";
    ctx.shadowBlur = 24;
    ctx.fillText(st.celebration.text, W / 2, H / 2);
    ctx.shadowBlur = 0;
  }
}

export default CanvasMatch;
