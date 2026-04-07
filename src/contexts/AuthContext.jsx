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

  const loadProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      const profile = user ? await loadProfile(user.id) : null;
      setState({ ready: true, session, user, profile });
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ ready: true, session: null, user: null, profile: null });
      } else if (session) {
        const profile = await loadProfile(session.user.id);
        setState({ ready: true, session, user: session.user, profile });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    ...state,
    // Checks if the user has finished the onboarding flow
    isSetupComplete: !!(state.profile?.display_name && state.profile?.avatar_url),
    reloadProfile: async () => {
      const p = await loadProfile(state.user?.id);
      setState(prev => ({ ...prev, profile: p }));
    },
    signOut: async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    }
  }), [state]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);