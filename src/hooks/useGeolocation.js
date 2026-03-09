// src/hooks/useGeolocation.js
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 30000, // Cache position for 30 seconds
};

// Minimum distance (km) before we consider location "changed"
const SIGNIFICANT_CHANGE_KM = 0.1; // 100 meters

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
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
  updateIntervalMs = 30000, // Check every 30 seconds
} = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | granted | denied | unsupported
  
  const lastLocationRef = useRef(null);
  const watchIdRef = useRef(null);
  const intervalIdRef = useRef(null);

  const handleSuccess = useCallback((position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };

    // Check if location changed significantly
    const lastLoc = lastLocationRef.current;
    let significantChange = true;

    if (lastLoc) {
      const distance = haversineDistance(
        lastLoc.lat, lastLoc.lng,
        newLocation.lat, newLocation.lng
      );
      significantChange = distance >= SIGNIFICANT_CHANGE_KM;
    }

    setLocation(newLocation);
    setStatus("granted");
    setError(null);

    // Only trigger callback if location changed significantly
    if (significantChange) {
      lastLocationRef.current = newLocation;
      onLocationChange?.(newLocation);
    }
  }, [onLocationChange]);

  const handleError = useCallback((err) => {
    setError(err.message);
    setStatus(err.code === 1 ? "denied" : "error");
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
      return;
    }

    // Get initial position
    getCurrentPosition();

    // Watch for changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      DEFAULT_OPTIONS
    );

    // Also poll periodically (some devices don't fire watchPosition reliably)
    intervalIdRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        () => {}, // Silent fail for interval checks
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
    refresh: getCurrentPosition,
    startWatching,
    stopWatching,
  };
}