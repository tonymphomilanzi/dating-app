// src/services/streams.service.js
import { supabase } from "../lib/supabase.client.js";

function publicUrlFor(path) {
  // Works if bucket is PUBLIC
  return supabase.storage.from("streams").getPublicUrl(path).data.publicUrl;
}

export const streamsService = {
  async listApproved(limit = 20) {
    // join profiles for creator
    const { data, error } = await supabase
      .from("streams")
      .select(
        `
        id, user_id, caption, video_path, video_url, views_count, created_at,
        profiles:user_id ( id, display_name, avatar_url )
      `
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((s) => ({
      ...s,
      creator: s.profiles,
      url: s.video_url || publicUrlFor(s.video_path),
    }));
  },

  async createPending({ caption, file }) {
    // Upload to Storage (user folder)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) throw new Error("Not authenticated");

    const userId = session.user.id;
    const ext = (file.name?.split(".").pop() || "mp4").toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("streams")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "video/mp4",
      });
    if (uploadError) throw uploadError;

    const publicUrl = publicUrlFor(path);

    // Insert stream row as pending
    const { data, error } = await supabase
      .from("streams")
      .insert({
        user_id: userId,
        caption: caption || null,
        video_path: path,
        video_url: publicUrl, // optional convenience
        status: "pending",
      })
      .select(
        `id, user_id, caption, video_path, video_url, status, views_count, created_at`
      )
      .single();

    if (error) throw error;
    return data;
  },

  async incrementView(streamId) {
    // Safe server-side increment using RPC
    const { error } = await supabase.rpc("increment_stream_view", {
      p_stream_id: streamId,
    });
    if (error) throw error;
  },
};