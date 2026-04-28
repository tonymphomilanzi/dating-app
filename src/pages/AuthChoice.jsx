import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

/* ─── Google Icon ───────────────────────────────────────────────────────── */
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.5-1.8 4.3-5.4 4.3-3.25 0-5.9-2.68-5.9-6s2.65-6
           5.9-6c1.85 0 3.09.78 3.8 1.45l2.6-2.5C16.76 3.5 14.6 2.5 12
           2.5 6.98 2.5 2.9 6.58 2.9 11.6s4.08 9.1 9.1 9.1c5.25 0
           8.7-3.7 8.7-8.9 0-.6-.06-1.04-.13-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.77 7.15l3.2 2.34C7.78 7.92 9.72 6.5 12 6.5c1.85 0 3.09.78
           3.8 1.45l2.6-2.5C16.76 3.5 14.6 2.5 12 2.5 8.53 2.5 5.57 4.46
           3.77 7.15z"
        opacity=".9"
      />
      <path
        fill="#FBBC05"
        d="M12 20.7c3.6 0 5.16-2.8 5.4-4.3H12v-3.9h8.57c.07.56.13 1 .13
           1.6 0 5.2-3.45 8.9-8.7 8.9-3.9 0-7.2-2.34-8.4-5.66l3.27-2.54c.62
           1.86 2.34 3.9 5.13 3.9z"
        opacity=".9"
      />
      <path
        fill="#4285F4"
        d="M3.6 16.34c-1.1-1.54-1.7-3.4-1.7-4.74 0-1.35.6-3.2
           1.7-4.74l3.2 2.34c-.45.9-.7 1.9-.7 2.4 0 .5.25 1.5.7
           2.4L3.6 16.34z"
        opacity=".9"
      />
    </svg>
  );
}

/* ─── Spinner ───────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2
                 border-current border-t-transparent"
    />
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function AuthChoice() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");


const handleGoogleSignIn = async () => {
  try {
    setError("");
    setLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
        // ADDED: Request additional scopes for better profile data
        scopes: "openid email profile",
      },
    });

    if (oauthError) throw oauthError;
  } catch (err) {
    console.error("[Auth] Google sign-in error:", err);
    setError(err.message || "Google sign-in failed. Please try again.");
    setLoading(false);
  }
};

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">

      {/* ── Background glows ── */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">

        {/* ── Logo ── */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
              2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
              C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
              c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>

        {/* ── Heading ── */}
        <h1 className="text-3xl font-bold tracking-tight">Umukunzi 4.0</h1>
        <p className="mt-2 text-sm text-gray-500">
          Sign in or create an account to continue
        </p>

        {/* ── Error banner ── */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Email CTA ── */}
        <div className="mt-8">
          <Link
            to="/auth/signin/email"
            className="
              flex w-full items-center justify-center gap-2
              rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600
              px-6 py-3.5 text-sm font-semibold text-white shadow-md
              transition hover:opacity-90 active:scale-[0.98]
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-10 7L2 7" />
            </svg>
            Continue with email
          </Link>

          <p className="mt-3 text-xs text-gray-500">
            New here?{" "}
            <Link
              to="/auth/signup"
              className="font-semibold text-violet-700 hover:underline"
            >
              Create a new account
            </Link>
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* ── Google Sign-In Button ── */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="
            flex w-full items-center justify-center gap-3
            rounded-full border border-gray-200 bg-white
            px-6 py-3.5 text-sm font-medium text-gray-700
            shadow-sm transition
            hover:bg-gray-50 hover:shadow-md
            active:scale-[0.98]
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {loading ? (
            <>
              <Spinner />
              <span>Connecting…</span>
            </>
          ) : (
            <>
              <GoogleIcon className="h-5 w-5 shrink-0" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* ── Legal ── */}
        <p className="mt-10 text-xs leading-relaxed text-gray-400">
          By continuing you agree to our{" "}
          <Link
            to="/legal/terms"
            className="underline underline-offset-2 hover:text-gray-600"
          >
            Terms of Service
          </Link>{" "}
          &amp;{" "}
          <Link
            to="/legal/privacy"
            className="underline underline-offset-2 hover:text-gray-600"
          >
            Privacy Policy
          </Link>
        </p>

      </div>
    </div>
  );
}