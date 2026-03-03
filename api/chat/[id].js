// api/chat/[id].js
import { requireUser, getPremiumFlag } from "../_supabase.js";

async function computeUnlockedSet(supabase, userId, isPremium) {
  if (isPremium) return new Set(); // means no lock
  const { data, error } = await supabase
    .from("conversations")
    .select("id, last_message_at, created_at, user_a_id, user_b_id, match_id")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const mine = (data || []).filter(c =>
    c.user_a_id === userId || c.user_b_id === userId || c.match_id != null
  );
  const top = mine.slice(0,5).map(c=>c.id);
  return new Set(top);
}

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const isPremium = await getPremiumFlag(supabase, user.id);
      const unlocked = await computeUnlockedSet(supabase, user.id, isPremium);

      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, text, attachment_url, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const blurredConv = !isPremium && !unlocked.has(id);
      const items = (data || []).map(m => ({
        ...m,
        text: blurredConv ? "•••••••••• (Premium)" : m.text,
        blurred: blurredConv
      }));
      return res.json({ items, blurred: blurredConv });
    } catch (e) {
      return res.status(400).json({ error: e.message || "Failed to load messages" });
    }
  }

  if (req.method === "POST") {
    const { text, attachment_url } = req.body || {};
    if (!text && !attachment_url) return res.status(400).json({ error: "text or attachment_url required" });

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: user.id, text, attachment_url })
        .select("*").single();
      if (error) throw error;
      return res.json({ message: data });
    } catch (e) {
      return res.status(400).json({ error: e.message || "Failed to send" });
    }
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).end();
}