import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function SetupGate() {
  const { isSetupComplete, ready, session } = useAuth();

  // If we don't know the auth status yet, show a clean branded loader
  if (!ready) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-600 border-t-transparent" />
      </div>
    );
  }

  // If logged in but setup is missing, go to basics
  if (session && !isSetupComplete) {
    return <Navigate to="/setup/basics" replace />;
  }

  return <Outlet />;
}