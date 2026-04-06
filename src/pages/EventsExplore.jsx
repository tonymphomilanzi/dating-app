import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ---------- HELPERS ----------
const toRad = (d) => (d * Math.PI) / 180;
function kmBetween(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const MANGOCHI = { lat: -14.4783, lng: 35.2645 };
const categories = ["All", "Concert", "Exhibition", "Art", "Sport", "Tech"];

// Brand pin for map (Refined for a top-brand minimalist aesthetic)
const pinIcon = L.divIcon({
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  html: `
    <div style="
      width:32px;height:32px;border-radius:50%;
      background:#7c3aed;
      display:flex;align-items:center;justify-content:center;
      color:#fff;border:2px solid #fff;
      box-shadow: 0 4px 12px rgba(124,58,237,0.3);
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    </div>
  `,
});

export default function EventsHome() {
  const nav = useNavigate();
  
  // Modes: explore | near | clinics
  const [mode, setMode] = useState("explore"); 
  const [cat, setCat] = useState("All");

  // Real-time Database States
  const [events, setEvents] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Location States
  const [loc, setLoc] = useState(null);
  const [locStatus, setLocStatus] = useState("loading");
  const [placeLabel, setPlaceLabel] = useState("");

  // Near You / Radius
  const [view, setView] = useState("list"); // list | map
  const [radius, setRadius] = useState(50);
  const [filterOpen, setFilterOpen] = useState(false);

  // ---------- REALTIME DB FETCHING ----------
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // TODO: Replace with your actual database queries (Supabase, Firebase, Axios, etc.)
        // const { data: eventsData } = await supabase.from('events').select('*');
        // const { data: clinicsData } = await supabase.from('clinics').select('*');
        
        // setEvents(eventsData);
        // setClinics(clinicsData);

        setEvents([]); // Replace with actual live state array
        setClinics([]); // Replace with actual live state array
      } catch (error) {
        console.error("Failed to fetch database records:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ---------- GEOLOCATION ----------
  const getMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("unsupported");
      setLoc(MANGOCHI);
      setPlaceLabel("Mangochi");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) };
        setLoc(p);
        setLocStatus("granted");
        reverseGeocode(p);
      },
      () => {
        setLocStatus("denied");
        setLoc(MANGOCHI);
        setPlaceLabel("Mangochi");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  }, []);

  useEffect(() => {
    getMyLocation();
  }, [getMyLocation]);

  async function reverseGeocode({ lat, lng }) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || "";
      setPlaceLabel(city || "Your area");
    } catch {
      setPlaceLabel("Your area");
    }
  }

  // ---------- PERFORMANCE OPTIMIZED DERIVED STATES ----------
  const countsByCat = useMemo(() => {
    const counts = { All: events.length };
    for (const c of categories.slice(1)) {
      counts[c] = events.filter(e => e.category === c).length;
    }
    return counts;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const base = cat === "All" ? events : events.filter(e => e.category === cat);
    if (!loc) return base;
    return [...base].sort((a, b) => kmBetween(loc, a) - kmBetween(loc, b));
  }, [cat, loc, events]);

  const nearEvents = useMemo(() => {
    if (!loc) return [];
    return events
      .map(e => ({ ...e, distanceKm: kmBetween(loc, e) }))
      .filter(e => e.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [loc, radius, events]);

  const nearClinics = useMemo(() => {
    if (!loc) return [];
    return clinics
      .map(c => ({ ...c, distanceKm: kmBetween(loc, c) }))
      .filter(c => c.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [loc, radius, clinics]);

  const distanceLabel = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
  const openDetail = (event) => nav(`/events/${event.id}`, { state: { event } });

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900 pb-10">
      <div className="mx-auto w-full max-w-md px-5 pt-5">
        
        {/* Apple/Airbnb Inspired Segmented Header */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
            {[
              { id: "explore", label: "Explore" },
              { id: "near", label: "Near You" },
              { id: "clinics", label: "Clinics" }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  mode === m.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={getMyLocation}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <i className="lni lni-map-marker text-violet-600" />
            {placeLabel || (locStatus === "loading" ? "Locating…" : "Location")}
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-200 transition-all">
            <i className="lni lni-search-alt text-gray-400 text-lg" />
            <input
              placeholder={`Search in ${placeLabel || "your area"}...`}
              className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              onClick={() => setFilterOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Filters"
            >
              <i className="lni lni-sliders" />
            </button>
          </div>
        </div>

        {/* Real-time Loader */}
        {loading ? (
          <div className="mt-20 text-center text-sm text-gray-500">
            <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"></div>
            Loading real-time data...
          </div>
        ) : (
          <>
            {mode === "explore" && (
              <ExploreSection
                cat={cat}
                setCat={setCat}
                countsByCat={countsByCat}
                popular={filteredEvents}
                openDetail={openDetail}
              />
            )}

            {mode === "near" && (
              <NearYouSection
                loc={loc}
                radius={radius}
                setRadius={setRadius}
                view={view}
                setView={setView}
                events={nearEvents}
                openDetail={openDetail}
                distanceLabel={distanceLabel}
                locStatus={locStatus}
              />
            )}

            {mode === "clinics" && (
              <ClinicsSection
                clinics={nearClinics}
                radius={radius}
                setRadius={setRadius}
                distanceLabel={distanceLabel}
                nav={nav}
              />
            )}
          </>
        )}
      </div>

      {filterOpen && (
        <FilterSheet radius={radius} setRadius={setRadius} onClose={() => setFilterOpen(false)} />
      )}
    </div>
  );
}

/* ---------------- EXPLORE TAB ---------------- */

function ExploreSection({ cat, setCat, countsByCat, popular, openDetail }) {
  return (
    <>
      <HeaderRow title="Popular Events" />
      
      {/* Refined Category Pills */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              cat === c
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            <span>{c}</span>
            <span className={`rounded-full px-1.5 text-[11px] ${cat === c ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {countsByCat[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Modern Airbnb-Style Horizontal Event Cards */}
      <div className="no-scrollbar mt-5 flex gap-5 overflow-x-auto pb-4">
        {popular.length === 0 && (
          <div className="w-full py-10 text-center text-sm text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
            No events found in this category.
          </div>
        )}
        {popular.map((e) => (
          <button
            key={e.id}
            onClick={() => openDetail(e)}
            className="w-[280px] shrink-0 text-left group"
          >
            <div className="relative h-52 w-full overflow-hidden rounded-2xl bg-gray-100">
              <img src={e.img} alt={e.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute right-3 top-3 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm">
                ${e.price}
              </div>
              <div className="absolute left-3 bottom-3 rounded-md bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                {e.dateLabel}
              </div>
            </div>
            
            <div className="mt-3">
              <div className="text-xs font-medium text-violet-600 mb-0.5">{e.category.toUpperCase()}</div>
              <h3 className="font-semibold text-gray-900 truncate">{e.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{e.place}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------------- NEAR YOU TAB ---------------- */

function NearYouSection({ loc, radius, setRadius, view, setView, events, openDetail, distanceLabel, locStatus }) {
  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {[10, 25, 50].map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                radius === r ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
        
        <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
          <button
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            List
          </button>
          <button
            onClick={() => setView("map")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${view === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            Map
          </button>
        </div>
      </div>

      {view === "map" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 shadow-sm h-[380px]">
          {loc ? (
            <NearMap center={loc} events={events} onOpen={openDetail} />
          ) : (
            <div className="h-full grid place-items-center text-sm text-gray-500 bg-white">
              {locStatus === "loading" ? "Locating…" : "Location unavailable"}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {events.length === 0 ? (
            <EmptyState msg={`No events within ${radius} km.`} />
          ) : (
            events.map((e) => (
              <button
                key={e.id}
                onClick={() => openDetail(e)}
                className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  <img src={e.img} alt={e.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold text-gray-900">{e.title}</h4>
                    <span className="shrink-0 text-xs font-medium text-violet-600">
                      {distanceLabel(e.distanceKm)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500 mt-0.5">{e.place}</p>
                  <p className="text-xs font-semibold text-gray-900 mt-1">${e.price}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- CLINICS TAB (NEW FEATURE) ---------------- */

function ClinicsSection({ clinics, radius, setRadius, distanceLabel, nav }) {
  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {[10, 25, 50].map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                radius === r ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {clinics.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gray-50 text-gray-400 mb-3">
              <i className="lni lni-empty-file text-xl" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No clinics found</h3>
            <p className="mt-1 text-xs text-gray-500">There are no massage clinics listed in this radius.</p>
            
            <button
              onClick={() => nav("/create-clinic")}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-700 shadow-sm"
            >
              Create Massage Clinic
            </button>
          </div>
        ) : (
          clinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => nav(`/clinics/${clinic.id}`)}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                <img src={clinic.img || "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=200&auto=format"} alt={clinic.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="truncate text-sm font-semibold text-gray-900">{clinic.title}</h4>
                  <span className="shrink-0 text-xs font-medium text-violet-600">
                    {distanceLabel(clinic.distanceKm)}
                  </span>
                </div>
                <p className="truncate text-xs text-gray-500 mt-0.5">{clinic.place}</p>
                <div className="flex items-center gap-1 text-xs text-amber-500 mt-1">
                  <i className="lni lni-star-filled" />
                  <span className="font-medium">{clinic.rating || "New"}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/* ---------------- SHARED REUSABLE COMPONENTS ---------------- */

function HeaderRow({ title }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <button className="text-xs font-semibold text-violet-600 hover:text-violet-700">
        See All
      </button>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  );
}

function NearMap({ center, events, onOpen }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter position={[center.lat, center.lng]} />
      {events.map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon} eventHandlers={{ click: () => onOpen(e) }}>
          <Popup>
            <div className="text-xs p-1">
              <div className="font-semibold text-gray-900">{e.title}</div>
              <div className="text-violet-600 font-bold mt-0.5">${e.price}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 12, { animate: true });
  }, [position, map]);
  return null;
}

/* ---------------- FILTER SHEET ---------------- */

function FilterSheet({ radius, setRadius, onClose }) {
  const [localRadius, setLocalRadius] = useState(radius);

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close filters" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="mt-5 text-lg font-bold text-gray-900">Filters</h3>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">Search Radius</span>
            <span className="font-bold text-violet-600">{localRadius} km</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={localRadius}
            onChange={(e) => setLocalRadius(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { setRadius(localRadius); onClose(); }}
            className="flex-1 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}