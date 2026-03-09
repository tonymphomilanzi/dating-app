// api/matches/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;
  const isPremium = await getPremiumFlag(supabase, user.id);

  const { data, error } = await supabase
    .from("matches")
    .select(`
      id, 
      created_at, 
      last_message_at, 
      user_a_id, 
      user_b_id,
      a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url, city, lat, lng),
      b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url, city, lat, lng),
      conversations(id)
    `)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let items = (data || []).map((match) => {
    const isUserA = match.user_a_id === user.id;
    const otherProfile = isUserA ? match.b : match.a;

    return {
      id: match.id,
      conversationId: match.conversations?.[0]?.id || match.conversations?.id || null,
      other: otherProfile,
      created_at: match.created_at,
      last_message_at: match.last_message_at,
      isNew: !match.last_message_at, // New match if no messages yet
    };
  });

  // Limit for non-premium users
  const totalCount = items.length;
  if (!isPremium) {
    items = items.slice(0, 5);
  }

  return res.json({
    items,
    total: totalCount,
    limited: !isPremium && totalCount > 5,
  });
}