import React from "react";
import { motion } from "framer-motion";
import { FORMATIONS } from "../data/formations";
import { Pitch } from "../components/Pitch";
import { sound } from "../engine/sounds";

export const FormationScreen = ({ selected, onSelect, onContinue, teamName, setTeamName }) => {
  return (
    <div className="px-5 md:px-12 py-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest mb-1">ADIM 1 / 4</div>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">TAKIMINI KUR</h2>
          <p className="text-white/60 mt-1 text-sm max-w-xl">Takımına bir isim ver, dizilişini seç.</p>
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

      {/* Team name */}
      <div className="glass rounded-2xl p-5 mb-6 max-w-xl">
        <label className="text-[10px] text-white/60 tracking-widest font-mono block mb-2">TAKIM ADI</label>
        <input
          type="text"
          value={teamName || ""}
          onChange={(e) => setTeamName(e.target.value.slice(0, 24))}
          maxLength={24}
          placeholder="Örn: ANATOLİAN UNITED"
          data-testid="team-name-input"
          className="w-full bg-black/40 border border-white/15 focus:border-amber-300 outline-none rounded-md px-3 py-2 font-display text-2xl tracking-tight text-white placeholder:text-white/30"
        />
        <div className="text-[10px] text-white/40 mt-1 font-mono">{(teamName || "").length}/24</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(FORMATIONS).map((f) => {
          const active = selected === f.id;
          return (
            <motion.button
              key={f.id}
              type="button"
              onClick={() => { sound.click(); onSelect(f.id); }}
              data-testid={`formation-${f.id}`}
              whileHover={{ y: -3 }}
              className={`glass rounded-xl p-3 text-left transition-all ${active ? "ring-2 ring-amber-300" : "ring-1 ring-white/10"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl tracking-tight">{f.label}</h3>
                {active && <span className="text-amber-300 font-mono text-[10px] tracking-widest">✓</span>}
              </div>
              <p className="text-[10px] text-white/55 mb-2 leading-snug min-h-[28px]">{f.description}</p>
              <div className="max-w-[180px] mx-auto">
                <Pitch formationId={f.id} xi={[]} readOnly />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
