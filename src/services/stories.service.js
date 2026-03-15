// src/services/stories.service.js
import { supabase } from "../lib/supabase.client.js";

const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

const withSupaTimeout = async (promise, ms, label = "timeout") => {
  let timer;
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${label}:${ms}`)), ms); }),
    ]);
    return result; // { data, error }
  } finally {
    clearTimeout(timer);
  }
};

export const storiesService = {
  listActiveUsers: async (limit = 30) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await withSupaTimeout(
      supabase
        .from("stories")
        .select("id, user_id, media_path, media_type, posted_at, profiles:profiles!stories_user_id_fkey(display_name, avatar_url)")
        .gt("posted_at", since)
        .order("posted_at", { ascending: false }),
      6000,
      "stories:listActiveUsers"
    );
    if (error) throw error;

    const seen = new Set();
    const users = [];
    for (const s of data || []) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      const url = supabase.storage.from("stories").getPublicUrl(s.media_path).data.publicUrl;
      users.push({
        user_id: s.user_id,
        name: s.profiles?.display_name || "User",
        avatar: s.profiles?.avatar_url || url,
        postedAt: s.posted_at,
      });
      if (users.length >= limit) break;
    }
    return users;
  },

  getUserStories: async (userId) => {
    const { data, error } = await withSupaTimeout(
      supabase
        .from("stories")
        .select("id, media_path, media_type, caption, posted_at, expires_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("posted_at", { ascending: true }),
      6000,
      "stories:getUserStories"
    );
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

  hasMyActive: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { count, error } = await withSupaTimeout(
      supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString()),
      4000,
      "stories:hasMyActive"
    );
    if (error) return false;
    return (count || 0) > 0;
  },

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