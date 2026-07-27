// src/pages/EmailVerify.jsx
import { Link } from "@tanstack/react-router";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";
import { signUpWithEmail } from "../lib/authActions.js";
import { useState } from "react";

export default function EmailVerify() {
  const { email, displayName, pendingPassword, clearFlow } = useAuthFlow();
  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);
  const [error,     setError]     = useState("");

  async function handleResend() {
    if (!email) return;
    try {
      setError("");
      setResending(true);
      await signUpWithEmail({
        email,
        password:    pendingPassword,
        displayName: displayName || "",
      });
      setResent(true);
    } catch (err) {
      // "User already registered" means email was already confirmed
      if (err.message?.toLowerCase().includes("already registered")) {
        setResent(true);
      } else {
        setError(err.message || "Failed to resend. Please try again.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">

        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
          ✉️
        </div>

        <div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-gray-900">
              {email || "your email"}
            </span>
            . Click the link to activate your account.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {resent && (
          <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
            Confirmation email resent!
          </p>
        )}

        {/* Resend */}
        {email && !resent && (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm font-medium text-gray-900 underline underline-offset-2 disabled:opacity-50"
          >
            {resending ? "Resending…" : "Resend confirmation email"}
          </button>
        )}

        {/* Back */}
        <div className="pt-2">
          <Link
            to="/auth"
            onClick={clearFlow}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to sign in
          </Link>
        </div>

      </div>
    </div>
  );
}