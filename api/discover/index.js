import { requireUser } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const ctx = await requireUser(req, res);
  if (!ctx) return;

  const { supabase, user } = ctx;

  const limit = Number(req.query.limit ?? 20);
  const mode = String(req.query.mode ?? "for_you");

  // ✅ FIXED booleans
  const ignoreSwiped = req.query.ignore_swiped === "1";
  const debugEnabled = req.query.debug === "1";

  let debug = null;

  // --------------------------------------------------
  // Load my profile + preferences (needed for logic)
  // --------------------------------------------------
  const [{ data: me }, { data: prefs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, lat, lng, gender, dob")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("preferences")
      .select("interested_in, distance_km, min_age, max_age")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (debugEnabled) {
    debug = {
      uid: user.id,
      mode,
      ignoreSwiped,
      me,
      prefs,
    };
  }

  // --------------------------------------------------
  // HARD STOP: Nearby without location
  // --------------------------------------------------
  if (mode === "nearby" && (!me?.lat || !me?.lng)) {
    return res.json(
      debugEnabled
        ? { items: [], debug: { ...debug, reason: "NO_LOCATION" } }
        : { items: [] }
    );
  }

  // --------------------------------------------------
  // 1) Try RPC
  // --------------------------------------------------
  let items = [];
  let rpcError = null;

  const { data: rpcData, error } = await supabase.rpc(
    "discover_candidates",
    {
      uid: user.id,
      mode,
      lim: limit,
      ignore_swiped: ignoreSwiped,
    }
  );

  if (error) {
    rpcError = error.message;
  } else if (Array.isArray(rpcData)) {
    items = rpcData.map((row) => ({
      ...row,
      match_score:
        row.match_score != null
          ? Math.round(Number(row.match_score))
          : null,
    }));
  }

  // --------------------------------------------------
  // 2) Fallback (only when appropriate)
  // --------------------------------------------------
  let fallbackUsed = false;

  const allowFallback =
    mode !== "nearby" || (me?.lat && me?.lng);

  if (!items.length && allowFallback) {
    const { data: others } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, city, lat, lng, dob")
      .neq("id", user.id)
      .limit(limit);

    if (Array.isArray(others)) {
      items = others.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        city: p.city,
        lat: p.lat,
        lng: p.lng,
        age: p.dob
          ? Math.floor(
              (Date.now() - new Date(p.dob)) /
                (365.25 * 24 * 3600 * 1000)
            )
          : null,
        distance_km: null,
        match_score: null,
      }));
      fallbackUsed = true;
    }
  }

  if (debugEnabled) {
    debug = {
      ...debug,
      rpcCount: rpcData?.length ?? 0,
      returnedCount: items.length,
      fallbackUsed,
      rpcError,
    };
  }

  return res.json(debugEnabled ? { items, debug } : { items });
}