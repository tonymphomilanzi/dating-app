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

    return `${format(slot.from)} – ${format(slot.to)}`;
  } catch {
    return null;
  }
};

/* ================================================================
   SVG ICONS
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

const AlertIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HeartIcon = ({ className = "w-5 h-5", filled = false }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const ArrowRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const UsersIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const AwardIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

/* ================================================================
   HOOKS
   ================================================================ */

function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [status, setStatus] = useState("idle");
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
   LOCATION SEARCH BAR
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
  const dropdownRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeSearch();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

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
        className="flex items-center gap-2.5 bg-white/80 backdrop-blur-md border border-gray-200/50 hover:border-violet-300/50 rounded-full px-5 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-white shadow-sm hover:shadow-md"
      >
        <MapPinIcon className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="truncate text-gray-600">{currentLabel || "Choose location"}</span>
        <ChevronDownIcon className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
    );
  }

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      <div className="flex items-center gap-3 bg-white border-2 border-violet-300 rounded-full px-5 py-3 shadow-lg">
        {isSearching ? (
          <SpinnerIcon className="w-4 h-4 text-violet-600 shrink-0" />
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

      {(results.length > 0 || searchError || query.length >= 3) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-3xl border border-gray-100/50 bg-white shadow-2xl backdrop-blur-xl">
          <button
            onClick={handleUseMyLocation}
            className="flex w-full items-center gap-3 px-5 py-4 text-sm font-medium text-violet-700 hover:bg-violet-50/80 transition-colors border-b border-gray-100/50"
          >
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <TargetIcon className="w-4 h-4 text-violet-600" />
            </div>
            Use my current location
          </button>

          {searchError && (
            <p className="px-5 py-3 text-xs text-red-500">{searchError}</p>
          )}

          {results.length === 0 && query.length >= 3 && !isSearching && !searchError && (
            <p className="px-5 py-3 text-xs text-gray-400 text-center">No results found</p>
          )}

          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => handleSelect(result)}
              className="flex w-full items-start gap-3 px-5 py-4 text-left text-sm hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0"
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
  
  const [viewMode, setViewMode] = useState("nearby");
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState("rating");

  const { userLocation, locationLabel, status: locationStatus, requestLocation, setManualLocation } = useGeolocation();
  const [searchLocation, setSearchLocation] = useState(null);

  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (userLocation && !searchLocation && viewMode === "nearby") {
      setSearchLocation(userLocation);
    }
  }, [userLocation, searchLocation, viewMode]);

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

        let processed = (data || []).map((clinic) => {
          const latNum = typeof clinic.lat === "string" ? parseFloat(clinic.lat) : clinic.lat;
          const lngNum = typeof clinic.lng === "string" ? parseFloat(clinic.lng) : clinic.lng;
          
          return {
            ...clinic,
            specialties: clinic.clinic_specialties?.map((s) => s.name) || [],
            distance_km: searchLocation && !isNaN(latNum) && !isNaN(lngNum)
              ? haversineKm(searchLocation, { lat: latNum, lng: lngNum })
              : null,
          };
        });

        if (viewMode === "nearby" && searchLocation) {
          processed = processed.filter((c) => c.distance_km === null || c.distance_km <= radiusKm);
        }

        if (sortBy === "name") {
          processed.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } else if (sortBy === "distance" && viewMode === "nearby") {
          processed.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
        } else {
          processed.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        }

        setClinics(processed);
      } catch (err) {
        console.error("Error loading clinics:", err);
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
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q))
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
      } else if (!userLocation && locationStatus === "granted") {
        setSearchLocation(userLocation);
      }
    }
  };

  const effectiveLocationLabel = searchLocation === userLocation ? locationLabel : 
    (searchLocation ? "selected location" : locationLabel);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-50/50 pb-32">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-2xl border-b border-gray-100/50">
          <div className="px-4 md:px-6 py-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Massage Clinics
                </h1>
                <p className="text-sm text-gray-500 mt-1.5 font-medium">
                  {viewMode === "all" 
                    ? `All clinics • ${filteredClinics.length} available`
                    : effectiveLocationLabel 
                    ? `Near ${effectiveLocationLabel} • ${filteredClinics.length} found`
                    : "Find wellness centers near you"}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-gradient-to-r from-gray-100 to-gray-50 rounded-full p-1.5 mb-5 w-fit">
              <button
                onClick={() => toggleViewMode("nearby")}
                className={`py-2.5 px-6 text-sm font-bold rounded-full transition-all ${
                  viewMode === "nearby"
                    ? "bg-white shadow-lg shadow-violet-100 text-violet-700"
                    : "text-gray-600 hover:text-gray-900"
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
                className={`py-2.5 px-6 text-sm font-bold rounded-full transition-all ${
                  viewMode === "all"
                    ? "bg-white shadow-lg shadow-violet-100 text-violet-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                View All
              </button>
            </div>

            {/* Location & Radius */}
            {viewMode === "nearby" && locationStatus !== "loading" && (
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <LocationSearchBar
                  currentLabel={effectiveLocationLabel}
                  onSelect={handleLocationSelect}
                  onUseMyLocation={requestLocation}
                />

                {searchLocation && (
                  <div className="flex items-center bg-white border border-gray-200/50 rounded-full px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-xs font-bold text-gray-500 mr-3">Within</span>
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="bg-transparent text-sm font-bold focus:outline-none text-violet-700"
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
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-gray-200/50 rounded-full px-5 py-3 text-sm font-bold focus:outline-none focus:border-violet-300 shadow-sm hover:shadow-md transition-shadow"
              >
                <option value="rating">Top Rated</option>
                {viewMode === "nearby" && <option value="distance">Nearest</option>}
                <option value="name">A-Z</option>
              </select>

              <div className="flex-1 relative">
                <SearchIcon className="absolute left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clinics..."
                  className="w-full pl-12 pr-5 py-3 bg-white border border-gray-200/50 rounded-full text-sm focus:outline-none focus:border-violet-300 shadow-sm hover:shadow-md transition-shadow"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 pt-8">
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
        className="fixed bottom-24 right-6 z-20 w-16 h-16 bg-gradient-to-br from-violet-600 to-violet-800 text-white rounded-full shadow-2xl shadow-violet-300/50 hover:shadow-violet-400/60 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
      >
        <PlusIcon className="w-7 h-7 group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
}

/* ================================================================
   STATE COMPONENTS
   ================================================================ */

function LocationDeniedState({ onRequestLocation, onViewAll }) {
  return (
    <div className="text-center py-24 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-100">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <MapPinIcon className="w-10 h-10 text-violet-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">Location Access Needed</h3>
      <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
        Enable location to discover massage clinics near you, or browse all clinics available.
      </p>
      <div className="space-y-3">
        <button
          onClick={onRequestLocation}
          className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white px-8 py-3.5 rounded-full font-bold text-sm mx-auto hover:shadow-lg hover:shadow-violet-300/40 hover:from-violet-700 hover:to-violet-800 transition-all active:scale-95"
        >
          <TargetIcon className="w-4 h-4" />
          Enable Location
        </button>
        <button
          onClick={onViewAll}
          className="block text-violet-600 text-sm font-bold mx-auto hover:text-violet-700 transition-colors"
        >
          View all clinics instead
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm">
          <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-100" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="text-center py-24 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-100">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertIcon className="w-10 h-10 text-red-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-sm text-red-600 mb-8 max-w-sm mx-auto">{error}</p>
      <button
        onClick={onRetry}
        className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white px-8 py-3.5 rounded-full font-bold text-sm mx-auto hover:shadow-lg hover:shadow-violet-300/40 transition-all active:scale-95"
      >
        <RefreshIcon className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ viewMode, searchQuery, locationLabel, onCreateClinic }) {
  return (
    <div className="text-center py-24 bg-gradient-to-br from-white to-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
      <div className="w-24 h-24 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8">
        <span className="text-5xl">💆</span>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">No Clinics Found</h3>
      <p className="text-sm text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
        {searchQuery 
          ? `No clinics match "${searchQuery}"`
          : viewMode === "all"
          ? "No massage clinics are available yet. Be the first to list one!"
          : `No clinics found near ${locationLabel || "your location"}. Try increasing the radius.`}
      </p>
      <button
        onClick={onCreateClinic}
        className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white px-8 py-3.5 rounded-full font-bold text-sm mx-auto hover:shadow-lg hover:shadow-violet-300/40 transition-all active:scale-95"
      >
        <PlusIcon className="w-4 h-4" />
        List Your Clinic
      </button>
    </div>
  );
}

function ClinicsList({ clinics, viewMode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
      {clinics.map((clinic) => (
        <ClinicCard key={clinic.id} clinic={clinic} viewMode={viewMode} />
      ))}
    </div>
  );
}

/* ================================================================
   CLINIC CARD - INSTAGRAM STYLE
   ================================================================ */

function ClinicCard({ clinic, viewMode }) {
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  const hours = todayHours(clinic.opening_hours);
  const rating = Number(clinic.rating) || 0;
  const reviewCount = Number(clinic.review_count) || 0;

  const handleCardClick = () => {
    navigate(`/massage-clinics/${clinic.id}`);
  };

  const handlePhoneClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 hover:border-violet-200"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-violet-100 to-fuchsia-100">
        {/* Image */}
        {clinic.cover_url ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name || "Clinic"}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setIsImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
            <div className="text-center">
              <span className="text-6xl block mb-2">💆</span>
              <span className="text-xs text-gray-400 font-medium">No image</span>
            </div>
          </div>
        )}

        {/* Dark Overlay on Hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Top Right Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          {/* Distance Badge */}
          {clinic.distance_km !== null && clinic.distance_km !== undefined && viewMode === "nearby" && (
            <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-violet-700 shadow-lg">
              {formatDistance(clinic.distance_km)}
            </div>
          )}

          {/* Status Badge */}
          {clinic.status === "pending" && (
            <div className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              Pending
            </div>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorited(!isFavorited);
          }}
          className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <HeartIcon
            className={`w-5 h-5 transition-all ${
              isFavorited ? "text-red-500" : "text-gray-400 hover:text-red-500"
            }`}
            filled={isFavorited}
          />
        </button>

        {/* Bottom Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Bottom Info on Image */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <h3 className="font-bold text-lg text-white line-clamp-1 mb-1">
            {clinic.name || "Unnamed Clinic"}
          </h3>
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`w-3 h-3 ${i < Math.round(rating) ? "text-amber-300" : "text-white/30"}`}
                    filled={i < Math.round(rating)}
                  />
                ))}
              </div>
              <span className="text-xs text-white/90 font-bold">{rating.toFixed(1)}</span>
              {reviewCount > 0 && <span className="text-xs text-white/70">({reviewCount})</span>}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Address */}
        {(clinic.address || clinic.city) && (
          <div className="flex items-start gap-2 mb-3">
            <MapPinIcon className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            <span className="text-xs text-gray-600 line-clamp-2">
              {[clinic.address, clinic.city].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {/* Hours */}
        {hours && (
          <div className="flex items-center gap-2 mb-3 text-xs">
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-600 font-bold">Open Now</span>
            </div>
            <span className="text-gray-500 font-medium">{hours}</span>
          </div>
        )}

        {/* Specialties Tags */}
        {clinic.specialties && clinic.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {clinic.specialties.slice(0, 2).map((specialty, i) => (
              <span
                key={i}
                className="text-[9px] font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full"
              >
                {specialty}
              </span>
            ))}
            {clinic.specialties.length > 2 && (
              <span className="text-[9px] font-bold text-gray-400 px-2.5 py-1">
                +{clinic.specialties.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              onClick={handlePhoneClick}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 text-violet-700 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border border-violet-200/50"
            >
              <PhoneIcon className="w-3.5 h-3.5" />
              Call
            </a>
          )}
          <button
            onClick={handleCardClick}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            View
            <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}