// src/pages/MassageClinic.jsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

/* ================================================================
   CONSTANTS & HELPERS
   ================================================================ */

const DEFAULT_RADIUS_KM = 25;
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const SEARCH_DEBOUNCE_MS = 400;
const GEOCODE_TIMEOUT_MS = 5000;

const formatDistance = (km) => {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
};

const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const todayHours = (openingHours) => {
  try {
    const parsed = typeof openingHours === "string" ? JSON.parse(openingHours) : openingHours;
    if (!Array.isArray(parsed)) return null;
    
    const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      new Date().getDay()
    ];
    const slot = parsed.find((s) => s.day === today);
    if (!slot?.from || !slot?.to) return null;

    const format = (t) => {
      const [h, m] = t.split(":");
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${m} ${ampm}`;
    };

    return `Today • ${format(slot.from)} – ${format(slot.to)}`;
  } catch {
    return null;
  }
};

/* ================================================================
   ICONS (PROPERLY SIZED)
   ================================================================ */

const MapPinIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const SpinnerIcon = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
  </svg>
);

const TargetIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const StarIcon = ({ className = "w-4 h-4", filled = false }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const PhoneIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

/* ================================================================
   HOOKS
   ================================================================ */

function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | granted | denied
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reverseGeocode = async (pos) => {
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`,
        { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) }
      );
      const data = await res.json();
      return data?.address?.city || data?.address?.town || data?.address?.village || "Your area";
    } catch (err) {
      console.warn("Reverse geocoding failed", err);
      return "Your area";
    }
  };

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        if (!mountedRef.current) return;
        
        setUserLocation(pos);
        setStatus("granted");
        
        const label = await reverseGeocode(pos);
        if (mountedRef.current) {
          setLocationLabel(label);
        }
      },
      () => {
        if (mountedRef.current) setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  const setManualLocation = useCallback((pos, label) => {
    setUserLocation(pos);
    setLocationLabel(label);
    setStatus("granted");
  }, []);

  return { userLocation, locationLabel, status, requestLocation, setManualLocation };
}

/* ================================================================
   LOCATION SEARCH BAR (COMPLETE)
   ================================================================ */

