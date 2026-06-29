// Hall of Fame: localStorage-backed trophy cabinet.
// Saves every UCL win permanently on this device.
// Each entry stores enough data to re-render the squad + stats on the cabinet.

const HOF_KEY = "ucl_hall_of_fame_v1";

function safeRead() {
  try {
    const raw = localStorage.getItem(HOF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function safeWrite(list) {
  try {
    localStorage.setItem(HOF_KEY, JSON.stringify(list));
    return true;
  } catch (_) {
    return false;
  }
}

// trophy: { teamName, formationId, tactic, totalOvr, xi, tournamentStats?, opponentsBeaten? }
export function saveTrophy(trophy) {
  if (!trophy || !trophy.xi || trophy.xi.length === 0) return null;
  const list = safeRead();
  const entry = {
    id: `trophy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: new Date().toISOString(),
    teamName: trophy.teamName || "DRAFT TAKIMI",
    formationId: trophy.formationId,
    tactic: trophy.tactic,
    totalOvr: trophy.totalOvr,
    xi: trophy.xi,
    tournamentStats: trophy.tournamentStats || null,
    opponentsBeaten: trophy.opponentsBeaten || [],
  };
  list.unshift(entry); // newest first
  safeWrite(list);
  return entry;
}

export function getAllTrophies() {
  return safeRead();
}

export function getTopTrophies(n = 3) {
  const list = safeRead();
  return [...list].sort((a, b) => (b.totalOvr || 0) - (a.totalOvr || 0)).slice(0, n);
}

export function deleteTrophy(id) {
  const list = safeRead().filter((t) => t.id !== id);
  safeWrite(list);
  return list;
}

export function clearAllTrophies() {
  safeWrite([]);
}

export function getTrophyCount() {
  return safeRead().length;
}
