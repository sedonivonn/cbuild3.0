import { useEffect, useRef, useState } from "react";
import { buildWsUrl } from "../lib/onlineApi";

/**
 * useRoomSocket – live subscription to a room's lobby state.
 *
 * @param {string|null} code  Room code (uppercase) or null to disable.
 * @param {string|null} playerId  This client's player id from create/join.
 * @param {(room: object) => void} onState   Called every time the server pushes state.
 * @param {(msg: object) => void=} onMessage Called for other message types (errors/closed).
 *
 * Design:
 * - Reconnects with a small backoff on unexpected drops (up to 5 attempts).
 * - Sends a heartbeat every 25s so proxies / Cloud Run don't idle-close the socket.
 * - Exposes `status` for UI cues ('connecting' | 'open' | 'closed' | 'error').
 */
export function useRoomSocket(code, playerId, onState, onMessage) {
  const [status, setStatus] = useState("idle");
  const wsRef = useRef(null);
  const retriesRef = useRef(0);
  const pingRef = useRef(null);
  const closedByUsRef = useRef(false);

  // Keep the latest callbacks without retriggering the effect.
  const onStateRef = useRef(onState);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onStateRef.current = onState; }, [onState]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    if (!code || !playerId) return undefined;
    closedByUsRef.current = false;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      let ws;
      try {
        ws = new WebSocket(buildWsUrl(code, playerId));
      } catch (_) {
        setStatus("error");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        setStatus("open");
        // keepalive
        pingRef.current = setInterval(() => {
          try { ws.send(JSON.stringify({ type: "ping" })); } catch (_) {}
        }, 25000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "state" && msg.room) onStateRef.current?.(msg.room);
          else onMessageRef.current?.(msg);
        } catch (_) { /* ignore malformed */ }
      };

      ws.onerror = () => { setStatus("error"); };

      ws.onclose = () => {
        clearInterval(pingRef.current);
        pingRef.current = null;
        if (closedByUsRef.current || cancelled) { setStatus("closed"); return; }
        // exponential-ish backoff (0.5s, 1s, 2s, 4s, 8s)
        const attempt = retriesRef.current;
        if (attempt < 5) {
          const delay = 500 * Math.pow(2, attempt);
          retriesRef.current += 1;
          setStatus("connecting");
          setTimeout(connect, delay);
        } else {
          setStatus("closed");
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      closedByUsRef.current = true;
      clearInterval(pingRef.current);
      pingRef.current = null;
      try { wsRef.current && wsRef.current.close(1000, "unmount"); } catch (_) {}
      wsRef.current = null;
    };
  }, [code, playerId]);

  return { status };
}
