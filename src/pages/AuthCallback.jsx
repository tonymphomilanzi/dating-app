// src/pages/AuthCallback.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign‑in…");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let mounted = true;

    (async () => {
      try {
        // Exchange the code in the URL for a session
        const { error: exchErr } = await supabase.auth
          .exchangeCodeForSession(window.location.href)
          .catch((e) => ({ error: e }));

        if (exchErr) {
          console.warn("[AuthCallback] exchange error:", exchErr.message);
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data?.session?.user) {
          // Check if profile is complete to decide where to send them
          const uid = data.session.user.id;
          const setupDone =
            localStorage.getItem(`SETUP_OK_${uid}`) === "1" ||
            localStorage.getItem("SETUP_OK") === "1";

          nav(setupDone ? "/discover" : "/setup/basics", { replace: true });
        } else {
          setMsg(
            "We couldn't complete sign‑in. Please try again."
          );
        }
      } catch (e) {
        console.warn("[AuthCallback] error:", e);
        if (mounted) setMsg(e.message || "Something went wrong. Please try again.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  return (
    <div className="grid min-h-dvh place-items-center bg-white p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        <p className="text-sm text-gray-600">{msg}</p>
      </div>
    </div>
  );
}