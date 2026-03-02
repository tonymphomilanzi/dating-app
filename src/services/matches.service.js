import { api } from "../lib/api";
export const matchesService = {
  list: () => api.get("/matches").then(r => r),
};