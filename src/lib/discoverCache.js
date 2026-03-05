const LS = typeof window !== "undefined" ? window.localStorage : null;
const TTL_MS = 45_000; // 45s TTL; adjust as you like

function key(uid, mode) { return `cache:discover:${uid || "anon"}:${mode}`; }
function now() { return Date.now(); }

function get(keyStr) {
  if (!LS) return null;
  try { const v = LS.getItem(keyStr); return v ? JSON.parse(v) : null; } catch { return null; }
}
function set(keyStr, val) {
  if (!LS) return;
  try { LS.setItem(keyStr, JSON.stringify(val)); } catch {}
}

export const DiscoverCache = {
  load(uid, mode) {
    const k = key(uid, mode);
    const v = get(k);
    if (!v) return { items: [], ts: 0 };
    return v;
  },
  save(uid, mode, items) {
    const k = key(uid, mode);
    set(k, { items, ts: now() });
  },
  isStale(ts) {
    return !ts || now() - ts > TTL_MS;
  }
};