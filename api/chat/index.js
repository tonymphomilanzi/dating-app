// api/chat/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

async function listConversations(supabase, userId) {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id, match_id, user_a_id, user_b_id, created_at, last_message_at,
      match:matches ( id, user_a_id, user_b_id,
        a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url),
        b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url)
      ),
      last:messages ( id, text, created_at, sender_id )
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Normalize other user
  const items = (data || []).map(c => {
    let other = null;
    if (c.user_a_id && c.user_b_id) {
      const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
      other = { id: otherId };
    } else if (c.match) {
      const otherP = c.match.user_a_id === userId ? c.match.b : c.match.a;
      other = otherP ? { id: otherP.id, display_name: otherP.display_name, avatar_url: otherP.avatar_url } : null;
    }
    let last = null;
    if (Array.isArray(c.last) && c.last.length) {
      last = c.last.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))[0];
    }
    return {
      id: c.id,
      other,
      match_id: c.match_id,
      last_message_at: c.last_message_at || c.created_at,
      created_at: c.created_at,
      last,
      user_a_id: c.user_a_id, user_b_id: c.user_b_id
    };
  });

  // Enrich missing other's profile
  const missingIds = Array.from(new Set(items.filter(i => i.other && !i.other.display_name).map(i => i.other.id)));
  if (missingIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", missingIds);
    const map = Object.fromEntries((profs||[]).map(p=>[p.id, p]));
    items.forEach(i => {
      if (i.other && !i.other.display_name) {
        const p = map[i.other.id];
        if (p) Object.assign(i.other, { display_name: p.display_name, avatar_url: p.avatar_url });
      }
    });
  }

  // Unread counts (per conv): count messages after last read and not sent by me
  const convIds = items.map(i=>i.id);
  const { data: reads } = await supabase
    .from("conversation_reads")
    .select("conversation_id, last_read_message_id")
    .eq("user_id", userId)
    .in("conversation_id", convIds);

  const lastReadByConv = Object.fromEntries((reads||[]).map(r=>[r.conversation_id, r.last_read_message_id || 0]));

  // Warning: this loops queries per conv (OK at small scale). Consider an RPC to batch later.
  for (const it of items) {
    const lastReadId = lastReadByConv[it.id] || 0;
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", it.id)
      .gt("id", lastReadId)
      .neq("sender_id", userId);
    it.unreadCount = count || 0;
  }

  // Cleanup noisy fields
  items.forEach(i => { delete i.user_a_id; delete i.user_b_id; });

  return items;
}

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;

  if (req.method === "GET") {
    try {
      const isPremium = await getPremiumFlag(supabase, user.id);
      let items = await listConversations(supabase, user.id);

      // Sort by activity
      items.sort((a,b)=> new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));

      // Blur rule: non-premium → only top 5 clear
      const unlockedIds = isPremium ? new Set(items.map(i=>i.id)) : new Set(items.slice(0,5).map(i=>i.id));
      items = items.map(i => {
        const blurred = !unlockedIds.has(i.id);
        const last = i.last
          ? { ...i.last, text: blurred ? "•••••••••• (Premium)" : i.last.text, blurred }
          : null;
        return { ...i, last, blurred };
      });

      return res.json({ items, limited: !isPremium, unlockedCount: unlockedIds.size });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Failed to load" });
    }
  }

  if (req.method === "POST") {
    // Open or send (DM or match-based)
    const { userId: otherId, matchId, text } = req.body || {};
    try {
      if (otherId) {
        const meId = user.id;
        const a = meId < otherId ? meId : otherId;
        const b = meId < otherId ? otherId : meId;

        let { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_a_id", a)
          .eq("user_b_id", b)
          .maybeSingle();

        if (!existing) {
          const ins = await supabase.from("conversations").insert({ user_a_id: a, user_b_id: b }).select("id").single();
          if (ins.error) throw ins.error;
          existing = ins.data;
        }
        let msg = null;
        if (text && text.trim()) {
          const s = await supabase.from("messages").insert({ conversation_id: existing.id, sender_id: user.id, text }).select("*").single();
          if (s.error) throw s.error;
          msg = s.data;
        }
        return res.json({ conversation: existing, message: msg });
      }

      if (matchId) {
        const { data: existing, error } = await supabase.from("conversations").select("id").eq("match_id", matchId).maybeSingle();
        if (error) throw error;
        if (!existing) throw new Error("Conversation not found");
        let msg = null;
        if (text && text.trim()) {
          const s = await supabase.from("messages").insert({ conversation_id: existing.id, sender_id: user.id, text }).select("*").single();
          if (s.error) throw s.error;
          msg = s.data;
        }
        return res.json({ conversation: existing, message: msg });
      }

      return res.status(400).json({ error: "Provide userId or matchId" });
    } catch (e) {
      return res.status(400).json({ error: e.message || "Failed to open/send" });
    }
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).end();
}