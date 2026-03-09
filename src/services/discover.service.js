// src/services/discover.service.js
import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

/* ---------------- Response Normalization ---------------- */
function normalizeResponse(response) {
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
}

/* ---------------- API Layer (Authenticated) ---------------- */
async function listViaApi(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng, signal } = options;

  const params = { mode, limit };
  if (ignoreSwiped) params.ignore_swiped = 1;
  if (debug) params.debug = 1;

  // Pass real-time location
  if (lat != null && lng != null) {
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
        location: lat != null && lng != null ? { lat, lng } : "none",
      });
    }

    return items;
  } catch (error) {
    if (debug) {
      console.warn("[discover.api] failed:", error.message || error);
    }
    return [];
  }
}

/* ---------------- RPC Layer (Database Function) ---------------- */
async function listViaRpc(mode, limit, options) {
  const { ignoreSwiped, debug, lat, lng } = options;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 6000);

    const rpcParams = {
      uid: user.id,
      mode,
      lim: limit,
      ignore_swiped: !!ignoreSwiped,
    };

    // Pass real-time location to RPC
    if (lat != null && lng != null) {
      rpcParams.user_lat = lat;
      rpcParams.user_lng = lng;
    }

    const { data, error } = await supabase
      .rpc("discover_candidates", rpcParams)
      .then((result) => {
        clearTimeout(timeoutId);
        return result;
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return { data: null, error: err };
      });

    if (error) {
      if (debug) {
        console.warn("[discover.rpc] error:", error.message || error);
      }
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
        location: lat != null && lng != null ? { lat, lng } : "none",
      });
    }

    return items;
  } catch (error) {
    if (debug) {
      console.warn("[discover.rpc] failed:", error.message || error);
    }
    return [];
  }
}

