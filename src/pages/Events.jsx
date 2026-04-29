// src/pages/Events.jsx
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

const EARTH_RADIUS_KM          = 6_371;
const GEOCODE_TIMEOUT_MS       = 5_000;
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const GEO_TIMEOUT_MS           = 12_000;
const GEO_MAX_AGE_MS           = 60_000;
const DEFAULT_RADIUS_KM        = 50;
const POPULAR_EVENTS_LIMIT     = 12;
const UPCOMING_EVENTS_LIMIT    = 10;
const STALE_AFTER_HIDDEN_MS    = 30_000; // treat data stale if hidden > 30s

export const TABS = {
  EXPLORE: "explore",
  NEAR:    "near",
};

const VIEW_TYPES = {
  LIST: "list",
  MAP:  "map",
};

const TABS_CONFIG = [
  { id: TABS.EXPLORE, label: "Explore",  icon: CompassIcon },
  { id: TABS.NEAR,    label: "Near You", icon: MapPinIcon  },
];

const SEARCH_PLACEHOLDERS = {
  [TABS.EXPLORE]: "Search events…",
  [TABS.NEAR]:    "Search nearby…",
};

/* ================================================================
   PURE HELPERS
   ================================================================ */

const toRadians = (deg) => (deg * Math.PI) / 180;

