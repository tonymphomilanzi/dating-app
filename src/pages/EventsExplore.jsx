import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Search, Sliders, RefreshCw, Navigation, List, Map as MapIcon, ChevronRight } from "lucide-react";

// --- Constants & Utilities ---
const MANGOCHI = { lat: -14.4783, lng: 35.2645 };
const CATEGORIES = ["All", "Concert", "Exhibition", "Art", "Sport", "Tech"];

const toRad = (d) => (d * Math.PI) / 180;
const calculateDistance = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371; 
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
};

// --- Custom Hooks ---
function useGeolocation(defaultCoords) {
  const [state, setState] = useState({
    coords: null,
    status: "loading",
    label: "Locating..."
  });

  const getPos = useCallback(() => {
    setState(s => ({ ...s, status: "loading" }));
    if (!navigator.geolocation) {
      setState({ coords: defaultCoords, status: "unsupported", label: "Manual Location" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`);
          const data = await res.json();
          const city = data?.address?.city || data?.address?.town || "Current Area";
          setState({ coords: p, status: "granted", label: city });
        } catch {
          setState({ coords: p, status: "granted", label: "Found Location" });
        }
      },
      () => setState({ coords: defaultCoords, status: "denied", label: "Mangochi" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [defaultCoords]);

  useEffect(() => { getPos(); }, [getPos]);
  return { ...state, refresh: getPos };
}

// --- Memoized Sub-Components ---
const CategoryChip = memo(({ label, count, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
      isActive 
        ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200" 
        : "bg-white text-gray-600 border-gray-100 hover:border-violet-200"
    }`}
  >
    {label}
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100 text-gray-400"}`}>
      {count}
    </span>
  </button>
));

const EventCard = memo(({ event, onClick }) => (
  <div 
    onClick={() => onClick(event)}
    className="group relative shrink-0 w-72 bg-white rounded-3xl overflow-hidden border border-gray-100 transition-all hover:shadow-xl cursor-pointer"
  >
    <div className="relative h-48 overflow-hidden">
      <img src={event.img} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute top-3 left-3 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[11px] text-white font-medium">
        {event.dateLabel}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <p className="text-white font-bold text-lg leading-tight truncate">{event.title}</p>
        <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
          <MapPin size={12} className="text-violet-400" />
          <span className="truncate">{event.place}</span>
        </div>
      </div>
    </div>
    <div className="p-4 flex items-center justify-between">
      <div className="flex -space-x-2">
        {event.attendees?.slice(0, 3).map((src, i) => (
          <img key={i} src={src} className="w-7 h-7 rounded-full border-2 border-white" alt="user" />
        ))}
        {event.attendees?.length > 3 && (
          <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
            +{event.attendees.length - 3}
          </div>
        )}
      </div>
      <span className="text-violet-700 font-bold">${event.price}</span>
    </div>
  </div>
));

// --- Main Application ---
export default function EventsProductionHome() {
  const nav = useNavigate();
  const { coords, status, label, refresh } = useGeolocation(MANGOCHI);
  
  // UI State
  const [mode, setMode] = useState("explore"); 
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [radius, setRadius] = useState(50);
  const [view, setView] = useState("list");

  // Filtered Logic
  const allEvents = useMemo(() => [...popularAll, ...mangochiEvents], []);
  
  const categoryCounts = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = cat === "All" ? allEvents.length : allEvents.filter(e => e.category === cat).length;
      return acc;
    }, {});
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let list = mode === "explore" ? popularAll : allEvents;
    
    if (category !== "All") list = list.filter(e => e.category === category);
    if (search) list = list.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
    
    if (mode === "near" && coords) {
      return list
        .map(e => ({ ...e, dist: calculateDistance(coords, e) }))
        .filter(e => e.dist <= radius)
        .sort((a, b) => a.dist - b.dist);
    }
    return list;
  }, [mode, category, search, coords, radius, allEvents]);

  const handleOpenDetail = useCallback((e) => {
    nav(`/events/${e.id}`, { state: { event: e } });
  }, [nav]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
              {["explore", "near"].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                    mode === m ? "bg-white shadow-sm text-violet-600" : "text-gray-500"
                  }`}
                >
                  {m === "explore" ? "Explore" : "Near You"}
                </button>
              ))}
            </div>
            <button 
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <MapPin size={14} className="text-violet-500" />
              {label}
              <RefreshCw size={12} className={status === "loading" ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="mt-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists, events, venues..."
              className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-3xl text-sm focus:ring-2 focus:ring-violet-500 transition-all"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-200">
              <Sliders size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6">
        {mode === "explore" ? (
          <section className="space-y-8">
            {/* Categories */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {CATEGORIES.map(c => (
                <CategoryChip 
                  key={c} 
                  label={c} 
                  count={categoryCounts[c]} 
                  isActive={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>

            {/* Popular Section */}
            <div>
              <SectionHeader title="Trending Now" />
              <div className="flex gap-5 overflow-x-auto no-scrollbar py-4 -mx-1 px-1">
                {filteredEvents.map(e => (
                  <EventCard key={e.id} event={e} onClick={handleOpenDetail} />
                ))}
              </div>
            </div>

            {/* Upcoming Section */}
            <div>
              <SectionHeader title="Upcoming Near You" />
              <div className="mt-4 space-y-4">
                {upcomingAll.map(e => (
                  <UpcomingListItem key={e.id} item={e} onClick={handleOpenDetail} />
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[25, 50, 100].map(r => (
                  <button 
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      radius === r ? "bg-slate-900 text-white border-slate-900" : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-white shadow-sm" : "text-gray-400"}`}><List size={18}/></button>
                <button onClick={() => setView("map")} className={`p-2 rounded-lg ${view === "map" ? "bg-white shadow-sm" : "text-gray-400"}`}><MapIcon size={18}/></button>
              </div>
            </div>

            {view === "list" ? (
              <div className="grid gap-4">
                {filteredEvents.map(e => (
                  <NearbyListItem key={e.id} event={e} onClick={handleOpenDetail} />
                ))}
              </div>
            ) : (
              <div className="h-[450px] rounded-3xl overflow-hidden border border-gray-200 shadow-inner">
                {coords && <NearMap center={coords} events={filteredEvents} onOpen={handleOpenDetail} />}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// --- UI Helpers ---

function SectionHeader({ title }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <button className="text-violet-600 font-bold text-sm">See all</button>
    </div>
  );
}

function UpcomingListItem({ item, onClick }) {
  return (
    <div 
      onClick={() => onClick(item)}
      className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-50 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="w-16 h-16 rounded-xl bg-violet-50 flex flex-col items-center justify-center border border-violet-100">
        <span className="text-lg font-bold text-violet-700">{item.day}</span>
        <span className="text-[10px] uppercase font-bold text-violet-400">{item.month}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm truncate">{item.title}</h4>
        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
          <MapPin size={10} /> {item.place}
        </p>
      </div>
      <ChevronRight size={18} className="text-gray-300" />
    </div>
  );
}

function NearbyListItem({ event, onClick }) {
  return (
    <div 
      onClick={() => onClick(event)}
      className="flex gap-4 p-3 bg-white rounded-3xl border border-gray-100 hover:shadow-xl transition-all cursor-pointer"
    >
      <img src={event.img} className="w-24 h-24 rounded-2xl object-cover" alt="" />
      <div className="flex-1 py-1">
        <div className="flex justify-between items-start">
          <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-bold uppercase tracking-wider">
            {event.category}
          </span>
          <span className="text-xs font-bold text-slate-400">{event.dist?.toFixed(1)} km</span>
        </div>
        <h4 className="font-bold text-slate-800 mt-1">{event.title}</h4>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-violet-600 font-black">${event.price}</span>
          <button className="text-[10px] font-bold px-3 py-1 bg-slate-900 text-white rounded-full">Book</button>
        </div>
      </div>
    </div>
  );
}

// --- Map Logic ---
const customIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-violet-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
         </div>`,
  className: "",
  iconSize: [32, 32],
});

function NearMap({ center, events, onOpen }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <MapUpdater center={center} />
      {events.map(e => (
        <Marker 
          key={e.id} 
          position={[e.lat, e.lng]} 
          icon={customIcon}
          eventHandlers={{ click: () => onOpen(e) }}
        >
          <Popup>
            <div className="p-1 font-sans">
              <p className="font-bold text-sm">{e.title}</p>
              <p className="text-xs text-violet-600 font-bold">${e.price}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([center.lat, center.lng], { animate: true });
  }, [center, map]);
  return null;
}

// Dummy data remains same but used within the components above...
const popularAll = [/* same as your data */];
const mangochiEvents = [/* same as your data */];
const upcomingAll = [/* same as your data */];