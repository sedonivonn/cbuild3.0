import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { TACTICS } from "../data/tactics";
import { Pitch } from "../components/Pitch";
import { Flame, Network, Shield, Plus, Minus } from "lucide-react";
import { sound } from "../engine/sounds";
import { analyzeTactic } from "../engine/tacticAnalysis";

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
          <Pitch formationId={formationId} xi={xi} compact readOnly />
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <Stat label="KLC" v={teamStats?.keeper} />
            <Stat label="DEF" v={teamStats?.defense} />
            <Stat label="ORT" v={teamStats?.midfield} />
            <Stat label="HÜC" v={teamStats?.attack} />
          </div>
        </div>

        {/* Tactic Cards */}
        <div className="lg:col-span-8 grid md:grid-cols-3 gap-4">
          {Object.values(TACTICS).map((t) => (
            <TacticCard
              key={t.id}
              tactic={t}
              active={tactic === t.id}
              teamStats={teamStats}
              onSelect={() => { sound.click(); setTactic(t.id); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const TacticCard = ({ tactic, active, teamStats, onSelect }) => {
  const Icon = ICONS[tactic.icon] || Flame;
  const analysis = useMemo(() => analyzeTactic(teamStats, tactic.id), [teamStats, tactic.id]);
  const pros = analysis.filter((a) => a.sign === "+");
  const cons = analysis.filter((a) => a.sign === "-");
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -4 }}
      data-testid={`tactic-${tactic.id}`}
      className={`text-left rounded-2xl p-5 glass border ${active ? "ring-2 ring-amber-300" : "border-white/10"}`}
      style={{ borderColor: active ? undefined : "rgba(255,255,255,0.08)" }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
           style={{ background: tactic.color + "22", color: tactic.color }}>
        <Icon size={22} />
      </div>
      <h3 className="font-display text-2xl tracking-tight">{tactic.name}</h3>
      <div className="text-xs text-white/60 mt-1 mb-3">{tactic.tagline}</div>
      <p className="text-sm text-white/75 leading-relaxed">{tactic.description}</p>

      {/* Base mod table */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-white/70">
        <Mod label="HÜCUM" v={tactic.mods.attack} />
        <Mod label="ORTA" v={tactic.mods.midfield} />
        <Mod label="DEF" v={tactic.mods.defense} />
        <Mod label="KALECİ" v={tactic.mods.keeper} />
      </div>

      {/* DYNAMIC analysis tailored to user XI */}
      {(pros.length > 0 || cons.length > 0) && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="text-[10px] text-white/40 tracking-widest font-mono mb-2">KADRONA GÖRE</div>
          <div className="space-y-1.5">
            {pros.map((p, i) => (
              <div key={`p${i}`} className="flex items-start gap-2 text-[11px] leading-snug text-emerald-300" data-testid={`tactic-${tactic.id}-pro-${i}`}>
                <Plus size={12} className="mt-0.5 shrink-0" />
                <span>{p.text}</span>
              </div>
            ))}
            {cons.map((c, i) => (
              <div key={`c${i}`} className="flex items-start gap-2 text-[11px] leading-snug text-red-300" data-testid={`tactic-${tactic.id}-con-${i}`}>
                <Minus size={12} className="mt-0.5 shrink-0" />
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.button>
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
