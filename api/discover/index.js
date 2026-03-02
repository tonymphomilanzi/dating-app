// api/discover/index.js
import { requireUser } from "../_supabase.js";
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET"); return res.status(405).end();
  }
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const limit = Number(req.query.limit || 20);
  const mode = String(req.query.mode || "for_you"); // 'for_you' | 'nearby' | 'matches'
  const { data, error } = await supabase.rpc("discover_candidates", { uid: user.id, mode, lim: limit });
  if (error) return res.status(500).json({ error: error.message });
  // normalize match_score 0-100
  const items = (data || []).map(d => ({ ...d, match_score: Math.round(Number(d.match_score || 0)) }));
  return res.json({ items });
}