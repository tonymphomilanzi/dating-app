// src/lib/authStore.js
// Plain object store — lives outside React so router can read it without hooks

import { supabase } from "./supabase.client.js";

const MIN_INTERESTS = 5;

let _session  = null;
let _profile  = null;
let _ready    = false;
let _interests = null; // null = not loaded yet, number = loaded count

export const authStore = {
  // ── Getters ──────────────────────────────────────────────────
  getSession:   () => _session,
  getProfile:   () => _profile,
  isReady:      () => _ready,
  getInterests: () => _interests,

  // ── Setters (called by AuthContext only) ──────────────────────
  setSession:   (s) => { _session  = s; },
  setProfile:   (p) => { _profile  = p; _interests = null; }, // reset interests on profile change
  setReady:     (r) => { _ready    = r; },
  setInterests: (n) => { _interests = n; },

  // ── Auth helpers ──────────────────────────────────────────────
  isLoggedIn: () => !!_session,

  // ── Profile completeness (fields only, fast) ──────────────────
  isProfileFieldsComplete: () => {
    const p = _profile;
    if (!p) return false;
    return (
      !!String(p.display_name ?? "").trim() &&
      !!p.dob &&
      !!String(p.gender       ?? "").trim() &&
      !!p.avatar_url
    );
  },

  // ── Setup redirect path (fields only, no interests) ───────────
  getSetupRedirect: () => {
    const p = _profile;
    if (!p)                                   return "/setup/basics";
    if (!String(p.display_name ?? "").trim()) return "/setup/basics";
    if (!p.dob)                               return "/setup/dob";
    if (!String(p.gender ?? "").trim())       return "/setup/gender";
    if (!p.avatar_url)                        return "/setup/photo";
    return null;
  },

  // ── Interests check (hits DB once then caches) ─────────────────
  checkInterests: async (userId) => {
    // Already loaded for this session — return cached
    if (_interests !== null) return _interests;

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 1_500);

      const { count, error } = await supabase
        .from("user_interests")
        .select("interest_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) throw error;

      _interests = Number(count ?? 0);
      return _interests;
    } catch (err) {
      console.warn("[authStore] interests check failed:", err?.message ?? err);
      // On failure return 0 — gate will redirect to interests step
      return 0;
    }
  },

  // ── Full setup completion (fields + interests) ─────────────────
  // Used by setupGateRoute.beforeLoad
  // Cached after first call — resets when profile changes
  checkSetupComplete: async (userId) => {
    // Fast path: fields incomplete → no need to hit DB
    const redirect = authStore.getSetupRedirect();
    if (redirect !== null) return { isComplete: false, redirectTo: redirect };

    // Check localStorage flag first (set after successful full setup)
    try {
      const flag = localStorage.getItem(`SETUP_OK_${userId}`);
      if (flag === "1") return { isComplete: true, redirectTo: "/discover" };
    } catch { /* ignore */ }

    // Slow path: fields complete, check interests count
    const count = await authStore.checkInterests(userId);
    const hasEnoughInterests = count >= MIN_INTERESTS;

    if (hasEnoughInterests) {
      // Persist so future navigations skip DB entirely
      try { localStorage.setItem(`SETUP_OK_${userId}`, "1"); } catch { /* ignore */ }
      return { isComplete: true, redirectTo: "/discover" };
    }

    return { isComplete: false, redirectTo: "/setup/interests" };
  },

  // ── Mark setup done (called after last setup step) ────────────
  markSetupComplete: (userId) => {
    if (!userId) return;
    _interests = MIN_INTERESTS; // Prevent re-check
    try {
      localStorage.setItem(`SETUP_OK_${userId}`, "1");
      localStorage.setItem("SETUP_OK", "1");
    } catch { /* ignore */ }
  },

  // ── Invalidate interests cache (call after interests saved) ───
  invalidateInterests: () => {
    _interests = null;
    // Also clear localStorage flag so next navigation re-checks
    try {
      if (_session?.user?.id) {
        localStorage.removeItem(`SETUP_OK_${_session.user.id}`);
      }
    } catch { /* ignore */ }
  },

  // ── Reset everything on sign out ──────────────────────────────
  reset: () => {
    _session   = null;
    _profile   = null;
    _ready     = false;
    _interests = null;
  },

  // ── Wait for auth init (used in beforeLoad) ───────────────────
  waitUntilReady: () => {
    if (_ready) return Promise.resolve();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (_ready) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });
  },
};