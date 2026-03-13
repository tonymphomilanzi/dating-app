// src/services/swipes.service.js
import { supabase } from "../lib/supabase.client.js";

const LIKE_DIRS = ["right", "up"]; // treat "up" as superlike
const FREE_DAILY_LIMIT = 50;       // tweak as needed

function makeError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function normalizeDir(dir) {
  const s = String(dir || "").toLowerCase();
  if (["left", "right", "up"].includes(s)) return s;
  if (s === "like") return "right";
  if (s === "nope" || s === "pass") return "left";
  if (s === "super" || s === "superlike") return "up";
  return null;
}

function matchPairOrFilter(a, b) {
  // matches where (a,b) or (b,a)
  return `and(user_a_id.eq.${a},user_b_id.eq.${b}),and(user_a_id.eq.${b},user_b_id.eq.${a})`;
}

async function getMe() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw makeError(401, "Not authenticated");
  return data.user;
}

async function assertNotBlocked(meId, targetUserId) {
  const { data: blocks, error } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${meId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${meId})`
    );

  if (error) throw error;
  if (blocks?.length) throw makeError(403, "You cannot interact with this user.");
}

async function maybeEnforceFreeLimit(meId) {
  const { data: prof, error: eProf } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", meId)
    .maybeSingle();

  if (eProf) throw eProf;
  if (prof?.is_premium) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: eCnt } = await supabase
    .from("swipes")
    .select("*", { count: "exact", head: true })
    .eq("swiper_id", meId)
    .gte("created_at", since);

  if (eCnt) throw eCnt;
  if ((count ?? 0) >= FREE_DAILY_LIMIT) {
    throw makeError(402, "Daily swipe limit reached. Upgrade to Premium to keep swiping.");
  }
}

async function findExistingMatch(a, b) {
  const { data, error } = await supabase
    .from("matches")
    .select("id")
    .or(matchPairOrFilter(a, b))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findReciprocalLike(fromUserId, toUserId) {
  const { data, error } = await supabase
    .from("swipes")
    .select("id, dir, created_at")
    .eq("swiper_id", fromUserId)
    .eq("swipee_id", toUserId)
    .in("dir", LIKE_DIRS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function swipe({ targetUserId, dir }) {
  const me = await getMe();

  const normalized = normalizeDir(dir);
  if (!targetUserId) throw makeError(400, "targetUserId is required.");
  if (!normalized) throw makeError(400, "Invalid swipe direction.");
  if (targetUserId === me.id) throw makeError(400, "You can't swipe yourself.");

  await assertNotBlocked(me.id, targetUserId);
  await maybeEnforceFreeLimit(me.id);

  // Insert the swipe
  const { data: newSwipe, error: eIns } = await supabase
    .from("swipes")
    .insert({
      swiper_id: me.id,
      swipee_id: targetUserId,
      dir: normalized,
    })
    .select("id, created_at")
    .single();

  if (eIns) throw eIns;

  // Determine if there is already a match for this pair
  const existingMatch = await findExistingMatch(me.id, targetUserId);

  let matched = false;
  let isNew = false;
  let match = existingMatch;

  // If we liked (right or up), check reciprocal like and create match if needed
  if (!existingMatch && LIKE_DIRS.includes(normalized)) {
    const reciprocal = await findReciprocalLike(targetUserId, me.id);
    if (reciprocal) {
      const { data: createdMatch, error: eMatch } = await supabase
        .from("matches")
        .insert({ user_a_id: me.id, user_b_id: targetUserId })
        .select("id")
        .single();

      if (eMatch) throw eMatch;

      matched = true;
      isNew = true;
      match = createdMatch;
    }
  } else if (existingMatch) {
    matched = true;
    isNew = false;
  }

  return {
    success: true,
    swipe: { id: newSwipe.id, dir: normalized, created_at: newSwipe.created_at },
    matched,
    isNew,
    match, // { id } or null
  };
}

async function undo(targetUserId) {
  const me = await getMe();
  if (!targetUserId) throw makeError(400, "targetUserId is required.");

  // Find my latest swipe toward this user
  const { data: lastSwipe, error: eSel } = await supabase
    .from("swipes")
    .select("id, dir, created_at")
    .eq("swiper_id", me.id)
    .eq("swipee_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eSel) throw eSel;
  if (!lastSwipe) return { success: true, undone: false };

  // If that swipe was a like that produced a match, refuse to undo
  if (LIKE_DIRS.includes(lastSwipe.dir)) {
    const existingMatch = await findExistingMatch(me.id, targetUserId);
    if (existingMatch) {
      throw makeError(409, "Cannot undo: this like already created a match.");
    }
  }

  const { error: eDel } = await supabase.from("swipes").delete().eq("id", lastSwipe.id);
  if (eDel) throw eDel;

  return { success: true, undone: true };
}

export const swipesService = {
  swipe,
  undo,
};