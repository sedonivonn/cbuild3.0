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
  const isShotEvent = (e) => e && (e.type === "GOAL" || e.type === "SAVE");
  const shouldAnimateShot = (e) => isShotEvent(e) && speedKey !== "ultra";
  const shotAnimDuration = () => {
    // Slow=1200ms, normal=700ms, fast=380ms. Scales with delay but capped.
    if (speedKey === "slow") return 1200;
    if (speedKey === "fast") return 380;
    return 700;
  };

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
      setShotAnim({ type: e.type, side: e.side, minute: e.minute });
      const dur = shotAnimDuration();
      const t = setTimeout(() => {
        if (e.type === "GOAL") sound.goal();
        setShotAnim(null);
        setVisibleIdx((i) => i + 1);
      }, dur);
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
      setShotAnim({ type: e.type, side: e.side, minute: e.minute });
      const dur = shotAnimDuration();
      const t = setTimeout(() => {
        if (e.type === "GOAL") sound.goal();
        setShotAnim(null);
        setEtVisibleIdx((i) => i + 1);
      }, dur);
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-black/85 backdrop-blur-md overflow-y-auto" data-testid="match-modal">
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
                  duration={shotAnimDuration()}
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
const PreMatchLineups = ({ homeName, awayName, homeRef, awayRef, homeLineup, awayLineup, onStart }) => (
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
    <div className="mt-5 flex justify-center">
      <button type="button" className="btn-primary" onClick={onStart} data-testid="start-match-button">
        MAÇI BAŞLAT →
      </button>
    </div>
  </div>
);

