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

const EARTH_RADIUS_KM            = 6_371;
const GEOCODE_TIMEOUT_MS         = 5_000;
const AUTO_REFRESH_INTERVAL_MS   = 60_000;
const GEO_TIMEOUT_MS             = 12_000;
const GEO_MAX_AGE_MS             = 60_000;
const DEFAULT_RADIUS_KM          = 50;
const POPULAR_EVENTS_LIMIT       = 12;
const UPCOMING_EVENTS_LIMIT      = 10;

export const TABS = {
  EXPLORE : "explore",
  NEAR    : "near",
  MASSAGE : "massage",   // kept so the bottom-tab nav can reference it
};

const VIEW_TYPES = {
  LIST : "list",
  MAP  : "map",
};

// ── Header config (module-level — never recreated) ──────────────────────────

const TABS_CONFIG = [
  { id: TABS.EXPLORE, label: "Explore",   icon: "lni-compass"    },
  { id: TABS.NEAR,    label: "Near You",  icon: "lni-map-marker" },
];

const SEARCH_PLACEHOLDERS = {
  [TABS.EXPLORE] : "Search events…",
  [TABS.NEAR]    : "Search nearby…",
};

/* ================================================================
   PURE HELPERS  (module-level — never recreated on render)
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
    day: "2-digit", month: "short",
  });
}

function extractDayMonth(iso) {
  if (!iso) return { day: "--", month: "---" };
  const d = new Date(iso);
  return {
    day  : String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleDateString([], { month: "short" }),
  };
}

const isFiniteNum = (n) => Number.isFinite(Number(n));

const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) &&
  isFiniteNum(lng) &&
  lat >= -90  && lat <= 90 &&
  lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/** Normalise a raw API row into the UI shape. */
function mapRow(ev) {
  return {
    id         : ev.id,
    title      : ev.title       || "Untitled Event",
    description: ev.description || "",
    img        : ev.cover_url   || "",
    dateISO    : ev.starts_at,
    dateLabel  : formatDateLabel(ev.starts_at),
    ...extractDayMonth(ev.starts_at),
    category   : ev.category    || "Other",
    place      : ev.city        || "Location TBD",
    lat        : ev.lat  != null ? Number(ev.lat)  : null,
    lng        : ev.lng  != null ? Number(ev.lng)  : null,
    price      : ev.price != null ? Number(ev.price) : 0,
    created_at : ev.created_at,
  };
}

/* ================================================================
   MAP PIN ICON  (created once)
   ================================================================ */

const pinIcon = L.divIcon({
  className  : "",
  iconSize   : [40, 40],
  iconAnchor : [20, 38],
  popupAnchor: [0, -34],
  html: `
    <div style="
      width:40px;height:40px;border-radius:9999px;
      background:linear-gradient(135deg,#f0abfc 0%,#7c3aed 100%);
      display:flex;align-items:center;justify-content:center;
      color:#fff;border:2px solid #fff;
      box-shadow:0 10px 24px rgba(124,58,237,.35);
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 21s-7-4.35-7-10a7 7 0 1114 0c0 5.65-7 10-7 10z"
          fill="rgba(255,255,255,0.25)"/>
        <circle cx="12" cy="10" r="3" fill="#fff"/>
      </svg>
    </div>`,
});

/* ================================================================
   useRevalidate
   ================================================================ */

function useRevalidate({
  refetch,
  intervalMs    = 0,
  onFocus       = true,
  onVisibility  = true,
  onOnline      = true,
  cooldownMs    = 2_000,
} = {}) {
  // Always up-to-date without being a dep
  const refetchRef   = useRef(refetch);
  refetchRef.current = refetch;

  const lastFiredAt = useRef(0);
  const timerRef    = useRef(null);
  const inFlight    = useRef(false);
  const pending     = useRef(false);

  // `fire` never changes — cooldownMs is a constant here
  const fire = useCallback(() => {
    const attempt = () => {
      const elapsed = Date.now() - lastFiredAt.current;

      if (elapsed < cooldownMs) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(attempt, cooldownMs - elapsed);
        return;
      }

      if (inFlight.current) { pending.current = true; return; }

      inFlight.current  = true;
      lastFiredAt.current = Date.now();

      Promise.resolve(refetchRef.current?.())
        .catch(() => {})
        .finally(() => {
          inFlight.current = false;
          if (pending.current) { pending.current = false; attempt(); }
        });
    };
    attempt();
  }, [cooldownMs]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") fire(); };

    if (onFocus)      window.addEventListener("focus",            fire,  { passive: true });
    if (onVisibility) document.addEventListener("visibilitychange", onVis, { passive: true });
    if (onOnline)     window.addEventListener("online",           fire,  { passive: true });

    const id = intervalMs > 0 ? setInterval(fire, intervalMs) : null;

    return () => {
      if (onFocus)      window.removeEventListener("focus",            fire);
      if (onVisibility) document.removeEventListener("visibilitychange", onVis);
      if (onOnline)     window.removeEventListener("online",           fire);
      if (id)           clearInterval(id);
      clearTimeout(timerRef.current);
    };
  }, [fire, intervalMs, onFocus, onOnline, onVisibility]);
}

