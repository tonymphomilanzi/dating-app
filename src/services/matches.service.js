// src/services/matches.service.js
import { api } from "../lib/api";

export const matchesService = {
  list: async (mode = "matches", opts = {}) => {
    const { signal, timeoutMs = 10000, limit, offset, countOnly } = opts;
    const params = { mode };
    if (limit != null) params.limit = limit;
    if (offset != null) params.offset = offset;
    if (countOnly) params.count_only = true;

    const response = await api.get("/matches", { params, signal, timeoutMs });
    return {
      items: Array.isArray(response?.items) ? response.items : [],
      limited: !!response?.limited,
      total: response?.total || 0,
      count: response?.count,
    };
  },

  likeBack: async (targetUserId, opts = {}) => {
    const { signal, timeoutMs = 8000 } = opts;
    return api.post("/swipes", { targetUserId, dir: "right" }, { signal, timeoutMs });
  },

  pass: async (targetUserId, opts = {}) => {
    const { signal, timeoutMs = 8000 } = opts;
    return api.post("/swipes", { targetUserId, dir: "left" }, { signal, timeoutMs });
  },

  getLikesCount: async (opts = {}) => {
    const { signal, timeoutMs = 7000 } = opts;
    const response = await api.get("/matches", {
      params: { mode: "likes", count_only: true },
      signal,
      timeoutMs,
    });
    return response?.count || 0;
  },
};