import React from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { sound } from "../engine/sounds";

export const TopBar = ({ onSoundToggle, soundOn, onReset, title }) => {
  return (
    <div className="w-full px-5 md:px-10 py-4 flex items-center justify-between border-b border-white/5 sticky top-0 z-30 glass">
      <div className="flex items-center gap-3 ml-2 md:ml-4">
        <div
          className="px-3 h-11 min-w-[56px] rounded-md flex items-center justify-center border border-white/10 bg-black/70"
          style={{ boxShadow: "0 0 14px rgba(212,175,55,0.2), inset 0 0 7px rgba(212,175,55,0.07)" }}
          title="13-0"
        >
          <span className="font-display text-xl leading-none tracking-tight flex items-baseline">
            <span style={{ color: "#d4af37", textShadow: "0 0 7px rgba(212,175,55,0.4)" }}>13</span>
            <span className="text-white">-0</span>
          </span>
        </div>
        {title ? (
          <div className="font-display text-sm md:text-lg tracking-widest text-white/90">{title}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { sound.click(); onSoundToggle && onSoundToggle(); }}
          data-testid="sound-toggle-button"
          className="btn-ghost flex items-center gap-2 !py-1.5 !px-3 text-sm"
          title={soundOn ? "Sesi kapat" : "Sesi aç"}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span>{soundOn ? "SES" : "SESSİZ"}</span>
        </button>
        <button
          type="button"
          onClick={() => { sound.click(); onReset && onReset(); }}
          data-testid="reset-button"
          className="btn-ghost flex items-center gap-2 !py-1.5 !px-3 text-sm"
          title="Sıfırla"
        >
          <RotateCcw size={16} />
          <span>SIFIRLA</span>
        </button>
      </div>
    </div>
  );
};
