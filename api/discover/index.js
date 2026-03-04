import { requireUser } from "../lib/_supabase.js";

// Haversine in km
function kmBetween(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const la1 = toRad(aLat), la2 = toRad(bLat);
  const a = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET"); return res.status(405).end();
  }
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;

  const limit = Number(req.query.limit || 20);
  const mode = String(req.query.mode || "for_you");
  const ignore_swiped = !!req.query.ignore_swiped;

  // Try RPC first (has match_score + distance_km)
  const { data, error } = await supabase
    .rpc("discover_candidates", { uid: user.id, mode, lim: limit, ignore_swiped })
    .catch(e => ({ data: null, error: e }));

  let items = (data || []).map(d => ({ ...d, match_score: Math.round(Number(d.match_score || 0)) }));

  // Fallback if RPC is empty or errored
  if (!items.length) {
    // 1) Load my coords and interests
    const [{ data: me }, { data: myInts }] = await Promise.all([
      supabase.from("profiles").select("id, lat, lng").eq("id", user.id).maybeSingle(),
      supabase.from("user_interests").select("interest_id").eq("user_id", user.id),
    ]);
    const mySet = new Set((myInts || []).map(r => r.interest_id));

    // 2) Load candidates (others)
    const { data: others, error: e2 } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, dob, gender")
      .neq("id", user.id)
      .limit(limit);
    if (e2) return res.status(500).json({ error: e2.message });

    // 3) Load candidates' interests in bulk
    const ids = (others || []).map(o => o.id);
    let byUser = {};
    if (ids.length) {
      const { data: candInts } = await supabase
        .from("user_interests")
        .select("user_id, interest_id")
        .in("user_id", ids);
      byUser = (candInts || []).reduce((acc, r) => {
        (acc[r.user_id] ||= new Set()).add(r.interest_id);
        return acc;
      }, {});
    }

    // 4) Compute Jaccard*100 and distance for each fallback item
    const mineLat = me?.lat, mineLng = me?.lng;
    items = (others || []).map(o => {
      const theirSet = byUser[o.id] || new Set();
      const inter = new Set([...mySet].filter(x => theirSet.has(x))).size;
      const uni = new Set([...mySet, ...theirSet]).size || 1;
      const score = Math.round((inter / uni) * 100);

      let distance_km = null;
      if ([mineLat, mineLng, o.lat, o.lng].every(v => v != null)) {
        distance_km = Math.round(kmBetween(+mineLat, +mineLng, +o.lat, +o.lng) * 10) / 10;
      }

      const age = o.dob ? Math.floor((Date.now() - new Date(o.dob).getTime()) / (365.25*24*3600*1000)) : null;

      return {
        id: o.id,
        display_name: o.display_name,
        avatar_url: o.avatar_url,
        city: o.city,
        lat: o.lat, lng: o.lng,
        age,
        distance_km,
        match_score: score,
      };
    });

    // 5) Sort by mode
    if (mode === "nearby") items.sort((a,b) => {
      if (a.distance_km == null && b.distance_km == null) return 0;
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      return a.distance_km - b.distance_km;
    });
    if (mode === "matches") items.sort((a,b) => (b.match_score||0) - (a.match_score||0));
  }

  return res.json({ items });
}