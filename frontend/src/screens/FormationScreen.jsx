import React from "react";
import { motion } from "framer-motion";
import { FORMATIONS } from "../data/formations";
import { Pitch } from "../components/Pitch";
import { sound } from "../engine/sounds";

export const FormationScreen = ({ selected, onSelect, onContinue }) => {
  return (
    <div className="px-5 md:px-12 py-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest mb-1">ADIM 1 / 4</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">FORMASYONUNU SEÇ</h2>
          <p className="text-white/60 mt-2 max-w-xl">Seçeceğin diziliş, draft sırasında hangi pozisyonlara oyuncu çekeceğini belirler. Sonradan değiştiremezsin.</p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          data-testid="formation-continue-button"
          className="btn-primary disabled:opacity-50"
        >
          DEVAM ET →
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.values(FORMATIONS).map((f) => {
          const active = selected === f.id;
          return (
            <motion.button
              key={f.id}
              type="button"
              onClick={() => { sound.click(); onSelect(f.id); }}
              data-testid={`formation-${f.id}`}
              whileHover={{ y: -4 }}
              className={`glass rounded-2xl p-5 text-left transition-all ${active ? "ring-2 ring-amber-300" : "ring-1 ring-white/10"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-3xl tracking-tight">{f.label}</h3>
                {active && <span className="text-amber-300 font-mono text-xs tracking-widest">SEÇİLDİ</span>}
              </div>
              <p className="text-xs text-white/60 mb-4 min-h-[34px]">{f.description}</p>
              <div className="scale-90 origin-top">
                <Pitch formationId={f.id} xi={[]} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
