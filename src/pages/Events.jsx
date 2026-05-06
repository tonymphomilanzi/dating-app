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
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */
const EARTH_RADIUS_KM    = 6_371;
const GEOCODE_TIMEOUT_MS = 5_000;
const GEO_TIMEOUT_MS     = 12_000;
const GEO_MAX_AGE_MS     = 60_000;
const DEFAULT_RADIUS_KM  = 50;
const POPULAR_EVENTS_LIMIT  = 12;
const UPCOMING_EVENTS_LIMIT = 10;

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
  if (!a || !b || a.lat == null || a.lng == null ||
      b.lat == null || b.lng == null) return Infinity;
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
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });
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
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
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
    creator_id:  ev.creator_id  || null,
  };
}

/* ================================================================
   MAP PIN ICON
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
   useGeolocation
   ================================================================ */
function useGeolocation() {
  const [userLocation,   setUserLocation]   = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationLabel,  setLocationLabel]  = useState("");

  const mountedRef      = useRef(true);
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
        data?.address?.city    || data?.address?.town    ||
        data?.address?.village || data?.address?.county  ||
        data?.address?.state   || "";
      if (mountedRef.current) setLocationLabel(city || "Your area");
    } catch {
      clearTimeout(timerId);
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
        if (!mountedRef.current) return;
        const pos = { lat: Number(coords.latitude), lng: Number(coords.longitude) };
        if (!isValidLatLng(pos.lat, pos.lng)) { setLocationStatus("denied"); return; }
        setUserLocation(pos);
        setLocationStatus("granted");
        reverseGeocode(pos);
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function refresh(silent = false) {
    if (!silent) {
      setIsLoading(true);
      setError("");
    }
    try {
      const rows = await eventsService.list();
      if (!mountedRef.current) return;
      setEvents((rows ?? []).map(mapRow));
      if (!silent) setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.name === "AbortError") return;
      if (!silent) {
        const status = err?.status || err?.response?.status;
        if (status === 401 || /session expired/i.test(err?.message ?? "")) {
          setError("Session expired. Please sign in again.");
          return;
        }
        setError(err?.message || "Failed to load events");
      }
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }

  return { events, setEvents, isLoading, error, refresh };
}

/* ================================================================
   CONFIRM DELETE MODAL
   ================================================================ */
