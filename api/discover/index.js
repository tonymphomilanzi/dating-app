import { requireUser } from "../lib/_supabase.js";

// Haversine distance in kilometers
function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return; // User not authenticated
  const { supabase, user } = ctx;

  const limit = Number(req.query.limit || 20);
  const mode = String(req.query.mode || "for_you");
  const ignoreSwiped = !!req.query.ignore_swiped;

  // --------------------------
  // 1) Try RPC first (match_score + distance_km)
  // --------------------------
  const { data: rpcData, error: rpcError } = await supabase.rpc("discover_candidates", {
    uid: user.id,
    mode,
    lim: limit,
    ignore_swiped: ignoreSwiped,
  });

  let items = (rpcData || []).map(d => ({
    ...d,
    match_score: Math.round(Number(d.match_score || 0)),
  }));

  // --------------------------
  // 2) Fallback if RPC fails or returns empty
  // --------------------------
  if (!items.length || rpcError) {
    if (rpcError) console.warn("RPC failed, falling back:", rpcError.message);

    // a) Load current user profile and interests
    const [{ data: me }, { data: myInterests }] = await Promise.all([
      supabase.from("profiles").select("id, lat, lng").eq("id", user.id).maybeSingle(),
      supabase.from("user_interests").select("interest_id").eq("user_id", user.id),
    ]);
    const myInterestSet = new Set((myInterests || []).map(i => i.interest_id));

    // b) Load candidate profiles
    const { data: candidates, error: candError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, dob, gender")
      .neq("id", user.id)
      .limit(limit);

    if (candError) return res.status(500).json({ error: candError.message });

    // c) Load candidates' interests in bulk
    const candidateIds = (candidates || []).map(c => c.id);
    let candidateInterestsMap = {};
    if (candidateIds.length) {
      const { data: candInts } = await supabase
        .from("user_interests")
        .select("user_id, interest_id")
        .in("user_id", candidateIds);

      candidateInterestsMap = (candInts || []).reduce((acc, row) => {
        (acc[row.user_id] ||= new Set()).add(row.interest_id);
        return acc;
      }, {});
    }

    // d) Compute match_score and distance
    const myLat = me?.lat;
    const myLng = me?.lng;

    items = (candidates || []).map(c => {
      const theirSet = candidateInterestsMap[c.id] || new Set();
      const shared = new Set([...myInterestSet].filter(x => theirSet.has(x))).size;
      const union = new Set([...myInterestSet, ...theirSet]).size || 1;
      const score = Math.round((shared / union) * 100);

      let distance = null;
      if ([myLat, myLng, c.lat, c.lng].every(v => v != null)) {
        distance = Math.round(kmBetween(+myLat, +myLng, +c.lat, +c.lng) * 10) / 10;
      }

      const age = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

      return {
        id: c.id,
        display_name: c.display_name,
        avatar_url: c.avatar_url,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
        age,
        distance_km: distance,
        match_score: score,
      };
    });

    // e) Sort items based on mode
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

  // --------------------------
  // 3) Return results
  // --------------------------
  return res.json({ items });
}