import React from "react";
import { motion } from "framer-motion";
import { Pitch } from "../components/Pitch";
import { PlayerCard } from "../components/PlayerCard";

const Stat = ({ label, v, color }) => (
  <div className="rounded-md py-2 bg-white/5 text-center">
    <div className="text-[9px] text-white/50 tracking-widest">{label}</div>
    <div className="font-display text-2xl" style={{ color: color || "#fff" }}>{v || 0}</div>
  </div>
);

export const ConfirmScreen = ({ formationId, xi, teamStats, teamName, onBack, onContinue }) => {
  return (
    <div className="px-5 md:px-10 py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest mb-1">DRAFT ÖZETİ</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">KADRONU ONAYLA</h2>
          <div className="text-white/60 text-sm mt-1">"{teamName || "DRAFT TAKIMI"}" — onaylamadan taktiğe geçemezsin.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="btn-ghost" data-testid="confirm-back-button">← DRAFT'A DÖN</button>
          <button type="button" onClick={onContinue} className="btn-primary" data-testid="confirm-continue-button">TAKTIK SEÇİMİNE GEÇ →</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Pitch summary */}
        <div className="lg:col-span-5 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest">KADRO · {formationId}</div>
          <Pitch formationId={formationId} xi={xi} readOnly compact />
          <div className="grid grid-cols-5 gap-2 mt-5">
            <Stat label="OVR" v={teamStats?.overall} color="#FFD700" />
            <Stat label="KLC" v={teamStats?.keeper} />
            <Stat label="DEF" v={teamStats?.defense} />
            <Stat label="ORT" v={teamStats?.midfield} />
            <Stat label="HÜC" v={teamStats?.attack} />
          </div>
        </div>

        {/* Players grid */}
        <div className="lg:col-span-7 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest">11 OYUNCU</div>
          <motion.div className="grid grid-cols-3 sm:grid-cols-4 gap-3"
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {xi.map((p, idx) =>
              p ? (
                <motion.div key={idx} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                  <PlayerCard
                    player={p}
                    season={p._season}
                    club={p._club}
                    crest={p._crest}
                    country={p._country}
                    size="sm"
                    testId={`confirm-player-${idx}`}
                  />
                </motion.div>
              ) : null
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
