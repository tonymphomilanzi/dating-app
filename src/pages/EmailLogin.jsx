// src/pages/EmailLogin.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

export default function EmailLogin() {
  const nav = useNavigate();
  const { email, setEmail, startSignupFlow } = useAuthFlow();
  const [mode, setMode] = useState("password"); // "password" | "otp"
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Password sign-in (primary, no OTP needed) ──────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!emailValid || !pw) return;
    setError("");
    setLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (signInErr) throw signInErr;

      // Ensure profile row exists
      const uid = data.user?.id;
      if (uid) {
        const setupDone = localStorage.getItem(`SETUP_OK_${uid}`) === "1";
        nav(setupDone ? "/discover" : "/setup/basics", { replace: true });
      } else {
        nav("/discover", { replace: true });
      }
    } catch (e) {
      const msg = e.message || "Sign in failed";
      // Friendly message for wrong password
      setError(
        msg.toLowerCase().includes("invalid")
          ? "Incorrect email or password. Try again or use a one‑time code below."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  // ── OTP / magic-link fallback ────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!emailValid) return;
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }, // login only, not signup
      });
      if (error) throw error;

      // Store minimal flow state so EmailVerify knows what type to use
      startSignupFlow({ email, type: "magiclink" });
      nav("/auth/verify");
    } catch (e) {
      setError(e.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        <h1 className="text-center text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Sign in to continue to{" "}
          <span className="font-semibold text-violet-700">Umukunzi 4.0</span>
        </p>

        {/* Tab toggle */}
        <div className="mt-8 flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => { setMode("password"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "password"
                ? "bg-white text-violet-700 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => { setMode("otp"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "otp"
                ? "bg-white text-violet-700 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            One‑time code
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* Email field — shared */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPw ? "text" : "password"}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.973 9.973 0 014.043-5.223M9.88 4.24A9.956 9.956 0 0112 4c4.477 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.043 5.223M15 12a3 3 0 00-3-3M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-1 text-right">
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs text-violet-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!emailValid || !pw || loading}
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
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <p className="text-xs text-gray-500">
                We'll send a 6‑digit code to your email. No password needed.
              </p>
              <button
                onClick={handleSendOTP}
                disabled={!emailValid || loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending…
                  </>
                ) : (
                  "Send 6‑digit code"
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          New here?{" "}
          <Link to="/auth/signup" className="font-semibold text-violet-700 hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}