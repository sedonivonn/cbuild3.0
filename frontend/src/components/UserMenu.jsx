import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { sound } from "../engine/sounds";

// Small in-topbar user pill. When the user is signed out and Firebase is
// available, shows a GİRİŞ YAP button. When signed in, shows the avatar/
// name and a dropdown with logout.
export const UserMenu = ({ onOpenAuth }) => {
  const { authAvailable, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!authAvailable) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => { sound.click(); onOpenAuth && onOpenAuth(); }}
        data-testid="topbar-login-button"
        className="btn-ghost flex items-center gap-2 !py-1.5 !px-3 text-sm"
        title="Giriş yap"
      >
        <LogIn size={14} />
        <span>GİRİŞ YAP</span>
      </button>
    );
  }

  const initials = ((user.displayName || user.email || "?").trim()[0] || "?").toUpperCase();
  const label = user.displayName || user.email || "Hesap";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => { sound.click(); setOpen((v) => !v); }}
        data-testid="topbar-user-button"
        className={`btn-ghost flex items-center gap-2 !py-1.5 !px-2 text-sm ${open ? "ring-1 ring-amber-300/60" : ""}`}
        aria-expanded={open}
        title={label}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="kullanici avatari"
            className="w-6 h-6 rounded-full object-cover border border-white/15"
          />
        ) : (
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/15"
            style={{ background: "linear-gradient(135deg,#d4af37 0%,#a87f24 100%)", color: "#0e0e12" }}
          >
            {initials}
          </span>
        )}
        <span className="hidden md:inline max-w-[140px] truncate">{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#0e0e12]/95 backdrop-blur-xl p-3 shadow-2xl z-40"
            style={{ boxShadow: "0 18px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.18)" }}
            data-testid="topbar-user-menu"
          >
            <div className="flex items-center gap-2 px-1 pb-2 border-b border-white/5">
              <UserIcon size={14} className="text-white/60" />
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{label}</div>
                {user.email && (
                  <div className="text-[10px] text-white/50 truncate">{user.email}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                sound.click();
                setOpen(false);
                try { await logout(); } catch (_) { /* noop */ }
              }}
              data-testid="topbar-logout-button"
              className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-white/85 hover:bg-white/5 hover:text-white transition"
            >
              <LogOut size={14} />
              <span>ÇIKIŞ YAP</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
