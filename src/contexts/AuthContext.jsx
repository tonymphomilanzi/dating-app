import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../api/lib/supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const initRef = useRef(false);

  async function loadProfile(u) {
    try {
      if (!u) { setProfile(null); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_premium, city, lat, lng")
        .eq("id", u.id)
        .maybeSingle();
      if (error) {
        console.warn("[Auth] loadProfile error:", error.message);
        setProfile(null);
      } else {
        setProfile(data || null);
      }
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
        await loadProfile(u);
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();

    return () => { try { unsub?.(); } catch {} };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      profile,
      isPremium: !!profile?.is_premium,
      signOut: async () => { await supabase.auth.signOut(); },
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