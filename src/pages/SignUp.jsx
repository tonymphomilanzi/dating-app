// src/pages/SignUp.jsx
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a10.05 10.05 0 013.63-5.073"
    />
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.88 4.24A9.956 9.956 0 0112 4c4.477 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.043 5.223"
    />
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 00-3-3"
    />
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3l18 18"
    />
  </svg>
);

/* Reusable password field so we don't repeat markup twice */
function PasswordField({ label, value, onChange, show, onToggle, placeholder, autoComplete, hint }) {
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
          className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-gray-400 transition hover:text-violet-600 focus:outline-none"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-red-500">{hint}</p>}
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const { startSignupFlow } = useAuthFlow();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [pw, setPw]                   = useState("");
  const [pw2, setPw2]                 = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showPw2, setShowPw2]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const pwValid    = useMemo(() => pw.length >= 8, [pw]);
  const pwMatch    = useMemo(() => pw && pw === pw2, [pw, pw2]);
  const nameValid  = useMemo(() => displayName.trim().length > 0, [displayName]);
  const canSubmit  = emailValid && pwValid && pwMatch && nameValid && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr("");
    setLoading(true);

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
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">

        {/* Logo */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-gray-600">
          Join{" "}
          <span className="font-semibold text-violet-700">Umukunzi 4.0</span>{" "}
          — find your match
        </p>

        <form onSubmit={handleSubmit} className="mt-8 text-left space-y-4">

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
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
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
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
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

          {/* Error banner */}
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-xs text-gray-600">
          Already have an account?{" "}
          <Link
            to="/auth/signin/email"
            className="font-semibold text-violet-700 hover:underline"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-violet-700/80">
          By continuing you agree to our{" "}
          <span className="underline underline-offset-2">Terms & Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}