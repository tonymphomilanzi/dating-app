// src/services/events.service.js
import { api } from "../lib/api";

export const eventsService = {
  list: async (opts = {}) => {
    // Destructure signal out, keep the rest as params
    const { signal, ...params } = opts;
    
    const r = await api.get("/events", { 
      params,        // query params only (no signal)
      timeoutMs: 8000,
      signal,        // signal passed separately
    });
    
    return Array.isArray(r?.items) ? r.items : (Array.isArray(r) ? r : []);
  },
  
  create: async (payload) => {
    const r = await api.post("/events", payload);
    return r?.event;
  },
};