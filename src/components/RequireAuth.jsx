// src/components/RequireAuth.jsx
// Guard logic moved to authRoute.beforeLoad in router.jsx
// Kept as passthrough so existing imports don't break
// Safe to delete after full migration is confirmed

import { Outlet } from "@tanstack/react-router";

export default function RequireAuth() {
  return <Outlet />;
}