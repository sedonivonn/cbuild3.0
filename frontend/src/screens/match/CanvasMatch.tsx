/**
 * CanvasMatch — deterministic real-time replay of the pitch physics.
 *
 * The single source of truth for match events is `pitchSim.js`. The
 * headless run inside `matchEngine.simulateMatch()` records the seed and
 * the resolved team strength stats on the match result; this component
 * rebuilds an identical `SimState` from those inputs and advances it with
 * a fixed-dt accumulator so the visible sim and the tournament's stored
 * result stay perfectly synchronised (same seed → same events at the same
 * ticks).
 *
 * The scoreboard, minute badge and commentary in the parent MatchScreen
 * are all driven by events emitted via `onEvent` — never by locally
 * generated fake events.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import {
  FIXED_DT,
  TOTAL_TICKS,
  TICKS_PER_MINUTE,
  PITCH_W,
  PITCH_H,
  GOAL_TOP,
  GOAL_BOT,
  R,
  BALL_R,
  createPitchState,
  stepPitch,
} from "../../engine/pitchSim";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SimEvent = {
  minute: number;
  side: "home" | "away";
  type: "GOAL" | "SAVE" | "SHOT" | "TACKLE" | string;
  text: string;
  scorer?: string | null;
  assist?: string | null;
  shooter?: string | null;
  critical?: boolean;
};

type MatchLike = {
  home?: { name?: string };
  away?: { name?: string };
  homeName?: string;
  awayName?: string;
  seed: number;
  _homePlayers?: any[] | null;
  _awayPlayers?: any[] | null;
  _homeStrength?: any;
  _awayStrength?: any;
};

type CanvasMatchProps = {
  stageLabel: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  liveMinute: number | null;
  matchInputs: MatchLike;             // must include seed + team info
  onEvent: (e: SimEvent) => void;      // fires whenever pitchSim emits an event
  onEnd?: () => void;                  // fires once when the sim reaches gameOver
  onSkip?: () => void;                 // parent handles skip UI transitions
};

// ---------------------------------------------------------------------------
// Palette (kept identical to previous iterations)
// ---------------------------------------------------------------------------
const PEN_BOX = 16;
const PEN_TOP = 13;
const PEN_BOT = 47;

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
};

// Filler commentary — pure atmosphere, never affects the sim. Only rendered
// into the log; not passed to `onEvent`.
const FILLER_BUILDUP = [
  "Kısa pas alışverişi.",
  "Topla oynuyorlar.",
  "Uzun pas denemesi.",
  "Orta sahada dolaşıyorlar.",
];
const FILLER_ATTACK = [
  "Ceza sahasına giriş.",
  "Kanattan atak!",
  "Merkezden hızlı hücum.",
];
const FILLER_KEEPER = [
  "Kaleci topu ayakla oynatıyor.",
  "Kaleciden uzun vuruş.",
];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

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
  matchInputs,
  onEvent,
  onEnd,
  onSkip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Deterministic pitch state. Rebuilt once from the seed on mount and never
  // reseeded — the tournament already has the definitive result via the
  // matching headless run, so we just need to REPLAY the same physics.
  const stateRef = useRef<any>(null);
  if (stateRef.current === null) {
    stateRef.current = createPitchState({
      homeName: matchInputs.homeName ?? matchInputs.home?.name ?? homeName,
      awayName: matchInputs.awayName ?? matchInputs.away?.name ?? awayName,
      homePlayers: matchInputs._homePlayers ?? null,
      awayPlayers: matchInputs._awayPlayers ?? null,
      homeStrength: matchInputs._homeStrength ?? undefined,
      awayStrength: matchInputs._awayStrength ?? undefined,
      seed: matchInputs.seed,
    });
  }

  // Fixed-dt accumulator + wall-clock scaling. FIXED_DT is the sim step
  // (1/60 s). The wall clock advances the same rate, so a full match plays
  // out in TOTAL_TICKS * FIXED_DT ≈ 30 seconds.
  const accRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  // Flash pulses on goals — cosmetic only.
  const [flashHome, setFlashHome] = useState<number>(0);
  const [flashAway, setFlashAway] = useState<number>(0);
  const [celebration, setCelebration] = useState<{ until: number; text: string } | null>(null);

  // Commentary log rendered inside the canvas panel.
  const [log, setLog] = useState<{ text: string; kind: "goal" | "save" | "shot" | "filler" | "info" }[]>([]);
  const appendLog = (text: string, kind: any) =>
    setLog((L) => {
      const next = [...L, { text, kind }];
      return next.length > 60 ? next.slice(-60) : next;
    });

  // Filler cadence — driven off tick count so it stays deterministic-ish
  // for a given session (still uses Math.random for pick() to keep variety;
  // filler never affects sim state).
  const nextFillerRef = useRef<number>(30);

  const endedRef = useRef<boolean>(false);
  const drainStateRef = useRef<{ active: boolean; onDone: (() => void) | null }>({ active: false, onDone: null });

  // Emit sim events to parent + local commentary log.
  const publishEvent = (e: SimEvent) => {
    onEvent(e);
    if (e.type === "GOAL") {
      appendLog(e.text, "goal");
      if (e.side === "home") setFlashHome(performance.now());
      else setFlashAway(performance.now());
      setCelebration({ until: performance.now() + 1600, text: "GOL!" });
    } else if (e.type === "SAVE") {
      appendLog(e.text, "save");
    } else if (e.type === "SHOT") {
      appendLog(e.text, "shot");
    } else if (e.type === "TACKLE") {
      appendLog(e.text, "filler");
    }
  };

  // Fast-forward: drain all remaining ticks synchronously (called by parent
  // via a ref exposed through onSkip semantics).
  const fastForward = () => {
    const st = stateRef.current;
    if (endedRef.current) return;
    let guard = 0;
    while (!st.gameOver && guard < TOTAL_TICKS + 60) {
      const out = stepPitch(st);
      if (out.events.length) out.events.forEach((e: SimEvent) => onEvent(e));
      guard += 1;
    }
    endedRef.current = true;
    if (onEnd) onEnd();
  };

  // Wire onSkip: parent's button click calls onSkip; here we intercept to
  // finish the sim before parent transitions the phase.
  const handleSkipClick = () => {
    fastForward();
    if (onSkip) onSkip();
  };

  // ---- Canvas render + real-time replay loop ------------------------------
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
      const rawDt = Math.min(0.1, (ts - prev) / 1000); // clamp long stalls
      lastTsRef.current = ts;

      const st = stateRef.current;
      if (!endedRef.current) {
        // Fixed-step accumulator — this is what keeps the visible replay
        // frame-rate-independent AND deterministic against the headless run.
        accRef.current += rawDt;
        let stepsThisFrame = 0;
        // Cap per-frame steps so a heavy stall can't hog the loop.
        while (accRef.current >= FIXED_DT && stepsThisFrame < 8) {
          accRef.current -= FIXED_DT;
          const out = stepPitch(st);
          if (out.events.length) out.events.forEach(publishEvent);

          // Deterministic-ish filler based purely on tick count.
          if (st.tick >= nextFillerRef.current && !st.kickoffTimer) {
            const bucket = (st.tick / 60) % 3 < 1 ? FILLER_BUILDUP
                         : (st.tick / 60) % 3 < 2 ? FILLER_ATTACK
                         : FILLER_KEEPER;
            appendLog(pick(bucket), "filler");
            nextFillerRef.current = st.tick + 30 + Math.floor(Math.random() * 30);
          }

          stepsThisFrame += 1;
          if (st.gameOver) {
            endedRef.current = true;
            if (onEnd) onEnd();
            break;
          }
        }
      }

      // Always draw so celebration overlay + flashes keep animating.
      draw(ctx, canvas, st, {
        now: ts,
        flashHome,
        flashAway,
        celebration,
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // Only the flash/celebration state changes need to re-render the effect;
    // rebinding the loop is safe because state lives in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashHome, flashAway, celebration]);

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
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSkipClick}
            data-testid="canvas-skip-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 hover:bg-amber-300 hover:text-black border border-white/15 text-white/85 font-mono text-[10px] md:text-[11px] tracking-widest transition-colors"
            title="Simülasyonu atla ve sonuca geç"
          >
            <SkipForward size={12} />
            MAÇI ATLA
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-white/15 bg-black"
        style={{ aspectRatio: `${PITCH_W} / ${PITCH_H}` }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

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
// Renderer
// ===========================================================================

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  st: any,
  d: { now: number; flashHome: number; flashAway: number; celebration: any }
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
  drawGoal(false, d.flashAway);
  drawGoal(true, d.flashHome);

  // Discs
  st.discs.forEach((disc: any) => {
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
  if (d.celebration && d.now < d.celebration.until) {
    ctx.fillStyle = `rgba(0,0,0,0.45)`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f5c542";
    ctx.font = `bold ${Math.floor(H * 0.28)}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#f5c542";
    ctx.shadowBlur = 24;
    ctx.fillText(d.celebration.text, W / 2, H / 2);
    ctx.shadowBlur = 0;
  }
}

// Suppress unused warning
void TICKS_PER_MINUTE;

export default CanvasMatch;
