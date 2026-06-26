import React from "react";
import { motion } from "framer-motion";

function tierClass(o) {
  if (o >= 99) return "tier-ballondor";
  if (o >= 95) return "tier-icon";
  if (o >= 89) return "tier-gold";
  if (o >= 80) return "tier-silver";
  return "tier-bronze";
}

export const PlayerCard = ({ player, season, club, crest, country, size = "md", onClick, selected = false, disabled = false, testId }) => {
  if (!player) return null;
  const tier = tierClass(player.overall);
  // Slightly larger cards so full name fits
  const sizes = {
    sm: "w-36",
    md: "w-44",
    lg: "w-56",
  };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      initial={{ opacity: 0, y: 12, rotateY: -20 }}
      animate={{ opacity: disabled ? 0.4 : 1, y: 0, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      whileHover={!disabled ? { y: -6 } : {}}
      className={`fut-card ${tier} ${sizes[size]} ${selected ? "ring-2 ring-amber-300" : ""} ${disabled ? "cursor-not-allowed grayscale" : ""} relative flex flex-col text-left`}
      style={{ flexShrink: 0 }}
    >
      <div className="shine" />
      {/* Header */}
      <div className="flex justify-between items-start px-3 pt-2">
        <div className="flex flex-col leading-tight">
          <span className="font-display text-3xl text-white drop-shadow">{player.overall}</span>
          <span className="font-display text-sm tracking-wider text-white/85">{player.primary}</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] text-white/85 block">{season}</span>
          <span className="font-display text-base text-white">{crest}</span>
        </div>
      </div>

      {/* Name front and center */}
      <div className="flex-1 flex items-center justify-center px-2 py-2">
        <div
          className="text-center font-display text-white leading-tight w-full"
          style={{
            fontSize: player.name.length > 22 ? "12px" : player.name.length > 18 ? "13px" : player.name.length > 14 ? "15px" : "18px",
            textShadow: "0 2px 6px rgba(0,0,0,0.55)",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            lineHeight: "1.05",
            letterSpacing: "0.02em",
          }}
          title={player.name}
        >
          {player.name.toUpperCase()}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 mt-auto">
        <div className="flex justify-between items-center gap-2 text-[10px] text-white/90 leading-tight">
          <span className="font-medium truncate min-w-0" title={club}>{club}</span>
          <span className="shrink-0 text-[12px]">{player.nationality || country}</span>
        </div>
        <div className="mt-0.5 text-[9px] text-white/70 tracking-wider">
          2nd: {player.secondary || "—"}
        </div>
      </div>

      {player.overall >= 99 && (
        <div className="absolute top-1 left-1 right-1 mx-auto w-fit px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
             style={{ background: "#FFD700", color: "#000" }}>
          BALLON D'OR
        </div>
      )}
    </motion.button>
  );
};
