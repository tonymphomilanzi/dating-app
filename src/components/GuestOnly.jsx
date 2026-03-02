import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function GuestOnly() {
  const { ready, user } = useAuth();
  const loc = useLocation();
  if (!ready) {
    console.info("[Guard:GuestOnly] waiting for auth.ready … route:", loc.pathname);
    return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  }
  if (user) {
    console.info("[Guard:GuestOnly] user present; redirecting to /discover from", loc.pathname);
    return <Navigate to="/discover" replace />;
  }
  return <Outlet />;
}