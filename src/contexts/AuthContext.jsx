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
import { supabase }   from "../lib/supabase.client.js";
import { authStore }  from "../lib/authStore.js";

// ─── Constants ────────────────────────────────────────────────────
const PROFILE_COLUMNS =
  "id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender";

// ─── Context ──────────────────────────────────────────────────────
const AuthCtx = createContext(null);

// ─── Pure helpers ─────────────────────────────────────────────────
function isProfileComplete(p) {
  if (!p) return false;
  return (
    !!String(p.display_name ?? "").trim() &&
    !!p.dob &&
    !!String(p.gender ?? "").trim()
  );
}

const storage = {
  set:          (k, v) => { try { localStorage.setItem(k, v);    } catch {} },
  get:          (k)    => { try { return localStorage.getItem(k); } catch { return null; } },
  remove:       (k)    => { try { localStorage.removeItem(k);     } catch {} },
  removeByPrefix: (prefix) => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

async function ensureProfileRow(u) {
  if (!u) return null;
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", u.id)
      .maybeSingle();

    if (existing) return existing;

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

// ─── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [ready,   setReady]   = useState(false);
  const [session, setSession] = useState(null);
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);

  const initRef          = useRef(false);
  const profileLoadIdRef = useRef(0);

  // ── loadProfile ────────────────────────────────────────────────
  const loadProfile = useCallback(async (u) => {
    const loadId = ++profileLoadIdRef.current;
    const isCancelled = () => profileLoadIdRef.current !== loadId;

    if (!u) {
      setProfile(null);
      authStore.setProfile(null);
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
        authStore.setProfile(null);
        return;
      }

      const prof = data ?? null;
      setProfile(prof);
      authStore.setProfile(prof); // Syncs to router — also resets interests cache
    } catch (err) {
      if (isCancelled()) return;
      console.error("[Auth] loadProfile exception:", err);
      setProfile(null);
      authStore.setProfile(null);
    }
  }, []);

  // ── signOut ────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      setSession(null);
      setUser(null);
      setProfile(null);
      authStore.reset(); // Clears everything in one call
      storage.removeByPrefix("SETUP_OK_");
      storage.remove("SETUP_OK");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }
  }, []);

  // ── markSetupComplete ──────────────────────────────────────────
  const markSetupComplete = useCallback(() => {
    if (user?.id) {
      authStore.markSetupComplete(user.id);
    }
  }, [user?.id]);

  // ── invalidateInterests ────────────────────────────────────────
  // Call this after user saves their interests in SetupInterests page
  const invalidateInterests = useCallback(() => {
    authStore.invalidateInterests();
  }, []);

  // ── Initialisation ─────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let subscription = null;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[Auth] getSession error:", error.message);

        const sess = data?.session ?? null;
        const u    = sess?.user    ?? null;

        setSession(sess);
        setUser(u);
        authStore.setSession(sess);

        if (u) await loadProfile(u);
      } catch (err) {
        console.error("[Auth] init exception:", err);
        setSession(null);
        setUser(null);
        setProfile(null);
        authStore.reset();
      } finally {
        setReady(true);
        authStore.setReady(true); // ← Unblocks router beforeLoad
      }

      const { data: sub } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          const u = newSession?.user ?? null;

          setSession(newSession);
          setUser(u);
          authStore.setSession(newSession);

          if (event === "SIGNED_OUT" || !u) {
            setProfile(null);
            setSession(null);
            setUser(null);
            authStore.reset();
            storage.removeByPrefix("SETUP_OK_");
            storage.remove("SETUP_OK");
            return;
          }

          if (
            event === "SIGNED_IN"       ||
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
    return () => { subscription?.unsubscribe(); };
  }, [loadProfile]);

  // ── reloadProfile ──────────────────────────────────────────────
  const reloadProfile = useCallback(() => {
    loadProfile(user);
  }, [loadProfile, user]);

  // ── Context value ──────────────────────────────────────────────
  const value = useMemo(() => ({
    ready,
    session,
    user,
    profile,
    isPremium:          !!profile?.is_premium,
    isProfileComplete:  isProfileComplete(profile),
    signOut,
    reloadProfile,
    markSetupComplete,
    invalidateInterests, // ← Expose so SetupInterests page can call it
  }), [ready, session, user, profile, signOut, reloadProfile, markSetupComplete, invalidateInterests]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}