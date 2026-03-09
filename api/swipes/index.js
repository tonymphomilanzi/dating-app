// api/swipes/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;

  // ============ UNDO (DELETE) ============
  if (req.method === "DELETE") {
    const { targetUserId } = req.body || {};

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId required" });
    }

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

  // ============ SWIPE (POST) ============
  if (req.method === "POST") {
    const { targetUserId, dir, action } = req.body || {};

    // Handle undo via action field (alternative)
    if (action === "undo") {
      if (!targetUserId) {
        return res.status(400).json({ error: "targetUserId required" });
      }

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

    // Regular swipe
    if (!targetUserId || !["left", "right", "super"].includes(dir)) {
      return res.status(400).json({ error: "Invalid body" });
    }

    // Super-like limit check for non-premium users
    if (dir === "super") {
      const isPremium = await getPremiumFlag(supabase, user.id);
      if (!isPremium) {
        const { count, error: countError } = await supabase
          .from("swipes")
          .select("*", { count: "exact", head: true })
          .eq("swiper_id", user.id)
          .eq("dir", "super");

        if (countError) {
          return res.status(500).json({ error: countError.message });
        }

        if ((count || 0) >= 2) {
          return res.status(402).json({ error: "Super-like limit reached. Go Premium." });
        }
      }
    }

    // 1. Save the swipe
    const { error: swipeError } = await supabase
      .from("swipes")
      .upsert(
        {
          swiper_id: user.id,
          swipee_id: targetUserId,
          dir,
          created_at: new Date().toISOString(),
        },
        { onConflict: "swiper_id,swipee_id" }
      );

    if (swipeError) {
      return res.status(400).json({ error: swipeError.message });
    }

    // 2. Check for mutual like (only if we liked them)
    if (dir === "right" || dir === "super") {
      const { data: mutualSwipe } = await supabase
        .from("swipes")
        .select("dir")
        .eq("swiper_id", targetUserId)
        .eq("swipee_id", user.id)
        .in("dir", ["right", "super"])
        .maybeSingle();

      // 3. If mutual like exists, create match
      if (mutualSwipe) {
        // Check if match already exists
        const { data: existingMatch } = await supabase
          .from("matches")
          .select("id")
          .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${user.id})`)
          .maybeSingle();

        if (existingMatch) {
          const { data: matchedProfile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, city")
            .eq("id", targetUserId)
            .single();

          return res.json({
            ok: true,
            matched: true,
            isNew: false,
            match: { id: existingMatch.id, profile: matchedProfile },
          });
        }

        // Create new match
        const userAId = user.id < targetUserId ? user.id : targetUserId;
        const userBId = user.id < targetUserId ? targetUserId : user.id;

        const { data: newMatch, error: matchError } = await supabase
          .from("matches")
          .insert({
            user_a_id: userAId,
            user_b_id: userBId,
            created_at: new Date().toISOString(),
          })
          .select("id, created_at")
          .single();

        if (!matchError) {
          const { data: matchedProfile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, city")
            .eq("id", targetUserId)
            .single();

          return res.json({
            ok: true,
            matched: true,
            isNew: true,
            match: {
              id: newMatch.id,
              created_at: newMatch.created_at,
              profile: matchedProfile,
            },
          });
        }
      }
    }

    return res.json({ ok: true, matched: false });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).end();
}