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

export function startRoom(code, playerId) {
  return req(`/rooms/${encodeURIComponent(code)}/start`, {
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
export function buildWsUrl(code, playerId) {
  const base = BASE || window.location.origin;
  const wsBase = base.replace(/^http/i, "ws");
  return `${wsBase}/api/online/ws/${encodeURIComponent(code)}?player_id=${encodeURIComponent(playerId)}`;
}
