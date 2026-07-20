import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sound } from "../engine/sounds";
import { Gauge, FastForward, Zap, Pause } from "lucide-react";
import { FORMATIONS } from "../data/formations";

// Sim speed: ms delay between events
const SPEEDS = [
  { key: "slow",    label: "YAVAŞ",  icon: Pause,       delay: 900 },
  { key: "normal",  label: "NORMAL", icon: Gauge,       delay: 400 },
  { key: "fast",    label: "HIZLI",  icon: FastForward, delay: 130 },
  { key: "ultra",   label: "ULTRA",  icon: Zap,         delay: 25  },
];

const SPEED_KEY = "ucl_match_speed_v1";

function loadSpeed() {
  try { return localStorage.getItem(SPEED_KEY) || "normal"; } catch (_) { return "normal"; }
}
function saveSpeed(k) {
  try { localStorage.setItem(SPEED_KEY, k); } catch (_) { /* ignore */ }
}

// -----------------------------------------------------------------------------
// Opponent XI → formation mapping (opponents don't carry a formation, only a
// top-11 sorted by rating). We drop the sorted list into a 4-3-3 template using
// each player's primary position and fall back to the raw order if the mapping
// can't fill a slot.
// -----------------------------------------------------------------------------
const DEFAULT_OPP_FORMATION = "4-3-3";

function buildOpponentXi(players) {
  if (!players || players.length === 0) return { formationId: DEFAULT_OPP_FORMATION, xi: [] };
  const formation = FORMATIONS[DEFAULT_OPP_FORMATION];
  const slots = formation.slots;
  const pool = players.slice(0, 11);
  const xi = new Array(slots.length).fill(null);
  const used = new Set();

  const matches = (slotPos, p) => p && (p.primary === slotPos || p.secondary === slotPos);
  const familyMatch = (slotPos, p) => {
    if (!p) return false;
    const wide = new Set(["LW", "RW", "LM", "RM"]);
    if (wide.has(slotPos) && (wide.has(p.primary) || wide.has(p.secondary))) return true;
    return false;
  };

  // Pass 1: exact primary/secondary match
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((p, pi) => !used.has(pi) && matches(slot.pos, p));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  // Pass 2: wing family match
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((p, pi) => !used.has(pi) && familyMatch(slot.pos, p));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  // Pass 3: leftovers in order
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((_, pi) => !used.has(pi));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  return { formationId: DEFAULT_OPP_FORMATION, xi };
}

