/**
 * Events.jsx
 * 
 * Main Events page with Explore, Near You, and Massage Clinic tabs.
 * Refactored for modularity, performance, and clean architecture.
 * 
 * Design inspiration: Linear.app + Airbnb (clean, minimal, card-focused UI)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { eventsService } from "../services/events.service.js";

/* ================================================================
   CONSTANTS
   ================================================================ */

const EARTH_RADIUS_KM = 6371;
const GEOCODE_TIMEOUT_MS = 5000;
const FETCH_COOLDOWN_MS = 1000;
const FETCH_THROTTLE_MS = 400;
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const GEO_TIMEOUT_MS = 12_000;
const GEO_MAX_AGE_MS = 60_000;
const DEFAULT_RADIUS_KM = 50;
const POPULAR_EVENTS_LIMIT = 12;
const UPCOMING_EVENTS_LIMIT = 10;

/** Tab identifiers */
const TABS = {
  EXPLORE: "explore",
  NEAR: "near",
  MASSAGE: "massage",
};

/** View type identifiers */
const VIEW_TYPES = {
  LIST: "list",
  MAP: "map",
};

/* ================================================================
   CUSTOM HOOKS
   ================================================================ */

/**
 * useRevalidate — fires a refetch on focus, visibility change, online,
 * and/or an interval. Deduplicates in-flight requests and enforces
 * a cooldown between successive calls.
 */
function useRevalidate({
  refetch,
  intervalMs = 0,
  onFocus = true,
  onVisibility = true,
  onOnline = true,
  cooldownMs = FETCH_COOLDOWN_MS,
} = {}) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const lastFetchTime = useRef(0);
  const isInFlight = useRef(false);
  const isQueued = useRef(false);
  const timerRef = useRef(null);

  const fire = useCallback(() => {
    const now = Date.now();

    const run = () => {
      isInFlight.current = true;
      Promise.resolve(refetchRef.current?.())
        .catch(() => {})
        .finally(() => {
          isInFlight.current = false;
          lastFetchTime.current = Date.now();
          if (isQueued.current) {
            isQueued.current = false;
            fire();
          }
        });
    };

    if (isInFlight.current) {
      isQueued.current = true;
      return;
    }

    const elapsed = now - lastFetchTime.current;
    if (elapsed < cooldownMs) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, cooldownMs - elapsed);
      return;
    }

    run();
  }, [cooldownMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fire();
    };

    if (onFocus) window.addEventListener("focus", fire, { passive: true });
    if (onVisibility)
      document.addEventListener("visibilitychange", handleVisibilityChange, {
        passive: true,
      });
    if (onOnline) window.addEventListener("online", fire, { passive: true });

    let intervalId = null;
    if (intervalMs > 0) intervalId = setInterval(fire, intervalMs);

    return () => {
      if (onFocus) window.removeEventListener("focus", fire);
      if (onVisibility)
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (onOnline) window.removeEventListener("online", fire);
      if (intervalId) clearInterval(intervalId);
      clearTimeout(timerRef.current);
    };
  }, [intervalMs, onFocus, onVisibility, onOnline, fire]);
}

/**
 * useGeolocation — manages browser geolocation state and reverse geocoding.
 * Returns: { userLocation, locationStatus, locationLabel, requestLocation }
 */
function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("loading");
  const [locationLabel, setLocationLabel] = useState("");

  const isMountedRef = useRef(true);
  const geoAbortRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      geoAbortRef.current?.abort?.();
    };
  }, []);

  /** Reverse-geocode lat/lng → city name using Nominatim */
  const reverseGeocode = useCallback(async ({ lat, lng }) => {
    try {
      geoAbortRef.current?.abort?.();
      const ac = new AbortController();
      geoAbortRef.current = ac;

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const timeoutId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);

      const response = await fetch(url, {
        headers: { "Accept-Language": "en" },
        signal: ac.signal,
      }).catch((e) => {
        if (e?.name === "AbortError") return null;
        throw e;
      });

      clearTimeout(timeoutId);
      if (!response) return;

      const data = await response.json().catch(() => ({}));
      const cityName =
        data?.address?.city ||
        data?.address?.town ||
        data?.address?.village ||
        data?.address?.county ||
        data?.address?.state ||
        "";

      if (isMountedRef.current && geoAbortRef.current === ac) {
        setLocationLabel(cityName || "Your area");
      }
    } catch {
      // Silently fail — keep previous label
    }
  }, []);

  /** Request user's geolocation from browser */
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        };

        if (!isValidLatLng(coords.lat, coords.lng)) {
          setLocationStatus("denied");
          return;
        }

        setUserLocation(coords);
        setLocationStatus("granted");
        reverseGeocode(coords).catch(() => {});
      },
      () => setLocationStatus("denied"),
      {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: GEO_MAX_AGE_MS,
      }
    );
  }, [reverseGeocode]);

  return { userLocation, locationStatus, locationLabel, requestLocation };
}

