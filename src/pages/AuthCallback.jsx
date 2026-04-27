// src/pages/AuthCallback.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXCHANGE_TIMEOUT_MS = 15_000;

/**
 * Error codes (or message substrings) that indicate the OAuth code has already
 * been consumed. This happens when the user refreshes the callback URL.
 */
const USED_CODE_INDICATORS = [
  "both auth code and code verifier should be non-empty",
  "invalid request",
  "code has already been used",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a raw error to a user-friendly message.
 * Avoids leaking internal Supabase / network error details to the UI.
 *
 * @param {Error|object|null} err
 * @returns {string}
 */
function toUserMessage(err) {
  const msg = (err?.message ?? "").toLowerCase();

  if (USED_CODE_INDICATORS.some((s) => msg.includes(s))) {
    return "This sign‑in link has already been used. Please request a new one.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "A network error occurred. Please check your connection and try again.";
  }
  if (msg === "aborted" || msg.includes("timeout")) {
    return "Sign‑in is taking too long. Please try again.";
  }
  return "We couldn't complete sign‑in. Please try again.";
}

/**
 * Check whether the user has previously completed the profile-setup flow.
 * Two keys are checked for backwards compatibility with an older key format.
 *
 * @param {string} uid
 * @returns {boolean}
 */
function isSetupComplete(uid) {
  return (
    localStorage.getItem(`SETUP_OK_${uid}`) === "1" ||
    // Legacy key — kept for users who completed setup before the uid-scoped
    // key was introduced. Can be removed once all sessions have migrated.
    localStorage.getItem("SETUP_OK") === "1"
  );
}

/**
 * Race a promise against a hard timeout.
 * Rejects with a labelled error if the timeout fires first.
 *
 * @param {Promise}  promise
 * @param {number}   ms
 * @returns {Promise}
 */
function withTimeout(promise, ms) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timerId)
  );
}

// ─── Module-level exchange guard ──────────────────────────────────────────────
// Using module scope (rather than a ref) ensures the exchange runs at most once
// per page load, even under React 18 Strict Mode which intentionally mounts →
// unmounts → remounts effects in development.
let exchangeStarted = false;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Landing page for the OAuth callback URL.
 *
 * Flow:
 *  1. Exchange the `code` param in the URL for a Supabase session.
 *  2. Read the resulting session to get the user ID.
 *  3. Redirect to /discover (setup done) or /setup/basics (new user).
 *  4. On any failure, show a clear message and a link back to /login.
 */
export default function AuthCallback() {
  const nav = useNavigate();

  const [status, setStatus] = useState(
    /** @type {"pending"|"error"} */ "pending"
  );
  const [errorMsg, setErrorMsg] = useState("");

  // Abort controller so we can cancel pending async work on unmount
  const abortRef = useRef(null);

  useEffect(() => {
    // ── One-shot guard ──────────────────────────────────────────────────────
    // Prevent double-execution under React 18 Strict Mode or HMR re-mounts.
    if (exchangeStarted) return;
    exchangeStarted = true;

    const ac = new AbortController();
    abortRef.current = ac;

    const run = async () => {
      try {
        // ── Step 1: Exchange the code for a session ─────────────────────────
        // Supabase reads the `code` query param from the URL automatically.
        // We wrap in a hard timeout so the user isn't left with an infinite
        // spinner if the network or Supabase auth server is unresponsive.
        const { error: exchErr } = await withTimeout(
          supabase.auth.exchangeCodeForSession(window.location.href),
          EXCHANGE_TIMEOUT_MS
        );

        if (ac.signal.aborted) return;

        if (exchErr) {
          // Log for diagnostics but show a sanitised message in the UI
          console.warn("[AuthCallback] exchange error:", exchErr.message);
          throw exchErr;
        }

        // ── Step 2: Read the session ────────────────────────────────────────
        const { data, error: sessionErr } = await supabase.auth.getSession();

        if (ac.signal.aborted) return;

        if (sessionErr) {
          console.warn("[AuthCallback] getSession error:", sessionErr.message);
          throw sessionErr;
        }

        // ── Step 3: Redirect ────────────────────────────────────────────────
        const user = data?.session?.user;
        if (user) {
          const destination = isSetupComplete(user.id)
            ? "/discover"
            : "/setup/basics";

          nav(destination, { replace: true });
        } else {
          // Exchange succeeded but produced no session — unexpected state
          throw new Error("No session returned after exchange.");
        }
      } catch (err) {
        if (ac.signal.aborted) return;

        console.warn("[AuthCallback] fatal:", err?.message ?? err);
        setErrorMsg(toUserMessage(err));
        setStatus("error");

        // Reset the guard so the user can retry by navigating to /auth/callback
        // again (e.g. via the "Try again" link).
        exchangeStarted = false;
      }
    };

    run();

    return () => {
      // Cancel pending async work — prevents state updates on unmounted
      // component and avoids acting on a stale response.
      ac.abort();
    };
  }, [nav]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          {/* Error icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-7 w-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0
                   2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333
                   -3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Message */}
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Sign‑in failed
            </h1>
            <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
          </div>

          {/* Recovery actions */}
          <div className="flex flex-col gap-3 w-full">
            <Link
              to="/login"
              className="w-full rounded-full bg-violet-600 px-6 py-2.5 text-sm
                         font-medium text-white text-center hover:bg-violet-700
                         transition-colors"
            >
              Back to login
            </Link>
            <Link
              to="/"
              className="w-full rounded-full border border-gray-200 bg-white px-6
                         py-2.5 text-sm font-medium text-gray-700 text-center
                         hover:bg-gray-50 transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending (default) ─────────────────────────────────────────────────────

  return (
    <div className="grid min-h-dvh place-items-center bg-white p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Spinner */}
        <div
          className="h-10 w-10 animate-spin rounded-full border-4
                     border-violet-200 border-t-violet-600"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-gray-600">Finishing sign‑in…</p>
      </div>
    </div>
  );
}