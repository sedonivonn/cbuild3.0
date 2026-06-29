import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DiceButton } from "../components/DiceButton";
import { PlayerCard } from "../components/PlayerCard";
import { Pitch } from "../components/Pitch";
import { Crest } from "../components/Crest";
import { FORMATIONS, canPlace, hasAvailableSlot } from "../data/formations";
import { TACTICS } from "../data/tactics";
import { effOverall } from "../data/ballonDor";
import { rollRandom, rollLucky } from "../engine/draftEngine";
import { sound } from "../engine/sounds";
import { SEASONS } from "../data/seasons";
import { QUARTERFINALISTS } from "../data/quarterfinalists";
import { computeTeamStats } from "../engine/overallEngine";
import { RefreshCw, X, Flame, Network, Shield, Play } from "lucide-react";

const TACTIC_ICONS = { Flame, Network, Shield };

// Merged pool used by both the slot-machine spinner AND the "Change Year" logic.
const MERGED_POOL = {};
for (const k of Object.keys(SEASONS)) MERGED_POOL[k] = [...SEASONS[k]];
for (const k of Object.keys(QUARTERFINALISTS)) {
  MERGED_POOL[k] = [...(MERGED_POOL[k] || []), ...QUARTERFINALISTS[k]];
}
const ALL_TEAM_LABELS = Object.entries(MERGED_POOL).flatMap(([season, teams]) =>
  teams.map((t) => ({ label: `${season} ${t.club}`, crest: t.crest }))
);

