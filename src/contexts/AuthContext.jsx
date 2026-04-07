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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data;
  };

  useEffect(() => {
    // Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await loadProfile(session.user.id);
        setState({ ready: true, session, user: session.user, profile });
      } else {
        setState({ ready: true, session: null, user: null, profile: null });
      }
    });

    // Listen for Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ ready: true, session: null, user: null, profile: null });
        return;
      }
      if (session) {
        const profile = await loadProfile(session.user.id);
        setState({ ready: true, session, user: session.user, profile });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    ...state,
    signOut: async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    },
    reloadProfile: async () => {
      const p = await loadProfile(state.user?.id);
      setState(prev => ({ ...prev, profile: p }));
    }
  }), [state]);

  if (!state.ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-fuchsia-600 border-t-transparent"></div>
      </div>
    );
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);