// src/services/streams.service.js
import { supabase } from "../lib/supabase.client.js";

function publicUrlFor(path) {
  return supabase.storage.from("streams").getPublicUrl(path).data.publicUrl;
}

async function getCurrentUserId() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  
  if (sessionError) throw sessionError;
  if (!session?.user) throw new Error("Not authenticated");
  
  return session.user.id;
}

export const streamsService = {
  async listApproved(limit = 20) {
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
    if (!file) throw new Error("No file provided");

    const userId = await getCurrentUserId();

    // Upload to Storage
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
        video_url: publicUrl,
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
    const { error } = await supabase.rpc("increment_stream_view", {
      p_stream_id: streamId,
    });
    if (error) throw error;
  },

  // ==========================================
  // 💖 LIKE/UNLIKE OPERATIONS
  // ==========================================

  async likeStream(streamId) {
    const userId = await getCurrentUserId();

    if (!streamId || !userId) {
      throw new Error("Missing streamId or userId");
    }

    // Create stream_likes table if you haven't - schema below
    const { error } = await supabase
      .from("stream_likes")
      .insert({
        stream_id: streamId,
        user_id: userId,
      })
      .select("id")
      .single();

    if (error) {
      // If unique constraint violation, user already liked
      if (error.code === "23505") {
        return { alreadyLiked: true };
      }
      throw error;
    }

    return { success: true };
  },

  async unlikeStream(streamId) {
    const userId = await getCurrentUserId();

    if (!streamId || !userId) {
      throw new Error("Missing streamId or userId");
    }

    const { error } = await supabase
      .from("stream_likes")
      .delete()
      .eq("stream_id", streamId)
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true };
  },

  async getUserLikedStreams(limit = 100) {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("stream_likes")
      .select("stream_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Set((data || []).map((like) => like.stream_id));
  },

  async getStreamLikeCount(streamId) {
    const { count, error } = await supabase
      .from("stream_likes")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", streamId);

    if (error) throw error;

    return count || 0;
  },

  async isStreamLikedByUser(streamId) {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("stream_likes")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", streamId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return !!data;
  },

  async getLikeStatusBatch(streamIds = []) {
    if (streamIds.length === 0) return new Map();

    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("stream_likes")
      .select("stream_id")
      .eq("user_id", userId)
      .in("stream_id", streamIds);

    if (error) throw error;

    const likeMap = new Map();
    streamIds.forEach((id) => {
      likeMap.set(id, false);
    });

    (data || []).forEach((like) => {
      likeMap.set(like.stream_id, true);
    });

    return likeMap;
  },

  // ==========================================
  // 📝 COMMENT OPERATIONS (PLACEHOLDER)
  // ==========================================

  async getStreamComments(streamId, limit = 20) {
    const { data, error } = await supabase
      .from("stream_comments")
      .select(
        `
        id, stream_id, user_id, text, created_at,
        profiles:user_id ( id, display_name, avatar_url )
      `
      )
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((comment) => ({
      ...comment,
      author: comment.profiles,
    }));
  },

  async addStreamComment(streamId, text) {
    const userId = await getCurrentUserId();

    if (!text || !text.trim()) {
      throw new Error("Comment text cannot be empty");
    }

    const { data, error } = await supabase
      .from("stream_comments")
      .insert({
        stream_id: streamId,
        user_id: userId,
        text: text.trim(),
      })
      .select(
        `
        id, stream_id, user_id, text, created_at,
        profiles:user_id ( id, display_name, avatar_url )
      `
      )
      .single();

    if (error) throw error;

    return {
      ...data,
      author: data.profiles,
    };
  },

  async deleteStreamComment(commentId) {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from("stream_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true };
  },

  async getStreamCommentCount(streamId) {
    const { count, error } = await supabase
      .from("stream_comments")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", streamId);

    if (error) throw error;

    return count || 0;
  },

  // ==========================================
  // 🔄 SHARE TRACKING (PLACEHOLDER)
  // ==========================================

  async trackShareStream(streamId) {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from("stream_shares")
      .insert({
        stream_id: streamId,
        user_id: userId,
        shared_at: new Date().toISOString(),
      });

    if (error) {
      console.warn("Failed to track share:", error);
      // Don't throw - sharing should work even if tracking fails
    }

    return { success: true };
  },

  async getStreamShareCount(streamId) {
    const { count, error } = await supabase
      .from("stream_shares")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", streamId);

    if (error) throw error;

    return count || 0;
  },

  // ==========================================
  // 👤 USER STREAM OPERATIONS
  // ==========================================

  async getUserStreams(userId = null, limit = 20) {
    const currentUserId = userId || (await getCurrentUserId());

    const { data, error } = await supabase
      .from("streams")
      .select(
        `
        id, user_id, caption, video_path, video_url, views_count, status, created_at,
        profiles:user_id ( id, display_name, avatar_url )
      `
      )
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((s) => ({
      ...s,
      creator: s.profiles,
      url: s.video_url || publicUrlFor(s.video_path),
    }));
  },

  async deleteStream(streamId) {
    const userId = await getCurrentUserId();

    // Get the stream to find the video path
    const { data: stream, error: fetchError } = await supabase
      .from("streams")
      .select("video_path, user_id")
      .eq("id", streamId)
      .single();

    if (fetchError) throw fetchError;

    // Verify ownership
    if (stream.user_id !== userId) {
      throw new Error("Unauthorized: You can only delete your own streams");
    }

    // Delete from storage
    if (stream.video_path) {
      const { error: storageError } = await supabase.storage
        .from("streams")
        .remove([stream.video_path]);

      if (storageError) {
        console.warn("Failed to delete video file:", storageError);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from("streams")
      .delete()
      .eq("id", streamId)
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true };
  },

  async updateStreamCaption(streamId, caption) {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("streams")
      .update({
        caption: caption?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", streamId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },
};