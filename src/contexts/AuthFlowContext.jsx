// src/contexts/AuthFlowContext.jsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";

const Ctx = createContext(null);

export function AuthFlowProvider({ children }) {
  const [email, setEmail] = useState(() => {
    try { return sessionStorage.getItem("AF_email") || ""; } catch { return ""; }
  });

  const [displayName, setDisplayName]     = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  // Start a registration flow — stores email/name/password temporarily
  // so they survive the navigate() between SignUp → EmailVerify pages
  const startSignupFlow = useCallback(({ 
    email: em, 
    displayName: dn = "", 
    password: pw = "" 
  }) => {
    setEmail(em);
    setDisplayName(dn);
    setPendingPassword(pw);
    try {
      sessionStorage.setItem("AF_email", em);
    } catch {}
  }, []);

  // Clear everything after flow completes or user cancels
  const clearFlow = useCallback(() => {
    setEmail("");
    setDisplayName("");
    setPendingPassword("");
    try {
      sessionStorage.removeItem("AF_email");
    } catch {}
  }, []);

  const value = useMemo(() => ({
    email,
    setEmail,
    displayName,
    pendingPassword,
    startSignupFlow,
    clearFlow,
  }), [email, displayName, pendingPassword, startSignupFlow, clearFlow]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthFlow must be used within <AuthFlowProvider>");
  return ctx;
}