const TeamLineupPanel = ({ name, subtitle, accent, lineup }) => {
  const players = lineup?.xi || [];
  const formation = FORMATIONS[lineup?.formationId] || FORMATIONS[DEFAULT_OPP_FORMATION];
  const barClass = accent === "left"
    ? "bg-gradient-to-r from-amber-300/25 to-transparent border-l-4 border-amber-300"
    : "bg-gradient-to-l from-red-400/25 to-transparent border-r-4 border-red-400";
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
      <div className={`px-3 py-2 ${barClass}`}>
        <div className="font-display text-lg md:text-xl tracking-tight truncate">{name}</div>
        {subtitle && <div className="text-[10px] font-mono tracking-widest text-white/60 truncate">{subtitle}</div>}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        {/* Player list */}
        <ul className="p-2 space-y-1 min-w-0" data-testid={`lineup-list-${accent}`}>
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
        {/* Mini pitch */}
        <div className="p-2 pl-0 flex items-center justify-center">
          <MiniPitch formation={formation} />
        </div>
      </div>
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

// Compact pitch showing 11 position dots — mirrors formation coordinates.
const MiniPitch = ({ formation }) => {
  const slots = formation?.slots || [];
  return (
    <div
      className="relative rounded-md shrink-0"
      style={{
        width: 110,
        height: 150,
        background:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 12px, rgba(255,255,255,0) 12px 24px), radial-gradient(120% 100% at 50% 0%, #145a2c 0%, #0d3f1f 60%, #0a2f18 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {/* halfway line */}
      <div className="absolute left-2 right-2 top-1/2 h-px bg-white/25" />
      {/* center circle */}
      <div
        className="absolute rounded-full border border-white/25"
        style={{ width: 34, height: 34, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      />
      {slots.map((slot) => (
        <div
          key={slot.id}
          className="absolute flex items-center justify-center rounded-full bg-white/15 border border-white/40 text-white text-[8px] font-mono tracking-tight"
          style={{
            width: 18,
            height: 18,
            top: `calc(${slot.top}% - 9px)`,
            left: `calc(${slot.left}% - 9px)`,
          }}
        >
          {slot.pos}
        </div>
      ))}
    </div>
  );
};

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

  // Duration split: 65% flight, 35% impact.
  const flight = Math.round(duration * 0.65) / 1000;
  const impact = Math.round(duration * 0.35) / 1000;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-black/70 rounded-xl border border-white/10 overflow-hidden relative"
      style={{ height: 240 }}
      data-testid={`shot-anim-${anim.type.toLowerCase()}`}
    >
      {/* Stadium/net backdrop — glow sits on the target side. */}
      <div className="absolute inset-0"
        style={{
          background:
            shootsRight
              ? "radial-gradient(120% 80% at 100% 50%, rgba(220,50,50,0.35) 0%, rgba(20,20,30,0.85) 55%, rgba(0,0,0,1) 100%)"
              : "radial-gradient(120% 80% at 0% 50%, rgba(220,50,50,0.35) 0%, rgba(20,20,30,0.85) 55%, rgba(0,0,0,1) 100%)",
        }}
      />
      {/* Net on the target side */}
      <NetSVG side={shootsRight ? "right" : "left"} />

      {/* Minute badge */}
      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full px-2.5 py-1 bg-black/60 border border-white/15 text-white/85 font-mono text-[11px] tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        {`${anim.minute}'`}
      </div>

      {/* Team + shot label — sits on the attacking side */}
      <div className={`absolute bottom-3 z-10 flex items-end gap-3 ${shootsRight ? "left-3" : "right-3 text-right"}`}>
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-widest" style={{ color: accent }}>
            {isGoal ? (isUserSide ? "MUHTEŞEM GOL!" : "GOL!") : "KAÇAN FIRSAT"}
          </div>
          <div className="font-display text-lg md:text-xl truncate">{teamName}</div>
        </div>
      </div>

      {/* Ball — starts on the attacker's side, glides toward the target net. */}
      <motion.div
        className="absolute z-[5]"
        style={{ top: "50%", marginTop: -22 }}
        initial={{ left: shootsRight ? "8%" : "84%", scale: 0.55, rotate: 0 }}
        animate={{
          left: shootsRight ? ["8%", "72%"] : ["84%", "20%"],
          scale: [0.55, 1.15],
          rotate: [0, shootsRight ? 720 : -720],
        }}
        transition={{ duration: flight, ease: "easeOut" }}
      >
        <BallSVG size={44} />
      </motion.div>

      {/* Impact overlay: goal flash (gold) or red X for miss — appears on target side */}
      <motion.div
        className={`absolute inset-0 flex items-center z-20 pointer-events-none ${shootsRight ? "justify-end pr-[10%]" : "justify-start pl-[10%]"}`}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1], scale: [0.4, 0.4, 1.15] }}
        transition={{ duration: flight + impact, times: [0, flight / (flight + impact) - 0.01, 1], ease: "easeOut" }}
      >
        {isGoal ? (
          <div className="relative">
            <div
              className="absolute -inset-8 rounded-full blur-2xl"
              style={{ background: `radial-gradient(closest-side, ${accent}55, transparent 70%)` }}
            />
            <div
              className="font-display text-4xl md:text-5xl tracking-tight"
              style={{ color: accent, textShadow: `0 0 24px ${accent}` }}
            >
              GOOOL
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <path d="M20 20 L100 100 M100 20 L20 100" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const BallSVG = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))" }}>
    <circle cx="32" cy="32" r="30" fill="#ffffff" stroke="#0b0b0b" strokeWidth="1.5" />
    {/* classic pentagon pattern hint */}
    <polygon points="32,14 40,20 37,30 27,30 24,20" fill="#0b0b0b" />
    <polygon points="16,28 22,32 20,40 12,38 12,32" fill="#0b0b0b" opacity="0.85" />
    <polygon points="48,28 52,32 52,38 44,40 42,32" fill="#0b0b0b" opacity="0.85" />
    <polygon points="24,42 32,38 40,42 36,50 28,50" fill="#0b0b0b" opacity="0.85" />
  </svg>
);

// A subtle mesh drawn as diagonal cross-hatch on the goal-side of the frame.
const NetSVG = ({ side = "right" }) => {
  const lines = [];
  const cols = 22;
  const rows = 18;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * 100;
    lines.push(<line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.28)" strokeWidth="0.25" />);
  }
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * 100;
    lines.push(<line key={`h-${j}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth="0.25" />);
  }
  const isRight = side === "right";
  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        [isRight ? "right" : "left"]: 0,
        width: "58%",
        maskImage: isRight
          ? "linear-gradient(to left,  rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: isRight
          ? "linear-gradient(to left,  rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ transform: `perspective(400px) rotateY(${isRight ? "-18deg" : "18deg"})`, transformOrigin: isRight ? "left center" : "right center" }}
      >
        {lines}
      </svg>
    </div>
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
