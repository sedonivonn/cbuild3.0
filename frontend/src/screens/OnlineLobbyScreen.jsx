import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, Share2, Play, LogOut, Link2, Clock, Users, Trophy,
  Circle, Wifi, WifiOff, Crown, ArrowLeft,
} from "lucide-react";
import { sound } from "../engine/sounds";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { getRoom, startRoom, leaveRoom } from "../lib/onlineApi";

const MODE_LABEL = { group: "GRUP", league: "LİG" };

/**
 * OnlineLobbyScreen – real-time waiting room after ODA KUR / KATIL.
 *
 * Props:
 *   code (string)   – room code (e.g. "SNBTT3")
 *   me   (object)   – { id, nickname, is_host, ... } from create/join response
 *   onLeave()       – parent handler when the user leaves / gets kicked
 *   onStarted(room) – parent handler when the host presses BAŞLAT
 */
export const OnlineLobbyScreen = ({ code, me, onLeave, onStarted }) => {
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(null); // "code" | "link" | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Initial REST fetch so the UI paints instantly, before the WS handshake.
  useEffect(() => {
    let ok = true;
    getRoom(code).then((r) => { if (ok) setRoom(r.room); })
      .catch((e) => setErr(e.message || "Oda bulunamadı"));
    return () => { ok = false; };
  }, [code]);

  const handleState = useCallback((r) => {
    setRoom(r);
    if (r?.status === "started" && onStarted) onStarted(r);
  }, [onStarted]);

  const handleMsg = useCallback((m) => {
    if (m?.type === "closed") {
      setErr("Ev sahibi odayı kapattı");
      setTimeout(() => onLeave?.(), 1500);
    } else if (m?.type === "error") {
      setErr(m.message || "Bağlantı hatası");
    }
  }, [onLeave]);

  const { status: wsStatus } = useRoomSocket(code, me?.id, handleState, handleMsg);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    u.searchParams.set("room", code);
    u.hash = "";
    return u.toString();
  }, [code]);

  const players = room?.players || [];
  const maxPlayers = room?.max_players ?? 2;
  const filledCount = players.length;
  const emptySlots = Math.max(0, maxPlayers - filledCount);
  const isHost = !!me?.is_host || room?.host_id === me?.id;
  const canStart = isHost && filledCount >= 2 && room?.status === "lobby";

  const copyText = async (text, kind) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
      sound.click();
    } catch (_) { /* ignore */ }
  };

  const handleWhatsapp = () => {
    const msg = encodeURIComponent(
      `championsbuild ONLINE odama katıl!\nKod: ${code}\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "championsbuild ONLINE", text: `Oda: ${code}`, url: shareUrl });
      } catch (_) { /* user dismissed */ }
    } else {
      copyText(shareUrl, "link");
    }
  };

  const handleStart = async () => {
    if (!canStart || busy) return;
    setBusy(true); setErr(null);
    try {
      sound.click();
      await startRoom(code, me.id);
      // onStarted will fire via WS `state` message.
    } catch (e) {
      setErr(e.message || "Başlatılamadı");
    } finally { setBusy(false); }
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (me?.id) await leaveRoom(code, me.id).catch(() => {});
      onLeave?.();
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] px-5 md:px-12 py-8 flex items-start justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl"
      >
        <button
          type="button"
          onClick={handleLeave}
          className="mb-4 text-white/50 hover:text-white text-xs font-mono tracking-widest flex items-center gap-1"
          data-testid="lobby-back-button"
        >
          <ArrowLeft size={14} /> ODADAN AYRIL
        </button>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusPill icon={<Clock size={12} />} label="SÜRE" value={`${room?.duration_sec ?? 90}s`} />
          <StatusPill icon={<Users size={12} />} label="O.MAX" value={String(maxPlayers)} />
          <StatusPill icon={<Trophy size={12} />} label="MOD" value={MODE_LABEL[room?.mode] || "—"} />
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-white/50" data-testid="lobby-ws-status">
            {wsStatus === "open" ? (
              <><Wifi size={12} className="text-emerald-400" /> CANLI</>
            ) : (
              <><WifiOff size={12} className="text-amber-400" /> {wsStatus.toUpperCase()}</>
            )}
          </div>
        </div>

        {/* Share URL */}
        <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center gap-2 text-[11px] font-mono text-white/60" data-testid="lobby-share-url-bar">
          <Link2 size={13} className="text-white/40 shrink-0" />
          <span className="truncate flex-1" title={shareUrl}>{shareUrl}</span>
          <button
            type="button"
            onClick={() => copyText(shareUrl, "link")}
            className="text-white/60 hover:text-white text-[10px] tracking-widest transition"
            data-testid="lobby-copy-link-button"
          >
            {copied === "link" ? "KOPYALANDI" : "KOPYALA"}
          </button>
        </div>

        {/* Room code card */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 text-center">
          <div className="text-[10px] font-mono tracking-[0.4em] text-white/50">ODA KODU</div>
          <div
            className="mt-1 font-display text-6xl md:text-7xl tracking-[0.25em] text-white select-all"
            style={{ textShadow: "0 0 30px rgba(255,59,48,0.35)" }}
            data-testid="lobby-room-code"
          >
            {code}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <QuickAction
              onClick={() => copyText(code, "code")}
              icon={copied === "code" ? <Check size={14} /> : <Copy size={14} />}
              label={copied === "code" ? "KOPYALANDI" : "KOPYALA"}
              testid="lobby-copy-code-button"
            />
            <QuickAction
              onClick={handleWhatsapp}
              icon={<WhatsappIcon />}
              label="WHATSAPP"
              testid="lobby-whatsapp-button"
            />
            <QuickAction
              onClick={handleShare}
              icon={<Share2 size={14} />}
              label="PAYLAŞ"
              testid="lobby-share-button"
            />
          </div>
        </div>

        {/* Player slots */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-2">
            <div className="font-display text-xl tracking-widest">OYUNCULAR</div>
            <div className="font-mono text-xs text-white/60" data-testid="lobby-slot-count">
              {filledCount} / {maxPlayers}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 overflow-hidden">
            {players.map((p, i) => (
              <PlayerRow
                key={p.id}
                index={i + 1}
                nickname={p.nickname}
                isHost={p.is_host}
                connected={p.connected}
                isMe={p.id === me?.id}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <EmptyRow key={`empty-${i}`} index={filledCount + i + 1} />
            ))}
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="lobby-error">
            {err}
          </div>
        )}

        {/* Start / leave actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || busy}
              className="btn-primary w-full !py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="lobby-start-button"
              title={canStart ? "Başlat" : "En az 2 oyuncu gerekli"}
            >
              <Play size={18} />
              {busy ? "BAŞLATILIYOR..." : "BAŞLAT"}
            </button>
          ) : (
            <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-mono tracking-widest text-white/60" data-testid="lobby-waiting-host">
              EV SAHİBİ BAŞLATANA KADAR BEKLENİYOR...
            </div>
          )}
          <button
            type="button"
            onClick={handleLeave}
            className="btn-ghost flex items-center justify-center gap-2 !py-3.5"
            data-testid="lobby-leave-button"
          >
            <LogOut size={16} /> AYRIL
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StatusPill = ({ icon, label, value }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-mono tracking-widest text-white/70">
    <span className="text-[#ff3b30]">{icon}</span>
    <span className="text-white/45">{label}</span>
    <span className="text-white">{value}</span>
  </div>
);

const QuickAction = ({ icon, label, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 transition text-[11px] font-mono tracking-widest text-white/80"
  >
    {icon} {label}
  </button>
);

const PlayerRow = ({ index, nickname, isHost, connected, isMe }) => (
  <div className="flex items-center gap-3 px-4 py-3" data-testid={`lobby-player-row-${index}`}>
    <span className="font-mono text-[11px] tracking-wider text-white/40 w-4">{index}</span>
    <Circle size={8} className={connected ? "text-emerald-400 fill-emerald-400" : "text-white/25 fill-white/25"} />
    <span className="font-display text-lg tracking-wide truncate">
      {nickname}
      {isMe && <span className="ml-1.5 text-[10px] font-mono text-white/40 tracking-widest">(SEN)</span>}
    </span>
    {isHost && (
      <span className="ml-auto flex items-center gap-1 text-[10px] font-mono tracking-widest text-amber-300">
        <Crown size={12} /> EV SAHİBİ
      </span>
    )}
  </div>
);

const EmptyRow = ({ index }) => (
  <div className="flex items-center gap-3 px-4 py-3 opacity-60" data-testid={`lobby-empty-row-${index}`}>
    <span className="font-mono text-[11px] tracking-wider text-white/30 w-4">{index}</span>
    <Circle size={8} className="text-white/15 fill-white/15" />
    <span className="font-display text-lg tracking-wide text-white/40 italic">BOŞ SLOT</span>
  </div>
);

const WhatsappIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#25D366]">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
