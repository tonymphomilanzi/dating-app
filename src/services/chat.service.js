import { api } from "../lib/api";
export const chatService = {
  list: async () => {
    const r = await api.get("/chat");
    return Array.isArray(r?.items) ? r.items : [];
  },
  getConversation: async (id) => {
    const r = await api.get(`/chat/${id}`);
    return Array.isArray(r?.items) ? r.items : [];
  },
  sendToConversation: async ({ id, text, attachment_url }) => {
    const r = await api.post(`/chat/${id}`, { text, attachment_url });
    return r?.message;
  },
  sendToMatch: async ({ matchId, text }) => {
    const r = await api.post(`/chat`, { matchId, text });
    return r?.message;
  },
};