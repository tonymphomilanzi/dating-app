import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

/* Small inline icons so we don't rely on lni */
const EyeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const EyeOffIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a10.05 10.05 0 013.63-5.073M9.88 4.24A9.956 9.956 0 0112 4c4.477 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.043 5.223M15 12a3 3 0 00-3-3M3 3l18 18" />
  </svg>
);

export default function SignUp() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const pwValid = useMemo(() => pw.length >= 8, [pw]);
  const pwMatch = useMemo(() => pw && pw === pw2, [pw, pw2]);
  const canSubmit = emailValid && pwValid && pwMatch && !loading;

  const redirectTo = `${window.location.origin}/auth/callback`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr("");
    setInfo("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          emailRedirectTo: redirectTo,
          data: displayName ? { display_name: displayName } : undefined, // user_metadata
        },
      });
      if (error) throw error;

      // If confirm email is ON: no session yet. Show success message.
      if (!data.session) {
        setInfo("We’ve sent a confirmation link to your email. Please verify to finish setting up your account.");
        return;
      }

      // If confirm email is OFF: we are signed in now — try to set profile name, then go
      try {
        if (displayName) {
          await supabase
            .from("profiles")
            .upsert({ id: data.user.id, display_name: displayName }, { onConflict: "id" });
        }
      } catch (_) {
        // RLS/trigger may handle this — ignore
      }

      navigate("/discover", { replace: true });
    } catch (e) {
      if (String(e.message || "").toLowerCase().includes("already registered")) {
        setErr("An account with this email already exists. Try ‘Continue with email’ to sign in.");
      } else {
        setErr(e.message || "Sign up failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">
      {/* background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        {/* logo — keep same look */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-gray-600">Join Umukunzi 4.0 and start meeting people</p>

        <form onSubmit={handleSubmit} className="mt-6 text-left">
          {/* Display name (optional) */}
          <label className="block text-sm font-medium text-gray-700">Display name (optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            autoComplete="nickname"
          />

          {/* Email */}
          <label className="mt-4 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            autoComplete="email"
            required
          />

          {/* Password */}
          <label className="mt-4 block text-sm font-medium text-gray-700">Password</label>
          <div className="relative mt-1">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-500"
              aria-label={showPw ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPw ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
          <p className={`mt-1 text-xs ${pwValid || !pw ? "text-gray-400" : "text-red-600"}`}>
            Must be at least 8 characters.
          </p>

          {/* Confirm password */}
          <label className="mt-4 block text-sm font-medium text-gray-700">Confirm password</label>
          <div className="relative mt-1">
            <input
              type={showPw2 ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw2((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-500"
              aria-label={showPw2 ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPw2 ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
          {!pwMatch && pw2.length > 0 && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
          )}

          {/* Alerts */}
          {err && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          {info && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating account...
              </>
            ) : (
              <>Create account</>
            )}
          </button>
        </form>

        {/* Small nav links */}
        <div className="mt-4 text-xs text-gray-600">
          Already have an account?
          <Link to="/auth/email" className="ml-1 font-semibold text-violet-700 hover:underline">
            Continue with email
          </Link>
        </div>

        {/* Legal */}
        <p className="mt-8 text-xs leading-relaxed text-violet-700/80">
          By continuing you agree to our <span className="underline underline-offset-2">Terms & Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}