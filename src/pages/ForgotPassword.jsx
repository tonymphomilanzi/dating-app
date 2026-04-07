// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

// ── Steps ─────────────────────────────────────────────────────────────────────
// 1. "request"  → user enters email → we send OTP
// 2. "verify"   → user enters 6-digit code
// 3. "reset"    → user enters new password
// 4. "done"     → success screen

const STEPS = { REQUEST: "request", VERIFY: "verify", RESET: "reset", DONE: "done" };

// ── Icon components ───────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943
         9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7
         a10.05 10.05 0 013.63-5.073" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M9.88 4.24A9.956 9.956 0 0112 4c4.477 0 8.268 2.943 9.542 7
         a9.973 9.973 0 01-4.043 5.223" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M15 12a3 3 0 00-3-3" />
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      d="M3 3l18 18" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-16 w-16">
    <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── OTP digit-box input ───────────────────────────────────────────────────────
import { useRef } from "react";

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
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    onChange(next.join(""));
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
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
          className="h-14 w-11 rounded-xl border border-gray-200 text-center text-xl
                     font-semibold text-gray-900 outline-none transition
                     focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      ))}
    </div>
  );
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl
                    bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
      <i className="lni lni-heart text-2xl" />
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </div>
  );
}

function PrimaryButton({ onClick, disabled, loading, loadingText, children, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-full
                 bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5
                 text-sm font-medium text-white shadow-md transition
                 active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full
                           border-2 border-white border-t-transparent" />
          {loadingText}
        </>
      ) : children}
    </button>
  );
}

// ── Step 1 — Request ──────────────────────────────────────────────────────────
function StepRequest({ onNext }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailValid) return;
    setErr("");
    setLoading(true);
    try {
      // Send a 6-digit OTP to the email (recovery type)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // No redirectTo — we handle the OTP code flow ourselves
      });
      if (error) throw error;
      onNext(email);
    } catch (e) {
      // Don't confirm whether the email exists — just show generic message
      setErr(
        e.message?.toLowerCase().includes("rate")
          ? "Too many requests. Please wait a minute and try again."
          : "If that email exists we've sent a reset code. Check your inbox."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Logo />
      <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
        Forgot password?
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Enter your email and we'll send a 6‑digit reset code.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="you@example.com"
            required
            autoComplete="email"
            autoFocus
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                       outline-none transition focus:border-violet-400 focus:ring-2
                       focus:ring-violet-200"
          />
        </div>

        <ErrorBox msg={err} />

        <PrimaryButton
          type="submit"
          disabled={!emailValid}
          loading={loading}
          loadingText="Sending code…"
        >
          Send reset code
        </PrimaryButton>
      </form>

      <div className="mt-6 text-center text-xs text-gray-500">
        Remember your password?{" "}
        <Link to="/auth/signin/email" className="font-semibold text-violet-700 hover:underline">
          Sign in
        </Link>
      </div>
    </>
  );
}

