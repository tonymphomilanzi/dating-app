import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function SignInEmail() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("password"); // 'password' or 'magic'

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (mode === "password") {
        result = await supabase.auth.signInWithPassword({ email, password: pw });
      } else {
        result = await supabase.auth.signInWithOtp({ 
          email, 
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` } 
        });
        alert("Check your email for the magic link!");
      }
      if (result.error) throw result.error;
      if (mode === "password") window.location.href = "/"; 
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm space-y-8">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <form onSubmit={handleSignIn} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full p-4 rounded-2xl border" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          
          {mode === "password" && (
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full p-4 rounded-2xl border" 
              value={pw} 
              onChange={e => setPw(e.target.value)} 
            />
          )}

          <button className="w-full bg-violet-600 text-white p-4 rounded-full font-bold">
            {loading ? "Processing..." : mode === "password" ? "Sign In" : "Send Magic Link"}
          </button>
        </form>

        <button 
          onClick={() => setMode(mode === "password" ? "magic" : "password")}
          className="w-full text-sm text-gray-500"
        >
          {mode === "password" ? "Forgot password? Use Magic Link" : "Back to Password Login"}
        </button>
      </div>
    </div>
  );
}