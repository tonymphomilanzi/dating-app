// api/swipes/undo.js
import { requireUser } from "../lib/_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;
  const { targetUserId } = req.body || {};

  if (!targetUserId) {
    return res.status(400).json({ error: "targetUserId required" });
  }

  // Delete the swipe
  const { error } = await supabase
    .from("swipes")
    .delete()
    .eq("swiper_id", user.id)
    .eq("swipee_id", targetUserId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ ok: true });
}