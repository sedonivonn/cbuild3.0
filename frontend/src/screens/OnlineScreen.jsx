import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, LogIn, MessageSquare, Trophy, ArrowLeft, Clock } from "lucide-react";
import { sound } from "../engine/sounds";
import { createRoom, joinRoom, getRoom } from "../lib/onlineApi";

const MAX_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const PICK_OPTIONS = [15, 30, 45, 60];
const MODES = [
  { id: "group", label: "GRUP FORMATI" },
  { id: "league", label: "LİG FORMATI" },
];

/**
 * OnlineScreen — "ONLİNE KAPIŞMA" config UI.
 *
 * Two modes:
 *   1. Normal (`prefillCode` is falsy): full config with ODA KUR / KATIL tabs,
 *      max players, game mode, per-pick timer.
 *   2. Quick-join (`prefillCode` set): compact panel that ONLY asks for a
 *      nickname and jumps straight into the lobby — used when a user opens a
 *      shared `?room=CODE` link. If a saved nickname exists in localStorage,
 *      the join fires automatically on mount.
 *
 * Emits `onEnterLobby({ code, you })` on success.
 */
export const OnlineScreen = ({ onBack, onEnterLobby, prefillCode }) => {
  const [tab, setTab] = useState("create");
  const [nickname, setNickname] = useState(() => localStorage.getItem("cb_online_nick") || "");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [mode, setMode] = useState("group");
  const [pickSeconds, setPickSeconds] = useState(30);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [autoJoined, setAutoJoined] = useState(false);

  const nickTrim = nickname.trim();

  // Persist nickname so repeat visitors don't have to retype it.
  useEffect(() => {
    if (nickTrim.length >= 2) {
      try { localStorage.setItem("cb_online_nick", nickTrim); } catch (_) { /* storage unavailable */ }
    }
  }, [nickTrim]);

  const doJoin = async (roomCode, nick) => {
    setBusy(true); setErr(null);
    try {
      const cleaned = roomCode.trim().toUpperCase();
      await getRoom(cleaned); // 404 -> user-friendly error
      const { room, you } = await joinRoom(cleaned, nick);
      onEnterLobby({ code: room.code, you });
    } catch (e2) {
      setErr(e2.status === 404 ? "Oda bulunamadı" : (e2.message || "Katılamadın"));
    } finally { setBusy(false); }
  };

  // Auto-join if arriving via ?room=CODE with a saved nickname.
  useEffect(() => {
    if (prefillCode && nickTrim.length >= 2 && !autoJoined) {
      setAutoJoined(true);
      doJoin(prefillCode, nickTrim);
    }
    // Intentionally excluding doJoin from deps: it's stable enough for this one-shot.
  }, [prefillCode]);

  const canCreate = nickTrim.length >= 2 && !busy;
  const canJoin = nickTrim.length >= 2 && (prefillCode || code.trim().length >= 4) && !busy;

  const submitCreate = async (e) => {
    e?.preventDefault?.();
    if (!canCreate) return;
    setBusy(true); setErr(null);
    try {
      sound.click();
      const { room, you } = await createRoom({
        nickname: nickTrim,
        maxPlayers,
        mode,
        pickSeconds,
      });
      onEnterLobby({ code: room.code, you });
    } catch (e2) {
      setErr(e2.message || "Oda oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  const submitJoin = (e) => {
    e?.preventDefault?.();
    if (!canJoin) return;
    sound.click();
    doJoin(prefillCode || code, nickTrim);
  };

  // ------------------------------------------------------------------------
  // Quick-join layout — no tabs, no config, just nickname + big KATIL button.
  // ------------------------------------------------------------------------
  if (prefillCode) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-start justify-center px-5 md:px-12 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md"
        >
          <button
            type="button"
            onClick={() => { sound.click(); onBack?.(); }}
            className="mb-4 text-white/50 hover:text-white text-xs font-mono tracking-widest flex items-center gap-1"
            data-testid="online-back-button"
          >
            <ArrowLeft size={14} /> GERİ
          </button>

          <div className="text-center mb-6">
            <div className="text-[10px] font-mono tracking-[0.4em] text-white/45">ODAYA KATIL</div>
            <div
              className="mt-2 font-display text-5xl md:text-6xl tracking-[0.25em] text-white"
              style={{ textShadow: "0 0 24px rgba(255,59,48,0.35)" }}
              data-testid="quickjoin-code"
            >
              {prefillCode}
            </div>
          </div>

          <form onSubmit={submitJoin} className="rounded-2xl border border-white/10 bg-[#0e0e12]/70 backdrop-blur-xl p-5 md:p-6 space-y-5" data-testid="quickjoin-form">
            <div>
              <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">
                TAKMA ADIN
              </label>
              <input
                type="text"
                value={nickname}
                maxLength={16}
                autoFocus
                onChange={(e) => setNickname(e.target.value)}
                placeholder="örn. wave"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 font-display text-lg tracking-wider uppercase outline-none focus:border-[#ff3b30]/50 focus:bg-white/10 transition"
                data-testid="online-nickname-input"
              />
            </div>

            {err && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="online-error">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={!canJoin}
              className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="online-join-submit"
            >
              <LogIn size={18} />
              {busy ? "KATILIYOR..." : "ODAYA KATIL"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Default (host) layout — tabs, full config.
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-72px)] flex items-start justify-center px-5 md:px-12 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-xl"
      >
        <button
          type="button"
          onClick={() => { sound.click(); onBack?.(); }}
          className="mb-4 text-white/50 hover:text-white text-xs font-mono tracking-widest flex items-center gap-1"
          data-testid="online-back-button"
        >
          <ArrowLeft size={14} /> GERİ
        </button>

        <div className="text-center mb-2">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight text-white">
            ONLİNE <span style={{ color: "#ff3b30" }}>KAPIŞMA</span>
          </h1>
          <div className="mt-2 text-[11px] font-mono tracking-[0.35em] text-white/45 flex items-center justify-center gap-3">
            <MessageSquare size={12} /> MESAJLAŞ · ODA KUR · <Trophy size={12} /> LİG TABLOSU
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
          <TabButton
            active={tab === "create"}
            onClick={() => { sound.click(); setTab("create"); setErr(null); }}
            testid="online-tab-create"
          >
            <Plus size={16} /> ODA KUR
          </TabButton>
          <TabButton
            active={tab === "join"}
            onClick={() => { sound.click(); setTab("join"); setErr(null); }}
            testid="online-tab-join"
          >
            <LogIn size={16} /> KATIL
          </TabButton>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0e0e12]/70 backdrop-blur-xl p-5 md:p-6">
          {/* Nickname (shared between both tabs) */}
          <div className="mb-5">
            <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">
              TAKMA ADIN
            </label>
            <input
              type="text"
              value={nickname}
              maxLength={16}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="örn. wave"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 font-display text-lg tracking-wider uppercase outline-none focus:border-[#ff3b30]/50 focus:bg-white/10 transition"
              data-testid="online-nickname-input"
            />
          </div>

          {tab === "create" && (
            <form onSubmit={submitCreate} className="space-y-5" data-testid="online-create-form">
              <div>
                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">
                  MAX OYUNCU
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {MAX_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { sound.click(); setMaxPlayers(n); }}
                      className={`py-2.5 rounded-md font-display text-lg tracking-wide transition-all border ${
                        maxPlayers === n
                          ? "bg-[#ff3b30] border-[#ff3b30] text-white shadow-[0_6px_18px_rgba(255,59,48,0.35)]"
                          : "bg-white/[0.04] border-white/10 text-white/70 hover:border-white/25"
                      }`}
                      data-testid={`online-max-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2 flex items-center gap-1.5">
                  <Clock size={11} /> OYUNCU BAŞINA SÜRE
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PICK_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { sound.click(); setPickSeconds(s); }}
                      className={`py-3 rounded-md font-display text-lg tracking-widest transition-all border ${
                        pickSeconds === s
                          ? "bg-[#ff3b30] border-[#ff3b30] text-white shadow-[0_6px_18px_rgba(255,59,48,0.35)]"
                          : "bg-white/[0.04] border-white/10 text-white/70 hover:border-white/25"
                      }`}
                      data-testid={`online-pick-${s}`}
                    >
                      {s} SN
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">
                  OYUN MODU
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { sound.click(); setMode(m.id); }}
                      className={`py-3 rounded-md font-display text-lg tracking-widest transition-all border ${
                        mode === m.id
                          ? "bg-[#ff3b30] border-[#ff3b30] text-white shadow-[0_6px_18px_rgba(255,59,48,0.35)]"
                          : "bg-white/[0.04] border-white/10 text-white/70 hover:border-white/25"
                      }`}
                      data-testid={`online-mode-${m.id}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {err && (
                <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="online-error">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={!canCreate}
                className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="online-create-submit"
              >
                <Plus size={18} />
                {busy ? "OLUŞTURULUYOR..." : "ODA KUR"}
              </button>
            </form>
          )}

          {tab === "join" && (
            <form onSubmit={submitJoin} className="space-y-5" data-testid="online-join-form">
              <div>
                <label className="block font-mono text-[10px] tracking-[0.3em] text-white/50 mb-2">
                  ODA KODU
                </label>
                <input
                  type="text"
                  value={code}
                  maxLength={8}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="örn. SNBTT3"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-white placeholder-white/25 font-display text-3xl tracking-[0.35em] uppercase outline-none focus:border-[#ff3b30]/50 focus:bg-white/10 transition"
                  data-testid="online-join-code-input"
                />
              </div>

              {err && (
                <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="online-error">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={!canJoin}
                className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="online-join-submit"
              >
                <LogIn size={18} />
                {busy ? "KATILIYOR..." : "ODAYA KATIL"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const TabButton = ({ active, onClick, children, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-display text-lg tracking-widest transition-all ${
      active
        ? "bg-[#ff3b30] text-white shadow-[0_6px_18px_rgba(255,59,48,0.35)]"
        : "bg-transparent text-white/60 hover:text-white"
    }`}
  >
    {children}
  </button>
);
