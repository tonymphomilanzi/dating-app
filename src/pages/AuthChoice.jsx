import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

/* Inline SVG icons (so we don't depend on Lineicons for social buttons) */
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.5-1.8 4.3-5.4 4.3-3.25 0-5.9-2.68-5.9-6s2.65-6 5.9-6c1.85 0 3.09.78 3.8 1.45l2.6-2.5C16.76 3.5 14.6 2.5 12 2.5 6.98 2.5 2.9 6.58 2.9 11.6s4.08 9.1 9.1 9.1c5.25 0 8.7-3.7 8.7-8.9 0-.6-.06-1.04-.13-1.6H12z"/>
      <path fill="#34A853" d="M3.77 7.15l3.2 2.34C7.78 7.92 9.72 6.5 12 6.5c1.85 0 3.09.78 3.8 1.45l2.6-2.5C16.76 3.5 14.6 2.5 12 2.5 8.53 2.5 5.57 4.46 3.77 7.15z" opacity=".9"/>
      <path fill="#FBBC05" d="M12 20.7c3.6 0 5.16-2.8 5.4-4.3H12v-3.9h8.57c.07.56.13 1 .13 1.6 0 5.2-3.45 8.9-8.7 8.9-3.9 0-7.2-2.34-8.4-5.66l3.27-2.54c.62 1.86 2.34 3.9 5.13 3.9z" opacity=".9"/>
      <path fill="#4285F4" d="M3.6 16.34c-1.1-1.54-1.7-3.4-1.7-4.74 0-1.35.6-3.2 1.7-4.74l3.2 2.34c-.45.9-.7 1.9-.7 2.4 0 .5.25 1.5.7 2.4L3.6 16.34z" opacity=".9"/>
    </svg>
  );
}
function AppleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.365 1.43c0 1.14-.45 2.25-1.268 3.1-.81.86-2.086 1.51-3.183 1.41-.14-1.08.498-2.25 1.288-3.07C14.082 1.9 15.323 1.31 16.365 1.43zM20.9 17.12c-.4.95-.87 1.83-1.42 2.65-.75 1.1-1.36 1.86-1.96 2.2-.75.44-1.55.42-2.49.19-.58-.15-1.26-.43-2.12-.43-.87 0-1.56.28-2.15.43-.92.22-1.72.24-2.47-.2-.56-.32-1.2-1.05-1.97-2.16-.84-1.2-1.54-2.6-2.1-4.14-.6-1.7-.91-3.33-.92-4.87 0-1.8.4-3.34 1.2-4.6C4.2 6.06 5.1 5.3 6.2 4.86c.87-.35 1.83-.4 2.88-.16.58.14 1.26.42 2.13.42.85 0 1.53-.28 2.11-.42 1.05-.25 2.02-.2 2.88.16 1.12.45 2.01 1.2 2.67 2.28-.01.01 1.97 3.12.03 7.98z" />
    </svg>
  );
}
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2 6.35 2 1.86 6.48 1.86 12.07c0 4.99 3.64 9.13 8.39 9.93v-7.02H7.9v-2.91h2.35V9.41c0-2.32 1.38-3.6 3.5-3.6.99 0 2.03.18 2.03.18v2.23h-1.14c-1.12 0-1.47.7-1.47 1.42v1.71h2.5l-.4 2.91h-2.1V22c4.75-.8 8.4-4.94 8.4-9.93z" />
    </svg>
  );
}

export default function AuthChoice() {
  const [loading, setLoading] = useState("");

  const handleOAuth = async (provider) => {
    try {
      setLoading(provider);
      const redirectTo = `${window.location.origin}/auth/callback`;
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // For Google, this helps the account-picker show each time
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
          scopes:
            provider === "facebook" ? "email,public_profile" :
            provider === "apple" ? "name email" : undefined,
        },
      });
      // Supabase will redirect; no further action here
    } catch (e) {
      console.error("OAuth error:", e);
      alert(e.message || "Sign-in failed. Please try again.");
      setLoading("");
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">
      {/* background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        {/* logo (kept as-is; ensure Lineicons CSS is loaded if you want this heart) */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        {/* heading */}
        <h1 className="text-3xl font-bold tracking-tight">Umukunzi 4.0</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in or create an account to continue</p>

        {/* primary action */}
        <div className="mt-8">
          <Link to="/auth/email">
            <button className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98]">
              <i className="lni lni-envelope text-lg" />
              Continue with email
            </button>
          </Link>

          {/* Added: create-account (keeps layout, just a small secondary link) */}
          <div className="mt-3 text-xs text-gray-600">
            New here?
            <Link to="/auth/signup" className="ml-1 font-semibold text-violet-700 hover:underline">
              Create a new account
            </Link>
          </div>
        </div>

        {/* divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or continue with</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* social buttons (now with inline icons + handlers) */}
        <div className="flex justify-center gap-4">
          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            aria-label="Google"
            onClick={() => handleOAuth("google")}
            disabled={loading === "google"}
          >
            <GoogleIcon className="h-5 w-5" />
          </button>

          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            aria-label="Apple"
            onClick={() => handleOAuth("apple")}
            disabled={loading === "apple"}
          >
            <AppleIcon className="h-5 w-5" />
          </button>

          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#1877F2] shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            aria-label="Facebook"
            onClick={() => handleOAuth("facebook")}
            disabled={loading === "facebook"}
          >
            <FacebookIcon className="h-5 w-5" />
          </button>
        </div>

        {/* legal */}
        <p className="mt-10 text-xs leading-relaxed text-violet-700/80">
          By continuing you agree to our <br />
          <span className="underline underline-offset-2">Terms & Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}