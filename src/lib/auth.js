// src/lib/auth.js
import { authStore } from "./authStore.js";

export async function getAuthSession() {
  await authStore.waitUntilReady();
  return authStore.getSession();
}