import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crest } from "../components/Crest";
import { sound } from "../engine/sounds";

export const MatchScreen = ({ match, onClose }) => {
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [phase, setPhase] = useState("kickoff"); // kickoff -> playing -> done
  const [legIdx, setLegIdx] = useState(0);

  const isKnockout = !!match.knockout;
  const legs = useMemo(() => {
    if (!isKnockout) return [match.result];
    if (match.knockout.tie.legs) return match.knockout.tie.legs.map((l) => l);
    return [match.knockout.tie.match];
  }, [match, isKnockout]);

  const homeName = isKnockout ? match.knockout.home.label : match.home.label;
  const awayName = isKnockout ? match.knockout.away.label : match.away.label;

  const currentLeg = legs[legIdx];
  const events = currentLeg?.events || [];

  useEffect(() => {
    sound.whistleStart();
    setPhase("kickoff");
    setVisibleIdx(0);
    const k = setTimeout(() => setPhase("playing"), 1200);
    return () => clearTimeout(k);
  }, [legIdx]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (visibleIdx >= events.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        setPhase("done");
      }, 600);
      return () => clearTimeout(t);
    }
    const e = events[visibleIdx];
    const delay = 400;
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setVisibleIdx(visibleIdx + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [phase, visibleIdx, events]);

  const nextLeg = () => {
    if (legIdx + 1 < legs.length) {
      setLegIdx(legIdx + 1);
    } else {
      onClose();
    }
  };

  const goalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    events.slice(0, visibleIdx).forEach((e) => {
      if (e.type === "GOAL") {
        if (e.side === "home") h++; else a++;
      }
    });
    return { h, a };
  }, [events, visibleIdx]);

  const finalHomeScore = phase === "done" ? currentLeg.home.score : goalsSoFar.h;
  const finalAwayScore = phase === "done" ? currentLeg.away.score : goalsSoFar.a;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-black/85 backdrop-blur-md" data-testid="match-modal">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass rounded-2xl max-w-3xl w-full p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-xs tracking-widest text-amber-300">
            {match.stage ? match.stage : "GRUP AŞAMASI"} {legs.length > 1 && ` · LEG ${legIdx + 1}/${legs.length}`}
          </div>
          <div className="font-mono text-xs tracking-widest text-white/50">{phase === "kickoff" ? "KICK-OFF" : phase === "done" ? "FULL-TIME" : "PLAYING"}</div>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 items-center gap-4 mb-4">
          <div className="text-right">
            <div className="font-display text-xl md:text-2xl tracking-tight truncate" data-testid="home-name">{homeName}</div>
          </div>
          <div className="text-center">
            <motion.div
              key={`${finalHomeScore}-${finalAwayScore}-${legIdx}`}
              initial={{ scale: 1 }}
              animate={{ scale: [1.0, 1.18, 1.0] }}
              transition={{ duration: 0.6 }}
              className="font-display text-5xl md:text-6xl text-amber-300"
              data-testid="scoreboard"
            >
              {finalHomeScore} <span className="text-white/30">·</span> {finalAwayScore}
            </motion.div>
          </div>
          <div>
            <div className="font-display text-xl md:text-2xl tracking-tight truncate" data-testid="away-name">{awayName}</div>
          </div>
        </div>

        {/* Ticker */}
        <div className="bg-black/40 rounded-xl p-4 max-h-64 overflow-y-auto border border-white/5">
          <AnimatePresence>
            {events.slice(0, visibleIdx).map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-3 py-1 text-sm ${e.type === "GOAL" ? "text-amber-300 goal-pulse rounded" : e.type === "SAVE" ? "text-emerald-300" : "text-white/60"}`}
                data-testid={`match-event-${i}`}
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
          </AnimatePresence>
        </div>

        {/* Stats */}
        {phase === "done" && (
          <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs text-white/70">
            <StatBar label="ŞUT" h={currentLeg.home.shots} a={currentLeg.away.shots} />
            <StatBar label="İSABETLİ" h={currentLeg.home.onTarget} a={currentLeg.away.onTarget} />
            <StatBar label="XG" h={currentLeg.home.xg?.toFixed(2)} a={currentLeg.away.xg?.toFixed(2)} />
          </div>
        )}

        {/* Knockout aggregate */}
        {phase === "done" && isKnockout && legIdx === legs.length - 1 && (
          <div className="mt-4 text-center">
            {match.knockout.tie.aggregate && (
              <div className="font-display text-lg tracking-widest text-amber-300">
                TOPLAM: {match.knockout.tie.aggregate.a} - {match.knockout.tie.aggregate.b}
              </div>
            )}
            {match.knockout.tie.decidedBy === "penalties" && (
              <div className="font-mono text-xs tracking-widest text-amber-300 mt-1">
                PENALTILAR: {match.knockout.tie.penalties.a} - {match.knockout.tie.penalties.b}
              </div>
            )}
            <div className="font-display text-3xl mt-2 text-white">
              {match.userWon ? "TUR ATLADIN" : "ELENDİN"}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {phase === "done" && legIdx + 1 < legs.length && (
            <button type="button" className="btn-ghost" onClick={nextLeg} data-testid="next-leg-button">2. MAÇ OYNA →</button>
          )}
          {phase === "done" && (
            <button type="button" className="btn-primary" onClick={onClose} data-testid="close-match-button">DEVAM ET</button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const StatBar = ({ label, h, a }) => (
  <div className="bg-white/5 rounded px-2 py-1.5">
    <div className="text-[9px] text-white/40 tracking-widest">{label}</div>
    <div className="font-display text-base"><span className="text-amber-300">{h}</span> · <span className="text-white">{a}</span></div>
  </div>
);
