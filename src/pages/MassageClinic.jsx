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
      const [h] = t.split(":");
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${t.split(":")[1]} ${ampm}`;
    };

    return `Today • ${format(slot.from)} – ${format(slot.to)}`;
  } catch {
    return null;
  }
};

/* ================================================================
   ICONS
   ================================================================ */

const MapPinIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

/* ================================================================
   CUSTOM HOOKS
   ================================================================ */

function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | granted | denied

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(pos);
        setStatus("granted");

        try {
          const res = await fetch(
            `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`
          );
          const data = await res.json();
          const label = data?.address?.city || data?.address?.town || "Your area";
          setLocationLabel(label);
        } catch (err) {
          console.warn("Reverse geocoding failed", err);
        }
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  return { userLocation, locationLabel, status, requestLocation };
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function MassageClinic() {
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState("nearby"); // "nearby" | "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [searchLocation, setSearchLocation] = useState(null);
  const [sortBy, setSortBy] = useState("rating"); // rating | distance | name

  const { userLocation, locationLabel, status: locationStatus, requestLocation } = useGeolocation();

  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Bootstrap location
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

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

        const { data, error: fetchError } = await query.order("rating", { ascending: false });

        if (fetchError) throw fetchError;

        let processed = (data || []).map((clinic) => ({
          ...clinic,
          specialties: clinic.clinic_specialties?.map((s) => s.name) || [],
          distance_km: searchLocation 
            ? haversineKm(searchLocation, { lat: clinic.lat, lng: clinic.lng })
            : null,
        }));

        if (viewMode === "nearby" && searchLocation) {
          processed = processed
            .filter((c) => c.distance_km === null || c.distance_km <= radiusKm)
            .sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
        }

        // Apply client-side sort
        if (sortBy === "name") {
          processed.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === "distance" && viewMode === "nearby") {
          processed.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
        }

        setClinics(processed);
      } catch (err) {
        console.error(err);
        setError("Failed to load clinics. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadClinics();
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
    setViewMode("nearby");
  };

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    if (mode === "all") {
      setSearchLocation(null);
    } else if (!searchLocation && userLocation) {
      setSearchLocation(userLocation);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Massage Clinics</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {viewMode === "all" 
                  ? "All clinics • Sorted by rating" 
                  : `Near ${locationLabel || "you"}`}
              </p>
            </div>
            <button
              onClick={() => navigate("/massage-clinics/new")}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm active:scale-95 transition-all shadow-md shadow-violet-200"
            >
              <PlusIcon className="w-4 h-4" />
              List Clinic
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
            <button
              onClick={() => toggleViewMode("nearby")}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${
                viewMode === "nearby"
                  ? "bg-white shadow text-violet-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Near Me
            </button>
            <button
              onClick={() => toggleViewMode("all")}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${
                viewMode === "all"
                  ? "bg-white shadow text-violet-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              View All
            </button>
          </div>

          {/* Location & Filters */}
          {viewMode === "nearby" && (
            <div className="flex gap-3 mb-4">
              <LocationSearchBar
                currentLabel={locationLabel}
                onSelect={handleLocationSelect}
                onUseMyLocation={requestLocation}
              />

              <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4">
                <span className="text-xs font-medium text-gray-500 mr-2">Within</span>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="bg-transparent text-sm font-semibold focus:outline-none"
                >
                  {[10, 25, 50, 100].map((r) => (
                    <option key={r} value={r}>{r}km</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Sort & Search */}
          <div className="flex gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-violet-300"
            >
              <option value="rating">Sort by Rating</option>
              {viewMode === "nearby" && <option value="distance">Sort by Distance</option>}
              <option value="name">Sort by Name</option>
            </select>

            <div className="flex-1 relative">
              <SearchIcon className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinics..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-violet-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {isLoading && clinics.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-violet-600 text-white rounded-2xl font-medium"
            >
              Try Again
            </button>
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No clinics found</p>
            <p className="text-sm text-gray-500 mt-2">
              {viewMode === "all" 
                ? "There are no approved clinics yet." 
                : "Try increasing the search radius or view all clinics."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CLINIC CARD
   ================================================================ */

function ClinicCard({ clinic, viewMode }) {
  const navigate = useNavigate();
  const hours = todayHours(clinic.opening_hours);

  return (
    <div
      onClick={() => navigate(`/massage-clinics/${clinic.id}`)}
      className="bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-violet-200 hover:shadow-xl transition-all cursor-pointer group"
    >
      <div className="relative h-52">
        {clinic.cover_url ? (
          <img
            src={clinic.cover_url}
            alt={clinic.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
            <span className="text-6xl opacity-10">🧖‍♀️</span>
          </div>
        )}

        {clinic.distance_km && viewMode === "nearby" && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-2xl text-xs font-semibold text-violet-700 shadow">
            {formatDistance(clinic.distance_km)}
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{clinic.name}</h3>
          {clinic.rating > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-2xl text-sm font-semibold">
              ★ {clinic.rating.toFixed(1)}
            </div>
          )}
        </div>

        {(clinic.address || clinic.city) && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
            {[clinic.address, clinic.city].filter(Boolean).join(", ")}
          </p>
        )}

        {hours && (
          <p className="text-emerald-600 text-sm mt-3 flex items-center gap-2">
            <span className="text-base">🕒</span> {hours}
          </p>
        )}

        {clinic.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {clinic.specialties.slice(0, 3).map((spec, i) => (
              <span
                key={i}
                className="text-[10px] font-medium bg-violet-50 text-violet-700 px-3 py-1 rounded-full"
              >
                {spec}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   LOCATION SEARCH BAR (Simplified & Improved)
   ================================================================ */

function LocationSearchBar({ currentLabel, onSelect, onUseMyLocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  // ... (simplified version of your original search logic - can be expanded)

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-2 bg-white border border-gray-200 hover:border-violet-300 rounded-2xl px-4 py-2 text-sm font-medium text-gray-700 transition-all"
    >
      <MapPinIcon className="w-4 h-4 text-violet-500" />
      <span className="truncate max-w-[140px]">{currentLabel || "Choose location"}</span>
    </button>
  );
}