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


  /**
   * Update an event — only the owner can do this.
   * Supabase RLS should enforce creator_id = auth.uid(),
   * but we also match it client-side for a clear error.
   */
  async update(id, payload) {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", id)
      .eq("creator_id", user.id) // ← ownership guard
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an event — only the owner can do this.
   */
  async delete(id) {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("creator_id", user.id); // ← ownership guard

    if (error) throw error;
  },
};