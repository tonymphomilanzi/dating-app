// src/services/me.service.js
import { api } from "../lib/api";
export const meService = {
  get: (opts = {}) => api.get("/me", { signal: opts?.signal, timeoutMs: opts?.timeoutMs ?? 8000 }).then(r => r.profile),
  update: (payload, opts = {}) => api.patch("/me", payload, { signal: opts?.signal, timeoutMs: opts?.timeoutMs ?? 10000 }).then(r => r.profile),
};


export const usersService = {
  get: (id, opts = {}) => api.get(`/users/${id}`, { signal: opts?.signal, timeoutMs: opts?.timeoutMs ?? 8000 }).then(r => r.profile),
};