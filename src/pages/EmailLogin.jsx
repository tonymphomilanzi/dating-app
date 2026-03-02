import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import TextField from "../components/TextField.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

export default function EmailLogin(){
  const nav = useNavigate();
  const { email, setEmail } = useAuthFlow();
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const sendEmailOTP = async () => {
    setError(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      nav("/auth/email-verify");
    } catch (e) {
      setError(e.message || "Failed to send email code");
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    setError(""); setMagicLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`, // magic-link target
        },
      });
      if (error) throw error;
      // Let user know to check their inbox
      alert("Magic link sent. Check your email to continue.");
    } catch (e) {
      setError(e.message || "Failed to send magic link");
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Your email" />
      <div className="space-y-6 p-6">
        <TextField label="Email address" placeholder="you@domain.com" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button className="w-full" onClick={sendEmailOTP} disabled={!valid || loading}>
          {loading ? "Sending…" : "Send 6‑digit code"}
        </Button>
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={!valid || magicLoading}
          className="w-full text-sm text-violet-600"
        >
          {magicLoading ? "Sending magic link…" : "Or send a magic link instead"}
        </button>
        <p className="text-xs text-gray-500">
          If you only see “Confirm your signup” emails, enable Email OTP and/or use the magic link fallback.
        </p>
      </div>
    </div>
  );
}