/* ================================================================
   useGeolocation
   ================================================================ */

function useGeolocation() {
  const [userLocation,  setUserLocation]  = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationLabel,  setLocationLabel]  = useState("");

  const mountedRef     = useRef(true);
  const geocodeAbortRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      geocodeAbortRef.current?.abort();
    };
  }, []);

  const reverseGeocode = useCallback(async ({ lat, lng }) => {
    geocodeAbortRef.current?.abort();
    const ac = new AbortController();
    geocodeAbortRef.current = ac;

    // Use a flag rather than clearTimeout-in-catch to avoid acting on a
    // timer that already fired (the AbortError path).
    let timedOut = false;
    const timerId = setTimeout(() => { timedOut = true; ac.abort(); }, GEOCODE_TIMEOUT_MS);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { "Accept-Language": "en" }, signal: ac.signal }
      );
      clearTimeout(timerId);
      if (!mountedRef.current || ac.signal.aborted) return;

      const data = await res.json().catch(() => ({}));
      const city  =
        data?.address?.city    ||
        data?.address?.town    ||
        data?.address?.village ||
        data?.address?.county  ||
        data?.address?.state   ||
        "";

      if (mountedRef.current) setLocationLabel(city || "Your area");
    } catch {
      if (!timedOut) clearTimeout(timerId);
      // Silent fail — keep previous label
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = {
          lat: Number(coords.latitude),
          lng: Number(coords.longitude),
        };
        if (!isValidLatLng(pos.lat, pos.lng)) {
          setLocationStatus("denied");
          return;
        }
        if (mountedRef.current) {
          setUserLocation(pos);
          setLocationStatus("granted");
          reverseGeocode(pos);
        }
      },
      () => { if (mountedRef.current) setLocationStatus("denied"); },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  }, [reverseGeocode]);

  return { userLocation, locationStatus, locationLabel, requestLocation };
}

/* ================================================================
   useEvents
   ================================================================ */

function useEvents() {
  const [events,    setEvents]    = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState("");

  const mountedRef    = useRef(true);
  const abortRef      = useRef(null);
  const requestGenRef = useRef(0);
  const hasDataRef    = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async ({ foreground = false } = {}) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    requestGenRef.current += 1;
    const myGen = requestGenRef.current;

    if (foreground && !hasDataRef.current) {
      setIsLoading(true);
    }

    try {
      const rows = await eventsService.list({ signal: ac.signal });

      if (!mountedRef.current || requestGenRef.current !== myGen) return;

      hasDataRef.current = true;
      setEvents((rows ?? []).map(mapRow));
      setError("");
    } catch (err) {
      if (!mountedRef.current || requestGenRef.current !== myGen) return;
      if (err?.name === "AbortError") return;

      const status = err?.status || err?.response?.status;
      if (status === 401 || /session expired/i.test(err?.message ?? "")) {
        setError("Session expired. Please sign in again.");
        return;
      }
      setError(
        err?.message ||
        err?.error   ||
        err?.response?.data?.message ||
        "Failed to load events"
      );
    } finally {
      // ✅ ALWAYS clear loading for this generation — prevents stuck spinner
      if (mountedRef.current && requestGenRef.current === myGen) {
        setIsLoading(false);
      }
    }
  }, []); // Stable — no events.length dep

  return { events, setEvents, isLoading, error, refresh };
}

/* ================================================================
   MAIN PAGE  (Events only — Massage Clinic is its own page)
   ================================================================ */

