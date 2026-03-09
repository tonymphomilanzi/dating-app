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

  const mode = req.query.mode || "matches";
  const countOnly = req.query.count_only === "true";
  const isPremium = await getPremiumFlag(supabase, user.id);

  if (mode === "likes") {
    // Get people who liked me but I haven't liked back
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

    // Get my swipes to filter out people I already liked back
    const { data: mySwipes } = await supabase
      .from("swipes")
      .select("swipee_id, dir")
      .eq("swiper_id", user.id);

    const mySwipesMap = new Map((mySwipes || []).map((s) => [s.swipee_id, s.dir]));

    // Filter: only show people I haven't swiped on yet
    let items = (likedMe || [])
      .filter((like) => !mySwipesMap.has(like.swiper_id))
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

    if (countOnly) {
      return res.json({ count: items.length });
    }

    const total = items.length;
    if (!isPremium) {
      items = items.slice(0, 5);
    }

    return res.json({
      items,
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

    let age = null;
    if (otherProfile?.dob) {
      const birthDate = new Date(otherProfile.dob);
      age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    return {
      id: match.id,
      conversationId: match.conversations?.[0]?.id || match.conversations?.id || null,
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

  if (countOnly) {
    return res.json({ count: items.length });
  }

  const total = items.length;
  if (!isPremium) {
    items = items.slice(0, 5);
  }

  return res.json({
    items,
    total,
    limited: !isPremium && total > 5,
  });
}