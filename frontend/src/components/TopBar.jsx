import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { sound } from "../engine/sounds";
import { UserMenu } from "./UserMenu";

export const TopBar = ({ onSoundToggle, soundOn, onReset, onLogoClick, onOpenAuth, title }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close the confirmation panel on outside click or Escape.
  useEffect(() => {
    if (!confirmOpen) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setConfirmOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setConfirmOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirmOpen]);

  return (
    <div className="w-full px-5 md:px-10 py-4 flex items-center justify-between border-b border-white/5 sticky top-0 z-30 glass">
      <div className="flex items-center gap-3 ml-2 md:ml-4">
        <button
          type="button"
          onClick={() => { sound.click(); onLogoClick && onLogoClick(); }}
          className="px-4 h-12 rounded-md flex items-center justify-center border border-white/10 bg-black/70 transition-all hover:brightness-125 hover:border-amber-300/40 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
          style={{ boxShadow: "0 0 14px rgba(212,175,55,0.2), inset 0 0 7px rgba(212,175,55,0.07)" }}
          title="Ana sayfaya dön"
          data-testid="topbar-logo-button"
        >
          <span className="font-display text-xl leading-none tracking-tight flex items-baseline">
            <span style={{ color: "#d4af37", textShadow: "0 0 7px rgba(212,175,55,0.4)" }}>champions</span>
            <span className="text-white ml-1">build</span>
          </span>
        </button>
        {title ? (
          <div className="font-display text-sm md:text-lg tracking-widest text-white/90">{title}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <UserMenu onOpenAuth={onOpenAuth} />
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

        <div ref={wrapperRef} className="relative">
          <button
            type="button"
            onClick={() => { sound.click(); setConfirmOpen((v) => !v); }}
            data-testid="reset-button"
            aria-expanded={confirmOpen}
            className={`btn-ghost flex items-center gap-2 !py-1.5 !px-3 text-sm ${confirmOpen ? "ring-1 ring-amber-300/60" : ""}`}
            title="Sıfırla"
          >
            <RotateCcw size={16} />
            <span>SIFIRLA</span>
          </button>

          <AnimatePresence>
            {confirmOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0e0e12]/95 backdrop-blur-xl p-4 shadow-2xl z-40"
                style={{ boxShadow: "0 18px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.18)" }}
                data-testid="reset-confirm-panel"
              >
                <div className="font-display text-base tracking-wide text-white">
                  Emin misin?
                </div>
                <p className="mt-1 text-[12px] text-white/65 leading-relaxed">
                  Tüm ilerlemeni sıfırlayıp ana ekrana döner. Bu işlem geri alınamaz.
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { sound.click(); setConfirmOpen(false); }}
                    data-testid="reset-cancel-button"
                    className="btn-ghost !py-1.5 !px-3 text-xs"
                  >
                    VAZGEÇ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.click();
                      setConfirmOpen(false);
                      onReset && onReset();
                    }}
                    data-testid="reset-confirm-button"
                    className="btn-primary !py-1.5 !px-3 text-xs"
                  >
                    EVET, SIFIRLA
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
