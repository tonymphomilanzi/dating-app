// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.client.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    ready: false,
    session: null,
    user: null,
    profile: null,
  });

  const checkCompleteness = (p) => {
    if (!p) return false;
    const requirements = ["display_name", "dob", "gender", "avatar_url"];
    return requirements.every(key => !!p[key]);
  };

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      let profile = null;
      
      if (user) profile = await loadProfile(user.id);

      setState({
        ready: true,
        session,
        user,
        profile,
      });

      if (event === "SIGNED_OUT") {
        localStorage.clear(); // Nuclear clean for security
        window.location.href = "/auth";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    ...state,
    isSetupComplete: checkCompleteness(state.profile),
    signOut: () => supabase.auth.signOut(),
    reloadProfile: async () => {
      const p = await loadProfile(state.user?.id);
      setState(prev => ({ ...prev, profile: p }));
    }
  }), [state]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);