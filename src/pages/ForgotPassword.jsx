// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { sendPasswordReset, updatePassword } from "../lib/authActions.js";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const search   = useSearch({ strict: false });

  // If user came from recovery email → show reset form instead
  const isRecovery = search?.recovery === "1";

  // ── Request reset ─────────────────────────────────────────────
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── New password ──────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirm,     setConfirm]     = useState("");

  async function handleRequestReset(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Email is required.");

    try {
      setLoading(true);
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8)
      return setError("Password must be at least 8 characters.");
    if (newPassword !== confirm)
      return setError("Passwords do not match.");

    try {
      setLoading(true);
      await updatePassword(newPassword);
      navigate({ to: "/discover" });
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  // ── Recovery mode (set new password) ─────────────────────────
  if (isRecovery) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Set new password</h1>
            <p className="mt-1 text-sm text-gray-500">
              Choose a strong password for your account.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSetNewPassword} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Request reset mode ────────────────────────────────────────
  if (sent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
            ✉️
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a password reset link to{" "}
            <span className="font-medium text-gray-900">{email}</span>.
          </p>
          <Link
            to="/auth"
            className="inline-block text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Forgot password?</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-center">
          <Link
            to="/auth"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}