function ConfirmDeleteModal({ eventTitle, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mx-auto">
          <TrashIcon className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-center text-lg font-bold text-gray-900">Delete Event?</h3>
        <p className="mt-2 text-center text-sm text-gray-500">
          <span className="font-semibold text-gray-700">"{eventTitle}"</span> will be
          permanently deleted and cannot be recovered.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm
              font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white
              hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50
              flex items-center justify-center gap-2"
          >
            {isDeleting
              ? <><SpinnerIcon className="h-4 w-4" />Deleting…</>
              : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   OWNER ACTION MENU
   ================================================================ */
function OwnerActionMenu({ event, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full
          bg-white/80 backdrop-blur-sm text-gray-600
          hover:bg-white hover:text-violet-700 transition-all shadow-sm border border-gray-100"
        aria-label="Event options"
      >
        <DotsVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 min-w-[140px] rounded-2xl
          bg-white border border-gray-100 shadow-xl py-1 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onEdit(event); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
              font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <PencilIcon className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(event); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
              font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   TOAST
   ================================================================ */
function Toast({ message, type = "success" }) {
  const isError = type === "error";
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border
        text-sm font-semibold ${isError
          ? "bg-red-500 border-red-400 text-white"
          : "bg-white border-gray-200 text-gray-900"}`}>
        {isError
          ? <WarningIcon className="h-4 w-4 shrink-0" />
          : <CheckIcon   className="h-4 w-4 shrink-0 text-green-500" />}
        {message}
      </div>
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [activeTab,        setActiveTab]        = useState(TABS.EXPLORE);
  const [searchQuery,      setSearchQuery]       = useState("");
  const [radius,           setRadius]            = useState(DEFAULT_RADIUS_KM);
  const [viewType,         setViewType]          = useState(VIEW_TYPES.LIST);
  const [selectedCategory, setSelectedCategory]  = useState("All");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [deleteError,  setDeleteError]  = useState("");
  const [toast,        setToast]        = useState(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    const id = setTimeout(() => {
      if (isMounted.current) setToast(null);
    }, 3_500);
    return () => clearTimeout(id);
  }, []);

  const { userLocation, locationStatus, locationLabel, requestLocation } = useGeolocation();
  const { events, setEvents, isLoading, error, refresh } = useEvents();

  /* ── Initial load ── */
  useEffect(() => {
    refresh(false); // foreground — show spinner
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Visibility refresh — silent, no spinner ── */
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Inject created / updated event from nav state ── */
  useEffect(() => {
    const created = location.state?.created;
    const updated = location.state?.updated;
    if (created) {
      setEvents((prev) =>
        prev.some((e) => e.id === created.id) ? prev : [mapRow(created), ...prev]
      );
      navigate("/events", { replace: true, state: null });
    }
    if (updated) {
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? mapRow(updated) : e)));
      navigate("/events", { replace: true, state: null });
    }
  }, [location.state, navigate, setEvents]);

  /* ── Handlers ── */
  const handleEdit = useCallback((event) => {
    navigate(`/events/${event.id}/edit`, { state: { event } });
  }, [navigate]);

  const handleDeleteRequest = useCallback((event) => {
    setDeleteError("");
    setDeleteTarget(event);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await eventsService.delete(deleteTarget.id);
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Event deleted successfully");
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, setEvents, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError("");
  }, []);

  /* ── Derived ── */
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
        (e) => e.title.toLowerCase().includes(q) || e.place.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      const dateDiff = new Date(a.dateISO) - new Date(b.dateISO);
      if (dateDiff !== 0) return dateDiff;
      if (userLocation) {
        const dA = calculateKmBetween(userLocation, a);
        const dB = calculateKmBetween(userLocation, b);
        if (Number.isFinite(dA) && Number.isFinite(dB) && dA !== dB) return dA - dB;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [events, selectedCategory, searchQuery, userLocation]);

  const popularEvents  = useMemo(() => filteredEvents.slice(0, POPULAR_EVENTS_LIMIT),  [filteredEvents]);
  const upcomingEvents = useMemo(() => filteredEvents.slice(0, UPCOMING_EVENTS_LIMIT), [filteredEvents]);

  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];
    let result = events
      .filter((e) => isValidLatLng(e.lat, e.lng))
      .map((e) => ({ ...e, distanceKm: calculateKmBetween(userLocation, e) }))
      .filter((e) => Number.isFinite(e.distanceKm) && e.distanceKm <= radius);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.place.toLowerCase().includes(q)
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

  /* ── Render ── */
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 pb-28">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {deleteTarget && (
        <ConfirmDeleteModal
          eventTitle={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {deleteError && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 w-[90vw] max-w-sm">
          <div className="flex items-center gap-2.5 rounded-2xl bg-red-500 px-4 py-3
            text-white text-sm font-semibold shadow-xl">
            <WarningIcon className="h-4 w-4 shrink-0" />
            {deleteError}
            <button
              onClick={() => setDeleteError("")}
              className="ml-auto text-white/70 hover:text-white"
            >
              <XSmallIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
              onRetry={() => refresh(false)}
              onSignIn={() => navigate("/auth/signin/email", { state: { from: "/events" } })}
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
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDeleteRequest}
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
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDeleteRequest}
                />
              )}
            </>
          )}
        </div>
      </div>

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
  activeTab, onTabChange, searchQuery, onSearchChange,
  locationStatus, locationLabel, onUpdateLocation, nearbyCount, radius,
}) {
  const statusLine = useMemo(() => {
    if (activeTab !== TABS.NEAR) return null;
    if (locationStatus === "loading") return { text: "Finding your position…", icon: "pulse" };
    if (locationStatus === "denied")  return { text: "Location access denied",  icon: "warn"  };
    return {
      text: `${nearbyCount} event${nearbyCount !== 1 ? "s" : ""} within ${radius} km`,
      icon: "ok",
    };
  }, [activeTab, locationStatus, nearbyCount, radius]);

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Events</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeTab === TABS.EXPLORE ? "Discover what's happening" : "Find events near you"}
          </p>
        </div>
        <LocationBadge
          status={locationStatus}
          label={locationLabel}
          onRefresh={onUpdateLocation}
        />
      </div>

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
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-500"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3
          focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-300
          focus-within:shadow-sm transition-all duration-200">
          <SearchIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[activeTab] ?? "Search…"}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            aria-label="Search events"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange("")}
              className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5
                rounded-full hover:bg-gray-200 transition-colors"
            >
              <XSmallIcon className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/events/new"
              className="shrink-0 flex h-7 w-7 items-center justify-center
                rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        {statusLine && (
          <div className="mt-2 flex items-center gap-1.5 px-1">
            {statusLine.icon === "pulse" && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
            )}
            {statusLine.icon === "ok"   && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />}
            {statusLine.icon === "warn" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
            <span className="text-xs text-gray-500">{statusLine.text}</span>
            {locationLabel && activeTab === TABS.NEAR && locationStatus === "granted" && (
              <span className="text-xs font-medium text-gray-700">· {locationLabel}</span>
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
  categories, selectedCategory, setSelectedCategory,
  popularEvents, upcomingEvents, openEventDetail,
  currentUserId, onEdit, onDelete,
}) {
  const allUniqueEvents = useMemo(() => [
    ...new Map([...popularEvents, ...upcomingEvents].map((e) => [e.id, e])).values(),
  ], [popularEvents, upcomingEvents]);

  const countsByCategory = useMemo(() => {
    const counts = { All: allUniqueEvents.length };
    for (const cat of categories.slice(1))
      counts[cat] = allUniqueEvents.filter((e) => e.category === cat).length;
    return counts;
  }, [categories, allUniqueEvents]);

  const carouselEvents = useMemo(() =>
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
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
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
                currentUserId={currentUserId}
                onEdit={onEdit}
                onDelete={onDelete}
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
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={onDelete}
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
  userLocation, locationStatus, radius, setRadius,
  viewType, setViewType, events, openEventDetail,
  onRequestLocation, currentUserId, onEdit, onDelete,
}) {
  if (locationStatus === "idle" || locationStatus === "denied") {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-violet-200 bg-violet-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
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
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600
              px-6 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-violet-700 active:scale-95 transition-all"
          >
            <MapPinIcon className="h-4 w-4" /> Allow Location
          </button>
        )}
      </div>
    );
  }

  if (locationStatus === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-300 opacity-60" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
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
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewType === id ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
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
            <EmptyState message={`No events found within ${radius} km. Try widening the radius.`} />
          ) : (
            events.map((event) => (
              <NearbyEventCard
                key={event.id}
                event={event}
                onClick={() => openEventDetail(event)}
                currentUserId={currentUserId}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   CARD COMPONENTS
   ================================================================ */
function FeaturedEventBanner({ event, onClick, currentUserId, onEdit, onDelete }) {
  const isOwner = !!(currentUserId && event.creator_id && currentUserId === event.creator_id);
  return (
    <div className="relative w-full overflow-hidden rounded-3xl shadow-xl">
      <button
        onClick={onClick}
        className="block w-full text-left active:scale-[0.99] transition-transform duration-150"
        aria-label={`View featured event: ${event.title}`}
      >
        {event.img ? (
          <img src={event.img} alt={event.title}
            className="h-52 w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-52 w-full bg-gradient-to-br from-violet-400 to-purple-600 grid place-items-center">
            <CalendarIcon className="h-16 w-16 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20
            backdrop-blur-md border border-white/30 px-3 py-1 text-xs font-bold text-white">
            ✨ Featured
          </span>
        </div>
        {!isOwner && (
          <div className="absolute top-3 right-3">
            <span className="rounded-full bg-violet-600/90 backdrop-blur-sm
              px-2.5 py-1 text-xs font-semibold text-white">
              {event.category}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-4">
          <p className="text-lg font-bold text-white leading-tight drop-shadow">{event.title}</p>
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
      {isOwner && (
        <div className="absolute top-3 right-3 z-10">
          <OwnerActionMenu event={event} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onClick, currentUserId, onEdit, onDelete }) {
  const isOwner = !!(currentUserId && event.creator_id && currentUserId === event.creator_id);
  return (
    <div className="group relative w-[220px] shrink-0 overflow-hidden rounded-2xl bg-white
      border border-gray-100 text-left shadow-sm hover:shadow-lg hover:-translate-y-0.5
      transition-all duration-200">
      <button onClick={onClick} className="block w-full text-left active:scale-[0.98]">
        <div className="relative h-36 bg-gray-100 overflow-hidden">
          {event.img ? (
            <img src={event.img} alt={event.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy" draggable={false} />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-100 to-purple-100">
              <CalendarIcon className="h-10 w-10 text-violet-300" />
            </div>
          )}
          <div className="absolute left-2 top-2 rounded-lg bg-black/60 backdrop-blur-sm
            px-2 py-1 text-xs text-white font-medium">
            {event.dateLabel}
          </div>
          {!isOwner && (
            <div className="absolute right-2 top-2 rounded-full bg-white/95
              px-2 py-0.5 text-xs font-bold text-violet-700 shadow-sm">
              {event.price === 0 ? "Free" : `$${event.price}`}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16
            bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute inset-x-2.5 bottom-2">
            <p className="truncate text-sm font-bold text-white drop-shadow">{event.title}</p>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPinIcon className="h-3 w-3 text-violet-500 shrink-0" />
            <span className="truncate">{event.place}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
              <span>{event.category}</span>
            </div>
            {isOwner && (
              <span className="text-xs font-bold text-violet-700">
                {event.price === 0 ? "Free" : `$${event.price}`}
              </span>
            )}
          </div>
        </div>
      </button>
      {isOwner && (
        <div className="absolute top-2 right-2 z-10">
          <OwnerActionMenu event={event} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function NearbyEventCard({ event, onClick, currentUserId, onEdit, onDelete }) {
  const isOwner = !!(currentUserId && event.creator_id && currentUserId === event.creator_id);
  return (
    <div className="relative flex w-full items-stretch gap-3 rounded-2xl bg-white
      border border-gray-100 p-3 shadow-sm hover:shadow-md hover:border-violet-100
      transition-all duration-200">
      <button onClick={onClick} className="flex flex-1 items-stretch gap-3 text-left active:scale-[0.99]">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {event.img ? (
            <img src={event.img} alt={event.title}
              className="h-full w-full object-cover" loading="lazy" draggable={false} />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-50 to-purple-100">
              <CalendarIcon className="h-7 w-7 text-violet-300" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5 pr-8">
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
              {event.price > 0 && <span className="text-[11px] text-gray-400">/person</span>}
            </div>
            <span className="text-xs text-gray-400">{event.dateLabel}</span>
          </div>
        </div>
      </button>
      {isOwner && (
        <div className="absolute right-3 top-3 z-10">
          <OwnerActionMenu event={event} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function UpcomingEventRow({ event, onOpen, currentUserId, onEdit, onDelete }) {
  const isOwner = !!(currentUserId && event.creator_id && currentUserId === event.creator_id);
  return (
    <div className="relative flex w-full items-stretch gap-3 rounded-2xl bg-white
      border border-gray-100 p-3 shadow-sm hover:shadow-md hover:border-violet-100
      transition-all duration-200">
      <button
        onClick={() => onOpen(event)}
        className="flex flex-1 items-stretch gap-3 text-left active:scale-[0.99]"
      >
        <div className="flex w-14 shrink-0 flex-col items-center justify-center
          rounded-xl bg-gradient-to-b from-violet-50 to-violet-100/60
          border border-violet-100 py-2">
          <div className="text-xl font-extrabold text-violet-700 leading-none">{event.day}</div>
          <div className="text-[10px] uppercase tracking-widest text-violet-400 mt-0.5">{event.month}</div>
        </div>
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {event.img ? (
            <img src={event.img} alt={event.title}
              className="h-full w-full object-cover" loading="lazy" draggable={false} />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-50 to-purple-100">
              <CalendarIcon className="h-6 w-6 text-violet-300" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5 pr-8">
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
              {event.price > 0 && <span className="text-[11px] text-gray-400">/person</span>}
            </div>
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
              {event.category}
            </span>
          </div>
        </div>
      </button>
      {isOwner && (
        <div className="absolute right-3 top-3 z-10">
          <OwnerActionMenu event={event} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
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
        type="range" min={1} max={100} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full bg-gray-200 accent-violet-600 cursor-pointer min-w-0"
        aria-label={`Search radius: ${value} km`}
      />
      <span className="text-sm font-bold text-violet-700 shrink-0 w-10 text-right">{value}km</span>
    </div>
  );
}

function EmptyCreate({ onCreate }) {
  return (
    <div className="mt-8 rounded-3xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
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
        <PlusIcon className="h-4 w-4" /> Create Event
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
    error?.message || error?.error ||
    (typeof error === "string" ? error : "An unexpected error occurred");
  const isAuth = /session expired|unauthorized|401/i.test(text);
  return (
    <div className="mt-10 rounded-3xl bg-white border border-gray-100 shadow-sm p-8 text-center">
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center
        rounded-full ${isAuth ? "bg-amber-50" : "bg-red-50"}`}>
        {isAuth
          ? <LockIcon    className="h-8 w-8 text-amber-500" />
          : <WarningIcon className="h-8 w-8 text-red-400"   />}
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
              px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            Sign In
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200
              bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   MAP
   ================================================================ */
function NearbyEventsMap({ center, events, onOpenEvent }) {
  const position = useMemo(() => [center.lat, center.lng], [center.lat, center.lng]);
  return (
    <MapContainer center={position} zoom={12} style={{ height: 380, width: "100%" }} zoomControl={false}>
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
                  <span className="text-xs text-gray-400">{formatDistanceLabel(event.distanceKm)}</span>
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
   ICONS
   ================================================================ */
function CompassIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" />
    </svg>
  );
}
function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XSmallIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function CalendarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2"  x2="16" y2="6"  strokeLinecap="round" />
      <line x1="8"  y1="2"  x2="8"  y2="6"  strokeLinecap="round" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ListIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="8" y1="6"  x2="21" y2="6"  strokeLinecap="round" />
      <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round" />
      <circle cx="3" cy="6"  r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}
function MapViewIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" strokeLinejoin="round" />
      <line x1="8"  y1="2"  x2="8"  y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}
function LockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
function DotsVerticalIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="5"  r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
function PencilIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}
function CheckIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}