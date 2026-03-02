import { api } from "../lib/api";
export const matchesService = {
  list: async () => {
    const r = await api.get("/matches");
    return {
      items: Array.isArray(r?.items) ? r.items : [],
      limited: !!r?.limited,
    };
  },
};