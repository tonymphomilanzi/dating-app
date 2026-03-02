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
  const [error, setError] = useState("");

  const sendEmailOTP = async () => {
    setError(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          // If you also allow magic links, set a redirect:
          // emailRedirectTo: window.location.origin + "/discover",
        }
      });
      if (error) throw error;
      nav("/auth/email-verify");
    } catch (e) {
      setError(e.message || "Failed to send email code");
    } finally {
      setLoading(false);
    }
  };

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="min-h-dvh">
      <TopBar title="Your email" />
      <div className="space-y-6 p-6">
        <TextField label="Email address" placeholder="you@domain.com" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button className="w-full" onClick={sendEmailOTP} disabled={!valid || loading}>
          {loading ? "Sending..." : "Send code"}
        </Button>
        <p className="text-xs text-gray-500">We’ll send a 6‑digit code to your inbox.</p>
      </div>
    </div>
  );
}