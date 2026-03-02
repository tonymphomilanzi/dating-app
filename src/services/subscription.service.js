import { api } from "../lib/api";
export const subscriptionService = {
  me: () => api.get("/subscription/me").then(r => r.is_premium),
};