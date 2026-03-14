import { useEffect, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import OTPInput from "../components/OTPInput.jsx";
import Button from "../components/Button.jsx";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

export default function EmailVerify() {
  const nav = useNavigate();
  const { email, displayName, pendingPassword, clearFlow } = useAuthFlow();
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(60);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) {
      nav("/auth/signup", { replace: true });
      return;
    }
  }, [email, nav]);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = async () => {
    setError("");
    try {
      // 1) Verify the 6-digit code
   const { error } = await supabase.auth.verifyOtp({
  email,
  token: code,
  type: "signup", // IMPORTANT for email sign-up codes
});
      if (error) throw error;

      // 2) If user provided a password on SignUp, set it now (so future sign-ins use password)
      if (pendingPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: pendingPassword });
        if (pwErr) throw pwErr;
      }

      // 3) Ensure profile.display_name is set
      // ensure display_name
if (displayName) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("profiles").upsert(
    { id: user.id, display_name: displayName },
    { onConflict: "id" }
  );
}


 // Done with OTP flow
   clearFlow();
    try { window.sessionStorage.removeItem("AF_IN_OTP"); } catch {}

    nav("/setup/basics", { replace: true });
  } catch (e) {
    setError(e.message || "Invalid code");
  }
};

    
  
  const resend = async () => {
    if (left > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setLeft(60);
    } catch (e) {
      setError(e.message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Verify your email" />
      <div className="space-y-6 p-6 text-center">
        <p className="text-sm text-gray-600">Enter the 6‑digit code sent to {email}</p>
        <OTPInput length={6} onChange={setCode} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="pt-4 space-y-3">
          <Button className="w-full" disabled={code.length < 6} onClick={verify}>
            Continue
          </Button>
          <button
            onClick={resend}
            disabled={left > 0 || resending}
            className={`w-full text-sm ${left > 0 ? "text-gray-400" : "text-violet-600"}`}
          >
            {left > 0 ? `Resend in ${left}s` : resending ? "Resending…" : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}