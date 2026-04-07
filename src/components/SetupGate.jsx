import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function SetupGate() {
  const { ready, user, profile, isSetupComplete } = useAuth();
  const loc = useLocation();

  const isAuthRoute = loc.pathname.startsWith("/auth");
  const isSetupRoute = loc.pathname.startsWith("/setup");
  const isOtpFlow = sessionStorage.getItem("AF_IN_OTP") === "1";

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  // Not logged in? Go to auth
  if (!user && !isAuthRoute) return <Navigate to="/auth" replace />;

  // Logic for logged-in users
  if (user && !isOtpFlow) {
    // If setup is done, don't let them back into setup/auth pages
    if (isSetupComplete && (isAuthRoute || isSetupRoute)) {
      return <Navigate to="/discover" replace />;
    }
    // If setup NOT done and they are trying to access app, force to setup
    if (!isSetupComplete && !isSetupRoute && !isAuthRoute) {
      return <Navigate to="/setup/basics" replace />;
    }
  }

  return <Outlet />;
}