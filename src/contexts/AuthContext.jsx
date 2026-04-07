// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.client.js";

const AuthCtx = createContext(null);
const SETUP_OK_KEY = (uid) => `SETUP_OK_${uid}`;

// Customize which fields count as “complete” (matches your SetupGate)
function isLocallyComplete(p) {
  if (!p) return false;
  const hasName = !!String(p.display_name || "").trim();
  const hasDob = !!p.dob;
  const hasGender = !!String(p.gender || "").trim();
  const hasAvatar = !!String(p.avatar_url || "").trim();
  return hasName && hasDob && hasGender && hasAvatar;
}

// Best-effort: create a minimal profile if missing
async function ensureProfileRow(u) {
  try {
    if (!u) return null;

    const { data: existing, error: selErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", u.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return existing;

    const display_name =
      u.user_metadata?.display_name ||
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      null;
    const avatar_url = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({ id: u.id, display_name, avatar_url })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return created;
  } catch {
    // If RLS disallows, or a trigger already creates it, just skip.
    return null;
  }
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const initRef = useRef(false);

  async function loadProfile(u) {
    try {
      if (!u) {
        setProfile(null);
        return;
      }

      // Ensure row exists if your DB doesn't auto-create it
      await ensureProfileRow(u);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_premium, city, lat, lng, dob, gender")
        .eq("id", u.id)
        .maybeSingle();

      if (error) {
        console.warn("[Auth] loadProfile error:", error.message);
        setProfile(null);
        return;
      }

      setProfile(data || null);

      // Mark setup complete flags if profile meets requirements
      try {
        const complete = isLocallyComplete(data);
        if (complete) {
          localStorage.setItem("SETUP_OK", "1"); // backward-compat with existing SetupGate
          localStorage.setItem(SETUP_OK_KEY(u.id), "1"); // user-scoped flag
        }
      } catch {}
    } catch (e) {
      console.error("[Auth] loadProfile exception:", e);
      setProfile(null);
    }
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let unsub;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[Auth] getSession error:", error.message);
        const sess = data?.session || null;
        setSession(sess);
        const u = sess?.user || null;
        setUser(u);
        await loadProfile(u);
      } catch (e) {
        console.error("[Auth] getSession exception:", e);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setReady(true);
      }

      const sub = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        const u = newSession?.user || null;
        setUser(u);

        if (event === "SIGNED_OUT" || !u) {
          setProfile(null);
          return;
        }

        // For SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.
        await loadProfile(u);
      });

      unsub = () => sub.data.subscription.unsubscribe();
    })();

    return () => {
      try { unsub?.(); } catch {}
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      profile,
      isPremium: !!profile?.is_premium,
      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          try {
            if (user?.id) localStorage.removeItem(SETUP_OK_KEY(user.id));
          } catch {}
        }
      },
      reloadProfile: () => loadProfile(user),
    }),
    [ready, session, user, profile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}