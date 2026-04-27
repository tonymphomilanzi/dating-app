// src/pages/MassageClinic.jsx
//
// Completely independent bottom-tab page for Massage Clinics.
// Has its own geolocation, data fetching, loading, and error state.
// No shared state with Events.jsx.

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

/* ================================================================
   CONSTANTS
   ================================================================ */

const GEOCODE_TIMEOUT_MS = 5_000;
const GEO_TIMEOUT_MS     = 12_000;
const GEO_MAX_AGE_MS     = 60_000;

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

/* ================================================================
   useGeolocation (self-contained copy — no shared state with Events)
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
    const ac = new AbortController();
    geocodeAbortRef.current = ac;

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
      const city =
        data?.address?.city    ||
        data?.address?.town    ||
        data?.address?.village ||
        data?.address?.county  ||
        data?.address?.state   ||
        "";

      if (mountedRef.current) setLocationLabel(city || "Your area");
    } catch {
      if (!timedOut) clearTimeout(timerId);
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
        const pos = { lat: Number(coords.latitude), lng: Number(coords.longitude) };
        if (!isValidLatLng(pos.lat, pos.lng)) { setLocationStatus("denied"); return; }
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
   useMassageClinics
   ================================================================ */

function useMassageClinics({ userLocation, locationStatus }) {
  const [clinics,    setClinics]    = useState([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const mountedRef   = useRef(true);
  const abortRef     = useRef(null);
  const genRef       = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const loadClinics = useCallback(async () => {
    if (locationStatus !== "granted" || !userLocation) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    genRef.current  += 1;
    const myGen = genRef.current;

    setIsLoading(true);
    setError("");

    try {
      // ── Replace with your real API call ───────────────────────────────
      // const data = await massageClinicService.nearby({
      //   lat: userLocation.lat,
      //   lng: userLocation.lng,
      //   signal: ac.signal,
      // });
      await new Promise((res) => setTimeout(res, 800));
      if (ac.signal.aborted || genRef.current !== myGen) return;
      const data = [];
      // ─────────────────────────────────────────────────────────────────

      if (!mountedRef.current) return;
      setClinics(data ?? []);
      setHasFetched(true);
    } catch (err) {
      if (err?.name === "AbortError" || !mountedRef.current || genRef.current !== myGen) return;
      setError(err?.message || "Failed to load massage clinics");
      setHasFetched(true);
    } finally {
      // ✅ Always clear loading for this generation
      if (mountedRef.current && genRef.current === myGen) {
        setIsLoading(false);
      }
    }
  }, [userLocation, locationStatus]);

  return { clinics, isLoading, error, hasFetched, loadClinics };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function MassageClinic() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");

  const { userLocation, locationStatus, locationLabel, requestLocation } =
    useGeolocation();

  const { clinics, isLoading, error, hasFetched, loadClinics } =
    useMassageClinics({ userLocation, locationStatus });

  // Request location on mount
  useEffect(() => { requestLocation(); }, []); // eslint-disable-line

  // Fetch clinics once location is granted
  useEffect(() => {
    if (locationStatus === "granted" && !hasFetched) {
      loadClinics();
    }
  }, [locationStatus, hasFetched, loadClinics]);

  const handleCreateClinic = useCallback(
    () => navigate("/massage-clinics/new"),
    [navigate]
  );

  // Client-side search filter
  const visibleClinics = searchQuery.trim()
    ? clinics.filter((c) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          (c.name    ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q)
        );
      })
    : clinics;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-24">
      <div className="mx-auto w-full max-w-md">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b
          border-gray-100 px-4 pt-3 pb-3 shadow-sm">

          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Massage Clinics</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {locationStatus === "loading"
                  ? "Finding your position…"
                  : locationLabel
                  ? `Near ${locationLabel}`
                  : "Clinics near you"}
              </p>
            </div>

            {/* Location badge */}
            <button
              onClick={requestLocation}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border
                border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600
                hover:bg-gray-50 transition-colors whitespace-nowrap"
              aria-label="Update location"
            >
              <i className="lni lni-map-marker text-violet-600 text-xs" />
              <span className="max-w-[80px] truncate">
                {locationLabel || (locationStatus === "loading" ? "Locating…" : "Change")}
              </span>
              <i className="lni lni-reload text-gray-400 text-xs" />
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200
            bg-white px-4 py-2.5 shadow-sm
            focus-within:ring-2 focus-within:ring-violet-200 transition-shadow">
            <i className="lni lni-search-alt text-gray-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clinics…"
              className="w-full bg-transparent text-sm text-gray-800
                placeholder:text-gray-400 focus:outline-none"
              aria-label="Search massage clinics"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Clear search"
              >
                <i className="lni lni-close" />
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-4 pt-3">
          <ClinicBody
            locationStatus={locationStatus}
            locationLabel={locationLabel}
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

      {/* FAB — Create Clinic */}
      <button
        onClick={handleCreateClinic}
        className="fixed bottom-28 right-5 z-20 grid h-14 w-14 place-items-center
          rounded-full bg-violet-600 text-white shadow-lg
          hover:bg-violet-700 active:scale-95 transition-transform"
        aria-label="Create new clinic listing"
      >
        <i className="lni lni-plus text-xl" />
      </button>
    </div>
  );
}

