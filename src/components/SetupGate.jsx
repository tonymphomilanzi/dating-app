import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function SetupGate() {
  const { ready, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    let timeout;
    (async () => {
      if (!ready) return; // wait for AuthProvider
      console.info("[SetupGate] start check route:", loc.pathname);
      if (!user) {
        console.info("[SetupGate] no user, skipping");
        if (mounted) { setNeedsSetup(false); setChecking(false); }
        return;
      }

      // Watchdog: if this check takes > 6s, dump a diagnostic
      timeout = setTimeout(() => {
        console.error("[SetupGate] check timeout after 6s", { route: loc.pathname, userId: user?.id });
      }, 6000);

      try {
        const [{ data: profile, error: pErr }, { count: interestsCount, error: iErr }] = await Promise.all([
          supabase.from("profiles").select("display_name, dob, gender, avatar_url").eq("id", user.id).maybeSingle(),
          supabase.from("user_interests").select("*", { count: "exact", head: true }).eq("user_id", user.id)
        ]);

        if (pErr) console.warn("[SetupGate] profile error:", pErr.message);
        if (iErr) console.warn("[SetupGate] interests error:", iErr.message);

        const complete =
          !!profile?.display_name &&
          !!profile?.dob &&
          !!profile?.gender &&
          !!profile?.avatar_url &&
          (interestsCount || 0) >= 5;

        console.info("[SetupGate] result", {
          complete,
          display_name: !!profile?.display_name,
          dob: !!profile?.dob,
          gender: !!profile?.gender,
          avatar: !!profile?.avatar_url,
          interestsCount: interestsCount || 0,
        });

        if (mounted) setNeedsSetup(!complete);
      } catch (e) {
        console.error("[SetupGate] exception", e);
        if (mounted) setNeedsSetup(true);
      } finally {
        clearTimeout(timeout);
        if (mounted) setChecking(false);
      }
    })();

    return () => { mounted = false; clearTimeout(timeout); };
  }, [ready, user, loc.pathname]);

  if (!ready) return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  if (checking) {
    console.info("[SetupGate] checking … route:", loc.pathname);
    return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  }
  if (needsSetup && !loc.pathname.startsWith("/setup")) {
    console.warn("[SetupGate] redirecting to /setup/basics from", loc.pathname);
    return <Navigate to="/setup/basics" replace />;
  }
  return <Outlet />;
}