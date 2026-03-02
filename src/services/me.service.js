import { api } from "../lib/api";
export const meService = {
  get: () => api.get("/me").then(r => r.profile),
  update: (payload) => api.patch("/me", payload).then(r => r.profile),
};