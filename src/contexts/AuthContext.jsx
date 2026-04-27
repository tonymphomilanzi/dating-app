// src/contexts/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase.client.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Columns fetched for every profile load.
 * Explicit selection avoids over-fetching and makes schema changes visible.
 */
const PROFILE_COLUMNS =
  "id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender";

/**
 * Auth state-change events that should trigger a profile reload.
 */
const PROFILE_RELOAD_EVENTS = new Set([
  "SIGNED_IN",
  "TOKEN_REFRESHED",
  "USER_UPDATED",
]);

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Helpers (module-level — never recreated on render) ───────────────────────

/**
 * Check whether a profile has the minimum fields to be considered complete.
 * avatar_url is optional — we don't block users who skip a photo.
 *
 * @param {object|null} p
 * @returns {boolean}
 */
function isProfileComplete(p) {
  if (!p) return false;
  return (
    !!String(p.display_name ?? "").trim() &&
    !!p.dob &&
    !!String(p.gender ?? "").trim()
  );
}

/**
 * Safe localStorage helpers — silences SecurityError in private browsing.
 */
const storage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, v) => { try { localStorage.setItem(key, v); } catch { /* ignore */ } },
  remove: (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  removeByPrefix: (prefix) => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },
};

/**
 * Persist or clear the setup-complete flag for a user.
 *
 * @param {string}      uid
 * @param {object|null} profile
 */
function syncSetupFlag(uid, profile) {
  if (!uid) return;
  if (isProfileComplete(profile)) {
    storage.set(`SETUP_OK_${uid}`, "1");
    storage.set("SETUP_OK", "1");
  } else {
    storage.remove(`SETUP_OK_${uid}`);
    storage.remove("SETUP_OK");
  }
}

/**
 * Upsert a minimal profile row for new OAuth / magic-link users.
 * Single round-trip — INSERT … ON CONFLICT DO NOTHING.
 *
 * @param {object} u - Supabase auth user
 */
