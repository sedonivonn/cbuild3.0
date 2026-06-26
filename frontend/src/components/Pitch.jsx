import React from "react";
import { FORMATIONS } from "../data/formations";

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export const Pitch = ({ formationId, xi = [], onSlotClick = () => {}, activeSlotIndex = -1, compact = false }) => {
  const formation = FORMATIONS[formationId];
  if (!formation) return null;
  return (
    <div className={`pitch w-full ${compact ? "aspect-[3/4]" : "aspect-[3/4]"} max-w-[480px] mx-auto`} data-testid="pitch-container">
      {formation.slots.map((slot, idx) => {
        const player = xi[idx];
        const active = idx === activeSlotIndex;
        return (
          <button
            key={slot.id + idx}
            type="button"
            onClick={() => onSlotClick(idx, slot)}
            data-testid={`pitch-slot-${idx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
            style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
          >
            <div
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex flex-col items-center justify-center font-bold transition-all ${
                active ? "ring-2 ring-amber-300 scale-110" : ""
              }`}
              style={{
                background: player ? "linear-gradient(160deg,#1c1c20 0%,#36363c 100%)" : "rgba(0,0,0,0.35)",
                border: player ? "2px solid rgba(255,215,0,0.6)" : "2px dashed rgba(255,255,255,0.35)",
                boxShadow: player ? "0 6px 16px rgba(0,0,0,0.5)" : "none",
              }}
            >
              {player ? (
                <>
                  <span className="text-[10px] leading-none text-amber-300 font-mono">{player.overall}</span>
                  <span className="text-[10px] leading-tight text-white mt-0.5">{initials(player.name)}</span>
                </>
              ) : (
                <span className="text-[10px] text-white/80 font-display tracking-wider">{slot.pos}</span>
              )}
            </div>
            <div className="text-[10px] text-white/90 text-center mt-1 font-display tracking-wider">{slot.pos}</div>
          </button>
        );
      })}
    </div>
  );
};
