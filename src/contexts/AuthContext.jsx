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

const PROFILE_COLUMNS =
  "id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender";

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * A profile is "complete" when the three minimum fields are populated.
 * avatar_url is intentionally excluded — never block a user without a photo.
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
 * Safe localStorage helpers.
 * Silences SecurityError in private/incognito environments.
 */
const storage = {
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
 * Sync the setup-complete flag based on profile completeness.
 * Two keys for backwards compatibility:
 *   SETUP_OK_{uid} — uid-scoped (preferred, read by SetupGate)
 *   SETUP_OK       — legacy global key
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
 * Ensure a profile row exists for an auth user.
 *
 * Uses SELECT → INSERT (your original pattern) rather than upsert because
 * your RLS policies may not permit upsert on the profiles table.
 * Errors are swallowed — the subsequent SELECT in loadProfile reveals truth.
 */
async function ensureProfileRow(u) {
  if (!u) return null;
  try {
    // Check if row already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", u.id)
      .maybeSingle();

    if (existing) return existing;

    // Create minimal row for new OAuth / magic-link users
    const display_name =
      u.user_metadata?.display_name ||
      u.user_metadata?.full_name     ||
      u.user_metadata?.name          ||
      null;

    const avatar_url =
      u.user_metadata?.avatar_url ||
      u.user_metadata?.picture    ||
      null;

    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: u.id, display_name, avatar_url })
      .select("id")
      .single();

    return created;
  } catch (err) {
    // Log but don't throw — caller handles null gracefully
    console.warn("[Auth] ensureProfileRow:", err?.message ?? err);
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [ready, setReady]     = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);

  // ── Refs ────────────────────────────────────────────────────────────────────

  /**
   * Guards against double-initialisation in React 18 Strict Mode.
   * Strict Mode mounts → unmounts → remounts; without this guard,
   * `init()` runs twice, causing two getSession() calls and two
   * loadProfile() calls racing each other.
   *
   * Using a ref (not state) means it survives remounts without
   * triggering a re-render.
   */
  const initRef = useRef(false);

  /**
   * Prevents concurrent loadProfile calls from racing each other.
   *
   * BUG IN ORIGINAL: the ref guard silently drops loads for a *new* user
   * if the previous user's load is still in-flight (sign-out → sign-in fast).
   * Fixed below with a load-id pattern instead of a binary mutex.
   */
  const profileLoadIdRef = useRef(0);

  // ── loadProfile ─────────────────────────────────────────────────────────────

  /**
   * Fetch and cache the profile for the given auth user.
   *
   * Cancellation model: each call increments a load-id. If a newer call
   * starts before this one resolves, `isCancelled()` returns true and all
   * state updates are silently discarded — preventing a slow stale load
   * from overwriting fresher data.
   *
   * @param {object|null} u - Supabase auth user object
   */
  const loadProfile = useCallback(async (u) => {
    // Issue a new load-id, cancelling any previous in-flight load
    const loadId = profileLoadIdRef.current + 1;
    profileLoadIdRef.current = loadId;

    const isCancelled = () => profileLoadIdRef.current !== loadId;

    if (!u) {
      setProfile(null);
      return;
    }

    try {
      await ensureProfileRow(u);
      if (isCancelled()) return;

      // ✅ Correct Supabase v2 pattern:
      //    Await the query builder and read {data, error} from the result.
      //    Never chain .catch() — the query builder is a PromiseLike,
      //    not a real Promise. .catch() does not exist on it.
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", u.id)
        .maybeSingle();

      if (isCancelled()) return;

      if (error) {
        console.warn("[Auth] loadProfile error:", error.message);
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
    }
  }, []); // Stable — uses load-id pattern, not closures over changing state

  // ── signOut ─────────────────────────────────────────────────────────────────

  /**
   * Sign the user out.
   *
   * Your original pattern (clear state first, then call API) is preserved.
   * The trade-off: if signOut() fails, the UI shows logged-out but the
   * Supabase session is still valid. Acceptable for this app's risk profile.
   */
  const signOut = useCallback(async () => {
    try {
      // Clear UI state immediately for a snappy feel
      setSession(null);
      setUser(null);
      setProfile(null);
      storage.removeByPrefix("SETUP_OK_");
      storage.remove("SETUP_OK");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }
  }, []);

  // ── Initialisation effect ───────────────────────────────────────────────────

  useEffect(() => {
    /**
     * WHY initRef instead of removing it:
     *
     * React 18 Strict Mode intentionally runs effects twice in development
     * (mount → unmount → remount) to surface side-effect bugs.
     *
     * The cleanup function runs between the two mounts, but `subscription`
     * is assigned inside the async `init()` — it may still be null when
     * cleanup runs if getSession() hasn't resolved yet. This means:
     *   - First mount:  init() starts, cleanup runs (subscription is null → noop)
     *   - Second mount: init() would run AGAIN without the ref guard
     *
     * The ref prevents the second run. In production this is irrelevant
     * (effects only run once) but it prevents double-fetches in development.
     */
    if (initRef.current) return;
    initRef.current = true;

    let subscription = null;

    const init = async () => {
      try {
        // ── Step 1: Reliable initial session ─────────────────────────────
        // getSession() is synchronous with the stored token — always resolves.
        // This is the ONLY place setReady(true) is called, guaranteed by finally.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn("[Auth] getSession error:", error.message);
          // Don't throw — we must reach finally to call setReady(true)
        }

        const sess = data?.session ?? null;
        const u    = sess?.user    ?? null;

        setSession(sess);
        setUser(u);

        if (u) {
          // Await profile load so `ready` is set only after we have profile
          // data — prevents consumers seeing ready=true with profile=null
          await loadProfile(u);
        }
      } catch (err) {
        console.error("[Auth] init exception:", err);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        // ✅ ALWAYS called — the app can NEVER hang on the loading screen
        setReady(true);
      }

      // ── Step 2: Subscribe AFTER initial load ──────────────────────────
      // Subscribing after getSession() + loadProfile() ensures the listener
      // doesn't fire SIGNED_IN and trigger a redundant loadProfile() for the
      // session we just handled above.
      const { data: sub } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          const u = newSession?.user ?? null;

          setSession(newSession);
          setUser(u);

          if (event === "SIGNED_OUT" || !u) {
            setProfile(null);
            setSession(null);
            setUser(null);
            storage.removeByPrefix("SETUP_OK_");
            storage.remove("SETUP_OK");
            return;
          }

          if (
            event === "SIGNED_IN"      ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED"
          ) {
            await loadProfile(u);
          }
        }
      );

      subscription = sub.subscription;
    };

    init();

    return () => {
      // Unsubscribe the auth listener on unmount.
      // Note: if init() hasn't resolved yet, subscription is still null here
      // (handled by the initRef guard preventing a second init() run).
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // ── reloadProfile ───────────────────────────────────────────────────────────

  /**
   * Force a profile refresh from the server.
   * Call this after the setup flow completes or after a profile mutation.
   *
   * BUG IN ORIGINAL: `() => loadProfile(user)` was defined inline inside
   * useMemo, closing over a potentially stale `user` value. Fixed by
   * using useCallback with [loadProfile, user] as deps.
   */
  const reloadProfile = useCallback(() => {
    loadProfile(user);
  }, [loadProfile, user]);

  // ── Context value ───────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      profile,
      isPremium:         !!profile?.is_premium,
      isProfileComplete: isProfileComplete(profile),
      signOut,
      reloadProfile,
    }),
    [ready, session, user, profile, signOut, reloadProfile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}