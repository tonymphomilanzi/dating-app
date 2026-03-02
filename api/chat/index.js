// api/chat/index.js
import { requireUser, getPremiumFlag } from "../_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;

  if (req.method === "GET") {
    const isPremium = await getPremiumFlag(supabase, user.id);

    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id, created_at,
        match:matches ( id, user_a_id, user_b_id, last_message_at,
          a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url),
          b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url)
        ),
        last:messages ( id, text, created_at, sender_id )
      `);

    if (error) return res.status(500).json({ error: error.message });

    const items = (data || []).map(c => {
      const other = c.match.user_a_id === user.id ? c.match.b : c.match.a;
      const last = Array.isArray(c.last) && c.last.length ? c.last.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0] : null;
      const lastText = isPremium ? (last?.text || null) : (last ? "•••••••••• (Premium)" : null);
      return { id: c.id, other, last: last ? { ...last, text: lastText, blurred: !isPremium } : null };
    });

    return res.json({ items });
  }

  if (req.method === "POST") {
    const { matchId, text } = req.body || {};
    if (!matchId || !text) return res.status(400).json({ error: "matchId and text required" });

    const isPremium = await getPremiumFlag(supabase, user.id);

    // find conversation for match
    const { data: convo, error } = await supabase
      .from("conversations")
      .select("id, starter_user_id")
      .eq("match_id", matchId)
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // If no starter yet and user is about to start convo, enforce cap
    if (!isPremium && !convo.starter_user_id) {
      const { count, error: e2 } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("starter_user_id", user.id);
      if (e2) return res.status(500).json({ error: e2.message });
      if ((count || 0) >= 3) return res.status(402).json({ error: "Conversation start limit reached. Go Premium." });
    }

    const { data: msg, error: err2 } = await supabase
      .from("messages")
      .insert({ conversation_id: convo.id, sender_id: user.id, text })
      .select("*")
      .single();
    if (err2) return res.status(400).json({ error: err2.message });
    return res.json({ message: msg });
  }

  res.setHeader("Allow", "GET,POST"); return res.status(405).end();
}