// src/services/swipes.service.js
import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

export const swipesService = {
  swipe: async ({ targetUserId, dir }) => {
    const response = await api.post("/swipes", { targetUserId, dir });
    return {
      ok: response?.ok ?? true,
      matched: response?.matched ?? false,
      isNew: response?.isNew ?? false,
      match: response?.match ?? null,
    };
  },

  like: (targetUserId) => swipesService.swipe({ targetUserId, dir: "right" }),
  nope: (targetUserId) => swipesService.swipe({ targetUserId, dir: "left" }),
  superLike: (targetUserId) => swipesService.swipe({ targetUserId, dir: "super" }),

  /**
   * Undo last swipe
   * Option 1: Via API (if using DELETE method)
   * Option 2: Direct Supabase (if RLS policy is set)
   */
  undo: async (targetUserId) => {
    // Option 1: Use existing API with action field
    try {
      const response = await api.post("/swipes", { targetUserId, action: "undo" });
      return response?.ok ?? true;
    } catch (apiError) {
      // Option 2: Fallback to direct Supabase call
      console.warn("API undo failed, trying direct:", apiError.message);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("swipes")
        .delete()
        .eq("swiper_id", user.id)
        .eq("swipee_id", targetUserId);

      if (error) throw error;
      return true;
    }
  },

  getMatches: async (limit = 50) => {
    const response = await api.get("/matches", { params: { limit } });
    return {
      items: response?.items ?? [],
      total: response?.total ?? 0,
      limited: response?.limited ?? false,
    };
  },
};