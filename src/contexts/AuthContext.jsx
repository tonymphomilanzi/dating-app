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
 * Explicit column list — avoids over-fetching and makes schema changes visible.
 * Never use select("*") — it fetches sensitive columns and breaks on schema changes.
 */
const PROFILE_COLUMNS =
  "id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender";

/**
 * Auth state-change events that should trigger a profile reload.
 * INITIAL_SESSION is excluded — we handle that explicitly via getSession().
 */
const PROFILE_RELOAD_EVENTS = new Set([
  "SIGNED_IN",
  "TOKEN_REFRESHED",
  "USER_UPDATED",
]);

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Pure module-level helpers ────────────────────────────────────────────────

/**
 * A profile is "complete" when the minimum required fields are populated.
 * avatar_url is intentionally excluded — we never block users without a photo.
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
 * Safe localStorage wrapper.
 * Silences SecurityError in private/incognito mode where storage is blocked.
 */
const storage = {
  get: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove: (key) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  removeByPrefix: (prefix) => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },
};

/**
 * Sync the setup-complete localStorage flag based on profile completeness.
 * Two keys maintained for backwards compatibility:
 *   SETUP_OK_{uid} — uid-scoped (preferred)
 *   SETUP_OK       — legacy global key
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
 * Ensure a profile row exists for the given auth user.
 * Uses upsert with ignoreDuplicates — single round-trip, race-condition safe.
 * Prefer user_metadata fields set during sign-up for the initial values.
 *
 * @param {object} u - Supabase auth user object
 */
