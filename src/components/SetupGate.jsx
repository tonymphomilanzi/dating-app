// src/components/SetupGate.jsx
// This component is no longer needed — all gate logic lives in
// setupGateRoute.beforeLoad inside router.jsx
//
// Kept as a passthrough so any imports don't break during migration.
// Safe to delete once you've confirmed everything works.

import { Outlet } from "@tanstack/react-router";

export default function SetupGate() {
  return <Outlet />;
}