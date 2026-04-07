import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

function timeout(ms, label) {
  return new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error(`timeout:${label}:${ms}`)), ms)
  );
}

// Required fields for completion
const REQUIRED_FIELDS = ["display_name", "dob", "gender", "avatar_url"];
const MIN_INTERESTS = 5;
const ALLOW_PREFIXES = ["/setup", "/auth"];
const SETUP_OK_KEY = (uid) => `SETUP_OK_${uid}`;

function isOnAllowedPath(pathname) {
  return ALLOW_PREFIXES.some((p) => pathname.startsWith(p));
}

function isLocallyComplete(profile, uid) {
  if (!profile) return false;

  const hasAll = REQUIRED_FIELDS.every((k) => {
    const v = profile?.[k];
    return k === "dob" ? !!v : !!String(v || "").trim();
  });

  // Per-user flag only (no global fallback)
  let userFlag = false;
  try {
    if (uid) {
      const f = localStorage.getItem(SETUP_OK_KEY(uid));
      userFlag = f === "1" || f === "true";
    }
  } catch {}
  return hasAll || userFlag;
}

export default function SetupGate() {
  const { ready, user, profile } = useAuth();
  const loc = useLocation();

  // Hard-bypass for auth/setup routes and during OTP flow
  const otpFlow =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("AF_IN_OTP") === "1";
  if (isOnAllowedPath(loc.pathname) || otpFlow) {
    return <Outlet />;
  }

  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const lastUserIdRef = useRef(null);

  // Dev bypass
  const skipSetup = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("skipSetup") === "1") return true;
      const ls = localStorage.getItem("SKIP_SETUP");
      return ls === "1" || ls === "true";
    } catch {
      return false;
    }
  }, [loc.search]);

  const localComplete = useMemo(
    () => isLocallyComplete(profile, user?.id),
    [profile?.display_name, profile?.dob, profile?.gender, profile?.avatar_url, user?.id]
  );

  useEffect(() => {
    if (!ready) return;

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

    // Avoid redundant re-checks
    if (lastUserIdRef.current === user.id && !checking && localComplete === !needsSetup) {
      return;
    }
    lastUserIdRef.current = user.id;

    let cancelled = false;

    (async () => {
      try {
        // If locally complete, allow and set per-user flag
        if (localComplete) {
          if (!cancelled) {
            setNeedsSetup(false);
            setChecking(false);
            try {
              if (user?.id) localStorage.setItem(SETUP_OK_KEY(user.id), "1");
            } catch {}
          }
          return;
        }

        // Server interests count with 1500ms cap
        const serverCheck = (async () => {
          const { count, error } = await supabase
            .from("user_interests")
            .select("interest_id", { count: "exact", head: true })
            .eq("user_id", user.id);

          if (error) throw error;

          const ok = isLocallyComplete(profile, user?.id) && Number(count || 0) >= MIN_INTERESTS;

          if (!cancelled) {
            setNeedsSetup(!ok);
            setChecking(false);
            if (ok && user?.id) {
              try { localStorage.setItem(SETUP_OK_KEY(user.id), "1"); } catch {}
            }
          }
        })();

        await Promise.race([serverCheck, timeout(1500, "setup-check")]).catch((e) => {
          console.warn("[SetupGate] server check skipped:", e.message);
          if (!cancelled) {
            const okLocal = isLocallyComplete(profile, user?.id);
            setNeedsSetup(!okLocal);
            setChecking(false);
          }
        });
      } catch (e) {
        console.warn("[SetupGate] exception:", e);
        if (!cancelled) {
          const okLocal = isLocallyComplete(profile, user?.id);
          setNeedsSetup(!okLocal);
          setChecking(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [
    ready,
    user?.id,
    profile?.display_name,
    profile?.dob,
    profile?.gender,
    profile?.avatar_url,
    skipSetup,
    checking,
    localComplete,
    needsSetup,
  ]);

  if (!ready || checking) {
    return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  }

  if (needsSetup && !isOnAllowedPath(loc.pathname)) {
    const next = loc.pathname + (loc.search || "");
    return <Navigate to="/setup/basics" replace state={{ next }} />;
  }

  return <Outlet />;
}