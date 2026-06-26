import React from "react";
import { motion } from "framer-motion";
import { TACTICS } from "../data/tactics";
import { Pitch } from "../components/Pitch";
import { Flame, Network, Shield } from "lucide-react";
import { sound } from "../engine/sounds";

const ICONS = { Flame, Network, Shield };

export const TacticsScreen = ({ formationId, xi, teamStats, tactic, setTactic, onContinue }) => {
  return (
    <div className="px-5 md:px-12 py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest mb-1">ADIM 3 / 4 · TAKTİK</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">SAVAŞ PLANINI KUR</h2>
          <p className="text-white/60 mt-2 max-w-xl">Tek bir taktik seç. Maç boyunca tüm karşılaşmalarda bu plan uygulanacak.</p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={!tactic}
          data-testid="tactics-continue-button"
          className="btn-primary disabled:opacity-50"
        >
          TURNUVAYA BAŞLA →
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Team summary */}
        <div className="lg:col-span-4 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 font-mono tracking-widest mb-2">DRAFT TAKIMIN</div>
          <div className="flex items-end gap-3 mb-3">
            <span className="font-display text-5xl text-amber-300" data-testid="team-overall">{teamStats?.overall || 0}</span>
            <span className="text-white/60 font-mono text-xs">OVR</span>
          </div>
          <Pitch formationId={formationId} xi={xi} compact />
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <Stat label="KLC" v={teamStats?.keeper} />
            <Stat label="DEF" v={teamStats?.defense} />
            <Stat label="ORT" v={teamStats?.midfield} />
            <Stat label="HÜC" v={teamStats?.attack} />
          </div>
        </div>

        {/* Tactic Cards */}
        <div className="lg:col-span-8 grid md:grid-cols-3 gap-4">
          {Object.values(TACTICS).map((t) => {
            const active = tactic === t.id;
            const Icon = ICONS[t.icon] || Flame;
            return (
              <motion.button
                key={t.id}
                type="button"
                onClick={() => { sound.click(); setTactic(t.id); }}
                whileHover={{ y: -4 }}
                data-testid={`tactic-${t.id}`}
                className={`text-left rounded-2xl p-5 glass border ${active ? "ring-2 ring-amber-300" : "border-white/10"}`}
                style={{ borderColor: active ? undefined : "rgba(255,255,255,0.08)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                     style={{ background: t.color + "22", color: t.color }}>
                  <Icon size={22} />
                </div>
                <h3 className="font-display text-2xl tracking-tight">{t.name}</h3>
                <div className="text-xs text-white/60 mt-1 mb-3">{t.tagline}</div>
                <p className="text-sm text-white/75 leading-relaxed">{t.description}</p>
                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-white/70">
                  <Mod label="HÜCUM" v={t.mods.attack} />
                  <Mod label="ORTA" v={t.mods.midfield} />
                  <Mod label="DEF" v={t.mods.defense} />
                  <Mod label="KALECİ" v={t.mods.keeper} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, v }) => (
  <div className="rounded-md py-1.5 bg-white/5">
    <div className="text-[9px] text-white/50 tracking-widest">{label}</div>
    <div className="font-display text-xl text-white">{v || 0}</div>
  </div>
);

const Mod = ({ label, v }) => (
  <div className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
    <span>{label}</span>
    <span className={v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-white/60"}>
      {v > 0 ? "+" : ""}{v}
    </span>
  </div>
);
