import { api } from "../lib/api";

export const chatService = {
  list: async () => {
    const r = await api.get("/chat", { timeoutMs: 8000 });
    return Array.isArray(r?.items) ? r.items : [];
  },
  getConversation: async (id) => {
    const r = await api.get(`/chat/${id}`, { timeoutMs: 8000 });
    return Array.isArray(r?.items) ? r.items : [];
  },
  sendToConversation: async ({ id, text, attachment_url }) => {
    const r = await api.post(`/chat/${id}`, { text, attachment_url });
    return r?.message;
  },
  openOrSendToUser: async ({ userId, text }) => {
    return api.post(`/chat`, { userId, text });
  },
  markRead: async ({ id, lastMessageId }) => {
    return api.post(`/chat/${id}/read`, { lastMessageId });
  },
};