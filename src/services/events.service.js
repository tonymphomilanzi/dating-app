// src/services/events.service.js
import { api } from "../lib/api";

const EVENTS_ENDPOINT = import.meta.env?.VITE_EVENTS_URL || "/events";

export const eventsService = {
  list: async (opts = {}) => {
    const { signal, ...params } = opts || {};
    try {
      const res = await api.get(EVENTS_ENDPOINT, { params, timeoutMs: 8000, signal });
      const data = res?.data ?? res;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.events)) return data.events;
      return [];
    } catch (e) {
      const base = api?.defaults?.baseURL || api?.baseURL || "";
      const baseTrim = base && base.endsWith("/") ? base.slice(0, -1) : base;
      const path = EVENTS_ENDPOINT.startsWith("/") ? EVENTS_ENDPOINT : `/${EVENTS_ENDPOINT}`;
      const url = `${baseTrim}${path}`;
      e.message = `[eventsService.list] GET ${url} failed: ${e.message || e}`;
      throw e;
    }
  },

  create: async (payload) => {
    const res = await api.post(EVENTS_ENDPOINT, payload);
    const data = res?.data ?? res;
    return data?.event || data;
  },
};