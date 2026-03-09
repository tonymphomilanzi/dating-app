// src/hooks/useGeolocation.js
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 30000,
};

const SIGNIFICANT_CHANGE_KM = 0.1;

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation({
  watch = true,
  onLocationChange = null,
  updateIntervalMs = 30000,
} = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  const lastLocationRef = useRef(null);
  const watchIdRef = useRef(null);
  const intervalIdRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const handleSuccess = useCallback((position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };

    const lastLocation = lastLocationRef.current;
    let isSignificantChange = true;

    if (lastLocation) {
      const distance = haversineDistance(
        lastLocation.lat,
        lastLocation.lng,
        newLocation.lat,
        newLocation.lng
      );
      isSignificantChange = distance >= SIGNIFICANT_CHANGE_KM;
    }

    setLocation(newLocation);
    setStatus("granted");
    setError(null);

    if (isSignificantChange) {
      lastLocationRef.current = newLocation;
      // Call the callback but don't let it break the hook
      try {
        onLocationChangeRef.current?.(newLocation);
      } catch (err) {
        console.warn("Location change callback error:", err);
      }
    }
  }, []);

  const handleError = useCallback((err) => {
    let errorMessage;
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = "Location permission denied";
        setStatus("denied");
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = "Location unavailable";
        setStatus("error");
        break;
      case 3: // TIMEOUT
        errorMessage = "Location request timed out";
        setStatus("error");
        break;
      default:
        errorMessage = err.message || "Unknown error";
        setStatus("error");
    }
    setError(errorMessage);
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Geolocation not supported");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      DEFAULT_OPTIONS
    );
  }, [handleSuccess, handleError]);

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Geolocation not supported");
      return;
    }

    getCurrentPosition();

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      DEFAULT_OPTIONS
    );

    intervalIdRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        () => {},
        DEFAULT_OPTIONS
      );
    }, updateIntervalMs);
  }, [getCurrentPosition, handleSuccess, handleError, updateIntervalMs]);

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

  const refresh = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  useEffect(() => {
    if (watch) {
      startWatching();
    } else {
      getCurrentPosition();
    }

    return () => {
      stopWatching();
    };
  }, [watch, startWatching, stopWatching, getCurrentPosition]);

  return {
    location,
    error,
    status,
    refresh,
    startWatching,
    stopWatching,
  };
}