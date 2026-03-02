import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function RequireAuth() {
  const { ready, user } = useAuth();
  const loc = useLocation();
  if (!ready) {
    console.info("[Guard:RequireAuth] waiting for auth.ready … route:", loc.pathname);
    return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  }
  if (!user) {
    console.warn("[Guard:RequireAuth] no user; redirecting to /auth from", loc.pathname);
    return <Navigate to="/auth" replace state={{ from: loc }} />;
  }
  return <Outlet />;
}