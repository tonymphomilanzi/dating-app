// src/services/events.service.js
import { api } from "../lib/api";

export const eventsService = {
  list: async (opts = {}) => {
    const { signal, ...params } = opts;
    const res = await api.get("/events", {
      params,           // query params
      timeoutMs: 8000,
      signal,           // real abort signal
    });
    const data = res?.data ?? res;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  },
  create: async (payload) => {
    const res = await api.post("/events", payload);
    const data = res?.data ?? res;
    return data?.event || data;
  },
};