export const MatchScreen = ({ match, onClose }) => {
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [phase, setPhase] = useState("prematch"); // prematch -> kickoff -> playing -> et_confirm -> playing_et -> penalties -> done
  const [legIdx, setLegIdx] = useState(0);
  const [speedKey, setSpeedKey] = useState(loadSpeed());
  const [penShotIdx, setPenShotIdx] = useState(0);
  const [etVisibleIdx, setEtVisibleIdx] = useState(0);
  const [shotAnim, setShotAnim] = useState(null); // { type: "GOAL"|"SAVE", side: "home"|"away", minute }
  const finishedRef = useRef(false);

  const speed = SPEEDS.find((s) => s.key === speedKey) || SPEEDS[1];

  const isKnockout = !!match.knockout;
  const legs = useMemo(() => {
    if (!isKnockout) return [match.result];
    if (match.knockout.tie.legs) return match.knockout.tie.legs;
    return [match.knockout.tie.match];
  }, [match, isKnockout]);

  const isSecondLeg = isKnockout && legs.length === 2 && legIdx === 1;
  const homeRef = isKnockout
    ? (isSecondLeg ? match.knockout.away : match.knockout.home)
    : match.home;
  const awayRef = isKnockout
    ? (isSecondLeg ? match.knockout.home : match.knockout.away)
    : match.away;
  const homeName = homeRef.label || homeRef.name;
  const awayName = awayRef.label || awayRef.name;

  const currentLeg = legs[legIdx];
  const events = currentLeg?.events || [];
  const regulationEvents = useMemo(() => events.filter((e) => e.minute <= 90), [events]);
  const extraTimeEvents = useMemo(() => events.filter((e) => e.minute > 90), [events]);
  const isLastLeg = legIdx === legs.length - 1;
  const tie = isKnockout ? match.knockout.tie : null;
  const hasPenalties = isKnockout && tie?.penalties;
  const hasExtraTime = isKnockout && isLastLeg && (!!tie?.et || tie?.decidedBy === "extra_time" || tie?.decidedBy === "penalties");

  const userSide = useMemo(() => {
    if (homeRef?.isUser) return "home";
    if (awayRef?.isUser) return "away";
    return null;
  }, [homeRef, awayRef]);

  // Resolve XI + formation for both sides. User side uses `match.userXi` /
  // `match.userFormationId`; opponents use their top-11 mapped into 4-3-3.
  const homeLineup = useMemo(() => {
    if (homeRef?.isUser) return { formationId: match.userFormationId || DEFAULT_OPP_FORMATION, xi: match.userXi || [] };
    return buildOpponentXi(homeRef?.players);
  }, [homeRef, match.userXi, match.userFormationId]);
  const awayLineup = useMemo(() => {
    if (awayRef?.isUser) return { formationId: match.userFormationId || DEFAULT_OPP_FORMATION, xi: match.userXi || [] };
    return buildOpponentXi(awayRef?.players);
  }, [awayRef, match.userXi, match.userFormationId]);

  // Event styling used by the ticker. Home events sit on the left, away on the right.
  const eventClass = (e) => {
    if (e.type === "GOAL") {
      const isUserGoal = userSide && e.side === userSide;
      return isUserGoal ? "text-amber-300 font-semibold" : "text-white font-semibold";
    }
    if (e.type === "SAVE") return "text-emerald-300";
    return "text-white/60";
  };

  // Reset per leg (excluding prematch which only fires on the first leg entry).
  useEffect(() => {
    setVisibleIdx(0);
    setEtVisibleIdx(0);
    setPenShotIdx(0);
    setShotAnim(null);
    finishedRef.current = false;
    if (legIdx === 0) return; // first leg is handled by prematch → start button
    sound.whistleStart();
    setPhase("kickoff");
    const k = setTimeout(() => setPhase("playing"), 800);
    return () => clearTimeout(k);
  }, [legIdx]);

  const startMatch = () => {
    sound.whistleStart();
    setPhase("kickoff");
    setTimeout(() => setPhase("playing"), 800);
  };

  // Should we run the ball-flight animation before revealing this event?
  // Rule: only "critical" events (all goals + a subset of saves — flagged by
  // matchEngine) trigger the animation, so it stays a rare highlight instead
  // of firing on every shot.
  const isCriticalShot = (e) =>
    e && (e.type === "GOAL" || e.type === "SAVE") && e.critical === true;
  const shouldAnimateShot = (e) => isCriticalShot(e);
  // Fixed cinematic duration regardless of sim speed — even in ULTRA the
  // highlight plays at the same dramatic pace so the moment always lands.
  const SHOT_ANIM_MS = 2400;

  // Regulation event ticker (minutes 1-90)
  useEffect(() => {
    if (phase !== "playing") return;
    if (visibleIdx >= regulationEvents.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        if (isLastLeg && hasExtraTime) setPhase("et_confirm");
        else if (isLastLeg && hasPenalties && !hasExtraTime) setPhase("penalties");
        else setPhase("done");
      }, 400);
      return () => clearTimeout(t);
    }
    const e = regulationEvents[visibleIdx];
    if (shouldAnimateShot(e)) {
      setShotAnim({ type: e.type, side: e.side, minute: e.minute, scorer: e.scorer, assist: e.assist, shooter: e.shooter });
      const t = setTimeout(() => {
        if (e.type === "GOAL") sound.goal();
        setShotAnim(null);
        setVisibleIdx((i) => i + 1);
      }, SHOT_ANIM_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setVisibleIdx((i) => i + 1);
    }, speed.delay);
    return () => clearTimeout(t);
  }, [phase, visibleIdx, regulationEvents, speed.delay, isLastLeg, hasExtraTime, hasPenalties, speedKey]);

  // Extra-time event ticker (minutes 91-120)
  useEffect(() => {
    if (phase !== "playing_et") return;
    if (etVisibleIdx >= extraTimeEvents.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        if (hasPenalties) setPhase("penalties");
        else setPhase("done");
      }, 400);
      return () => clearTimeout(t);
    }
    const e = extraTimeEvents[etVisibleIdx];
    if (shouldAnimateShot(e)) {
      setShotAnim({ type: e.type, side: e.side, minute: e.minute, scorer: e.scorer, assist: e.assist, shooter: e.shooter });
      const t = setTimeout(() => {
        if (e.type === "GOAL") sound.goal();
        setShotAnim(null);
        setEtVisibleIdx((i) => i + 1);
      }, SHOT_ANIM_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setEtVisibleIdx((i) => i + 1);
    }, speed.delay);
    return () => clearTimeout(t);
  }, [phase, etVisibleIdx, extraTimeEvents, speed.delay, hasPenalties, speedKey]);

  // Penalty reveal (slow, suspense)
  useEffect(() => {
    if (phase !== "penalties") return;
    const shots = tie?.penalties?.shots || [];
    if (penShotIdx >= shots.length) {
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
    const baseDelay = Math.max(550, speed.delay * 2);
    const t = setTimeout(() => {
      const s = shots[penShotIdx];
      if (s.scored) sound.goal(); else sound.error();
      setPenShotIdx(penShotIdx + 1);
    }, baseDelay);
    return () => clearTimeout(t);
  }, [phase, penShotIdx, tie, speed.delay]);

  const handleClose = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onClose();
  };

  const nextLeg = () => {
    if (legIdx + 1 < legs.length) setLegIdx(legIdx + 1);
    else handleClose();
  };

  const startExtraTime = () => {
    sound.whistleStart();
    setPhase("playing_et");
  };

  // Score accumulation
  const goalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    regulationEvents.slice(0, visibleIdx).forEach((e) => {
      if (e.type === "GOAL") { if (e.side === "home") h++; else a++; }
    });
    return { h, a };
  }, [regulationEvents, visibleIdx]);

  const etGoalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    extraTimeEvents.slice(0, etVisibleIdx).forEach((e) => {
      if (e.type === "GOAL") { if (e.side === "home") h++; else a++; }
    });
    return { h, a };
  }, [extraTimeEvents, etVisibleIdx]);

  let displayedHomeScore;
  let displayedAwayScore;
  if (phase === "prematch" || phase === "playing" || phase === "kickoff") {
    displayedHomeScore = goalsSoFar.h;
    displayedAwayScore = goalsSoFar.a;
  } else if (phase === "et_confirm") {
    displayedHomeScore = regulationEvents.reduce((s, e) => s + (e.type === "GOAL" && e.side === "home" ? 1 : 0), 0);
    displayedAwayScore = regulationEvents.reduce((s, e) => s + (e.type === "GOAL" && e.side === "away" ? 1 : 0), 0);
  } else if (phase === "playing_et") {
    const regH = regulationEvents.reduce((s, e) => s + (e.type === "GOAL" && e.side === "home" ? 1 : 0), 0);
    const regA = regulationEvents.reduce((s, e) => s + (e.type === "GOAL" && e.side === "away" ? 1 : 0), 0);
    displayedHomeScore = regH + etGoalsSoFar.h;
    displayedAwayScore = regA + etGoalsSoFar.a;
  } else {
    displayedHomeScore = currentLeg.home.score;
    displayedAwayScore = currentLeg.away.score;
  }

  const penShots = tie?.penalties?.shots || [];
  const penShown = penShots.slice(0, penShotIdx);
  const penPairHomeName = (match.knockout?.home?.label) || homeName;
  const penPairAwayName = (match.knockout?.away?.label) || awayName;
  const penHomeScored = penShown.filter((s) => s.side === "home" && s.scored).length;
  const penAwayScored = penShown.filter((s) => s.side === "away" && s.scored).length;

  const showAggregateBlock = phase === "done" && isKnockout && isLastLeg;

  // Current minute in play — used for the OSM-style live clock badge.
  const liveMinute = useMemo(() => {
    if (phase === "playing" && visibleIdx > 0) {
      return regulationEvents[Math.min(visibleIdx - 1, regulationEvents.length - 1)]?.minute ?? 0;
    }
    if (phase === "playing_et" && etVisibleIdx > 0) {
      return extraTimeEvents[Math.min(etVisibleIdx - 1, extraTimeEvents.length - 1)]?.minute ?? 90;
    }
    return null;
  }, [phase, visibleIdx, etVisibleIdx, regulationEvents, extraTimeEvents]);

  // Combined visible events (regulation + ET) for the interleaved ticker.
  const shownEvents = useMemo(() => {
    const arr = regulationEvents.slice(0, visibleIdx).map((e, i) => ({ ...e, _k: `reg-${i}` }));
    const etCount = (phase === "playing_et") ? etVisibleIdx : ((phase === "done" || phase === "finished") ? extraTimeEvents.length : 0);
    for (let i = 0; i < etCount; i++) arr.push({ ...extraTimeEvents[i], _k: `et-${i}` });
    return arr;
  }, [regulationEvents, visibleIdx, extraTimeEvents, etVisibleIdx, phase]);

  // Prematch: allow cancelling by pressing Escape or clicking the backdrop.
  // We only wire these while the animation hasn't started yet — once the
  // simulation kicks off, the modal must run to completion so that the
  // tournament state stays consistent with the (already-applied) result.
  useEffect(() => {
    if (phase !== "prematch") return;
    const onKey = (ev) => { if (ev.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      data-testid="match-modal"
      onClick={(e) => {
        // Only backdrop clicks close, and only while still in prematch.
        if (phase === "prematch" && e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`glass rounded-2xl w-full ${phase === "prematch" ? "max-w-5xl" : "max-w-3xl"} p-5 md:p-7`}
      >
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="font-mono text-xs tracking-widest text-amber-300">
            {match.stage ? match.stage : "GRUP AŞAMASI"}{legs.length > 1 && ` · LEG ${legIdx + 1}/${legs.length} · ${isSecondLeg ? "RÖVANŞ" : "İLK MAÇ"}`}
          </div>
          <SpeedPicker speedKey={speedKey} onChange={(k) => { setSpeedKey(k); saveSpeed(k); }} />
        </div>

        {/* --- PRE-MATCH: side-by-side lineups + pitches ------------------ */}
        {phase === "prematch" && (
          <PreMatchLineups
            homeName={homeName}
            awayName={awayName}
            homeRef={homeRef}
            awayRef={awayRef}
            homeLineup={homeLineup}
            awayLineup={awayLineup}
            onStart={startMatch}
            onCancel={handleClose}
          />
        )}

        {/* --- SCOREBOARD (visible during play/done, not in prematch) ----- */}
        {phase !== "prematch" && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-3">
            <div className="text-right min-w-0">
              <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="home-name">{homeName}</div>
              <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "EV SAHİBİ" : ""}</div>
            </div>
            <div className="text-center flex flex-col items-center">
              <motion.div
                key={`${displayedHomeScore}-${displayedAwayScore}-${legIdx}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1.0, 1.18, 1.0] }}
                transition={{ duration: 0.5 }}
                className="font-display text-5xl md:text-6xl text-amber-300 leading-none"
                data-testid="scoreboard"
              >
                {displayedHomeScore} <span className="text-white/30">·</span> {displayedAwayScore}
              </motion.div>
              {liveMinute !== null && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-white/10 text-white/80 font-mono text-[10px] tracking-widest" data-testid="live-minute">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  {`${liveMinute}'`}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="away-name">{awayName}</div>
              <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "DEPLASMAN" : ""}</div>
            </div>
          </div>
        )}

        {/* --- SHOT ANIMATION (over ticker while a chance unfolds) -------- */}
        {phase !== "penalties" && phase !== "prematch" && (
          <div className="relative">
            <AnimatePresence>
              {shotAnim && (
                <ShotAnimation
                  key={`${shotAnim.type}-${shotAnim.side}-${shotAnim.minute}`}
                  anim={shotAnim}
                  userSide={userSide}
                  homeName={homeName}
                  awayName={awayName}
                  duration={SHOT_ANIM_MS}
                />
              )}
            </AnimatePresence>

            {/* Ticker (interleaved home-left / away-right OSM-style) */}
            {!shotAnim && (
              <div className="bg-black/40 rounded-xl p-3 max-h-64 overflow-y-auto border border-white/5" data-testid="event-ticker">
                <AnimatePresence>
                  {shownEvents.map((e, i) => (
                    <TickerRow
                      key={e._k}
                      event={e}
                      className={eventClass(e)}
                      index={i}
                    />
                  ))}
                  {phase === "kickoff" && (
                    <div className="text-center text-white/40 font-display text-lg tracking-widest py-4">KICK-OFF</div>
                  )}
                  {phase === "playing" && visibleIdx === 0 && (
                    <div className="text-white/40 text-sm text-center py-4">Maç başladı...</div>
                  )}
                  {phase === "playing_et" && etVisibleIdx === 0 && (
                    <div className="text-center text-amber-300 font-display text-base tracking-widest py-3 border-t border-amber-300/30 mt-2">
                      UZATMA BAŞLADI
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Extra-time confirmation modal */}
        {phase === "et_confirm" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 bg-black/60 border border-amber-300/40 rounded-xl p-5 text-center"
            data-testid="et-confirm-modal"
          >
            <div className="font-mono text-[10px] tracking-widest text-amber-300 mb-2">90. DAKİKA</div>
            <div className="font-display text-2xl md:text-3xl text-white mb-2">Maç uzatmalara gidiyor.</div>
            <div className="text-sm text-white/70 mb-4">Devam etmek ister misin? 30 dakikalık uzatma oynanacak, gerekirse penaltılara gidilecek.</div>
            <button type="button" className="btn-primary" onClick={startExtraTime} data-testid="et-continue-button">DEVAM ET →</button>
          </motion.div>
        )}

        {/* Penalty reveal */}
        {phase === "penalties" && (
          <div className="bg-black/50 rounded-xl p-4 border border-amber-300/30" data-testid="penalty-block">
            <div className="text-center font-display text-2xl text-amber-300 tracking-widest mb-3">PENALTI ATIŞLARI</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <PenaltyColumn name={penPairHomeName} shots={penShown.filter((s) => s.side === "home")} totalScored={penHomeScored} />
              <PenaltyColumn name={penPairAwayName} shots={penShown.filter((s) => s.side === "away")} totalScored={penAwayScored} />
            </div>
            <div className="text-center mt-3 text-[10px] text-white/40 font-mono tracking-widest">
              {penShotIdx} / {penShots.length} ATIŞ
            </div>
          </div>
        )}

        {/* Stats */}
        {phase === "done" && currentLeg && phase !== "penalties" && (
          <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs text-white/70">
            <StatBar label="ŞUT"      h={currentLeg.home.shots}    a={currentLeg.away.shots} />
            <StatBar label="İSABETLİ" h={currentLeg.home.onTarget} a={currentLeg.away.onTarget} />
            <StatBar label="XG"       h={currentLeg.home.xg?.toFixed(2)} a={currentLeg.away.xg?.toFixed(2)} />
          </div>
        )}

        {/* Player of the Match */}
        {phase === "done" && currentLeg && (() => {
          const homeStats = currentLeg.homePlayerStats || [];
          const awayStats = currentLeg.awayPlayerStats || [];
          const all = [
            ...homeStats.map((p) => ({ ...p, _side: "home" })),
            ...awayStats.map((p) => ({ ...p, _side: "away" })),
          ];
          if (all.length === 0) return null;
          const potm = [...all].sort((a, b) => b.rating - a.rating)[0];
          if (!potm) return null;
          const isUserPotm = userSide && potm._side === userSide;
          const saves = (currentLeg.events || []).filter((e) => e.type === "SAVE" && e.side === potm._side).length;
          const isGK = potm.slot === "GK";
          const containerClass = isUserPotm
            ? "border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-amber-300/0"
            : "border-white/30 bg-gradient-to-br from-white/10 to-white/0";
          const labelColor = isUserPotm ? "text-amber-300" : "text-white";
          const ratingColor = isUserPotm ? "text-amber-300" : "text-white";
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`mt-4 p-4 rounded-xl border ${containerClass}`}
              data-testid="potm-card"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <div className={`font-mono text-[10px] tracking-widest ${labelColor}`}>
                    PLAYER OF THE MATCH{!isUserPotm && " · RAKİP"}
                  </div>
                  <div className="font-display text-2xl tracking-tight mt-0.5 truncate">{potm.name}</div>
                  {potm.teamName && (
                    <div className={`text-[10px] font-mono tracking-wider truncate uppercase ${isUserPotm ? "text-amber-300/70" : "text-white/65"}`}>
                      {potm.teamName}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-white/50 tracking-wider mt-0.5">
                    {potm.slot} · {potm.season} · {isGK ? `${saves} KURTARIŞ` : `${potm.goals} GOL · ${potm.assists} ASİST`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-display text-4xl ${ratingColor}`}>{potm.rating.toFixed(1)}</div>
                  <div className="text-[10px] font-mono text-white/50">REYTING</div>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Aggregate / result */}
        {showAggregateBlock && (
          <div className="mt-4 text-center" data-testid="aggregate-result">
            {tie?.aggregate && (
              <div className="font-display text-lg tracking-widest text-amber-300">
                TOPLAM: {match.knockout.home.label} {tie.aggregate.a} - {tie.aggregate.b} {match.knockout.away.label}
              </div>
            )}
            {tie?.decidedBy === "penalties" && tie?.penalties && (
              <div className="font-mono text-xs tracking-widest text-amber-300 mt-1">
                PENALTILAR: {tie.penalties.a} - {tie.penalties.b}
              </div>
            )}
            <div className="font-display text-3xl mt-2 text-white" data-testid="user-result">
              {match.spectator
                ? `KAZANAN: ${tie?.winner === "home" ? match.knockout.home.label : match.knockout.away.label}`
                : (match.userWon ? "TUR ATLADIN" : "ELENDİN")}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {phase === "done" && legIdx + 1 < legs.length && (
            <button type="button" className="btn-ghost" onClick={nextLeg} data-testid="next-leg-button">RÖVANŞ MAÇI →</button>
          )}
          {phase === "done" && legIdx + 1 >= legs.length && (
            <button type="button" className="btn-primary" onClick={handleClose} data-testid="close-match-button">DEVAM ET</button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// PreMatchLineups — two team columns, each with player list and a mini pitch.
// -----------------------------------------------------------------------------
const PreMatchLineups = ({ homeName, awayName, homeRef, awayRef, homeLineup, awayLineup, onStart, onCancel }) => (
  <div data-testid="prematch-lineups">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <TeamLineupPanel
        name={homeName}
        subtitle={homeRef?.isUser ? "SENİN TAKIMIN" : (homeRef?.season ? `${homeRef.season} · ${homeRef.club || ""}` : (homeRef?.club || ""))}
        accent="left"
        lineup={homeLineup}
      />
      <TeamLineupPanel
        name={awayName}
        subtitle={awayRef?.isUser ? "SENİN TAKIMIN" : (awayRef?.season ? `${awayRef.season} · ${awayRef.club || ""}` : (awayRef?.club || ""))}
        accent="right"
        lineup={awayLineup}
      />
    </div>
    <div className="mt-5 flex items-center justify-center gap-3">
      <button type="button" className="btn-ghost" onClick={onCancel} data-testid="prematch-cancel-button">
        ← GERİ
      </button>
      <button type="button" className="btn-primary" onClick={onStart} data-testid="start-match-button">
        MAÇI BAŞLAT →
      </button>
    </div>
    <div className="mt-2 text-center text-[10px] font-mono tracking-widest text-white/40">
      ESC veya dışarı tıklamak da geri dönüyor
    </div>
  </div>
);

const TeamLineupPanel = ({ name, subtitle, accent, lineup }) => {
  const players = lineup?.xi || [];
  const barClass = accent === "left"
    ? "bg-gradient-to-r from-amber-300/25 to-transparent border-l-4 border-amber-300"
    : "bg-gradient-to-l from-red-400/25 to-transparent border-r-4 border-red-400";
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30 flex flex-col">
      <div className={`px-3 py-2 ${barClass}`}>
        <div className="font-display text-lg md:text-xl tracking-tight truncate">{name}</div>
        {subtitle && <div className="text-[10px] font-mono tracking-widest text-white/60 truncate">{subtitle}</div>}
      </div>
      {/* Player list only — the mini pitch under the list was removed on user
          request. Keep the list as the single source of prematch info. */}
      <ul className="p-3 space-y-1 min-w-0" data-testid={`lineup-list-${accent}`}>
        {players.slice(0, 11).map((p, i) => {
          if (!p) {
            return (
              <li key={i} className="flex items-center gap-2 text-xs text-white/40">
                <span className="font-mono w-5 text-right">{i + 1}.</span>
                <span className="italic">— BOŞ SLOT —</span>
              </li>
            );
          }
          const ovr = p.overall ?? 80;
          return (
            <li key={i} className="flex items-center gap-2 text-xs md:text-sm">
              <span className="font-mono w-5 text-right text-white/50">{i + 1}.</span>
              <span className="flex-1 truncate">{p.name}</span>
              <OvrBadge ovr={ovr} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const OvrBadge = ({ ovr }) => {
  const bg =
    ovr >= 99 ? "bg-black text-orange-300 border-orange-400/50" :
    ovr >= 90 ? "bg-purple-600/30 text-purple-200 border-purple-400/50" :
    ovr >= 81 ? "bg-amber-500/30 text-amber-200 border-amber-400/60" :
    ovr >= 70 ? "bg-slate-500/30 text-slate-100 border-slate-400/50" :
                 "bg-orange-800/30 text-orange-300 border-orange-500/50";
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${bg}`}>{ovr}</span>
  );
};

// Pitch under each team panel was removed on user request — MiniPitch
// deleted. `FORMATIONS[DEFAULT_OPP_FORMATION]` is still used by
// `buildOpponentXi` above to slot opponents into a 4-3-3 template.



// -----------------------------------------------------------------------------
// ShotAnimation — a football glides toward the net. On GOAL, it hits the mesh
// with a golden flash; on SAVE, a red X stamps over it before it fades.
// -----------------------------------------------------------------------------
const ShotAnimation = ({ anim, userSide, homeName, awayName, duration }) => {
  const isGoal = anim.type === "GOAL";
  // Home attacks toward the right net; away attacks toward the left net.
  const shootsRight = anim.side === "home";
  const teamName = anim.side === "home" ? homeName : awayName;
  const isUserSide = userSide && userSide === anim.side;
  const accent = isGoal
    ? (isUserSide ? "#f5c542" : "#ffffff")
    : "#ef4444";

  // Fixed cinematic timeline (in seconds), independent of the sim speed.
  // 0.00–0.45  banner slide-in ("KRİTİK ATAK")
  // 0.45–1.90  ball flight (ease-out, slows dramatically near the goal)
  // 1.90–2.10  impact (goal flash / net ripple  OR  red X)
  // 2.10–2.40  hold & fade
  const total = duration / 1000; // ~2.4s
  const bannerT = 0.55;
  const flightStart = 0.55;
  const flightEnd = 1.95;
  const impactT = 1.95;
  const holdEnd = total;
  const flightDur = flightEnd - flightStart;

  // Player card copy — scorer/assist for goals, shooter for saves.
  const isKnown = !!(anim.scorer || anim.shooter);
  const headline = isGoal
    ? (isUserSide ? "MUHTEŞEM GOL!" : "GOL!")
    : "KAÇAN FIRSAT";
  const playerLine = isGoal ? (anim.scorer || null) : (anim.shooter || null);
  const assistLine = isGoal && anim.assist ? `Asist: ${anim.assist}` : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="bg-black/70 rounded-xl border border-white/10 overflow-hidden relative"
      style={{ height: 280 }}
      data-testid={`shot-anim-${anim.type.toLowerCase()}`}
    >
      {/* Stadium/pitch backdrop — glow sits on the target side. */}
      <div className="absolute inset-0"
        style={{
          background:
            shootsRight
              ? "radial-gradient(120% 80% at 100% 50%, rgba(60,140,220,0.35) 0%, rgba(15,25,40,0.9) 55%, rgba(6,10,18,1) 100%)"
              : "radial-gradient(120% 80% at 0% 50%, rgba(60,140,220,0.35) 0%, rgba(15,25,40,0.9) 55%, rgba(6,10,18,1) 100%)",
        }}
      />

      {/* Net on the target side (bright white) */}
      <NetSVG side={shootsRight ? "right" : "left"} isGoal={isGoal} impactAt={impactT} totalDur={holdEnd} />

      {/* Minute badge (top-left, always) */}
      <div className="absolute top-3 left-3 z-30 inline-flex items-center gap-2 rounded-full px-2.5 py-1 bg-black/60 border border-white/15 text-white/85 font-mono text-[11px] tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        {`${anim.minute}'`}
      </div>

      {/* KRİTİK ATAK banner — slides in from top, out after the flight starts. */}
      <motion.div
        className="absolute left-1/2 top-3 z-30 -translate-x-1/2"
        initial={{ y: -30, opacity: 0 }}
        animate={{
          y: [-30, 0, 0, -30],
          opacity: [0, 1, 1, 0],
        }}
        transition={{
          duration: bannerT + 0.35,
          times: [0, 0.25, 0.75, 1],
          ease: "easeOut",
        }}
      >
        <div
          className="px-3 py-1 rounded-full font-mono text-[11px] tracking-[0.25em] uppercase"
          style={{
            background: `linear-gradient(90deg, ${isUserSide ? "#f5c54233" : "#ffffff22"} 0%, transparent 100%)`,
            border: `1px solid ${accent}66`,
            color: accent,
            boxShadow: `0 0 16px ${accent}55`,
          }}
        >
          KRİTİK ATAK · {teamName}
        </div>
      </motion.div>

      {/* Ball — starts on attacker's side, slows near the goal, and grows. */}
      <motion.div
        className="absolute z-[8]"
        style={{ top: "50%" }}
        initial={{
          left: shootsRight ? "10%" : "82%",
          y: "-50%",
          scale: 0.55,
          rotate: 0,
          opacity: 0,
        }}
        animate={{
          left: shootsRight ? ["10%", "10%", "70%", "78%"] : ["82%", "82%", "22%", "14%"],
          y: ["-50%", "-50%", "-52%", "-52%"],
          scale: [0.55, 0.55, 1.15, 1.5],
          rotate: [0, 0, shootsRight ? 900 : -900, shootsRight ? 1080 : -1080],
          opacity: [0, 1, 1, 1],
        }}
        transition={{
          duration: impactT,
          // times chart: 0 (hidden), banner-in visible pre-flight, mid-flight,
          // arrival at net. The last leg from 0.85→1.0 is where the ball slows
          // dramatically thanks to `cubic-bezier(0.15, 0.85, 0.25, 1)`.
          times: [0, flightStart / impactT, (flightStart + flightDur * 0.7) / impactT, 1],
          ease: [0.15, 0.85, 0.25, 1],
        }}
      >
        <BallSVG size={64} />
      </motion.div>

      {/* Impact overlay — golden GOOOL burst OR big red X. Appears at 1.95s. */}
      <motion.div
        className={`absolute inset-0 flex items-center z-30 pointer-events-none ${shootsRight ? "justify-end pr-[8%]" : "justify-start pl-[8%]"}`}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{
          opacity: [0, 0, 1, 1, 1],
          scale: [0.4, 0.4, 1.15, 1.05, 1.05],
        }}
        transition={{
          duration: holdEnd,
          times: [0, impactT / holdEnd - 0.001, impactT / holdEnd, (impactT + 0.15) / holdEnd, 1],
          ease: "easeOut",
        }}
      >
        {isGoal ? (
          <div className="relative">
            <div
              className="absolute -inset-10 rounded-full blur-2xl"
              style={{ background: `radial-gradient(closest-side, ${accent}77, transparent 70%)` }}
            />
            <div
              className="font-display text-5xl md:text-6xl tracking-tight"
              style={{ color: accent, textShadow: `0 0 28px ${accent}` }}
            >
              GOOOL
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg width="140" height="140" viewBox="0 0 120 120" fill="none" style={{ filter: `drop-shadow(0 0 16px #ef4444aa)` }}>
              <path d="M20 20 L100 100 M100 20 L20 100" stroke="#ef4444" strokeWidth="16" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </motion.div>

      {/* Player info card — slides in from the attacking side during flight, holds. */}
      <motion.div
        className={`absolute bottom-3 z-30 max-w-[70%] ${shootsRight ? "left-3" : "right-3 text-right"}`}
        initial={{ opacity: 0, x: shootsRight ? -20 : 20 }}
        animate={{
          opacity: [0, 0, 1, 1],
          x: [shootsRight ? -20 : 20, shootsRight ? -20 : 20, 0, 0],
        }}
        transition={{
          duration: holdEnd,
          times: [0, (flightStart + 0.35) / holdEnd, (flightStart + 0.75) / holdEnd, 1],
          ease: "easeOut",
        }}
      >
        <div className="rounded-lg bg-black/55 border border-white/15 backdrop-blur-sm px-3 py-2 inline-block">
          <div className="font-mono text-[10px] tracking-widest" style={{ color: accent }}>
            {headline}
          </div>
          {isKnown ? (
            <>
              <div className="font-display text-xl md:text-2xl tracking-tight leading-tight">{playerLine}</div>
              {assistLine && (
                <div className="text-[11px] font-mono tracking-wider text-white/70 mt-0.5">{assistLine}</div>
              )}
              <div className="text-[10px] font-mono tracking-widest text-white/50 uppercase truncate">{teamName}</div>
            </>
          ) : (
            <div className="font-display text-xl md:text-2xl tracking-tight truncate">{teamName}</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Classic black-and-white football with proper pentagon/hexagon panels.
const BallSVG = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.6))" }}>
    {/* white ball body */}
    <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#0b0b0b" strokeWidth="2" />
    {/* central pentagon (top) */}
    <polygon points="50,20 66,32 60,52 40,52 34,32" fill="#0b0b0b" />
    {/* five surrounding pentagons/patches to hint the classic pattern */}
    <polygon points="18,42 30,32 34,44 26,58 14,54" fill="#0b0b0b" opacity="0.9" />
    <polygon points="82,42 86,54 74,58 66,44 70,32" fill="#0b0b0b" opacity="0.9" />
    <polygon points="30,74 42,66 50,74 44,86 30,84" fill="#0b0b0b" opacity="0.9" />
    <polygon points="70,74 70,84 56,86 50,74 58,66" fill="#0b0b0b" opacity="0.9" />
    {/* connecting seams */}
    <path d="M50 20 L50 8 M18 42 L4 44 M82 42 L96 44 M30 74 L18 88 M70 74 L82 88 M40 52 L30 60 M60 52 L70 60 M50 74 L50 62" stroke="#0b0b0b" strokeWidth="1.2" />
    {/* subtle highlight */}
    <ellipse cx="38" cy="30" rx="14" ry="6" fill="#ffffff" opacity="0.5" />
  </svg>
);

// White net with a light ripple animation on goals.
const NetSVG = ({ side = "right", isGoal = false, impactAt = 2, totalDur = 2.4 }) => {
  const lines = [];
  const cols = 24;
  const rows = 20;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * 100;
    lines.push(<line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.75)" strokeWidth="0.4" />);
  }
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * 100;
    lines.push(<line key={`h-${j}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.75)" strokeWidth="0.4" />);
  }
  const isRight = side === "right";
  // Ripple animation timings — goal only. Pushes the net "inward" briefly.
  const rippleTimes = [
    0,
    Math.max(0, (impactAt - 0.01) / totalDur),
    impactAt / totalDur,
    (impactAt + 0.18) / totalDur,
    (impactAt + 0.36) / totalDur,
    1,
  ];
  const rippleScaleX = isGoal ? [1, 1, isRight ? 1.10 : 1.10, 1.03, 1.005, 1.0] : [1, 1, 1, 1, 1, 1];
  const rippleScaleY = isGoal ? [1, 1, 1.08, 1.02, 1.005, 1.0] : [1, 1, 1, 1, 1, 1];
  const rippleTranslate = isGoal ? [0, 0, isRight ? 6 : -6, isRight ? 2 : -2, 0, 0] : [0, 0, 0, 0, 0, 0];

  return (
    <motion.div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        [isRight ? "right" : "left"]: 0,
        width: "58%",
        maskImage: isRight
          ? "linear-gradient(to left,  rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: isRight
          ? "linear-gradient(to left,  rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)",
        transformOrigin: isRight ? "right center" : "left center",
      }}
      initial={{ scaleX: 1, scaleY: 1, x: 0 }}
      animate={{ scaleX: rippleScaleX, scaleY: rippleScaleY, x: rippleTranslate }}
      transition={{ duration: totalDur, times: rippleTimes, ease: "easeOut" }}
    >
      {/* Goal frame (bright white posts) */}
      <div
        className="absolute inset-y-2"
        style={{
          [isRight ? "left" : "right"]: "6%",
          width: 3,
          background: "linear-gradient(180deg, #ffffff 0%, #ffffff 80%, #e5e7eb 100%)",
          boxShadow: "0 0 12px rgba(255,255,255,0.7)",
          borderRadius: 2,
        }}
      />
      <div
        className="absolute"
        style={{
          top: 8,
          [isRight ? "left" : "right"]: "6%",
          [isRight ? "right" : "left"]: "6%",
          height: 3,
          background: "linear-gradient(90deg, #ffffff 0%, #ffffff 80%, #e5e7eb 100%)",
          boxShadow: "0 0 12px rgba(255,255,255,0.7)",
          borderRadius: 2,
        }}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ transform: `perspective(400px) rotateY(${isRight ? "-18deg" : "18deg"})`, transformOrigin: isRight ? "left center" : "right center" }}
      >
        {lines}
      </svg>
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// TickerRow — home events left, away events right, keeps chronological order.
// -----------------------------------------------------------------------------
const TickerRow = ({ event, className, index }) => {
  const leftSide = event.side === "home";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 py-1"
      data-testid={`match-event-${index}`}
    >
      <span className="font-mono text-[10px] w-9 shrink-0 text-white/40 pt-0.5">{`${event.minute}'`}</span>
      <div className="flex-1 grid grid-cols-2 gap-2 items-start">
        {leftSide ? (
          <>
            <div className={`text-sm md:text-[13px] ${className}`}>{event.text}</div>
            <div />
          </>
        ) : (
          <>
            <div />
            <div className={`text-sm md:text-[13px] text-right ${className}`}>{event.text}</div>
          </>
        )}
      </div>
    </motion.div>
  );
};

const SpeedPicker = ({ speedKey, onChange }) => (
  <div className="flex items-center gap-1 glass !bg-white/5 rounded-full p-0.5" data-testid="speed-picker">
    {SPEEDS.map((s) => {
      const Icon = s.icon;
      const active = s.key === speedKey;
      return (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          data-testid={`speed-${s.key}`}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all ${
            active ? "bg-amber-300 text-black" : "text-white/60 hover:text-white"
          }`}
        >
          <Icon size={11} />
          {s.label}
        </button>
      );
    })}
  </div>
);

const PenaltyColumn = ({ name, shots, totalScored }) => (
  <div>
    <div className="font-display text-base tracking-tight truncate mb-1">{name}</div>
    <div className="font-display text-3xl text-amber-300 mb-2">{totalScored}</div>
    <div className="flex justify-center gap-1 flex-wrap">
      {shots.map((s, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
            s.scored ? "bg-emerald-400 text-black" : "bg-red-500 text-white"
          }`}
          data-testid={`pen-shot`}
        >
          {s.scored ? "●" : "✕"}
        </motion.span>
      ))}
    </div>
  </div>
);

const StatBar = ({ label, h, a }) => (
  <div className="bg-white/5 rounded px-2 py-1.5">
    <div className="text-[9px] text-white/40 tracking-widest">{label}</div>
    <div className="font-display text-base"><span className="text-amber-300">{h}</span> · <span className="text-white">{a}</span></div>
  </div>
);
