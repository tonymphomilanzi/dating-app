// src/pages/MassageClinic.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS & HELPERS
   ================================================================ */

const DEFAULT_RADIUS_KM = 25;
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const SEARCH_DEBOUNCE_MS = 400;

const formatDistance = (km) => {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
};

const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const todayHours = (openingHours) => {
  try {
    const parsed =
      typeof openingHours === "string"
        ? JSON.parse(openingHours)
        : openingHours;
    if (!Array.isArray(parsed)) return null;
    const today = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][new Date().getDay()];
    const slot = parsed.find((s) => s.day === today);
    if (!slot?.from || !slot?.to) return null;
    const format = (t) => {
      const [h, m] = t.split(":");
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${m} ${ampm}`;
    };
    return `${format(slot.from)} – ${format(slot.to)}`;
  } catch {
    return null;
  }
};

/* ================================================================
   SVG ICONS
   ================================================================ */

const MapPinIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);
const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <circle cx="11" cy="11" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);
const XIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
const SpinnerIcon = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
    />
  </svg>
);
const TargetIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);
const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);
const StarIcon = ({ className = "w-4 h-4", filled = false }) => (
  <svg
    className={className}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);
const PhoneIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);
const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);
const AlertIcon = ({ className = "w-6 h-6" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const HeartIcon = ({ className = "w-5 h-5", filled = false }) => (
  <svg
    className={className}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);
const ArrowRightIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 7l5 5m0 0l-5 5m5-5H6"
    />
  </svg>
);
const DotsVerticalIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const PencilIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/* ================================================================
   TOAST
   ================================================================ */

function Toast({ message, type = "success" }) {
  const isError = type === "error";
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border
        text-sm font-semibold ${
          isError
            ? "bg-red-500 border-red-400 text-white"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        {isError ? (
          <AlertIcon className="w-4 h-4 shrink-0" />
        ) : (
          <CheckIcon className="w-4 h-4 shrink-0 text-green-500" />
        )}
        {message}
      </div>
    </div>
  );
}

/* ================================================================
   CONFIRM DELETE MODAL
   ================================================================ */

function ConfirmDeleteModal({ clinicName, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mx-auto">
          <TrashIcon className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="text-center text-lg font-bold text-gray-900">
          Delete Clinic?
        </h3>
        <p className="mt-2 text-center text-sm text-gray-500">
          <span className="font-semibold text-gray-700">"{clinicName}"</span>{" "}
          will be permanently deleted and cannot be recovered.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-2xl border border-gray-200 bg-white py-3
              text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
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
            {isDeleting ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   OWNER ACTION MENU
   ================================================================ */

function OwnerActionMenu({ clinic, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full
          bg-white/90 backdrop-blur-sm text-gray-600 shadow
          hover:bg-white hover:text-violet-700 transition-all border border-gray-100"
        aria-label="Clinic options"
      >
        <DotsVerticalIcon className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-30 min-w-[140px] rounded-2xl
          bg-white border border-gray-100 shadow-xl py-1 overflow-hidden"
        >
          <button
            onClick={() => {
              setOpen(false);
              onEdit(clinic);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
              font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <PencilIcon className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete(clinic);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
              font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   LOCATION SEARCH BAR
   ================================================================ */

function LocationSearchBar({ onSelect, onUseMyLocation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setIsSearching(true);
      setSearchError("");

      try {
        const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(
          query
        )}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en" },
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const data = await res.json();
        setResults(
          data.map((r) => ({
            label: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          }))
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setSearchError("Search failed. Try again.");
        }
      } finally {
        if (!ac.signal.aborted) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="p-3 border-b border-gray-100">
      <div className="relative mb-2">
        {isSearching ? (
          <SpinnerIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500" />
        ) : (
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location..."
          className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-violet-300"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <button
        onClick={onUseMyLocation}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
      >
        <TargetIcon className="w-3.5 h-3.5" /> Use my current location
      </button>

      {searchError && (
        <p className="text-xs text-red-500 px-3 py-1">{searchError}</p>
      )}
      {query.length >= 3 && !isSearching && !searchError && results.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No results found</p>
      )}

      {results.map((result, i) => (
        <button
          key={i}
          onClick={() =>
            onSelect(
              { lat: result.lat, lng: result.lng },
              result.label.split(",")[0].trim()
            )
          }
          className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 rounded-lg transition-colors"
        >
          <MapPinIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
          <span className="text-gray-700 line-clamp-2">{result.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function MassageClinic() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── UI state ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("nearby");
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState("rating");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showLocationFilter, setShowLocationFilter] = useState(false);

  // ── Delete state ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState(null);

  // ── Location state ────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [locationStatus, setLocationStatus] = useState("idle");
  // "idle" | "loading" | "granted" | "denied"

  // ── Clinics state ─────────────────────────────────────────────────
  const [searchLocation, setSearchLocation] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Refs ──────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [locationStatus, setLocationStatus] = useState("idle");
  // "idle" | "loading" | "granted" | "denied"

  // ── Refs ──────────────────────────────────────────────────────────
  const locationFilterRef = useRef(null);
  const isMounted = useRef(true);

 useEffect(() => {
    isMounted.current = true;
    window.scrollTo(0, 0);
    return () => {
      isMounted.current = false;
    };
  }, []);


  /* ── Toast helper ──────────────────────────────────────────────── */
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      if (isMounted.current) setToast(null);
    }, 3500);
  }, []);

 /* ── Reverse geocode ───────────────────────────────────────────── */
  const reverseGeocode = useCallback(async (pos) => {
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`
      );
      const data = await res.json();
      return (
        data?.address?.city ||
        data?.address?.town ||
        data?.address?.village ||
        "Your area"
      );
    } catch {
      return "Your area";
    }
  }, []);


 /* ── Request location ──────────────────────────────────────────── */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    // Don't re-request if already loading or granted
    setLocationStatus((current) => {
      if (current === "loading") return current;
      return "loading";
    });

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (!isMounted.current) return;
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(pos);
        setSearchLocation(pos);
        setLocationStatus("granted");
        const label = await reverseGeocode(pos);
        if (isMounted.current) setLocationLabel(label);
      },
      () => {
        if (isMounted.current) setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [reverseGeocode]);

  /* ── Request location ONCE on mount ───────────────────────────── */
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Empty deps intentional: we only want this on mount.
  // requestLocation is stable but listing it would re-run on every render
  // in StrictMode (double-invoke). The geolocation API handles duplicates.

  /* ── Load clinics ──────────────────────────────────────────────── */
  const loadClinics = useCallback(async () => {
    // For nearby mode, wait until we have a location
    if (viewMode === "nearby" && !searchLocation) return;

    setIsLoading(true);
    setError("");
    setClinics([]);

    try {
      let query = supabase
        .from("massage_clinics")
        .select(
          `id, name, address, city, cover_url, rating, review_count,
           lat, lng, phone, opening_hours, status, owner_id,
           clinic_specialties(name)`
        )
        .in("status", ["approved", "pending"]);

      if (viewMode === "nearby" && searchLocation) {
        const { lat, lng } = searchLocation;
        const latDelta = radiusKm / 111;
        const lngDelta =
          radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
        query = query
          .gte("lat", lat - latDelta)
          .lte("lat", lat + latDelta)
          .gte("lng", lng - lngDelta)
          .lte("lng", lng + lngDelta);
      }

      const { data, error: fetchError } = await query
        .order("rating", { ascending: false })
        .limit(100);

      if (!isMounted.current) return;
      if (fetchError) throw fetchError;

      let processed = (data || []).map((clinic) => {
        const latNum =
          typeof clinic.lat === "string" ? parseFloat(clinic.lat) : clinic.lat;
        const lngNum =
          typeof clinic.lng === "string" ? parseFloat(clinic.lng) : clinic.lng;
        const distance_km =
          searchLocation && !isNaN(latNum) && !isNaN(lngNum)
            ? haversineKm(searchLocation, { lat: latNum, lng: lngNum })
            : null;
        return {
          ...clinic,
          specialties: clinic.clinic_specialties?.map((s) => s.name) || [],
          distance_km,
        };
      });

      // Fine-grained radius filter (bounding box can include corners outside radius)
      if (viewMode === "nearby" && searchLocation) {
        processed = processed.filter(
          (c) => c.distance_km !== null && c.distance_km <= radiusKm
        );
      }

      // Sort
      if (sortBy === "name") {
        processed.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      } else if (sortBy === "distance" && viewMode === "nearby") {
        processed.sort(
          (a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity)
        );
      } else {
        processed.sort(
          (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
        );
      }

      setClinics(processed);
    } catch (err) {
      if (!isMounted.current) return;
      console.error("loadClinics error:", err);
      setError("Failed to load clinics. Please try again.");
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [viewMode, searchLocation, radiusKm, sortBy]);

  /* ── Trigger load whenever dependencies change ─────────────────── */
  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  /* ── Close location filter on outside click ────────────────────── */
  useEffect(() => {
    if (!showLocationFilter) return;
    const handler = (e) => {
      if (
        locationFilterRef.current &&
        !locationFilterRef.current.contains(e.target)
      ) {
        setShowLocationFilter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLocationFilter]);

  /* ── Handlers ──────────────────────────────────────────────────── */
  const toggleViewMode = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setClinics([]);
    setError("");
    if (mode === "all") {
      setSearchLocation(null);
    } else if (mode === "nearby") {
      // Restore user location if available
      if (userLocation) {
        setSearchLocation(userLocation);
      } else {
        // Re-request if not yet available
        requestLocation();
      }
    }
  };

  const handleLocationSelect = (pos, label) => {
    setSearchLocation(pos);
    setLocationLabel(label);
    setUserLocation(pos);
    setLocationStatus("granted");
    setViewMode("nearby");
    setShowLocationFilter(false);
  };

  const handleUseMyLocation = () => {
    setShowLocationFilter(false);
    if (userLocation) {
      setSearchLocation(userLocation);
    } else {
      requestLocation();
    }
  };

  const handleEdit = useCallback(
    (clinic) => {
      navigate(`/massage-clinics/${clinic.id}/edit`, { state: { clinic } });
    },
    [navigate]
  );

  const handleDeleteRequest = useCallback((clinic) => {
    setDeleteError("");
    setDeleteTarget(clinic);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const { error: delErr } = await supabase
        .from("massage_clinics")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("owner_id", user.id);

      if (delErr) throw delErr;
      setClinics((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Clinic deleted successfully");
    } catch (err) {
      setDeleteError(
        err?.message || "Failed to delete. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, user?.id, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError("");
  }, []);

  /* ── Derived ───────────────────────────────────────────────────── */
  const filteredClinics = useMemo(() => {
    if (!searchQuery.trim()) return clinics;
    const q = searchQuery.toLowerCase();
    return clinics.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [clinics, searchQuery]);

  const effectiveLocationLabel = locationLabel || "Set location";

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-50/50 pb-32">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {deleteTarget && (
        <ConfirmDeleteModal
          clinicName={deleteTarget.name || "this clinic"}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {deleteError && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 w-[90vw] max-w-sm">
          <div
            className="flex items-center gap-2.5 rounded-2xl bg-red-500 px-4 py-3
            text-white text-sm font-semibold shadow-xl"
          >
            <AlertIcon className="w-4 h-4 shrink-0" />
            {deleteError}
            <button
              onClick={() => setDeleteError("")}
              className="ml-auto text-white/70 hover:text-white"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-2xl border-b border-gray-100/50 shadow-sm">
          <div className="px-4 md:px-6 py-4">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-black bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Massage Clinics
              </h1>
              <div className="flex items-center gap-2">
                {/* Search toggle */}
                <button
                  onClick={() => setIsSearchExpanded((v) => !v)}
                  className="p-2.5 rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                >
                  {isSearchExpanded ? (
                    <XIcon className="w-5 h-5" />
                  ) : (
                    <SearchIcon className="w-5 h-5" />
                  )}
                </button>

                {/* Sort — desktop */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="hidden sm:block bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-bold focus:outline-none focus:border-violet-300 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <option value="rating">Top Rated</option>
                  {viewMode === "nearby" && (
                    <option value="distance">Nearest</option>
                  )}
                  <option value="name">A–Z</option>
                </select>

                {/* Near Me / All toggle */}
                <div className="flex bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => toggleViewMode("nearby")}
                    className={`py-1.5 px-4 text-xs font-bold rounded-full transition-all ${
                      viewMode === "nearby"
                        ? "bg-white shadow text-violet-700"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Near Me
                  </button>
                  <button
                    onClick={() => toggleViewMode("all")}
                    className={`py-1.5 px-4 text-xs font-bold rounded-full transition-all ${
                      viewMode === "all"
                        ? "bg-white shadow text-violet-700"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>

            {/* Search input */}
            {isSearchExpanded && (
              <div className="mb-3">
                <div className="relative">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clinics by name or area..."
                    autoFocus
                    className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Location filters — only in nearby mode */}
            {viewMode === "nearby" && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Location picker */}
                <div className="relative" ref={locationFilterRef}>
                  <button
                    onClick={() => setShowLocationFilter((v) => !v)}
                    className="flex items-center gap-2 bg-white border border-gray-200 hover:border-violet-300 rounded-full px-3.5 py-2 text-xs font-bold text-gray-700 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                  >
                    {locationStatus === "loading" ? (
                      <SpinnerIcon className="w-3.5 h-3.5 text-violet-500" />
                    ) : (
                      <MapPinIcon className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">
                      {locationStatus === "loading"
                        ? "Locating…"
                        : effectiveLocationLabel}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-gray-400 shrink-0" />
                  </button>

                  {showLocationFilter && (
                    <div className="absolute left-0 top-full z-50 mt-2 rounded-2xl border border-gray-100 bg-white shadow-2xl min-w-[260px]">
                      <LocationSearchBar
                        onSelect={handleLocationSelect}
                        onUseMyLocation={handleUseMyLocation}
                      />
                    </div>
                  )}
                </div>

                {/* Radius picker */}
                {searchLocation && (
                  <div className="flex items-center bg-white border border-gray-200 rounded-full px-3.5 py-2 shadow-sm text-xs font-bold">
                    <span className="text-gray-500 mr-1.5 hidden sm:inline">
                      Within
                    </span>
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="bg-transparent text-violet-700 focus:outline-none cursor-pointer"
                    >
                      {[5, 10, 25, 50, 100].map((r) => (
                        <option key={r} value={r}>
                          {r}km
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sort — mobile */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sm:hidden ml-auto bg-white border border-gray-200 rounded-full px-3 py-2 text-xs font-bold focus:outline-none text-gray-700"
                >
                  <option value="rating">Top Rated</option>
                  <option value="distance">Nearest</option>
                  <option value="name">A–Z</option>
                </select>

                {/* Result count */}
                {!isLoading && clinics.length > 0 && (
                  <span className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">
                    {filteredClinics.length} clinic
                    {filteredClinics.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="px-4 md:px-6 pt-6">
          {/* Location denied and in nearby mode */}
          {locationStatus === "denied" && viewMode === "nearby" ? (
            <LocationDeniedState
              onRequestLocation={requestLocation}
              onViewAll={() => toggleViewMode("all")}
            />
          ) : /* Loading skeleton */
          isLoading ? (
            <LoadingState />
          ) : /* Error */
          error ? (
            <ErrorState error={error} onRetry={loadClinics} />
          ) : /* Nearby but no location yet */
          viewMode === "nearby" && !searchLocation ? (
            <LocationDeniedState
              onRequestLocation={requestLocation}
              onViewAll={() => toggleViewMode("all")}
            />
          ) : /* Empty */
          filteredClinics.length === 0 ? (
            <EmptyState
              viewMode={viewMode}
              searchQuery={searchQuery}
              locationLabel={effectiveLocationLabel}
              onCreateClinic={() => navigate("/massage-clinics/new")}
            />
          ) : (
            /* Results */
            <ClinicsList
              clinics={filteredClinics}
              viewMode={viewMode}
              currentUserId={user?.id}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
            />
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/massage-clinics/new")}
        className="fixed bottom-24 right-6 z-20 w-16 h-16 bg-gradient-to-br from-violet-600 to-violet-800 text-white rounded-full shadow-2xl shadow-violet-300/50 hover:shadow-violet-400/60 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
        aria-label="Add new clinic"
      >
        <PlusIcon className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
      </button>
    </div>
  );
}

/* ================================================================
   STATE COMPONENTS
   ================================================================ */

function LocationDeniedState({ onRequestLocation, onViewAll }) {
  return (
    <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <MapPinIcon className="w-10 h-10 text-violet-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">
        Location Access Needed
      </h3>
      <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
        Enable location to discover massage clinics near you, or browse all
        available clinics.
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onRequestLocation}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-full font-bold text-sm transition-all active:scale-95 shadow-md hover:shadow-lg"
        >
          <TargetIcon className="w-4 h-4" /> Enable Location
        </button>
        <button
          onClick={onViewAll}
          className="text-violet-600 text-sm font-semibold hover:text-violet-700 transition-colors"
        >
          Browse all clinics
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm border border-gray-100"
        >
          <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-100" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-1/2" />
            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            <div className="flex gap-2 pt-2">
              <div className="h-8 bg-gray-100 rounded-xl flex-1" />
              <div className="h-8 bg-gray-200 rounded-xl flex-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertIcon className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-red-500 mb-8 max-w-xs mx-auto">{error}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-full font-bold text-sm mx-auto transition-all active:scale-95"
      >
        <RefreshIcon className="w-4 h-4" /> Try Again
      </button>
    </div>
  );
}

function EmptyState({ viewMode, searchQuery, locationLabel, onCreateClinic }) {
  return (
    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
      <div className="w-24 h-24 bg-gradient-to-br from-violet-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-5xl">💆</span>
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">No Clinics Found</h3>
      <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
        {searchQuery
          ? `No clinics match "${searchQuery}".`
          : viewMode === "all"
          ? "No massage clinics available yet. Be the first to list one!"
          : `No clinics found near ${locationLabel}. Try a larger radius.`}
      </p>
      <button
        onClick={onCreateClinic}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-full font-bold text-sm mx-auto transition-all active:scale-95 shadow-md"
      >
        <PlusIcon className="w-4 h-4" /> List Your Clinic
      </button>
    </div>
  );
}

function ClinicsList({ clinics, viewMode, currentUserId, onEdit, onDelete }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
      {clinics.map((clinic) => (
        <ClinicCard
          key={clinic.id}
          clinic={clinic}
          viewMode={viewMode}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/* ================================================================
   CLINIC CARD
   ================================================================ */

function ClinicCard({ clinic, viewMode, currentUserId, onEdit, onDelete }) {
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOwner = !!(
    currentUserId &&
    clinic.owner_id &&
    currentUserId === clinic.owner_id
  );
  const hours = todayHours(clinic.opening_hours);
  const rating = Number(clinic.rating) || 0;
  const reviewCount = Number(clinic.review_count) || 0;

  return (
    <article
      onClick={() => navigate(`/massage-clinics/${clinic.id}`)}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-violet-200 flex flex-col"
    >
      {/* Image */}
      <div className="relative h-48 sm:h-44 lg:h-48 overflow-hidden bg-gradient-to-br from-violet-100 to-fuchsia-100 shrink-0">
        {clinic.cover_url && !imageError ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name || "Clinic"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-5xl mb-1">💆</span>
            <span className="text-xs text-gray-400">No image</span>
          </div>
        )}

        {/* Scrim */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 via-black/20 to-transparent pointer-events-none" />

        {/* Favourite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorited((v) => !v);
          }}
          className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          aria-label={isFavorited ? "Remove favourite" : "Add favourite"}
        >
          <HeartIcon
            className={`w-4 h-4 ${isFavorited ? "text-red-500" : "text-gray-400"}`}
            filled={isFavorited}
          />
        </button>

        {/* Top-right badges / owner menu */}
        <div
          className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {isOwner && (
            <OwnerActionMenu clinic={clinic} onEdit={onEdit} onDelete={onDelete} />
          )}
          {clinic.distance_km != null && viewMode === "nearby" && (
            <span className="bg-white/95 backdrop-blur-sm text-violet-700 font-bold text-[11px] px-2.5 py-1 rounded-full shadow">
              {formatDistance(clinic.distance_km)}
            </span>
          )}
          {clinic.status === "pending" && (
            <span className="bg-amber-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-full shadow">
              Pending
            </span>
          )}
        </div>

        {/* Name + rating overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <h3 className="font-bold text-base text-white leading-snug line-clamp-1 mb-0.5">
            {clinic.name || "Unnamed Clinic"}
          </h3>
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`w-3 h-3 ${
                      i < Math.round(rating)
                        ? "text-amber-300"
                        : "text-white/30"
                    }`}
                    filled={i < Math.round(rating)}
                  />
                ))}
              </div>
              <span className="text-[11px] text-white font-bold">
                {rating.toFixed(1)}
              </span>
              {reviewCount > 0 && (
                <span className="text-[11px] text-white/70">
                  ({reviewCount})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {(clinic.address || clinic.city) && (
          <div className="flex items-start gap-2 mb-2.5">
            <MapPinIcon className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
            <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {[clinic.address, clinic.city].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {hours && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <ClockIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-600">Open</span>
            <span className="text-xs text-gray-500">{hours}</span>
          </div>
        )}

        {isOwner && (
          <div className="mb-2.5">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-violet-50
              border border-violet-200 px-2.5 py-0.5 text-[10px] font-bold text-violet-700"
            >
              <PencilIcon className="w-2.5 h-2.5" /> Your listing
            </span>
          </div>
        )}

        {clinic.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {clinic.specialties.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full"
              >
                {s}
              </span>
            ))}
            {clinic.specialties.length > 3 && (
              <span className="text-[10px] text-gray-400 px-1 py-0.5">
                +{clinic.specialties.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(clinic);
              }}
              className="flex items-center justify-center gap-1.5 bg-violet-50 hover:bg-violet-100
                text-violet-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors border border-violet-100"
            >
              <PencilIcon className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 py-2.5 rounded-xl text-xs font-bold transition-colors border border-violet-100"
            >
              <PhoneIcon className="w-3.5 h-3.5" /> Call
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/massage-clinics/${clinic.id}`);
            }}
            className={`flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm ${
              clinic.phone || isOwner ? "flex-1" : "w-full"
            }`}
          >
            View <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
}