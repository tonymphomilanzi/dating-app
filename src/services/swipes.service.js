import { api } from "../lib/api";
export const swipesService = {
  swipe: ({ targetUserId, dir }) => api.post("/swipes", { targetUserId, dir }),
  like: (id) => api.post("/swipes", { targetUserId: id, dir: "right" }),
  nope: (id) => api.post("/swipes", { targetUserId: id, dir: "left" }),
  superLike: (id) => api.post("/swipes", { targetUserId: id, dir: "super" }),
};