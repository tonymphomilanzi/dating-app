import { api } from "../lib/api";

const normalizeItems = (res) =>
  Array.isArray(res?.items) ? res.items : [];

export const discoverService = {
  async list(mode = "for_you", limit = 20, options = {}) {
    const params = {
      mode,
      limit,
    };

    if (options.ignoreSwiped) params.ignore_swiped = "1";
    if (options.debug) params.debug = "1";

    const response = await api.get("/discover", { params });

    if (options.debug && response?.debug) {
      console.info("[discover.debug]", response.debug);
    }

    const items = normalizeItems(response);

    console.info("[discover]", {
      mode,
      count: items.length,
      ignoreSwiped: !!options.ignoreSwiped,
    });

    return items;
  },
};