// Unified Komuta Merkezi (Command Center) — formation + tactic + draft on a single screen.
export const DraftScreen = ({
  formationId, setFormationId,
  teamName, setTeamName,
  xi, setXi,
  tactic, setTactic,
  changes, onUseChange,
  onComplete,
}) => {
  const formation = FORMATIONS[formationId] || FORMATIONS["4-3-3"];
  const [pool, setPool] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(-1);
  const [poolOpen, setPoolOpen] = useState(false);
  // Two-phase flow: 'setup' (configure team) → 'draft' (full pitch, modal-only)
  const [phase, setPhase] = useState(() => (xi.some(Boolean) ? "draft" : "setup"));

  const filledCount = xi.filter(Boolean).length;
  const totalSlots = formation.slots.length;
  const isDraftComplete = filledCount >= totalSlots;
  const readyToStart = isDraftComplete && tactic;

  const pickedNames = useMemo(() => new Set(xi.filter(Boolean).map((p) => p.name)), [xi]);

  // Live team stats (overall + lines) — only when XI is full
  const liveStats = useMemo(() => {
    if (!isDraftComplete) return null;
    const mapped = formation.slots.map((slot, idx) => ({ slot, player: xi[idx] }));
    return computeTeamStats(mapped);
  }, [isDraftComplete, formation, xi]);

  const handleFormationChange = (newId) => {
    if (newId === formationId) return;
    if (filledCount > 0) {
      const ok = window.confirm(
        `Dizilişi değiştirirsen mevcut ${filledCount} oyuncu silinir. Devam?`
      );
      if (!ok) return;
    }
    sound.click();
    setFormationId(newId);
    setXi(new Array(FORMATIONS[newId].slots.length).fill(null));
    setPool(null);
    setSelectedPlayerIdx(-1);
    setPoolOpen(false);
  };

  const handleRoll = () => {
    if (isDraftComplete) return;
    if (phase === "setup" && !tactic) { sound.error(); return; }
    if (phase === "setup") setPhase("draft");
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
    const lucky = changes.luckyRemaining > 0;
    onUseChange(lucky); // decrement immediately for instant UI feedback
    setRolling(true);
    sound.dice();
    setTimeout(() => {
      const newRoll = lucky ? rollLucky() : rollRandom();
      setPool(newRoll);
      setSelectedPlayerIdx(-1);
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const handleChangeYear = () => {
    if (!pool || changes.remaining <= 0) { sound.error(); return; }
    const currentClub = pool.team.club;
    const currentSeason = pool.season;
    const candidates = [];
    for (const [seasonKey, teams] of Object.entries(MERGED_POOL)) {
      const seasonNum = Number(seasonKey);
      if (seasonNum === currentSeason) continue;
      const match = teams.find((t) => t.club === currentClub);
      if (match) candidates.push({ season: seasonNum, team: match });
    }
    if (candidates.length === 0) { sound.error(); return; }
    onUseChange(false); // decrement immediately
    setRolling(true);
    sound.dice();
    setTimeout(() => {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setPool(pick);
      setSelectedPlayerIdx(-1);
      setRolling(false);
      sound.cardReveal();
    }, 900);
  };

  const sortedPool = useMemo(() => {
    if (!pool) return [];
    const seasonNum = pool.season;
    const arr = pool.team.players.slice().sort((a, b) => effOverall(b, seasonNum) - effOverall(a, seasonNum));
    return arr.map((p) => {
      const alreadyPicked = pickedNames.has(p.name);
      const placeable = !alreadyPicked && hasAvailableSlot(formation, xi, p);
      return { ...p, _placeable: placeable, _alreadyPicked: alreadyPicked };
    });
  }, [pool, formation, xi, pickedNames]);

  const selectedPlayer = selectedPlayerIdx >= 0 ? sortedPool[selectedPlayerIdx] : null;

  const handleSelectPlayer = (idx) => {
    const p = sortedPool[idx];
    if (!p || !p._placeable) { sound.error(); return; }
    sound.click();
    setSelectedPlayerIdx(idx);
  };

  const handlePlaceOnSlot = (slotIdx, slot) => {
    if (xi[slotIdx]) { sound.error(); return; }
    if (!selectedPlayer) { if (pool) sound.error(); return; }
    if (!canPlace(slot.pos, selectedPlayer)) { sound.error(); return; }
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
  };

  const slotHints = useMemo(() => {
    if (!selectedPlayer) return null;
    return formation.slots.map((slot, idx) => {
      if (xi[idx]) return "filled";
      if (canPlace(slot.pos, selectedPlayer)) return "fit";
      return "blocked";
    });
  }, [selectedPlayer, formation, xi]);

  const handleStart = () => {
    if (!readyToStart) return;
    sound.click();
    onComplete(xi);
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest">
            {phase === "setup" ? "KOMUTA MERKEZİ" : "DRAFT MODU"}
          </div>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight">
            {phase === "setup" ? (
              "DRAFT & DİZİLİŞ & TAKTİK"
            ) : (
              <span className="flex items-center gap-3 flex-wrap">
                <span className="truncate max-w-[260px]">{teamName || "DRAFT TAKIMI"}</span>
                <span className="text-base text-white/55 font-mono tracking-widest">
                  · {formation.label} {tactic ? `· ${TACTICS[tactic].name}` : ""}
                </span>
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {phase === "draft" && filledCount === 0 && (
            <button
              type="button"
              onClick={() => { sound.click(); setPhase("setup"); setPool(null); setPoolOpen(false); setSelectedPlayerIdx(-1); }}
              data-testid="back-to-setup-button"
              className="btn-ghost text-xs"
            >
              ← AYARLARA DÖN
            </button>
          )}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/60">CHANGE HAKKI</div>
            <div className="font-display text-2xl text-amber-300" data-testid="changes-remaining">{changes.remaining} / 3</div>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!readyToStart}
            data-testid="start-tournament-button"
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play size={16} /> TURNUVAYA BAŞLA
          </button>
        </div>
      </div>

      {/* Layout — 3 columns in setup, single wide pitch in draft */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT COLUMN — only in SETUP phase */}
        {phase === "setup" && (
        <div className="lg:col-span-3 space-y-4">
          {/* Team name */}
          <div className="glass rounded-2xl p-4">
            <label className="text-[10px] text-white/55 tracking-widest font-mono block mb-2">TAKIM ADI</label>
            <input
              type="text"
              value={teamName || ""}
              onChange={(e) => setTeamName(e.target.value.slice(0, 24))}
              maxLength={24}
              placeholder="DRAFT TAKIMI"
              data-testid="team-name-input"
              className="w-full bg-black/40 border border-white/15 focus:border-amber-300 outline-none rounded-md px-3 py-2 font-display text-lg tracking-tight text-white placeholder:text-white/30"
            />
          </div>

          {/* Formation */}
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] text-white/55 tracking-widest font-mono mb-3">DİZİLİŞ</div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(FORMATIONS).map((f) => {
                const active = formationId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleFormationChange(f.id)}
                    data-testid={`formation-${f.id}`}
                    className={`rounded-lg py-2 px-1 text-sm font-display tracking-tight transition-all ${
                      active
                        ? "bg-amber-300 text-black ring-2 ring-amber-300/80"
                        : "bg-white/5 text-white/80 hover:bg-white/10 ring-1 ring-white/10"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tactic */}
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] text-white/55 tracking-widest font-mono mb-3">TAKTİK</div>
            <div className="space-y-2">
              {Object.values(TACTICS).map((t) => {
                const Icon = TACTIC_ICONS[t.icon] || Flame;
                const active = tactic === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { sound.click(); setTactic(t.id); }}
                    data-testid={`tactic-${t.id}`}
                    className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition-all ${
                      active
                        ? "ring-2 ring-amber-300/80 bg-white/10"
                        : "ring-1 ring-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: t.color + "22", color: t.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base tracking-tight leading-tight">{t.name}</div>
                      <div className="text-[10px] text-white/55 truncate">{t.tagline}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roll dice */}
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] text-white/55 tracking-widest font-mono mb-3">ZAR</div>
            {!pool && !isDraftComplete && (
              <>
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={!tactic}
                  data-testid="roll-dice-button"
                  className="w-full btn-primary text-base py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🎲 ROLL DICE
                </button>
                {!tactic && (
                  <div className="text-[10px] text-amber-300/80 mt-2 text-center font-mono tracking-widest">
                    ÖNCE TAKTİK SEÇ
                  </div>
                )}
              </>
            )}
            {pool && !rolling && (
              <div className="text-center py-2 text-[10px] text-white/55 font-mono tracking-widest">
                Çekildi: {pool.season} {pool.team.club}
                <div className="mt-1 text-amber-300/80">DRAFT MODUNA GEÇİLDİ</div>
              </div>
            )}
            {isDraftComplete && (
              <div className="text-center py-3 font-display text-amber-300 text-base">KADRO TAMAM</div>
            )}
          </div>
        </div>
        )}

        {/* MIDDLE COLUMN — pitch (col-span varies: 6 in setup, 5 in draft to give right panel room) */}
        <div className={`glass rounded-2xl p-4 ${phase === "setup" ? "lg:col-span-6" : "lg:col-span-5"}`}>
          <div className="text-xs text-white/55 mb-3 font-mono tracking-widest flex items-center justify-between">
            <span>SAHA · {formation.label} {tactic ? `· ${TACTICS[tactic].name}` : ""}</span>
            {selectedPlayer && (
              <span className="text-amber-300">YEŞİL SLOTA TIKLA</span>
            )}
          </div>
          <Pitch
            formationId={formationId || "4-3-3"}
            xi={xi}
            onSlotClick={handlePlaceOnSlot}
            slotHints={slotHints}
            interactive={true}
            tactic={tactic}
          />
          {selectedPlayer && (
            <div className="mt-3 p-2 rounded-lg bg-amber-300/10 border border-amber-300/30 text-xs text-amber-200 flex items-center justify-between">
              <span>SEÇİLİ: <strong>{selectedPlayer.name}</strong> ({selectedPlayer.primary})</span>
              <button
                type="button"
                onClick={() => { setSelectedPlayerIdx(-1); sound.click(); }}
                className="text-amber-300 hover:text-white"
                data-testid="cancel-selection-button"
              ><X size={14} /></button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — roster list (only in SETUP phase) */}
        {phase === "setup" && (
        <div className="lg:col-span-3 glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-white/55 tracking-widest font-mono">KADRO</div>
            <div className="font-display text-2xl text-amber-300" data-testid="roster-count">{filledCount}/{totalSlots}</div>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-amber-300 transition-all"
              style={{ width: `${(filledCount / totalSlots) * 100}%` }}
            />
          </div>
          {/* Position list */}
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {formation.slots.map((slot, idx) => {
              const player = xi[idx];
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 ${
                    player ? "bg-white/5" : "bg-white/[0.02]"
                  }`}
                  data-testid={`roster-row-${idx}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] tracking-wider text-white/45 w-8 shrink-0">{slot.pos}</span>
                    {player ? (
                      <span className="text-xs text-white truncate" title={player.name}>{player.name}</span>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </div>
                  {player && (
                    <span className="font-display text-sm text-amber-300 shrink-0">
                      {effOverall(player, player._season)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Stats */}
          {liveStats && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-white/55 tracking-widest font-mono">TAKIM OVR</div>
                <div className="font-display text-3xl text-amber-300" data-testid="team-overall">{liveStats.overall}</div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <Stat label="KLC" v={liveStats.keeper} />
                <Stat label="DEF" v={liveStats.defense} />
                <Stat label="ORT" v={liveStats.midfield} />
                <Stat label="HÜC" v={liveStats.attack} />
              </div>
            </div>
          )}
        </div>
        )}

        {/* RIGHT COLUMN — draft phase: Spin the Wheel + cards (wider for 3-4 card grid) */}
        {phase === "draft" && (
          <div className="lg:col-span-7 glass rounded-2xl p-4 flex flex-col">
            {!pool && !rolling && !isDraftComplete && (
              <SpinTheWheelIdle
                onSpin={handleRoll}
                hint={`KADRO: ${filledCount}/${totalSlots}`}
              />
            )}
            {rolling && <ClubSeasonSpinner cycling={true} />}
            {pool && !rolling && (
              <>
                <ClubSeasonSpinner cycling={false} season={pool.season} team={pool.team} />
                <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[520px] overflow-y-auto pr-1 mt-3">
                  {sortedPool.map((p, idx) => (
                    <div key={idx} className="relative">
                      <PlayerCard
                        player={p}
                        season={pool.season}
                        club={pool.team.club}
                        crest={pool.team.crest}
                        country={pool.team.country}
                        size="xs"
                        selected={selectedPlayerIdx === idx}
                        disabled={!p._placeable}
                        testId={`pool-player-${idx}`}
                        onClick={() => handleSelectPlayer(idx)}
                      />
                      {p._alreadyPicked && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[7px] font-bold tracking-wider px-1 py-0.5 rounded-full z-10">
                          KADRODA
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {!isDraftComplete && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                    <button
                      type="button"
                      onClick={handleChangeYear}
                      disabled={changes.remaining <= 0}
                      data-testid="change-year-button-draft"
                      className="flex-1 btn-ghost text-xs py-2 flex items-center justify-center gap-1 disabled:opacity-30"
                      title="Aynı kulübün farklı sezonu"
                    >
                      <RefreshCw size={12} /> YIL
                    </button>
                    <button
                      type="button"
                      onClick={handleChange}
                      disabled={changes.remaining <= 0}
                      data-testid="change-button-draft"
                      className="flex-1 btn-ghost text-xs py-2 flex items-center justify-center gap-1 disabled:opacity-30"
                    >
                      <RefreshCw size={12} /> CHANGE
                    </button>
                    <button
                      type="button"
                      onClick={handleRoll}
                      data-testid="reroll-button-draft"
                      className="flex-1 btn-primary text-xs py-2"
                      title="Yeni takım çek"
                    >
                      YENİ ZAR
                    </button>
                  </div>
                )}
              </>
            )}
            {isDraftComplete && (
              <div className="text-center py-12">
                <div className="font-mono text-xs tracking-widest text-amber-300 mb-2">🏆</div>
                <div className="font-display text-2xl text-amber-300 leading-tight">KADRON HAZIR</div>
                <div className="text-xs text-white/55 mt-2">Sağ üstten TURNUVAYA BAŞLA</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, v }) => (
  <div className="rounded-md py-1 bg-white/5">
    <div className="text-[8px] text-white/50 tracking-widest">{label}</div>
    <div className="font-display text-base text-white">{v || 0}</div>
  </div>
);

// Idle state for the right-side Spin panel — empty CLUB/SEASON boxes + Spin button.
const SpinTheWheelIdle = ({ onSpin, hint }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        onSpin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSpin]);

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 py-8 cursor-pointer select-none"
      onClick={onSpin}
      data-testid="spin-the-wheel-idle"
    >
      <div className="text-[10px] text-white/40 tracking-widest font-mono mb-1">{hint}</div>
      <div className="flex items-center gap-3 mb-5 mt-2">
        <SlotBox label="CLUB" empty />
        <span className="text-white/30 font-display text-xl">×</span>
        <SlotBox label="SEASON" empty narrow />
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSpin(); }}
        data-testid="roll-dice-button-draft"
        className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-display text-lg tracking-tight shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.03] flex items-center gap-2"
      >
        🎰 Spin the Wheel
      </button>
      <div className="text-[10px] text-white/35 mt-3 italic">veya boş alana tıkla / Boşluk tuşu</div>
    </div>
  );
};

// Spinner during/after roll — two boxes (CLUB & SEASON) animate independently.
const ClubSeasonSpinner = ({ cycling, season, team }) => {
  const [clubIdx, setClubIdx] = useState(() => Math.floor(Math.random() * ALL_TEAM_LABELS.length));
  const [seasonIdx, setSeasonIdx] = useState(() => Math.floor(Math.random() * ALL_TEAM_LABELS.length));
  useEffect(() => {
    if (!cycling) return;
    const idA = setInterval(() => setClubIdx((i) => (i + 1 + Math.floor(Math.random() * 7)) % ALL_TEAM_LABELS.length), 70);
    const idB = setInterval(() => setSeasonIdx((i) => (i + 1 + Math.floor(Math.random() * 5)) % ALL_TEAM_LABELS.length), 95);
    return () => { clearInterval(idA); clearInterval(idB); };
  }, [cycling]);

  const clubLabel = cycling
    ? ALL_TEAM_LABELS[clubIdx].label.replace(/^\d+\s+/, "")
    : (team?.club || "—");
  const clubCrest = cycling ? ALL_TEAM_LABELS[clubIdx].crest : (team?.crest || "");
  const seasonLabel = cycling
    ? ALL_TEAM_LABELS[seasonIdx].label.split(" ")[0]
    : (season || "—");

  return (
    <div className="flex flex-col items-center py-2" data-testid="club-season-spinner">
      <div className="flex items-center gap-3 mb-2">
        <SlotBox label="CLUB" crest={clubCrest} value={clubLabel} testId="rolled-team-name" />
        <span className="text-white/30 font-display text-xl">×</span>
        <SlotBox label="SEASON" value={seasonLabel} narrow testId="rolled-season" />
      </div>
      {cycling && (
        <div className="font-mono text-[10px] text-amber-300 tracking-widest mt-1">ÇEKİLİYOR…</div>
      )}
    </div>
  );
};

const SlotBox = ({ label, value, crest, empty, narrow, testId }) => (
  <div className={`${narrow ? "w-20" : "w-28"} h-[72px] rounded-lg bg-black/45 border border-white/10 flex flex-col items-center justify-center p-1 relative`}>
    <div className="absolute -top-2 left-2 text-[8px] text-white/45 tracking-widest font-mono bg-[#0a0a0a] px-1">{label}</div>
    {empty ? (
      <div className="text-white/15 text-2xl">·</div>
    ) : (
      <>
        {crest && <Crest code={crest} size="sm" />}
        <div className="font-display text-xs text-white text-center leading-tight mt-0.5 truncate w-full px-1" data-testid={testId}>{value}</div>
      </>
    )}
  </div>
);

// Legacy slot-machine spinner — kept around (used by the obsolete modal path) but no longer rendered.
const SlotSpinner = ({ compact = false }) => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ALL_TEAM_LABELS.length));
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1 + Math.floor(Math.random() * 7)) % ALL_TEAM_LABELS.length), 70);
    return () => clearInterval(id);
  }, []);
  const cur = ALL_TEAM_LABELS[idx];
  return (
    <div className={`text-center w-full ${compact ? "py-6" : "py-10"}`}>
      <div className="font-mono text-xs text-amber-300 tracking-widest mb-3">ZAR DÖNÜYOR…</div>
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.08 }}
        className="flex flex-col items-center justify-center gap-2"
      >
        <Crest code={cur.crest} size={compact ? "md" : "lg"} />
        <div className={`font-display tracking-tight text-white ${compact ? "text-base" : "text-3xl md:text-4xl"}`}>{cur.label}</div>
      </motion.div>
      <div className="text-[10px] text-white/30 font-mono mt-3 tracking-widest">SEZON & TAKIM RASTGELE BELİRLENİYOR</div>
    </div>
  );
};

// DiceButton import kept for tree-shaking compatibility, unused inline now.
const _unusedDice = DiceButton; void _unusedDice;
