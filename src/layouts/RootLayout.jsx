import { Outlet } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import DebugOverlay from "../components/DebugOverlay.jsx";

export default function RootLayout() {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-md bg-gray-50">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <DebugOverlay />
    </div>
  );
}