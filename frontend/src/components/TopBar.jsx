import React from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { sound } from "../engine/sounds";

export const TopBar = ({ onSoundToggle, soundOn, onReset, title = "ULTIMATE CHAMPIONS LEAGUE DRAFT" }) => {
  return (
    <div className="w-full px-5 md:px-10 py-4 flex items-center justify-between border-b border-white/5 sticky top-0 z-30 glass">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center"
             style={{ background: "linear-gradient(135deg,#ff3b30 0%,#ff6347 100%)" }}>
          <span className="font-display text-white text-lg">UCL</span>
        </div>
        <div className="font-display text-sm md:text-lg tracking-widest text-white/90">{title}</div>
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
