// src/services/discover.service.js
import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

/* ---------------- Utils ---------------- */
function normalizeResponse(response) {
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
}
const withSupaTimeout = async (promise, ms, label = "timeout") => {
  let timer;
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${label}:${ms}`)), ms); }),
    ]);
    return result; // { data, error }
  } finally {
    clearTimeout(timer);
  }
};
const isFiniteNum = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/* ---------------- API Layer ---------------- */
async function listViaApi(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng, signal } = options;

  const params = { mode, limit };
  if (ignoreSwiped) params.ignore_swiped = 1;
  if (debug) params.debug = 1;
  if (isValidLatLng(lat, lng)) { params.lat = lat; params.lng = lng; }

  try {
    const response = await api.get("/discover", { params, timeoutMs: 8000, signal });
    const items = normalizeResponse(response);
    if (debug) console.info("[discover.api]", { mode, count: items.length });
    return items;
  } catch (error) {
    if (debug) console.warn("[discover.api] failed:", error.message || error);
    return [];
  }
}

/* ---------------- RPC Layer ---------------- */
async function listViaRpc(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng } = options;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const rpcParams = { uid: user.id, mode, lim: limit, ignore_swiped: !!ignoreSwiped };
    if (isValidLatLng(lat, lng)) { rpcParams.user_lat = lat; rpcParams.user_lng = lng; }

    const { data, error } = await withSupaTimeout(
      supabase.rpc("discover_candidates", rpcParams),
      6000,
      "rpc"
    );

    if (error) {
      if (debug) console.warn("[discover.rpc] error:", error.message || error);
      return [];
    }

    const items = (data || []).map((c) => ({ ...c, match_score: Math.round(Number(c.match_score || 0)) }));
    if (debug) console.info("[discover.rpc]", { mode, count: items.length });
    return items;
  } catch (error) {
    if (debug) console.warn("[discover.rpc] failed:", error.message || error);
    return [];
  }
}

/* ---------------- Fallback ---------------- */
async function listViaProfiles(limit, options) {
  const { debug, lat, lng } = options;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await withSupaTimeout(
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, city, lat, lng, gender, dob")
        .neq("id", user.id)
        .limit(limit),
      5000,
      "profiles"
    );

    if (error) {
      if (debug) console.warn("[discover.fallback] error:", error.message || error);
      return [];
    }

    const items = (data || []).map((p) => {
      let age = null;
      if (p.dob) {
        const birthDate = new Date(p.dob);
        age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
      }
      let distanceKm = null;
      if (isValidLatLng(lat, lng) && isValidLatLng(p.lat, p.lng)) {
        distanceKm = calculateDistance(Number(lat), Number(lng), Number(p.lat), Number(p.lng));
      }
      return {
        id: p.id,
        display_name: p.display_name,
        age,
        avatar_url: p.avatar_url,
        city: p.city,
        lat: p.lat,
        lng: p.lng,
        distance_km: distanceKm,
        match_score: null,
      };
    });

    if (debug) console.info("[discover.fallback]", { count: items.length });
    return items;
  } catch (error) {
    if (debug) console.warn("[discover.fallback] failed:", error.message || error);
    return [];
  }
}

/* ---------------- Distance ---------------- */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/* ---------------- Export ---------------- */
export const discoverService = {
  list: async (mode = "for_you", limit = 20, options = {}) => {
    const { lat = null, lng = null, signal = null, ignoreSwiped = false, debug: debugOption = false } = options;

    const debug =
      debugOption ||
      localStorage.getItem("DEBUG_DISCOVER") === "1" ||
      new URLSearchParams(window.location.search).get("debug") === "1";

    const shouldIgnoreSwiped =
      ignoreSwiped ||
      localStorage.getItem("DEBUG_DISCOVER_IGNORE") === "1" ||
      new URLSearchParams(window.location.search).get("ignore_swiped") === "1";

    const requestOptions = { ignoreSwiped: shouldIgnoreSwiped, debug, lat, lng, signal };

    let items = await listViaApi(mode, limit, requestOptions);
    if (items.length) return items;

    items = await listViaRpc(mode, limit, { ...requestOptions, ignoreSwiped: true });
    if (items.length) return items;

    items = await listViaProfiles(limit, requestOptions);
    return items;
  },
  // (other exported helpers left as-is)
};