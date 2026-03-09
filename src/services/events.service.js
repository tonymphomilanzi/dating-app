import { api } from "../lib/api";

export const eventsService = {
  // later: list(opts) → await api.get("/events", { params: opts })
  create: async (payload) => {
    const r = await api.post("/events", payload);
    return r?.event;
  },
};