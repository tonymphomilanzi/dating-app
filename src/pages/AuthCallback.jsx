// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.client.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null, profile: null });

  const loadData = async (user) => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data;
  };

  useEffect(() => {
    // Listen for ALL auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        localStorage.clear(); 
        sessionStorage.clear();
        setState({ ready: true, user: null, profile: null });
        window.location.href = "/auth"; // Absolute reset
        return;
      }

      const user = session?.user ?? null;
      const profile = await loadData(user);
      setState({ ready: true, user, profile });
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    ...state,
    isSetupComplete: !!(state.profile?.display_name && state.profile?.avatar_url),
    signOut: () => supabase.auth.signOut(),
    reloadProfile: async () => {
      const p = await loadData(state.user);
      setState(prev => ({ ...prev, profile: p }));
    }
  }), [state]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);