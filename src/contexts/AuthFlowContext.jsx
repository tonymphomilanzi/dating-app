import { createContext, useContext, useMemo, useState } from "react";

const AuthFlowCtx = createContext(null);

export function AuthFlowProvider({ children }) {
  const [email, setEmail] = useState("");
  const value = useMemo(() => ({ email, setEmail }), [email]);
  return <AuthFlowCtx.Provider value={value}>{children}</AuthFlowCtx.Provider>;
}

export function useAuthFlow() {
  const ctx = useContext(AuthFlowCtx);
  if (!ctx) throw new Error("useAuthFlow must be used within <AuthFlowProvider>");
  return ctx;
}