// src/components/DebugOverlay.jsx
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isDebug } from "../utils/debug";

export default function DebugOverlay() {
  if (!isDebug()) return null;
  const loc = useLocation();
  const { ready, user, profile } = useAuth();

  return (
    <div className="fixed left-2 top-2 z-[1000] rounded-md bg-black/70 px-3 py-2 text-xs text-white">
      <div>route: {loc.pathname}</div>
      <div>auth.ready: {String(ready)}</div>
      <div>user: {user ? user.id.slice(0, 8) + "…" : "null"}</div>
      <div>profile: {profile ? "ok" : "null"}</div>
      <div>avatar: {profile?.avatar_url ? "yes" : "no"}</div>
    </div>
  );
}