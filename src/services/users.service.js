import { api } from "../lib/api";
export const usersService = {
  get: (id) => api.get(`/users/${id}`).then(r => r.profile),
};