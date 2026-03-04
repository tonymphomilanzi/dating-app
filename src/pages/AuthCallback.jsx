import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Exchange code for session (used by magic link / oauth)
        await supabase.auth.exchangeCodeForSession(window.location.href).catch(() => {});
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data?.session) nav("/setup/basics", { replace: true });
        else setMsg("No active session. Please try signing in again.");
      } catch (e) {
        console.warn("[AuthCallback] error:", e);
        setMsg(e.message || "Something went wrong");
      }
    })();
    return () => { mounted = false; };
  }, [nav]);

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="text-center text-gray-700">{msg}</div>
    </div>
  );
}