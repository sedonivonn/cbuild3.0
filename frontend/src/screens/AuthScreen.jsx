import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, UserPlus, X, Mail, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { sound } from "../engine/sounds";

// Modal login/register screen. Mounted from App.js as an overlay when the
// user clicks GİRİŞ YAP in the TopBar. Style follows the existing glass/gold
// language of the app.
export const AuthScreen = ({ onClose }) => {
  const {
    authAvailable,
    error,
    clearError,
    registerEmail,
    loginEmail,
    loginGoogle,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    clearError();
    setInfo(null);
  }, [mode, clearError]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setInfo(null);
    try {
      if (mode === "login") {
        await loginEmail(email.trim(), password);
        onClose && onClose();
      } else if (mode === "register") {
        await registerEmail(email.trim(), password, name.trim() || null);
        onClose && onClose();
      } else {
        await resetPassword(email.trim());
        setInfo("Şifre sıfırlama e-postası gönderildi.");
      }
    } catch (_) {
      /* error surfaced via useAuth().error */
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await loginGoogle();
      onClose && onClose();
    } catch (_) {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const titleFor = mode === "login" ? "GİRİŞ YAP" : mode === "register" ? "HESAP OLUŞTUR" : "ŞİFREMİ SIFIRLA";

  return (
    <AnimatePresence>
      <motion.div
        key="auth-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onClose && onClose()}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        data-testid="auth-modal-backdrop"
      >
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e12]/95 backdrop-blur-xl p-6 shadow-2xl relative"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.2)" }}
          data-testid="auth-modal"
        >
          <button
            type="button"
            onClick={() => { sound.click(); onClose && onClose(); }}
            className="absolute right-3 top-3 text-white/60 hover:text-white transition"
            data-testid="auth-close-button"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>

          <div className="font-display text-xl tracking-tight">
            <span style={{ color: "#d4af37" }}>champions</span>
            <span className="text-white">build</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-white/50">
            {titleFor}
          </div>

          {!authAvailable ? (
            <div className="mt-6 rounded-lg border border-amber-300/25 bg-amber-500/5 p-3 text-sm text-amber-200">
              Firebase yapılandırılmamış. `.env` dosyasına REACT_APP_FIREBASE_*
              değerlerini ekleyip frontend&apos;i yeniden başlat.
            </div>
          ) : (
            <>
              <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
                {mode === "register" && (
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <UserIcon size={14} className="text-white/50" />
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Ad (opsiyonel)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                      data-testid="auth-name-input"
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <Mail size={14} className="text-white/50" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="E-posta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                    data-testid="auth-email-input"
                  />
                </label>
                {mode !== "reset" && (
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <Lock size={14} className="text-white/50" />
                    <input
                      type="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      placeholder="Şifre (en az 6 karakter)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                      data-testid="auth-password-input"
                    />
                  </label>
                )}

                {error && (
                  <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="auth-error">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" data-testid="auth-info">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary !py-2 mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="auth-submit-button"
                >
                  {mode === "login" && <LogIn size={16} />}
                  {mode === "register" && <UserPlus size={16} />}
                  <span>
                    {busy ? "..." : mode === "login" ? "GİRİŞ YAP" : mode === "register" ? "KAYIT OL" : "SIFIRLAMA GÖNDER"}
                  </span>
                </button>
              </form>

              {mode !== "reset" && (
                <>
                  <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
                    <div className="h-px flex-1 bg-white/10" />
                    <span>VEYA</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/15 bg-white text-black px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition disabled:opacity-60"
                    data-testid="auth-google-button"
                  >
                    <GoogleIcon />
                    <span>Google ile devam et</span>
                  </button>
                </>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                {mode === "login" ? (
                  <>
                    <button type="button" className="hover:text-amber-300 transition" onClick={() => setMode("reset")} data-testid="auth-goto-reset">
                      Şifremi unuttum
                    </button>
                    <button type="button" className="hover:text-amber-300 transition" onClick={() => setMode("register")} data-testid="auth-goto-register">
                      Hesap oluştur →
                    </button>
                  </>
                ) : (
                  <button type="button" className="hover:text-amber-300 transition" onClick={() => setMode("login")} data-testid="auth-goto-login">
                    ← Girişe dön
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.3l-6.2-5.2C29.3 34.7 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.3 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);
