import React from "react";
import { motion } from "framer-motion";
import { FORMATIONS, applyTacticShift } from "../data/formations";
import { effOverall, isBallonDorSeason } from "../data/ballonDor";

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// Map a player to their card tier color (matches PlayerCard tier styling).
function tierBorderColor(player, season) {
  if (isBallonDorSeason(player.name, season)) return "rgba(20,20,20,0.95)"; // black icon
  const o = effOverall(player, season);
  if (o >= 99) return "rgba(255,107,53,0.95)";  // ballon d'or 99 — orange/red
  if (o >= 90) return "rgba(168,85,247,0.9)";    // purple
  if (o >= 81) return "rgba(245,197,66,0.9)";    // gold
  if (o >= 70) return "rgba(190,190,200,0.85)";  // silver
  return "rgba(205,127,50,0.9)";                  // bronze
}

function tierTextColor(player, season) {
  if (isBallonDorSeason(player.name, season)) return "text-white";
  const o = effOverall(player, season);
  if (o >= 99) return "text-orange-300";
  if (o >= 90) return "text-purple-300";
  if (o >= 81) return "text-amber-300";
  if (o >= 70) return "text-slate-200";
  return "text-orange-400";
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
  tactic = null, // shifts slot positions on the pitch based on tactical style
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
      {formation.slots.map((rawSlot, idx) => {
        const slot = applyTacticShift(rawSlot, tactic, formationId);
        const labelPos = slot.displayPos || slot.pos;
        const player = xi[idx];
        const active = idx === activeSlotIndex;
        const hint = slotHints ? slotHints[idx] : null;
        let borderStyle, glow, dim = false, clickable = true;
        if (player) {
          const tierColor = tierBorderColor(player, player._season);
          borderStyle = `2px solid ${tierColor}`;
          glow = `0 6px 16px rgba(0,0,0,0.5), 0 0 14px ${tierColor.replace(/[\d.]+\)$/, "0.5)")}`;
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
          <motion.div
            // STABLE KEY: use only idx so React re-uses the same DOM node when
            // formation changes. That lets `top`/`left` transition smoothly.
            // initial={false} → render at destination on mount, no jump.
            // We animate top/left only (no transform-based props) so the
            // Tailwind `-translate-x-1/2 -translate-y-1/2` keeps each slot
            // visually centered on its anchor point.
            key={idx}
            initial={false}
            animate={{ top: `${slot.top}%`, left: `${slot.left}%` }}
            transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.6 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
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
                    <span className={`leading-none font-mono ${tierTextColor(player, player._season)}`}>{effOverall(player, player._season)}</span>
                    <span className="leading-tight text-white mt-0.5">{initials(player.name)}</span>
                  </>
                ) : (
                  <span className="text-white/80 font-display tracking-wider">{labelPos}</span>
                )}
              </div>
              <div className={`${labelClass} text-white/90 text-center font-display tracking-wider`}>
                {player ? <span className={tierTextColor(player, player._season)}>{labelPos}</span> : labelPos}
              </div>
            </Tag>
          </motion.div>
        );
      })}
    </div>
  );
};
