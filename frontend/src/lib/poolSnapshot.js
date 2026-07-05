// Builds a JSON-safe snapshot of the full team pool (seasons +
// quarterfinalists) that the host uploads to the server when starting
// an Online game. From that upload onwards ALL dice rolls happen on
// the server against this frozen snapshot — the client can no longer
// influence what teams appear in its own or anyone else's draft.
//
// Shape: [{ season:int, team:{ club, country, crest, players:[{name,
//         primary, secondary, overall, nationality }] } }, ...]

import { SEASONS } from "../data/seasons";
import { QUARTERFINALISTS } from "../data/quarterfinalists";

let cached = null;

export function buildPoolSnapshot() {
  if (cached) return cached;
  const merged = {};
  for (const k of Object.keys(SEASONS)) merged[k] = [...SEASONS[k]];
  for (const k of Object.keys(QUARTERFINALISTS)) {
    merged[k] = [...(merged[k] || []), ...QUARTERFINALISTS[k]];
  }
  const out = [];
  for (const [seasonKey, teams] of Object.entries(merged)) {
    const season = Number(seasonKey);
    for (const t of teams) {
      out.push({
        season,
        team: {
          club: t.club,
          country: t.country || "",
          crest: t.crest || "",
          players: (t.players || []).map((p) => ({
            name: p.name,
            primary: p.primary,
            secondary: p.secondary || p.primary,
            overall: p.overall,
            nationality: p.nationality || "",
          })),
        },
      });
    }
  }
  cached = out;
  return out;
}