// ── Step 2 — Verify OTP ───────────────────────────────────────────────────────
function StepVerify({ email, onNext, onBack }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [err, setErr] = useState("");

  // Countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const verify = async () => {
    if (code.length < 6 || loading) return;
    setErr("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (error) throw error;
      onNext(); // session is now active → go to reset step
    } catch (e) {
      setErr(
        e.message?.toLowerCase().includes("expired")
          ? "Code expired. Request a new one below."
          : e.message?.toLowerCase().includes("invalid")
          ? "Incorrect code. Please check and try again."
          : e.message || "Verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (timeLeft > 0 || resending) return;
    setResending(true);
    setErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setTimeLeft(60);
    } catch (e) {
      setErr(e.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Logo />
      <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
        Check your inbox
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        We sent a 6‑digit code to{" "}
        <span className="font-medium text-gray-800">{email}</span>
      </p>

      <div className="mt-8">
        <OTPInput length={6} onChange={setCode} />
      </div>

      <div className="mt-6 space-y-3">
        <ErrorBox msg={err} />

        <PrimaryButton
          onClick={verify}
          disabled={code.length < 6}
          loading={loading}
          loadingText="Verifying…"
        >
          Verify code
        </PrimaryButton>

        {/* Resend */}
        <button
          onClick={resend}
          disabled={timeLeft > 0 || resending}
          className={`w-full text-sm transition ${
            timeLeft > 0
              ? "cursor-default text-gray-400"
              : "text-violet-600 hover:underline"
          }`}
        >
          {resending
            ? "Resending…"
            : timeLeft > 0
            ? `Resend code in ${timeLeft}s`
            : "Resend code"}
        </button>

        {/* Back */}
        <button
          onClick={onBack}
          className="w-full text-sm text-gray-400 hover:text-gray-600 transition"
        >
          ← Use a different email
        </button>
      </div>
    </>
  );
}

// ── Step 3 — Reset ────────────────────────────────────────────────────────────
function StepReset({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const pwValid = pw.length >= 8;
  const pwMatch = pw && pw === pw2;
  const canSubmit = pwValid && pwMatch && !loading;

  // Password strength score 0-4
  const strength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength] || "";
  const strengthColor = [
    "",
    "bg-red-400",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-green-500",
  ][strength] || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr("");
    setLoading(true);
    try {
      // Session is already active after verifyOtp in step 2
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      // Sign out so user logs in fresh with new password
      await supabase.auth.signOut();
      onDone();
    } catch (e) {
      setErr(
        e.message?.toLowerCase().includes("same")
          ? "New password must be different from your current password."
          : e.message || "Failed to update password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Logo />
      <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
        Set new password
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Make it strong — you only do this once (hopefully 😄).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            New password
          </label>
          <div className="relative mt-1">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12
                         text-sm outline-none transition focus:border-violet-400
                         focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center
                         justify-center text-gray-400 transition hover:text-violet-600"
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Strength meter */}
          {pw && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      n <= strength ? strengthColor : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`mt-1 text-xs font-medium ${
                strength <= 1 ? "text-red-500" :
                strength === 2 ? "text-orange-500" :
                strength === 3 ? "text-yellow-600" : "text-green-600"
              }`}>
                {strengthLabel}
              </p>
            </div>
          )}

          {pw && !pwValid && (
            <p className="mt-1 text-xs text-red-500">Must be at least 8 characters.</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <div className="relative mt-1">
            <input
              type={showPw2 ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12
                         text-sm outline-none transition focus:border-violet-400
                         focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="button"
              onClick={() => setShowPw2((s) => !s)}
              aria-label={showPw2 ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center
                         justify-center text-gray-400 transition hover:text-violet-600"
            >
              {showPw2 ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {pw2 && !pwMatch && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
          )}
          {pw2 && pwMatch && (
            <p className="mt-1 text-xs text-green-600">Passwords match ✓</p>
          )}
        </div>

        <ErrorBox msg={err} />

        <PrimaryButton
          type="submit"
          disabled={!canSubmit}
          loading={loading}
          loadingText="Updating password…"
        >
          Update password
        </PrimaryButton>
      </form>
    </>
  );
}

// ── Step 4 — Done ─────────────────────────────────────────────────────────────
function StepDone() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 text-green-500">
        <CheckCircleIcon />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Password updated!
      </h1>
      <p className="mt-3 text-sm text-gray-500">
        Your password has been changed successfully.
        <br />
        Sign in with your new password to continue.
      </p>

      <Link
        to="/auth/signin/email"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full
                   bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5
                   text-sm font-medium text-white shadow-md transition active:scale-[0.98]"
      >
        Sign in now
      </Link>

      <Link
        to="/auth"
        className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition"
      >
        Back to home
      </Link>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current }) {
  const steps = [STEPS.REQUEST, STEPS.VERIFY, STEPS.RESET];
  if (current === STEPS.DONE) return null;
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map((s, i) => {
        const stepIndex = steps.indexOf(current);
        const isDone = i < stepIndex;
        const isActive = s === current;
        return (
          <div
            key={s}
            className={`rounded-full transition-all duration-300 ${
              isActive
                ? "h-2.5 w-8 bg-violet-600"
                : isDone
                ? "h-2.5 w-2.5 bg-violet-300"
                : "h-2.5 w-2.5 bg-gray-200"
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const [step, setStep] = useState(STEPS.REQUEST);
  const [email, setEmail] = useState("");

  // Smooth page-level transition
  const [animKey, setAnimKey] = useState(0);

  const goTo = (nextStep) => {
    setAnimKey((k) => k + 1);
    setStep(nextStep);
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center
                    bg-white px-6 py-12 text-gray-900">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72
                      rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80
                      rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <StepDots current={step} />

        {/* Animated step wrapper */}
        <div
          key={animKey}
          style={{
            animation: "stepIn 250ms cubic-bezier(0.4,0,0.2,1) both",
          }}
        >
          {step === STEPS.REQUEST && (
            <StepRequest
              onNext={(em) => {
                setEmail(em);
                goTo(STEPS.VERIFY);
              }}
            />
          )}

          {step === STEPS.VERIFY && (
            <StepVerify
              email={email}
              onNext={() => goTo(STEPS.RESET)}
              onBack={() => goTo(STEPS.REQUEST)}
            />
          )}

          {step === STEPS.RESET && (
            <StepReset onDone={() => goTo(STEPS.DONE)} />
          )}

          {step === STEPS.DONE && <StepDone />}
        </div>
      </div>

      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}