async function ensureProfileRow(u) {
  if (!u) return;

  const display_name =
    u.user_metadata?.display_name ||
    u.user_metadata?.full_name     ||
    u.user_metadata?.name          ||
    null;

  const avatar_url =
    u.user_metadata?.avatar_url ||
    u.user_metadata?.picture    ||
    null;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: u.id, display_name, avatar_url },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    // Log but don't throw — the SELECT below reveals the true DB state
    console.warn("[Auth] ensureProfileRow:", error.message);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // `ready` = true once the initial session check is fully complete.
  // Gate your entire app on this to avoid flashing login/loading screens.
  const [ready, setReady]                   = useState(false);
  const [user, setUser]                     = useState(null);
  const [profile, setProfile]               = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError]                   = useState(null);

  // Cancel-token for the active loadProfile call.
  // Prevents a slow/stale fetch from overwriting a newer one.
  const profileLoadRef = useRef({ id: 0 });

  // ── Profile loader ───────────────────────────────────────────────────────

  /**
   * Fetch (and optionally create) the profile row for an auth user.
   *
   * Cancellation: each call gets a unique load-id. When a newer call starts,
   * the previous id is superseded and its state updates are silently dropped.
   *
   * @param {object|null} u - Supabase auth user (null → clear profile)
   */
  const loadProfile = useCallback(async (u) => {
    // Increment the load-id — any previous in-flight load is now "cancelled"
    const loadId = profileLoadRef.current.id + 1;
    profileLoadRef.current = { id: loadId };

    // Helper: true if a newer loadProfile call has started since this one
    const isCancelled = () => profileLoadRef.current.id !== loadId;

    if (!u) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    try {
      // Create the row if it doesn't exist yet (new OAuth / magic-link users)
      await ensureProfileRow(u);
      if (isCancelled()) return;

      // ✅ CORRECT Supabase v2 pattern:
      //    `await` the query builder, then read `{ data, error }` from the result.
      //    NEVER chain .catch() — the query builder is a PromiseLike, not a Promise.
      //    .catch() does not exist on it and will throw "is not a function".
      const { data, error: selectError } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", u.id)
        .maybeSingle(); // Returns null (not an error) when no row exists

      if (isCancelled()) return;

      if (selectError) {
        console.warn("[Auth] loadProfile select error:", selectError.message);
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
  }, []); // Stable ref — uses cancel-token, never closes over changing state

  // ── Initialisation + auth listener ───────────────────────────────────────

  useEffect(() => {
    /**
     * WHY we use getSession() + onAuthStateChange together:
     *
     * In Supabase JS v2, onAuthStateChange is NOT guaranteed to fire
     * synchronously on listener registration. If we rely solely on the
     * listener for the initial session, there is a race where the app hangs
     * on the loading screen indefinitely if the listener fires before React
     * has finished setting up the effect, or if the internal _initialize
     * has already resolved and the event is missed.
     *
     * Safe pattern:
     *   1. getSession() — reliably gets the current session right now
     *   2. onAuthStateChange — handles all subsequent changes
     *   3. setReady(true) in finally — guaranteed to always be called
     */

    let cancelled = false; // Guards against state updates after unmount

    // ── Step 1: Get the initial session ────────────────────────────────────
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // Component unmounted before the async call resolved
        if (cancelled) return;

        if (sessionError) {
          console.warn("[Auth] getSession error:", sessionError.message);
          // Don't throw — we still need to call setReady(true) in finally
        }

        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          // Load profile as part of initialization so `ready` is set only
          // AFTER we have profile data — prevents consumers seeing ready=true
          // with profile=null on the first render.
          await loadProfile(u);
          if (cancelled) return;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[Auth] initialization exception:", err);
        // Clear any partial state
        setUser(null);
        setProfile(null);
      } finally {
        // ALWAYS set ready — even if an error occurred.
        // This is the only place setReady(true) is called.
        // The app must never hang on the loading screen.
        if (!cancelled) setReady(true);
      }
    };

    // ── Step 2: Subscribe to subsequent auth changes ────────────────────────
    // Subscribe BEFORE calling initializeAuth to avoid missing events that
    // fire between getSession() resolving and the subscription being set up.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the INITIAL_SESSION event — initializeAuth() handles that.
      // Without this guard, the listener would trigger a redundant loadProfile
      // call immediately after we've already loaded the profile above.
      if (event === "INITIAL_SESSION") return;

      const u = session?.user ?? null;

      if (event === "SIGNED_OUT" || !u) {
        // Clear all auth state
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
          setError(null);
          storage.removeByPrefix("SETUP_OK_");
          storage.remove("SETUP_OK");
        }
        return;
      }

      // Update user for any other event
      if (!cancelled) setUser(u);

      // Reload the profile for events that may change user data
      if (PROFILE_RELOAD_EVENTS.has(event)) {
        await loadProfile(u);
      }
    });

    // Run the initializer
    initializeAuth();

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      // Cancel any in-flight profile load
      profileLoadRef.current = { id: profileLoadRef.current.id + 1 };
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Register a new user with email + password.
   * Passes displayName via user_metadata so ensureProfileRow picks it up.
   */
  const signUp = useCallback(async ({ email, password, displayName }) => {
    try {
      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
          },
        },
      });

      if (signUpError) throw signUpError;

      // Profile row is created automatically by loadProfile → ensureProfileRow
      // which fires via the onAuthStateChange SIGNED_IN event.
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
   * Send a magic link / OTP email.
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
   * State is cleared by the SIGNED_OUT event handler — not here — so we
   * don't end up in a split state if the API call fails.
   */
  const signOut = useCallback(async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
      // onAuthStateChange SIGNED_OUT handler clears user / profile / flags
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
   * Update the current user's profile and sync local state.
   */
  const updateProfile = useCallback(
    async (updates) => {
      try {
        setError(null);
        if (!user) throw new Error("No authenticated user.");

        // ✅ Correct: await the query, read error from result object
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
    [user] // Re-create when user changes so user.id is always current
  );

  /**
   * Force a profile refresh from the server.
   * Call this after the setup flow completes or after profile mutations.
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
      /** True once the initial session check is complete — gate your app on this */
      ready,
      /**
       * @deprecated Use `ready` instead.
       * Kept as an alias so legacy consumers that read `isLoading` don't break.
       */
      isLoading: !ready,
      user,
      profile,
      profileLoading,
      error,

      // ── Derived convenience flags ───────────────────────────────────────
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

export { AuthContext };