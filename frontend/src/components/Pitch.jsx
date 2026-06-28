import React from "react";
import { FORMATIONS } from "../data/formations";
import { effOverall } from "../data/ballonDor";

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export const Pitch = ({
  formationId,
  xi = [],
  onSlotClick = () => {},
  activeSlotIndex = -1,
  compact = false,
  readOnly = false,
  slotHints = null, // array of "fit"|"blocked"|"filled"|null
  interactive = true,
}) => {
  const formation = FORMATIONS[formationId];
  if (!formation) return null;
  const Tag = readOnly ? "div" : "button";

  const circleClass = readOnly
    ? "w-7 h-7 md:w-8 md:h-8 text-[8px]"
    : "w-12 h-12 md:w-14 md:h-14 text-[11px]";
  const labelClass = readOnly ? "text-[8px] mt-0.5" : "text-[10px] mt-1";
  // Larger hit area for easier tapping. p-3 gives ~24px of extra clickable radius.
  const hitArea = readOnly ? "" : "p-3 -m-3";

  return (
    <div className={`pitch w-full ${compact ? "aspect-[3/4]" : "aspect-[3/4]"} max-w-[480px] mx-auto`} data-testid="pitch-container">
      {formation.slots.map((slot, idx) => {
        const player = xi[idx];
        const active = idx === activeSlotIndex;
        const hint = slotHints ? slotHints[idx] : null;
        let borderStyle, glow, dim = false, clickable = true;
        if (player) {
          borderStyle = "2px solid rgba(255,215,0,0.6)";
          glow = "0 6px 16px rgba(0,0,0,0.5)";
          // Yerleşen oyuncu kalıcıdır; slot tıklanamaz.
          clickable = false;
        } else if (hint === "fit") {
          borderStyle = "2px solid #34d399";
          glow = "0 0 12px rgba(52,211,153,0.55)";
        } else if (hint === "blocked") {
          borderStyle = "2px solid rgba(248,113,113,0.5)";
          glow = "none";
          dim = true;
          clickable = false;
        } else {
          borderStyle = "2px dashed rgba(255,255,255,0.35)";
          glow = "none";
        }
        const interactiveProps = readOnly
          ? {}
          : {
              type: "button",
              onClick: () => interactive && clickable && onSlotClick(idx, slot),
              disabled: !interactive || !clickable,
              "data-testid": `pitch-slot-${idx}`,
            };
        return (
          <div
            key={slot.id + idx}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
          >
            <Tag
              {...interactiveProps}
              className={`relative block ${hitArea} ${
                (!interactive || !clickable) && !readOnly ? "cursor-not-allowed" : ""
              }`}
              style={{ opacity: dim ? 0.55 : 1 }}
            >
              <div
                className={`${circleClass} rounded-full flex flex-col items-center justify-center font-bold transition-all ${
                  active ? "ring-2 ring-amber-300 scale-110" : ""
                }`}
                style={{
                  background: player ? "linear-gradient(160deg,#1c1c20 0%,#36363c 100%)" : "rgba(0,0,0,0.35)",
                  border: borderStyle,
                  boxShadow: glow,
                }}
              >
                {player ? (
                  <>
                    <span className="leading-none text-amber-300 font-mono">{effOverall(player, player._season)}</span>
                    <span className="leading-tight text-white mt-0.5">{initials(player.name)}</span>
                  </>
                ) : (
                  <span className="text-white/80 font-display tracking-wider">{slot.pos}</span>
                )}
              </div>
              <div className={`${labelClass} text-white/90 text-center font-display tracking-wider`}>
                {player ? <span className="text-amber-200">{slot.pos}</span> : slot.pos}
              </div>
            </Tag>
          </div>
        );
      })}
    </div>
  );
};
