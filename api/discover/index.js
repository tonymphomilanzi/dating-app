// api/discover/index.js
import { requireUser } from "../lib/_supabase.js";

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseNumber(value) {
  if (value == null) return null;
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;

  const limit = Number(req.query.limit || 20);
  const mode = String(req.query.mode || "for_you");
  const ignoreSwiped = !!req.query.ignore_swiped;
  
  // Use passed location (real-time) or fall back to profile location
  const passedLat = parseNumber(req.query.lat);
  const passedLng = parseNumber(req.query.lng);

  // Get user's profile location as fallback
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("lat, lng")
    .eq("id", user.id)
    .maybeSingle();

  // Prefer passed location over stored location
  const myLat = passedLat ?? parseNumber(userProfile?.lat);
  const myLng = passedLng ?? parseNumber(userProfile?.lng);
  const hasLocation = myLat != null && myLng != null;

  // --------------------------
  // 1) Try RPC first
  // --------------------------
  const { data: rpcData, error: rpcError } = await supabase.rpc("discover_candidates", {
    uid: user.id,
    mode,
    lim: limit,
    ignore_swiped: ignoreSwiped,
    user_lat: myLat,
    user_lng: myLng,
  });

  let items = (rpcData || []).map((candidate) => {
    let distanceKm = candidate.distance_km;
    
    // Recalculate distance with current location if available
    if (hasLocation && candidate.lat != null && candidate.lng != null) {
      distanceKm = Math.round(kmBetween(myLat, myLng, candidate.lat, candidate.lng) * 10) / 10;
    }
    
    return {
      ...candidate,
      distance_km: distanceKm,
      match_score: Math.round(Number(candidate.match_score || 0)),
    };
  });

  // --------------------------
  // 2) Fallback if RPC fails or returns empty
  // --------------------------
  if (!items.length || rpcError) {
    if (rpcError) {
      console.warn("RPC failed, falling back:", rpcError.message);
    }

    // Load current user's interests
    const { data: myInterests } = await supabase
      .from("user_interests")
      .select("interest_id")
      .eq("user_id", user.id);
    
    const myInterestSet = new Set((myInterests || []).map((interest) => interest.interest_id));

    // Load candidate profiles
    const { data: candidates, error: candidatesError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, dob, gender")
      .neq("id", user.id)
      .limit(limit);

    if (candidatesError) {
      return res.status(500).json({ error: candidatesError.message });
    }

    // Load candidates' interests in bulk
    const candidateIds = (candidates || []).map((candidate) => candidate.id);
    let candidateInterestsMap = {};
    
    if (candidateIds.length) {
      const { data: candidateInterests } = await supabase
        .from("user_interests")
        .select("user_id, interest_id")
        .in("user_id", candidateIds);

      candidateInterestsMap = (candidateInterests || []).reduce((acc, row) => {
        if (!acc[row.user_id]) {
          acc[row.user_id] = new Set();
        }
        acc[row.user_id].add(row.interest_id);
        return acc;
      }, {});
    }

    // Compute match score and distance for each candidate
    items = (candidates || []).map((candidate) => {
      const candidateInterests = candidateInterestsMap[candidate.id] || new Set();
      
      // Calculate match score (Jaccard similarity)
      const sharedInterests = new Set(
        [...myInterestSet].filter((interest) => candidateInterests.has(interest))
      );
      const unionSize = new Set([...myInterestSet, ...candidateInterests]).size || 1;
      const matchScore = Math.round((sharedInterests.size / unionSize) * 100);

      // Calculate distance
      let distanceKm = null;
      const candidateLat = parseNumber(candidate.lat);
      const candidateLng = parseNumber(candidate.lng);
      
      if (hasLocation && candidateLat != null && candidateLng != null) {
        distanceKm = Math.round(kmBetween(myLat, myLng, candidateLat, candidateLng) * 10) / 10;
      }

      // Calculate age
      let age = null;
      if (candidate.dob) {
        const birthDate = new Date(candidate.dob);
        const ageMs = Date.now() - birthDate.getTime();
        age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
      }

      return {
        id: candidate.id,
        display_name: candidate.display_name,
        avatar_url: candidate.avatar_url,
        city: candidate.city,
        lat: candidateLat,
        lng: candidateLng,
        age,
        distance_km: distanceKm,
        match_score: matchScore,
      };
    });

    // Sort based on mode
    if (mode === "nearby") {
      items.sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
    } else if (mode === "matches") {
      items.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    }
  }

  return res.json({ items });
}