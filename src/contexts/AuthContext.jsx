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

const AuthCtx = createContext(null);

function isProfileComplete(p) {
  if (!p) return false;
  const hasName = !!String(p.display_name || "").trim();
  const hasDob = !!p.dob;
  const hasGender = !!String(p.gender || "").trim();
  // avatar is optional for "complete" — don't block users without it
  return hasName && hasDob && hasGender;
}

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
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      null;
    const avatar_url =
      u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: u.id, display_name, avatar_url })
      .select("id")
      .single();

    return created;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const initRef = useRef(false);
  const loadingRef = useRef(false);

  const loadProfile = useCallback(async (u) => {
    // Prevent concurrent loads
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      if (!u) {
        setProfile(null);
        return;
      }

      await ensureProfileRow(u);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender"
        )
        .eq("id", u.id)
        .maybeSingle();

      if (error) {
        console.warn("[Auth] loadProfile error:", error.message);
        setProfile(null);
        return;
      }

      const prof = data || null;
      setProfile(prof);

      // Persist setup-complete flag
      try {
        if (isProfileComplete(prof)) {
          localStorage.setItem(`SETUP_OK_${u.id}`, "1");
          localStorage.setItem("SETUP_OK", "1");
        } else {
          // Clear stale flags if profile is now incomplete
          localStorage.removeItem(`SETUP_OK_${u.id}`);
          localStorage.removeItem("SETUP_OK");
        }
      } catch {}
    } catch (e) {
      console.error("[Auth] loadProfile exception:", e);
      setProfile(null);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Clear state immediately so UI reacts fast
      setSession(null);
      setUser(null);
      setProfile(null);
      try {
        localStorage.removeItem("SETUP_OK");
        // Clear all SETUP_OK_* keys
        Object.keys(localStorage)
          .filter((k) => k.startsWith("SETUP_OK_"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[Auth] signOut error:", e);
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let subscription = null;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[Auth] getSession error:", error.message);

        const sess = data?.session ?? null;
        const u = sess?.user ?? null;

        setSession(sess);
        setUser(u);

        if (u) {
          await loadProfile(u);
        }
      } catch (e) {
        console.error("[Auth] init exception:", e);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        // ALWAYS mark ready so spinner never hangs
        setReady(true);
      }

      // Subscribe AFTER initial load to avoid double-firing
      const { data: sub } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          const u = newSession?.user ?? null;

          setSession(newSession);
          setUser(u);

          if (event === "SIGNED_OUT" || !u) {
            setProfile(null);
            setSession(null);
            setUser(null);
            return;
          }

          if (
            event === "SIGNED_IN" ||
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
      try {
        subscription?.unsubscribe();
      } catch {}
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      profile,
      isPremium: !!profile?.is_premium,
      isProfileComplete: isProfileComplete(profile),
      signOut,
      reloadProfile: () => loadProfile(user),
    }),
    [ready, session, user, profile, signOut, loadProfile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}