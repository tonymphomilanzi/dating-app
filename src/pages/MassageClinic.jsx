// src/pages/MassageClinic.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

/* ================================================================
   CONSTANTS
   ================================================================ */

const GEOCODE_TIMEOUT_MS = 5_000;
const GEO_TIMEOUT_MS     = 12_000;
const GEO_MAX_AGE_MS     = 60_000;
const DEFAULT_RADIUS_KM  = 25;
const NOMINATIM_BASE     = "https://nominatim.openstreetmap.org";
const SEARCH_DEBOUNCE_MS = 400;
const REVALIDATE_AFTER_MS = 30_000; // re-fetch if page regains focus after 30s

/* ================================================================
   PURE HELPERS
   ================================================================ */

const isFiniteNum   = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

function formatDistanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1
    ? `${Math.round(km * 1_000)} m`
    : `${km.toFixed(1)} km`;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R    = 6_371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function to12h(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

function todayHours(openingHours) {
  try {
    const parsed =
      typeof openingHours === "string"
        ? JSON.parse(openingHours)
        : openingHours;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const today = [
      "Sunday","Monday","Tuesday","Wednesday",
      "Thursday","Friday","Saturday",
    ][new Date().getDay()];
    const slot = parsed.find((s) => s.day === today);
    if (!slot) return null;
    return `Today · ${to12h(slot.from)}–${to12h(slot.to)}`;
  } catch {
    return null;
  }
}

/* ================================================================
   GEOCODING
   ================================================================ */

async function reverseGeocodeLabel({ lat, lng }, signal) {
  const res  = await fetch(
    `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { "Accept-Language": "en" }, signal }
  );
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  return (
    data?.address?.city    ||
    data?.address?.town    ||
    data?.address?.village ||
    data?.address?.county  ||
    data?.address?.state   ||
    "Your area"
  );
}

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

  const fetchLabel = useCallback(async (pos) => {
    geocodeAbortRef.current?.abort();
    const ac      = new AbortController();
    geocodeAbortRef.current = ac;
    const timerId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);
    try {
      const label = await reverseGeocodeLabel(pos, ac.signal);
      clearTimeout(timerId);
      if (mountedRef.current && !ac.signal.aborted) setLocationLabel(label);
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
          fetchLabel(pos);
        }
      },
      () => {
        if (mountedRef.current) setLocationStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout:    GEO_TIMEOUT_MS,
        maximumAge: GEO_MAX_AGE_MS,
      }
    );
  }, [fetchLabel]);

  const setManualLocation = useCallback((pos, label) => {
    setUserLocation(pos);
    setLocationLabel(label);
    setLocationStatus("granted");
  }, []);

  return {
    userLocation,
    locationStatus,
    locationLabel,
    requestLocation,
    setManualLocation,
  };
}

/* ================================================================
   useMassageClinics
   ================================================================ */

function useMassageClinics({ searchLocation, radiusKm }) {
  const [clinics,    setClinics]    = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState(0);

  const mountedRef = useRef(true);
  const genRef     = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadClinics = useCallback(async (opts = {}) => {
    if (!searchLocation) return;

    // Cooldown — skip silent background refetches if data is fresh
    const now = Date.now();
    if (opts.background && now - lastFetchAt < REVALIDATE_AFTER_MS) return;

    genRef.current += 1;
    const myGen = genRef.current;

    // Only show skeleton on first load or explicit retry
    if (!opts.background) setIsLoading(true);
    setError("");

    try {
      const { lat, lng } = searchLocation;

      // ── PostGIS RPC ──────────────────────────────────────────
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "nearby_clinics",
        { p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: 50 }
      );

      if (genRef.current !== myGen || !mountedRef.current) return;

      if (!rpcErr && Array.isArray(rpcData)) {
        setClinics(rpcData);
        setHasFetched(true);
        setLastFetchAt(Date.now());
        return;
      }

      // ── Fallback: SELECT + bounding box + JS distance ────────
      console.warn("[MassageClinic] RPC failed, falling back:", rpcErr?.message);

      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

      const { data: rows, error: selectErr } = await supabase
        .from("massage_clinics")
        .select(`
          id, name, address, city, cover_url,
          rating, review_count, lat, lng,
          phone, email, website, opening_hours,
          status,
          clinic_specialties ( name )
        `)
        .in("status", ["approved", "pending"])
        .gte("lat", lat - latDelta)
        .lte("lat", lat + latDelta)
        .gte("lng", lng - lngDelta)
        .lte("lng", lng + lngDelta)
        .order("rating", { ascending: false })
        .limit(50);

      if (genRef.current !== myGen || !mountedRef.current) return;
      if (selectErr) throw new Error(selectErr.message);

      const withDistance = (rows ?? [])
        .map((c) => ({
          ...c,
          specialties:  c.clinic_specialties?.map((s) => s.name) ?? [],
          distance_km: haversineKm(
            { lat, lng },
            { lat: Number(c.lat), lng: Number(c.lng) }
          ),
        }))
        .filter((c) => c.distance_km == null || c.distance_km <= radiusKm)
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

      setClinics(withDistance);
      setHasFetched(true);
      setLastFetchAt(Date.now());
    } catch (err) {
      if (genRef.current !== myGen || !mountedRef.current) return;
      console.error("[MassageClinic] loadClinics error:", err);
      if (!opts.background) setError(err?.message || "Failed to load clinics");
      setHasFetched(true);
    } finally {
      if (genRef.current === myGen && mountedRef.current) setIsLoading(false);
    }
  }, [searchLocation, radiusKm, lastFetchAt]);

  return { clinics, isLoading, error, hasFetched, loadClinics };
}

/* ================================================================
   LocationSearchBar
   ================================================================ */

function LocationSearchBar({ currentLabel, onSelect, onUseMyLocation }) {
  const [query,     setQuery]     = useState("");
  const [open,      setOpen]      = useState(false);
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState([]);
  const [searchErr, setSearchErr] = useState("");

  const abortRef   = useRef(null);
  const mountedRef = useRef(true);
  const inputRef   = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
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
      setSearching(true);
      setSearchErr("");
      try {
        const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
        const res  = await fetch(url, {
          headers: { "Accept-Language": "en" },
          signal:  ac.signal,
        });
        if (!mountedRef.current || ac.signal.aborted) return;
        const data = await res.json();
        setResults(
          data.map((r) => ({
            label: r.display_name,
            lat:   parseFloat(r.lat),
            lng:   parseFloat(r.lon),
          }))
        );
      } catch (err) {
        if (!ac.signal.aborted && mountedRef.current) {
          setSearchErr("Search failed. Try again.");
        }
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result) => {
    onSelect({ lat: result.lat, lng: result.lng }, result.label);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearchErr("");
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border
          border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium
          text-gray-600 hover:bg-violet-50 hover:border-violet-200
          hover:text-violet-700 transition-all max-w-[150px]"
        aria-label="Change search location"
      >
        <MapPinIcon className="h-3.5 w-3.5 text-violet-500 shrink-0" />
        <span className="truncate">{currentLabel || "Set location"}</span>
        <ChevronDownIcon className="h-3 w-3 text-gray-400 shrink-0" />
      </button>
    );
  }

  return (
    <div className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 rounded-2xl border border-violet-300
        bg-white px-3.5 py-2.5 shadow-sm ring-2 ring-violet-100/60">
        {searching
          ? <SpinnerIcon className="h-4 w-4 text-violet-500 shrink-0" />
          : <SearchIcon  className="h-4 w-4 text-gray-400 shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or address…"
          className="flex-1 bg-transparent text-sm text-gray-800
            placeholder:text-gray-400 focus:outline-none min-w-0"
        />
        <button
          onClick={close}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close search"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown */}
      {(results.length > 0 || searchErr || query.length >= 3) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2
          overflow-hidden rounded-2xl border border-gray-100 bg-white
          shadow-2xl shadow-gray-200/60">

          {/* Use my location */}
          <button
            onClick={() => {
              onUseMyLocation();
              close();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm
              font-medium text-violet-700 hover:bg-violet-50 transition-colors
              border-b border-gray-100"
          >
            <div className="h-7 w-7 rounded-full bg-violet-100 flex
              items-center justify-center shrink-0">
              <TargetIcon className="h-4 w-4 text-violet-600" />
            </div>
            Use my current location
          </button>

          {searchErr && (
            <p className="px-4 py-3 text-xs text-red-500">{searchErr}</p>
          )}

          {results.length === 0 && query.length >= 3 && !searching && !searchErr && (
            <p className="px-4 py-3 text-xs text-gray-400 text-center">
              No results found
            </p>
          )}

          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left
                text-sm hover:bg-gray-50 transition-colors
                border-b border-gray-50 last:border-0"
            >
              <MapPinIcon className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
              <span className="text-gray-700 line-clamp-2 text-xs">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function MassageClinic() {
  const navigate = useNavigate();

  const [searchQuery,    setSearchQuery]    = useState("");
  const [radiusKm,       setRadiusKm]       = useState(DEFAULT_RADIUS_KM);
  const [searchLocation, setSearchLocation] = useState(null);
  const [searchLabel,    setSearchLabel]    = useState("");

  const {
    userLocation,
    locationStatus,
    locationLabel,
    requestLocation,
    setManualLocation,
  } = useGeolocation();

  const { clinics, isLoading, error, hasFetched, loadClinics } =
    useMassageClinics({ searchLocation, radiusKm });

  // ── Bootstrap: request GPS on mount ─────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { requestLocation(); }, []);

  // ── Sync GPS location → search location (first time only) ───────────────
  useEffect(() => {
    if (userLocation && !searchLocation) {
      setSearchLocation(userLocation);
    }
  }, [userLocation, searchLocation]);

  // ── Keep label in sync after reverse-geocode resolves ───────────────────
  useEffect(() => {
    if (locationLabel && searchLocation === userLocation && !searchLabel) {
      setSearchLabel(locationLabel);
    }
  }, [locationLabel, searchLocation, userLocation, searchLabel]);

  // ── Fetch on searchLocation / radius change ──────────────────────────────
  useEffect(() => {
    if (searchLocation) loadClinics();
  }, [searchLocation, radiusKm]); // eslint-disable-line

  // ── Re-validate when page regains focus (handles back navigation) ────────
  useEffect(() => {
    const onFocus = () => loadClinics({ background: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") loadClinics({ background: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadClinics]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLocationSelect = useCallback(
    (pos, label) => {
      const short = label.split(",")[0].trim();
      setSearchLocation(pos);
      setSearchLabel(short);
      setManualLocation(pos, short);
    },
    [setManualLocation]
  );

  const handleUseMyLocation = useCallback(() => {
    if (userLocation) {
      setSearchLocation(userLocation);
      setSearchLabel(locationLabel || "your location");
    } else {
      requestLocation();
    }
  }, [userLocation, locationLabel, requestLocation]);

  // ── Client-side filter ───────────────────────────────────────────────────
  const visibleClinics = searchQuery.trim()
    ? clinics.filter((c) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          (c.name    ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q) ||
          (c.city    ?? "").toLowerCase().includes(q)
        );
      })
    : clinics;

  const effectiveStatus = searchLocation ? "granted" : locationStatus;
  const displayLabel    = searchLabel || locationLabel;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 pb-28">
      <div className="mx-auto w-full max-w-md">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">

          {/* Brand row */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Massage Clinics
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {isLoading
                  ? "Searching…"
                  : displayLabel
                  ? `Near ${displayLabel}`
                  : locationStatus === "loading"
                  ? "Finding your position…"
                  : "Clinics near you"}
              </p>
            </div>

            <LocationSearchBar
              currentLabel={displayLabel}
              onSelect={handleLocationSelect}
              onUseMyLocation={handleUseMyLocation}
            />
          </div>

          {/* Radius + search */}
          <div className="px-4 pb-3 space-y-3">
            {/* Radius slider */}
            {searchLocation && (
              <div className="flex items-center gap-3 rounded-2xl bg-gray-50
                border border-gray-100 px-4 py-2.5">
                <span className="text-xs font-semibold text-gray-500 shrink-0 w-12">
                  Radius
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full accent-violet-600 cursor-pointer"
                  aria-label={`Search radius: ${radiusKm} km`}
                />
                <span className="text-sm font-bold text-violet-700 shrink-0 w-12 text-right">
                  {radiusKm} km
                </span>
              </div>
            )}

            {/* Text search */}
            <div className="flex items-center gap-3 rounded-2xl bg-gray-100
              px-4 py-2.5 focus-within:bg-white focus-within:border
              focus-within:border-violet-200 focus-within:ring-2
              focus-within:ring-violet-100 transition-all duration-200">
              <SearchIcon className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or address…"
                className="flex-1 bg-transparent text-sm text-gray-800
                  placeholder:text-gray-400 focus:outline-none"
                aria-label="Filter clinics by name"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 text-gray-400 hover:text-gray-600
                    p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                  aria-label="Clear filter"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-4 pt-4">
          <ClinicBody
            locationStatus={effectiveStatus}
            locationLabel={displayLabel}
            isLoading={isLoading}
            error={error}
            hasFetched={hasFetched}
            clinics={visibleClinics}
            allClinics={clinics}
            searchQuery={searchQuery}
            onRetry={() => loadClinics()}
            onCreateClinic={() => navigate("/massage-clinics/new")}
            onRequestLocation={requestLocation}
          />
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/massage-clinics/new")}
        className="fixed bottom-28 right-4 z-20 flex h-14 w-14 items-center
          justify-center rounded-full bg-gradient-to-br from-violet-500
          to-violet-700 text-white shadow-lg shadow-violet-200
          hover:shadow-xl hover:scale-105 active:scale-95
          transition-all duration-200"
        aria-label="Create new clinic listing"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

/* ================================================================
   CLINIC BODY
   ================================================================ */

function ClinicBody({
  locationStatus, locationLabel, isLoading, error,
  hasFetched, clinics, allClinics, searchQuery,
  onRetry, onCreateClinic, onRequestLocation,
}) {
  // Locating
  if (locationStatus === "idle" || locationStatus === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4
        py-20 text-center">
        <div className="relative h-14 w-14">
          <span className="absolute inset-0 animate-ping rounded-full
            bg-violet-300 opacity-50" />
          <span className="relative flex h-14 w-14 items-center justify-center
            rounded-full bg-violet-600 shadow-lg shadow-violet-200">
            <MapPinIcon className="h-7 w-7 text-white" />
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Finding your location…</p>
          <p className="text-xs text-gray-400 mt-1">This only takes a moment</p>
        </div>
      </div>
    );
  }

  // Permission denied
  if (locationStatus === "denied" || locationStatus === "unsupported") {
    return (
      <div className="mt-4 rounded-3xl border border-dashed border-amber-200
        bg-gradient-to-b from-amber-50 to-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
          rounded-full bg-white shadow-sm border border-amber-100">
          <MapPinIcon className="h-8 w-8 text-amber-400" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Location Required</h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
          {locationStatus === "unsupported"
            ? "Your browser doesn't support location. Search a city above."
            : "Enable location or search for a city using the button above."}
        </p>
        {locationStatus !== "unsupported" && (
          <button
            onClick={onRequestLocation}
            className="mt-5 inline-flex items-center gap-2 rounded-full
              bg-violet-600 px-6 py-2.5 text-sm font-bold text-white
              shadow-sm hover:bg-violet-700 active:scale-95 transition-all"
          >
            <MapPinIcon className="h-4 w-4" />
            Enable Location
          </button>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Or{" "}
          <button
            onClick={onCreateClinic}
            className="text-violet-600 hover:underline font-medium"
          >
            create a clinic listing
          </button>
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading && !hasFetched) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <ClinicCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="mt-4 rounded-3xl bg-white border border-gray-100
        shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center
          rounded-full bg-red-50">
          <WarningIcon className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Failed to load clinics</h3>
        <p className="mt-1.5 text-xs text-gray-500 max-w-xs mx-auto">{error}</p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full
            bg-violet-600 px-5 py-2.5 text-sm font-bold text-white
            hover:bg-violet-700 transition-colors"
        >
          <RefreshIcon className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  // Filter mismatch
  if (hasFetched && allClinics.length > 0 && clinics.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-gray-200
        bg-white p-6 text-center">
        <p className="text-sm text-gray-500">
          No clinics match{" "}
          <span className="font-semibold text-gray-700">
            &ldquo;{searchQuery}&rdquo;
          </span>
        </p>
      </div>
    );
  }

  // Empty — no clinics in radius
  if (hasFetched && clinics.length === 0) {
    return (
      <ClinicEmptyState
        locationLabel={locationLabel}
        onCreateClinic={onCreateClinic}
        onRetry={onRetry}
      />
    );
  }

  // ── List ──
  return (
    <div className="space-y-5 pb-6">
      {/* Result count + add shortcut */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">
          <span className="font-bold text-gray-800">{clinics.length}</span>{" "}
          clinic{clinics.length !== 1 ? "s" : ""} near{" "}
          <span className="font-medium text-gray-700">
            {locationLabel || "you"}
          </span>
        </p>
        <button
          onClick={onCreateClinic}
          className="inline-flex items-center gap-1.5 rounded-full border
            border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold
            text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Clinic
        </button>
      </div>

      {/* Subtle loading bar for background refetches */}
      {isLoading && hasFetched && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/2 animate-pulse rounded-full
            bg-violet-400 origin-left" />
        </div>
      )}

      <div className="space-y-3">
        {clinics.map((clinic) => (
          <ClinicCard key={clinic.id} clinic={clinic} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   CLINIC CARD
   ================================================================ */

function ClinicCard({ clinic }) {
  const navigate = useNavigate();
  const hours    = todayHours(clinic.opening_hours);
  const rating   = Number(clinic.rating);

  return (
    <button
      onClick={() =>
        navigate(`/massage-clinics/${clinic.id}`, { state: { clinic } })
      }
      className="flex w-full items-stretch gap-3 rounded-3xl bg-white
        border border-gray-100 p-3 text-left shadow-sm
        hover:shadow-md hover:border-violet-100
        active:scale-[0.99] transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl
        bg-gradient-to-br from-violet-100 to-purple-100
        flex items-center justify-center">
        {clinic.cover_url ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ClinicPlaceholderIcon className="h-10 w-10 text-violet-300" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        {/* Top row */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-1">
              {clinic.name}
            </p>
            {clinic.distance_km != null && (
              <span className="shrink-0 rounded-full bg-violet-50 border
                border-violet-100 px-2 py-0.5 text-[11px] font-semibold
                text-violet-700">
                {formatDistanceLabel(clinic.distance_km)}
              </span>
            )}
          </div>

          {/* Address */}
          {(clinic.address || clinic.city) && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <MapPinIcon className="h-3 w-3 text-violet-400 shrink-0" />
              <span className="truncate">
                {[clinic.address, clinic.city].filter(Boolean).join(", ")}
              </span>
            </div>
          )}

          {/* Hours */}
          {hours && (
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <ClockIcon className="h-3 w-3 shrink-0" />
              <span>{hours}</span>
            </div>
          )}

          {/* Pending badge */}
          {clinic.status === "pending" && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full
              bg-amber-50 border border-amber-100 px-2 py-0.5
              text-[10px] font-bold text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Pending approval
            </span>
          )}
        </div>

        {/* Bottom row: rating + call */}
        <div className="flex items-center justify-between mt-1.5">
          {rating > 0 ? (
            <div className="flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-3 w-3 ${
                      i < Math.round(rating)
                        ? "text-amber-400"
                        : "text-gray-200"
                    }`}
                    filled
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-gray-700">
                {rating.toFixed(1)}
              </span>
              {clinic.review_count > 0 && (
                <span className="text-[11px] text-gray-400">
                  ({clinic.review_count})
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">No reviews yet</span>
          )}

          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full
                bg-violet-50 border border-violet-100 px-2.5 py-1
                text-xs font-semibold text-violet-700
                hover:bg-violet-100 transition-colors"
            >
              <PhoneIcon className="h-3 w-3" />
              Call
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */

function ClinicCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-3xl bg-white border border-gray-100
      p-3 animate-pulse">
      <div className="h-[88px] w-[88px] shrink-0 rounded-2xl bg-gray-200" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        <div className="h-3 bg-gray-200 rounded-full w-1/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-10" />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   EMPTY STATE
   ================================================================ */

function ClinicEmptyState({ locationLabel, onCreateClinic, onRetry }) {
  return (
    <div className="space-y-3 mt-4">
      <div className="rounded-3xl border border-dashed border-gray-200
        bg-white p-8 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center
          rounded-full bg-gradient-to-br from-violet-50 to-purple-100">
          <ClinicPlaceholderIcon className="h-10 w-10 text-violet-300" />
        </div>
        <h3 className="text-base font-bold text-gray-900">No Clinics Found</h3>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
          No massage clinics near{" "}
          <span className="font-semibold text-gray-700">
            {locationLabel || "your location"}
          </span>
          . Try widening the radius or search a different area.
        </p>

        <div className="mt-6 flex flex-col items-center gap-2.5">
          <button
            onClick={onCreateClinic}
            className="inline-flex items-center gap-2 rounded-full
              bg-gradient-to-r from-violet-600 to-violet-500 px-6 py-2.5
              text-sm font-bold text-white shadow-md shadow-violet-200
              hover:shadow-lg active:scale-95 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Create a Listing
          </button>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full border
              border-gray-200 bg-white px-5 py-2 text-sm font-medium
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshIcon className="h-4 w-4" />
            Search Again
          </button>
        </div>
      </div>

      {/* Promo card */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50
        border border-violet-100 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-violet-100 flex items-center
            justify-center shrink-0">
            <InfoIcon className="h-5 w-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Own a massage clinic?</p>
            <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
              Create a free listing and reach customers near you — it only
              takes 2 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SVG ICON COMPONENTS
   ================================================================ */

function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function XIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}

function TargetIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6"  />
      <circle cx="12" cy="12" r="2"  fill="currentColor" />
    </svg>
  );
}

function PhoneIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07
        A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18
        0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11
        L6.91 7.91a16 16 0 006.18 6.18l1.27-1.52a2 2 0 012.11-.45
        12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function ClockIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function StarIcon({ className = "h-4 w-4", filled = false }) {
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0
           00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1
           0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538
           1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57
           -1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118
           l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0
           00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function RefreshIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14"  />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9
        0 0020.49 15" />
    </svg>
  );
}

function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
        001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12" y2="8" strokeWidth={2.5} />
      <line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  );
}

function ClinicPlaceholderIcon({ className = "h-10 w-10" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0
        00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0
        00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26
        1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414
        -3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}