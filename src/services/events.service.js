import { api } from "../lib/api";

export const eventsService = {
  list: async (opts = {}) => {
    const r = await api.get("/events", { params: opts, timeoutMs: 8000 });
    return Array.isArray(r?.items) ? r.items : (Array.isArray(r) ? r : []);
  },
  create: async (payload) => {
    const r = await api.post("/events", payload);
    return r?.event;
  },
};