/**
 * useEvents — manages event data fetching, state, and refresh logic.
 */
function useEvents({ isMountedRef }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const inflightRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const abortControllerRef = useRef(null);

  const mapServerRows = useCallback((rows) => {
    return rows.map((event) => ({
      id: event.id,
      title: event.title || "Untitled Event",
      description: event.description || "",
      img: event.cover_url || "",
      dateISO: event.starts_at,
      dateLabel: formatDateLabel(event.starts_at),
      ...extractDayMonth(event.starts_at),
      category: event.category || "Other",
      place: event.city || "Location TBD",
      lat: event.lat != null ? Number(event.lat) : null,
      lng: event.lng != null ? Number(event.lng) : null,
      price: event.price != null ? Number(event.price) : 0,
      created_at: event.created_at,
    }));
  }, []);

  const refresh = useCallback(
    async ({ foreground = false } = {}) => {
      const now = Date.now();

      // Prevent duplicate concurrent requests
      if (inflightRef.current) return inflightRef.current;

      // Throttle rapid successive calls
      if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;

      // Show spinner only for foreground loads with no existing data
      if (foreground && events.length === 0) setIsLoading(true);

      // Cancel any previous in-flight request
      abortControllerRef.current?.abort?.();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      inflightRef.current = (async () => {
        try {
          const rows = await eventsService.list({ signal: ac.signal });

          if (!isMountedRef.current || abortControllerRef.current !== ac) return;

          setEvents(mapServerRows(rows));
          setError("");
        } catch (err) {
          if (!isMountedRef.current || abortControllerRef.current !== ac) return;
          if (err?.name === "AbortError") return;

          const status = err?.status || err?.response?.status;
          if (status === 401 || /session expired/i.test(err?.message || "")) {
            setError("Session expired. Please sign in again.");
            return;
          }

          setError(
            err?.message ||
              err?.error ||
              err?.response?.data?.message ||
              "Failed to load events"
          );
        } finally {
          if (
            isMountedRef.current &&
            abortControllerRef.current === ac &&
            foreground
          ) {
            setIsLoading(false);
          }
          lastFetchTimeRef.current = Date.now();
          inflightRef.current = null;
        }
      })();

      return inflightRef.current;
    },
    [events.length, mapServerRows, isMountedRef]
  );

  return { events, setEvents, isLoading, error, refresh };
}

/**
 * useMassageClinics — fetches massage clinics based on location.
 * Uses a mock/stub for now; replace fetchClinics with real API.
 */
function useMassageClinics({ userLocation, locationStatus }) {
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const abortRef = useRef(null);

  /**
   * Fetch clinics — replace this stub with your actual API call.
   * Expected shape: [{ id, name, address, lat, lng, rating, distance_km }]
   */
  const fetchClinics = useCallback(
    async ({ signal } = {}) => {
      if (!userLocation) return [];

      // TODO: Replace with real API call, e.g.:
      // return await massageClinicService.nearby({
      //   lat: userLocation.lat,
      //   lng: userLocation.lng,
      //   signal,
      // });

      // Stub: simulate network delay, return empty (triggers empty state)
      await new Promise((res) => setTimeout(res, 800));
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return [];
    },
    [userLocation]
  );

  const loadClinics = useCallback(async () => {
    if (locationStatus !== "granted" || !userLocation) return;

    setIsLoading(true);
    setError("");

    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const data = await fetchClinics({ signal: ac.signal });
      if (ac.signal.aborted) return;
      setClinics(data || []);
      setHasFetched(true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Failed to load massage clinics");
      setHasFetched(true);
    } finally {
      if (!ac.signal.aborted) setIsLoading(false);
    }
  }, [userLocation, locationStatus, fetchClinics]);

  useEffect(() => {
    return () => abortRef.current?.abort?.();
  }, []);

  return { clinics, isLoading, error, hasFetched, loadClinics };
}

/* ================================================================
   GEO + DATE HELPERS
   ================================================================ */

const toRadians = (deg) => (deg * Math.PI) / 180;

/** Haversine distance between two {lat,lng} points in km */
function calculateKmBetween(a, b) {
  if (
    !a || !b ||
    a.lat == null || a.lng == null ||
    b.lat == null || b.lng == null
  ) return Infinity;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatDateLabel(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function extractDayMonth(iso) {
  if (!iso) return { day: "--", month: "---" };
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleDateString([], { month: "short" }),
  };
}

const isFiniteNum = (n) => Number.isFinite(Number(n));

const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) &&
  isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/* ================================================================
   MAP PIN ICON
   ================================================================ */

