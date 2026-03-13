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

  const mode = String(req.query.mode || "matches");
  const countOnly = String(req.query.count_only || "false") === "true";
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  const isPremium = await getPremiumFlag(supabase, user.id);

  // Helper: get all userIds that are blocked with me (either direction)
  async function getBlockedUserIds() {
    const { data: blk, error: blkErr } = await supabase
      .from("blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    if (blkErr) return new Set();
    const set = new Set();
    for (const b of blk || []) {
      if (b.blocker_id === user.id) set.add(b.blocked_id);
      if (b.blocked_id === user.id) set.add(b.blocker_id);
    }
    return set;
  }

  if (mode === "likes") {
    // People who liked me but I haven't swiped back on yet
    const { data: likedMe, error: likesError } = await supabase
      .from("swipes")
      .select(`
        id,
        created_at,
        swiper_id,
        dir,
        swiper:profiles!swipes_swiper_id_fkey(
          id, display_name, avatar_url, city, dob, gender
        )
      `)
      .eq("swipee_id", user.id)
      .in("dir", ["right", "super"])
      .order("created_at", { ascending: false });

    if (likesError) {
      return res.status(500).json({ error: likesError.message });
    }

    // My swipes (to filter those I already responded to)
    const { data: mySwipes, error: myErr } = await supabase
      .from("swipes")
      .select("swipee_id, dir")
      .eq("swiper_id", user.id);

    if (myErr) {
      return res.status(500).json({ error: myErr.message });
    }

    const mySwipesMap = new Map((mySwipes || []).map((s) => [s.swipee_id, s.dir]));
    const blockedIds = await getBlockedUserIds();

    // Filter and map payload
    let items = (likedMe || [])
      .filter((like) => !!like.swiper?.id)
      .filter((like) => !mySwipesMap.has(like.swiper_id))  // not responded yet
      .filter((like) => !blockedIds.has(like.swiper_id))   // not blocked either way
      .map((like) => {
        const profile = like.swiper;
        let age = null;
        if (profile?.dob) {
          const birthDate = new Date(profile.dob);
          age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
        return {
          id: like.id,
          liked_at: like.created_at,
          is_super: like.dir === "super",
          other: {
            id: profile?.id,
            display_name: profile?.display_name,
            avatar_url: profile?.avatar_url,
            city: profile?.city,
            age,
          },
        };
      });

    const total = items.length;
    if (countOnly) {
      return res.json({ count: total });
    }

    // Premium gating
    const visible = isPremium ? items : items.slice(0, 5);
    // Optional pagination after gating
    const paged = visible.slice(offset, offset + limit);

    return res.json({
      items: paged,
      total,
      limited: !isPremium && total > 5,
    });
  }

  // Mode: matches (mutual likes)
  const { data, error } = await supabase
    .from("matches")
    .select(`
      id,
      created_at,
      last_message_at,
      user_a_id,
      user_b_id,
      a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url, city, dob),
      b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url, city, dob),
      conversations:conversations!conversations_match_id_fkey(id)
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

    let age = null;
    if (otherProfile?.dob) {
      const birthDate = new Date(otherProfile.dob);
      age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // conversations is either an array (embed) or object—normalize to first id
    const conv = Array.isArray(match.conversations) ? match.conversations[0] : match.conversations;

    return {
      id: match.id,
      conversationId: conv?.id || null,
      created_at: match.created_at,
      last_message_at: match.last_message_at,
      other: {
        id: otherProfile?.id,
        display_name: otherProfile?.display_name,
        avatar_url: otherProfile?.avatar_url,
        city: otherProfile?.city,
        age,
      },
    };
  });

  const total = items.length;
  if (countOnly) {
    return res.json({ count: total });
  }

  const visible = isPremium ? items : items.slice(0, 5);
  const paged = visible.slice(offset, offset + limit);

  return res.json({
    items: paged,
    total,
    limited: !isPremium && total > 5,
  });
}