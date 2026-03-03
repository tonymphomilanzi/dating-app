import { supabase } from "../lib/supabase";

const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

export const storiesService = {
  // Latest active story per user (for the row)
  listActiveUsers: async (limit = 30) => {
    // Get active stories + user profile
    const since = new Date(Date.now() - 24*3600*1000).toISOString();
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, media_path, media_type, posted_at, profiles:profiles!stories_user_id_fkey(display_name, avatar_url)")
      .gt("posted_at", since)
      .order("posted_at", { ascending: false });
    if (error) throw error;

    // Unique by user_id (latest first)
    const seen = new Set();
    const users = [];
    for (const s of data || []) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      const url = supabase.storage.from("stories").getPublicUrl(s.media_path).data.publicUrl;
      users.push({
        user_id: s.user_id,
        name: s.profiles?.display_name || "User",
        avatar: s.profiles?.avatar_url || url, // fallback to story image
        postedAt: s.posted_at,
      });
      if (users.length >= limit) break;
    }
    return users;
  },

  // All active stories for a user
  getUserStories: async (userId) => {
    const { data, error } = await supabase
      .from("stories")
      .select("id, media_path, media_type, caption, posted_at, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("posted_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((s) => ({
      id: s.id,
      url: supabase.storage.from("stories").getPublicUrl(s.media_path).data.publicUrl,
      type: s.media_type,
      caption: s.caption || "",
      postedAt: s.posted_at,
      durationMs: 7000,
    }));
  },

  // Does current user have an active story?
  hasMyActive: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString());
    return (count || 0) > 0;
  },

  // Upload a new story (image-only for now)
  add: async ({ file, caption }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    if (!file) throw new Error("No file selected");
    const isVideo = String(file.type).startsWith("video/");
    const media_type = isVideo ? "video" : "image";
    const path = `${user.id}/${Date.now()}-${sanitize(file.name)}`;

    const up = await supabase.storage.from("stories").upload(path, file, { upsert: false });
    if (up.error) throw up.error;

    const ins = await supabase
      .from("stories")
      .insert({ user_id: user.id, media_path: path, media_type, caption: caption || null })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    return ins.data.id;
  },
};