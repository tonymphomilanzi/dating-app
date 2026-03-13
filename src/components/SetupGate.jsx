import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

function timeout(ms, label) {
  return new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error(`timeout:${label}:${ms}`)), ms)
  );
}

// Tune these to your onboarding expectations
const REQUIRED_FIELDS = ["display_name", "dob", "gender", "avatar_url"];
const MIN_INTERESTS = 5;
const ALLOW_PREFIXES = ["/setup", "/auth"]; // expand if needed (e.g., "/terms", "/privacy")

function isOnAllowedPath(pathname) {
  return ALLOW_PREFIXES.some((p) => pathname.startsWith(p));
}

function isLocallyComplete(profile) {
  if (!profile) return false;
  const hasAll = REQUIRED_FIELDS.every((k) => {
    const v = profile?.[k];
    return k === "dob" ? !!v : !!String(v || "").trim();
  });
  const flag = window.localStorage.getItem("SETUP_OK");
  return hasAll || flag === "1" || flag === "true";
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
    } catch {
      return false;
    }
  }, [loc.search]);

  const localComplete = useMemo(() => isLocallyComplete(profile), [
    profile?.display_name,
    profile?.dob,
    profile?.gender,
    profile?.avatar_url,
  ]);

  useEffect(() => {
    if (!ready) return; // wait for AuthContext hydration

    // Not signed in → no gate
    if (!user) {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // Dev bypass
    if (skipSetup) {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // Avoid infinite loops, but re-check if profile fields change
    if (lastUserIdRef.current === user.id && !checking && localComplete === !needsSetup) {
      return;
    }
    lastUserIdRef.current = user.id;

    let cancelled = false;

    (async () => {
      try {
        // If locally complete, fail-open immediately (and set a flag)
        if (localComplete) {
          if (!cancelled) {
            setNeedsSetup(false);
            setChecking(false);
            try { window.localStorage.setItem("SETUP_OK", "1"); } catch {}
          }
          return;
        }

        // Otherwise, do a quick server check for interests count with 1500ms cap
        const serverCheck = (async () => {
          const { count, error } = await supabase
            .from("user_interests")
            .select("interest_id", { count: "exact", head: true })
            .eq("user_id", user.id);

          if (error) throw error;

          const ok =
            isLocallyComplete(profile) && Number(count || 0) >= MIN_INTERESTS;

          if (!cancelled) {
            setNeedsSetup(!ok);
            setChecking(false);
            if (ok) {
              try { window.localStorage.setItem("SETUP_OK", "1"); } catch {}
            }
          }
        })();

        await Promise.race([serverCheck, timeout(1500, "setup-check")]).catch((e) => {
          // On timeout/error: fail-closed if locally incomplete; fail-open only if locally complete
          console.warn("[SetupGate] server check skipped:", e.message);
          if (!cancelled) {
            setNeedsSetup(!isLocallyComplete(profile));
            setChecking(false);
          }
        });
      } catch (e) {
        console.warn("[SetupGate] exception:", e);
        if (!cancelled) {
          // Same rule: if locally incomplete, require setup
          setNeedsSetup(!isLocallyComplete(profile));
          setChecking(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [
    ready,
    user?.id,
    // re-check when these profile fields update
    profile?.display_name,
    profile?.dob,
    profile?.gender,
    profile?.avatar_url,
    // local flags
    skipSetup,
  ]);

  if (!ready || checking) {
    return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  }

  if (needsSetup && !isOnAllowedPath(loc.pathname)) {
    // Preserve where they came from so setup can send them back if needed
    const next = loc.pathname + (loc.search || "");
    return <Navigate to="/setup/basics" replace state={{ next }} />;
  }

  return <Outlet />;
}