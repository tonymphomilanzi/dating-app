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
 * A profile is "complete" when the minimum required fields are populated.
 * UPDATED: Now aligns with SetupGate requirements for consistency.
 * avatar_url is still optional here - users can skip photo and still be considered complete.
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
  get: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
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
 * UPDATED: Also checks for interests count and sets flag appropriately.
 */
function syncSetupFlag(uid, profile) {
  if (!uid) return;
  if (isProfileComplete(profile)) {
    storage.set(`SETUP_OK_${uid}`, "1");
    storage.set("SETUP_OK", "1"); // Keep legacy for compatibility
  } else {
    storage.remove(`SETUP_OK_${uid}`);
    storage.remove("SETUP_OK");
  }
}

/**
 * NEW: Force set setup completion flag (used when we know setup is done)
 */
function forceSetupComplete(uid) {
  if (!uid) return;
  storage.set(`SETUP_OK_${uid}`, "1");
  storage.set("SETUP_OK", "1");
}

/**
 * Ensure a profile row exists for an auth user.
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

  const initRef = useRef(false);
  const profileLoadIdRef = useRef(0);

  // ── loadProfile ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async (u) => {
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
  }, []);

  // ── signOut ─────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    try {
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

  // ── NEW: markSetupComplete ──────────────────────────────────────────────────

  const markSetupComplete = useCallback(() => {
    if (user?.id) {
      forceSetupComplete(user.id);
    }
  }, [user?.id]);

  // ── Initialisation effect ───────────────────────────────────────────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let subscription = null;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn("[Auth] getSession error:", error.message);
        }

        const sess = data?.session ?? null;
        const u    = sess?.user    ?? null;

        setSession(sess);
        setUser(u);

        if (u) {
          await loadProfile(u);
        }
      } catch (err) {
        console.error("[Auth] init exception:", err);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setReady(true);
      }

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
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // ── reloadProfile ───────────────────────────────────────────────────────────

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
      markSetupComplete, // NEW: Allow components to mark setup as complete
    }),
    [ready, session, user, profile, signOut, reloadProfile, markSetupComplete]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}