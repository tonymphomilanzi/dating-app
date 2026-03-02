import { api } from "../lib/api";
export const chatService = {
  list: () => api.get("/chat").then(r => r.items),
  getConversation: (id) => api.get(`/chat/${id}`).then(r => r.items),
  sendToConversation: ({ id, text, attachment_url }) => api.post(`/chat/${id}`, { text, attachment_url }).then(r => r.message),
  sendToMatch: ({ matchId, text }) => api.post(`/chat`, { matchId, text }).then(r => r.message),
};