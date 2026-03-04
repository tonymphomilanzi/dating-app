import { useEffect, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import OTPInput from "../components/OTPInput.jsx";
import Button from "../components/Button.jsx";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../api/lib/supabase.js";
import { useAuthFlow } from "../contexts/AuthFlowContext.jsx";

export default function EmailVerify(){
  const nav = useNavigate();
  const { email } = useAuthFlow();
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(60);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [sendingMagic, setSendingMagic] = useState(false);

  useEffect(()=>{
    const t = setInterval(()=>setLeft(s => s>0 ? s-1 : 0), 1000);
    return ()=>clearInterval(t);
  },[]);

  const verify = async () => {
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      nav("/setup/basics", { replace: true });
    } catch (e) {
      setError(e.message || "Invalid code");
    }
  };

  const resend = async () => {
    if (left > 0 || resending) return;
    setResending(true); setError("");
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

  const sendMagicLink = async () => {
    setSendingMagic(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) throw error;
      alert("Magic link sent. Check your email to continue.");
    } catch (e) {
      setError(e.message || "Failed to send magic link");
    } finally {
      setSendingMagic(false);
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
          <Button className="w-full" disabled={code.length<6} onClick={verify}>Continue</Button>
          <button onClick={resend} disabled={left>0 || resending} className={`w-full text-sm ${left>0 ? "text-gray-400" : "text-violet-600"}`}>
            {left>0 ? `Resend in ${left}s` : (resending ? "Resending…" : "Resend code")}
          </button>
          <button onClick={sendMagicLink} disabled={sendingMagic} className="w-full text-sm text-violet-600">
            {sendingMagic ? "Sending magic link…" : "Use magic link instead"}
          </button>
        </div>
      </div>
    </div>
  );
}