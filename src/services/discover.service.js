import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

/* ---------------- Utils ---------------- */
function normalizeResponse(response) {
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
}

const withTimeout = (promise, ms, label = "timeout") =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}:${ms}`)), ms)
    ),
  ]);

const isFiniteNum = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/* ---------------- API Layer (Authenticated) ---------------- */
async function listViaApi(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng, signal } = options;

  const params = { mode, limit };
  if (ignoreSwiped) params.ignore_swiped = 1;
  if (debug) params.debug = 1;

  if (isValidLatLng(lat, lng)) {
    params.lat = lat;
    params.lng = lng;
  }

  try {
    const response = await api.get("/discover", {
      params,
      timeoutMs: 8000,
      signal,
    });
    const items = normalizeResponse(response);
    if (debug) {
      console.info("[discover.api]", {
        mode,
        count: items.length,
        ignoreSwiped,
        location: isValidLatLng(lat, lng) ? { lat, lng } : "none",
      });
    }
    return items;
  } catch (error) {
    if (debug) console.warn("[discover.api] failed:", error.message || error);
    return [];
  }
}

/* ---------------- RPC Layer (Database Function) ---------------- */
async function listViaRpc(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng } = options;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const rpcParams = {
      uid: user.id,
      mode,
      lim: limit,
      ignore_swiped: !!ignoreSwiped,
    };

    if (isValidLatLng(lat, lng)) {
      rpcParams.user_lat = lat;
      rpcParams.user_lng = lng;
    }

    const p = supabase.rpc("discover_candidates", rpcParams);
    const { data, error } = await withTimeout(p, 6000, "rpc");

    if (error) {
      if (debug) console.warn("[discover.rpc] error:", error.message || error);
      return [];
    }

    const items = (data || []).map((candidate) => ({
      ...candidate,
      match_score: Math.round(Number(candidate.match_score || 0)),
    }));

    if (debug) {
      console.info("[discover.rpc]", {
        mode,
        count: items.length,
        ignoreSwiped,
        location: isValidLatLng(lat, lng) ? { lat, lng } : "none",
      });
    }

    return items;
  } catch (error) {
    if (debug) console.warn("[discover.rpc] failed:", error.message || error);
    return [];
  }
}

/* ---------------- Fallback Layer (Direct DB Query) ---------------- */
async function listViaProfiles(limit, options) {
  const { debug, lat, lng } = options;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const q = supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, gender, dob")
      .neq("id", user.id)
      .limit(limit);

    const { data, error } = await withTimeout(q, 5000, "profiles");

    if (error) {
      if (debug) console.warn("[discover.fallback] error:", error.message || error);
      return [];
    }

    const items = (data || []).map((profile) => {
      let age = null;
      if (profile.dob) {
        const birthDate = new Date(profile.dob);
        const ageInMs = Date.now() - birthDate.getTime();
        age = Math.floor(ageInMs / (365.25 * 24 * 3600 * 1000));
      }

      let distanceKm = null;
      if (isValidLatLng(lat, lng) && isValidLatLng(profile.lat, profile.lng)) {
        distanceKm = calculateDistance(Number(lat), Number(lng), Number(profile.lat), Number(profile.lng));
      }

      return {
        id: profile.id,
        display_name: profile.display_name,
        age,
        avatar_url: profile.avatar_url,
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
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

/* ---------------- Distance Calculation ---------------- */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) ** 2;

  const distance = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.round(distance * 10) / 10;
}

/* ---------------- Exported Service ---------------- */
export const discoverService = {
  list: async (mode = "for_you", limit = 20, options = {}) => {
    const {
      lat = null,
      lng = null,
      signal = null,
      ignoreSwiped = false,
      debug: debugOption = false,
    } = options;

    const debug =
      debugOption ||
      localStorage.getItem("DEBUG_DISCOVER") === "1" ||
      new URLSearchParams(window.location.search).get("debug") === "1";

    const shouldIgnoreSwiped =
      ignoreSwiped ||
      localStorage.getItem("DEBUG_DISCOVER_IGNORE") === "1" ||
      new URLSearchParams(window.location.search).get("ignore_swiped") === "1";

    const requestOptions = {
      ignoreSwiped: shouldIgnoreSwiped,
      debug,
      lat,
      lng,
      signal,
    };

    if (debug) {
      console.group("Discover Request");
      console.log("Mode:", mode);
      console.log("Limit:", limit);
      console.log("Location:", isValidLatLng(lat, lng) ? { lat, lng } : "Not provided");
      console.log("Ignore Swiped:", shouldIgnoreSwiped);
      console.groupEnd();
    }

    // Try API first (has true timeout/abort via api.get)
    let items = await listViaApi(mode, limit, requestOptions);
    if (items.length) {
      if (debug) console.log("Using API results:", items.length, "items");
      return items;
    }

    // Try RPC with hard timeout
    if (debug) console.warn("API returned no results, trying RPC...");
    items = await listViaRpc(mode, limit, {
      ...requestOptions,
      ignoreSwiped: true, // dev-friendly
    });
    if (items.length) {
      if (debug) console.log("Using RPC results:", items.length, "items");
      return items;
    }

    // Final fallback: raw profiles with hard timeout
    if (debug) console.warn("⚠️ RPC returned no results, using fallback...");
    items = await listViaProfiles(limit, requestOptions);

    if (debug) {
      console.log(
        items.length
          ? ` Using fallback: ${items.length} items`
          : " No results from any source"
      );
    }

    return items;
  },

  // The rest of this file (swipe, createMatch, etc.) is left as-is.
  // Note: If you do use these, align column names with your schema (swiper_id/swipee_id, dir, matches.user_a_id/user_b_id).
};