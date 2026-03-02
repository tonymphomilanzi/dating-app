import { api } from "../lib/api";
export const discoverService = {
  list: (mode="for_you", limit=20) => api.get("/discover", { params: { mode, limit } }).then(r => r.items),
};