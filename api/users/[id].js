// api/users/[id].js
import { requireUser, supabaseFromReq } from "../_supabase.js";
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET"); return res.status(405).end();
  }
  const ctx = await requireUser(req, res); if (!ctx) return;
  const supabase = supabaseFromReq(req);
  const { id } = req.query;
  const { data, error } = await supabase
    .from("profile_public")
    .select("id, display_name, age, avatar_url, city, lat, lng, gender, bio")
    .eq("id", id).single();
  if (error) return res.status(404).json({ error: error.message });
  return res.json({ profile: data });
}