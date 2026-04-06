import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  Search, Sliders, MapPin, Navigation, 
  ChevronRight, Calendar, Users, X, Check
} from "lucide-react";

// --- State Management & Logic ---
const MANGOCHI = { lat: -14.4783, lng: 35.2645 };

export default function EventsHome() {
  const nav = useNavigate();
  const [mode, setMode] = useState("explore"); 
  const [activeCat, setActiveCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Location & Filter States
  const [userLoc, setUserLoc] = useState(null);
  const [placeName, setPlaceName] = useState("Locating...");
  const [radius, setRadius] = useState(50);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);

  // Sync Geolocation
  useEffect(() => {
    const getPos = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(coords);
          // Reverse Geocode
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
            .then(res => res.json())
            .then(data => setPlaceName(data.address.city || data.address.town || "Nearby"));
        },
        () => { setUserLoc(MANGOCHI); setPlaceName("Mangochi"); }
      );
    };
    getPos();
  }, []);

  // Performance: Memoized Filtering
  const filteredEvents = useMemo(() => {
    let pool = [...popularAll, ...mangochiEvents];
    
    return pool
      .map(e => ({ ...e, dist: userLoc ? calculateDistance(userLoc, e) : 0 }))
      .filter(e => {
        const matchCat = activeCat === "All" || e.category === activeCat;
        const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDist = mode === "near" ? e.dist <= radius : true;
        const matchPrice = e.price >= priceRange[0] && e.price <= priceRange[1];
        return matchCat && matchSearch && matchDist && matchPrice;
      })
      .sort((a, b) => (mode === "near" ? a.dist - b.dist : 0));
  }, [userLoc, activeCat, searchQuery, radius, mode, priceRange]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans selection:bg-violet-100">
      {/* Editorial Header */}
      <div className="bg-white border-b border-slate-100 px-6 pt-8 pb-6 sticky top-0 z-20 backdrop-blur-md bg-white/90">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Current Location</p>
              <button className="flex items-center gap-1.5 group">
                <MapPin size={16} className="text-violet-600" />
                <span className="font-bold text-sm group-hover:text-violet-600 transition-colors">{placeName}</span>
              </button>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
               <img src="https://i.pravatar.cc/100?u=tonympho" alt="Profile" />
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tight mb-6">
            {mode === "explore" ? "Discover \nEvents" : "Events \nNear You"}
          </h1>

          {/* Search & Filter Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                placeholder="Search anything..."
                className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-violet-500/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-violet-600 transition-all shadow-lg shadow-slate-200"
            >
              <Sliders size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-8">
        {/* Navigation Mode */}
        <div className="flex gap-4 mb-8">
          {["explore", "near"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${
                mode === m ? "border-violet-600 text-slate-900" : "border-transparent text-slate-400"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        {mode === "explore" ? (
          <ExploreLayout 
            events={filteredEvents} 
            activeCat={activeCat} 
            setActiveCat={setActiveCat} 
          />
        ) : (
          <NearLayout 
            events={filteredEvents} 
            radius={radius} 
            center={userLoc || MANGOCHI} 
          />
        )}
      </div>

      {/* Filter Bottom Sheet */}
      {isFilterOpen && (
        <FilterDrawer 
          radius={radius} 
          setRadius={setRadius} 
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          onClose={() => setIsFilterOpen(false)} 
        />
      )}
    </div>
  );
}

// --- Sub-Components with Clean UI ---

function ExploreLayout({ events, activeCat, setActiveCat }) {
  return (
    <div className="space-y-8">
      <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
        {["All", "Concert", "Art", "Tech", "Sport"].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeCat === cat ? "bg-violet-600 border-violet-600 text-white shadow-md" : "bg-white border-slate-100 text-slate-500"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      <div className="grid gap-6">
        {events.map(e => <WideEventCard key={e.id} event={e} />)}
      </div>
    </div>
  );
}

function NearLayout({ events, radius, center }) {
  return (
    <div className="space-y-6">
      <div className="h-64 w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-xl relative">
        <MapContainer center={[center.lat, center.lng]} zoom={11} style={{ height: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <MapCenterer coords={center} />
          {events.map(e => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={markerIcon} />
          ))}
        </MapContainer>
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-600 shadow-sm border border-white">
          Radius: {radius}km
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-black text-lg">Results ({events.length})</h3>
        {events.map(e => <CompactEventRow key={e.id} event={e} />)}
      </div>
    </div>
  );
}

// --- High-Performance Filter Drawer ---
function FilterDrawer({ radius, setRadius, priceRange, setPriceRange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
        
        <h2 className="text-2xl font-black mb-8">Filter Settings</h2>

        <div className="space-y-10">
          {/* Distance Slider */}
          <div>
            <div className="flex justify-between items-end mb-4">
              <label className="font-bold text-sm uppercase tracking-wider">Distance Range</label>
              <span className="text-violet-600 font-black text-xl">{radius}km</span>
            </div>
            <input 
              type="range" min="5" max="200" step="5"
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </div>

          {/* Price Input */}
          <div>
             <label className="font-bold text-sm uppercase tracking-wider block mb-4">Price Range ($)</label>
             <div className="flex gap-4">
                <input 
                  type="number" 
                  value={priceRange[0]} 
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                  className="flex-1 bg-slate-50 border-none rounded-xl p-4 font-bold"
                  placeholder="Min"
                />
                <input 
                  type="number" 
                  value={priceRange[1]} 
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="flex-1 bg-slate-50 border-none rounded-xl p-4 font-bold"
                  placeholder="Max"
                />
             </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-violet-600 text-white font-black py-5 rounded-2xl mt-12 hover:bg-violet-700 transition-all shadow-lg shadow-violet-200"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

// --- Helpers & UI Assets ---
function calculateDistance(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const v = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
}

function MapCenterer({ coords }) {
  const map = useMap();
  useEffect(() => { map.setView([coords.lat, coords.lng]); }, [coords, map]);
  return null;
}

const markerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-4 h-4 bg-violet-600 border-2 border-white rounded-full shadow-lg"></div>`
});

// Large Card Component (Exploration)
function WideEventCard({ event }) {
  return (
    <div className="group bg-white rounded-[2rem] overflow-hidden border border-slate-100 hover:shadow-2xl hover:shadow-slate-200 transition-all cursor-pointer">
      <div className="relative h-56 overflow-hidden">
        <img src={event.img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full font-black text-xs text-violet-600">
          ${event.price}
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-600 mb-2">
          <Calendar size={12} /> {event.dateLabel} • {event.category}
        </div>
        <h3 className="text-xl font-black mb-2 leading-tight">{event.title}</h3>
        <p className="text-slate-400 text-sm flex items-center gap-1">
          <MapPin size={14} /> {event.place}
        </p>
      </div>
    </div>
  );
}

// Small Row Component (Nearby)
function CompactEventRow({ event }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-white rounded-3xl border border-slate-50 hover:border-violet-100 transition-all cursor-pointer">
      <img src={event.img} className="w-20 h-20 rounded-2xl object-cover" alt="" />
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 truncate">{event.title}</h4>
        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{event.dist.toFixed(1)} km away</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-violet-600 font-black text-sm">${event.price}</span>
          <button className="bg-slate-100 p-1.5 rounded-lg text-slate-400 hover:text-violet-600"><ChevronRight size={16}/></button>
        </div>
      </div>
    </div>
  );
}

const popularAll = [/* ... existing data ... */];
const mangochiEvents = [/* ... existing data ... */];