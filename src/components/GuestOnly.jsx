import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-dvh place-items-center">Loading…</div>;
  if (user) return <Navigate to="/discover" replace />;
  return <Outlet />;
}