import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How long to wait for Supabase to auto-exchange the code.
 * detectSessionInUrl does this on client init — usually <2 s.
 */
const POLL_INTERVAL_MS  = 150;
const POLL_TIMEOUT_MS   = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUserMessage(err) {
  const msg = (err?.message ?? "").toLowerCase();

  if (
    msg.includes("code verifier") ||
    msg.includes("both auth code") ||
    msg.includes("code has already been used") ||
    msg.includes("invalid request")
  ) {
    return "This sign‑in link has already been used or expired. Please sign in again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "A network error occurred. Please check your connection and try again.";
  }
  if (msg.includes("timeout")) {
    return "Sign‑in is taking too long. Please try again.";
  }
  return "We couldn't complete sign‑in. Please try again.";
}

function isSetupComplete(uid) {
  return (
    localStorage.getItem(`SETUP_OK_${uid}`) === "1" ||
    localStorage.getItem("SETUP_OK") === "1"
  );
}

// ─── Module-level guard ───────────────────────────────────────────────────────
let exchangeStarted = false;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthCallback() {
  const nav = useNavigate();

  const [status, setStatus]     = useState("pending");
  const [errorMsg, setErrorMsg] = useState("");

  const abortRef = useRef(null);

  useEffect(() => {
    if (exchangeStarted) return;
    exchangeStarted = true;

    const ac = new AbortController();
    abortRef.current = ac;

    const run = async () => {
      try {
        // ── Log exactly what arrived ──────────────────────────────────────
        console.log("[AuthCallback] href   :", window.location.href);
        console.log("[AuthCallback] search :", window.location.search);
        console.log("[AuthCallback] hash   :", window.location.hash);

        // ── Check for OAuth error param ───────────────────────────────────
        const params     = new URLSearchParams(window.location.search);
        const oauthError = params.get("error");

        if (oauthError) {
          throw new Error(
            params.get("error_description") ?? oauthError
          );
        }

        // ── Wait for Supabase to auto-exchange the code ───────────────────
        //
        // When detectSessionInUrl:true + flowType:"pkce" are set, the
        // Supabase client exchanges ?code= automatically during createClient().
        // We poll getSession() until it resolves with a user.
        //
        // We do NOT call exchangeCodeForSession() manually — that's what
        // caused "code verifier not found": calling it a second time after
        // Supabase already consumed the verifier internally.

        console.log("[AuthCallback] waiting for auto-exchange…");

        const session = await pollForSession(ac.signal);

        if (ac.signal.aborted) return;

        const user = session?.user;

        if (!user) {
          throw new Error(
            "No session after exchange. " +
            "href: " + window.location.href
          );
        }

        console.log("[AuthCallback] session OK, uid:", user.id);

        const destination = isSetupComplete(user.id)
          ? "/discover"
          : "/setup/basics";

        nav(destination, { replace: true });

      } catch (err) {
        if (ac.signal.aborted) return;

        console.error("[AuthCallback] fatal:", err?.message ?? err);
        setErrorMsg(toUserMessage(err));
        setStatus("error");

        exchangeStarted = false;
      }
    };

    run();

    return () => {
      ac.abort();
    };
  }, [nav]);

  // ── Error UI ──────────────────────────────────────────────────────────────

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">

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

          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Sign‑in failed
            </h1>
            <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
          </div>

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

  // ── Pending UI ────────────────────────────────────────────────────────────

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

// ─── pollForSession ───────────────────────────────────────────────────────────

/**
 * Poll supabase.auth.getSession() until a session appears or we time out.
 *
 * Supabase exchanges the PKCE code asynchronously during client init.
 * Polling is safer than a one-shot getSession() which can run before
 * the exchange promise resolves.
 *
 * @param {AbortSignal} signal
 * @returns {Promise<import("@supabase/supabase-js").Session>}
 */
async function pollForSession(signal) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (signal.aborted) return null;

    const { data, error } = await supabase.auth.getSession();

    // Surface real errors immediately
    if (error) throw error;

    if (data?.session) {
      return data.session;
    }

    // Not ready yet — wait a tick and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`timeout after ${POLL_TIMEOUT_MS}ms waiting for session`);
}