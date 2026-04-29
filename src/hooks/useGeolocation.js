
// src/hooks/useGeolocation.js
import { useCallback, useEffect, useRef, useState } from "react";

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
};

const SIGNIFICANT_CHANGE_KM = 0.1;
const MIN_CALLBACK_INTERVAL_MS = 5_000; // never fire callback more than once per 5s

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6_371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation({
  watch = true,
  onLocationChange = null,
  updateIntervalMs = 30_000,
} = {}) {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);
  const [status,   setStatus]   = useState("idle");

  // ── Stable refs (never trigger re-renders or effect re-runs) ────
  const watchIdRef        = useRef(null);
  const intervalIdRef     = useRef(null);
  const lastLocationRef   = useRef(null);
  const lastCallbackAtRef = useRef(0);
  const onChangeRef       = useRef(onLocationChange);
  const mountedRef        = useRef(true);
  const statusRef         = useRef("idle"); // mirror of status for use inside callbacks

  // Keep callback ref fresh without re-running effects
  useEffect(() => { onChangeRef.current = onLocationChange; }, [onLocationChange]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────
  const setStatusSafe = useCallback((s) => {
    if (!mountedRef.current) return;
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ── Success handler ──────────────────────────────────────────────
  // useCallback with [] so the function reference is stable forever.
  // It reads all mutable values through refs.
  const handleSuccess = useCallback((position) => {
    if (!mountedRef.current) return;

    const next = {
      lat:       position.coords.latitude,
      lng:       position.coords.longitude,
      accuracy:  position.coords.accuracy,
      timestamp: position.timestamp,
    };

    // Check for significant movement
    const last = lastLocationRef.current;
    const moved =
      !last ||
      haversineDistance(last.lat, last.lng, next.lat, next.lng) >=
        SIGNIFICANT_CHANGE_KM;

    setLocation(next);
    setError(null);
    setStatusSafe("granted");

    if (moved) {
      lastLocationRef.current = next;

      // Throttle the external callback
      const now = Date.now();
      if (now - lastCallbackAtRef.current >= MIN_CALLBACK_INTERVAL_MS) {
        lastCallbackAtRef.current = now;
        try {
          onChangeRef.current?.(next);
        } catch (err) {
          console.warn("[useGeolocation] onLocationChange threw:", err);
        }
      }
    }
  }, []); 
  // Intentionally empty — reads everything via refs

  // ── Error handler ─────────────────────────────────────────────────
  const handleError = useCallback((err) => {
    if (!mountedRef.current) return;
    setError(err.message || "Location error");
    setStatusSafe(err.code === 1 ? "denied" : "error");
  }, [setStatusSafe]);

  // ── Core: stop everything ────────────────────────────────────────
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  // ── Core: start watching ─────────────────────────────────────────
  // Captured in a ref so visibility handler can call it without
  // being listed as a dependency (avoids effect re-registration).
  const startWatchingImpl = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatusSafe("unsupported");
      setError("Geolocation not supported");
      return;
    }

    // Clear any previous watcher/interval before starting fresh
    stopWatching();

    setStatusSafe("loading");

    // Immediate one-shot fetch so the user sees location fast
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      GEO_OPTIONS
    );

    if (watch) {
      // Continuous watcher (fires on device movement)
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        GEO_OPTIONS
      );

      // Periodic fallback in case watchPosition goes silent
      // (common on iOS after screen lock)
      intervalIdRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => { /* silent — watcher still active */ },
          GEO_OPTIONS
        );
      }, updateIntervalMs);
    }
  }, [watch, updateIntervalMs, handleSuccess, handleError, stopWatching, setStatusSafe]);

  // Keep a stable ref to startWatchingImpl for the visibility handler
  const startWatchingRef = useRef(startWatchingImpl);
  useEffect(() => { startWatchingRef.current = startWatchingImpl; }, [startWatchingImpl]);

  // ── Mount / option-change effect ─────────────────────────────────
  useEffect(() => {
    startWatchingImpl();
    return stopWatching;
    // Re-run only when core options change, not on every render
  }, [watch, updateIntervalMs]); 

  // ── Visibility recovery ───────────────────────────────────────────
  // Mobile browsers (iOS Safari especially) kill watchPosition when
  // the screen locks or the tab is backgrounded.
  useEffect(() => {
    if (!watch) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Restart watcher — stopWatching + fresh watchPosition
      startWatchingRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [watch]); // only depends on the stable `watch` boolean

  // ── Manual refresh (one-shot, doesn't restart watcher) ───────────
  const refresh = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setStatusSafe("loading");
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { ...GEO_OPTIONS, maximumAge: 0 }, // force fresh fix
    );
  }, [handleSuccess, handleError, setStatusSafe]);

  return { location, error, status, refresh, startWatching: startWatchingImpl, stopWatching };
}