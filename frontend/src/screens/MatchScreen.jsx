import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sound } from "../engine/sounds";
import { Gauge, FastForward, Zap, Pause } from "lucide-react";

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
  try { localStorage.setItem(SPEED_KEY, k); } catch (_) {}
}

export const MatchScreen = ({ match, onClose }) => {
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [phase, setPhase] = useState("kickoff"); // kickoff -> playing -> et_confirm -> playing_et -> penalties -> done -> finished
  const [legIdx, setLegIdx] = useState(0);
  const [speedKey, setSpeedKey] = useState(loadSpeed());
  const [penShotIdx, setPenShotIdx] = useState(0);
  const [etVisibleIdx, setEtVisibleIdx] = useState(0);
  const finishedRef = useRef(false);

  const speed = SPEEDS.find((s) => s.key === speedKey) || SPEEDS[1];

  const isKnockout = !!match.knockout;
  const legs = useMemo(() => {
    if (!isKnockout) return [match.result];
    if (match.knockout.tie.legs) return match.knockout.tie.legs;
    return [match.knockout.tie.match];
  }, [match, isKnockout]);

  // True per-leg home/away: in leg 2 of a 2-leg tie, pair.away hosts.
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
  // Has ET on THIS specific leg. We gate on tie.et presence (and decidedBy)
  // rather than event count, because ET may legitimately produce 0 events
  // (e.g., scoreless extra time that goes to penalties).
  const hasExtraTime = isKnockout && isLastLeg && (!!tie?.et || tie?.decidedBy === "extra_time" || tie?.decidedBy === "penalties");

  useEffect(() => {
    sound.whistleStart();
    setPhase("kickoff");
    setVisibleIdx(0);
    setEtVisibleIdx(0);
    setPenShotIdx(0);
    finishedRef.current = false;
    const k = setTimeout(() => setPhase("playing"), 800);
    return () => clearTimeout(k);
  }, [legIdx]);

  // Regulation event ticker (minutes 1-90)
  useEffect(() => {
    if (phase !== "playing") return;
    if (visibleIdx >= regulationEvents.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        if (isLastLeg && hasExtraTime) {
          // Pause and ask user whether to play extra time
          setPhase("et_confirm");
        } else if (isLastLeg && hasPenalties && !hasExtraTime) {
          setPhase("penalties");
        } else {
          setPhase("done");
        }
      }, 400);
      return () => clearTimeout(t);
    }
    const e = regulationEvents[visibleIdx];
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setVisibleIdx(visibleIdx + 1);
    }, speed.delay);
    return () => clearTimeout(t);
  }, [phase, visibleIdx, regulationEvents, speed.delay, isLastLeg, hasExtraTime, hasPenalties]);

  // Extra-time event ticker (minutes 91-120)
  useEffect(() => {
    if (phase !== "playing_et") return;
    if (etVisibleIdx >= extraTimeEvents.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        if (hasPenalties) {
          setPhase("penalties");
        } else {
          setPhase("done");
        }
      }, 400);
      return () => clearTimeout(t);
    }
    const e = extraTimeEvents[etVisibleIdx];
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setEtVisibleIdx(etVisibleIdx + 1);
    }, speed.delay);
    return () => clearTimeout(t);
  }, [phase, etVisibleIdx, extraTimeEvents, speed.delay, hasPenalties]);

  // Penalty reveal (slow, suspense)
  useEffect(() => {
    if (phase !== "penalties") return;
    const shots = tie?.penalties?.shots || [];
    if (penShotIdx >= shots.length) {
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
    // Each penalty shot reveals with slower delay (suspense). Speed scales but capped slow.
    const baseDelay = Math.max(550, speed.delay * 2);
    const t = setTimeout(() => {
      const s = shots[penShotIdx];
      if (s.scored) sound.goal();
      else sound.error();
      setPenShotIdx(penShotIdx + 1);
    }, baseDelay);
    return () => clearTimeout(t);
  }, [phase, penShotIdx, tie, speed.delay]);

  // Trigger trophy on close handled by parent via match.userWon + match.stage === "Final"
  const handleClose = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onClose();
  };

  const nextLeg = () => {
    if (legIdx + 1 < legs.length) {
      setLegIdx(legIdx + 1);
    } else {
      handleClose();
    }
  };

  // Confirm to continue into extra time
  const startExtraTime = () => {
    sound.whistleStart();
    setPhase("playing_et");
  };

  // Score accumulation (regulation only while playing; full once ET starts/finishes)
  const goalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    regulationEvents.slice(0, visibleIdx).forEach((e) => {
      if (e.type === "GOAL") {
        if (e.side === "home") h++; else a++;
      }
    });
    return { h, a };
  }, [regulationEvents, visibleIdx]);

  const etGoalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    extraTimeEvents.slice(0, etVisibleIdx).forEach((e) => {
      if (e.type === "GOAL") {
        if (e.side === "home") h++; else a++;
      }
    });
    return { h, a };
  }, [extraTimeEvents, etVisibleIdx]);

  // Display score logic:
  //  - playing (regulation): live count of regulation goals only
  //  - et_confirm: regulation-only goals (held)
  //  - playing_et: regulation + live ET goals
  //  - penalties / done / finished: full leg score
  let displayedHomeScore;
  let displayedAwayScore;
  if (phase === "playing" || phase === "kickoff") {
    displayedHomeScore = goalsSoFar.h;
    displayedAwayScore = goalsSoFar.a;
  } else if (phase === "et_confirm") {
    // Final regulation goals (ignore ET)
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

  // Penalty progress display
  const penShots = tie?.penalties?.shots || [];
  const penShown = penShots.slice(0, penShotIdx);
  // For penalties we always present pair.home left, pair.away right (consistent)
  const penPairHomeName = (match.knockout?.home?.label) || homeName;
  const penPairAwayName = (match.knockout?.away?.label) || awayName;
  const penHomeScored = penShown.filter((s) => s.side === "home" && s.scored).length;
  const penAwayScored = penShown.filter((s) => s.side === "away" && s.scored).length;

  const showAggregateBlock = phase === "done" && isKnockout && isLastLeg;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-black/85 backdrop-blur-md" data-testid="match-modal">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass rounded-2xl max-w-3xl w-full p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="font-mono text-xs tracking-widest text-amber-300">
            {match.stage ? match.stage : "GRUP AŞAMASI"}{legs.length > 1 && ` · LEG ${legIdx + 1}/${legs.length} · ${isSecondLeg ? "RÖVANŞ" : "İLK MAÇ"}`}
          </div>
          <SpeedPicker speedKey={speedKey} onChange={(k) => { setSpeedKey(k); saveSpeed(k); }} />
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 items-center gap-4 mb-3">
          <div className="text-right">
            <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="home-name">{homeName}</div>
            <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "EV SAHİBİ" : ""}</div>
          </div>
          <div className="text-center">
            <motion.div
              key={`${displayedHomeScore}-${displayedAwayScore}-${legIdx}`}
              initial={{ scale: 1 }}
              animate={{ scale: [1.0, 1.18, 1.0] }}
              transition={{ duration: 0.5 }}
              className="font-display text-5xl md:text-6xl text-amber-300"
              data-testid="scoreboard"
            >
              {displayedHomeScore} <span className="text-white/30">·</span> {displayedAwayScore}
            </motion.div>
          </div>
          <div>
            <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="away-name">{awayName}</div>
            <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "DEPLASMAN" : ""}</div>
          </div>
        </div>

        {/* Ticker */}
        {phase !== "penalties" && (
          <div className="bg-black/40 rounded-xl p-4 max-h-56 overflow-y-auto border border-white/5">
            <AnimatePresence>
              {regulationEvents.slice(0, visibleIdx).map((e, i) => (
                <motion.div
                  key={`reg-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 py-1 text-sm ${e.type === "GOAL" ? "text-amber-300 goal-pulse rounded" : e.type === "SAVE" ? "text-emerald-300" : "text-white/60"}`}
                  data-testid={`match-event-${i}`}
                >
                  <span className="font-mono text-xs w-10">{e.minute}'</span>
                  <span className="flex-1">{e.text}</span>
                </motion.div>
              ))}
              {(phase === "playing_et" || phase === "done" || phase === "finished") && extraTimeEvents.slice(0, phase === "playing_et" ? etVisibleIdx : extraTimeEvents.length).map((e, i) => (
                <motion.div
                  key={`et-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 py-1 text-sm ${e.type === "GOAL" ? "text-amber-300 goal-pulse rounded" : e.type === "SAVE" ? "text-emerald-300" : "text-white/60"}`}
                  data-testid={`match-event-et-${i}`}
                >
                  <span className="font-mono text-xs w-10">{e.minute}'</span>
                  <span className="flex-1">{e.text}</span>
                </motion.div>
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
            <button
              type="button"
              className="btn-primary"
              onClick={startExtraTime}
              data-testid="et-continue-button"
            >
              DEVAM ET →
            </button>
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

        {/* Player of the Match — for the user side, computed from THIS leg only.
            Goalkeeper POTM shows save count instead of goals/assists.
            BUG FIX: previously this merged stats across legs which caused inflated
            numbers (5 goals when only 3 happened in the visible leg). */}
        {phase === "done" && currentLeg?.userPlayerStats && currentLeg.userPlayerStats.length > 0 && (() => {
          const players = currentLeg.userPlayerStats;
          const potm = [...players].sort((a, b) => b.rating - a.rating)[0];
          if (!potm) return null;
          const userSideKey = currentLeg.home?.name === potm.teamName ? "home" : "away";
          const saves = (currentLeg.events || []).filter(
            (e) => e.type === "SAVE" && e.side === userSideKey
          ).length;
          const isGK = potm.slot === "GK";
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 p-4 rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-amber-300/0"
              data-testid="potm-card"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <div className="font-mono text-[10px] tracking-widest text-amber-300">PLAYER OF THE MATCH</div>
                  <div className="font-display text-2xl tracking-tight mt-0.5 truncate">{potm.name}</div>
                  {potm.teamName && (
                    <div className="text-[10px] font-mono text-amber-300/70 tracking-wider truncate uppercase">
                      {potm.teamName}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-white/50 tracking-wider mt-0.5">
                    {potm.slot} · {potm.season} · {isGK
                      ? `${saves} KURTARIŞ`
                      : `${potm.goals} GOL · ${potm.assists} ASİST`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-4xl text-amber-300">{potm.rating.toFixed(1)}</div>
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
