// src/hooks/useRevalidate.js
import { useEffect, useRef, useCallback } from "react";

const DEFAULT_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS  = 30_000; // refetch if tab was hidden > 30s

export function useRevalidate({ refetch, intervalMs = DEFAULT_INTERVAL_MS }) {
  const refetchRef    = useRef(refetch);
  const lastFetchRef  = useRef(Date.now());
  const hiddenAtRef   = useRef(null);

  // Always call the latest refetch without re-registering effects
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const safeRefetch = useCallback(() => {
    lastFetchRef.current = Date.now();
    refetchRef.current?.();
  }, []);

  // ── Polling interval ────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(safeRefetch, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, safeRefetch]);

  // ── Visibility change (tab switch / phone lock) ─────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      // Tab became visible again
      const hiddenDuration = hiddenAtRef.current
        ? Date.now() - hiddenAtRef.current
        : 0;

      hiddenAtRef.current = null;

      if (hiddenDuration > STALE_THRESHOLD_MS) {
        safeRefetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [safeRefetch]);

  // ── Window focus (alt-tab, clicking back into browser) ──────────
  useEffect(() => {
    const handleFocus = () => {
      const staleness = Date.now() - lastFetchRef.current;
      if (staleness > STALE_THRESHOLD_MS) {
        safeRefetch();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [safeRefetch]);
}