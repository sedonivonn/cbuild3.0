// Shareable draft code — encodes formation + team name + XI into a URL-safe
// base64 string. Designed to be ~1-2KB; embedded as URL hash `#d=XXX`.

function utf8ToBase64(str) {
  // safe across unicode
  return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}
function urlSafe(b64) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function urlUnsafe(s) {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return b;
}

export function encodeDraft({ formationId, teamName, xi }) {
  if (!formationId || !xi || xi.length === 0) return null;
  // keep only essential fields to keep payload small
  const compactXi = xi.map((p) =>
    p
      ? {
          n: p.name,
          p: p.primary,
          s: p.secondary || "",
          o: p.overall,
          c: p.nationality || "",
          se: p._season || null,
          cl: p._club || "",
          cr: p._crest || "",
          co: p._country || "",
        }
      : null
  );
  const payload = { v: 1, f: formationId, t: teamName || "", x: compactXi };
  const json = JSON.stringify(payload);
  return urlSafe(utf8ToBase64(json));
}

export function decodeDraft(code) {
  if (!code) return null;
  try {
    const json = base64ToUtf8(urlUnsafe(code));
    const obj = JSON.parse(json);
    if (!obj || obj.v !== 1 || !obj.f || !Array.isArray(obj.x)) return null;
    const xi = obj.x.map((p) =>
      p
        ? {
            name: p.n,
            primary: p.p,
            secondary: p.s,
            overall: p.o,
            nationality: p.c,
            _season: p.se,
            _club: p.cl,
            _crest: p.cr,
            _country: p.co,
          }
        : null
    );
    return { formationId: obj.f, teamName: obj.t || "", xi };
  } catch (_) {
    return null;
  }
}

export function buildShareUrl(code) {
  if (!code) return "";
  const base = window.location.origin + window.location.pathname;
  return `${base}#d=${code}`;
}

export function readDraftFromUrl() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const m = hash.match(/[#&]d=([^&]+)/);
  if (!m) return null;
  return decodeDraft(m[1]);
}

export function clearDraftFromUrl() {
  if (typeof window === "undefined") return;
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (_) {}
}
