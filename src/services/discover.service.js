import { api } from "../lib/api";
import { supabase } from "../../api/lib/supabase";

const norm = (r) => (Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : []);

async function listViaApi(mode, limit, { ignore_swiped, debug }) {
  const params = { mode, limit };
  if (ignore_swiped) params.ignore_swiped = 1;
  if (debug) params.debug = 1;
  try {
    const r = await api.get("/discover", { params, timeoutMs: 8000 });
    const items = norm(r);
    if (debug) console.info("[discover.api]", { mode, count: items.length, ignore_swiped });
    return items;
  } catch (e) {
    if (debug) console.warn("[discover.api] failed:", e.message || e);
    return [];
  }
}

async function listViaRpc(mode, limit, { ignore_swiped, debug }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error("timeout:rpc:6000ms")), 6000);

    const { data, error } = await supabase
      .rpc("discover_candidates", { uid: user.id, mode, lim: limit, ignore_swiped: !!ignore_swiped })
      .then((r) => (clearTimeout(t), r))
      .catch((e) => (clearTimeout(t), { data: null, error: e }));

    if (error) {
      if (debug) console.warn("[discover.rpc] error:", error.message || error);
      return [];
    }
    const items = (data || []).map(d => ({ ...d, match_score: Math.round(Number(d.match_score || 0)) }));
    if (debug) console.info("[discover.rpc]", { mode, count: items.length, ignore_swiped });
    return items;
  } catch (e) {
    if (debug) console.warn("[discover.rpc] failed:", e.message || e);
    return [];
  }
}

async function listViaProfiles(limit, { debug }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error("timeout:profiles:4000ms")), 4000);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, gender, dob")
      .neq("id", user.id)
      .limit(limit)
      .then((r) => (clearTimeout(t), r))
      .catch((e) => (clearTimeout(t), { data: null, error: e }));

    if (error) {
      if (debug) console.warn("[discover.fallback] error:", error.message || error);
      return [];
    }
    const items = (data || []).map(o => ({
      id: o.id,
      display_name: o.display_name,
      age: o.dob ? Math.floor((Date.now() - new Date(o.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null,
      avatar_url: o.avatar_url,
      city: o.city, lat: o.lat, lng: o.lng,
      distance_km: null, match_score: null,
    }));
    if (debug) console.info("[discover.fallback]", { count: items.length });
    return items;
  } catch (e) {
    if (debug) console.warn("[discover.fallback] failed:", e.message || e);
    return [];
  }
}

export const discoverService = {
  list: async (mode = "for_you", limit = 20, opts = {}) => {
    const debug =
      opts.debug ||
      localStorage.getItem("DEBUG_DISCOVER") === "1" ||
      new URLSearchParams(location.search).get("debug") === "1";
    const ignore_swiped =
      opts.ignore_swiped ||
      localStorage.getItem("DEBUG_DISCOVER_IGNORE") === "1" ||
      new URLSearchParams(location.search).get("ignore_swiped") === "1";

    // 1) API
    let items = await listViaApi(mode, limit, { ignore_swiped, debug });
    if (items.length) return items;

    // 2) RPC (force ignore_swiped in dev to unblock)
    items = await listViaRpc(mode, limit, { ignore_swiped: true, debug });
    if (items.length) return items;

    // 3) Fallback raw profiles (dev-safety)
    items = await listViaProfiles(limit, { debug });
    return items;
  },
};