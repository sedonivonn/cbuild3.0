import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DiceButton } from "../components/DiceButton";
import { PlayerCard } from "../components/PlayerCard";
import { Pitch } from "../components/Pitch";
import { Crest } from "../components/Crest";
import { FORMATIONS, positionPenalty } from "../data/formations";
import { rollRandom, rollLucky } from "../engine/draftEngine";
import { sound } from "../engine/sounds";
import { RefreshCw, ChevronRight } from "lucide-react";

export const DraftScreen = ({ formationId, xi, setXi, slotIndex, setSlotIndex, changes, onUseChange, onComplete }) => {
  const formation = FORMATIONS[formationId];
  const [pool, setPool] = useState(null); // { season, team }
  const [rolling, setRolling] = useState(false);

  const currentSlot = formation.slots[slotIndex];
  const totalSlots = formation.slots.length;

  const handleRoll = () => {
    setRolling(true);
    sound.dice();
    setTimeout(() => {
      setPool(rollRandom());
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const handleChange = () => {
    if (changes.remaining <= 0) { sound.error(); return; }
    setRolling(true);
    sound.dice();
    // If this is the "lucky" change, boost odds
    const lucky = changes.luckyRemaining > 0;
    setTimeout(() => {
      const newRoll = lucky ? rollLucky() : rollRandom();
      setPool(newRoll);
      onUseChange(lucky);
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const handlePick = (player) => {
    sound.click();
    const newXi = [...xi];
    newXi[slotIndex] = { ...player, _season: pool.season, _club: pool.team.club, _crest: pool.team.crest, _country: pool.team.country };
    setXi(newXi);
    setPool(null);
    if (slotIndex + 1 >= totalSlots) {
      onComplete(newXi);
    } else {
      setSlotIndex(slotIndex + 1);
    }
  };

  // Sort team's players by compatibility w/ current slot
  const sortedPool = useMemo(() => {
    if (!pool) return [];
    const ranked = pool.team.players.map((p) => ({
      ...p,
      _penalty: positionPenalty(currentSlot.pos, p.primary, p.secondary),
    }));
    ranked.sort((a, b) => a._penalty - b._penalty || b.overall - a.overall);
    return ranked;
  }, [pool, currentSlot]);

  const progress = ((slotIndex) / totalSlots) * 100;

  return (
    <div className="px-5 md:px-10 py-6 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest">ADIM 2 / 4 · DRAFT</div>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">{slotIndex + 1}/{totalSlots} — {currentSlot.pos} POZİSYONU</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/60">CHANGE HAKKI</div>
            <div className="font-display text-2xl text-amber-300" data-testid="changes-remaining">{changes.remaining} / 3</div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-amber-300 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Pitch */}
        <div className="lg:col-span-4 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest">KADRO {formation.label}</div>
          <Pitch formationId={formationId} xi={xi} activeSlotIndex={slotIndex} compact />
          <div className="mt-4 text-center">
            <div className="text-[10px] text-white/50 tracking-widest">ŞU AN SEÇİYORSUN</div>
            <div className="font-display text-2xl text-amber-300">{currentSlot.pos}</div>
          </div>
        </div>

        {/* Right: dice + selection */}
        <div className="lg:col-span-8 glass rounded-2xl p-5 min-h-[420px]">
          <AnimatePresence mode="wait">
            {!pool && !rolling && (
              <motion.div
                key="roll"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center min-h-[420px]"
              >
                <p className="text-white/60 max-w-md text-sm mb-6">
                  Zarı çevir — rastgele bir sezon ve takım kadrosu açılsın. Beğenmezsen kalan {changes.remaining} change hakkını kullanabilirsin.
                </p>
                <DiceButton onRoll={handleRoll} testId="roll-dice-button" />
              </motion.div>
            )}

            {rolling && (
              <motion.div
                key="rolling"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center min-h-[420px]"
              >
                <div className="font-display text-4xl tracking-widest text-amber-300 animate-pulse">ZAR DÖNÜYOR…</div>
              </motion.div>
            )}

            {pool && !rolling && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-5 gap-4">
                  <div className="flex items-center gap-3">
                    <Crest code={pool.team.crest} size="lg" />
                    <div>
                      <div className="font-display text-2xl md:text-3xl tracking-tight" data-testid="rolled-team-name">{pool.team.club}</div>
                      <div className="text-xs text-white/60 font-mono tracking-widest">SEZON · {pool.season} {pool.team.country}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleChange}
                    disabled={changes.remaining <= 0}
                    data-testid="change-button"
                    className="btn-ghost flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={14} /> CHANGE ({changes.remaining})
                  </button>
                </div>

                <div className="text-[11px] text-white/50 mb-3 font-mono tracking-widest">
                  {currentSlot.pos} POZİSYONUNA EN UYGUN OYUNCULAR ÖNDE — TIKLAYARAK SEÇ
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sortedPool.map((p, idx) => (
                    <div key={idx} className="relative">
                      <PlayerCard
                        player={p}
                        season={pool.season}
                        club={pool.team.club}
                        crest={pool.team.crest}
                        country={pool.team.country}
                        size="sm"
                        testId={`pool-player-${idx}`}
                        onClick={() => handlePick(p)}
                      />
                      {p._penalty <= 1 ? (
                        <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-400 text-black px-1.5 py-0.5 rounded">FIT</span>
                      ) : p._penalty >= 6 ? (
                        <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">OUT</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-right text-[10px] text-white/40 font-mono">
                  TIP: <span className="text-emerald-400">FIT</span> = doğru pozisyon, <span className="text-red-500">OUT</span> = ciddi uyum kaybı
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