function calculateKmBetween(a, b) {
  if (
    !a || !b ||
    a.lat == null || a.lng == null ||
    b.lat == null || b.lng == null
  ) return Infinity;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1_000)} m` : `${km.toFixed(1)} km`;
}

function formatDateLabel(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], {
    day:   "2-digit",
    month: "short",
  });
}

function extractDayMonth(iso) {
  if (!iso) return { day: "--", month: "---" };
  const d = new Date(iso);
  return {
    day:   String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleDateString([], { month: "short" }),
  };
}

const isFiniteNum   = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90  && lat <= 90  &&
  lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

function mapRow(ev) {
  return {
    id:          ev.id,
    title:       ev.title       || "Untitled Event",
    description: ev.description || "",
    img:         ev.cover_url   || "",
    dateISO:     ev.starts_at,
    dateLabel:   formatDateLabel(ev.starts_at),
    ...extractDayMonth(ev.starts_at),
    category:    ev.category    || "Other",
    place:       ev.city        || "Location TBD",
    lat:         ev.lat  != null ? Number(ev.lat)  : null,
    lng:         ev.lng  != null ? Number(ev.lng)  : null,
    price:       ev.price != null ? Number(ev.price) : 0,
    created_at:  ev.created_at,
    attendees:   ev.attendees   || 0,
  };
}

/* ================================================================
   MAP PIN ICON  (module-level singleton — never recreated)
   ================================================================ */

const pinIcon = L.divIcon({
  className:   "",
  iconSize:    [44, 44],
  iconAnchor:  [22, 42],
  popupAnchor: [0, -38],
  html: `
    <div style="
      width:44px;height:44px;border-radius:9999px;
      background:linear-gradient(135deg,#a855f7 0%,#7c3aed 100%);
      display:flex;align-items:center;justify-content:center;
      color:#fff;border:3px solid #fff;
      box-shadow:0 8px 24px rgba(124,58,237,.45);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13
                 c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.9)"/>
        <circle cx="12" cy="9" r="2.5" fill="#7c3aed"/>
      </svg>
    </div>`,
});

/* ================================================================
   useRevalidate
   ─────────────────────────────────────────────────────────────────
   KEY FIXES vs original:
   • All options stored in refs → effect dep array is [] so listeners
     are registered exactly once and never leak.
   • onVis defined inside the effect so it closes over the stable
     `fire` ref-based function (no stale capture).
   • inFlight + pendingRef prevent overlapping fetches.
   • cooldown enforced via elapsed-time check, not a boolean lock.
   ================================================================ */

function useRevalidate({
  refetch,
  intervalMs   = 0,
  onFocus      = true,
  onVisibility = true,
  onOnline     = true,
  cooldownMs   = 2_000,
} = {}) {
  // ── All options in refs so the effect never needs to re-run ─────
  const refetchRef     = useRef(refetch);
  const intervalMsRef  = useRef(intervalMs);
  const onFocusRef     = useRef(onFocus);
  const onVisRef       = useRef(onVisibility);
  const onOnlineRef    = useRef(onOnline);
  const cooldownMsRef  = useRef(cooldownMs);

  useEffect(() => { refetchRef.current    = refetch;      }, [refetch]);
  useEffect(() => { intervalMsRef.current = intervalMs;   }, [intervalMs]);
  useEffect(() => { onFocusRef.current    = onFocus;      }, [onFocus]);
  useEffect(() => { onVisRef.current      = onVisibility; }, [onVisibility]);
  useEffect(() => { onOnlineRef.current   = onOnline;     }, [onOnline]);
  useEffect(() => { cooldownMsRef.current = cooldownMs;   }, [cooldownMs]);

  // ── Internal state in refs ───────────────────────────────────────
  const lastFiredAt  = useRef(0);
  const timerRef     = useRef(null);
  const inFlight     = useRef(false);
  const pendingRef   = useRef(false);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  // ── Stable fire function (never recreated) ───────────────────────
  const fire = useRef(() => {
    const attempt = () => {
      if (!mountedRef.current) return;

      const elapsed = Date.now() - lastFiredAt.current;
      const cd      = cooldownMsRef.current;

      // Still in cooldown — schedule a single retry
      if (elapsed < cd) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(attempt, cd - elapsed);
        return;
      }

      // Another fetch already running — mark as pending
      if (inFlight.current) {
        pendingRef.current = true;
        return;
      }

      inFlight.current    = true;
      lastFiredAt.current = Date.now();

      Promise.resolve()
        .then(() => refetchRef.current?.())
        .catch(() => {})
        .finally(() => {
          if (!mountedRef.current) return;
          inFlight.current = false;
          if (pendingRef.current) {
            pendingRef.current = false;
            attempt();
          }
        });
    };

    attempt();
  }).current; // .current makes this the stable function, not a new ref each render

  // ── Single effect — registers listeners once ─────────────────────
  useEffect(() => {
    // Visibility wrapper defined inside effect so it's stable for
    // removeEventListener matching, but reads fire via the closure
    // which is itself stable (module-level ref pattern above).
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && onVisRef.current) {
        fire();
      }
    };
    const handleFocus  = () => { if (onFocusRef.current)  fire(); };
    const handleOnline = () => { if (onOnlineRef.current) fire(); };

    window.addEventListener("focus",             handleFocus,      { passive: true });
    document.addEventListener("visibilitychange", handleVisibility, { passive: true });
    window.addEventListener("online",            handleOnline,     { passive: true });

    // Interval: we need to be able to clear it, so store in a ref
    // We read intervalMsRef at registration time; if it changes the
    // next mount cycle will pick it up (acceptable — it rarely changes).
    const id = intervalMsRef.current > 0
      ? setInterval(fire, intervalMsRef.current)
      : null;

    return () => {
      window.removeEventListener("focus",             handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online",            handleOnline);
      if (id) clearInterval(id);
      clearTimeout(timerRef.current);
    };
  }, []); // ← intentionally empty: everything via refs
}

/* ================================================================
   useGeolocation
   ─────────────────────────────────────────────────────────────────
   KEY FIXES:
   • reverseGeocode deps are [] — reads mountedRef via closure.
   • requestLocation deps are [] — same pattern.
   • Both functions are therefore stable references forever.
   • Visibility recovery: restart location request when tab re-shows
     and status was previously granted (handles iOS Safari killing
     the geolocation after screen lock).
   ================================================================ */

function useGeolocation() {
  const [userLocation,   setUserLocation]   = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationLabel,  setLocationLabel]  = useState("");

  const mountedRef        = useRef(true);
  const geocodeAbortRef   = useRef(null);
  // Keep latest values accessible in stable callbacks
  const locationStatusRef = useRef("idle");

  const setStatusBoth = useCallback((s) => {
    locationStatusRef.current = s;
    setLocationStatus(s);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      geocodeAbortRef.current?.abort();
    };
  }, []);

  // ── Reverse-geocode: stable, reads via refs ──────────────────────
  const reverseGeocode = useCallback(async ({ lat, lng }) => {
    geocodeAbortRef.current?.abort();
    const ac      = new AbortController();
    geocodeAbortRef.current = ac;
    const timerId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { "Accept-Language": "en" }, signal: ac.signal }
      );
      clearTimeout(timerId);
      if (!mountedRef.current || ac.signal.aborted) return;

      const data = await res.json().catch(() => ({}));
      const city =
        data?.address?.city    ||
        data?.address?.town    ||
        data?.address?.village ||
        data?.address?.county  ||
        data?.address?.state   || "";

      if (mountedRef.current) setLocationLabel(city || "Your area");
    } catch {
      clearTimeout(timerId);
      // Silently ignore abort / network errors
    }
  }, []); // [] — reads mountedRef and geocodeAbortRef via closure

  // ── Request location: stable ─────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatusBoth("unsupported");
      return;
    }

    setStatusBoth("loading");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mountedRef.current) return;
        const pos = {
          lat: Number(coords.latitude),
          lng: Number(coords.longitude),
        };
        if (!isValidLatLng(pos.lat, pos.lng)) {
          setStatusBoth("denied");
          return;
        }
        setUserLocation(pos);
        setStatusBoth("granted");
        reverseGeocode(pos);
      },
      () => {
        if (mountedRef.current) setStatusBoth("denied");
      },
      {
        enableHighAccuracy: true,
        timeout:    GEO_TIMEOUT_MS,
        maximumAge: GEO_MAX_AGE_MS,
      }
    );
  }, []); // [] — reads everything via refs/closure

  // ── Visibility recovery ──────────────────────────────────────────
  // Re-request location when the tab comes back into view IF we had
  // previously been granted (avoids re-asking if user never allowed).
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        locationStatusRef.current === "granted"
      ) {
        requestLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []); // [] — reads via refs

  return {
    userLocation,
    locationStatus,
    locationLabel,
    requestLocation,
  };
}

/* ================================================================
   useEvents
   ─────────────────────────────────────────────────────────────────
   KEY FIXES:
   • hasDataRef updated before setEvents so the flag is correct even
     if React batches the state update.
   • foreground flag stored in ref to avoid closure staleness when
     called from useRevalidate.
   • Explicit AbortError name check AND signal.aborted guard.
   ================================================================ */

function useEvents() {
  const [events,    setEvents]    = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState("");

  const mountedRef    = useRef(true);
  const abortRef      = useRef(null);
  const generationRef = useRef(0);
  const hasDataRef    = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async ({ foreground = false } = {}) => {
    // Cancel previous in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Bump generation — any in-flight older request will self-discard
    const myGen = ++generationRef.current;

    // Show spinner only on foreground fetch when we have no data yet
    if (foreground && !hasDataRef.current) {
      if (mountedRef.current) setIsLoading(true);
    }

    try {
      const rows = await eventsService.list({ signal: ac.signal });

      if (!mountedRef.current)                  return;
      if (generationRef.current !== myGen)       return;
      if (ac.signal.aborted)                     return;

      // Update flag BEFORE setState to avoid race with concurrent calls
      hasDataRef.current = true;
      setEvents((rows ?? []).map(mapRow));
      setError("");
    } catch (err) {
      if (!mountedRef.current)            return;
      if (generationRef.current !== myGen) return;
      if (err?.name === "AbortError" || ac.signal.aborted) return;

      const status = err?.status || err?.response?.status;
      if (status === 401 || /session expired/i.test(err?.message ?? "")) {
        setError("Session expired. Please sign in again.");
        return;
      }

      setError(
        err?.message              ||
        err?.error                ||
        err?.response?.data?.message ||
        "Failed to load events"
      );
    } finally {
      // Only touch loading state for the most-recent generation
      if (mountedRef.current && generationRef.current === myGen) {
        setIsLoading(false);
      }
    }
  }, []); // [] — reads everything via refs; truly stable

  return { events, setEvents, isLoading, error, refresh };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab,        setActiveTab]       = useState(TABS.EXPLORE);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [radius,           setRadius]           = useState(DEFAULT_RADIUS_KM);
  const [viewType,         setViewType]         = useState(VIEW_TYPES.LIST);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const {
    userLocation,
    locationStatus,
    locationLabel,
    requestLocation,
  } = useGeolocation();

  const { events, setEvents, isLoading, error, refresh } = useEvents();

  // ── Ref mirrors for use in stable callbacks ──────────────────────
  const hiddenAtRef = useRef(null);

  // ── Bootstrap: runs once on mount ───────────────────────────────
  useEffect(() => {
    refresh({ foreground: true });
    requestLocation();
  }, []); // stable refs — safe to omit from deps

  // ── Inject newly-created event from nav state ────────────────────
  useEffect(() => {
    const created = location.state?.created;
    if (!created) return;
    setEvents((prev) =>
      prev.some((e) => e.id === created.id)
        ? prev
        : [mapRow(created), ...prev]
    );
    navigate("/events", { replace: true, state: null });
  }, [location.state, navigate, setEvents]);

  // ── Background revalidation ──────────────────────────────────────
  // Visibility/focus/online handlers live inside useRevalidate.
  // We add a SEPARATE visibility effect here for the "hidden > 30s"
  // stale-data pattern (foreground refresh, not just silent).
  useRevalidate({
    refetch:     useCallback(() => refresh({ foreground: false }), [refresh]),
    intervalMs:  AUTO_REFRESH_INTERVAL_MS,
    cooldownMs:  2_000,
    // Disable built-in visibility handler — we handle it below
    // with the stale-threshold logic instead.
    onVisibility: false,
  });

  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      }
    };
    const handleShow = () => {
      if (document.visibilityState !== "visible") return;
      const hiddenMs = hiddenAtRef.current
        ? Date.now() - hiddenAtRef.current
        : 0;
      hiddenAtRef.current = null;

      if (hiddenMs >= STALE_AFTER_HIDDEN_MS) {
        // Foreground refresh so user sees spinner if no cached data
        refresh({ foreground: false });
      }
    };

    document.addEventListener("visibilitychange", handleHide,  { passive: true });
    document.addEventListener("visibilitychange", handleShow, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      document.removeEventListener("visibilitychange", handleShow);
    };
  }, [refresh]); // refresh is stable ([] deps in useEvents)

  // ── Derived data ─────────────────────────────────────────────────

  const categories = useMemo(() => {
    const set = new Set(events.map((e) => e.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = events.slice();

    if (selectedCategory !== "All")
      result = result.filter((e) => e.category === selectedCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.place.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      const dateDiff = new Date(a.dateISO) - new Date(b.dateISO);
      if (dateDiff !== 0) return dateDiff;
      if (userLocation) {
        const dA = calculateKmBetween(userLocation, a);
        const dB = calculateKmBetween(userLocation, b);
        if (Number.isFinite(dA) && Number.isFinite(dB) && dA !== dB)
          return dA - dB;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [events, selectedCategory, searchQuery, userLocation]);

  const popularEvents = useMemo(
    () => filteredEvents.slice(0, POPULAR_EVENTS_LIMIT),
    [filteredEvents]
  );
  const upcomingEvents = useMemo(
    () => filteredEvents.slice(0, UPCOMING_EVENTS_LIMIT),
    [filteredEvents]
  );

  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];

    let result = events
      .filter((e) => isValidLatLng(e.lat, e.lng))
      .map((e) => ({
        ...e,
        distanceKm: calculateKmBetween(userLocation, e),
      }))
      .filter(
        (e) => Number.isFinite(e.distanceKm) && e.distanceKm <= radius
      );

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

  const openEventDetail = useCallback(
    (event) => navigate(`/events/${event.id}`, { state: { event } }),
    [navigate]
  );

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 pb-28">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          locationStatus={locationStatus}
          locationLabel={locationLabel}
          onUpdateLocation={requestLocation}
          nearbyCount={nearbyEvents.length}
          radius={radius}
        />

        <div className="px-4 pt-4">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState
              error={error}
              onRetry={() => refresh({ foreground: true })}
              onSignIn={() =>
                navigate("/auth/signin/email", { state: { from: "/events" } })
              }
            />
          ) : events.length === 0 ? (
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
                  locationStatus={locationStatus}
                  radius={radius}
                  setRadius={setRadius}
                  viewType={viewType}
                  setViewType={setViewType}
                  events={nearbyEvents}
                  openEventDetail={openEventDetail}
                  onRequestLocation={requestLocation}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB */}
      <Link
        to="/events/new"
        className="fixed bottom-28 right-4 z-20 flex h-14 w-14 items-center
          justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700
          text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:scale-105
          active:scale-95 transition-all duration-200"
        aria-label="Create new event"
      >
        <PlusIcon className="h-6 w-6" />
      </Link>
    </div>
  );
}

/* ================================================================
   PAGE HEADER
   ================================================================ */

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
  const statusLine = useMemo(() => {
    if (activeTab !== TABS.NEAR) return null;
    if (locationStatus === "loading")
      return { text: "Finding your position…", icon: "pulse" };
    if (locationStatus === "denied")
      return { text: "Location access denied", icon: "warn" };
    return {
      text: `${nearbyCount} event${nearbyCount !== 1 ? "s" : ""} within ${radius} km`,
      icon: "ok",
    };
  }, [activeTab, locationStatus, nearbyCount, radius]);

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
      {/* Brand row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Events</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeTab === TABS.EXPLORE
              ? "Discover what's happening"
              : "Find events near you"}
          </p>
        </div>
        <LocationBadge
          status={locationStatus}
          label={locationLabel}
          onRefresh={onUpdateLocation}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3">
        {TABS_CONFIG.map((tab) => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={[
                "flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5",
                "text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              <Icon
                className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-500"}`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div
          className="flex items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3
            focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-300
            focus-within:shadow-sm transition-all duration-200"
        >
          <SearchIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[activeTab] ?? "Search…"}
            className="flex-1 bg-transparent text-sm text-gray-800
              placeholder:text-gray-400 focus:outline-none"
            aria-label="Search events"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange("")}
              className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5
                rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Clear search"
            >
              <XSmallIcon className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/events/new"
              className="shrink-0 flex h-7 w-7 items-center justify-center
                rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200
                transition-colors"
              aria-label="Create event"
            >
              <PlusIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Status line */}
        {statusLine && (
          <div className="mt-2 flex items-center gap-1.5 px-1">
            {statusLine.icon === "pulse" && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping
                  rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
            )}
            {statusLine.icon === "ok" && (
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
            )}
            {statusLine.icon === "warn" && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            )}
            <span className="text-xs text-gray-500">{statusLine.text}</span>
            {locationLabel &&
              activeTab === TABS.NEAR &&
              locationStatus === "granted" && (
                <span className="text-xs font-medium text-gray-700">
                  · {locationLabel}
                </span>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationBadge({ status, label, onRefresh }) {
  const display =
    label ||
    { loading: "Locating…", denied: "Location off", unsupported: "N/A" }[status] ||
    "Set location";

  return (
    <button
      onClick={onRefresh}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200
        bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600
        hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700
        transition-all duration-150 max-w-[140px]"
      aria-label="Update location"
    >
      <MapPinIcon className="h-3.5 w-3.5 text-violet-500 shrink-0" />
      <span className="truncate">{display}</span>
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
  const allUniqueEvents = useMemo(
    () => [
      ...new Map(
        [...popularEvents, ...upcomingEvents].map((e) => [e.id, e])
      ).values(),
    ],
    [popularEvents, upcomingEvents]
  );

  const countsByCategory = useMemo(() => {
    const counts = { All: allUniqueEvents.length };
    for (const cat of categories.slice(1))
      counts[cat] = allUniqueEvents.filter((e) => e.category === cat).length;
    return counts;
  }, [categories, allUniqueEvents]);

  const carouselEvents = useMemo(
    () =>
      selectedCategory === "All"
        ? popularEvents
        : popularEvents.filter((e) => e.category === selectedCategory),
    [popularEvents, selectedCategory]
  );

  return (
    <div className="space-y-6 pb-4">
      {popularEvents[0] && (
        <FeaturedEventBanner
          event={popularEvents[0]}
          onClick={() => openEventDetail(popularEvents[0])}
        />
      )}

      <div>
        <SectionHeader title="🔥 Popular Events" subtitle="Top picks right now" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
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

        {carouselEvents.length === 0 ? (
          <EmptyState message="No events in this category." className="mt-3" />
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-3">
            {carouselEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => openEventDetail(event)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader title="📅 Upcoming Events" subtitle="Don't miss out" />
        <div className="mt-3 space-y-3">
          {upcomingEvents.map((event) => (
            <UpcomingEventRow
              key={event.id}
              event={event}
              onOpen={openEventDetail}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   NEAR YOU SECTION
   ================================================================ */

function NearYouSection({
  userLocation,
  locationStatus,
  radius,
  setRadius,
  viewType,
  setViewType,
  events,
  openEventDetail,
  onRequestLocation,
}) {
  if (locationStatus === "idle" || locationStatus === "denied") {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-violet-200
        bg-violet-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
          rounded-full bg-violet-100">
          <MapPinIcon className="h-8 w-8 text-violet-500" />
        </div>
        <h3 className="text-base font-bold text-gray-900">
          {locationStatus === "denied" ? "Location access denied" : "Enable location"}
        </h3>
        <p className="mt-1.5 text-sm text-gray-500">
          {locationStatus === "denied"
            ? "Update your browser settings to allow location, then try again."
            : "Allow location access to find events near you."}
        </p>
        {locationStatus !== "denied" && (
          <button
            onClick={onRequestLocation}
            className="mt-5 inline-flex items-center gap-2 rounded-full
              bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white
              shadow-sm hover:bg-violet-700 active:scale-95 transition-all"
          >
            <MapPinIcon className="h-4 w-4" />
            Allow Location
          </button>
        )}
      </div>
    );
  }

  if (locationStatus === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-full
            bg-violet-300 opacity-60" />
          <span className="relative flex h-12 w-12 items-center justify-center
            rounded-full bg-violet-100">
            <MapPinIcon className="h-6 w-6 text-violet-600" />
          </span>
        </div>
        <p className="text-sm text-gray-500">Finding your location…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl
        bg-white border border-gray-100 px-4 py-3 shadow-sm">
        <RadiusSlider value={radius} onChange={setRadius} />
        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
          {[
            { id: VIEW_TYPES.LIST, Icon: ListIcon,    label: "List" },
            { id: VIEW_TYPES.MAP,  Icon: MapViewIcon, label: "Map"  },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setViewType(id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5",
                "text-xs font-semibold transition-all",
                viewType === id
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewType === VIEW_TYPES.MAP ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          {userLocation ? (
            <NearbyEventsMap
              center={userLocation}
              events={events}
              onOpenEvent={openEventDetail}
            />
          ) : (
            <div className="aspect-video grid place-items-center bg-gray-50">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <MapViewIcon className="h-8 w-8" />
                <span className="text-sm">Waiting for location…</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
  );
}

/* ================================================================
   CARD COMPONENTS  (unchanged — no bugs found)
   ================================================================ */

function FeaturedEventBanner({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-3xl shadow-xl text-left
        active:scale-[0.99] transition-transform duration-150 block"
      aria-label={`View featured event: ${event.title}`}
    >
      {event.img ? (
        <img
          src={event.img}
          alt={event.title}
          className="h-52 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-52 w-full bg-gradient-to-br from-violet-400 to-purple-600
          grid place-items-center">
          <CalendarIcon className="h-16 w-16 text-white/50" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute top-3 left-3">
        <span className="inline-flex items-center gap-1 rounded-full
          bg-white/20 backdrop-blur-md border border-white/30
          px-3 py-1 text-xs font-bold text-white">
          ✨ Featured
        </span>
      </div>
      <div className="absolute top-3 right-3">
        <span className="rounded-full bg-violet-600/90 backdrop-blur-sm
          px-2.5 py-1 text-xs font-semibold text-white">
          {event.category}
        </span>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4">
        <p className="text-lg font-bold text-white leading-tight drop-shadow">
          {event.title}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-white/80">
            <MapPinIcon className="h-3.5 w-3.5" />
            <span className="truncate max-w-[180px]">{event.place}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white/70">{event.dateLabel}</span>
            <span className="rounded-full bg-white/20 backdrop-blur-sm
              px-2.5 py-0.5 text-sm font-bold text-white">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-[220px] shrink-0 overflow-hidden rounded-2xl bg-white
        border border-gray-100 text-left shadow-sm
        hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]
        transition-all duration-200"
    >
      <div className="relative h-36 bg-gray-100 overflow-hidden">
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="h-full w-full object-cover group-hover:scale-105
              transition-transform duration-300"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br
            from-violet-100 to-purple-100">
            <CalendarIcon className="h-10 w-10 text-violet-300" />
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-lg bg-black/60 backdrop-blur-sm
          px-2 py-1 text-xs text-white font-medium">
          {event.dateLabel}
        </div>
        <div className="absolute right-2 top-2 rounded-full bg-white/95
          px-2 py-0.5 text-xs font-bold text-violet-700 shadow-sm">
          {event.price === 0 ? "Free" : `$${event.price}`}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16
          bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute inset-x-2.5 bottom-2">
          <p className="truncate text-sm font-bold text-white drop-shadow">
            {event.title}
          </p>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPinIcon className="h-3 w-3 text-violet-500 shrink-0" />
          <span className="truncate">{event.place}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          <span>{event.category}</span>
        </div>
      </div>
    </button>
  );
}

function NearbyEventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl bg-white
        border border-gray-100 p-3 text-left shadow-sm
        hover:shadow-md hover:border-violet-100 active:scale-[0.99]
        transition-all duration-200"
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br
            from-violet-50 to-purple-100">
            <CalendarIcon className="h-7 w-7 text-violet-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-bold text-gray-900">{event.title}</p>
            {Number.isFinite(event.distanceKm) && (
              <span className="shrink-0 rounded-full bg-violet-50 border border-violet-100
                px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                {formatDistanceLabel(event.distanceKm)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <MapPinIcon className="h-3 w-3 text-violet-400 shrink-0" />
            <span className="truncate">{event.place}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-bold text-violet-700">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </span>
            {event.price > 0 && (
              <span className="text-[11px] text-gray-400">/person</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{event.dateLabel}</span>
        </div>
      </div>
    </button>
  );
}

function UpcomingEventRow({ event, onOpen }) {
  return (
    <button
      onClick={() => onOpen(event)}
      className="flex w-full items-stretch gap-3 rounded-2xl bg-white
        border border-gray-100 p-3 text-left shadow-sm
        hover:shadow-md hover:border-violet-100 active:scale-[0.99]
        transition-all duration-200"
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center
        rounded-xl bg-gradient-to-b from-violet-50 to-violet-100/60
        border border-violet-100 py-2">
        <div className="text-xl font-extrabold text-violet-700 leading-none">
          {event.day}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-violet-400 mt-0.5">
          {event.month}
        </div>
      </div>
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
          <div className="grid h-full w-full place-items-center bg-gradient-to-br
            from-violet-50 to-purple-100">
            <CalendarIcon className="h-6 w-6 text-violet-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <p className="truncate text-sm font-bold text-gray-900">{event.title}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPinIcon className="h-3 w-3 text-violet-400 shrink-0" />
            <span className="truncate">{event.place}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-bold text-violet-700">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </span>
            {event.price > 0 && (
              <span className="text-[11px] text-gray-400">/person</span>
            )}
          </div>
          <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5
            text-[11px] text-gray-500">
            {event.category}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ================================================================
   SHARED UI
   ================================================================ */

function SectionHeader({ title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function CategoryChip({ label, count, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
        "text-xs font-semibold transition-all duration-150 border whitespace-nowrap",
        isActive
          ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200"
          : "bg-white text-gray-600 border-gray-200 hover:border-violet-200 hover:bg-violet-50",
      ].join(" ")}
    >
      {label}
      <span className={[
        "rounded-full px-1.5 py-px text-[10px] font-bold",
        isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500",
      ].join(" ")}>
        {count}
      </span>
    </button>
  );
}

function RadiusSlider({ value, onChange }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 min-w-0">
      <span className="text-xs font-semibold text-gray-500 shrink-0">Radius</span>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full bg-gray-200
          accent-violet-600 cursor-pointer min-w-0"
        aria-label={`Search radius: ${value} km`}
      />
      <span className="text-sm font-bold text-violet-700 shrink-0 w-10 text-right">
        {value}km
      </span>
    </div>
  );
}

function EmptyCreate({ onCreate }) {
  return (
    <div className="mt-8 rounded-3xl border-2 border-dashed border-gray-200
      bg-white p-10 text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center
        rounded-full bg-gradient-to-br from-violet-50 to-purple-100">
        <CalendarIcon className="h-10 w-10 text-violet-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">No events yet</h3>
      <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
        Be the first to create an event and connect with people around you.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-full
          bg-gradient-to-r from-violet-600 to-purple-600
          px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200
          hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <PlusIcon className="h-4 w-4" />
        Create Event
      </button>
    </div>
  );
}

function EmptyState({ message, className = "" }) {
  return (
    <div className={`rounded-2xl border border-dashed border-gray-200
      bg-white p-6 text-center text-sm text-gray-500 ${className}`}>
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 pt-2">
      <div className="h-52 w-full animate-pulse rounded-3xl bg-gray-200" />
      <div className="flex gap-4 overflow-hidden">
        {[1, 2].map((i) => (
          <div key={i} className="w-[220px] shrink-0 rounded-2xl animate-pulse">
            <div className="h-36 w-full rounded-2xl bg-gray-200" />
            <div className="mt-2 space-y-2 px-1">
              <div className="h-3 w-3/4 rounded-full bg-gray-200" />
              <div className="h-3 w-1/2 rounded-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-2xl bg-white p-3 animate-pulse">
          <div className="h-16 w-20 shrink-0 rounded-xl bg-gray-200" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3.5 w-3/4 rounded-full bg-gray-200" />
            <div className="h-3 w-1/2 rounded-full bg-gray-200" />
            <div className="h-3 w-1/4 rounded-full bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry, onSignIn }) {
  const text =
    error?.message ||
    error?.error   ||
    (typeof error === "string" ? error : "An unexpected error occurred");
  const isAuth = /session expired|unauthorized|401/i.test(text);

  return (
    <div className="mt-10 rounded-3xl bg-white border border-gray-100
      shadow-sm p-8 text-center">
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center
        rounded-full ${isAuth ? "bg-amber-50" : "bg-red-50"}`}>
        {isAuth
          ? <LockIcon className="h-8 w-8 text-amber-500" />
          : <WarningIcon className="h-8 w-8 text-red-400" />}
      </div>
      <h3 className={`text-base font-bold ${isAuth ? "text-amber-700" : "text-red-600"}`}>
        {isAuth ? "Sign in required" : "Failed to load events"}
      </h3>
      <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">{text}</p>
      <div className="mt-5 flex justify-center gap-2">
        {isAuth ? (
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600
              px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700
              transition-colors"
          >
            Sign In
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border
              border-gray-200 bg-white px-5 py-2.5 text-sm font-medium
              text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   MAP COMPONENTS
   ================================================================ */

function NearbyEventsMap({ center, events, onOpenEvent }) {
  const position = useMemo(
    () => [center.lat, center.lng],
    [center.lat, center.lng]
  );

  return (
    <MapContainer
      center={position}
      zoom={12}
      style={{ height: 380, width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <RecenterMap position={position} />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.lat, event.lng]}
          icon={pinIcon}
          eventHandlers={{ click: () => onOpenEvent(event) }}
        >
          <Popup>
            <div className="min-w-[140px] text-sm">
              <p className="font-bold text-gray-900">{event.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{event.place}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-bold text-violet-700">
                  {event.price === 0 ? "Free" : `$${event.price}`}
                </span>
                {Number.isFinite(event.distanceKm) && (
                  <span className="text-xs text-gray-400">
                    {formatDistanceLabel(event.distanceKm)}
                  </span>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function RecenterMap({ position }) {
  const map     = useMap();
  const prevRef = useRef(null);

  useEffect(() => {
    const [lat, lng] = position;
    const prev       = prevRef.current;
    if (prev && prev[0] === lat && prev[1] === lng) return;
    prevRef.current = position;
    map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);

  return null;
}

/* ================================================================
   SVG ICONS  (unchanged)
   ================================================================ */

function CompassIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
        fill="currentColor" />
    </svg>
  );
}

function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function XSmallIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8"  y1="2" x2="8"  y2="6" strokeLinecap="round" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ListIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2}>
      <line x1="8"  y1="6"  x2="21" y2="6"  strokeLinecap="round" />
      <line x1="8"  y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="8"  y1="18" x2="21" y2="18" strokeLinecap="round" />
      <circle cx="3" cy="6"  r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function MapViewIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"
        strokeLinejoin="round" />
      <line x1="8"  y1="2"  x2="8"  y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2
           2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}