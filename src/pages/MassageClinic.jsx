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

const GEOCODE_TIMEOUT_MS  = 5_000;
const GEO_TIMEOUT_MS      = 12_000;
const GEO_MAX_AGE_MS      = 60_000;
const DEFAULT_RADIUS_KM   = 25;
const NOMINATIM_BASE      = "https://nominatim.openstreetmap.org";

/* ================================================================
   PURE HELPERS
   ================================================================ */

const isFiniteNum   = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

function formatDistanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1_000)} m` : `${km.toFixed(1)} km`;
}

/** Haversine distance between two {lat,lng} points → km */
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R   = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ================================================================
   GEOCODING HELPERS  (forward + reverse via Nominatim)
   ================================================================ */

async function forwardGeocode(query, signal) {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" }, signal });
  if (!res.ok) throw new Error("Geocoding failed");
  const [first] = await res.json();
  if (!first) throw new Error("Location not found");
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), label: first.display_name };
}

async function reverseGeocodeLabel({ lat, lng }, signal) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res  = await fetch(url, { headers: { "Accept-Language": "en" }, signal });
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
    return () => { mountedRef.current = false; geocodeAbortRef.current?.abort(); };
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
    } catch { clearTimeout(timerId); }
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) { setLocationStatus("unsupported"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: Number(coords.latitude), lng: Number(coords.longitude) };
        if (!isValidLatLng(pos.lat, pos.lng)) { setLocationStatus("denied"); return; }
        if (mountedRef.current) {
          setUserLocation(pos);
          setLocationStatus("granted");
          fetchLabel(pos);
        }
      },
      () => { if (mountedRef.current) setLocationStatus("denied"); },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  }, [fetchLabel]);

  // Allow parent to override location (manual city search)
  const setManualLocation = useCallback((pos, label) => {
    setUserLocation(pos);
    setLocationLabel(label);
    setLocationStatus("granted");
  }, []);

  return { userLocation, locationStatus, locationLabel, requestLocation, setManualLocation };
}

/* ================================================================
   useMassageClinics  — REAL Supabase query
   ================================================================ */

/**
 * Fetches clinics from Supabase.
 *
 * Strategy:
 *   - If PostGIS `nearby_clinics` RPC is available → use it (returns distance_km).
 *   - Otherwise → plain SELECT with bounding-box filter + JS-side distance calc.
 *
 * We query `status IN ('approved','pending')` so owners can see their own
 * pending listings. The RLS policy already restricts what each role can see.
 */
function useMassageClinics({ searchLocation, radiusKm }) {
  const [clinics,    setClinics]    = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const mountedRef = useRef(true);
  const genRef     = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadClinics = useCallback(async () => {
    if (!searchLocation) return;

    genRef.current += 1;
    const myGen = genRef.current;

    setIsLoading(true);
    setError("");

    try {
      const { lat, lng } = searchLocation;

      // ── Try the PostGIS RPC first ──────────────────────────────────────
      // This is the function defined in the SQL migration:
      //   nearby_clinics(p_lat, p_lng, p_radius_km, p_limit)
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "nearby_clinics",
        { p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: 50 }
      );

      if (genRef.current !== myGen || !mountedRef.current) return;

      if (!rpcErr && Array.isArray(rpcData)) {
        // RPC succeeded — data already has distance_km
        setClinics(rpcData);
        setHasFetched(true);
        return;
      }

      // ── Fallback: plain SELECT + bounding-box + JS distance ───────────
      // Used when PostGIS extension is not enabled or RPC doesn't exist yet.
      console.warn("[MassageClinic] RPC failed, falling back to SELECT:", rpcErr?.message);

      // Rough bounding box (1° lat ≈ 111 km)
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
        // RLS already filters by status for regular users.
        // This extra filter is belt-and-suspenders for the fallback path.
        .in("status", ["approved", "pending"])
        .gte("lat", lat - latDelta)
        .lte("lat", lat + latDelta)
        .gte("lng", lng - lngDelta)
        .lte("lng", lng + lngDelta)
        .order("rating", { ascending: false })
        .limit(50);

      if (genRef.current !== myGen || !mountedRef.current) return;
      if (selectErr) throw new Error(selectErr.message);

      // Attach JS-computed distance and sort
      const withDistance = (rows ?? [])
        .map((c) => ({
          ...c,
          specialties : c.clinic_specialties?.map((s) => s.name) ?? [],
          distance_km : haversineKm({ lat, lng }, {
            lat: Number(c.lat),
            lng: Number(c.lng),
          }),
        }))
        .filter((c) => c.distance_km == null || c.distance_km <= radiusKm)
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

      setClinics(withDistance);
      setHasFetched(true);
    } catch (err) {
      if (genRef.current !== myGen || !mountedRef.current) return;
      console.error("[MassageClinic] loadClinics error:", err);
      setError(err?.message || "Failed to load massage clinics");
      setHasFetched(true);
    } finally {
      if (genRef.current === myGen && mountedRef.current) setIsLoading(false);
    }
  }, [searchLocation, radiusKm]);

  return { clinics, isLoading, error, hasFetched, loadClinics };
}

/* ================================================================
   LocationSearchBar
   Lets the user type a city/address and search clinics there.
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
    return () => { mountedRef.current = false; abortRef.current?.abort(); };
  }, []);

  // Debounced forward-geocode as user types
  useEffect(() => {
    if (!query.trim() || query.length < 3) { setResults([]); return; }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setSearching(true);
      setSearchErr("");

      try {
        // Use Nominatim search suggestions (multiple results)
        const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
        const res  = await fetch(url, { headers: { "Accept-Language": "en" }, signal: ac.signal });
        if (!mountedRef.current || ac.signal.aborted) return;
        const data = await res.json();
        setResults(data.map((r) => ({
          label: r.display_name,
          lat  : parseFloat(r.lat),
          lng  : parseFloat(r.lon),
        })));
      } catch (err) {
        if (ac.signal.aborted || !mountedRef.current) return;
        setSearchErr("Search failed");
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, 400); // 400 ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result) => {
    onSelect({ lat: result.lat, lng: result.lng }, result.label);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border
          border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600
          hover:bg-gray-50 transition-colors whitespace-nowrap max-w-[140px]"
        aria-label="Change search location"
      >
        <svg className="h-3 w-3 text-violet-600 shrink-0" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0
               l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="truncate">{currentLabel || "Set location"}</span>
        <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-2 rounded-2xl border border-violet-300
        bg-white px-3 py-2 shadow-sm ring-2 ring-violet-100">
        {searching ? (
          <svg className="h-4 w-4 animate-spin text-violet-500 shrink-0"
            fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or address…"
          className="flex-1 bg-transparent text-sm text-gray-800
            placeholder:text-gray-400 focus:outline-none min-w-0"
        />
        <button onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
          className="text-gray-400 hover:text-gray-600 shrink-0"
          aria-label="Close search">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {(results.length > 0 || searchErr) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5
          overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">

          {/* Use my location option */}
          <button
            onClick={() => { onUseMyLocation(); setOpen(false); setQuery(""); setResults([]); }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm
              text-violet-700 hover:bg-violet-50 transition-colors border-b border-gray-100"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Use my current location</span>
          </button>

          {searchErr && (
            <p className="px-4 py-3 text-xs text-red-500">{searchErr}</p>
          )}

          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="flex w-full items-start gap-2.5 px-4 py-3 text-left
                text-sm hover:bg-gray-50 transition-colors
                border-b border-gray-50 last:border-0"
            >
              <svg className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0
                     l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-700 line-clamp-2">{r.label}</span>
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

  const [searchQuery,  setSearchQuery]  = useState("");
  const [radiusKm,     setRadiusKm]     = useState(DEFAULT_RADIUS_KM);

  // The location we're actually searching around — may differ from
  // the user's physical location (they can search another city).
  const [searchLocation, setSearchLocation] = useState(null);
  const [searchLabel,    setSearchLabel]    = useState("");

  const {
    userLocation,
    locationStatus,
    locationLabel,
    requestLocation,
    setManualLocation,
  } = useGeolocation();

  // Sync searchLocation with the user's physical location once granted
  useEffect(() => {
    if (userLocation && !searchLocation) {
      setSearchLocation(userLocation);
      setSearchLabel(locationLabel || "your location");
    }
  }, [userLocation, locationLabel, searchLocation]);

  // Keep searchLabel in sync when locationLabel updates (reverse-geocode resolves)
  useEffect(() => {
    if (locationLabel && searchLocation === userLocation) {
      setSearchLabel(locationLabel);
    }
  }, [locationLabel, searchLocation, userLocation]);

  const { clinics, isLoading, error, hasFetched, loadClinics } =
    useMassageClinics({ searchLocation, radiusKm });

  // Request physical location on mount
  useEffect(() => { requestLocation(); }, []); // eslint-disable-line

  // Fetch whenever searchLocation or radius changes
  useEffect(() => {
    if (searchLocation) loadClinics();
  }, [searchLocation, radiusKm, loadClinics]);

  // ── Location handlers ────────────────────────────────────────────────────
  const handleLocationSelect = useCallback((pos, label) => {
    // Shorten the label to just the first comma-segment (city name)
    const shortLabel = label.split(",")[0].trim();
    setSearchLocation(pos);
    setSearchLabel(shortLabel);
    setManualLocation(pos, shortLabel);
  }, [setManualLocation]);

  const handleUseMyLocation = useCallback(() => {
    if (userLocation) {
      setSearchLocation(userLocation);
      setSearchLabel(locationLabel || "your location");
    } else {
      requestLocation();
    }
  }, [userLocation, locationLabel, requestLocation]);

  const handleCreateClinic = useCallback(
    () => navigate("/massage-clinics/new"),
    [navigate]
  );

  // ── Client-side name/address search filter ───────────────────────────────
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

  // Derive the effective location status for the body renderer
  const effectiveStatus = searchLocation ? "granted" : locationStatus;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-24">
      <div className="mx-auto w-full max-w-md">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b
          border-gray-100 px-4 pt-3 pb-3 shadow-sm">

          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900">Massage Clinics</h1>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {isLoading
                  ? "Searching…"
                  : searchLabel
                  ? `Near ${searchLabel}`
                  : locationStatus === "loading"
                  ? "Finding your position…"
                  : "Clinics near you"}
              </p>
            </div>

            {/* Location search trigger */}
            <LocationSearchBar
              currentLabel={searchLabel || locationLabel}
              onSelect={handleLocationSelect}
              onUseMyLocation={handleUseMyLocation}
            />
          </div>

          {/* Radius slider */}
          {searchLocation && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-gray-500 shrink-0">Radius</span>
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
              <span className="text-xs font-semibold text-gray-700 w-12 text-right shrink-0">
                {radiusKm} km
              </span>
            </div>
          )}

          {/* Clinic name / address text filter */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200
            bg-white px-4 py-2.5 shadow-sm focus-within:ring-2
            focus-within:ring-violet-200 transition-shadow">
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name or address…"
              className="w-full bg-transparent text-sm text-gray-800
                placeholder:text-gray-400 focus:outline-none"
              aria-label="Filter clinics by name"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Clear filter">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-4 pt-3">
          <ClinicBody
            locationStatus={effectiveStatus}
            locationLabel={searchLabel || locationLabel}
            isLoading={isLoading}
            error={error}
            hasFetched={hasFetched}
            clinics={visibleClinics}
            allClinics={clinics}
            searchQuery={searchQuery}
            onRetry={loadClinics}
            onCreateClinic={handleCreateClinic}
            onRequestLocation={requestLocation}
          />
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={handleCreateClinic}
        className="fixed bottom-28 right-5 z-20 grid h-14 w-14 place-items-center
          rounded-full bg-violet-600 text-white shadow-lg
          hover:bg-violet-700 active:scale-95 transition-transform"
        aria-label="Create new clinic listing"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
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
  if (locationStatus === "idle" || locationStatus === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 py-12">
        <div className="relative h-12 w-12">
          <span className="absolute inline-flex h-full w-full animate-ping
            rounded-full bg-violet-400 opacity-50" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center
            rounded-full bg-violet-600">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0
                   l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
        </div>
        <p className="text-sm text-gray-500">Finding your location…</p>
      </div>
    );
  }

  if (locationStatus === "denied" || locationStatus === "unsupported") {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-amber-200
        bg-amber-50/60 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
          rounded-full bg-white shadow-sm border border-amber-100">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0
                 l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900">Location Required</h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Enable location access or search for a city above.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <button onClick={onRequestLocation}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600
              px-6 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-violet-700 active:scale-95 transition-all">
            Enable Location
          </button>
          <button onClick={onCreateClinic}
            className="text-xs text-violet-600 hover:underline">
            Or create a clinic listing →
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => <ClinicCardSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-red-200
        bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-600">Failed to load clinics</p>
        <p className="mt-1 text-xs text-red-400">{error}</p>
        <button onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-600
            px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Try Again
        </button>
      </div>
    );
  }

  if (!hasFetched) {
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

  if (allClinics.length > 0 && clinics.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-200
        bg-gray-50 p-6 text-center text-sm text-gray-500">
        No clinics match "<span className="font-medium">{searchQuery}</span>".
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <ClinicEmptyState
        locationLabel={locationLabel}
        onCreateClinic={onCreateClinic}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          {clinics.length} clinic{clinics.length !== 1 ? "s" : ""} near {locationLabel || "you"}
        </p>
        <button onClick={onCreateClinic}
          className="inline-flex items-center gap-1.5 rounded-full border
            border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium
            text-violet-700 hover:bg-violet-100 transition-colors">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
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

/* ================================================================
   CLINIC CARD
   ================================================================ */

function ClinicCard({ clinic }) {
  // Parse opening hours from JSON string if needed
  const hours = (() => {
    try {
      const parsed = typeof clinic.opening_hours === "string"
        ? JSON.parse(clinic.opening_hours)
        : clinic.opening_hours;
      if (!Array.isArray(parsed) || !parsed.length) return null;
      // Show today's hours if available
      const today = ["Sunday","Monday","Tuesday","Wednesday",
                     "Thursday","Friday","Saturday"][new Date().getDay()];
      const todaySlot = parsed.find((s) => s.day === today);
      if (todaySlot) return `Today ${to12h(todaySlot.from)}–${to12h(todaySlot.to)}`;
      return null;
    } catch { return null; }
  })();

  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-gray-200
      bg-white p-3 shadow-sm hover:shadow-md transition-shadow">

      {/* Cover image */}
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br
        from-violet-100 to-purple-200 grid place-items-center">
        {clinic.cover_url ? (
          <img src={clinic.cover_url} alt={clinic.name}
            className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <svg className="h-10 w-10 text-violet-300" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6
                 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05
                 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0
                 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415
                 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2
                 2 0 009 10.172V5L8 4z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{clinic.name}</p>
            {clinic.distance_km != null && (
              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5
                text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
                {formatDistanceLabel(clinic.distance_km)}
              </span>
            )}
          </div>

          {clinic.address && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <svg className="h-3 w-3 shrink-0 text-violet-500" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827
                     0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{clinic.address}</span>
            </div>
          )}

          {hours && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{hours}</span>
            </div>
          )}

          {/* Status badge for pending (owner view) */}
          {clinic.status === "pending" && (
            <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5
              text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
              Pending approval
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          {clinic.rating != null && Number(clinic.rating) > 0 && (
            <div className="flex items-center gap-0.5 text-xs text-amber-500">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07
                  3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588
                  1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921
                  -.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175
                  0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1
                  1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1
                  1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-semibold">{Number(clinic.rating).toFixed(1)}</span>
              {clinic.review_count > 0 && (
                <span className="text-gray-400 ml-0.5">({clinic.review_count})</span>
              )}
            </div>
          )}
          {clinic.phone && (
            <a href={`tel:${clinic.phone}`}
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline"
              onClick={(e) => e.stopPropagation()}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498
                     4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042
                     0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493
                     1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716
                     21 3 14.284 3 6V5z" />
              </svg>
              Call
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SKELETON / EMPTY STATES
   ================================================================ */

function ClinicCardSkeleton() {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-gray-100
      bg-white p-3 animate-pulse">
      <div className="h-24 w-24 shrink-0 rounded-xl bg-gray-100" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
      </div>
    </div>
  );
}

function ClinicEmptyState({ locationLabel, onCreateClinic, onRetry }) {
  return (
    <div className="mt-6">
      <div className="rounded-3xl border border-dashed border-gray-200
        bg-gradient-to-b from-violet-50/60 to-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center
          rounded-full bg-white shadow-sm border border-gray-100">
          <svg className="h-10 w-10 text-violet-300" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0
                 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2
                 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586
                 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782
                 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900">No Massage Clinics Found</h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          No clinics near{" "}
          <span className="font-medium text-gray-700">{locationLabel || "your location"}</span>.
          Try widening the radius or searching a different area.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <button onClick={onCreateClinic}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600
              px-6 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-violet-700 active:scale-95 transition-all">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Massage Clinic
          </button>
          <button onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full border
              border-gray-200 bg-white px-4 py-2 text-sm text-gray-600
              hover:bg-gray-50 transition-colors">
            Search Again
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-violet-100">
            <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-900">List Your Clinic</p>
            <p className="mt-0.5 text-xs text-violet-700 leading-relaxed">
              Create a free listing and reach customers near you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared time formatter (reused from CreateMassageClinic) ── */
function to12h(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}