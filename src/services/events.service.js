// src/services/events.service.js
import { api } from "../lib/api";
import { supabase } from "../lib/supabase.client.js";

export const eventsService = {
  // ── List ────────────────────────────────────────────────────────
  list: async (opts = {}) => {
    const { signal, ...params } = opts;

    const r = await api.get("/events", {
      params,
      timeoutMs: 8000,
      signal,
    });

    return Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
  },

  // ── Create ───────────────────────────────────────────────────────
  create: async (payload) => {
    const r = await api.post("/events", payload);
    return r?.event ?? r;
  },

  // ── Update ───────────────────────────────────────────────────────
  // Uses Supabase directly so we can enforce creator_id ownership.
  // Your API wrapper may not have a PATCH /events/:id endpoint yet —
  // if it does, swap this for api.patch(`/events/${id}`, payload).
  update: async (id, payload) => {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) throw new Error("Not authenticated");

    // Never allow changing ownership
    const { creator_id: _omit, ...safePayload } = payload;

    const { data, error } = await supabase
      .from("events")
      .update(safePayload)
      .eq("id", id)
      .eq("creator_id", user.id)   // ownership guard
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Event not found or permission denied.");

    return data;
  },

  // ── Delete ───────────────────────────────────────────────────────
  // Same pattern — Supabase direct with ownership guard.
  delete: async (id) => {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) throw new Error("Not authenticated");

    const { error, count } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("creator_id", user.id);  // ownership guard

    if (error) throw error;

    if (count === 0) {
      throw new Error("Event not found or permission denied.");
    }
  },
};