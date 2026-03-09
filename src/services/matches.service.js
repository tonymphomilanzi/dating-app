// src/services/matches.service.js
import { api } from "../lib/api";

export const matchesService = {
  /**
   * List likes or matches
   * @param {string} mode - "likes" | "matches"
   */
  list: async (mode = "matches") => {
    const response = await api.get("/matches", { params: { mode } });
    return {
      items: Array.isArray(response?.items) ? response.items : [],
      limited: !!response?.limited,
      total: response?.total || 0,
    };
  },

  /**
   * Like back someone who liked you
   */
  likeBack: async (targetUserId) => {
    const response = await api.post("/swipes", { targetUserId, dir: "right" });
    return response;
  },

  /**
   * Pass on someone who liked you
   */
  pass: async (targetUserId) => {
    const response = await api.post("/swipes", { targetUserId, dir: "left" });
    return response;
  },

  /**
   * Get likes count (for badge)
   */
  getLikesCount: async () => {
    const response = await api.get("/matches", { params: { mode: "likes", count_only: true } });
    return response?.count || 0;
  },
};