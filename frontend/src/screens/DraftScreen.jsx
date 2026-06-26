import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DiceButton } from "../components/DiceButton";
import { PlayerCard } from "../components/PlayerCard";
import { Pitch } from "../components/Pitch";
import { Crest } from "../components/Crest";
import { FORMATIONS, positionPenalty } from "../data/formations";
import { rollRandom, rollLucky } from "../engine/draftEngine";
import { sound } from "../engine/sounds";
import { RefreshCw } from "lucide-react";

// New flow: roll dice → pool shown alongside pitch → user picks ANY player from pool, then places on ANY empty slot.
// After placement, dice resets (must roll again). Pool can be re-rolled with CHANGE.
export const DraftScreen = ({ formationId, xi, setXi, changes, onUseChange, onComplete }) => {
  const formation = FORMATIONS[formationId];
  const [pool, setPool] = useState(null); // { season, team }
  const [rolling, setRolling] = useState(false);
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(-1);

  const filledCount = xi.filter(Boolean).length;
  const totalSlots = formation.slots.length;
  const isComplete = filledCount >= totalSlots;

  const handleRoll = () => {
    if (isComplete) return;
    setRolling(true);
    sound.dice();
    setTimeout(() => {
      setPool(rollRandom());
      setSelectedPlayerIdx(-1);
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const handleChange = () => {
    if (changes.remaining <= 0) { sound.error(); return; }
    setRolling(true);
    sound.dice();
    const lucky = changes.luckyRemaining > 0;
    setTimeout(() => {
      const newRoll = lucky ? rollLucky() : rollRandom();
      setPool(newRoll);
      setSelectedPlayerIdx(-1);
      onUseChange(lucky);
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const sortedPool = useMemo(() => {
    if (!pool) return [];
    // Sort by overall desc - user picks freely
    return pool.team.players.slice().sort((a, b) => b.overall - a.overall);
  }, [pool]);

  const selectedPlayer = selectedPlayerIdx >= 0 ? sortedPool[selectedPlayerIdx] : null;

  const handleSelectPlayer = (idx) => {
    sound.click();
    setSelectedPlayerIdx(idx);
  };

  const handlePlaceOnSlot = (slotIdx, slot) => {
    if (!selectedPlayer) {
      // No player selected — small nudge
      if (pool) sound.error();
      return;
    }
    if (xi[slotIdx]) {
      // slot already filled - replace? for simplicity, do nothing
      sound.error();
      return;
    }
    sound.click();
    const newXi = [...xi];
    newXi[slotIdx] = {
      ...selectedPlayer,
      _season: pool.season,
      _club: pool.team.club,
      _crest: pool.team.crest,
      _country: pool.team.country,
    };
    setXi(newXi);
    // After placement, clear pool; must roll again
    setPool(null);
    setSelectedPlayerIdx(-1);
    if (newXi.filter(Boolean).length >= totalSlots) {
      setTimeout(() => onComplete(newXi), 400);
    }
  };

  // For pitch: when player is selected, mark slots as "fit" or "out" so user knows compat
  const slotHints = useMemo(() => {
    if (!selectedPlayer) return null;
    return formation.slots.map((slot, idx) => {
      if (xi[idx]) return "filled";
      const p = positionPenalty(slot.pos, selectedPlayer.primary, selectedPlayer.secondary);
      if (p <= 1) return "fit";
      if (p >= 6) return "out";
      return "ok";
    });
  }, [selectedPlayer, formation, xi]);

  const progress = (filledCount / totalSlots) * 100;

  return (
    <div className="px-5 md:px-10 py-6 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest">ADIM 2 / 4 · DRAFT</div>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">{filledCount} / {totalSlots} OYUNCU YERLEŞTİ</h2>
          <div className="text-xs text-white/55 mt-1">Zar at, beğendiğin oyuncuyu seç, sahada istediğin boş slota koy.</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-white/60">CHANGE HAKKI</div>
          <div className="font-display text-2xl text-amber-300" data-testid="changes-remaining">{changes.remaining} / 3</div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-amber-300 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Pitch */}
        <div className="lg:col-span-5 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest flex items-center justify-between">
            <span>KADRO · {formation.label}</span>
            {selectedPlayer && <span className="text-amber-300">Bir boş slota tıkla</span>}
          </div>
          <Pitch
            formationId={formationId}
            xi={xi}
            onSlotClick={handlePlaceOnSlot}
            slotHints={slotHints}
            interactive={!!selectedPlayer}
            compact
          />
        </div>

        {/* Right: dice + selection */}
        <div className="lg:col-span-7 glass rounded-2xl p-5 min-h-[420px]">
          <AnimatePresence mode="wait">
            {!pool && !rolling && (
              <motion.div
                key="roll"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center min-h-[420px]"
              >
                {isComplete ? (
                  <>
                    <div className="font-display text-3xl text-amber-300 tracking-tight mb-3">KADRO TAMAM!</div>
                    <p className="text-white/60">Devam etmek için sayfa yönlendirecek...</p>
                  </>
                ) : (
                  <>
                    <p className="text-white/60 max-w-md text-sm mb-6">
                      Zarı çevir — rastgele bir sezon ve takım kadrosu açılsın. Oyuncuyu sahada istediğin pozisyona yerleştir.
                    </p>
                    <DiceButton onRoll={handleRoll} testId="roll-dice-button" />
                  </>
                )}
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
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Crest code={pool.team.crest} size="lg" />
                    <div>
                      <div className="font-display text-2xl md:text-3xl tracking-tight" data-testid="rolled-team-name">{pool.team.club}</div>
                      <div className="text-xs text-white/60 font-mono tracking-widest" data-testid="rolled-season">SEZON · {pool.season} {pool.team.country}</div>
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

                <div className="text-[11px] text-white/55 mb-3 font-mono tracking-widest">
                  {selectedPlayer ? (
                    <span className="text-amber-300">SAHADA BOŞ BİR SLOTA TIKLAYARAK YERLEŞTİR</span>
                  ) : (
                    "BİR OYUNCUYA TIKLAYARAK SEÇ"
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {sortedPool.map((p, idx) => (
                    <PlayerCard
                      key={idx}
                      player={p}
                      season={pool.season}
                      club={pool.team.club}
                      crest={pool.team.crest}
                      country={pool.team.country}
                      size="sm"
                      selected={selectedPlayerIdx === idx}
                      testId={`pool-player-${idx}`}
                      onClick={() => handleSelectPlayer(idx)}
                    />
                  ))}
                </div>

                <div className="mt-3 text-[10px] text-white/40 font-mono">
                  TIP: <span className="text-emerald-400">YEŞİL</span> slot = pozisyona uyumlu · <span className="text-red-400">KIRMIZI</span> = ciddi uyumsuzluk (overall cezası)
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
