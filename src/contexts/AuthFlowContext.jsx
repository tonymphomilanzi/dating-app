import { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export function AuthFlowProvider({ children }) {
  const [email, setEmail] = useState(() => sessionStorage.getItem("AF_email") || "");
  const [displayName, setDisplayName] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const startSignupFlow = ({ email: em, displayName: dn, password: pw }) => {
    setEmail(em);
    setDisplayName(dn || "");
    setPendingPassword(pw || "");
    try { sessionStorage.setItem("AF_email", em); } catch {}
  };

  const clearFlow = () => {
    setDisplayName("");
    setPendingPassword("");
    try { sessionStorage.removeItem("AF_email"); } catch {}
  };

  const value = useMemo(
    () => ({ email, displayName, pendingPassword, startSignupFlow, clearFlow }),
    [email, displayName, pendingPassword]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthFlow must be used within <AuthFlowProvider>");
  return ctx;
}