export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState(TABS.EXPLORE);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [radius,            setRadius]            = useState(DEFAULT_RADIUS_KM);
  const [viewType,          setViewType]          = useState(VIEW_TYPES.LIST);
  const [selectedCategory,  setSelectedCategory]  = useState("All");

  // ── Data ─────────────────────────────────────────────────────────────────
  const { userLocation, locationStatus, locationLabel, requestLocation } =
    useGeolocation();

  const { events, setEvents, isLoading, error, refresh } = useEvents();

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => { refresh({ foreground: true }); }, []); // eslint-disable-line
  useEffect(() => { requestLocation();              }, []); // eslint-disable-line

  // Handle newly created event injected via navigation state
  useEffect(() => {
    const created = location.state?.created;
    if (!created) return;
    setEvents((prev) =>
      prev.some((e) => e.id === created.id) ? prev : [mapRow(created), ...prev]
    );
    navigate("/events", { replace: true, state: null });
  }, [location.state, navigate, setEvents]);

  // Background revalidation
  useRevalidate({
    refetch    : () => refresh({ foreground: false }),
    intervalMs : AUTO_REFRESH_INTERVAL_MS,
    onFocus    : true,
    onVisibility: true,
    onOnline   : true,
    cooldownMs : 2_000,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
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

    // Single stable sort: by date ASC, then by distance ASC (if available),
    // then by created_at DESC as a tiebreaker
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openEventDetail = useCallback(
    (event) => navigate(`/events/${event.id}`, { state: { event } }),
    [navigate]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-24">
      <div className="mx-auto w-full max-w-md">

        <PageHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          locationStatus={locationStatus}
          locationLabel={locationLabel}
          onUpdateLocation={requestLocation}
          nearbyCount={nearbyEvents.length}
          radius={radius}
        />

        <div className="px-4 pt-3">
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
                  radius={radius}
                  setRadius={setRadius}
                  viewType={viewType}
                  setViewType={setViewType}
                  events={nearbyEvents}
                  openEventDetail={openEventDetail}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB */}
      <Link
        to="/events/new"
        className="fixed bottom-28 right-5 z-20 grid h-14 w-14 place-items-center
          rounded-full bg-violet-600 text-white shadow-lg
          hover:bg-violet-700 active:scale-95 transition-transform"
        aria-label="Create new event"
      >
        <i className="lni lni-plus text-xl" />
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
  // Status lines derived inline — avoids a memo whose deps would be
  // the same as the component's props anyway.
  const statusLine = (() => {
    if (activeTab === TABS.EXPLORE) return "Discover top picks and upcoming events";
    if (activeTab === TABS.NEAR) {
      if (locationStatus === "loading") return "Finding your position…";
      return `${nearbyCount} result${nearbyCount !== 1 ? "s" : ""} within ${radius} km`;
    }
    return "";
  })();

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b
      border-gray-100 px-4 pt-3 pb-3 shadow-sm">

      {/* Tab row + location badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS_CONFIG.map((tab) => (
            <TabPill
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>
        <LocationBadge
          status={locationStatus}
          label={locationLabel}
          onRefresh={onUpdateLocation}
        />
      </div>

      {/* Search */}
      <div className="mt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200
          bg-white px-4 py-2.5 shadow-sm
          focus-within:ring-2 focus-within:ring-violet-200 transition-shadow">
          <i className="lni lni-search-alt text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[activeTab] ?? "Search…"}
            className="w-full bg-transparent text-sm text-gray-800
              placeholder:text-gray-400 focus:outline-none"
            aria-label="Search events"
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
          <Link
            to="/events/new"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg
              text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Create event"
          >
            <i className="lni lni-plus" />
          </Link>
        </div>

        {statusLine && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 px-1">
            <i className="lni lni-navigation text-violet-600" />
            <span>{statusLine}</span>
            {activeTab === TABS.NEAR && locationLabel && (
              <span className="font-medium text-gray-700 ml-0.5">· {locationLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabPill({ label, icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
        "text-sm font-medium transition-all duration-150 border whitespace-nowrap",
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

function LocationBadge({ status, label, onRefresh }) {
  const display =
    label ||
    { loading: "Locating…", denied: "Location off", unsupported: "Unavailable" }[status] ||
    "Change";

  return (
    <button
      onClick={onRefresh}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border
        border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600
        hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
      aria-label="Update location"
    >
      <i className="lni lni-map-marker text-violet-600 text-xs" />
      <span className="max-w-[80px] truncate">{display}</span>
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
  const allUniqueEvents = useMemo(() => {
    return [
      ...new Map(
        [...popularEvents, ...upcomingEvents].map((e) => [e.id, e])
      ).values(),
    ];
  }, [popularEvents, upcomingEvents]);

  const countsByCategory = useMemo(() => {
    const counts = { All: allUniqueEvents.length };
    for (const cat of categories.slice(1)) {
      counts[cat] = allUniqueEvents.filter((e) => e.category === cat).length;
    }
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
    <div className="space-y-1">
      {popularEvents[0] && (
        <FeaturedEventBanner
          event={popularEvents[0]}
          onClick={() => openEventDetail(popularEvents[0])}
        />
      )}

      <SectionHeader title="Popular Events" className="mt-6" />

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

      {carouselEvents.length === 0 ? (
        <EmptyState message="No events in this category." />
      ) : (
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 pt-1">
          {carouselEvents.map((event) => (
            <EventCard key={event.id} event={event} onClick={() => openEventDetail(event)} />
          ))}
        </div>
      )}

      <SectionHeader title="Upcoming Events" className="mt-6" />
      <div className="mt-3 space-y-3 pb-4">
        {upcomingEvents.map((event) => (
          <UpcomingEventRow key={event.id} event={event} onOpen={openEventDetail} />
        ))}
      </div>
    </div>
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
      <div className="flex items-center justify-between gap-3 mt-3">
        <RadiusSlider value={radius} onChange={setRadius} />

        <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
          {[
            { id: VIEW_TYPES.LIST, icon: "lni-list", label: "List" },
            { id: VIEW_TYPES.MAP,  icon: "lni-map",  label: "Map"  },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewType(v.id)}
              className={[
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
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
              <div className="aspect-video grid place-items-center bg-gray-50 text-sm text-gray-500">
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

/* ================================================================
   CARD COMPONENTS
   ================================================================ */

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
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/90
            px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <i className="lni lni-star-filled text-[10px]" />
            Featured
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="text-lg font-bold leading-tight drop-shadow">{event.title}</p>
          <div className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
            <i className="lni lni-map-marker text-xs" />
            {event.place}
          </div>
        </div>
      </button>
    </div>
  );
}

function EventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-[260px] shrink-0 overflow-hidden rounded-2xl border
        border-gray-200 bg-white text-left shadow-sm
        hover:shadow-md active:scale-[0.99] transition-all"
    >
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
        <div className="absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1
          text-xs text-white backdrop-blur-sm ring-1 ring-white/10">
          {event.dateLabel}
        </div>
        <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5
          py-0.5 text-xs text-gray-800 ring-1 ring-gray-200 backdrop-blur-sm">
          {event.category}
        </div>
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
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <i className="lni lni-map-marker text-violet-600 text-[11px]" />
          <span className="truncate">{event.place}</span>
        </div>
      </div>
    </button>
  );
}

function NearbyEventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200
        bg-white p-3 text-left shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
    >
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
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
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
        <div className="flex items-baseline gap-0.5 mt-1">
          <span className="text-sm font-bold text-violet-700">${event.price}</span>
          <span className="text-[11px] text-gray-400">/person</span>
        </div>
      </div>
    </button>
  );
}

/* ================================================================
   SHARED UI COMPONENTS
   ================================================================ */

function SectionHeader({ title, className = "" }) {
  return (
    <h2 className={`text-lg font-bold text-gray-900 ${className}`}>{title}</h2>
  );
}

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
      <span className={[
        "rounded-full px-1.5 py-px text-[11px] font-medium",
        isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500",
      ].join(" ")}>
        {count}
      </span>
    </button>
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
        bg-white p-3 text-left shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="grid w-14 shrink-0 place-items-center rounded-xl border
        border-gray-100 bg-gray-50 py-2">
        <div className="text-center leading-tight">
          <div className="text-xl font-bold text-violet-700">{event.day}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{event.month}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <i className="lni lni-map-marker text-violet-600 text-[11px]" />
            <span className="truncate">{event.place}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-sm font-bold text-violet-700">${event.price}</span>
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
      <p className="mt-1 text-sm text-gray-500">Create or discover events near you.</p>
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
  const text =
    error?.message ||
    error?.error   ||
    (typeof error === "string" ? error : "An unexpected error occurred");

  const isAuth = /session expired|unauthorized|401/i.test(text);

  return (
    <div className="grid h-[50vh] place-items-center text-center px-4">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <i className={`text-xl ${isAuth ? "lni lni-lock text-amber-500" : "lni lni-warning text-red-500"}`} />
        </div>
        <p className={`font-semibold text-sm ${isAuth ? "text-amber-700" : "text-red-600"}`}>
          {isAuth ? "Sign in required" : "Failed to load"}
        </p>
        <p className="mt-1 text-xs text-gray-500">{text}</p>
        <div className="mt-4 flex justify-center gap-2">
          {isAuth ? (
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
                border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
  // Stable array reference — avoids RecenterMap firing on every render
  const position = useMemo(
    () => [center.lat, center.lng],
    [center.lat, center.lng]
  );

  return (
    <MapContainer
      center={position}
      zoom={12}
      style={{ height: 340, width: "100%" }}
      className="touch-pan-y"
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

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 12, { animate: true });
  }, [position, map]);
  return null;
}