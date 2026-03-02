import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u) {
    if (!u) { setProfile(null); return; }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, is_premium")
      .eq("id", u.id)
      .single();
    if (!error) setProfile(data);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      setUser(data.session?.user || null);
      await loadProfile(data.session?.user || null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, s) => {
      setSession(s);
      setUser(s?.user || null);
      await loadProfile(s?.user || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      isPremium: !!profile?.is_premium,
      loading,
      signOut,
      reloadProfile: () => loadProfile(user),
    }),
    [session, user, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}