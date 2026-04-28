// src/pages/EmailVerify.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

/* Simple digit-box OTP input */
function OTPInput({ length = 6, onChange }) {
  const [digits, setDigits] = useState(Array(length).fill(""));
  const inputs = useRef([]);

  const update = (idx, val) => {
    const cleaned = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    onChange(next.join(""));
    if (cleaned && idx < length - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKey = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    onChange(next.join(""));
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex justify-center gap-3" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          className="h-14 w-11 rounded-xl border border-gray-200 text-center text-xl font-semibold text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
        />
      ))}
    </div>
  );
}

export default function EmailVerify() {
  const nav = useNavigate();
  const { reloadProfile } = useAuth();
  const { email, displayName, pendingPassword, otpType, clearFlow } = useAuthFlow();
  const [code, setCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Guard: if no email in context, go back
  useEffect(() => {
    if (!email) nav("/auth/signup", { replace: true });
  }, [email, nav]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const verify = async () => {
    if (code.length < 6 || verifying) return;
    setError("");
    setVerifying(true);

    try {
      let verifyError = null;

      const { error: e1 } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: otpType === "magiclink" ? "email" : "email",
      });
      verifyError = e1;

      if (verifyError) {
        const { error: e2 } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "signup",
        });
        if (e2) throw verifyError;
        verifyError = null;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Set password if coming from signup flow
      if (pendingPassword && user) {
        const { error: pwErr } = await supabase.auth.updateUser({
          password: pendingPassword,
        });
        if (pwErr) console.warn("[Verify] password set error:", pwErr.message);
      }

      // Set display_name in profile if provided
      if (displayName && user) {
        await supabase
          .from("profiles")
          .upsert({ id: user.id, display_name: displayName }, { onConflict: "id" });
      }

      clearFlow();

      // CRITICAL FIX: Always reload profile after verification
      await reloadProfile();

      // Decide where to go based on updated profile state
      const setupDone = localStorage.getItem(`SETUP_OK_${user?.id}`) === "1";
      nav(setupDone ? "/discover" : "/setup/basics", { replace: true });
    } catch (e) {
      console.error("[Verify] error:", e);
      setError(
        e.message?.includes("expired")
          ? "Code expired. Please request a new one."
          : e.message?.includes("invalid") || e.message?.includes("Invalid")
          ? "Incorrect code. Please check and try again."
          : e.message || "Verification failed. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (timeLeft > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: otpType !== "magiclink" },
      });
      if (error) throw error;
      setTimeLeft(60);
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-envelope text-2xl" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Check your inbox</h1>
        <p className="mt-2 text-sm text-gray-500">
          We sent a 6‑digit code to{" "}
          <span className="font-medium text-gray-800">{email}</span>
        </p>

        <div className="mt-8">
          <OTPInput length={6} onChange={setCode} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={verify}
          disabled={code.length < 6 || verifying}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
        >
          {verifying ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Verifying…
            </>
          ) : (
            "Confirm & continue"
          )}
        </button>

        <div className="mt-4">
          <button
            onClick={resend}
            disabled={timeLeft > 0 || resending}
            className={`text-sm transition ${
              timeLeft > 0
                ? "cursor-default text-gray-400"
                : "text-violet-600 hover:underline"
            }`}
          >
            {timeLeft > 0
              ? `Resend code in ${timeLeft}s`
              : resending
              ? "Resending…"
              : "Resend code"}
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Wrong email?{" "}
          <button
            onClick={() => nav("/auth/signup")}
            className="text-violet-600 hover:underline"
          >
            Go back
          </button>
        </p>
      </div>
    </div>
  );
}