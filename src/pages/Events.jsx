// src/pages/Events.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { eventsService } from "../services/events.service.js";

/* ---------------- Revalidate Hook (dedup/abort/cooldown) ---------------- */
function useRevalidate({
  refetch,
  intervalMs = 0,
  onFocus = true,
  onVisibility = true,
  onOnline = true,
  cooldownMs = 1000,
} = {}) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const lastFetchTime = useRef(0);
  const isInFlight = useRef(false);
  const isQueued = useRef(false);
  const timerRef = useRef(null);

  const fire = useCallback(() => {
    const now = Date.now();
    
    const run = () => {
      isInFlight.current = true;
      Promise.resolve(refetchRef.current?.())
        .catch(() => {})
        .finally(() => {
          isInFlight.current = false;
          lastFetchTime.current = Date.now();
          if (isQueued.current) {
            isQueued.current = false;
            fire();
          }
        });
    };

    if (isInFlight.current) {
      isQueued.current = true;
      return;
    }
    
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < cooldownMs) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, cooldownMs - timeSinceLastFetch);
      return;
    }
    
    run();
  }, [cooldownMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fire();
    };
    
    if (onFocus) window.addEventListener("focus", fire, { passive: true });
    if (onVisibility) document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
    if (onOnline) window.addEventListener("online", fire, { passive: true });

    let intervalId = null;
    if (intervalMs > 0) intervalId = setInterval(fire, intervalMs);

    return () => {
      if (onFocus) window.removeEventListener("focus", fire);
      if (onVisibility) document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (onOnline) window.removeEventListener("online", fire);
      if (intervalId) clearInterval(intervalId);
      clearTimeout(timerRef.current);
    };
  }, [intervalMs, onFocus, onVisibility, onOnline, fire]);
}

/* ---------------- Geo and Date Helpers ---------------- */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

