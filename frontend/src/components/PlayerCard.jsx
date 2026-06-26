import React from "react";
import { motion } from "framer-motion";

function tierClass(o) {
  if (o >= 99) return "tier-ballondor";
  if (o >= 95) return "tier-icon";
  if (o >= 89) return "tier-gold";
  if (o >= 80) return "tier-silver";
  return "tier-bronze";
}

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export const PlayerCard = ({ player, season, club, crest, country, size = "md", onClick, selected = false, testId }) => {
  if (!player) return null;
  const tier = tierClass(player.overall);
  const sizes = {
    sm: "w-28",
    md: "w-40",
    lg: "w-56",
  };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      data-testid={testId}
      initial={{ opacity: 0, y: 12, rotateY: -20 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      whileHover={{ y: -6 }}
      className={`fut-card ${tier} ${sizes[size]} ${selected ? "ring-2 ring-amber-300" : ""} relative flex flex-col text-left`}
      style={{ flexShrink: 0 }}
    >
      <div className="shine" />
      {/* Header */}
      <div className="flex justify-between items-start p-2 pl-3 pr-3">
        <div className="flex flex-col leading-tight">
          <span className="font-display text-2xl text-white drop-shadow">{player.overall}</span>
          <span className="font-display text-sm tracking-wider text-white/85">{player.primary}</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] text-white/80 block">{season}</span>
          <span className="font-display text-sm text-white">{crest}</span>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex-1 flex items-center justify-center -mt-1">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
             style={{ background: "rgba(0,0,0,0.35)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)" }}>
          <span className="font-display text-3xl md:text-4xl text-white">{initials(player.name)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 px-3 mt-auto">
        <div className="text-[11px] uppercase tracking-wider text-white/95 font-bold leading-tight truncate">
          {player.name}
        </div>
        <div className="flex justify-between items-center mt-1 text-[10px] text-white/80">
          <span className="truncate max-w-[60%]">{club}</span>
          <span>{player.nationality || country}</span>
        </div>
      </div>

      {player.overall >= 99 && (
        <div className="absolute top-1 right-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
             style={{ background: "#FFD700", color: "#000" }}>
          BALLON D'OR
        </div>
      )}
    </motion.button>
  );
};
