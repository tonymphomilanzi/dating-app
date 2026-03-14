// src/pages/SignInEmail.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function SignInEmail() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;

      // Optional: ensure profile exists
      const { data: prof } = await supabase.from("profiles").select("id").maybeSingle();
      if (!prof) {
        await supabase.from("profiles").insert({ id: data.user.id });
      }

      nav("/discover", { replace: true });
    } catch (e) {
      setErr(e.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Continue with email</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in with your password</p>

        <form onSubmit={handleSignIn} className="mt-6 text-left">
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label className="mt-4 block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            autoComplete="current-password"
          />

          {err && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </>
            ) : (
              <>Sign in</>
            )}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-600">
          New here?
          <Link to="/auth/signup" className="ml-1 font-semibold text-violet-700 hover:underline">
            Create a new account
          </Link>
        </div>

        {/* Optional: magic link as fallback 
        <div className="mt-3 text-xs text-gray-500">
          Prefer a one-time link?
          <Link to="/auth/magic" className="ml-1 underline">
            Send me a magic link
          </Link>
        </div>*/}
      </div>
    </div>
  );
}