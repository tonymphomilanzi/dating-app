// src/contexts/AuthContext.jsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { supabase } from "../lib/supabase.client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);

          // Fetch user profile
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profileError && profileError.code !== "PGRST116") {
            throw profileError;
          }

          setProfile(profileData || null);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);

        // Fetch profile when user changes
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()
          .catch(() => ({ data: null }));

        setProfile(profileData);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = useCallback(
    async ({ email, password, displayName }) => {
      try {
        setError(null);

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              display_name: displayName || email.split("@")[0],
              avatar_url: null,
            });

          if (profileError) throw profileError;
        }

        return data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  // Sign in with email and password
  const signIn = useCallback(async ({ email, password }) => {
    try {
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Sign in with magic link
  const signInWithMagicLink = useCallback(async ({ email }) => {
    try {
      setError(null);

      const { error } = await supabase.auth.signInWithOtp({
        email,
      });

      if (error) throw error;

      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setError(null);

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setUser(null);
      setProfile(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    try {
      setError(null);

      if (!user) throw new Error("No user logged in");

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  // Check if user is authenticated
  const isAuthenticated = useMemo(() => !!user, [user]);

  // Memoized context value
  const value = useMemo(
    () => ({
      // State
      user,
      profile,
      isLoading,
      error,
      isAuthenticated,

      // Methods
      signUp,
      signIn,
      signInWithMagicLink,
      signOut,
      updateProfile,

      // Utility
      clearError: () => setError(null),
    }),
    [
      user,
      profile,
      isLoading,
      error,
      isAuthenticated,
      signUp,
      signIn,
      signInWithMagicLink,
      signOut,
      updateProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Main hook - this is what Discover.jsx is importing
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider component");
  }

  return context;
}

// Optional: Export context for advanced use cases
export { AuthContext };