// api/me.js
import { requireUser } from "./lib/_supabase.js";
export default async function handler(req, res) {
  if (req.method === "GET") {
    const ctx = await requireUser(req, res); if (!ctx) return;
    const { supabase, user } = ctx;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, display_name, bio, dob, gender, avatar_url, city, lat, lng, is_premium")
      .eq("id", user.id).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ profile });
  }

  if (req.method === "PATCH") {
    const ctx = await requireUser(req, res); if (!ctx) return;
    const { supabase, user } = ctx;
    const body = req.body || {};
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: body.display_name,
        bio: body.bio,
        dob: body.dob,
        gender: body.gender,
        city: body.city,
        lat: body.lat,
        lng: body.lng,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ profile: data });
  }

  res.setHeader("Allow", "GET,PATCH");
  return res.status(405).end();
}