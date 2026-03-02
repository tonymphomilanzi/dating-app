// api/chat/[id].js
import { requireUser, getPremiumFlag } from "../_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { id } = req.query;

  if (req.method === "GET") {
    const isPremium = await getPremiumFlag(supabase, user.id);
    const limit = Number(req.query.limit || 50);
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, text, attachment_url, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return res.status(400).json({ error: error.message });

    const items = (data || []).map(m => ({
      ...m,
      text: isPremium ? m.text : (m.sender_id === user.id ? m.text : "•••••••••• (Premium)"),
      blurred: !isPremium && m.sender_id !== user.id
    }));
    return res.json({ items });
  }

  if (req.method === "POST") {
    const { text, attachment_url } = req.body || {};
    if (!text && !attachment_url) return res.status(400).json({ error: "text or attachment_url required" });

    // if this is the first message, chat/index POST enforces start caps; we allow send here freely
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, text, attachment_url })
      .select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ message: data });
  }

  res.setHeader("Allow", "GET,POST"); return res.status(405).end();
}