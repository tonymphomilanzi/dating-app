import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

// ─── Icons ────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943
         9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7
         a10.05 10.05 0 013.63-5.073"
    />
    <path
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M9.88 4.24A9.956 9.956 0 0112 4c4.477 0 8.268 2.943
         9.542 7a9.973 9.973 0 01-4.043 5.223"
    />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M15 12a3 3 0 00-3-3" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M3 3l18 18" />
  </svg>
);

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

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ light = false }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2
        border-t-transparent ${light ? "border-white" : "border-violet-600"}`}
    />
  );
}

// ─── Password Field ───────────────────────────────────────────────────────────

function PasswordField({
  label, value, onChange, show, onToggle,
  placeholder, autoComplete, hint,
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="
            w-full rounded-xl border border-gray-200 px-4 py-3 pr-12
            text-sm outline-none transition
            focus:border-violet-400 focus:ring-2 focus:ring-violet-200
          "
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="
            absolute inset-y-0 right-0 flex w-11 items-center justify-center
            rounded-r-xl text-gray-400 transition hover:text-violet-600
            focus:outline-none
          "
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-red-500">{hint}</p>}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs text-gray-400">or</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SignUp() {
  const navigate = useNavigate();
  const { startSignupFlow } = useAuthFlow();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [pw, setPw]                   = useState("");
  const [pw2, setPw2]                 = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showPw2, setShowPw2]         = useState(false);

  // ── Loading — two separate keys so the UI can tell them apart ──────────────
  const [loading, setLoading]           = useState(
    /** @type {""|"email"|"google"} */ ("")
  );
  const [err, setErr] = useState("");

  // ── Derived validation ─────────────────────────────────────────────────────
  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const pwValid    = useMemo(() => pw.length >= 8, [pw]);
  const pwMatch    = useMemo(() => pw && pw === pw2, [pw, pw2]);
  const nameValid  = useMemo(() => displayName.trim().length > 0, [displayName]);
  const canSubmit  = emailValid && pwValid && pwMatch && nameValid && !loading;

  // ── Email / OTP sign-up ────────────────────────────────────────────────────
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErr("");
    setLoading("email");

    try {
      await supabase.auth.signOut().catch(() => {});

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { display_name: displayName },
        },
      });
      if (error) throw error;

      startSignupFlow({ email, displayName, password: pw, type: "signup" });
      try { sessionStorage.setItem("AF_IN_OTP", "1"); } catch {}

      navigate("/auth/verify", { replace: true });
    } catch (e) {
      setErr(e?.message || "Could not send verification code. Please try again.");
    } finally {
      setLoading("");
    }
  };

  // ── Google OAuth sign-up ───────────────────────────────────────────────────
  // Signing up and signing in via Google use the exact same OAuth flow.
  // Supabase automatically creates a new user the first time it sees a Google
  // account, and logs in an existing user on subsequent attempts.
  // AuthCallback.jsx handles the redirect and routes new users to /setup/basics.
  const handleGoogleSignUp = async () => {
    setErr("");
    setLoading("google");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account", // always show account picker
            access_type: "offline",   // request a refresh token
          },
        },
      });

      if (error) throw error;
      // Browser is redirected by Supabase — nothing runs after this
    } catch (e) {
      console.error("Google OAuth error:", e);
      setErr(e?.message || "Google sign-up failed. Please try again.");
      setLoading("");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">

      {/* Background glows */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm">

        {/* ── Logo + heading ── */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
                C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
                c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Join{" "}
            <span className="font-semibold text-violet-700">Umukunzi 4.0</span>
            {" "}— find your match
          </p>
        </div>

        {/* ── Google sign-up button ── */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={!!loading}
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
          {loading === "google" ? (
            <>
              <Spinner />
              <span>Connecting…</span>
            </>
          ) : (
            <>
              <GoogleIcon className="h-5 w-5 shrink-0" />
              <span>Sign up with Google</span>
            </>
          )}
        </button>

        {/* ── Divider ── */}
        <div className="my-6">
          <OrDivider />
        </div>

        {/* ── Error banner (shared) ── */}
        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* ── Email sign-up form ── */}
        <form onSubmit={handleEmailSignUp} className="space-y-4 text-left">

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="nickname"
              required
              className="
                mt-1 w-full rounded-xl border border-gray-200 px-4 py-3
                text-sm outline-none transition
                focus:border-violet-400 focus:ring-2 focus:ring-violet-200
              "
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="
                mt-1 w-full rounded-xl border border-gray-200 px-4 py-3
                text-sm outline-none transition
                focus:border-violet-400 focus:ring-2 focus:ring-violet-200
              "
            />
          </div>

          {/* Password */}
          <PasswordField
            label="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            show={showPw}
            onToggle={() => setShowPw((s) => !s)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            hint={pw && !pwValid ? "Must be at least 8 characters." : ""}
          />

          {/* Confirm password */}
          <PasswordField
            label="Confirm password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            show={showPw2}
            onToggle={() => setShowPw2((s) => !s)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            hint={pw2 && !pwMatch ? "Passwords do not match." : ""}
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="
              mt-2 flex w-full items-center justify-center gap-2
              rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600
              px-6 py-3.5 text-sm font-medium text-white shadow-md
              transition active:scale-[0.98] disabled:opacity-50
            "
          >
            {loading === "email" ? (
              <>
                <Spinner light />
                <span>Creating account…</span>
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* ── Footer ── */}
        <div className="mt-6 text-center text-xs text-gray-600">
          Already have an account?{" "}
          <Link
            to="/auth/signin/email"
            className="font-semibold text-violet-700 hover:underline"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-violet-700/80">
          By continuing you agree to our{" "}
          <span className="underline underline-offset-2">
            Terms &amp; Privacy Policy
          </span>
        </p>

      </div>
    </div>
  );
}