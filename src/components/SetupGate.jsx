// src/pages/SetupGate.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Profile fields that must be non-empty for a profile to be considered complete.
 * avatar_url is required here (unlike AuthContext's isProfileComplete which
 * treats it as optional) — SetupGate enforces the full onboarding checklist.
 */
const REQUIRED_FIELDS = ["display_name", "dob", "gender", "avatar_url"];

/** Minimum number of interests required to pass setup. */
const MIN_INTERESTS = 5;

/**
 * Path prefixes that bypass the setup gate entirely.
 * Users on /setup/** or /auth/** must always be allowed through, otherwise
 * the gate would redirect them away from the setup flow itself.
 */
const ALLOW_PREFIXES = ["/setup", "/auth"];

/**
 * Maximum time (ms) to wait for the server interests check before falling
 * back to the local profile check.
 */
const SERVER_CHECK_TIMEOUT_MS = 1_500;

// ─── Helpers (module-level — never recreated) ─────────────────────────────────

/** @param {string} uid */
const setupOkKey = (uid) => `SETUP_OK_${uid}`;

/**
 * Return true if the given pathname starts with any allowed prefix.
 * @param {string} pathname
 */
function isOnAllowedPath(pathname) {
  return ALLOW_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check whether a profile object has all required fields populated.
 * Does NOT check interests count — that requires a server round-trip.
 *
 * @param {object|null} profile
 * @param {string|null} uid
 * @returns {boolean}
 */
function isLocallyComplete(profile, uid) {
  // Check per-user localStorage flag first (fast path, avoids field iteration)
  if (uid) {
    try {
      const flag = localStorage.getItem(setupOkKey(uid));
      if (flag === "1" || flag === "true") return true;
    } catch { /* storage unavailable */ }
  }

  if (!profile) return false;

  return REQUIRED_FIELDS.every((key) => {
    const value = profile[key];
    // dob can be a Date object or date string — truthy check is sufficient
    return key === "dob" ? !!value : !!String(value ?? "").trim();
  });
}

/**
 * Persist the setup-complete flag for a user.
 * Silences SecurityError in restricted environments.
 *
 * @param {string} uid
 */
function persistSetupOk(uid) {
  if (!uid) return;
  try { localStorage.setItem(setupOkKey(uid), "1"); } catch { /* ignore */ }
}

/**
 * Check whether the dev bypass is active.
 * Reads from the URL query string and localStorage.
 *
 * @param {string} search - location.search from React Router
 * @returns {boolean}
 */
function isDevBypassActive(search) {
  try {
    if (new URLSearchParams(search).get("skipSetup") === "1") return true;
    const flag = localStorage.getItem("SKIP_SETUP");
    return flag === "1" || flag === "true";
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Route guard that redirects unauthenticated or incomplete-profile users to
 * the setup flow before allowing access to protected routes.
 *
 * Flow:
 *  1. Always render unconditionally (hooks must not be called conditionally).
 *  2. If the path is allowed (/setup/*, /auth/*) or an OTP flow is in-progress,
 *     render <Outlet /> immediately — no check needed.
 *  3. If auth is not ready, show a loading state.
 *  4. If no user is authenticated, allow through (AuthGuard handles login redirect).
 *  5. Run a local profile completeness check.
 *  6. If locally incomplete, run a server-side interests count (capped at 1.5s).
 *  7. Redirect to /setup/basics if setup is needed, otherwise render <Outlet />.
 */
export default function SetupGate() {
  const { ready, user, profile } = useAuth();
  const loc = useLocation();

  // ── Derived flags (computed unconditionally — hooks must not branch) ───────

  const onAllowedPath = isOnAllowedPath(loc.pathname);

  // OTP flow flag — persisted in sessionStorage by AuthFlowContext
  const inOtpFlow = window.sessionStorage.getItem("AF_IN_OTP") === "1";

  // Development/QA bypass
  const skipSetup = useMemo(
    () => isDevBypassActive(loc.search),
    [loc.search]
  );

  // Memoised local completeness — recomputes when profile reference or uid changes.
  // We depend on `profile` (not individual fields) so that adding a new field to
  // REQUIRED_FIELDS automatically takes effect without touching this component.
  const localComplete = useMemo(
    () => isLocallyComplete(profile, user?.id),
    [profile, user?.id]
  );

  // ── State ─────────────────────────────────────────────────────────────────

  // `checking` is true while the async server verification is in-flight.
  // Starts as true so we never flash the protected content before the check.
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Track the last user ID we ran a full server check for so we don't re-check
  // on unrelated re-renders (e.g. profile field updates after setup).
  const lastCheckedUserIdRef = useRef(null);

  // ── Server check effect ───────────────────────────────────────────────────

  useEffect(() => {
    // Wait until AuthContext has resolved the initial session
    if (!ready) return;

    // ── No user: pass through (a separate AuthGuard handles login redirect) ──
    if (!user) {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // ── Dev bypass ────────────────────────────────────────────────────────────
    if (skipSetup) {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // ── Allowed path / OTP flow: no check needed ──────────────────────────────
    // We still run this inside the effect (not as an early return before hooks)
    // to satisfy the Rules of Hooks. The render path below handles the actual
    // early <Outlet /> return.
    if (onAllowedPath || inOtpFlow) {
      setChecking(false);
      return;
    }

    // ── Skip redundant server checks for the same user ────────────────────────
    // Only re-run if the user has changed. Profile field changes don't warrant
    // a new server round-trip — the local check handles those.
    if (lastCheckedUserIdRef.current === user.id) {
      // Re-sync local state with the latest local completeness result in case
      // the profile was updated since the last server check.
      setNeedsSetup(!localComplete);
      setChecking(false);
      return;
    }

    // ── Locally complete: fast-path, skip server round-trip ───────────────────
    if (localComplete) {
      persistSetupOk(user.id);
      lastCheckedUserIdRef.current = user.id;
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    // ── Server check: verify interests count ──────────────────────────────────
    const ac = new AbortController();
    let cancelled = false;

    const runServerCheck = async () => {
      // Hard timeout — if the DB is slow, fall back to local check so the user
      // isn't blocked on a loading screen for more than 1.5 seconds.
      const timeoutId = setTimeout(() => ac.abort(), SERVER_CHECK_TIMEOUT_MS);

      try {
        const { count, error } = await supabase
          .from("user_interests")
          .select("interest_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .abortSignal(ac.signal); // Cancel the Supabase query on timeout/unmount

        clearTimeout(timeoutId);
        if (cancelled) return;

        if (error) {
          // Non-abort error (e.g. RLS, network) — fall back to local check
          throw error;
        }

        const hasEnoughInterests = Number(count ?? 0) >= MIN_INTERESTS;
        // Re-read local completeness in case profile updated during the await
        const nowLocallyComplete = isLocallyComplete(profile, user.id);
        const complete = nowLocallyComplete && hasEnoughInterests;

        if (complete) persistSetupOk(user.id);
        lastCheckedUserIdRef.current = user.id;

        setNeedsSetup(!complete);
        setChecking(false);
      } catch (err) {
        clearTimeout(timeoutId);
        if (cancelled) return;

        // Aborted (timeout) or other error — degrade gracefully to local check
        if (err?.name !== "AbortError") {
          console.warn("[SetupGate] server check failed:", err?.message ?? err);
        } else {
          console.warn("[SetupGate] server check timed out — using local result");
        }

        const fallbackComplete = isLocallyComplete(profile, user.id);
        lastCheckedUserIdRef.current = user.id;

        setNeedsSetup(!fallbackComplete);
        setChecking(false);
      }
    };

    runServerCheck();

    return () => {
      cancelled = true;
      ac.abort(); // Cancel the in-flight Supabase request on cleanup
    };
  }, [
    ready,
    user?.id,      // Re-check when the user changes (sign-in / sign-out)
    localComplete, // Re-sync local state if profile fields change post-check
    skipSetup,
    onAllowedPath,
    inOtpFlow,
    // NOTE: `profile` is intentionally omitted — `localComplete` already
    // captures profile changes and is the correct granular dependency.
    // Including `profile` would cause double-runs on every profile update.
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Bypass: allowed paths and OTP flows always render children immediately
  if (onAllowedPath || inOtpFlow) {
    return <Outlet />;
  }

  // Loading: auth context is resolving or server check is in-flight
  if (!ready || checking) {
    return (
      <div
        className="grid min-h-dvh place-items-center text-gray-600"
        aria-busy="true"
        aria-label="Checking your profile…"
      >
        Loading…
      </div>
    );
  }

  // Gate: redirect incomplete profiles to setup
  // We don't need to re-check `isOnAllowedPath` here — the early return above
  // already guarantees we only reach this point on protected paths.
  if (needsSetup) {
    const next = loc.pathname + (loc.search || "");
    return <Navigate to="/setup/basics" replace state={{ next }} />;
  }

  // All checks passed — render the protected route
  return <Outlet />;
}