async function ensureProfileRow(u) {
  if (!u) return;

  const display_name =
    u.user_metadata?.display_name ||
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    null;

  const avatar_url =
    u.user_metadata?.avatar_url ||
    u.user_metadata?.picture ||
    null;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: u.id, display_name, avatar_url },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    // Log but don't throw — the SELECT below will reveal the true state
    console.warn("[Auth] ensureProfileRow:", error.message);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // `ready` matches the name all guards/consumers expect.
  // True once the initial session check is complete.
  const [ready, setReady] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cancel-token for the active loadProfile call.
  // Incremented on each new call — stale calls check and bail out.
  const profileLoadRef = useRef({ id: 0 });

  // ── Profile loader ───────────────────────────────────────────────────────

  /**
   * Fetch (and optionally create) the profile row for an auth user.
   * Uses a load-id pattern to discard results from superseded calls.
   *
   * @param {object|null} u
   */
  const loadProfile = useCallback(async (u) => {
    // Issue a new load-id and immediately cancel any previous load
    const loadId = profileLoadRef.current.id + 1;
    profileLoadRef.current = { id: loadId };

    const isCancelled = () => profileLoadRef.current.id !== loadId;

    if (!u) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    try {
      await ensureProfileRow(u);
      if (isCancelled()) return;

      // ✅ Correct Supabase v2 pattern: await the query, read error from result.
      //    Never chain .catch() on the query builder — it's a PromiseLike, not
      //    a real Promise, and .catch() does not exist on it.
      const { data, error: selectError } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", u.id)
        .maybeSingle(); // Returns null (not error) when no row found

      if (isCancelled()) return;

      if (selectError) {
        console.warn("[Auth] loadProfile select:", selectError.message);
        setProfile(null);
        return;
      }

      const prof = data ?? null;
      setProfile(prof);
      syncSetupFlag(u.id, prof);
    } catch (err) {
      if (isCancelled()) return;
      console.error("[Auth] loadProfile exception:", err);
      setProfile(null);
    } finally {
      if (!isCancelled()) setProfileLoading(false);
    }
  }, []); // Stable — uses cancel-token, not closures over changing state

  // ── Auth listener (single source of truth) ───────────────────────────────

  useEffect(() => {
    /**
     * Subscribe to auth state changes FIRST — Supabase fires the listener
     * synchronously with the current session on registration, giving us the
     * initial session for free. This eliminates the double-fetch that occurs
     * when getSession() and onAuthStateChange() are used together.
     */
    let initialFired = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;

      // ── Signed out ──────────────────────────────────────────────────────
      if (event === "SIGNED_OUT" || !u) {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setError(null);
        storage.removeByPrefix("SETUP_OK_");
        storage.remove("SETUP_OK");

        if (!initialFired) {
          initialFired = true;
          setReady(true);
        }
        return;
      }

      // ── Signed in / token refreshed / user updated ──────────────────────
      setUser(u);

      if (PROFILE_RELOAD_EVENTS.has(event) || !initialFired) {
        await loadProfile(u);
      }

      if (!initialFired) {
        initialFired = true;
        setReady(true);
      }
    });

    return () => {
      // Invalidate any in-flight profile load
      profileLoadRef.current = { id: profileLoadRef.current.id + 1 };
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Sign up with email + password and create a profile row.
   */
  const signUp = useCallback(async ({ email, password, displayName }) => {
    try {
      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Pass display_name so ensureProfileRow picks it up from user_metadata
          data: { display_name: displayName || email.split("@")[0] },
        },
      });

      if (signUpError) throw signUpError;

      // ensureProfileRow is called automatically by loadProfile via the
      // onAuthStateChange SIGNED_IN event — no need to call it here.
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Sign in with email + password.
   */
  const signIn = useCallback(async ({ email, password }) => {
    try {
      setError(null);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Sign in with a magic link (OTP email).
   */
  const signInWithMagicLink = useCallback(async ({ email }) => {
    try {
      setError(null);

      const { error: otpError } = await supabase.auth.signInWithOtp({ email });

      if (otpError) throw otpError;
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Sign out.
   * State is cleared by the SIGNED_OUT event handler — not manually here —
   * to avoid split state if the API call fails.
   */
  const signOut = useCallback(async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
      // onAuthStateChange SIGNED_OUT clears user/profile/flags
    } catch (err) {
      setError(err.message);
      // Force-clear locally so the UI doesn't stay stuck in a logged-in state
      setUser(null);
      setProfile(null);
      storage.removeByPrefix("SETUP_OK_");
      storage.remove("SETUP_OK");
      throw err;
    }
  }, []);

  /**
   * Update the current user's profile.
   * Optimistically updates local state on success.
   */
  const updateProfile = useCallback(
    async (updates) => {
      try {
        setError(null);
        if (!user) throw new Error("No authenticated user.");

        // ✅ Correct: await the query, destructure result — never chain .catch()
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select(PROFILE_COLUMNS)
          .single();

        if (updateError) throw updateError;

        setProfile(data);
        syncSetupFlag(user.id, data);
        return data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user] // Re-create when user changes so we always have the correct user.id
  );

  /**
   * Force a profile refresh from the server.
   * Useful after the setup flow completes.
   */
  const reloadProfile = useCallback(() => {
    loadProfile(user);
  }, [loadProfile, user]);

  /**
   * Clear the last error (e.g. after displaying it in the UI).
   */
  const clearError = useCallback(() => setError(null), []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      // ── Auth state ──────────────────────────────────────────────────────
      /** True once the initial session check resolves — gate your app on this */
      ready,
      /** @deprecated Use `ready` instead. Alias kept for legacy consumers. */
      isLoading: !ready,
      user,
      profile,
      profileLoading,
      error,

      // ── Derived flags ───────────────────────────────────────────────────
      isAuthenticated:   !!user,
      isPremium:         !!profile?.is_premium,
      isProfileComplete: isProfileComplete(profile),

      // ── Actions ─────────────────────────────────────────────────────────
      signUp,
      signIn,
      signInWithMagicLink,
      signOut,
      updateProfile,
      reloadProfile,
      clearError,
    }),
    [
      ready,
      user,
      profile,
      profileLoading,
      error,
      signUp,
      signIn,
      signInWithMagicLink,
      signOut,
      updateProfile,
      reloadProfile,
      clearError,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Primary hook — use this in all components.
 * @throws if used outside <AuthProvider>
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// Named export for advanced use cases (e.g. HOCs, testing)
export { AuthContext };