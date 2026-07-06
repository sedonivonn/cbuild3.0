// Small REST client for the Online multiplayer feature.
// All endpoints live under `${REACT_APP_BACKEND_URL}/api/online/*`.
// Kept dependency-free (uses fetch) so it works in CRA and Vite alike.

const BASE = process.env.REACT_APP_BACKEND_URL;

if (!BASE) {
  // Surface a loud error early rather than a mysterious CORS/404 later.
  // eslint-disable-next-line no-console
  console.warn("REACT_APP_BACKEND_URL is missing — online multiplayer will not work");
}

const API = `${BASE || ""}/api/online`;

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function createRoom({ nickname, maxPlayers, mode, pickSeconds }) {
  return req("/rooms", {
    method: "POST",
    body: JSON.stringify({
      nickname,
      max_players: maxPlayers,
      mode,
      pick_seconds: pickSeconds ?? 30,
    }),
  });
}

export function getRoom(code) {
  return req(`/rooms/${encodeURIComponent(code)}`);
}

export function joinRoom(code, nickname) {
  return req(`/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export function startRoom(code, playerId, { pool, setup } = {}) {
  return req(`/rooms/${encodeURIComponent(code)}/start`, {
    method: "POST",
    body: JSON.stringify({
      player_id: playerId,
      pool: pool ?? [],
      setup: setup ?? {},
    }),
  });
}

export function gamePick(code, { playerId, slotIndex, playerName }) {
  return req(`/rooms/${encodeURIComponent(code)}/game/pick`, {
    method: "POST",
    body: JSON.stringify({
      player_id: playerId,
      slot_index: slotIndex,
      player_name: playerName,
    }),
  });
}

export function gameChange(code, { playerId, lucky }) {
  return req(`/rooms/${encodeURIComponent(code)}/game/change`, {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, lucky: !!lucky }),
  });
}

export function gameStartTournament(code, playerId) {
  return req(`/rooms/${encodeURIComponent(code)}/game/start_tournament`, {
    method: "POST",
    body: JSON.stringify({ player_id: playerId }),
  });
}

export function setReady(code, playerId, ready) {
  return req(`/rooms/${encodeURIComponent(code)}/ready`, {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, ready: !!ready }),
  });
}

export function leaveRoom(code, playerId) {
  return req(`/rooms/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}`, {
    method: "DELETE",
  });
}

// Build the WebSocket URL from REACT_APP_BACKEND_URL (http[s] -> ws[s]).
// (Kept as a no-op export for backwards compatibility — Socket.IO is now
// used for real-time transport via `useRoomSocket`.)
