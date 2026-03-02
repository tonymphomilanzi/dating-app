// api/swipes/index.js
import { requireUser, getPremiumFlag } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST"); return res.status(405).end();
  }
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { targetUserId, dir } = req.body || {};

  if (!targetUserId || !["left","right","super"].includes(dir)) {
    return res.status(400).json({ error: "Invalid body" });
  }

  if (dir === "super") {
    const isPremium = await getPremiumFlag(supabase, user.id);
    if (!isPremium) {
      const { count, error: e2 } = await supabase
        .from("swipes").select("*", { count: "exact", head: true })
        .eq("swiper_id", user.id).eq("dir","super");
      if (e2) return res.status(500).json({ error: e2.message });
      if ((count || 0) >= 2) return res.status(402).json({ error: "Super-like limit reached. Go Premium." });
    }
  }

  const { error } = await supabase
    .from("swipes")
    .upsert({ swiper_id: user.id, swipee_id: targetUserId, dir }, { onConflict: "swiper_id,swipee_id" });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ ok: true });
}