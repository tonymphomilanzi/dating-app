// api/swipes/index.js
import { requireUser, getPremiumFlag } from "../lib/_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;
  const { targetUserId, dir, action } = req.body || {};

  console.log("📥 Swipe request:", { userId: user.id, targetUserId, dir, action });

  // Handle undo
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
      console.error("Undo error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ ok: true });
  }

  // Validate swipe direction
  if (!targetUserId || !["left", "right", "super"].includes(dir)) {
    return res.status(400).json({ error: "Invalid body: targetUserId and dir required" });
  }

  // Super-like limit for non-premium
  if (dir === "super") {
    const isPremium = await getPremiumFlag(supabase, user.id);
    if (!isPremium) {
      const { count, error: countError } = await supabase
        .from("swipes")
        .select("*", { count: "exact", head: true })
        .eq("swiper_id", user.id)
        .eq("dir", "super");

      if (countError) {
        console.error("Count error:", countError);
        return res.status(500).json({ error: countError.message });
      }

      if ((count || 0) >= 2) {
        return res.status(402).json({ error: "Super-like limit reached. Go Premium." });
      }
    }
  }

  // Save the swipe
  const { data: swipeData, error: swipeError } = await supabase
    .from("swipes")
    .upsert(
      {
        swiper_id: user.id,
        swipee_id: targetUserId,
        dir,
        created_at: new Date().toISOString(),
      },
      { onConflict: "swiper_id,swipee_id" }
    )
    .select()
    .single();

  if (swipeError) {
    console.error("Swipe error:", swipeError);
    return res.status(400).json({ error: swipeError.message });
  }

  console.log("✅ Swipe saved:", swipeData);

  // Check for mutual like
  if (dir === "right" || dir === "super") {
    const { data: mutualSwipe, error: mutualError } = await supabase
      .from("swipes")
      .select("dir")
      .eq("swiper_id", targetUserId)
      .eq("swipee_id", user.id)
      .in("dir", ["right", "super"])
      .maybeSingle();

    if (mutualError) {
      console.error("Mutual check error:", mutualError);
    }

    console.log("🔍 Mutual swipe check:", { found: !!mutualSwipe, mutualSwipe });

    if (mutualSwipe) {
      // Check existing match
      const { data: existingMatch } = await supabase
        .from("matches")
        .select("id")
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingMatch) {
        console.log("ℹ️ Match already exists:", existingMatch.id);
        
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

      if (matchError) {
        console.error("Match creation error:", matchError);
        // Don't fail the request
      } else {
        console.log("🎉 New match created:", newMatch.id);

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