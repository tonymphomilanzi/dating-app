// src/services/discover.service.js
import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

const normalizeResponse = (response) => {
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response)) return response;
  return [];
};

async function listViaApi(mode, limit, options) {
  const { ignore_swiped, debug, lat, lng, signal } = options;
  
  const params = { mode, limit };
  if (ignore_swiped) params.ignore_swiped = 1;
  if (debug) params.debug = 1;
  
  // Pass real-time location if available
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
        ignore_swiped,
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

async function listViaRpc(mode, limit, options) {
  const { ignore_swiped, debug, lat, lng } = options;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error("timeout:rpc:6000ms"));
    }, 6000);

    const rpcParams = {
      uid: user.id,
      mode,
      lim: limit,
      ignore_swiped: !!ignore_swiped,
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
        ignore_swiped,
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

async function listViaProfiles(limit, options) {
  const { debug } = options;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error("timeout:profiles:4000ms"));
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
      
      return {
        id: profile.id,
        display_name: profile.display_name,
        age,
        avatar_url: profile.avatar_url,
        city: profile.city,
        lat: profile.lat,
        lng: profile.lng,
        distance_km: null,
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

export const discoverService = {
  /**
   * List discover candidates with real-time location support
   * @param {string} mode - "for_you" | "nearby" | "matches"
   * @param {number} limit - Max number of results
   * @param {object} options - Configuration options
   * @param {number} options.lat - Current latitude (real-time)
   * @param {number} options.lng - Current longitude (real-time)
   * @param {boolean} options.ignore_swiped - Include previously swiped profiles
   * @param {boolean} options.debug - Enable debug logging
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   */
  list: async (mode = "for_you", limit = 20, options = {}) => {
    // Extract options with defaults
    const {
      lat = null,
      lng = null,
      signal = null,
      ignore_swiped = false,
      debug: debugOption = false,
    } = options;
    
    // Debug mode detection (from options, localStorage, or URL)
    const debug =
      debugOption ||
      localStorage.getItem("DEBUG_DISCOVER") === "1" ||
      new URLSearchParams(window.location.search).get("debug") === "1";
    
    // Ignore swiped detection
    const shouldIgnoreSwiped =
      ignore_swiped ||
      localStorage.getItem("DEBUG_DISCOVER_IGNORE") === "1" ||
      new URLSearchParams(window.location.search).get("ignore_swiped") === "1";

    const requestOptions = {
      ignore_swiped: shouldIgnoreSwiped,
      debug,
      lat,
      lng,
      signal,
    };

    if (debug) {
      console.group("Discover Request");
      console.log("Mode:", mode);
      console.log("Limit:", limit);
      console.log("Location:", lat != null && lng != null ? { lat, lng } : "Not provided");
      console.log("Ignore Swiped:", shouldIgnoreSwiped);
      console.groupEnd();
    }

    // 1) Try API endpoint first (authenticated, full features)
    let items = await listViaApi(mode, limit, requestOptions);
    if (items.length) {
      if (debug) {
        console.log("Using API results:", items.length, "items");
      }
      return items;
    }

    // 2) Try RPC as fallback (force ignore_swiped to get results)
    if (debug) {
      console.warn("API returned no results, trying RPC...");
    }
    
    items = await listViaRpc(mode, limit, { 
      ...requestOptions, 
      ignore_swiped: true // Force to get results in dev
    });
    
    if (items.length) {
      if (debug) {
        console.log("Using RPC results:", items.length, "items");
      }
      return items;
    }

    // 3) Final fallback: raw profiles (dev safety net)
    if (debug) {
      console.warn("RPC returned no results, using fallback profiles...");
    }
    
    items = await listViaProfiles(limit, requestOptions);
    
    if (debug) {
      console.log(
        items.length 
          ? `Using fallback results: ${items.length} items` 
          : "No results from any source"
      );
    }
    
    return items;
  },

  /**
   * Prefetch candidates for a given mode (for caching)
   */
  prefetch: async (mode, options = {}) => {
    const items = await discoverService.list(mode, 20, { 
      ...options, 
      debug: false 
    });
    return items;
  },

  /**
   * Get a single profile by ID
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
      console.error("Failed to get profile:", error);
      return null;
    }
  },
};