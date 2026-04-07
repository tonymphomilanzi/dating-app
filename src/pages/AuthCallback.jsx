import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.href)
      .then(() => {
        // After exchange, just go to root. The SetupGate will handle 
        // whether they go to /discover or /setup based on their data.
        nav("/", { replace: true });
      })
      .catch(() => nav("/auth", { replace: true }));
  }, [nav]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="text-center animate-pulse text-gray-500">Completing sign-in...</div>
    </div>
  );
}