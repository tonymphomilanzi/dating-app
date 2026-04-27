// src/services/stories.service.js
import { supabase } from "../lib/supabase.client.js";

/* ================================================================
   UTILITIES
   ================================================================ */

const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

const withSupaTimeout = async (promise, ms, label = "timeout") => {
  let timer;
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`${label}:${ms}`)), ms);
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
};

/* ================================================================
   STORIES SERVICE
   ================================================================ */

export const storiesService = {
  /**
   * List users with active stories (within 24h)
   * ✅ Returns story media URL for thumbnails
   * @param {number} limit - Maximum number of users to return
   * @returns {Promise<Array>} Array of user stories
   */
  listActiveUsers: async (limit = 30) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data, error } = await withSupaTimeout(
      supabase
        .from("stories")
        .select(`
          id,
          user_id,
          media_path,
          media_type,
          caption,
          posted_at,
          expires_at,
          profiles:profiles!stories_user_id_fkey(
            display_name,
            avatar_url
          )
        `)
        .gt("posted_at", since)
        .gt("expires_at", new Date().toISOString())
        .order("posted_at", { ascending: false }),
      8000,
      "stories:listActiveUsers"
    );

    if (error) {
      console.error("[storiesService] listActiveUsers error:", error);
      throw error;
    }

    // Group by user - get latest story per user
    const seen = new Set();
    const users = [];

    for (const story of data || []) {
      if (seen.has(story.user_id)) continue;
      seen.add(story.user_id);

      // Get public URL for story media
      const { data: mediaData } = supabase.storage
        .from("stories")
        .getPublicUrl(story.media_path);

      users.push({
        user_id: story.user_id,
        name: story.profiles?.display_name || "User",
        avatar: story.profiles?.avatar_url || null,
        media_url: mediaData?.publicUrl || null,
        media_type: story.media_type || "image",
        caption: story.caption || null,
        latest_story_id: story.id,
        posted_at: story.posted_at,
        expires_at: story.expires_at,
        unread: true, // Can implement read tracking later
      });

      if (users.length >= limit) break;
    }

    return users;
  },

  /**
   * Get all stories for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of story items
   */
  getUserStories: async (userId) => {
    const { data, error } = await withSupaTimeout(
      supabase
        .from("stories")
        .select(`
          id,
          user_id,
          media_path,
          media_type,
          caption,
          posted_at,
          expires_at,
          profiles:profiles!stories_user_id_fkey(
            display_name,
            avatar_url
          )
        `)
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("posted_at", { ascending: true }),
      6000,
      "stories:getUserStories"
    );

    if (error) {
      console.error("[storiesService] getUserStories error:", error);
      throw error;
    }

    return (data || []).map((story) => {
      const { data: mediaData } = supabase.storage
        .from("stories")
        .getPublicUrl(story.media_path);

      return {
        id: story.id,
        userId: story.user_id,
        url: mediaData?.publicUrl || null,
        type: story.media_type || "image",
        caption: story.caption || "",
        postedAt: story.posted_at,
        expiresAt: story.expires_at,
        durationMs: 7000, // 7 seconds per story
        userName: story.profiles?.display_name || "User",
        userAvatar: story.profiles?.avatar_url || null,
      };
    });
  },

  /**
   * Check if current user has active stories
   * @returns {Promise<boolean>}
   */
  hasMyActive: async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log("[storiesService] No authenticated user");
        return false;
      }

      const { count, error } = await withSupaTimeout(
        supabase
          .from("stories")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString()),
        4000,
        "stories:hasMyActive"
      );

      if (error) {
        console.error("[storiesService] hasMyActive error:", error);
        return false;
      }

      return (count || 0) > 0;
    } catch (err) {
      console.error("[storiesService] hasMyActive exception:", err);
      return false;
    }
  },

  /**
   * Add a new story
   * @param {Object} params - Story parameters
   * @param {File} params.file - Media file (image or video)
   * @param {string} params.caption - Optional caption
   * @returns {Promise<string>} Story ID
   */
  add: async ({ file, caption }) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("You must be signed in to add a story");
    }

    if (!file) {
      throw new Error("Please select a file");
    }

    // Validate file type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      throw new Error("Only images and videos are allowed");
    }

    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = isVideo ? 50 : 10;
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }

    const media_type = isVideo ? "video" : "image";
    const path = `${user.id}/${Date.now()}-${sanitize(file.name)}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("stories")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("[storiesService] Upload error:", uploadError);
      throw new Error(uploadError.message || "Failed to upload story");
    }

    // Insert into database
    const { data: story, error: insertError } = await supabase
      .from("stories")
      .insert({
        user_id: user.id,
        media_path: path,
        media_type,
        caption: caption?.trim() || null,
        posted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[storiesService] Insert error:", insertError);
      
      // Clean up uploaded file if database insert fails
      await supabase.storage.from("stories").remove([path]);
      
      throw new Error(insertError.message || "Failed to create story");
    }

    return story.id;
  },

  /**
   * Delete a story (owner only)
   * @param {string} storyId - Story ID to delete
   */
  delete: async (storyId) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("You must be signed in to delete a story");
    }

    // Get story to verify ownership and get media path
    const { data: story, error: fetchError } = await supabase
      .from("stories")
      .select("user_id, media_path")
      .eq("id", storyId)
      .single();

    if (fetchError) {
      console.error("[storiesService] Fetch error:", fetchError);
      throw new Error("Story not found");
    }

    if (story.user_id !== user.id) {
      throw new Error("You can only delete your own stories");
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("stories")
      .delete()
      .eq("id", storyId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[storiesService] Delete error:", deleteError);
      throw new Error("Failed to delete story");
    }

    // Delete from storage
    await supabase.storage
      .from("stories")
      .remove([story.media_path]);

    return true;
  },

  /**
   * Get story count for current user
   * @returns {Promise<number>}
   */
  getMyStoryCount: async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) return 0;

      const { count, error } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString());

      if (error) {
        console.error("[storiesService] getMyStoryCount error:", error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error("[storiesService] getMyStoryCount exception:", err);
      return 0;
    }
  },

  /**
   * Get all my stories
   * @returns {Promise<Array>}
   */
  getMyStories: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("You must be signed in");
    }

    return await storiesService.getUserStories(user.id);
  },

  /**
   * Mark stories as viewed by current user
   * @param {string} userId - User whose stories were viewed
   */
  markAsViewed: async (userId) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return;

    // TODO: Implement story views tracking
    // This would involve creating a story_views table
    // For now, this is a placeholder
    console.log(`User ${user.id} viewed stories from user ${userId}`);
  },

  /**
   * Clean up expired stories (usually run by cron job)
   * @returns {Promise<number>} Number of stories deleted
   */
  cleanupExpired: async () => {
    try {
      const { data: expired, error: fetchError } = await supabase
        .from("stories")
        .select("id, media_path")
        .lt("expires_at", new Date().toISOString());

      if (fetchError) {
        console.error("[storiesService] Cleanup fetch error:", fetchError);
        return 0;
      }

      if (!expired || expired.length === 0) return 0;

      // Delete from storage
      const paths = expired.map((s) => s.media_path);
      await supabase.storage.from("stories").remove(paths);

      // Delete from database
      const { error: deleteError } = await supabase
        .from("stories")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (deleteError) {
        console.error("[storiesService] Cleanup delete error:", deleteError);
        return 0;
      }

      return expired.length;
    } catch (err) {
      console.error("[storiesService] Cleanup exception:", err);
      return 0;
    }
  },
};