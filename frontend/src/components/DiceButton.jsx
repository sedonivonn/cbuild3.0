import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dices } from "lucide-react";

export const DiceButton = ({ onRoll, disabled, label = "ROLL DICE", testId = "roll-dice-button" }) => {
  const [tumble, setTumble] = useState(false);
  const handleClick = () => {
    if (disabled) return;
    setTumble(true);
    setTimeout(() => setTumble(false), 1200);
    onRoll && onRoll();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId}
      className="btn-primary flex items-center gap-3 disabled:cursor-not-allowed"
    >
      <motion.span
        className={`inline-flex ${tumble ? "dice-tumbling" : ""}`}
        style={{ display: "inline-flex" }}
      >
        <Dices size={28} />
      </motion.span>
      <span>{label}</span>
    </button>
  );
};
