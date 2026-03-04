// api/matches/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET"); return res.status(405).end();
  }
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const isPremium = await getPremiumFlag(supabase, user.id);

  const { data, error } = await supabase
    .from("matches")
    .select(`
      id, created_at, last_message_at, user_a_id, user_b_id,
      a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url),
      b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url),
      conversations ( id )
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  let items = (data || []).map(m => {
    const other = m.user_a_id === user.id ? m.b : m.a;
    return { id: m.id, conversationId: m.conversations?.id, other, created_at: m.created_at, last_message_at: m.last_message_at };
  });

  if (!isPremium) items = items.slice(0, 5);
  return res.json({ items, limited: !isPremium });
}