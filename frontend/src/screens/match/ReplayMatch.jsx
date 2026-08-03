/**
 * ReplayMatch — text-based live match reveal.
 *
 * Replaces the previous 2D pitch canvas. The visible clock (dk:sn),
 * scoreboard, momentum meter, running stats and OLAYLAR list are all
 * driven by the pre-baked events on the leg result: we just walk the
 * timeline in wall-clock time and reveal each event as its minute:second
 * arrives.
 *
 * Speed picker (Yavaş / Normal / Hızlı) changes how many game-seconds a
 * real second represents. MAÇI ATLA fast-forwards the reveal by emitting
 * every remaining event synchronously.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Target, Hand, SkipForward, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const SPEED_KEYS = ["slow", "normal", "fast"];
const SPEED_CFG = {
  slow:   { gameSecPerRealSec: 45 },
  normal: { gameSecPerRealSec: 120 },
  fast:   { gameSecPerRealSec: 360 },
};

const MATCH_MINUTES = 90;

// Total game-seconds in a regulation match.
const TOTAL_GAME_SECONDS = MATCH_MINUTES * 60;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const fmtClock = (totalSec) => {
  const m = Math.max(0, Math.floor(totalSec / 60));
  const s = Math.max(0, Math.floor(totalSec % 60));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const evSec = (e) => (e.minute - 1) * 60 + (e.second || 0);

const eventIcon = (type) => {
  if (type === "GOAL") return <Target size={12} className="text-emerald-300" />;
  if (type === "SAVE") return <Hand size={12} className="text-sky-300" />;
  return <Zap size={12} className="text-amber-300" />;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export const ReplayMatch = ({
  stageLabel,
  legLabel,               // e.g. "MAÇ 1/2" or null
  homeName,
  awayName,
  homeIsUser,
  awayIsUser,
  events,                 // regulation events (from matchEngine)
  finalStats,             // { home:{shots,onTarget,xg,possession}, away:{...} }
  onEvent,                // (event) => void, fired the moment each event surfaces
  onEnd,                  // () => void, fired once the timeline reaches 90'
  onSkip,                 // () => void
}) => {
  const { t } = useTranslation();
  const [speedKey, setSpeedKey] = useState("normal");
  const [elapsedGameSec, setElapsedGameSec] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [flashSide, setFlashSide] = useState(null); // "home" | "away" | null

  const finishedRef = useRef(false);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const flashTimerRef = useRef(null);

  // Reset if events reference changes (e.g. new leg mounts).
  useEffect(() => {
    setElapsedGameSec(0);
    setVisibleCount(0);
    finishedRef.current = false;
  }, [events]);

  // Wall-clock driven match clock. We advance `elapsedGameSec` each frame by
  // `gameSecPerRealSec * dt`.
  useEffect(() => {
    const speed = SPEED_CFG[speedKey];
    const tick = (ts) => {
      const prev = lastTsRef.current || ts;
      const dt = Math.min(0.1, (ts - prev) / 1000);
      lastTsRef.current = ts;
      setElapsedGameSec((prevSec) => {
        if (finishedRef.current) return prevSec;
        const next = prevSec + dt * speed.gameSecPerRealSec;
        if (next >= TOTAL_GAME_SECONDS) {
          finishedRef.current = true;
          // Flush any remaining events and end.
          setVisibleCount((vc) => {
            if (vc < events.length) {
              for (let i = vc; i < events.length; i++) onEvent?.(events[i]);
            }
            return events.length;
          });
          setTimeout(() => onEnd?.(), 120);
          return TOTAL_GAME_SECONDS;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
    // Restart the RAF loop only when speed changes; events reset is handled
    // by the separate effect above.
  }, [speedKey, events, onEvent, onEnd]);

  // Reveal any events whose game-time has passed.
  useEffect(() => {
    if (visibleCount >= events.length) return;
    let vc = visibleCount;
    while (vc < events.length && evSec(events[vc]) <= elapsedGameSec) {
      const e = events[vc];
      onEvent?.(e);
      if (e.type === "GOAL") {
        setFlashSide(e.side);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashSide(null), 900);
      }
      vc += 1;
    }
    if (vc !== visibleCount) setVisibleCount(vc);
  }, [elapsedGameSec, events, visibleCount, onEvent]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  // Skip button — flush the whole timeline.
  const handleSkip = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    for (let i = visibleCount; i < events.length; i++) onEvent?.(events[i]);
    setVisibleCount(events.length);
    setElapsedGameSec(TOTAL_GAME_SECONDS);
    setTimeout(() => {
      onSkip?.();
      onEnd?.();
    }, 60);
  };

  // ---- Live score derived from the events revealed so far ----------------
  const liveScore = useMemo(() => {
    let h = 0, a = 0;
    for (let i = 0; i < visibleCount; i++) {
      const e = events[i];
      if (e.type === "GOAL") {
        if (e.side === "home") h++; else a++;
      }
    }
    return { h, a };
  }, [visibleCount, events]);

  // ---- Progressive stats (shown up to the current minute) ----------------
  const running = useMemo(() => {
    const s = { h: { shots: 0, on: 0, xg: 0 }, a: { shots: 0, on: 0, xg: 0 } };
    for (let i = 0; i < visibleCount; i++) {
      const e = events[i];
      // "side" for SAVE is the DEFENDING side — so the shot belongs to the
      // opposite side.
      const shotSide = e.type === "SAVE" ? (e.side === "home" ? "away" : "home") : e.side;
      const bucket = shotSide === "home" ? s.h : s.a;
      if (e.type === "GOAL") { bucket.shots++; bucket.on++; bucket.xg += 0.55; }
      else if (e.type === "SAVE") { bucket.shots++; bucket.on++; bucket.xg += 0.28; }
      else if (e.type === "CHANCE") { bucket.shots++; bucket.xg += 0.12; }
    }
    return s;
  }, [visibleCount, events]);

  // Cap running values by the final totals to avoid overshoot glitches.
  const capped = useMemo(() => {
    const cap = (val, max) => Math.min(val, max);
    return {
      h: {
        shots: cap(Math.max(running.h.shots, liveScore.h), finalStats?.home?.shots ?? running.h.shots),
        on:    cap(Math.max(running.h.on,   liveScore.h), finalStats?.home?.onTarget ?? running.h.on),
        xg:    +(cap(running.h.xg, finalStats?.home?.xg ?? running.h.xg)).toFixed(1),
      },
      a: {
        shots: cap(Math.max(running.a.shots, liveScore.a), finalStats?.away?.shots ?? running.a.shots),
        on:    cap(Math.max(running.a.on,   liveScore.a), finalStats?.away?.onTarget ?? running.a.on),
        xg:    +(cap(running.a.xg, finalStats?.away?.xg ?? running.a.xg)).toFixed(1),
      },
    };
  }, [running, liveScore, finalStats]);

  // Momentum: last 8 events, home vs away weight.
  const momentum = useMemo(() => {
    if (visibleCount === 0) return 50;
    const window = events.slice(Math.max(0, visibleCount - 8), visibleCount);
    let h = 0, a = 0;
    window.forEach((e) => {
      const w = e.type === "GOAL" ? 3 : e.type === "SAVE" ? 1 : 1.2;
      // Shot side (not defending side)
      const shotSide = e.type === "SAVE" ? (e.side === "home" ? "away" : "home") : e.side;
      if (shotSide === "home") h += w; else a += w;
    });
    const total = h + a;
    if (total === 0) return 50;
    return Math.round((h / total) * 100);
  }, [visibleCount, events]);

  // Possession (progressive fade from 50 towards final).
  const possession = useMemo(() => {
    const finalHome = finalStats?.home?.possession ?? 50;
    const t = Math.min(1, elapsedGameSec / TOTAL_GAME_SECONDS);
    const val = Math.round(50 + (finalHome - 50) * t);
    return { h: val, a: 100 - val };
  }, [elapsedGameSec, finalStats]);

  const eventsToShow = useMemo(() => {
    // Newest first, capped for scrollable panel.
    return events.slice(0, visibleCount).slice().reverse();
  }, [events, visibleCount]);

  const clock = fmtClock(elapsedGameSec);

  return (
    <div className="w-full" data-testid="replay-match">
      {/* ---- Top row: clock + leg badge + skip -------------------------- */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/6 border border-white/12 font-mono text-[11px] md:text-xs tracking-widest text-white/85" data-testid="replay-clock">
          <Clock size={12} className="text-amber-300" />
          <span className="tabular-nums text-white">{clock}</span>
          <span className="text-white/40">·</span>
          <span className="text-amber-300 text-[10px]">{stageLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {legLabel && (
            <div className="font-mono text-[10px] md:text-[11px] tracking-widest text-white/60" data-testid="replay-leg-label">{legLabel}</div>
          )}
          <button
            type="button"
            onClick={handleSkip}
            data-testid="replay-skip-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 hover:bg-amber-300 hover:text-black border border-white/15 text-white/85 font-mono text-[10px] md:text-[11px] tracking-widest transition-colors"
            title={t("replay.skipTitle")}
          >
            <SkipForward size={12} />
            {t("replay.skipMatch")}
          </button>
        </div>
      </div>

      {/* ---- Scoreboard ------------------------------------------------ */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="text-right min-w-0">
          <motion.div
            animate={flashSide === "home" ? { color: ["#fef08a", "#ffffff"] } : {}}
            transition={{ duration: 0.9 }}
            className="font-display text-lg md:text-2xl tracking-tight truncate"
            data-testid="replay-home-name"
          >
            {homeName}
          </motion.div>
          <div className="text-[10px] text-white/45 font-mono tracking-widest">
            {homeIsUser ? t("common.yourTeamHome") : t("common.homeShort")}
          </div>
        </div>
        <motion.div
          key={`${liveScore.h}-${liveScore.a}`}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.14, 1] }}
          transition={{ duration: 0.45 }}
          className="font-display text-4xl md:text-5xl leading-none px-4 py-1.5 rounded-lg border border-red-500/50 bg-red-500/10 text-white tabular-nums"
          data-testid="replay-score"
        >
          {liveScore.h} <span className="text-white/30">-</span> {liveScore.a}
        </motion.div>
        <div className="min-w-0">
          <motion.div
            animate={flashSide === "away" ? { color: ["#fef08a", "#ffffff"] } : {}}
            transition={{ duration: 0.9 }}
            className="font-display text-lg md:text-2xl tracking-tight truncate"
            data-testid="replay-away-name"
          >
            {awayName}
          </motion.div>
          <div className="text-[10px] text-white/45 font-mono tracking-widest">
            {awayIsUser ? t("common.yourTeamAway") : t("common.awayShort")}
          </div>
        </div>
      </div>

      {/* ---- Momentum / Baskı bar -------------------------------------- */}
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] tracking-widest text-white/45">
        <span>{t("replay.momentum")}</span><span>{t("replay.pressure")}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-4 relative" data-testid="replay-momentum">
        <div className="absolute inset-y-0 left-0 bg-amber-300/70" style={{ width: `${momentum}%` }} />
        <div className="absolute inset-y-0 right-0 bg-red-500/70" style={{ width: `${100 - momentum}%` }} />
      </div>

      {/* ---- Stat rows ------------------------------------------------- */}
      <div className="space-y-2 mb-4" data-testid="replay-stats">
        <StatRow label={t("replay.shot")}     h={capped.h.shots} a={capped.a.shots} />
        <StatRow label={t("replay.onTarget")}  h={capped.h.on}    a={capped.a.on} />
        <StatRow label={t("replay.xg")}      h={capped.h.xg}    a={capped.a.xg} decimals={1} />
        <StatRow label={t("replay.possession")} h={`${possession.h}%`} a={`${possession.a}%`} isString />
      </div>

      {/* ---- Events list ----------------------------------------------- */}
      <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden" data-testid="replay-events">
        <div className="px-3 py-2 font-mono text-[10px] tracking-widest text-white/55 border-b border-white/10">
          {t("replay.events")}
        </div>
        <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-1.5">
          {eventsToShow.length === 0 ? (
            <div className="text-white/40 font-mono text-[11px] py-3 text-center" data-testid="replay-events-empty">
              {t("replay.matchStarted")}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {eventsToShow.map((e, idx) => (
                <EventRow key={`${e.minute}-${e.second || 0}-${idx}-${e.type}`} e={e} t={t} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ---- Speed picker --------------------------------------------- */}
      <div className="mt-4 flex items-center justify-center gap-2" data-testid="replay-speed-picker">
        <div className="font-mono text-[10px] tracking-widest text-white/45 mr-1">{t("replay.speed")}</div>
        {SPEED_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSpeedKey(key)}
            data-testid={`replay-speed-${key}`}
            className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest border transition-colors ${
              speedKey === key
                ? "bg-amber-300 text-black border-amber-300"
                : "bg-white/6 text-white/75 border-white/12 hover:bg-white/12"
            }`}
          >
            {t(`replay.speed${key.charAt(0).toUpperCase() + key.slice(1)}`)}
          </button>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------
const StatRow = ({ label, h, a, decimals = 0, isString = false }) => {
  const hn = isString ? parseFloat(h) : Number(h);
  const an = isString ? parseFloat(a) : Number(a);
  const total = (hn + an) || 1;
  const hPct = Math.max(4, Math.min(96, (hn / total) * 100));
  return (
    <div className="grid grid-cols-[52px_1fr_52px] items-center gap-2">
      <div className="text-left font-display text-lg tabular-nums text-white" data-testid={`stat-h-${label}`}>
        {isString ? h : (typeof h === "number" ? h.toFixed(decimals) : h)}
      </div>
      <div className="relative">
        <div className="text-center font-mono text-[10px] tracking-widest text-white/50 mb-0.5">{label}</div>
        <div className="h-1.5 rounded-full bg-white/6 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-amber-300/80" style={{ width: `${hPct}%` }} />
          <div className="absolute inset-y-0 right-0 bg-red-500/80" style={{ width: `${100 - hPct}%` }} />
        </div>
      </div>
      <div className="text-right font-display text-lg tabular-nums text-white" data-testid={`stat-a-${label}`}>
        {isString ? a : (typeof a === "number" ? a.toFixed(decimals) : a)}
      </div>
    </div>
  );
};

const EventRow = ({ e, t }) => {
  const isHome = e.side === "home";
  const tag = e.type === "GOAL" ? t("replay.tagGoal") : e.type === "SAVE" ? t("replay.tagSave") : t("replay.tagChance");
  const player = e.player || e.scorer || e.shooter || e.teamName || "";
  const tagColor =
    e.type === "GOAL" ? "text-emerald-300" :
    e.type === "SAVE" ? "text-sky-300" :
    "text-amber-300";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 text-[11px] md:text-xs font-mono ${isHome ? "justify-start" : "justify-end"}`}
      data-testid={`event-row-${e.type.toLowerCase()}`}
    >
      {isHome ? (
        <>
          <span className="text-white/55 tabular-nums w-8">{e.minute}'</span>
          {eventIcon(e.type)}
          <span className="text-white truncate">{player}</span>
          <span className={`ml-1 tracking-widest text-[10px] ${tagColor}`}>{tag}</span>
        </>
      ) : (
        <>
          <span className={`mr-1 tracking-widest text-[10px] ${tagColor}`}>{tag}</span>
          <span className="text-white truncate">{player}</span>
          {eventIcon(e.type)}
          <span className="text-white/55 tabular-nums w-8 text-right">{e.minute}'</span>
        </>
      )}
    </motion.div>
  );
};

export default ReplayMatch;