/* ================================================================
   CLINIC BODY  — orchestrates loading / error / empty / list states
   ================================================================ */

function ClinicBody({
  locationStatus,
  locationLabel,
  isLoading,
  error,
  hasFetched,
  clinics,
  allClinics,
  searchQuery,
  onRetry,
  onCreateClinic,
  onRequestLocation,
}) {
  // 1. Waiting for location permission
  if (locationStatus === "idle" || locationStatus === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 py-12">
        <div className="relative h-12 w-12">
          <span className="absolute inline-flex h-full w-full animate-ping
            rounded-full bg-violet-400 opacity-50" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center
            rounded-full bg-violet-600">
            <i className="lni lni-map-marker text-white text-xl" />
          </span>
        </div>
        <p className="text-sm text-gray-500">Finding your location…</p>
      </div>
    );
  }

  // 2. Location denied / unsupported
  if (locationStatus === "denied" || locationStatus === "unsupported") {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-amber-200
        bg-amber-50/60 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center
          rounded-full bg-white shadow-sm border border-amber-100">
          <i className="lni lni-map-marker text-amber-400 text-3xl" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Location Required</h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          We need your location to show nearby massage clinics. Please enable
          location access and try again.
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

  // 3. Fetching clinics
  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => <ClinicCardSkeleton key={i} />)}
      </div>
    );
  }

  // 4. Fetch failed
  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-red-200
        bg-red-50 p-6 text-center">
        <i className="lni lni-warning text-3xl text-red-400" />
        <p className="mt-2 text-sm font-medium text-red-600">Failed to load clinics</p>
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

  // 5. Initial load not yet started (shouldn't normally be visible)
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

  // 6. No results from search filter (but clinics exist)
  if (allClinics.length > 0 && clinics.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-200
        bg-gray-50 p-6 text-center text-sm text-gray-500">
        No clinics match "<span className="font-medium">{searchQuery}</span>".
      </div>
    );
  }

  // 7. No clinics found at all
  if (clinics.length === 0) {
    return <ClinicEmptyState locationLabel={locationLabel} onCreateClinic={onCreateClinic} onRetry={onRetry} />;
  }

  // 8. Happy path — clinic list
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          {clinics.length} clinic{clinics.length !== 1 ? "s" : ""} near{" "}
          {locationLabel || "you"}
        </p>
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

/* ================================================================
   CLINIC CARD COMPONENTS
   ================================================================ */

function ClinicCard({ clinic }) {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-gray-200
      bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
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

function ClinicEmptyState({ locationLabel, onCreateClinic, onRetry }) {
  return (
    <div className="mt-6">
      <div className="rounded-3xl border border-dashed border-gray-200
        bg-gradient-to-b from-violet-50/60 to-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center
          rounded-full bg-white shadow-sm border border-gray-100">
          <i className="lni lni-hand text-violet-400 text-4xl" />
        </div>
        <h3 className="text-base font-bold text-gray-900">No Massage Clinics Found</h3>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          We couldn't find any massage clinics near{" "}
          <span className="font-medium text-gray-700">
            {locationLabel || "your location"}
          </span>
          . Be the first to add one!
        </p>
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

      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-8 w-8 grid place-items-center rounded-full bg-violet-100">
            <i className="lni lni-information text-violet-600 text-sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-900">List Your Clinic</p>
            <p className="mt-0.5 text-xs text-violet-700 leading-relaxed">
              Create a listing for your massage clinic and reach customers near you.
              It's free to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}