import React from "react";
import { motion } from "framer-motion";
import { Trophy, Archive } from "lucide-react";

export const TrophyScreen = ({ teamLabel, onRestart, onHallOfFame }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl px-4" data-testid="trophy-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="max-w-2xl w-full text-center"
      >
        <motion.div
          animate={{ y: [-6, 4, -6], rotate: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block"
        >
          <Trophy size={120} className="text-amber-300 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]" />
        </motion.div>
        <div className="font-mono text-xs tracking-widest text-amber-300 mt-6">UEFA CHAMPIONS LEAGUE</div>
        <h1 className="font-display text-6xl md:text-7xl tracking-tight mt-2">ŞAMPİYON!</h1>
        <p className="text-white/70 mt-4 text-base max-w-md mx-auto">
          {teamLabel} tarihin en güçlü karma kadrosunu kurarak Şampiyonlar Ligi kupasını kaldırdı.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-300/15 border border-amber-300/30">
          <Archive size={14} className="text-amber-300" />
          <span className="text-xs font-mono tracking-widest text-amber-300">KUPA KABİNİNE EKLENDİ</span>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onHallOfFame} data-testid="trophy-view-cabinet-button" className="btn-ghost flex items-center gap-2">
            <Archive size={16} /> KABİNİ GÖR
          </button>
          <button type="button" onClick={onRestart} data-testid="trophy-restart-button" className="btn-primary">
            YENİ DRAFT BAŞLAT
          </button>
        </div>
      </motion.div>
    </div>
  );
};
