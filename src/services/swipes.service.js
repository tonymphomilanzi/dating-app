// src/services/swipes.service.js
import { api } from "../lib/api";

export const swipesService = {
  /**
   * Record a swipe action and check for match
   * @param {object} params
   * @param {string} params.targetUserId - Target user ID
   * @param {string} params.dir - Direction: "left" | "right" | "super"
   * @returns {Promise<{ok: boolean, matched: boolean, isNew?: boolean, match?: object}>}
   */
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
   */
  undo: async (targetUserId) => {
    const response = await api.post("/swipes/undo", { targetUserId });
    return response?.ok ?? true;
  },

  /**
   * Get user's matches
   */
  getMatches: async (limit = 50) => {
    const response = await api.get("/matches", { params: { limit } });
    return {
      items: response?.items ?? [],
      total: response?.total ?? 0,
      limited: response?.limited ?? false,
    };
  },
};