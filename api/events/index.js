// api/events/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;

  if (req.method === "GET") {
    // you can keep your existing list logic or leave as-is for now
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, cover_url, starts_at, ends_at, city, lat, lng, capacity, category, price, creator_id, created_at")
      .order("starts_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === "POST") {
    // free users: 1 upcoming event limit (keep from earlier if you want)
    const isPremium = await getPremiumFlag(supabase, user.id);
    if (!isPremium) {
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
      description: body.description || null,
      cover_url: body.cover_url || null,
      starts_at: body.starts_at,
      ends_at: body.ends_at || null,
      city: body.city || null,
      lat: body.lat || null,
      lng: body.lng || null,
      capacity: body.capacity || null,
      category: body.category || null,
      price: body.price || null,
    };

    const { data, error } = await supabase.from("events").insert(payload).select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ event: data });
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).end();
}