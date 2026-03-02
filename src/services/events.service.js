import { api } from "../lib/api";
export const eventsService = {
  list: (opts={}) => api.get("/events", { params: opts }).then(r => r.items),
  create: (payload) => api.post("/events", payload).then(r => r.event),
  get: (id) => api.get(`/events/${id}`).then(r => r),
  join: (id) => api.post(`/events/${id}`, { action: "join" }).then(r => r),
  leave: (id) => api.post(`/events/${id}`, { action: "leave" }).then(r => r),
};