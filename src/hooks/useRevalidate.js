import { useEffect, useRef } from "react";

export function useRevalidate({
  refetch,                // async () => void
  intervalMs = 0,         // 0 = off
  onFocus = true,
  onVisibility = true,
  onOnline = true,
} = {}) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const doRefetch = () => refetchRef.current?.();

    const onVis = () => {
      if (document.visibilityState === "visible") doRefetch();
    };

    if (onFocus) window.addEventListener("focus", doRefetch);
    if (onVisibility) document.addEventListener("visibilitychange", onVis);
    if (onOnline) window.addEventListener("online", doRefetch);

    let id = null;
    if (intervalMs > 0) id = setInterval(doRefetch, intervalMs);

    return () => {
      if (onFocus) window.removeEventListener("focus", doRefetch);
      if (onVisibility) document.removeEventListener("visibilitychange", onVis);
      if (onOnline) window.removeEventListener("online", doRefetch);
      if (id) clearInterval(id);
    };
  }, [intervalMs, onFocus, onVisibility, onOnline]);
}