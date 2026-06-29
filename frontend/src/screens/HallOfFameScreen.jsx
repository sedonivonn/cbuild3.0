import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Trash2, ArrowLeft, X, Calendar, Crown } from "lucide-react";
import { getAllTrophies, deleteTrophy, clearAllTrophies } from "../engine/hallOfFame";
import { Pitch } from "../components/Pitch";
import { effOverall } from "../data/ballonDor";
import { TACTICS } from "../data/tactics";

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_) {
    return "";
  }
}

function tierBg(ovr) {
  if (ovr >= 90) return "linear-gradient(135deg, #4a2569 0%, #7c3aed 100%)";
  if (ovr >= 85) return "linear-gradient(135deg, #7c5f00 0%, #f5c542 100%)";
  if (ovr >= 80) return "linear-gradient(135deg, #6b7280 0%, #cbd5e1 100%)";
  return "linear-gradient(135deg, #5a3818 0%, #b07333 100%)";
}

export const HallOfFameScreen = ({ onBack }) => {
  const [trophies, setTrophies] = useState(() => getAllTrophies());
  const [selected, setSelected] = useState(null);

  const stats = useMemo(() => {
    if (trophies.length === 0) return { total: 0, avgOvr: 0, bestOvr: 0 };
    const ovrs = trophies.map((t) => t.totalOvr || 0);
    return {
      total: trophies.length,
      avgOvr: Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length),
      bestOvr: Math.max(...ovrs),
    };
  }, [trophies]);

  const handleDelete = (id) => {
    if (!window.confirm("Bu kupayı kabinden silmek istediğinden emin misin?")) return;
    setTrophies(deleteTrophy(id));
    setSelected(null);
  };

  const handleClearAll = () => {
    if (!window.confirm("TÜM kupalarını silmek istediğinden emin misin? Bu işlem geri alınamaz.")) return;
    clearAllTrophies();
    setTrophies([]);
  };

  return (
    <div className="px-5 md:px-10 py-6 max-w-[1600px] mx-auto" data-testid="hall-of-fame-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost flex items-center gap-2"
            data-testid="hof-back-button"
          >
            <ArrowLeft size={16} /> ANA EKRAN
          </button>
          <div>
            <div className="font-mono text-xs text-amber-300 tracking-widest">KUPA KABİNİM</div>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight flex items-center gap-3">
              <Trophy className="text-amber-300" size={36} />
              HALL OF FAME
            </h2>
          </div>
        </div>
        {trophies.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="btn-ghost text-red-300 flex items-center gap-2"
            data-testid="hof-clear-all-button"
          >
            <Trash2 size={14} /> TÜMÜNÜ SIFIRLA
          </button>
        )}
      </div>

      {/* Stats Bar */}
      {trophies.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-7">
          <StatBlock icon={<Trophy size={20} />} label="TOPLAM KUPA" value={stats.total} />
          <StatBlock icon={<Crown size={20} />} label="EN YÜKSEK OVR" value={stats.bestOvr} accent />
          <StatBlock icon={<Trophy size={20} />} label="ORTALAMA OVR" value={stats.avgOvr} />
        </div>
      )}

      {/* Empty state */}
      {trophies.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Trophy size={72} className="mx-auto text-white/20 mb-4" />
          <div className="font-display text-2xl text-white/70 mb-2">Henüz kupa kazanmadın.</div>
          <div className="text-white/40 text-sm max-w-md mx-auto">
            Şampiyonlar Ligi&apos;ni kazandığında, kadron buraya otomatik olarak eklenecek.
            Farklı formasyonlar ve taktiklerle koleksiyonunu büyüt!
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trophies.map((t) => (
            <TrophyCard key={t.id} trophy={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <TrophyDetailModal
            trophy={selected}
            onClose={() => setSelected(null)}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const StatBlock = ({ icon, label, value, accent = false }) => (
  <div className={`glass rounded-xl p-4 ${accent ? "ring-1 ring-amber-300/40" : ""}`}>
    <div className={`flex items-center gap-2 ${accent ? "text-amber-300" : "text-white/60"}`}>
      {icon}
      <span className="font-mono text-[10px] tracking-widest">{label}</span>
    </div>
    <div className={`font-display text-4xl mt-1 ${accent ? "text-amber-300" : "text-white"}`}>{value}</div>
  </div>
);

const TrophyCard = ({ trophy, onClick }) => {
  const tactic = TACTICS[trophy.tactic];
  // Top 3 players preview
  const topPlayers = useMemo(() => {
    return [...(trophy.xi || [])]
      .map((p) => ({ ...p, _ovr: effOverall(p, p._season) }))
      .sort((a, b) => b._ovr - a._ovr)
      .slice(0, 3);
  }, [trophy.xi]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      data-testid={`trophy-card-${trophy.id}`}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="glass rounded-2xl p-5 text-left relative overflow-hidden block w-full hover:ring-2 hover:ring-amber-300/50 transition-all"
      style={{
        background: "linear-gradient(160deg, rgba(20,20,24,0.85) 0%, rgba(40,30,10,0.6) 100%)",
      }}
    >
      {/* Trophy icon corner */}
      <div className="absolute top-3 right-3 opacity-30">
        <Trophy size={42} className="text-amber-300" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-2 py-0.5 rounded font-display text-lg tracking-wider"
          style={{ background: tierBg(trophy.totalOvr || 0), color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {trophy.totalOvr || "—"}
        </span>
        <span className="font-mono text-[10px] text-white/50 tracking-widest">TAKIM OVR</span>
      </div>

      <div className="font-display text-2xl tracking-tight text-white truncate mb-1" title={trophy.teamName}>
        {trophy.teamName}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tracking-wider text-white/70 mb-3">
        <span>{trophy.formationId}</span>
        <span className="text-white/30">·</span>
        <span style={{ color: tactic?.color || "white" }}>{tactic?.name || trophy.tactic}</span>
      </div>

      {/* Top 3 player names */}
      <div className="border-t border-white/10 pt-2.5 space-y-1">
        <div className="font-mono text-[9px] text-white/40 tracking-widest mb-1">YILDIZLAR</div>
        {topPlayers.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="truncate text-white/85">{p.name}</span>
            <span className="font-mono text-amber-300 ml-2">{p._ovr}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1 text-[10px] text-white/40">
        <Calendar size={11} /> {formatDate(trophy.date)}
      </div>
    </motion.button>
  );
};

const TrophyDetailModal = ({ trophy, onClose, onDelete }) => {
  const tactic = TACTICS[trophy.tactic];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-4 py-6 overflow-y-auto"
      onClick={onClose}
      data-testid="trophy-detail-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass rounded-2xl p-6 md:p-8 max-w-5xl w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-mono text-xs text-amber-300 tracking-widest flex items-center gap-2">
              <Trophy size={14} /> KUPA SAHİBİ · {formatDate(trophy.date)}
            </div>
            <h3 className="font-display text-3xl md:text-4xl tracking-tight mt-1">{trophy.teamName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-mono tracking-wider text-white/70">
              <span>{trophy.formationId}</span>
              <span className="text-white/30">·</span>
              <span style={{ color: tactic?.color || "white" }}>{tactic?.name || trophy.tactic}</span>
              <span className="text-white/30">·</span>
              <span
                className="px-2 py-0.5 rounded font-display text-base"
                style={{ background: tierBg(trophy.totalOvr || 0), color: "white" }}
              >
                {trophy.totalOvr} OVR
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-2"
            data-testid="trophy-detail-close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Pitch + Squad list */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="font-mono text-xs text-white/50 tracking-widest mb-2">SAHA</div>
            <Pitch
              formationId={trophy.formationId}
              xi={trophy.xi}
              readOnly
              interactive={false}
              tactic={tactic}
            />
          </div>
          <div>
            <div className="font-mono text-xs text-white/50 tracking-widest mb-2">KADRO</div>
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-2">
              {(trophy.xi || []).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-white/40 w-8">{p._slot || p.primary}</span>
                    <span className="truncate font-medium" title={p.name}>{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-white/40">{p._season}</span>
                    <span
                      className="font-display text-base px-2 py-0.5 rounded"
                      style={{ background: tierBg(effOverall(p, p._season)), color: "white" }}
                    >
                      {effOverall(p, p._season)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="btn-ghost text-red-300 flex items-center gap-2"
            data-testid="trophy-detail-delete"
          >
            <Trash2 size={14} /> SİL
          </button>
          <button type="button" onClick={onClose} className="btn-primary" data-testid="trophy-detail-close-bottom">
            KAPAT
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
