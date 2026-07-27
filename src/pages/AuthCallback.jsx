// src/pages/AuthCallback.jsx
// Handles:
//   1. Email confirmation clicks  (?code=xxx)
//   2. Google OAuth return        (?code=xxx)
//   3. Password reset             (?type=recovery&code=xxx)

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

export default function AuthCallback() {
  const navigate = useNavigate();
  const search   = useSearch({ strict: false });
  const { clearFlow } = useAuthFlow();

  const [error, setError] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function handleCallback() {
      try {
        const type = search?.type;

        // Supabase auto-exchanges the ?code= param when detectSessionInUrl: true
        // We just need to wait for onAuthStateChange to fire in AuthContext.
        // getSession() here confirms the exchange worked.
        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          // No session yet — Supabase may still be exchanging
          // Wait briefly then check again
          await new Promise((r) => setTimeout(r, 1000));
          const { data: { session: retrySession } } =
            await supabase.auth.getSession();

          if (!retrySession) {
            throw new Error("Could not verify your session. Please try again.");
          }
        }

        clearFlow();

        // Password recovery → let user set new password
        if (type === "recovery") {
          navigate({ to: "/auth/forgot-password", search: { recovery: "1" } });
          return;
        }

        // Normal sign-in / email confirmation → go to app
        // SetupGate will redirect to setup if profile incomplete
        navigate({ to: "/discover" });
      } catch (err) {
        console.error("[AuthCallback]", err);
        setError(err.message || "Something went wrong. Please try again.");
      }
    }

    handleCallback();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-sm text-red-600">{error}</p>
        <a
          href="/auth"
          className="text-sm font-medium text-gray-900 underline"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  );
}