const pinIcon = L.divIcon({
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -34],
  html: `
    <div style="
      width:40px;height:40px;border-radius:9999px;
      background:linear-gradient(135deg,#f0abfc 0%,#7c3aed 100%);
      display:flex;align-items:center;justify-content:center;
      color:#fff;border:2px solid #fff;
      box-shadow:0 10px 24px rgba(124,58,237,0.35);
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 21s-7-4.35-7-10a7 7 0 1114 0c0 5.65-7 10-7 10z"
          fill="rgba(255,255,255,0.25)"/>
        <circle cx="12" cy="10" r="3" fill="#fff"/>
      </svg>
    </div>
  `,
});

/* ================================================================
   MAIN EVENTS PAGE
   ================================================================ */

export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── UI state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TABS.EXPLORE);
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [viewType, setViewType] = useState(VIEW_TYPES.LIST);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // ── Mount guard ───────────────────────────────────────────────
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Geolocation ───────────────────────────────────────────────
  const { userLocation, locationStatus, locationLabel, requestLocation } =
    useGeolocation();

  useEffect(() => {
    requestLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Events data ───────────────────────────────────────────────
  const { events, setEvents, isLoading, error, refresh } = useEvents({
    isMountedRef,
  });

  // Initial load
  useEffect(() => {
    refresh({ foreground: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle event created via navigation state
  useEffect(() => {
    const created = location.state?.created;
    if (!created) return;
    setEvents((prev) =>
      prev.some((e) => e.id === created.id) ? prev : [created, ...prev]
    );
    navigate("/events", { replace: true, state: null });
  }, [location.state, navigate, setEvents]);

  // Background auto-refresh
  useRevalidate({
    refetch: () => refresh({ foreground: false }),
    intervalMs: AUTO_REFRESH_INTERVAL_MS,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
    cooldownMs: FETCH_COOLDOWN_MS,
  });

  // ── Massage Clinics data ──────────────────────────────────────
  const { clinics, isLoading: clinicsLoading, error: clinicsError,
    hasFetched: clinicsHasFetched, loadClinics } =
    useMassageClinics({ userLocation, locationStatus });

  // Load clinics when Massage tab is activated
  useEffect(() => {
    if (activeTab === TABS.MASSAGE && !clinicsHasFetched) {
      loadClinics();
    }
  }, [activeTab, clinicsHasFetched, loadClinics]);

  // ── Derived data ──────────────────────────────────────────────

  /** All unique categories from fetched events */
  const categories = useMemo(() => {
    const set = new Set(events.map((e) => e.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [events]);

  /** Events filtered by category + search, sorted by date then proximity */
  const filteredEvents = useMemo(() => {
    let result = events.slice();

    if (selectedCategory !== "All") {
      result = result.filter((e) => e.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.place.toLowerCase().includes(q)
      );
    }

    // Primary sort: date ascending
    result.sort(
      (a, b) =>
        new Date(a.dateISO) - new Date(b.dateISO) ||
        new Date(b.created_at) - new Date(a.created_at)
    );

    // Secondary sort: proximity (when location is known)
    if (userLocation) {
      result = result
        .map((e) => ({ ...e, _dist: calculateKmBetween(userLocation, e) }))
        .sort(
          (a, b) =>
            new Date(a.dateISO) - new Date(b.dateISO) || a._dist - b._dist
        )
        .map(({ _dist, ...rest }) => rest);
    }

    return result;
  }, [events, selectedCategory, searchQuery, userLocation]);

  const popularEvents = useMemo(
    () => filteredEvents.slice(0, POPULAR_EVENTS_LIMIT),
    [filteredEvents]
  );

  const upcomingEvents = useMemo(
    () => filteredEvents.slice(0, UPCOMING_EVENTS_LIMIT),
    [filteredEvents]
  );

  /** Events within the selected radius that have valid coordinates */
  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];

    let result = events
      .filter((e) => isValidLatLng(e.lat, e.lng))
      .map((e) => ({ ...e, distanceKm: calculateKmBetween(userLocation, e) }))
      .filter((e) => Number.isFinite(e.distanceKm) && e.distanceKm <= radius);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.place.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [events, userLocation, radius, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────
  const openEventDetail = useCallback(
    (event) => navigate(`/events/${event.id}`, { state: { event } }),
    [navigate]
  );

  const handleCreateClinic = useCallback(() => {
    // Navigate to create clinic page (to be implemented)
    navigate("/massage-clinics/new");
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-24">
      <div className="mx-auto w-full max-w-md">
        {/* ── Sticky Header ────────────────────────────────────── */}
        <PageHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          locationStatus={locationStatus}
          locationLabel={locationLabel}
          onUpdateLocation={requestLocation}
          activeMode={activeTab}
          nearbyCount={nearbyEvents.length}
          radius={radius}
        />

        {/* ── Tab Body ──────────────────────────────────────────── */}
        <div className="px-4 pt-3">
          {/* Global loading/error/empty states */}
          {isLoading ? (
            <LoadingCard />
          ) : error ? (
            <ErrorCard
              error={error}
              onRetry={() => refresh({ foreground: true })}
              onSignIn={() =>
                navigate("/auth/signin/email", { state: { from: "/events" } })
              }
            />
          ) : events.length === 0 && activeTab !== TABS.MASSAGE ? (
            <EmptyCreate onCreate={() => navigate("/events/new")} />
          ) : (
            <>
              {activeTab === TABS.EXPLORE && (
                <ExploreSection
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  popularEvents={popularEvents}
                  upcomingEvents={upcomingEvents}
                  openEventDetail={openEventDetail}
                />
              )}

              {activeTab === TABS.NEAR && (
                <NearYouSection
                  userLocation={userLocation}
                  radius={radius}
                  setRadius={setRadius}
                  viewType={viewType}
                  setViewType={setViewType}
                  events={nearbyEvents}
                  openEventDetail={openEventDetail}
                />
              )}

              {activeTab === TABS.MASSAGE && (
                <MassageClinicSection
                  clinics={clinics}
                  isLoading={clinicsLoading}
                  error={clinicsError}
                  hasFetched={clinicsHasFetched}
                  locationStatus={locationStatus}
                  locationLabel={locationLabel}
                  onRetry={loadClinics}
                  onCreateClinic={handleCreateClinic}
                  onRequestLocation={requestLocation}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Floating Create Button ────────────────────────────── */}
      {activeTab !== TABS.MASSAGE && (
        <Link
          to="/events/new"
          className="fixed bottom-28 right-5 z-20 grid h-14 w-14 place-items-center
            rounded-full bg-violet-600 text-white shadow-lg
            hover:bg-violet-700 active:scale-95 transition-transform"
          title="Create event"
          aria-label="Create new event"
        >
          <i className="lni lni-plus text-xl" />
        </Link>
      )}
    </div>
  );
}

/* ================================================================
   PAGE HEADER
   ================================================================ */

/**
 * PageHeader — sticky top bar with tab navigation, location badge,
 * search input, and contextual status line.
 */
function PageHeader({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  locationStatus,
  locationLabel,
  onUpdateLocation,
  nearbyCount,
  radius,
}) {
  const tabs = [
    { id: TABS.EXPLORE, label: "Explore", icon: "lni-compass" },
    { id: TABS.NEAR,    label: "Near You", icon: "lni-map-marker" },
    { id: TABS.MASSAGE, label: "Massage Clinic", icon: "lni-hand" },
  ];

  const searchPlaceholder = {
    [TABS.EXPLORE]: "Search events…",
    [TABS.NEAR]:    "Search nearby…",
    [TABS.MASSAGE]: "Search clinics…",
  }[activeTab] ?? "Search…";

  const statusLine = {
    [TABS.EXPLORE]: "Discover top picks and upcoming events",
    [TABS.NEAR]:
      locationStatus === "loading"
        ? "Finding your position…"
        : `${nearbyCount} result${nearbyCount !== 1 ? "s" : ""} within ${radius} km`,
    [TABS.MASSAGE]:
      locationStatus === "loading"
        ? "Finding your position…"
        : `Showing massage clinics near ${locationLabel || "you"}`,
  }[activeTab];

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100
      px-4 pt-3 pb-3 shadow-sm">
      {/* ── Top row: tabs + location ─────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        {/* Tab Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <TabPill
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>

        {/* Location Badge */}
        <LocationBadge
          status={locationStatus}
          label={locationLabel}
          onRefresh={onUpdateLocation}
        />
      </div>

      {/* ── Search Row ───────────────────────────────────── */}
      <div className="mt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200
          bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-200
          transition-shadow">
          <i className="lni lni-search-alt text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-gray-800
              placeholder:text-gray-400 focus:outline-none"
            aria-label="Search"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Clear search"
            >
              <i className="lni lni-close" />
            </button>
          )}
          {activeTab !== TABS.MASSAGE && (
            <Link
              to="/events/new"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg
                text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Create event"
              title="Create event"
            >
              <i className="lni lni-plus" />
            </Link>
          )}
        </div>

        {/* Status line */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 px-1">
          <i className="lni lni-navigation text-violet-600" />
          <span>{statusLine}</span>
          {activeTab === TABS.NEAR && locationLabel && (
            <span className="font-medium text-gray-700 ml-0.5">
              · {locationLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tab Pill ──────────────────────────────────────────────────── */
function TabPill({ label, icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
        "text-sm font-medium transition-all duration-150 border",
        isActive
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "bg-white text-gray-600 border-gray-200 hover:bg-violet-50 hover:border-violet-200",
      ].join(" ")}
    >
      <i className={`${icon} text-xs`} />
      {label}
    </button>
  );
}

/* ── Location Badge ────────────────────────────────────────────── */
function LocationBadge({ status, label, onRefresh }) {
  const displayLabel =
    label ||
    {
      loading: "Locating…",
      denied: "Location off",
      unsupported: "Unavailable",
      granted: "Your area",
    }[status] ||
    "Change";

  return (
    <button
      onClick={onRefresh}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border
        border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600
        hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
      title="Update location"
      aria-label="Update location"
    >
      <i className="lni lni-map-marker text-violet-600 text-xs" />
      <span className="max-w-[80px] truncate">{displayLabel}</span>
      <i className="lni lni-reload text-gray-400 text-xs" />
    </button>
  );
}

/* ================================================================
   EXPLORE SECTION
   ================================================================ */

function ExploreSection({
  categories,
  selectedCategory,
  setSelectedCategory,
  popularEvents,
  upcomingEvents,
  openEventDetail,
}) {
  /** Per-category event counts for the filter badges */
  const countsByCategory = useMemo(() => {
    const allEvents = [...new Map(
      [...popularEvents, ...upcomingEvents].map((e) => [e.id, e])
    ).values()];

    const counts = { All: allEvents.length };
    for (const cat of categories.slice(1)) {
      counts[cat] = allEvents.filter((e) => e.category === cat).length;
    }
    return counts;
  }, [categories, popularEvents, upcomingEvents]);

  /** Events shown in carousel after category filter */
  const carouselEvents = useMemo(
    () =>
      selectedCategory === "All"
        ? popularEvents
        : popularEvents.filter((e) => e.category === selectedCategory),
    [popularEvents, selectedCategory]
  );

  return (
    <div className="space-y-1">
      {/* ── Featured Banner ────────────────────────────────── */}
      {popularEvents[0] && (
        <FeaturedEventBanner
          event={popularEvents[0]}
          onClick={() => openEventDetail(popularEvents[0])}
        />
      )}

      {/* ── Popular ────────────────────────────────────────── */}
      <SectionHeader title="Popular Events" className="mt-6" />

      {/* Category filter chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pt-3">
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            count={countsByCategory[cat] ?? 0}
            isActive={selectedCategory === cat}
            onClick={() => setSelectedCategory(cat)}
          />
        ))}
      </div>

      {/* Horizontal event cards */}
      {carouselEvents.length === 0 ? (
        <EmptyState message="No events in this category." />
      ) : (
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 pt-1">
          {carouselEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => openEventDetail(event)}
            />
          ))}
        </div>
      )}

      {/* ── Upcoming ───────────────────────────────────────── */}
      <SectionHeader title="Upcoming Events" className="mt-6" />

      <div className="mt-3 space-y-3 pb-4">
        {upcomingEvents.map((event) => (
          <UpcomingEventRow
            key={event.id}
            event={event}
            onOpen={openEventDetail}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Featured Event Banner ─────────────────────────────────────── */
function FeaturedEventBanner({ event, onClick }) {
  return (
    <div className="mt-4">
      <button
        onClick={onClick}
        className="relative w-full overflow-hidden rounded-3xl shadow-lg
          text-left active:scale-[0.99] transition-transform"
        aria-label={`View featured event: ${event.title}`}
      >
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="h-56 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-56 w-full bg-gradient-to-br from-violet-100 to-purple-200
            grid place-items-center text-violet-400">
            <i className="lni lni-calendar text-5xl" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Featured label */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/90
            px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <i className="lni lni-star-filled text-[10px]" />
            Featured
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="text-lg font-bold leading-tight drop-shadow">
            {event.title}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
            <i className="lni lni-map-marker text-xs" />
            {event.place}
          </div>
        </div>
      </button>
    </div>
  );
}

/* ── Event Card (carousel) ─────────────────────────────────────── */
function EventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-[260px] shrink-0 overflow-hidden rounded-2xl border
        border-gray-200 bg-white text-left shadow-sm
        hover:shadow-md active:scale-[0.99] transition-all"
    >
      {/* Cover image */}
      <div className="relative h-44 bg-gray-100">
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-gray-300">
            <i className="lni lni-image text-4xl" />
          </div>
        )}

        {/* Date pill */}
        <div className="absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1
          text-xs text-white backdrop-blur-sm ring-1 ring-white/10">
          {event.dateLabel}
        </div>

        {/* Category pill */}
        <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5
          py-0.5 text-xs text-gray-800 ring-1 ring-gray-200 backdrop-blur-sm">
          {event.category}
        </div>

        {/* Gradient + title/price */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20
          bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-1">
          <p className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
            {event.title}
          </p>
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5
            text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
            ${event.price}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <i className="lni lni-map-marker text-violet-600 text-[11px]" />
          <span className="truncate">{event.place}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Category Filter Chip ──────────────────────────────────────── */
function CategoryChip({ label, count, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
        "text-sm transition-all duration-150 border",
        isActive
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:bg-violet-50 hover:border-violet-200",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "rounded-full px-1.5 py-px text-[11px] font-medium",
          isActive
            ? "bg-white/25 text-white"
            : "bg-gray-100 text-gray-500",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

/* ================================================================
   NEAR YOU SECTION
   ================================================================ */

function NearYouSection({
  userLocation,
  radius,
  setRadius,
  viewType,
  setViewType,
  events,
  openEventDetail,
}) {
  return (
    <div className="pt-2">
      {/* ── Controls row ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mt-3">
        <RadiusSlider value={radius} onChange={setRadius} />

        {/* List / Map toggle */}
        <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
          {[
            { id: VIEW_TYPES.LIST, icon: "lni-list", label: "List" },
            { id: VIEW_TYPES.MAP,  icon: "lni-map",  label: "Map"  },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewType(v.id)}
              className={[
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm",
                "transition-colors",
                viewType === v.id
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-violet-50",
              ].join(" ")}
            >
              <i className={`${v.icon} text-xs`} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map or List view ─────────────────────────────── */}
      <div className="mt-4">
        {viewType === VIEW_TYPES.MAP ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            {userLocation ? (
              <NearbyEventsMap
                center={userLocation}
                events={events}
                onOpenEvent={openEventDetail}
              />
            ) : (
              <div className="aspect-video grid place-items-center text-sm text-gray-500 bg-gray-50">
                <div className="flex flex-col items-center gap-2">
                  <i className="lni lni-map-marker text-violet-400 text-3xl" />
                  <span>Waiting for location…</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {events.length === 0 ? (
              <EmptyState
                message={`No events found within ${radius} km. Try widening the radius.`}
              />
            ) : (
              events.map((event) => (
                <NearbyEventCard
                  key={event.id}
                  event={event}
                  onClick={() => openEventDetail(event)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Nearby Event Card ─────────────────────────────────────────── */
function NearbyEventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200
        bg-white p-3 text-left shadow-sm hover:shadow-md active:scale-[0.99]
        transition-all"
    >
      {/* Thumbnail */}
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-gray-300">
            <i className="lni lni-image text-2xl" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">
            {event.title}
          </p>
          {Number.isFinite(event.distanceKm) && (
            <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5
              text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
              {formatDistanceLabel(event.distanceKm)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <i className="lni lni-map-marker text-violet-600 text-[11px]" />
          <span className="truncate">{event.place}</span>
        </div>

        <div className="mt-1 flex items-baseline gap-0.5">
          <span className="text-sm font-bold text-violet-700">${event.price}</span>
          <span className="text-[11px] text-gray-400">/person</span>
        </div>
      </div>
    </button>
  );
}

/* ================================================================
   MASSAGE CLINIC SECTION  (new feature)
   ================================================================ */

/**
 * MassageClinicSection — displays massage clinics near the user,
 * with loading, error, empty, and location-denied states.
 */
function MassageClinicSection({
  clinics,
  isLoading,
  error,
  hasFetched,
  locationStatus,
  locationLabel,
  onRetry,
  onCreateClinic,
  onRequestLocation,
}) {
  /* ── Location not yet granted ─────────────────────────────── */
  if (locationStatus === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center justify-center gap-4 py-12">
        <div className="relative h-12 w-12">
          <span className="absolute inline-flex h-full w-full animate-ping
            rounded-full bg-violet-400 opacity-50" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center
            rounded-full bg-violet-600">
            <i className="lni lni-map-marker text-white text-xl" />
          </span>
        </div>
        <p className="text-sm text-gray-600">Finding your location…</p>
      </div>
    );
  }

  if (locationStatus === "denied" || locationStatus === "unsupported") {
    return (
      <ClinicLocationDenied
        onRequestLocation={onRequestLocation}
        onCreateClinic={onCreateClinic}
      />
    );
  }

  /* ── Data loading ─────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <ClinicCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────────── */
  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-red-200
        bg-red-50 p-6 text-center">
        <i className="lni lni-warning text-3xl text-red-400" />
        <p className="mt-2 text-sm font-medium text-red-600">
          Failed to load clinics
        </p>
        <p className="mt-1 text-xs text-red-400">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-600
            px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <i className="lni lni-reload text-xs" />
          Try Again
        </button>
      </div>
    );
  }

  /* ── Empty state (no clinics found) ──────────────────────── */
  if (hasFetched && clinics.length === 0) {
    return (
      <ClinicEmptyState
        locationLabel={locationLabel}
        onCreateClinic={onCreateClinic}
        onRetry={onRetry}
      />
    );
  }

  /* ── Not yet fetched (e.g. tab not visited) ──────────────── */
  if (!hasFetched) {
    return (
      <div className="mt-10 flex justify-center">
        <LoadingCard />
      </div>
    );
  }

  /* ── Clinic list ─────────────────────────────────────────── */
  return (
    <div className="mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Massage Clinics</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {clinics.length} clinic{clinics.length !== 1 ? "s" : ""} near{" "}
            {locationLabel || "you"}
          </p>
        </div>
        <button
          onClick={onCreateClinic}
          className="inline-flex items-center gap-1.5 rounded-full border
            border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium
            text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <i className="lni lni-plus text-xs" />
          Add Clinic
        </button>
      </div>

      <div className="space-y-3 pb-4">
        {clinics.map((clinic) => (
          <ClinicCard key={clinic.id} clinic={clinic} />
        ))}
      </div>
    </div>
  );
}

/* ── Clinic Card ───────────────────────────────────────────────── */
function ClinicCard({ clinic }) {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-gray-200
      bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Avatar / cover */}
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br
        from-violet-100 to-purple-200 grid place-items-center">
        {clinic.cover_url ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <i className="lni lni-hand text-violet-400 text-3xl" />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">
              {clinic.name}
            </p>
            {clinic.distance_km != null && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5
                text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
                {formatDistanceLabel(clinic.distance_km)}
              </span>
            )}
          </div>

          {clinic.address && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <i className="lni lni-map-marker text-violet-600 text-[11px]" />
              <span className="truncate">{clinic.address}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          {clinic.rating != null && (
            <div className="flex items-center gap-0.5 text-xs text-amber-500">
              <i className="lni lni-star-filled text-[11px]" />
              <span className="font-medium">{clinic.rating.toFixed(1)}</span>
            </div>
          )}
          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              className="text-xs text-violet-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="lni lni-phone text-[11px] mr-0.5" />
              Call
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Clinic Empty State ────────────────────────────────────────── */
function ClinicEmptyState({ locationLabel, onCreateClinic, onRetry }) {
  return (
    <div className="mt-6">
      <div className="rounded-3xl border border-dashed border-gray-200
        bg-gradient-to-b from-violet-50/60 to-white p-8 text-center">
        {/* Illustration */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center
          rounded-full bg-white shadow-sm border border-gray-100">
          <i className="lni lni-hand text-violet-400 text-4xl" />
        </div>

        <h3 className="text-base font-bold text-gray-900">
          No Massage Clinics Found
        </h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          We couldn't find any massage clinics near{" "}
          <span className="font-medium text-gray-700">
            {locationLabel || "your location"}
          </span>
          . Be the first to add one!
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <button
            onClick={onCreateClinic}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600
              px-6 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-violet-700 active:scale-95 transition-all"
          >
            <i className="lni lni-plus text-xs" />
            Create Massage Clinic
          </button>

          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full border
              border-gray-200 bg-white px-4 py-2 text-sm text-gray-600
              hover:bg-gray-50 transition-colors"
          >
            <i className="lni lni-reload text-xs" />
            Search Again
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-8 w-8 grid place-items-center rounded-full
            bg-violet-100">
            <i className="lni lni-information text-violet-600 text-sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-900">
              List Your Clinic
            </p>
            <p className="mt-0.5 text-xs text-violet-700 leading-relaxed">
              Create a listing for your massage clinic and reach customers
              near you. It's free to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Clinic Location Denied ────────────────────────────────────── */
function ClinicLocationDenied({ onRequestLocation, onCreateClinic }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-amber-200
      bg-amber-50/60 p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
        rounded-full bg-white shadow-sm border border-amber-100">
        <i className="lni lni-map-marker text-amber-400 text-3xl" />
      </div>

      <h3 className="text-base font-bold text-gray-900">Location Required</h3>
      <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
        We need your location to show nearby massage clinics.
        Please enable location access and try again.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2.5">
        <button
          onClick={onRequestLocation}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600
            px-6 py-2.5 text-sm font-semibold text-white shadow-sm
            hover:bg-violet-700 active:scale-95 transition-all"
        >
          <i className="lni lni-map-marker text-xs" />
          Enable Location
        </button>

        <button
          onClick={onCreateClinic}
          className="text-xs text-violet-600 hover:underline"
        >
          Or create a clinic listing without location →
        </button>
      </div>
    </div>
  );
}

/* ── Clinic Card Skeleton ──────────────────────────────────────── */
function ClinicCardSkeleton() {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-gray-100
      bg-white p-3 animate-pulse">
      <div className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-1/4" />
      </div>
    </div>
  );
}

/* ================================================================
   SHARED / UTILITY COMPONENTS
   ================================================================ */

function SectionHeader({ title, className = "" }) {
  return (
    <h2 className={`text-lg font-bold text-gray-900 ${className}`}>
      {title}
    </h2>
  );
}

function RadiusSlider({ value, onChange }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium text-gray-500 shrink-0">Radius</span>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-32 appearance-none rounded-full bg-gray-200 accent-violet-600"
        aria-label={`Search radius: ${value} km`}
      />
      <span className="text-sm font-semibold text-gray-800 w-12 shrink-0 text-right">
        {value} km
      </span>
    </div>
  );
}

function UpcomingEventRow({ event, onOpen }) {
  return (
    <button
      onClick={() => onOpen(event)}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200
        bg-white p-3 text-left shadow-sm hover:shadow-md active:scale-[0.99]
        transition-all"
    >
      {/* Date box */}
      <div className="grid w-14 shrink-0 place-items-center rounded-xl border
        border-gray-100 bg-gray-50 py-2">
        <div className="text-center leading-tight">
          <div className="text-xl font-bold text-violet-700">{event.day}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            {event.month}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Thumbnail */}
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {event.img ? (
            <img
              src={event.img}
              alt={event.title}
              className="h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-gray-300">
              <i className="lni lni-image text-xl" />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {event.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <i className="lni lni-map-marker text-violet-600 text-[11px]" />
            <span className="truncate">{event.place}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-sm font-bold text-violet-700">
              ${event.price}
            </span>
            <span className="text-[11px] text-gray-400">/person</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyCreate({ onCreate }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-gray-200 p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
        rounded-full bg-gray-50 border border-gray-100">
        <i className="lni lni-calendar text-3xl text-gray-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900">No events yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Create or discover events near you.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600
          px-6 py-2.5 text-sm font-semibold text-white shadow-sm
          hover:bg-violet-700 active:scale-95 transition-all"
      >
        <i className="lni lni-plus text-xs" />
        Create Event
      </button>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50
      p-6 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="grid h-[50vh] place-items-center">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100
        bg-white px-5 py-3.5 shadow-sm">
        <span className="relative inline-block h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping
            rounded-full bg-violet-400 opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
        </span>
        <span className="text-sm font-medium text-gray-600">Loading…</span>
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry, onSignIn }) {
  const errorText =
    error?.message ||
    error?.error ||
    (typeof error === "string" ? error : "An unexpected error occurred");

  const isAuthError =
    /session expired|unauthorized|401/i.test(errorText);

  return (
    <div className="grid h-[50vh] place-items-center text-center px-4">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center
          rounded-full bg-red-50">
          <i className={`text-xl ${isAuthError ? "lni lni-lock text-amber-500" : "lni lni-warning text-red-500"}`} />
        </div>
        <p className={`font-semibold text-sm ${isAuthError ? "text-amber-700" : "text-red-600"}`}>
          {isAuthError ? "Sign in required" : "Failed to load"}
        </p>
        <p className="mt-1 text-xs text-gray-500">{errorText}</p>
        <div className="mt-4 flex justify-center gap-2">
          {isAuthError ? (
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-600
                px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              <i className="lni lni-unlock text-xs" />
              Sign In
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full border
                border-gray-200 bg-white px-4 py-2 text-sm text-gray-700
                hover:bg-gray-50"
            >
              <i className="lni lni-reload text-xs" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAP COMPONENTS
   ================================================================ */

function NearbyEventsMap({ center, events, onOpenEvent }) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height: 340, width: "100%" }}
      className="touch-pan-y"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <RecenterMap position={[center.lat, center.lng]} />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.lat, event.lng]}
          icon={pinIcon}
          eventHandlers={{ click: () => onOpenEvent(event) }}
        >
          <Popup>
            <div className="text-sm min-w-[120px]">
              <p className="font-semibold text-gray-900">{event.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{event.place}</p>
              <p className="mt-1 font-bold text-violet-700">${event.price}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/** Smoothly re-centers the Leaflet map when the center prop changes */
function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, 12, { animate: true });
  }, [position, map]);

  return null;
}