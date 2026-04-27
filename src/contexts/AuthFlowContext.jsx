// src/contexts/AuthFlowContext.jsx
import { createContext, useContext, useMemo, useState, useCallback } from "react";

const Ctx = createContext(null);

export function AuthFlowProvider({ children }) {
  const [email, setEmail] = useState(
    () => {
      try { return sessionStorage.getItem("AF_email") || ""; } catch { return ""; }
    }
  );
  const [displayName, setDisplayName] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [otpType, setOtpType] = useState("signup"); // "signup" | "magiclink"

  const startSignupFlow = useCallback(
    ({ email: em, displayName: dn = "", password: pw = "", type = "signup" }) => {
      setEmail(em);
      setDisplayName(dn);
      setPendingPassword(pw);
      setOtpType(type);
      try {
        sessionStorage.setItem("AF_email", em);
        sessionStorage.setItem("AF_type", type);
      } catch {}
    },
    []
  );

  const clearFlow = useCallback(() => {
    setDisplayName("");
    setPendingPassword("");
    setOtpType("signup");
    try {
      sessionStorage.removeItem("AF_email");
      sessionStorage.removeItem("AF_type");
      sessionStorage.removeItem("AF_IN_OTP");
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      email,
      setEmail,
      displayName,
      pendingPassword,
      otpType,
      startSignupFlow,
      clearFlow,
    }),
    [email, displayName, pendingPassword, otpType, startSignupFlow, clearFlow]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthFlow must be used within <AuthFlowProvider>");
  return ctx;
}