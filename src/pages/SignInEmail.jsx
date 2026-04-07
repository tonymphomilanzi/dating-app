// src/pages/SignInEmail.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

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

export default function SignInEmail() {
  const nav = useNavigate();
  const [email, setEmail]     = useState("");
  const [pw, setPw]           = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) throw error;

      // Ensure profile row exists
      const uid = data.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", uid)
          .maybeSingle();
        if (!prof) {
          await supabase.from("profiles").insert({ id: uid });
        }

        // Route based on setup completion
        const setupDone = localStorage.getItem(`SETUP_OK_${uid}`) === "1";
        nav(setupDone ? "/discover" : "/setup/basics", { replace: true });
      } else {
        nav("/discover", { replace: true });
      }
    } catch (e) {
      setErr(
        e.message?.toLowerCase().includes("invalid")
          ? "Incorrect email or password. Please try again."
          : e.message || "Sign in failed"
      );
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

        <h1 className="text-3xl font-bold tracking-tight">Continue with email</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in with your password</p>

        <form onSubmit={handleSignIn} className="mt-8 text-left space-y-4">

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
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-xs text-violet-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Input wrapper */}
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              />

              {/* Toggle button */}
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-gray-400 transition hover:text-violet-600 focus:outline-none"
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Footer link */}
        <div className="mt-6 text-xs text-gray-600">
          New here?{" "}
          <Link
            to="/auth/signup"
            className="font-semibold text-violet-700 hover:underline"
          >
            Create a new account
          </Link>
        </div>
      </div>
    </div>
  );
}