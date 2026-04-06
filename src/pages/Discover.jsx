// src/pages/Discover.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { discoverService } from "../services/discover.service.js";
import { storiesService } from "../services/stories.service.js";
import { updateProfileLocation } from "../utils/location.js";
import { DiscoverCache } from "../lib/discoverCache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";
import { useGeolocation } from "../hooks/useGeolocation.js";

// Helpers near the top
const toNum = (v) => (v == null ? null : Number(v));
const isValidLatLng = (lat, lng) => {
  const la = toNum(lat),
    ln = toNum(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false;
  if (la === 0 && ln === 0) return false;
  return true;
};

/* ---------------- Constants ---------------- */
const TABS = [
  { key: "matches", label: "Matches" },
  { key: "nearby", label: "Nearby" },
  { key: "for_you", label: "For You" },
];

const LOCATION_SAVE_INTERVAL_MS = 5 * 60 * 1000;

/* ---------------- Main Component ---------------- */
export default function Discover() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const userId = profile?.id || "me";

  // Mode and UI state
  const [selectedMode, setSelectedMode] = useState("for_you");
  const [activeMode, setActiveMode] = useState("for_you");
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Notifications (placeholder for now; wire to API later)
  const [unreadCount] = useState(3);

  // Stories state
  const [storyUsers, setStoryUsers] = useState([]);
  const [hasMyStory, setHasMyStory] = useState(false);

  // Refs
  const requestIdRef = useRef(0);
  const lastLocationSaveTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Real-time location tracking
  const handleLocationChange = useCallback(async (newLocation) => {
    const lat = toNum(newLocation?.lat);
    const lng = toNum(newLocation?.lng);
    if (!isValidLatLng(lat, lng)) return;

    const now = Date.now();
    if (now - lastLocationSaveTimeRef.current > LOCATION_SAVE_INTERVAL_MS) {
      try {
        await updateProfileLocation(lat, lng);
        lastLocationSaveTimeRef.current = now;
        console.log(">>Location saved:", { lat: lat.toFixed(4), lng: lng.toFixed(4) });
      } catch (err) {
        console.warn("Location save failed:", err.message);
      }
    }
  }, []);

  const {
    location: currentLocation,
    status: locationStatus,
    error: locationError,
    refresh: refreshLocation,
  } = useGeolocation({
    watch: true,
    updateIntervalMs: 30000,
    onLocationChange: handleLocationChange,
  });

  const lastGoodRealtimeRef = useRef(null);

  useEffect(() => {
    const lat = toNum(currentLocation?.lat);
    const lng = toNum(currentLocation?.lng);
    if (isValidLatLng(lat, lng)) {
      lastGoodRealtimeRef.current = {
        lat,
        lng,
        accuracy: currentLocation?.accuracy,
        isRealtime: true,
      };
    }
  }, [currentLocation?.lat, currentLocation?.lng, currentLocation?.accuracy]);

  // Use real-time location if available, fallback to profile
  const myLocation = useMemo(() => {
    if (lastGoodRealtimeRef.current) return lastGoodRealtimeRef.current;

    if (isValidLatLng(profile?.lat, profile?.lng)) {
      return { lat: Number(profile.lat), lng: Number(profile.lng), isRealtime: false };
    }

    return null;
  }, [profile?.lat, profile?.lng]);

  // Fetch profiles
  const fetchProfiles = useCallback(
    async (requestedMode, options = {}) => {
      const { background = false } = options;
      const currentRequestId = ++requestIdRef.current;

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (!background) {
        setIsLoading(true);
        setError("");
      }

      try {
        const response = await discoverService.list(requestedMode, 20, {
          lat: myLocation?.lat,
          lng: myLocation?.lng,
          signal: abortController.signal,
          debug: false,
        });

        if (requestIdRef.current !== currentRequestId || !isMountedRef.current) return;

        const items = Array.isArray(response) ? response : [];
        setProfiles(items);
        setActiveMode(requestedMode);
        DiscoverCache.save(userId, requestedMode, items);
      } catch (err) {
        if (requestIdRef.current !== currentRequestId || !isMountedRef.current) return;
        if (err?.name !== "AbortError") {
          setError(err?.message || "Failed to load profiles");
        }
      } finally {
        if (requestIdRef.current === currentRequestId && isMountedRef.current && !background) {
          setIsLoading(false);
        }
      }
    },
    [userId, myLocation?.lat, myLocation?.lng]
  );

  // Load data when mode or location changes
  useEffect(() => {
    const cached = DiscoverCache.load(userId, selectedMode);

    if (cached.items?.length) {
      setProfiles(cached.items);
      setActiveMode(selectedMode);
      setIsLoading(false);

      if (DiscoverCache.isStale(cached.ts)) {
        fetchProfiles(selectedMode, { background: true });
      }
    } else {
      fetchProfiles(selectedMode, { background: false });
    }
  }, [selectedMode, userId, fetchProfiles]);

  // Refetch when location changes significantly
  useEffect(() => {
    if (myLocation?.isRealtime && selectedMode === "nearby") {
      fetchProfiles("nearby", { background: true });
    }
  }, [myLocation?.lat, myLocation?.lng, selectedMode, fetchProfiles]);

  // Auto-refresh
  useRevalidate({
    refetch: () => fetchProfiles(selectedMode, { background: true }),
    intervalMs: 60000,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
    cooldownMs: 2000,
  });

  // Load stories
  useEffect(() => {
    let isCancelled = false;

    const loadStories = async () => {
      try {
        const [users, hasMine] = await Promise.all([
          storiesService.listActiveUsers(30).catch(() => []),
          storiesService.hasMyActive().catch(() => false),
        ]);

        if (!isCancelled) {
          setStoryUsers(users);
          setHasMyStory(hasMine);
        }
      } catch {
        // noop
      }
    };

    loadStories();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleEnableLocation = useCallback(async () => {
    try {
      refreshLocation();
      setTimeout(() => setSelectedMode("nearby"), 500);
    } catch (err) {
      alert(err.message || "Could not get your location");
    }
  }, [refreshLocation]);

  const handleRetry = useCallback(() => {
    fetchProfiles(selectedMode, { background: false });
  }, [fetchProfiles, selectedMode]);

  const showLocationPrompt = activeMode === "nearby" && !myLocation;

  const locationStatusDisplay = useMemo(() => {
    if (!myLocation) return null;

    if (locationStatus === "loading") {
      return { text: "Updating...", color: "text-amber-600" };
    }

    if (myLocation.accuracy) {
      const accuracyText =
        myLocation.accuracy < 100
          ? `±${Math.round(myLocation.accuracy)}m`
          : `±${(myLocation.accuracy / 1000).toFixed(1)}km`;
      return { text: accuracyText, color: "text-green-600" };
    }

    return { text: "Location active", color: "text-green-600" };
  }, [myLocation, locationStatus]);

  return (
    <div className="flex min-h-[70vh] flex-col bg-white text-gray-900">
      <header className="px-4 pt-4">
        {/* Redesigned top bar */}
        <div className="mb-3 flex items-center justify-between">
          {/* LEFT: notifications + filters */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="relative rounded-full p-2 hover:bg-gray-100 transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
                />
              </svg>

              {unreadCount > 0 && (
                <span
                  className={[
                    "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1",
                    "inline-flex items-center justify-center",
                    "rounded-full bg-violet-600 text-white text-[10px] font-bold",
                    "ring-2 ring-white",
                  ].join(" ")}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <Link
              to="/filters"
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
              title="Filters"
              aria-label="Filters"
            >
              <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </Link>
          </div>

          {/* CENTER: title + location status */}
          <div className="text-center text-sm leading-tight">
            <p className="text-gray-500">Discover</p>
            {locationStatusDisplay && (
              <p className={`text-xs inline-flex items-center justify-center gap-1 ${locationStatusDisplay.color}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {locationStatusDisplay.text}
              </p>
            )}
          </div>

          {/* RIGHT: avatar links to profile */}
          <Link to="/profile" className="shrink-0" title="Profile" aria-label="Profile">
            <img
              src={profile?.avatar_url || "/me.jpg"}
              alt="My profile"
              className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-600 ring-offset-2"
              draggable={false}
            />
          </Link>
        </div>

        {/* Stories */}
        <StoriesRow
          storyUsers={storyUsers}
          hasMyStory={hasMyStory}
          onMyStoryClick={() => navigate("/stories/new")}
          onUserStoryClick={(id) => navigate(`/stories/${id}`)}
        />

        <p className="font-semibold">
          Let's Find Your <span className="text-violet-600">Matches</span>
        </p>

        {/* Tabs */}
        <div className="mt-2">
          <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setSelectedMode(tab.key);
                  setActiveMode(tab.key);
                  setProfiles([]);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedMode === tab.key
                    ? "bg-violet-600 text-white shadow"
                    : "text-gray-700 hover:bg-violet-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedMode !== activeMode && !isLoading && (
            <p className="mt-2 text-xs text-gray-500">
              No results in "{selectedMode.replace("_", " ")}" — showing "{activeMode.replace("_", " ")}".
            </p>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 pb-6">
        {isLoading && profiles.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          <>
            {showLocationPrompt && (
              <LocationPrompt
                onEnable={handleEnableLocation}
                isLoading={locationStatus === "loading"}
                error={locationError}
              />
            )}
            <SwipeDeck initialItems={profiles} mode={activeMode} myLoc={myLocation} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Sub Components ---------------- */
function StoriesRow({ storyUsers, hasMyStory, onMyStoryClick, onUserStoryClick }) {
  return (
    <div className="no-scrollbar mb-3 flex items-start gap-3 overflow-x-auto pb-1">
      <div className="flex w-16 flex-col items-center">
        <button
          className={`grid h-14 w-14 place-items-center rounded-full ${
            hasMyStory
              ? "ring-2 ring-violet-600 bg-violet-50"
              : "border-2 border-dashed border-violet-600 text-violet-600 hover:bg-violet-50"
          }`}
          onClick={onMyStoryClick}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">My story</span>
      </div>

      {storyUsers.map((user) => (
        <button
          key={user.user_id}
          onClick={() => onUserStoryClick(user.user_id)}
          className="flex w-16 flex-col items-center"
        >
          <img
            src={user.avatar || "/me.jpg"}
            alt={user.name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-200"
            draggable={false}
          />
          <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">
            {String(user.name).split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
        <span className="relative inline-block h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
        </span>
        <span className="text-sm font-medium text-gray-700">Finding people...</span>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
      <div className="px-6">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-red-600 font-medium">Failed to load</p>
        <p className="mt-1 text-xs text-gray-500">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-full border border-gray-200 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function LocationPrompt({ onEnable, isLoading, error }) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100">
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">Enable location for Nearby</p>
          <p className="mt-0.5 text-xs text-amber-700">See people close to you</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <button
          onClick={onEnable}
          disabled={isLoading}
          className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading ? "Locating..." : "Enable"}
        </button>
      </div>
    </div>
  );
}