// src/lib/profile.js
import { authStore } from "./authStore.js";

/**
 * Used by setupGateRoute.beforeLoad
 * First call: checks fields (instant) + interests (one DB call, cached)
 * Every call after: fully instant from memory/localStorage
 */
export async function getProfileCompletion() {
  await authStore.waitUntilReady();

  const session = authStore.getSession();
  if (!session?.user?.id) {
    return { isComplete: false, redirectTo: "/setup/basics" };
  }

  return authStore.checkSetupComplete(session.user.id);
}