import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  return <Outlet />;
}