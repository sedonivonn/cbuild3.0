import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Shuffle, Swords, Archive } from "lucide-react";
import { getAllTrophies, getTopTrophies } from "../engine/hallOfFame";
import { effOverall } from "../data/ballonDor";

function tierBg(ovr) {
  if (ovr >= 90) return "linear-gradient(135deg, #4a2569 0%, #7c3aed 100%)";
  if (ovr >= 85) return "linear-gradient(135deg, #7c5f00 0%, #f5c542 100%)";
  if (ovr >= 80) return "linear-gradient(135deg, #6b7280 0%, #cbd5e1 100%)";
  return "linear-gradient(135deg, #5a3818 0%, #b07333 100%)";
}

export const HomeScreen = ({ onStart, hasSave, onContinue, onHallOfFame }) => {
  const trophies = useMemo(() => getAllTrophies(), []);
  const topThree = useMemo(() => getTopTrophies(3), []);
  const hasTrophies = trophies.length > 0;

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-5xl py-14 text-center"
      >
        <div className="mb-7" />
        <h1 className="font-display leading-[0.95] tracking-tight flex items-baseline justify-center gap-3 md:gap-5 text-5xl sm:text-6xl md:text-8xl lg:text-9xl whitespace-nowrap">
          <span
            style={{
              color: "#d4af37",
              backgroundImage: "linear-gradient(180deg,#f4d77a 0%,#d4af37 45%,#a87f24 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 28px rgba(212,175,55,0.28)",
              filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.4))",
            }}
          >
            champions
          </span>
          <span
            className="text-white"
            style={{ textShadow: "0 0 22px rgba(255,255,255,0.22)" }}
          >
            build
          </span>
        </h1>
        <p className="mt-6 text-white/70 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Tarihin en güçlü karma takımını sen kur. Efsane UCL takımları arasından zar zar oyuncu seç,
          taktiğini belirle ve 31 efsane şampiyonu eleyerek kupayı kaldır.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <button type="button" onClick={onStart} className="btn-primary" data-testid="start-draft-button">
            YENİ DRAFT BAŞLAT
          </button>
          {hasSave && (
            <button type="button" onClick={onContinue} className="btn-ghost" data-testid="continue-button">
              KAYDA DEVAM ET
            </button>
          )}
          <button
            type="button"
            onClick={onHallOfFame}
            className="btn-ghost flex items-center gap-2"
            data-testid="open-hall-of-fame-button"
          >
            <Archive size={16} className="text-amber-300" />
            KUPA KABİNİM
            {hasTrophies && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-300 text-black text-[10px] font-bold">
                {trophies.length}
              </span>
            )}
          </button>
        </div>

        {/* Cabinet preview — only when user has trophies */}
        {hasTrophies && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
            data-testid="cabinet-preview"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-300">
                <Trophy size={16} />
                <span className="font-mono text-xs tracking-widest">EN İYİ DRAFT&apos;LARIM</span>
              </div>
              <button
                type="button"
                onClick={onHallOfFame}
                className="text-[11px] font-mono tracking-widest text-white/60 hover:text-amber-300"
                data-testid="see-all-trophies-button"
              >
                TÜMÜNÜ GÖR →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topThree.map((t) => (
                <CabinetPreviewCard key={t.id} trophy={t} onClick={onHallOfFame} />
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <Feature icon={<Shuffle size={18} />} label="ZAR SİSTEMİ" sub="Rastgele sezon & takım" />
          <Feature icon={<Swords size={18} />} label="TAKTİK" sub="Gegenpress / Tiki-Taka / Park the Bus" />
          <Feature icon={<Trophy size={18} />} label="32 TAKIM" sub="Tüm UCL şampiyonları" />
        </div>
      </motion.div>
    </div>
  );
};

const Feature = ({ icon, label, sub }) => (
  <div className="glass p-4 rounded-lg text-left">
    <div className="flex items-center gap-2 text-amber-300">{icon}<span className="font-display text-sm tracking-widest">{label}</span></div>
    <div className="text-[11px] text-white/60 mt-1 leading-snug">{sub}</div>
  </div>
);

const CabinetPreviewCard = ({ trophy, onClick }) => {
  const topPlayer = useMemo(() => {
    const sorted = [...(trophy.xi || [])]
      .map((p) => ({ ...p, _ovr: effOverall(p, p._season) }))
      .sort((a, b) => b._ovr - a._ovr);
    return sorted[0];
  }, [trophy.xi]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass rounded-xl p-3 text-left relative overflow-hidden hover:ring-2 hover:ring-amber-300/40 transition-all"
      data-testid={`cabinet-preview-${trophy.id}`}
    >
      <Trophy size={28} className="absolute top-2 right-2 text-amber-300 opacity-30" />
      <span
        className="inline-block px-2 py-0.5 rounded font-display text-base mb-1"
        style={{ background: tierBg(trophy.totalOvr || 0), color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
      >
        {trophy.totalOvr} OVR
      </span>
      <div className="font-display text-base tracking-tight truncate mt-1" title={trophy.teamName}>
        {trophy.teamName}
      </div>
      <div className="text-[10px] font-mono text-white/50 tracking-wider">
        {trophy.formationId} · {trophy.tactic?.replace("_", "-")}
      </div>
      {topPlayer && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/70 truncate">{topPlayer.name}</span>
          <span className="font-mono text-amber-300 ml-1">{topPlayer._ovr}</span>
        </div>
      )}
    </button>
  );
};
