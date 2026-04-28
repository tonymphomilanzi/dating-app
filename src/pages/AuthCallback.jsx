import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXCHANGE_TIMEOUT_MS = 15_000;

/**
 * Error message substrings that mean the OAuth code was already consumed.
 * This typically happens when the user refreshes the callback URL.
 */
const USED_CODE_INDICATORS = [
  "both auth code and code verifier should be non-empty",
  "invalid request",
  "code has already been used",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a raw error to a user-friendly message.
 * @param {Error|object|null} err
 * @returns {string}
 */
function toUserMessage(err) {
  const msg = (err?.message ?? "").toLowerCase();

  if (USED_CODE_INDICATORS.some((s) => msg.includes(s))) {
    return "This sign‑in link has already been used. Please sign in again.";
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
 * @param {string} uid
 * @returns {boolean}
 */
function isSetupComplete(uid) {
  return (
    localStorage.getItem(`SETUP_OK_${uid}`) === "1" ||
    // Legacy key — kept for backwards compatibility
    localStorage.getItem("SETUP_OK") === "1"
  );
}

/**
 * Race a promise against a hard timeout.
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
// Module scope ensures the exchange runs at most once per page load,
// even under React 18 Strict Mode (mount → unmount → remount).
let exchangeStarted = false;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthCallback() {
  const nav = useNavigate();

  const [status, setStatus]     = useState(/** @type {"pending"|"error"} */ ("pending"));
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);

  useEffect(() => {
    // ── One-shot guard ──────────────────────────────────────────────────────
    if (exchangeStarted) return;
    exchangeStarted = true;

    const ac = new AbortController();
    abortRef.current = ac;

    const run = async () => {
      try {
        // ── Step 1: Extract the code from the URL ───────────────────────────
        // Supabase Google OAuth (PKCE flow) appends ?code=... to the callback URL.
        // We pull it out manually so we can detect "no code" early and give
        // a clear error instead of letting Supabase throw a cryptic one.
        const params = new URLSearchParams(window.location.search);
        const code   = params.get("code");

        // Also check for an error param — Google/Supabase can return
        // ?error=access_denied when the user cancels the Google consent screen.
        const oauthError = params.get("error");
        if (oauthError) {
          throw new Error(
            params.get("error_description") ?? oauthError
          );
        }

        if (!code) {
          // No code and no error — URL was probably opened directly.
          throw new Error("No authorisation code found in the URL.");
        }

        // ── Step 2: Exchange the code for a session ─────────────────────────
        // IMPORTANT: pass the code string, NOT window.location.href.
        // supabase-js v2 `exchangeCodeForSession` accepts the raw code value.
        const { error: exchErr } = await withTimeout(
          supabase.auth.exchangeCodeForSession(code),
          EXCHANGE_TIMEOUT_MS
        );

        if (ac.signal.aborted) return;

        if (exchErr) {
          console.warn("[AuthCallback] exchange error:", exchErr.message);
          throw exchErr;
        }

        // ── Step 3: Read the resulting session ──────────────────────────────
        const { data, error: sessionErr } = await supabase.auth.getSession();

        if (ac.signal.aborted) return;

        if (sessionErr) {
          console.warn("[AuthCallback] getSession error:", sessionErr.message);
          throw sessionErr;
        }

        // ── Step 4: Redirect based on setup status ──────────────────────────
        const user = data?.session?.user;

        if (user) {
          const destination = isSetupComplete(user.id)
            ? "/discover"
            : "/setup/basics";

          nav(destination, { replace: true });
        } else {
          throw new Error("No session returned after exchange.");
        }

      } catch (err) {
        if (ac.signal.aborted) return;

        console.warn("[AuthCallback] fatal:", err?.message ?? err);
        setErrorMsg(toUserMessage(err));
        setStatus("error");

        // Reset the guard so a retry (navigating back to /auth/callback) works.
        exchangeStarted = false;
      }
    };

    run();

    return () => {
      // Cancel async work when the component unmounts — prevents state
      // updates on an unmounted component and stale-response handling.
      ac.abort();
    };
  }, [nav]);

  // ── Error state ───────────────────────────────────────────────────────────

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
              to="/auth"
              className="
                w-full rounded-full bg-violet-600 px-6 py-2.5
                text-sm font-medium text-white text-center
                hover:bg-violet-700 transition-colors
              "
            >
              Back to sign in
            </Link>
            <Link
              to="/"
              className="
                w-full rounded-full border border-gray-200 bg-white
                px-6 py-2.5 text-sm font-medium text-gray-700 text-center
                hover:bg-gray-50 transition-colors
              "
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