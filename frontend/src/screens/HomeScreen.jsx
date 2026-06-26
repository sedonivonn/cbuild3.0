import React from "react";
import { motion } from "framer-motion";
import { Trophy, Shuffle, Swords, Sparkles } from "lucide-react";

export const HomeScreen = ({ onStart, hasSave, onContinue }) => {
  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-4xl text-center py-16"
      >
        <div className="inline-flex items-center gap-2 mb-7 px-3 py-1 rounded-full border border-white/15 text-xs font-mono tracking-widest text-white/70">
          <Sparkles size={14} className="text-amber-300" /> 1995 — 2025 · 31 SEZON · 124 YARI FİNALİST
        </div>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
          ŞAMPIYONLAR LİGİ
          <br />
          <span style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff3b30 100%)", WebkitBackgroundClip: "text", color: "transparent" }}>
            DRAFT BUILDER
          </span>
        </h1>
        <p className="mt-6 text-white/70 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Tarihin en güçlü karma takımını sen kur. UCL son dörtlerinden zar zar oyuncu seç,
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
        </div>

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
