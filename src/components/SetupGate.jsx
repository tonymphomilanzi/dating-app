// src/components/SetupGate.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../api/lib/supabase";
import { useAuth } from "../contexts/AuthContext.jsx";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function timeout(ms, label) {
  return new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error(`timeout:${label}:${ms}`)), ms)
  );
}

export default function SetupGate() {
  const { ready, user, profile } = useAuth();
  const loc = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const lastUserIdRef = useRef(null);

  // Dev bypass
  const skipSetup = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("skipSetup") === "1") return true;
      const ls = window.localStorage.getItem("SKIP_SETUP");
      return ls === "1" || ls === "true";
    } catch { return false; }
  }, [loc.search]);

  // Quick local completeness (from AuthContext)
  const locallyComplete = useMemo(() => {
    const hasLocalFlag = window.localStorage.getItem("SETUP_OK") === "1";
    const ok =
      !!profile?.display_name &&
      !!profile?.dob &&
      !!profile?.gender &&
      !!profile?.avatar_url;
    return ok || hasLocalFlag;
  }, [profile]);

  useEffect(() => {
    if (!ready) return;                // wait for auth hydration
    if (!user) {                       // not signed in: no gate
      setNeedsSetup(false);
      setChecking(false);
      return;
    }
    if (skipSetup) {                   // dev bypass
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // Only run once per user id
    if (lastUserIdRef.current === user.id && !checking) return;
    lastUserIdRef.current = user.id;

    let cancelled = false;

    (async () => {
      try {
        // 1) If locally looks complete, fail-open (assume interests are ok)
        if (locallyComplete) {
          setNeedsSetup(false);
          return;
        }

        // 2) Otherwise, do a quick server interests count with a 1500ms cap
        const serverCheck = (async () => {
          const { count, error } = await supabase
            .from("user_interests")
            .select("interest_id", { count: "exact", head: true })
            .eq("user_id", user.id);
          if (error) throw error;
          // Must have at least 5 interests + the local fields
          const ok =
            !!profile?.display_name &&
            !!profile?.dob &&
            !!profile?.gender &&
            !!profile?.avatar_url &&
            (count || 0) >= 5;
          setNeedsSetup(!ok);
        })();

        // Cap this check at 1500ms so we don't block UX
        await Promise.race([serverCheck, timeout(1500, "setup-check")]).catch((e) => {
          // On timeout or error: fail-open unless clearly incomplete locally
          console.warn("[SetupGate] server check skipped:", e.message);
          setNeedsSetup(false);
        });

      } catch (e) {
        console.warn("[SetupGate] exception:", e);
        setNeedsSetup(false); // fail-open
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ready, user?.id, locallyComplete, skipSetup]);

  if (!ready) return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  if (checking) return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  if (needsSetup && !window.location.pathname.startsWith("/setup")) {
    return <Navigate to="/setup/basics" replace />;
  }
  return <Outlet />;
}