function LocationSearchBar({ currentLabel, onSelect, onUseMyLocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Search debounce
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
        const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en" },
          signal: ac.signal,
        });

        if (!mountedRef.current || ac.signal.aborted) return;

        const data = await res.json();
        setResults(
          data.map((r) => ({
            label: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          }))
        );
      } catch (err) {
        if (!ac.signal.aborted && mountedRef.current) {
          setSearchError("Search failed. Try again.");
        }
      } finally {
        if (mountedRef.current) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result) => {
    onSelect({ lat: result.lat, lng: result.lng }, result.label.split(",")[0].trim());
    closeSearch();
  };

  const handleUseMyLocation = () => {
    onUseMyLocation();
    closeSearch();
  };

  const closeSearch = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSearchError("");
  };

  const openSearch = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!isOpen) {
    return (
      <button
        onClick={openSearch}
        className="flex items-center gap-2 bg-white border border-gray-200 hover:border-violet-300 rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-700 transition-all max-w-[160px]"
      >
        <MapPinIcon className="w-4 h-4 text-violet-500 shrink-0" />
        <span className="truncate">{currentLabel || "Choose location"}</span>
        <ChevronDownIcon className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
    );
  }

  return (
    <div className="relative flex-1 min-w-0">
      <div className="flex items-center gap-3 bg-white border-2 border-violet-300 rounded-2xl px-4 py-2.5 shadow-sm">
        {isSearching ? (
          <SpinnerIcon className="w-4 h-4 text-violet-500 shrink-0" />
        ) : (
          <SearchIcon className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or address..."
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none min-w-0"
        />
        <button
          onClick={closeSearch}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown */}
      {(results.length > 0 || searchError || query.length >= 3) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          {/* Use my location */}
          <button
            onClick={handleUseMyLocation}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-50 transition-colors border-b border-gray-100"
          >
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <TargetIcon className="w-4 h-4 text-violet-600" />
            </div>
            Use my current location
          </button>

          {searchError && (
            <p className="px-4 py-3 text-xs text-red-500">{searchError}</p>
          )}

          {results.length === 0 && query.length >= 3 && !isSearching && !searchError && (
            <p className="px-4 py-3 text-xs text-gray-400 text-center">No results found</p>
          )}

          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => handleSelect(result)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <MapPinIcon className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
              <span className="text-gray-700 text-xs line-clamp-2">{result.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function MassageClinic() {
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState("nearby"); // "nearby" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState("rating"); // rating | distance | name

  const { userLocation, locationLabel, status: locationStatus, requestLocation, setManualLocation } = useGeolocation();
  const [searchLocation, setSearchLocation] = useState(null);

  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Bootstrap location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Sync user location to search location
  useEffect(() => {
    if (userLocation && !searchLocation && viewMode === "nearby") {
      setSearchLocation(userLocation);
    }
  }, [userLocation, searchLocation, viewMode]);

  // Load clinics
  useEffect(() => {
    const loadClinics = async () => {
      setIsLoading(true);
      setError("");

      try {
        let query = supabase
          .from("massage_clinics")
          .select(`
            id, name, address, city, cover_url, rating, review_count, 
            lat, lng, phone, opening_hours, status,
            clinic_specialties(name)
          `)
          .in("status", ["approved", "pending"]);

        if (viewMode === "nearby" && searchLocation) {
          const { lat, lng } = searchLocation;
          const latDelta = radiusKm / 111;
          const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

          query = query
            .gte("lat", lat - latDelta)
            .lte("lat", lat + latDelta)
            .gte("lng", lng - lngDelta)
            .lte("lng", lng + lngDelta);
        }

        const { data, error: fetchError } = await query.order("rating", { ascending: false }).limit(100);

        if (fetchError) throw fetchError;

        let processed = (data || []).map((clinic) => ({
          ...clinic,
          specialties: clinic.clinic_specialties?.map((s) => s.name) || [],
          distance_km: searchLocation 
            ? haversineKm(searchLocation, { lat: Number(clinic.lat), lng: Number(clinic.lng) })
            : null,
        }));

        if (viewMode === "nearby" && searchLocation) {
          processed = processed.filter((c) => c.distance_km === null || c.distance_km <= radiusKm);
        }

        // Apply sorting
        if (sortBy === "name") {
          processed.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === "distance" && viewMode === "nearby") {
          processed.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
        } else if (sortBy === "rating") {
          processed.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        }

        setClinics(processed);
      } catch (err) {
        console.error(err);
        setError("Failed to load clinics. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (viewMode === "all" || (viewMode === "nearby" && searchLocation)) {
      loadClinics();
    }
  }, [viewMode, searchLocation, radiusKm, sortBy]);

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

  const handleLocationSelect = (pos, label) => {
    setSearchLocation(pos);
    setManualLocation(pos, label);
    setViewMode("nearby");
  };

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    if (mode === "all") {
      setSearchLocation(null);
    } else if (mode === "nearby") {
      if (userLocation && !searchLocation) {
        setSearchLocation(userLocation);
      } else if (!userLocation) {
        requestLocation();
      }
    }
  };

  const effectiveLocationLabel = searchLocation === userLocation ? locationLabel : 
    (searchLocation ? "selected location" : locationLabel);

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Massage Clinics</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {viewMode === "all" 
                    ? `All clinics • ${filteredClinics.length} found`
                    : effectiveLocationLabel 
                    ? `Near ${effectiveLocationLabel} • ${filteredClinics.length} found`
                    : "Find clinics near you"}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
              <button
                onClick={() => toggleViewMode("nearby")}
                className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all ${
                  viewMode === "nearby"
                    ? "bg-white shadow text-violet-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                disabled={locationStatus === "loading"}
              >
                {locationStatus === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon className="w-4 h-4" />
                    Locating...
                  </span>
                ) : (
                  "Near Me"
                )}
              </button>
              <button
                onClick={() => toggleViewMode("all")}
                className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all ${
                  viewMode === "all"
                    ? "bg-white shadow text-violet-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                View All
              </button>
            </div>

            {/* Location & Radius */}
            {viewMode === "nearby" && locationStatus !== "loading" && (
              <div className="flex gap-3 mb-4">
                <LocationSearchBar
                  currentLabel={effectiveLocationLabel}
                  onSelect={handleLocationSelect}
                  onUseMyLocation={requestLocation}
                />

                {searchLocation && (
                  <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-500 mr-2">Within</span>
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="bg-transparent text-sm font-semibold focus:outline-none text-violet-700"
                    >
                      {[5, 10, 25, 50, 100].map((r) => (
                        <option key={r} value={r}>{r}km</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Sort & Search */}
            <div className="flex gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-violet-300"
              >
                <option value="rating">★ Top Rated</option>
                {viewMode === "nearby" && <option value="distance">📍 Nearest</option>}
                <option value="name">🔤 A-Z</option>
              </select>

              <div className="flex-1 relative">
                <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clinics..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-violet-300"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-6">
          {locationStatus === "denied" && viewMode === "nearby" ? (
            <LocationDeniedState onRequestLocation={requestLocation} onViewAll={() => toggleViewMode("all")} />
          ) : isLoading && clinics.length === 0 ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => window.location.reload()} />
          ) : filteredClinics.length === 0 ? (
            <EmptyState 
              viewMode={viewMode} 
              searchQuery={searchQuery}
              locationLabel={effectiveLocationLabel}
              onCreateClinic={() => navigate("/massage-clinics/new")}
            />
          ) : (
            <ClinicsList clinics={filteredClinics} viewMode={viewMode} />
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/massage-clinics/new")}
        className="fixed bottom-28 right-4 z-20 w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-700 text-white rounded-full shadow-lg shadow-violet-200 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <PlusIcon className="w-6 h-6" />
      </button>
    </div>
  );
}

/* ================================================================
   STATES & COMPONENTS
   ================================================================ */

function LocationDeniedState({ onRequestLocation, onViewAll }) {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
      <MapPinIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-gray-900 mb-2">Location Access Needed</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Enable location to find massage clinics near you, or browse all clinics.
      </p>
      <div className="space-y-3">
        <button
          onClick={onRequestLocation}
          className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm mx-auto"
        >
          <TargetIcon className="w-4 h-4" />
          Enable Location
        </button>
        <button
          onClick={onViewAll}
          className="block text-violet-600 text-sm font-medium mx-auto"
        >
          View all clinics instead
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-3xl p-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-sm text-red-500 mb-6 max-w-xs mx-auto">{error}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm mx-auto"
      >
        <RefreshIcon className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ viewMode, searchQuery, locationLabel, onCreateClinic }) {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">💆‍♀️</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">No Clinics Found</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        {searchQuery 
          ? `No clinics match "${searchQuery}"`
          : viewMode === "all"
          ? "No massage clinics are available yet."
          : `No clinics found near ${locationLabel || "your location"}. Try increasing the radius.`}
      </p>
      <button
        onClick={onCreateClinic}
        className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-violet-700 text-white px-6 py-3 rounded-2xl font-semibold text-sm mx-auto shadow-lg"
      >
        <PlusIcon className="w-4 h-4" />
        List Your Clinic
      </button>
    </div>
  );
}

function ClinicsList({ clinics, viewMode }) {
  return (
    <div className="space-y-4 pb-6">
      {clinics.map((clinic) => (
        <ClinicCard key={clinic.id} clinic={clinic} viewMode={viewMode} />
      ))}
    </div>
  );
}

/* ================================================================
   CLINIC CARD
   ================================================================ */

function ClinicCard({ clinic, viewMode }) {
  const navigate = useNavigate();
  const hours = todayHours(clinic.opening_hours);
  const rating = Number(clinic.rating) || 0;

  return (
    <div
      onClick={() => navigate(`/massage-clinics/${clinic.id}`)}
      className="bg-white rounded-3xl border border-gray-100 hover:border-violet-200 hover:shadow-xl transition-all cursor-pointer group overflow-hidden"
    >
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden">
        {clinic.cover_url ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
            <span className="text-6xl opacity-20">💆‍♀️</span>
          </div>
        )}

        {/* Distance Badge */}
        {clinic.distance_km && viewMode === "nearby" && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-2xl text-xs font-bold text-violet-700 shadow-sm">
            {formatDistance(clinic.distance_km)}
          </div>
        )}

        {/* Status Badge */}
        {clinic.status === "pending" && (
          <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1.5 rounded-2xl text-xs font-bold shadow-sm">
            Pending Approval
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-1 pr-2">{clinic.name}</h3>
          {rating > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-2xl text-sm font-bold shrink-0">
              <StarIcon className="w-4 h-4" filled />
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Address */}
        {(clinic.address || clinic.city) && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <MapPinIcon className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="line-clamp-1">
              {[clinic.address, clinic.city].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {/* Hours */}
        {hours && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 mb-4">
            <ClockIcon className="w-4 h-4 shrink-0" />
            <span>{hours}</span>
          </div>
        )}

        {/* Specialties */}
        {clinic.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {clinic.specialties.slice(0, 3).map((specialty, i) => (
              <span
                key={i}
                className="text-[10px] font-medium bg-violet-50 text-violet-700 px-3 py-1 rounded-full"
              >
                {specialty}
              </span>
            ))}
            {clinic.specialties.length > 3 && (
              <span className="text-[10px] font-medium text-gray-400 px-2 py-1">
                +{clinic.specialties.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          {/* Reviews */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {rating > 0 ? (
              <>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      className={`w-3 h-3 ${i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
                      filled={i < Math.round(rating)}
                    />
                  ))}
                </div>
                {clinic.review_count > 0 && <span>({clinic.review_count} reviews)</span>}
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>

          {/* Call Button */}
          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            >
              <PhoneIcon className="w-3 h-3" />
              Call
            </a>
          )}
        </div>
      </div>
    </div>
  );
}