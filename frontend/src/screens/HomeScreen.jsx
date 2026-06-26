import React from "react";
import { motion } from "framer-motion";
import { Trophy, Shuffle, Sparkles, Swords } from "lucide-react";

export const HomeScreen = ({ onStart, hasSave, onContinue }) => {
  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center px-5 md:px-12">
      <div className="grid md:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-white/15 text-xs font-mono tracking-widest text-white/70">
            <Sparkles size={14} className="text-amber-300" /> 1995 — 2025 · 31 SEZON · 124 YARI FİNALİST
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
            ŞAMPIYONLAR LİGİ
            <br />
            <span style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff3b30 100%)", WebkitBackgroundClip: "text", color: "transparent" }}>
              DRAFT BUILDER
            </span>
          </h1>
          <p className="mt-6 text-white/70 text-base md:text-lg max-w-xl leading-relaxed">
            Tarihin en güçlü karma takımını sen kur. UCL son dörtlerinden zar zar oyuncu seç,
            taktiğini belirle ve 31 efsane şampiyonu eleyerek kupayı kaldır.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button type="button" onClick={onStart} className="btn-primary" data-testid="start-draft-button">
              YENİ DRAFT BAŞLAT
            </button>
            {hasSave && (
              <button type="button" onClick={onContinue} className="btn-ghost" data-testid="continue-button">
                KAYDA DEVAM ET
              </button>
            )}
          </div>

          <div className="mt-12 grid grid-cols-3 gap-5 max-w-xl">
            <Feature icon={<Shuffle size={18} />} label="ZAR SİSTEMİ" sub="Rastgele sezon & takım" />
            <Feature icon={<Swords size={18} />} label="TAKTİK" sub="Gegenpress / Tiki-Taka / Park the Bus" />
            <Feature icon={<Trophy size={18} />} label="32 TAKIM" sub="Tüm UCL şampiyonları" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative"
        >
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden glass">
            <img
              src="https://images.unsplash.com/photo-1637203727318-fb31b63e2377?crop=entropy&cs=srgb&fm=jpg&w=900&q=85"
              alt="UCL Trophy"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,7,10,0) 30%, rgba(7,7,10,0.95) 100%)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-7">
              <div className="font-mono text-xs text-amber-300 tracking-widest">EN YÜKSEK OVR · 99</div>
              <div className="font-display text-3xl md:text-4xl tracking-tight mt-2">"BALLON D'OR" ÖZEL KART</div>
              <p className="text-white/70 text-sm mt-2">Yarı finale çıkan & aynı yıl Ballon d'Or kazanan tek oyuncu altın siyah özel kartla gelir.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const Feature = ({ icon, label, sub }) => (
  <div className="glass p-4 rounded-lg">
    <div className="flex items-center gap-2 text-amber-300">{icon}<span className="font-display text-sm tracking-widest">{label}</span></div>
    <div className="text-[11px] text-white/60 mt-1 leading-snug">{sub}</div>
  </div>
);