function calculateKmBetween(pointA, pointB) {
  if (
    !pointA || 
    !pointB || 
    pointA.lat == null || 
    pointA.lng == null || 
    pointB.lat == null || 
    pointB.lng == null
  ) {
    return Infinity;
  }
  
  const EARTH_RADIUS_KM = 6371;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const lat1Rad = toRadians(pointA.lat);
  const lat2Rad = toRadians(pointB.lat);
  
  const haversine = 
    Math.sin(deltaLat / 2) ** 2 + 
    Math.sin(deltaLng / 2) ** 2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistanceLabel(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function formatDateLabel(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function extractDayMonth(isoString) {
  if (!isoString) return { day: "--", month: "---" };
  const date = new Date(isoString);
  return { 
    day: String(date.getDate()).padStart(2, "0"), 
    month: date.toLocaleDateString([], { month: "short" }) 
  };
}

/* ---------------- Map Pin Icon ---------------- */
const pinIcon = L.divIcon({
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -34],
  html: `
    <div style="
      width:40px;height:40px;border-radius:9999px;
      background:linear-gradient(135deg,#f0abfc 0%,#7c3aed 100%);
      display:flex;align-items:center;justify-content:center;
      color:#fff;border:2px solid #fff;
      box-shadow:0 10px 24px rgba(124,58,237,0.35);
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 21s-7-4.35-7-10a7 7 0 1114 0c0 5.65-7 10-7 10z" fill="rgba(255,255,255,0.25)"/>
        <circle cx="12" cy="10" r="3" fill="#fff"/>
      </svg>
    </div>
  `,
});

/* ---------------- Main Events Page ---------------- */
export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode and filters
  const [mode, setMode] = useState("explore"); // explore | near
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState(50);
  const [viewType, setViewType] = useState("list"); // list | map
  const [selectedCategory, setSelectedCategory] = useState("All");

  // User location
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("loading");
  const [locationLabel, setLocationLabel] = useState("");

  // Data
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Map server response to UI format
// In Events.jsx - update the mapServerRowsToUIFormat function
const mapServerRowsToUIFormat = useCallback((rows) => {
  return rows.map((event) => {
    // City should now be populated from reverse geocoding
    const placeName = event.city || "Location TBD";

    const latitude = event.lat != null ? Number(event.lat) : null;
    const longitude = event.lng != null ? Number(event.lng) : null;

    return {
      id: event.id,
      title: event.title || "Untitled Event",
      description: event.description || "",
      img: event.cover_url || "",
      dateISO: event.starts_at,
      dateLabel: formatDateLabel(event.starts_at),
      ...extractDayMonth(event.starts_at),
      category: event.category || "Other",
      place: placeName,
      lat: latitude,
      lng: longitude,
      price: event.price != null ? Number(event.price) : 0,
      created_at: event.created_at,
    };
  });
}, []);

  // Fetch events from API
  const fetchEvents = useCallback(async ({ signal } = {}) => {
    return await eventsService.list({ signal });
  }, []);

  // Refresh with deduplication/abort/throttle
  const inflightRequestRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const abortControllerRef = useRef(null);

  const refresh = useCallback(
    async ({ foreground = false } = {}) => {
      const now = Date.now();
      
      // Prevent duplicate requests
      if (inflightRequestRef.current) return inflightRequestRef.current;
      
      // Throttle rapid requests
      if (now - lastFetchTimeRef.current < 400) return;

      if (foreground && events.length === 0) setIsLoading(true);

      // Abort previous request
      abortControllerRef.current?.abort?.();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      inflightRequestRef.current = (async () => {
        try {
          const rows = await fetchEvents({ signal: abortController.signal });
          if (!isMountedRef.current) return;
          
          setEvents(mapServerRowsToUIFormat(rows));
          setError("");
        } catch (err) {
          if (!isMountedRef.current) return;
          if (err?.name === "AbortError") return;
          
          const status = err?.status || err?.response?.status;
          if (status === 401 || /session expired/i.test(err?.message || "")) {
            setError("Session expired. Please sign in again.");
            return;
          }
          
          const errorMessage = 
            err?.message || 
            err?.error || 
            err?.response?.data?.message || 
            err?.response?.data?.error ||
            "Failed to load events";
          
          setError(errorMessage);
        } finally {
          if (foreground && isMountedRef.current) setIsLoading(false);
          lastFetchTimeRef.current = Date.now();
          inflightRequestRef.current = null;
        }
      })();

      return inflightRequestRef.current;
    },
    [events.length, fetchEvents, mapServerRowsToUIFormat]
  );

  // Initial load
  useEffect(() => {
    refresh({ foreground: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle newly created event from navigation state
  useEffect(() => {
    const createdEvent = location.state?.created;
    if (createdEvent) {
      setEvents((prevEvents) => 
        prevEvents.some((e) => e.id === createdEvent.id) 
          ? prevEvents 
          : [createdEvent, ...prevEvents]
      );
      navigate("/events", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // Auto-refresh in background
  useRevalidate({
    refetch: () => refresh({ foreground: false }),
    intervalMs: 60_000,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
    cooldownMs: 1000,
  });

  // Get user's geolocation
  function getUserLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }
    
    setLocationStatus("loading");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { 
          lat: Number(position.coords.latitude), 
          lng: Number(position.coords.longitude) 
        };
        setUserLocation(coords);
        setLocationStatus("granted");
        reverseGeocodeLocation(coords).catch(() => {});
      },
      () => {
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  }

  async function reverseGeocodeLocation({ lat, lng }) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await response.json().catch(() => ({}));
    
    const cityName =
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.county ||
      data?.address?.state ||
      "";
    
    setLocationLabel(cityName || "Your area");
  }

  // Get location on mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Categories derived from events data
  const categories = useMemo(() => {
    const categorySet = new Set(events.map((event) => event.category).filter(Boolean));
    return ["All", ...Array.from(categorySet).sort()];
  }, [events]);

  // Filtered and sorted events for Explore mode
  const filteredExploreEvents = useMemo(() => {
    let result = events.slice();
    
    // Filter by category
    if (selectedCategory !== "All") {
      result = result.filter((event) => event.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((event) => 
        (event.title || "").toLowerCase().includes(query) || 
        (event.place || "").toLowerCase().includes(query)
      );
    }
    
    // Sort by date, then by distance if location available
    result.sort((a, b) => 
      new Date(a.dateISO) - new Date(b.dateISO) || 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    if (userLocation) {
      result = result
        .map((event) => ({ ...event, _distance: calculateKmBetween(userLocation, event) }))
        .sort((a, b) => 
          new Date(a.dateISO) - new Date(b.dateISO) || 
          a._distance - b._distance
        )
        .map(({ _distance, ...rest }) => rest);
    }
    
    return result;
  }, [events, selectedCategory, searchQuery, userLocation]);

  const popularEvents = useMemo(() => filteredExploreEvents.slice(0, 12), [filteredExploreEvents]);
  const upcomingEvents = useMemo(() => filteredExploreEvents.slice(0, 10), [filteredExploreEvents]);

  // Events near user location
  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];
    
    // Only include events with valid coordinates
    const eventsWithCoordinates = events.filter(
      (event) => event.lat != null && event.lng != null
    );
    
    // Calculate distance for each event
    const eventsWithDistance = eventsWithCoordinates.map((event) => ({ 
      ...event, 
      distanceKm: calculateKmBetween(userLocation, event) 
    }));
    
    // Filter by radius and valid distance
    let result = eventsWithDistance.filter(
      (event) => event.distanceKm <= radius && event.distanceKm !== Infinity
    );
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((event) => 
        (event.title || "").toLowerCase().includes(query) || 
        (event.place || "").toLowerCase().includes(query)
      );
    }
    
    // Sort by distance
    result.sort((a, b) => a.distanceKm - b.distanceKm);
    
    return result;
  }, [events, userLocation, radius, searchQuery]);

  const openEventDetail = (event) => navigate(`/events/${event.id}`, { state: { event } });

  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-24">
      <div className="mx-auto w-full max-w-md">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            {/* Mode Toggle */}
            <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
              {["explore", "near"].map((modeOption) => (
                <button
                  key={modeOption}
                  onClick={() => setMode(modeOption)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    mode === modeOption 
                      ? "bg-violet-600 text-white shadow" 
                      : "text-gray-700 hover:bg-violet-50"
                  }`}
                >
                  {modeOption === "explore" ? "Explore" : "Near You"}
                </button>
              ))}
            </div>

            {/* Location Button */}
            <button
              onClick={getUserLocation}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              title="Update location"
            >
              <i className="lni lni-map-marker text-violet-600" />
              {locationLabel || 
                (locationStatus === "loading" ? "Locating…" : 
                 locationStatus === "denied" ? "Location off" : "Change")}
              <i className="lni lni-reload text-gray-400" />
            </button>
          </div>

          {/* Search + Create */}
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <i className="lni lni-search-alt text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={mode === "explore" ? "Search for event" : "Search nearby events"}
                className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
              <Link
                to="/events/new"
                className="grid h-9 w-9 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
                aria-label="Create event"
                title="Create event"
              >
                <i className="lni lni-plus" />
              </Link>
            </div>
            
            {/* Status Line */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <i className="lni lni-navigation text-violet-600" />
              {mode === "near" ? (
                <span className="text-gray-600">
                  {locationStatus === "loading" 
                    ? "Finding your position…" 
                    : `${nearbyEvents.length} results within ${radius} km of `}
                  <span className="font-medium text-gray-800">
                    {locationLabel || "your area"}
                  </span>
                </span>
              ) : (
                <span className="text-gray-600">Discover top picks and upcoming events</span>
              )}
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="px-4 pt-3">
          {isLoading ? (
            <LoadingCard />
          ) : error ? (
            <ErrorCard
              error={error}
              onRetry={() => refresh({ foreground: true })}
              onSignIn={() => navigate("/login", { state: { from: "/events" } })}
            />
          ) : events.length === 0 ? (
            <EmptyCreate onCreate={() => navigate("/events/new")} />
          ) : mode === "explore" ? (
            <ExploreSection
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              popularEvents={popularEvents}
              upcomingEvents={upcomingEvents}
              openEventDetail={openEventDetail}
            />
          ) : (
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
        </div>
      </div>

      {/* Floating Create Button */}
      <Link
        to="/events/new"
        className="fixed bottom-28 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
        title="Create"
      >
        <i className="lni lni-plus" />
      </Link>
    </div>
  );
}

/* ---------------- Explore Section ---------------- */
function ExploreSection({ 
  categories, 
  selectedCategory, 
  setSelectedCategory, 
  popularEvents, 
  upcomingEvents, 
  openEventDetail 
}) {
  const countsByCategory = useMemo(() => {
    const allEvents = [...popularEvents, ...upcomingEvents];
    const counts = { All: allEvents.length };
    
    for (const category of categories.slice(1)) {
      counts[category] = allEvents.filter((event) => event.category === category).length;
    }
    
    return counts;
  }, [categories, popularEvents, upcomingEvents]);

  return (
    <>
      {/* Featured Event */}
      {popularEvents[0] && (
        <div className="mt-4">
          <div 
            className="relative overflow-hidden rounded-3xl shadow-lg cursor-pointer"
            onClick={() => openEventDetail(popularEvents[0])}
          >
            <img
              src={popularEvents[0].img}
              alt={popularEvents[0].title}
              className="h-56 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="text-xs opacity-80">Featured Event</div>
              <div className="text-xl font-bold">{popularEvents[0].title}</div>
              <div className="text-sm opacity-90">{popularEvents[0].place}</div>
            </div>
          </div>
        </div>
      )}

      <HeaderRow title="Popular Events" />
      
      {/* Category Filters */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={[
              "shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors border",
              selectedCategory === category 
                ? "bg-violet-600 text-white border-violet-600 shadow" 
                : "bg-white text-gray-800 border-gray-200 hover:bg-violet-50",
            ].join(" ")}
          >
            <span>{category}</span>
            <span
              className={[
                "rounded-full px-1.5 text-[11px]",
                selectedCategory === category 
                  ? "bg-white/20 text-white" 
                  : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {countsByCategory[category] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Popular Events Carousel */}
      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1">
        {popularEvents.length === 0 && (
          <div className="w-full text-sm text-gray-500">No events found.</div>
        )}
        {popularEvents
          .filter((event) => selectedCategory === "All" || event.category === selectedCategory)
          .map((event) => (
            <EventCard key={event.id} event={event} onClick={() => openEventDetail(event)} />
          ))}
      </div>

      <HeaderRow title="Upcoming Events" />
      
      {/* Upcoming Events List */}
      <div className="mt-3 space-y-3">
        {upcomingEvents.map((event) => (
          <UpcomingEventRow key={event.id} event={event} onOpen={openEventDetail} />
        ))}
      </div>
    </>
  );
}

/* ---------------- Event Card (Popular Section) ---------------- */
function EventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-[265px] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-card hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative h-44">
        {event.img ? (
          <img 
            src={event.img} 
            alt={event.title} 
            className="h-full w-full object-cover" 
            draggable={false} 
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">
            No cover
          </div>
        )}
        
        {/* Date Badge */}
        <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
          {event.dateLabel}
        </div>
        
        {/* Category Badge */}
        <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-gray-800 ring-1 ring-gray-200">
          {event.category}
        </div>
        
        {/* Gradient Overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        
        {/* Title and Price */}
        <div className="absolute inset-x-2 bottom-2 flex items-end justify-between">
          <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
            {event.title}
          </div>
          <div className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
            ${event.price}
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <i className="lni lni-map-marker text-violet-600" />
          {event.place}
        </div>
      </div>
    </button>
  );
}

/* ---------------- Near You Section ---------------- */
function NearYouSection({ 
  userLocation, 
  radius, 
  setRadius, 
  viewType, 
  setViewType, 
  events, 
  openEventDetail 
}) {
  return (
    <>
      {/* Controls */}
      <div className="mt-5 flex items-center justify-between">
        <RadiusSlider value={radius} onChange={setRadius} />
        
        {/* View Toggle */}
        <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
          <button
            onClick={() => setViewType("list")}
            className={`rounded-full px-3 py-1.5 text-sm ${
              viewType === "list" 
                ? "bg-violet-600 text-white" 
                : "text-gray-700 hover:bg-violet-50"
            }`}
          >
            <i className="lni lni-list" /> List
          </button>
          <button
            onClick={() => setViewType("map")}
            className={`rounded-full px-3 py-1.5 text-sm ${
              viewType === "map" 
                ? "bg-violet-600 text-white" 
                : "text-gray-700 hover:bg-violet-50"
            }`}
          >
            <i className="lni lni-map" /> Map
          </button>
        </div>
      </div>

      {/* Map or List View */}
      {viewType === "map" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
          {userLocation ? (
            <NearbyEventsMap 
              center={userLocation} 
              events={events} 
              onOpenEvent={openEventDetail} 
            />
          ) : (
            <div className="aspect-[16/9] grid place-items-center text-sm text-gray-500">
              Locating…
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {events.length === 0 ? (
            <EmptyState message={`No events within ${radius} km. Try widening the radius.`} />
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
    </>
  );
}

/* ---------------- Nearby Event Card ---------------- */
function NearbyEventCard({ event, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-card hover:shadow-md active:scale-[0.99]"
    >
      <div className="h-20 w-28 overflow-hidden rounded-lg bg-gray-100">
        {event.img ? (
          <img 
            src={event.img} 
            alt={event.title} 
            className="h-full w-full object-cover" 
            draggable={false} 
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-gray-400">
            No cover
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-semibold">{event.title}</div>
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
            {formatDistanceLabel(event.distanceKm)} away
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <i className="lni lni-map-marker text-violet-600" />
          {event.place}
        </div>
        <div className="mt-1 text-sm font-semibold text-violet-700">
          ${event.price}
          <span className="text-[11px] text-gray-500">/Person</span>
        </div>
      </div>
    </button>
  );
}

/* ---------------- Shared Components ---------------- */
function RadiusSlider({ value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600">Radius</span>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-40 appearance-none rounded-full bg-gray-200 accent-violet-600"
        aria-label="Search radius"
      />
      <span className="text-sm font-medium text-gray-800 w-12 text-right">{value} km</span>
    </div>
  );
}

function HeaderRow({ title }) {
  return (
    <div className="mt-6 flex items-center">
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function UpcomingEventRow({ event, onOpen }) {
  return (
    <button
      onClick={() => onOpen(event)}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-card hover:shadow-md active:scale-[0.99]"
    >
      {/* Date Box */}
      <div className="grid w-14 place-items-center rounded-xl border border-gray-200 bg-white">
        <div className="text-center leading-tight">
          <div className="text-lg font-bold text-violet-700">{event.day}</div>
          <div className="text-[11px] text-gray-500">{event.month}</div>
        </div>
      </div>
      
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* Thumbnail */}
        <div className="h-16 w-24 overflow-hidden rounded-lg bg-gray-100">
          {event.img ? (
            <img 
              src={event.img} 
              alt={event.title} 
              className="h-full w-full object-cover" 
              draggable={false} 
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-gray-400">
              No cover
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{event.title}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <i className="lni lni-map-marker text-violet-600" />
            {event.place}
          </div>
          <div className="mt-1 text-sm font-semibold text-violet-700">
            ${event.price}
            <span className="text-[11px] text-gray-500">/Person</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyCreate({ onCreate }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-500">
        <i className="lni lni-calendar text-2xl" />
      </div>
      <div className="mt-3 text-sm text-gray-700">No events yet</div>
      <p className="mt-1 text-xs text-gray-500">Create or discover events near you.</p>
      <div className="mt-4 flex justify-center">
        <button className="btn-primary" onClick={onCreate}>
          <i className="lni lni-plus mr-1" /> Create event
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
      {message}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
        <span className="relative inline-block h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
        </span>
        <span className="text-sm font-medium text-gray-700">Loading…</span>
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry, onSignIn }) {
  const isAuthError = /session expired|unauthorized|401/i.test(
    error?.message || error?.error || (typeof error === 'string' ? error : "")
  );
  
  const errorMessage = 
    error?.message || 
    error?.error || 
    (typeof error === 'string' ? error : 'An unexpected error occurred');

  return (
    <div className="grid h-[60vh] place-items-center text-center">
      <div>
        <p className={isAuthError ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
          {isAuthError ? "You need to sign in" : "Failed to load"}
        </p>
        <p className="mt-1 text-xs text-gray-500">{errorMessage}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {isAuthError ? (
            <button className="btn-primary" onClick={onSignIn}>
              <i className="lni lni-unlock mr-1" />
              Sign in
            </button>
          ) : (
            <button className="btn-outline" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NearbyEventsMap({ center, events, onOpenEvent }) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height: 340, width: "100%" }}
      className="touch-pan-y"
      zoomControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <RecenterMap position={[center.lat, center.lng]} />
      {events.map((event) => (
        <Marker 
          key={event.id} 
          position={[event.lat, event.lng]} 
          icon={pinIcon} 
          eventHandlers={{ click: () => onOpenEvent(event) }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{event.title}</div>
              <div className="text-gray-600">{event.place}</div>
              <div className="mt-1 text-violet-700 font-semibold">${event.price}</div>
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