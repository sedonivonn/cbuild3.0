import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock, RefreshCw, Sparkles, Users, Wifi, WifiOff, Check, Crown, Play, Loader2,
} from "lucide-react";
import { FORMATIONS, canPlace } from "../data/formations";
import { sound } from "../engine/sounds";
import { useRoomSocket } from "../hooks/useRoomSocket";
import {
  getRoom, gamePick, gameChange, gameStartTournament, leaveRoom,
} from "../lib/onlineApi";
import { Pitch } from "../components/Pitch";

/**
 * OnlineDraftScreen — server-authoritative multiplayer draft.
 *
 * Everything on this screen is a *view* of `room.game` pushed by the
 * server over WebSocket. Local actions (pick / change) are RPCs that
 * fire and forget — the server broadcasts the resulting state back and
 * the UI re-renders from that snapshot.
 *
 * Sections:
 *   - Top: live progress board (every player's X/11)
 *   - Middle-left: current rolled team + player cards
 *   - Middle-right: mini pitch with filled slots (highlights legal drops)
 *   - Bottom: change / lucky change buttons + timer
 *   - Overlay: "waiting for others" once you finish your 11 picks
 *   - Overlay: "waiting for host to start tournament" once ALL finish
 */
export const OnlineDraftScreen = ({ code, me, onLeave, onTournamentStart }) => {
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0); // seconds until deadline
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);

  // Initial REST fetch so the UI paints instantly.
  useEffect(() => {
    let ok = true;
    getRoom(code).then((r) => { if (ok) setRoom(r.room); })
      .catch((e) => setErr(e.message || "Oda bulunamadı"));
    return () => { ok = false; };
  }, [code]);

  const handleState = useCallback((r) => {
    setRoom(r);
    if (r?.game?.phase === "tournament" && onTournamentStart) {
      onTournamentStart(r);
    }
  }, [onTournamentStart]);

  const handleMsg = useCallback((m) => {
    if (m?.type === "closed") {
      setErr("Ev sahibi odayı kapattı");
      setTimeout(() => onLeave?.(), 1200);
    }
  }, [onLeave]);

  const { status: wsStatus } = useRoomSocket(code, me?.id, handleState, handleMsg);

  const game = room?.game || {};
  const drafts = game.drafts || {};
  const myDraft = drafts[me?.id];
  const players = room?.players || [];
  const isHost = room?.host_id === me?.id;
  const phase = game.phase;
  const allComplete = phase === "draft_complete";
  const canStartTournament = isHost && allComplete;
  const formation = FORMATIONS[myDraft?.formation_id || "4-3-3"];
  const xi = myDraft?.xi || [];
  const pickedNames = useMemo(
    () => new Set((myDraft?.picked_names) || []),
    [myDraft?.picked_names]
  );

  // Live countdown driven from server-issued `deadline` ISO string. We poll
  // once per second locally but the SERVER is the timer authority — if the
  // client's clock drifts, the server auto-picks anyway when its own timer
  // fires and pushes the updated state.
  useEffect(() => {
    if (!myDraft?.deadline || myDraft.complete) { setRemaining(0); return undefined; }
    const tick = () => {
      const ms = new Date(myDraft.deadline).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [myDraft?.deadline, myDraft?.complete]);

  // Reset selection when the roll changes.
  useEffect(() => { setSelectedPlayerName(null); }, [myDraft?.current_roll?.team?.club, myDraft?.current_roll?.season]);

  const sortedPool = useMemo(() => {
    const t = myDraft?.current_roll?.team;
    if (!t?.players) return [];
    const list = [...t.players].sort((a, b) => (b.overall || 0) - (a.overall || 0));
    return list.map((p) => {
      const alreadyPicked = pickedNames.has(p.name);
      const placeable = !alreadyPicked && formation.slots.some((s, i) => !xi[i] && canPlace(s.pos, p));
      return { ...p, _placeable: placeable, _alreadyPicked: alreadyPicked };
    });
  }, [myDraft?.current_roll, pickedNames, formation, xi]);

  const selectedPlayer = useMemo(
    () => sortedPool.find((p) => p.name === selectedPlayerName),
    [sortedPool, selectedPlayerName]
  );

  const slotHints = useMemo(() => {
    if (!selectedPlayer) return null;
    return formation.slots.map((slot, idx) => {
      if (xi[idx]) return "filled";
      if (canPlace(slot.pos, selectedPlayer)) return "fit";
      return "blocked";
    });
  }, [selectedPlayer, formation, xi]);

  const handlePick = async (slotIdx) => {
    if (!selectedPlayer || busy || myDraft?.complete) { sound.error(); return; }
    if (xi[slotIdx]) { sound.error(); return; }
    if (!canPlace(formation.slots[slotIdx].pos, selectedPlayer)) { sound.error(); return; }
    setBusy(true); setErr(null);
    try {
      sound.click();
      await gamePick(code, { playerId: me.id, slotIndex: slotIdx, playerName: selectedPlayer.name });
      setSelectedPlayerName(null);
    } catch (e) {
      setErr(e.message || "Seçim reddedildi");
    } finally { setBusy(false); }
  };

  const handleChange = async (lucky) => {
    if (busy || myDraft?.complete) return;
    if ((myDraft?.changes_remaining || 0) <= 0) { sound.error(); return; }
    setBusy(true); setErr(null);
    try {
      sound.dice();
      await gameChange(code, { playerId: me.id, lucky: !!lucky });
    } catch (e) {
      setErr(e.message || "Değiştirilemedi");
    } finally { setBusy(false); }
  };

  const handleStartTournament = async () => {
    if (busy || !canStartTournament) return;
    setBusy(true); setErr(null);
    try {
      sound.click();
      await gameStartTournament(code, me.id);
    } catch (e) {
      setErr(e.message || "Turnuva başlatılamadı");
    } finally { setBusy(false); }
  };

  const handleLeave = async () => {
    try { await leaveRoom(code, me.id).catch(() => {}); } catch (_) { /* noop */ }
    onLeave?.();
  };

  if (!room) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/50 font-mono tracking-widest text-sm">
        <Loader2 className="animate-spin mr-2" size={16} /> ODA YÜKLENİYOR...
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-5 max-w-[1500px] mx-auto">
      {/* -------- Progress board (all players) ---------------------------- */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.3em] text-white/60">
            <Users size={12} /> DRAFT DURUMU
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-white/50">
            {wsStatus === "open"
              ? (<><Wifi size={12} className="text-emerald-400" /> CANLI</>)
              : (<><WifiOff size={12} className="text-amber-400" /> {wsStatus.toUpperCase()}</>)}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {players.map((p) => {
            const d = drafts[p.id];
            const filled = d ? d.xi.filter(Boolean).length : 0;
            const total = d ? d.xi.length : 11;
            const isMe = p.id === me.id;
            const done = d?.complete;
            return (
              <div
                key={p.id}
                className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
                  isMe ? "border-[#ff3b30]/50 bg-[#ff3b30]/10" : "border-white/10 bg-white/[0.03]"
                }`}
                data-testid={`draft-progress-${p.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm tracking-wide truncate flex items-center gap-1">
                    {p.nickname}
                    {p.is_host && <Crown size={11} className="text-amber-300 shrink-0" />}
                    {isMe && <span className="text-[9px] font-mono text-white/40 tracking-widest">(SEN)</span>}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all ${done ? "bg-emerald-400" : "bg-[#ff3b30]"}`}
                      style={{ width: `${(filled / total) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="font-mono text-xs text-white/70 tabular-nums">
                  {done ? (
                    <span className="text-emerald-300 flex items-center gap-0.5"><Check size={11}/> {total}/{total}</span>
                  ) : (
                    <span>{filled} / {total}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* -------- Overlay states ----------------------------------------- */}
      {phase === "tournament" && (
        <OverlayCard title="TURNUVA BAŞLIYOR" msg="Sunucu turnuva ekranına geçiriyor..." spinner />
      )}
      {allComplete && phase !== "tournament" && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5 mb-5 flex flex-col md:flex-row items-center gap-4" data-testid="mp-draft-complete-panel">
          <div className="flex-1">
            <div className="font-display text-2xl tracking-tight text-emerald-200">TÜM OYUNCULAR DRAFTI BİTİRDİ</div>
            <div className="text-xs text-white/60 mt-1">
              {isHost
                ? "Hazır olduğunda TURNUVAYA BAŞLA'ya bas."
                : "Ev sahibinin turnuvayı başlatması bekleniyor..."}
            </div>
          </div>
          {isHost && (
            <button
              type="button"
              onClick={handleStartTournament}
              disabled={busy}
              className="btn-primary !py-3 flex items-center gap-2 disabled:opacity-60"
              data-testid="mp-start-tournament-button"
            >
              <Play size={16} /> TURNUVAYA BAŞLA
            </button>
          )}
        </div>
      )}
      {myDraft?.complete && !allComplete && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5 flex items-center gap-3" data-testid="mp-waiting-others-panel">
          <Loader2 className="animate-spin text-white/60" size={16} />
          <div className="font-mono text-xs tracking-widest text-white/70">
            DRAFTIN BİTTİ · DİĞER OYUNCULARIN BEKLENİYOR...
          </div>
        </div>
      )}

      {/* -------- Draft workspace ---------------------------------------- */}
      {!myDraft?.complete && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Roll + player list */}
          <div className="lg:col-span-7 space-y-3">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-mono tracking-[0.3em] text-white/50">MEVCUT KADRO</div>
                  <div className="font-display text-xl tracking-tight" data-testid="mp-current-team">
                    {myDraft?.current_roll?.season}{" "}
                    <span className="text-white/60">·</span>{" "}
                    {myDraft?.current_roll?.team?.club}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TimerPill remaining={remaining} totalSec={room?.pick_seconds || 30} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {sortedPool.map((p, idx) => {
                  const disabled = !p._placeable;
                  const selected = selectedPlayerName === p.name;
                  return (
                    <button
                      key={`${p.name}-${p.primary}-${idx}`}
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => {
                        if (disabled) { sound.error(); return; }
                        sound.click();
                        setSelectedPlayerName(p.name);
                      }}
                      className={`text-left rounded-lg border p-2 transition-all ${
                        selected
                          ? "border-[#ff3b30] bg-[#ff3b30]/15 shadow-[0_6px_18px_rgba(255,59,48,0.3)]"
                          : disabled
                          ? "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"
                          : "border-white/10 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.08]"
                      }`}
                      data-testid={`mp-pool-player-${p.name.replace(/\s+/g,'-')}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm tracking-wide truncate">{p.name}</span>
                        <span className="font-mono text-[10px] text-amber-300 tabular-nums">{p.overall}</span>
                      </div>
                      <div className="font-mono text-[9px] text-white/45 tracking-widest mt-0.5">
                        {p.primary}
                        {p.secondary && p.secondary !== p.primary ? ` / ${p.secondary}` : ""}
                        {p._alreadyPicked && <span className="ml-1 text-white/30">· SEÇİLDİ</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleChange(false)}
                  disabled={busy || (myDraft?.changes_remaining || 0) <= 0}
                  className="btn-ghost !py-2 flex items-center gap-1.5 text-xs disabled:opacity-40"
                  data-testid="mp-change-button"
                >
                  <RefreshCw size={13} /> DEĞİŞTİR
                </button>
                <button
                  type="button"
                  onClick={() => handleChange(true)}
                  disabled={busy || (myDraft?.lucky_remaining || 0) <= 0}
                  className="btn-ghost !py-2 flex items-center gap-1.5 text-xs disabled:opacity-40 border-amber-400/30 hover:!bg-amber-400/10"
                  data-testid="mp-lucky-change-button"
                >
                  <Sparkles size={13} className="text-amber-300" /> ŞANSLI DEĞİŞTİR
                </button>
                <div className="ml-auto text-[10px] font-mono tracking-widest text-white/50">
                  DEĞİŞİKLİK: <span className="text-amber-300">{myDraft?.changes_remaining ?? 0}/3</span>
                  {" · ŞANSLI: "}
                  <span className="text-amber-300">{myDraft?.lucky_remaining ?? 0}/1</span>
                </div>
              </div>
            </div>

            {err && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="mp-draft-error">
                {err}
              </div>
            )}
          </div>

          {/* Mini pitch */}
          <div className="lg:col-span-5">
            <div className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-mono tracking-[0.3em] text-white/50">
                  {selectedPlayer ? "SEÇTİĞİN OYUNCU İÇİN UYGUN SLOTLAR" : "KADRONU KUR"}
                </div>
                <div className="font-mono text-xs text-white/70 tabular-nums">
                  {xi.filter(Boolean).length} / {xi.length}
                </div>
              </div>
              <div className="relative">
                <Pitch
                  formationId={myDraft?.formation_id || "4-3-3"}
                  xi={xi}
                  slotHints={slotHints}
                  onSlotClick={(idx) => handlePick(idx)}
                  interactive
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------- Footer: leave --------------------------------------- */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleLeave}
          className="text-white/40 hover:text-white text-[10px] font-mono tracking-widest"
          data-testid="mp-leave-button"
        >
          ODADAN AYRIL
        </button>
      </div>
    </div>
  );
};

const TimerPill = ({ remaining, totalSec }) => {
  const pct = Math.max(0, Math.min(1, remaining / (totalSec || 30)));
  const danger = remaining <= 5;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs tracking-widest tabular-nums ${
        danger
          ? "border-red-400/50 bg-red-500/15 text-red-200 animate-pulse"
          : "border-white/10 bg-white/5 text-white/80"
      }`}
      data-testid="mp-timer-pill"
    >
      <Clock size={12} className={danger ? "text-red-300" : "text-[#ff3b30]"} />
      <span>{remaining}s</span>
      <div className="ml-1 w-10 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full ${danger ? "bg-red-400" : "bg-[#ff3b30]"} transition-all`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
};

const OverlayCard = ({ title, msg, spinner }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
  >
    <div className="rounded-2xl border border-white/10 bg-[#0e0e12] p-6 max-w-sm text-center">
      {spinner && <Loader2 className="mx-auto mb-3 animate-spin text-[#ff3b30]" size={28} />}
      <div className="font-display text-2xl tracking-tight mb-1">{title}</div>
      <div className="text-xs text-white/60 font-mono tracking-widest">{msg}</div>
    </div>
  </motion.div>
);
