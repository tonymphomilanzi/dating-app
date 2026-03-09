// src/pages/Discover.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { discoverService } from "../services/discover.service.js";
import { storiesService } from "../services/stories.service.js";
import { updateProfileLocation } from "../utils/location.js";
import { kmBetween } from "../utils/geo.js";
import { DiscoverCache } from "../lib/discoverCache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";
import { useGeolocation } from "../hooks/useGeolocation.js";

/* ---------------- Constants ---------------- */
const TABS = [
  { key: "matches", label: "Matches" },
  { key: "nearby", label: "Nearby" },
  { key: "for_you", label: "For You" },
];

const LOCATION_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/* ---------------- Helpers ---------------- */
function parseNumber(value) {
  if (value == null) return null;
  const num = Number.isFinite(+value) ? +value : parseFloat(String(value));
  return Number.isNaN(num) ? null : num;
}

function normalizeCoordinates(profile) {
  return {
    lat: parseNumber(profile.lat ?? profile.latitude),
    lng: parseNumber(profile.lng ?? profile.longitude ?? profile.long),
  };
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const ageInMs = Date.now() - birthDate.getTime();
  return Math.floor(ageInMs / (365.25 * 24 * 3600 * 1000));
}

function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/* ---------------- Main Component ---------------- */
export default function Discover() {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();
  const userId = profile?.id || "me";

  // Mode and UI state
  const [selectedMode, setSelectedMode] = useState("for_you");
  const [activeMode, setActiveMode] = useState("for_you");
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Stories state
  const [storyUsers, setStoryUsers] = useState([]);
  const [hasMyStory, setHasMyStory] = useState(false);

  // Request tracking
  const requestIdRef = useRef(0);
  const lastLocationSaveTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Real-time location tracking with auto-save to profile
  const handleLocationChange = useCallback(async (newLocation) => {
    const now = Date.now();
    const timeSinceLastSave = now - lastLocationSaveTimeRef.current;
    
    // Only save to profile periodically to avoid excessive writes
    if (timeSinceLastSave > LOCATION_SAVE_INTERVAL_MS) {
      try {
        await updateProfileLocation(newLocation.lat, newLocation.lng);
        lastLocationSaveTimeRef.current = now;
        console.log("📍 Location saved to profile:", {
          lat: newLocation.lat.toFixed(6),
          lng: newLocation.lng.toFixed(6),
        });
      } catch (err) {
        console.warn("Failed to save location to profile:", err.message);
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
    updateIntervalMs: 30000, // Check every 30 seconds
    onLocationChange: handleLocationChange,
  });

  // Use real-time location if available, fallback to profile
  const myLatitude = currentLocation?.lat ?? parseNumber(profile?.lat);
  const myLongitude = currentLocation?.lng ?? parseNumber(profile?.lng);
  const hasLocation = myLatitude != null && myLongitude != null;

  // Normalize profiles with current location for distance calculation
  const normalizeProfiles = useCallback((rawProfiles) => {
    return rawProfiles.map((rawProfile) => {
      const { lat, lng } = normalizeCoordinates(rawProfile);
      
      // Calculate distance from current location
      let distanceKm = rawProfile.distance_km;
      if (myLatitude != null && myLongitude != null && lat != null && lng != null) {
        distanceKm = Math.round(kmBetween(myLatitude, myLongitude, lat, lng) * 10) / 10;
      }

      return {
        ...rawProfile,
        lat,
        lng,
        distance_km: distanceKm,
      };
    });
  }, [myLatitude, myLongitude]);

  // Fetch profiles for the selected mode
  const fetchProfiles = useCallback(async (requestedMode, options = {}) => {
    const { background = false } = options;
    const currentRequestId = ++requestIdRef.current;

    // Abort previous request
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!background) {
      setIsLoading(true);
      setError("");
    }

    try {
      const response = await discoverService.list(requestedMode, 20, {
        lat: myLatitude,
        lng: myLongitude,
        signal: abortController.signal,
        debug: false,
      });

      // Ignore stale responses
      if (requestIdRef.current !== currentRequestId) return;
      if (!isMountedRef.current) return;

      let normalizedProfiles = Array.isArray(response) ? response : [];
      normalizedProfiles = normalizeProfiles(normalizedProfiles);

      setProfiles(normalizedProfiles);
      setActiveMode(requestedMode);
      
      // Cache the results
      DiscoverCache.save(userId, requestedMode, normalizedProfiles);
    } catch (err) {
      // Ignore aborted requests
      if (err?.name === "AbortError") return;
      if (requestIdRef.current !== currentRequestId) return;
      if (!isMountedRef.current) return;

      const errorMessage = err?.message || "Failed to load profiles";
      setError(errorMessage);
    } finally {
      if (!background && requestIdRef.current === currentRequestId && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, myLatitude, myLongitude, normalizeProfiles]);

  // Load data when mode changes
  useEffect(() => {
    const cached = DiscoverCache.load(userId, selectedMode);

    if (cached.items?.length) {
      // Show cached data immediately (normalized with current location)
      const normalizedCached = normalizeProfiles(cached.items);
      setProfiles(normalizedCached);
      setActiveMode(selectedMode);
      setIsLoading(false);

      // Refresh in background if cache is stale
      if (DiscoverCache.isStale(cached.ts)) {
        fetchProfiles(selectedMode, { background: true });
      }
    } else {
      // No cache, fetch fresh data
      fetchProfiles(selectedMode, { background: false });
    }
  }, [selectedMode, userId, fetchProfiles, normalizeProfiles]);

  // Recalculate distances when location changes significantly
  useEffect(() => {
    if (currentLocation && profiles.length > 0 && isMountedRef.current) {
      setProfiles((prevProfiles) => normalizeProfiles(prevProfiles));
    }
  }, [currentLocation, normalizeProfiles]);

  // Auto-refresh in background (focus, visibility, online, periodic)
  useRevalidate({
    refetch: () => fetchProfiles(selectedMode, { background: true }),
    intervalMs: 60000,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
    cooldownMs: 2000,
  });

  // Load stories on mount
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
        // Silently ignore story loading errors
      }
    };

    loadStories();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Handle enabling location for "Nearby" mode
  const handleEnableLocation = useCallback(async () => {
    try {
      refreshLocation();
      
      // Wait a moment for location to be obtained
      setTimeout(() => {
        setSelectedMode("nearby");
      }, 500);
    } catch (err) {
      alert(err.message || "Could not get your location");
    }
  }, [refreshLocation]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    fetchProfiles(selectedMode, { background: false });
  }, [fetchProfiles, selectedMode]);

  // Derived state
  const storyPreviews = useMemo(() => profiles.slice(0, 6), [profiles]);
  const showLocationPrompt = activeMode === "nearby" && !hasLocation;

  const locationStatusDisplay = useMemo(() => {
    if (!hasLocation) return null;
    
    if (locationStatus === "loading") {
      return { text: "Updating...", color: "text-amber-600" };
    }
    
    if (currentLocation?.accuracy) {
      const accuracyText = currentLocation.accuracy < 100
        ? `±${Math.round(currentLocation.accuracy)}m`
        : `±${(currentLocation.accuracy / 1000).toFixed(1)}km`;
      return { text: accuracyText, color: "text-green-600" };
    }
    
    return { text: "Location active", color: "text-green-600" };
  }, [hasLocation, locationStatus, currentLocation]);

  return (
    <div className="flex min-h-[70vh] flex-col bg-white text-gray-900">
      {/* Header */}
      <header className="px-4 pt-4">
        {/* Top row with avatar and controls */}
        <div className="mb-3 flex items-center gap-3">
          <img
            src={profile?.avatar_url || "/me.jpg"}
            alt="My profile"
            className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-600 ring-offset-2"
          />
          
          <div className="text-sm leading-tight">
            <p className="text-gray-500">Discover</p>
            {locationStatusDisplay && (
              <p className={`text-xs flex items-center gap-1 ${locationStatusDisplay.color}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {locationStatusDisplay.text}
              </p>
            )}
          </div>

          {/* Location refresh button */}
          <button
            onClick={refreshLocation}
            className="ml-auto rounded-full p-2 hover:bg-gray-100 transition-colors"
            aria-label="Refresh location"
            title="Refresh location"
          >
            <i
              className={`lni lni-map-marker text-xl ${
                locationStatus === "loading"
                  ? "animate-pulse text-violet-600"
                  : hasLocation
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            />
          </button>

          {/* Filters link */}
          <Link
            to="/filters"
            className="rounded-full p-2 hover:bg-gray-100 transition-colors"
            aria-label="Filters"
          >
            <i className="lni lni-filter text-xl text-gray-600" />
          </Link>
        </div>

        {/* Stories row */}
        <StoriesRow
          storyUsers={storyUsers}
          hasMyStory={hasMyStory}
          onMyStoryClick={() => navigate("/stories/new")}
          onUserStoryClick={(userId) => navigate(`/stories/${userId}`)}
        />

        {/* Title */}
        <p className="font-semibold">
          Let's Find Your <span className="text-violet-600">Matches</span>
        </p>

        {/* Mode tabs */}
        <div className="mt-2">
          <ModeTabs
            tabs={TABS}
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
          />

          {/* Mode mismatch warning */}
          {selectedMode !== activeMode && !isLoading && (
            <p className="mt-2 text-xs text-gray-500">
              No results in "{selectedMode.replace("_", " ")}" — showing "
              {activeMode.replace("_", " ")}".
            </p>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pt-4 pb-6">
        {isLoading && profiles.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          <>
            {/* Location prompt for Nearby mode */}
            {showLocationPrompt && (
              <LocationPrompt
                onEnable={handleEnableLocation}
                isLoading={locationStatus === "loading"}
                error={locationError}
              />
            )}

            {/* Swipe deck */}
            <SwipeDeck
              initialItems={profiles}
              mode={activeMode}
              myLoc={{ lat: myLatitude, lng: myLongitude }}
            />
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Stories Row Component ---------------- */
function StoriesRow({ storyUsers, hasMyStory, onMyStoryClick, onUserStoryClick }) {
  return (
    <div className="no-scrollbar mb-3 flex items-start gap-3 overflow-x-auto pb-1">
      {/* My story button */}
      <div className="flex w-16 flex-col items-center">
        <button
          className={[
            "grid h-14 w-14 place-items-center rounded-full transition-colors",
            hasMyStory
              ? "ring-2 ring-violet-600 bg-violet-50"
              : "border-2 border-dashed border-violet-600 text-violet-600 hover:bg-violet-50",
          ].join(" ")}
          onClick={onMyStoryClick}
          aria-label="Add to my story"
        >
          <i className="lni lni-plus text-lg" />
        </button>
        <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">
          My story
        </span>
      </div>

      {/* Other users' stories */}
      {storyUsers.map((user) => (
        <button
          key={user.user_id}
          onClick={() => onUserStoryClick(user.user_id)}
          className="flex w-16 flex-col items-center group"
          aria-label={`View ${user.name}'s story`}
        >
          <img
            src={user.avatar || "/me.jpg"}
            alt={user.name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-200 group-hover:ring-violet-400 transition-all"
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

/* ---------------- Mode Tabs Component ---------------- */
function ModeTabs({ tabs, selectedMode, onSelectMode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSelectMode(tab.key)}
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
  );
}

/* ---------------- Loading State Component ---------------- */
function LoadingState() {
  return (
    <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
        <span className="relative inline-block h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
        </span>
        <span className="text-sm font-medium text-gray-700">Finding people near you…</span>
      </div>
    </div>
  );
}

/* ---------------- Error State Component ---------------- */
function ErrorState({ error, onRetry }) {
  const errorMessage = typeof error === "string" ? error : error?.message || "Something went wrong";

  return (
    <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
      <div className="px-6">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-50">
          <i className="lni lni-warning text-2xl text-red-500" />
        </div>
        <p className="text-red-600 font-medium">Failed to load</p>
        <p className="mt-1 text-xs text-gray-500 max-w-xs">{errorMessage}</p>
        <button
          className="mt-4 rounded-full border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ---------------- Location Prompt Component ---------------- */
function LocationPrompt({ onEnable, isLoading, error }) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100">
          <i className="lni lni-map-marker text-amber-600 text-lg" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Enable location for Nearby
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            See people close to you in real-time
          </p>
          
          {error && (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          )}
        </div>

        <button
          onClick={onEnable}
          disabled={isLoading}
          className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <i className="lni lni-spinner-solid animate-spin" />
              Locating…
            </span>
          ) : (
            "Enable"
          )}
        </button>
      </div>
    </div>
  );
}