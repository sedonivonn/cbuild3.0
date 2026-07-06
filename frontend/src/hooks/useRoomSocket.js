import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// One Socket.IO manager is shared for the entire app (there's only ever one
// active room per browser tab, but the underlying engine.io connection is
// happy to be reused across mounts).
const BASE = process.env.REACT_APP_BACKEND_URL || "";

/**
 * useRoomSocket – live subscription to a room's real-time feed via Socket.IO.
 *
 * @param {string|null} code       Room code (uppercase) or null to disable.
 * @param {string|null} playerId   This client's player id (from create/join).
 * @param {(room: object) => void} onState   Called on every `state` push.
 * @param {(msg: object) => void=} onMessage Called for `error` / `closed`.
 *
 * Design:
 * - Server transports: WebSocket first, long-polling as automatic fallback
 *   (built into socket.io-client — same wire, easier CORS on Cloud Run).
 * - Auto-reconnect is handled by the client; we simply re-emit `join` on
 *   every `connect` event so the server re-subscribes us to the room.
 * - `status` exposes 'idle' | 'connecting' | 'open' | 'closed' | 'error'
 *   for UI cues.
 */
export function useRoomSocket(code, playerId, onState, onMessage) {
  const [status, setStatus] = useState("idle");
  const socketRef = useRef(null);
  const onStateRef = useRef(onState);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onStateRef.current = onState; }, [onState]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    if (!code || !playerId) return undefined;

    setStatus("connecting");
    // `path` must match the server-side `socketio_path` in sio_server.py.
    const socket = io(BASE || undefined, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 20000,
      autoConnect: true,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setStatus("open");
      // Ask the server to add us to this room's broadcast group.
      socket.emit("join", { code, player_id: playerId }, (ack) => {
        if (ack?.ok && ack.room) onStateRef.current?.(ack.room);
        else if (ack?.error) onMessageRef.current?.({ type: "error", message: ack.error });
      });
    };
    const handleState = (payload) => {
      if (payload?.room) onStateRef.current?.(payload.room);
    };
    const handleClosed = () => onMessageRef.current?.({ type: "closed" });
    const handleError = (payload) => onMessageRef.current?.({
      type: "error",
      message: payload?.message || "socket error",
    });
    const handleDisconnect = () => setStatus("connecting");
    const handleConnectError = () => setStatus("error");

    socket.on("connect", handleConnect);
    socket.on("state", handleState);
    socket.on("closed", handleClosed);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      setStatus("closed");
      socket.off("connect", handleConnect);
      socket.off("state", handleState);
      socket.off("closed", handleClosed);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      try { socket.emit("leave"); } catch (_) { /* noop */ }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, playerId]);

  return { status };
}
