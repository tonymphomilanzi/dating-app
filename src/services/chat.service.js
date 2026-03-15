
// src/services/chat.service.js
import { api } from "../lib/api";

/**
 * Chat service
 * All methods accept { signal?, timeoutMs? } to prevent hangs.
 */
export const chatService = {
  /**
   * List conversations (threads)
   * opts: { signal?, timeoutMs?, limit?, q? }
   */
  list: async (opts = {}) => {
    const { signal, timeoutMs = 8000, limit, q } = opts;
    const params = {};
    if (limit != null) params.limit = limit;
    if (q) params.q = q;

    const r = await api.get("/chat", { params, timeoutMs, signal });
    return Array.isArray(r?.items) ? r.items : [];
  },

  /**
   * Get messages for a conversation
   * opts: { signal?, timeoutMs?, limit?, before? }  // before = message id or ISO timestamp
   */
  getConversation: async (id, opts = {}) => {
    const { signal, timeoutMs = 10000, limit, before } = opts;
    const params = {};
    if (limit != null) params.limit = limit;
    if (before != null) params.before = before;

    const r = await api.get(`/chat/${id}`, { params, timeoutMs, signal });
    return Array.isArray(r?.items) ? r.items : [];
  },

  /**
   * Send a message to a conversation
   * opts: { signal?, timeoutMs? }
   */
  sendToConversation: async ({ id, text, attachment_url }, opts = {}) => {
    const { signal, timeoutMs = 10000 } = opts;
    const payload = {
      text: (text || "").trim() || null,
      attachment_url: attachment_url || null,
    };
    const r = await api.post(`/chat/${id}`, payload, { signal, timeoutMs });
    return r?.message;
  },

  /**
   * Open (or create) a DM with a user and optionally send a first message
   * opts: { signal?, timeoutMs? }
   */
  openOrSendToUser: async ({ userId, text }, opts = {}) => {
    const { signal, timeoutMs = 10000 } = opts;
    return api.post(`/chat`, { userId, text: (text || "").trim() || null }, { signal, timeoutMs });
  },

  /**
   * Mark a conversation as read
   * opts: { signal?, timeoutMs? }  // short timeout by default
   */
  markRead: async ({ id, lastMessageId }, opts = {}) => {
    const { signal, timeoutMs = 5000 } = opts;
    try {
      await api.post(`/chat/${id}/read`, { lastMessageId }, { signal, timeoutMs });
      return true;
    } catch (e) {
      // Non-fatal; don't block UI if this times out or is aborted
      return false;
    }
  },
};