/* ---------------- Fallback Layer (Direct DB Query) ---------------- */
async function listViaProfiles(limit, options) {
  const { debug, lat, lng } = options;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 4000);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, gender, dob")
      .neq("id", user.id)
      .limit(limit)
      .then((result) => {
        clearTimeout(timeoutId);
        return result;
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return { data: null, error: err };
      });

    if (error) {
      if (debug) {
        console.warn("[discover.fallback] error:", error.message || error);
      }
      return [];
    }

    const items = (data || []).map((profile) => {
      let age = null;
      if (profile.dob) {
        const birthDate = new Date(profile.dob);
        const ageInMs = Date.now() - birthDate.getTime();
        age = Math.floor(ageInMs / (365.25 * 24 * 3600 * 1000));
      }

      // Calculate distance if we have both locations
      let distanceKm = null;
      if (lat != null && lng != null && profile.lat != null && profile.lng != null) {
        distanceKm = calculateDistance(lat, lng, profile.lat, profile.lng);
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

    if (debug) {
      console.info("[discover.fallback]", { count: items.length });
    }

    return items;
  } catch (error) {
    if (debug) {
      console.warn("[discover.fallback] failed:", error.message || error);
    }
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
  /**
   * List discover candidates with real-time location support
   * @param {string} mode - "for_you" | "nearby" | "matches"
   * @param {number} limit - Max number of results
   * @param {object} options - Configuration
   * @param {number} [options.lat] - Current latitude
   * @param {number} [options.lng] - Current longitude
   * @param {boolean} [options.ignoreSwiped] - Include previously swiped profiles
   * @param {boolean} [options.debug] - Enable debug logging
   * @param {AbortSignal} [options.signal] - Abort signal for cancellation
   */
  list: async (mode = "for_you", limit = 20, options = {}) => {
    const {
      lat = null,
      lng = null,
      signal = null,
      ignoreSwiped = false,
      debug: debugOption = false,
    } = options;

    // Debug mode from multiple sources
    const debug =
      debugOption ||
      localStorage.getItem("DEBUG_DISCOVER") === "1" ||
      new URLSearchParams(window.location.search).get("debug") === "1";

    // Ignore swiped from multiple sources
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
      console.group("🔍 Discover Request");
      console.log("Mode:", mode);
      console.log("Limit:", limit);
      console.log("Location:", lat != null && lng != null ? { lat, lng } : "Not provided");
      console.log("Ignore Swiped:", shouldIgnoreSwiped);
      console.groupEnd();
    }

    // Try API first
    let items = await listViaApi(mode, limit, requestOptions);
    if (items.length) {
      if (debug) console.log("✅ Using API results:", items.length, "items");
      return items;
    }

    // Try RPC as fallback
    if (debug) console.warn("⚠️ API returned no results, trying RPC...");
    items = await listViaRpc(mode, limit, {
      ...requestOptions,
      ignoreSwiped: true, // Force in dev to unblock
    });

    if (items.length) {
      if (debug) console.log("✅ Using RPC results:", items.length, "items");
      return items;
    }

    // Final fallback: raw profiles
    if (debug) console.warn("⚠️ RPC returned no results, using fallback...");
    items = await listViaProfiles(limit, requestOptions);

    if (debug) {
      console.log(
        items.length
          ? `✅ Using fallback: ${items.length} items`
          : "❌ No results from any source"
      );
    }

    return items;
  },

  /**
   * Record a swipe action
   * @param {string} profileId - Target profile ID
   * @param {string} action - "like" | "pass" | "superlike"
   */
  swipe: async (profileId, action) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("swipes")
        .upsert({
          user_id: user.id,
          target_id: profileId,
          action,
          swiped_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,target_id",
        });

      if (error) throw error;

      // Check for mutual like (match)
      if (action === "like" || action === "superlike") {
        const { data: mutualSwipe } = await supabase
          .from("swipes")
          .select("action")
          .eq("user_id", profileId)
          .eq("target_id", user.id)
          .in("action", ["like", "superlike"])
          .maybeSingle();

        if (mutualSwipe) {
          // Create match
          await discoverService.createMatch(user.id, profileId);
          return { matched: true };
        }
      }

      return { matched: false };
    } catch (error) {
      console.error("Swipe failed:", error);
      throw error;
    }
  },

  /**
   * Create a mutual match
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   */
  createMatch: async (userId1, userId2) => {
    try {
      const { error } = await supabase
        .from("matches")
        .insert({
          user1_id: userId1 < userId2 ? userId1 : userId2,
          user2_id: userId1 < userId2 ? userId2 : userId1,
          matched_at: new Date().toISOString(),
        });

      if (error && error.code !== "23505") { // Ignore duplicate
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Create match failed:", error);
      return false;
    }
  },

  /**
   * Get user's matches
   * @param {number} limit - Max results
   */
  getMatches: async (limit = 50) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          user1:profiles!matches_user1_id_fkey(id, display_name, avatar_url, city),
          user2:profiles!matches_user2_id_fkey(id, display_name, avatar_url, city)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("matched_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Map to profiles
      return (data || []).map((match) => {
        const isUser1 = match.user1_id === user.id;
        const otherProfile = isUser1 ? match.user2 : match.user1;
        return {
          ...otherProfile,
          matched_at: match.matched_at,
        };
      });
    } catch (error) {
      console.error("Get matches failed:", error);
      return [];
    }
  },

  /**
   * Check if user has swiped on a profile
   * @param {string} profileId - Target profile ID
   */
  hasSwipedOn: async (profileId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("swipes")
        .select("action")
        .eq("user_id", user.id)
        .eq("target_id", profileId)
        .maybeSingle();

      if (error) throw error;
      return data?.action || null;
    } catch (error) {
      console.error("Check swipe failed:", error);
      return null;
    }
  },

  /**
   * Get single profile by ID
   * @param {string} profileId - Profile ID
   */
  getProfile: async (profileId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Get profile failed:", error);
      return null;
    }
  },

  /**
   * Prefetch candidates for caching
   * @param {string} mode - Mode to prefetch
   * @param {object} options - Options
   */
  prefetch: async (mode, options = {}) => {
    return await discoverService.list(mode, 20, {
      ...options,
      debug: false,
    });
  },

  /**
   * Unlike/undo a swipe
   * @param {string} profileId - Target profile ID
   */
  undoSwipe: async (profileId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("swipes")
        .delete()
        .eq("user_id", user.id)
        .eq("target_id", profileId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Undo swipe failed:", error);
      return false;
    }
  },

  /**
   * Get swipe statistics
   */
  getStats: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [
        { count: totalSwipes },
        { count: likes },
        { count: matches },
      ] = await Promise.all([
        supabase
          .from("swipes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("swipes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("action", ["like", "superlike"]),
        supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
      ]);

      return {
        totalSwipes: totalSwipes || 0,
        likes: likes || 0,
        passes: (totalSwipes || 0) - (likes || 0),
        matches: matches || 0,
      };
    } catch (error) {
      console.error("Get stats failed:", error);
      return null;
    }
  },
};