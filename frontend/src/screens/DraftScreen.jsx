import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DiceButton } from "../components/DiceButton";
import { PlayerCard } from "../components/PlayerCard";
import { Pitch } from "../components/Pitch";
import { Crest } from "../components/Crest";
import { FORMATIONS, canPlace, hasAvailableSlot } from "../data/formations";
import { effOverall } from "../data/ballonDor";
import { rollRandom, rollLucky } from "../engine/draftEngine";
import { sound } from "../engine/sounds";
import { SEASONS } from "../data/seasons";
import { RefreshCw } from "lucide-react";

// All "season club" labels used by the slot machine spinner
const ALL_TEAM_LABELS = Object.entries(SEASONS).flatMap(([season, teams]) =>
  teams.map((t) => ({ label: `${season} ${t.club}`, crest: t.crest }))
);

// Free placement draft with strict primary/secondary (wing-mirror flex) rules,
// duplicate-name lockout across all teams, click-filled-slot-to-remove, and pool
// player lockout when no compatible empty slot exists for them.
export const DraftScreen = ({ formationId, xi, setXi, changes, onUseChange, onComplete }) => {
  const formation = FORMATIONS[formationId];
  const [pool, setPool] = useState(null); // { season, team }
  const [rolling, setRolling] = useState(false);
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(-1);

  const filledCount = xi.filter(Boolean).length;
  const totalSlots = formation.slots.length;
  const isComplete = filledCount >= totalSlots;

  // Names already in the XI (so the same player in different seasons can't be added twice)
  const pickedNames = useMemo(
    () => new Set(xi.filter(Boolean).map((p) => p.name)),
    [xi]
  );

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

  // Sort by overall desc; mark _placeable (compatible slot exists AND name not picked)
  const sortedPool = useMemo(() => {
    if (!pool) return [];
    const arr = pool.team.players.slice().sort((a, b) => b.overall - a.overall);
    return arr.map((p) => {
      const alreadyPicked = pickedNames.has(p.name);
      const placeable = !alreadyPicked && hasAvailableSlot(formation, xi, p);
      return { ...p, _placeable: placeable, _alreadyPicked: alreadyPicked };
    });
  }, [pool, formation, xi, pickedNames]);

  const selectedPlayer = selectedPlayerIdx >= 0 ? sortedPool[selectedPlayerIdx] : null;

  const handleSelectPlayer = (idx) => {
    const p = sortedPool[idx];
    if (!p || !p._placeable) {
      sound.error();
      return;
    }
    sound.click();
    setSelectedPlayerIdx(idx);
  };

  const handlePlaceOnSlot = (slotIdx, slot) => {
    // Slot already filled? When no player is selected, REMOVE the placed player.
    if (xi[slotIdx]) {
      if (!selectedPlayer) {
        sound.click();
        const newXi = [...xi];
        newXi[slotIdx] = null;
        setXi(newXi);
        return;
      }
      sound.error();
      return;
    }
    if (!selectedPlayer) {
      if (pool) sound.error();
      return;
    }
    if (!canPlace(slot.pos, selectedPlayer)) {
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
    setPool(null);
    setSelectedPlayerIdx(-1);
    if (newXi.filter(Boolean).length >= totalSlots) {
      setTimeout(() => onComplete(newXi), 400);
    }
  };

  // For pitch: when player is selected, mark slots as "fit" or "blocked"
  const slotHints = useMemo(() => {
    if (!selectedPlayer) return null;
    return formation.slots.map((slot, idx) => {
      if (xi[idx]) return "filled";
      if (canPlace(slot.pos, selectedPlayer)) return "fit";
      return "blocked";
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
          <div className="text-xs text-white/55 mt-1">
            Oyuncu seç → uygun boş slota yerleştir. Yerleşen oyuncuyu kaldırmak için seçim olmadan slota tıkla.
          </div>
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
            {selectedPlayer ? (
              <span className="text-amber-300">UYUMLU YEŞİL SLOTA TIKLA</span>
            ) : filledCount > 0 ? (
              <span className="text-white/40">DOLU SLOTA TIKLA → KALDIR</span>
            ) : null}
          </div>
          <Pitch
            formationId={formationId}
            xi={xi}
            onSlotClick={handlePlaceOnSlot}
            slotHints={slotHints}
            interactive={true}
            allowRemove={!selectedPlayer}
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
                      Zarı çevir — rastgele bir sezon ve takım kadrosu açılsın. Oyuncuyu kendi mevkisine uygun bir boş slota yerleştir.
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
                <SlotSpinner />
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
                    <span className="text-amber-300">SAHADA YEŞİL SLOTA TIKLAYARAK YERLEŞTİR</span>
                  ) : (
                    "KAPALI KARTLAR: ya kadronda var ya da pozisyonu uymuyor"
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {sortedPool.map((p, idx) => (
                    <div key={idx} className="relative">
                      <PlayerCard
                        player={p}
                        season={pool.season}
                        club={pool.team.club}
                        crest={pool.team.crest}
                        country={pool.team.country}
                        size="sm"
                        selected={selectedPlayerIdx === idx}
                        disabled={!p._placeable}
                        testId={`pool-player-${idx}`}
                        onClick={() => handleSelectPlayer(idx)}
                      />
                      {p._alreadyPicked && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full z-10">
                          KADRODA
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-[10px] text-white/40 font-mono">
                  TIP: Kanat oyuncuları (LW↔RW, LM↔RM) iki taraflı oynayabilir. Yerleşmiş oyuncuyu sahadan kaldırmak için sahaya tekrar tıkla.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Slot-machine style spinner: cycles team labels rapidly during the roll.
const SlotSpinner = () => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ALL_TEAM_LABELS.length));
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1 + Math.floor(Math.random() * 7)) % ALL_TEAM_LABELS.length), 70);
    return () => clearInterval(id);
  }, []);
  const cur = ALL_TEAM_LABELS[idx];
  return (
    <div className="text-center w-full">
      <div className="font-mono text-xs text-amber-300 tracking-widest mb-3">ZAR DÖNÜYOR…</div>
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.08 }}
        className="flex items-center justify-center gap-3"
      >
        <Crest code={cur.crest} size="lg" />
        <div className="font-display text-3xl md:text-4xl tracking-tight text-white">{cur.label}</div>
      </motion.div>
      <div className="text-[10px] text-white/30 font-mono mt-4 tracking-widest">SEZON & TAKIM RASTGELE BELİRLENİYOR</div>
    </div>
  );
};
