// src/services/discover.service.js
import { api } from "../lib/api";

function normalizeList(r) {
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.items)) return r.items;
  if (r?.items == null) return [];
  return [];
}

export const discoverService = {
  list: async (mode = "for_you", limit = 20) => {
    const res = await api.get("/discover", { params: { mode, limit } });
    return normalizeList(res);
  },
};