// api/subscription/me.js
import { requireUser } from "../_supabase.js";
export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { data, error } = await supabase.from("profiles").select("is_premium").eq("id", user.id).single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ is_premium: !!data?.is_premium });
}