// api/events/index.js
import { requireUser, getPremiumFlag } from "../_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;

  if (req.method === "GET") {
    const { lat, lng, limit } = req.query;
    let q = supabase.from("events").select("id, title, description, cover_url, starts_at, ends_at, city, lat, lng, creator_id, created_at");
    // order by soonest
    q = q.order("starts_at", { ascending: true });
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    // Optional: compute distances client-side; or here if lat/lng provided
    let items = data || [];
    if (lat && lng) {
      const meLat = Number(lat), meLng = Number(lng);
      items = items.map(e => {
        if (e.lat == null || e.lng == null) return { ...e, distance_km: null };
        const R = 6371, dLat=(e.lat-meLat)*Math.PI/180, dLng=(e.lng-meLng)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(meLat*Math.PI/180)*Math.cos(e.lat*Math.PI/180)*Math.sin(dLng/2)**2;
        const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return { ...e, distance_km: Math.round(R*c*10)/10 };
      });
    }
    if (limit) items = items.slice(0, Number(limit));
    return res.json({ items });
  }

  if (req.method === "POST") {
    const isPremium = await getPremiumFlag(supabase, user.id);
    if (!isPremium) {
      // enforce 1 active event (upcoming or ongoing)
      const { count, error: e2 } = await supabase
        .from("events").select("*", { count: "exact", head: true })
        .eq("creator_id", user.id)
        .gte("starts_at", new Date().toISOString());
      if (e2) return res.status(500).json({ error: e2.message });
      if ((count || 0) >= 1) return res.status(402).json({ error: "Event limit reached. Go Premium." });
    }

    const body = req.body || {};
    const payload = {
      creator_id: user.id,
      title: body.title,
      description: body.description,
      cover_url: body.cover_url || null,
      starts_at: body.starts_at,
      ends_at: body.ends_at || null,
      city: body.city || null,
      lat: body.lat || null,
      lng: body.lng || null,
      capacity: body.capacity || null,
    };
    const { data, error } = await supabase.from("events").insert(payload).select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ event: data });
  }

  res.setHeader("Allow", "GET,POST"); return res.status(405).end();
}