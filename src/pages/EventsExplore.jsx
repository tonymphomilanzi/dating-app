import React, { useEffect, useMemo, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  Search, Sliders, MapPin, ChevronRight, 
  Calendar, Plus, Flower2, Zap, LayoutGrid,
  Navigation2, Filter
} from "lucide-react";

// --- Configuration & Constants ---
const MANGOCHI = { lat: -14.4783, lng: 35.2645 };

// Custom Map Marker Styling
const markerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-5 h-5 bg-violet-600 border-4 border-white rounded-full shadow-2xl animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// --- Main Component ---
export default function EventsHome() {
  const navigate = useNavigate();
  
  // UI State
  const [mode, setMode] = useState("explore"); // explore | near | massage
  const [activeCat, setActiveCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Location & Data State
  const [userLoc, setUserLoc] = useState(null);
  const [placeName, setPlaceName] = useState("Locating...");
  const [radius, setRadius] = useState(50);
  const [priceRange, setPriceRange] = useState([0, 1000]);

  // Sync Geolocation on Mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(coords);
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
            .then(res => res.json())
            .then(data => setPlaceName(data.address.city || data.address.town || "Nearby"));
        },
        () => {
          setUserLoc(MANGOCHI);
          setPlaceName("Mangochi");
        }
      );
    }
  }, []);

  // Performance: Unified Filtering Logic for all tabs
  const filteredContent = useMemo(() => {
    let pool = mode === "massage" ? massageClinics : [...popularEvents, ...localEvents];
    
    return pool
      .map(item => ({ 
        ...item, 
        dist: userLoc ? calculateDistance(userLoc, item) : 0 
      }))
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDist = (mode === "near" || mode === "massage") ? item.dist <= radius : true;
        
        if (mode === "massage") return matchesSearch && matchesDist;
        
        const matchesCat = activeCat === "All" || item.category === activeCat;
        const matchesPrice = item.price >= priceRange[0] && item.price <= priceRange[1];
        return matchesCat && matchesSearch && matchesDist && matchesPrice;
      })
      .sort((a, b) => (mode === "near" || mode === "massage" ? a.dist - b.dist : 0));
  }, [userLoc, activeCat, searchQuery, radius, mode, priceRange]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-32 font-sans selection:bg-violet-100">
      
      {/* 1. EDITORIAL HEADER */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 px-6 pt-10 pb-8 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Navigation2 className="text-white fill-current" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Your Area</p>
                <h3 className="font-black text-sm tracking-tight">{placeName}</h3>
              </div>
            </div>
            <button className="h-12 w-12 rounded-full border-4 border-white shadow-xl overflow-hidden active:scale-90 transition-transform">
               <img src="https://i.pravatar.cc/100?u=tonympho" alt="Profile" />
            </button>
          </div>

          <h1 className="text-5xl font-black tracking-[ -0.05em] mb-8 leading-[0.85] text-slate-900">
            {mode === "explore" && "Discover \nEvents"}
            {mode === "near" && "Around \nYou"}
            {mode === "massage" && "Wellness \nClinics"}
          </h1>

          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" size={20} />
              <input 
                placeholder={`Search ${mode}...`}
                className="w-full bg-slate-100 border-none rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-bold focus:ring-4 focus:ring-violet-500/10 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="bg-slate-900 text-white px-6 rounded-[1.5rem] hover:bg-violet-600 transition-all shadow-xl active:scale-95"
            >
              <Filter size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 mt-10">
        
        {/* 2. TAB NAVIGATION */}
        <div className="flex gap-10 mb-10 border-b border-slate-100">
          {["explore", "near", "massage"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] font-black pb-5 tracking-[0.2em] uppercase transition-all relative ${
                mode === m ? "text-slate-900" : "text-slate-300 hover:text-slate-500"
              }`}
            >
              {m}
              {mode === m && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-violet-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* 3. DYNAMIC CONTENT AREA */}
        <div className="space-y-10">
          
          {/* EXPLORE MODE */}
          {mode === "explore" && (
            <div className="space-y-8">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {["All", "Music", "Art", "Tech", "Social"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all ${
                      activeCat === cat ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : "bg-white text-slate-400 border border-slate-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid gap-8">
                {filteredContent.map(item => <WideCard key={item.id} item={item} />)}
              </div>
            </div>
          )}

          {/* NEAR MODE (Map + List) */}
          {mode === "near" && (
            <div className="space-y-8">
              <div className="h-80 w-full rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl relative">
                <MapContainer center={userLoc || MANGOCHI} zoom={12} style={{ height: '100%' }} zoomControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <MapController center={userLoc || MANGOCHI} />
                  {filteredContent.map(item => (
                    <Marker key={item.id} position={[item.lat, item.lng]} icon={markerIcon} />
                  ))}
                </MapContainer>
                <div className="absolute top-6 left-6 bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                   {radius}km Range
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-black tracking-tight">Closest to you</h2>
                {filteredContent.map(item => <CompactRow key={item.id} item={item} />)}
              </div>
            </div>
          )}

          {/* MASSAGE MODE (Clinics) */}
          {mode === "massage" && (
            <div className="space-y-8">
              {filteredContent.length === 0 ? (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-12 text-white shadow-2xl shadow-violet-200 relative overflow-hidden">
                  <Flower2 className="absolute -right-10 -top-10 w-64 h-64 opacity-10 rotate-12" />
                  <h2 className="text-4xl font-black leading-tight mb-6 relative z-10">No clinics <br/>found here.</h2>
                  <p className="text-violet-100 font-medium mb-10 max-w-xs relative z-10 opacity-80">Be the pioneer! Start your own clinic and appear first in local searches.</p>
                  <button 
                    onClick={() => navigate("/create-massage-clinic")}
                    className="bg-white text-violet-700 px-10 py-5 rounded-[1.5rem] font-black text-xs tracking-widest flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
                  >
                    <Plus size={20} strokeWidth={3} /> ADD CLINIC
                  </button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {filteredContent.map(clinic => <ClinicCard key={clinic.id} clinic={clinic} />)}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* 4. FILTER DRAWER */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-t-[3.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="w-16 h-2 bg-slate-100 rounded-full mx-auto mb-10" />
            <h2 className="text-3xl font-black mb-10 tracking-tighter">Preferences</h2>
            
            <div className="space-y-12">
              <div>
                <div className="flex justify-between items-end mb-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Radius</label>
                  <span className="text-violet-600 font-black text-2xl">{radius}km</span>
                </div>
                <input 
                  type="range" min="5" max="200" step="5"
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-6">Price Ceiling</label>
                <div className="flex gap-4">
                   <div className="flex-1 bg-slate-50 rounded-2xl p-6 font-black text-xl text-violet-600 border border-slate-100">
                      ${priceRange[1]}
                   </div>
                   <input 
                    type="range" min="0" max="2000" step="50"
                    className="flex-[2] accent-slate-900"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([0, Number(e.target.value)])}
                   />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsFilterOpen(false)}
              className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl mt-12 hover:bg-violet-600 transition-all shadow-xl shadow-slate-200"
            >
              Update Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Internal Helper Components ---

function WideCard({ item }) {
  return (
    <div className="group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 hover:shadow-3xl hover:shadow-slate-200 transition-all duration-500 cursor-pointer">
      <div className="relative h-64 overflow-hidden">
        <img src={item.img} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
        <div className="absolute top-6 right-6 bg-white/95 backdrop-blur px-5 py-2 rounded-2xl font-black text-sm text-violet-600 shadow-xl">
          ${item.price}
        </div>
      </div>
      <div className="p-8">
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-4">
          <Calendar size={14} /> {item.dateLabel} • {item.category}
        </div>
        <h3 className="text-2xl font-black mb-3 leading-tight tracking-tight group-hover:text-violet-600 transition-colors">{item.title}</h3>
        <p className="text-slate-400 font-bold text-xs flex items-center gap-2">
          <MapPin size={14} className="text-slate-300" /> {item.place}
        </p>
      </div>
    </div>
  );
}

function CompactRow({ item }) {
  return (
    <div className="flex items-center gap-6 p-4 bg-white rounded-[2rem] border border-slate-50 hover:border-violet-100 transition-all cursor-pointer group shadow-sm hover:shadow-lg">
      <img src={item.img} className="w-24 h-24 rounded-[1.5rem] object-cover" alt="" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.dist.toFixed(1)} km away</span>
        </div>
        <h4 className="font-black text-lg text-slate-900 truncate group-hover:text-violet-600 transition-colors">{item.title}</h4>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-violet-600 font-black text-sm">${item.price}</span>
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicCard({ clinic }) {
  return (
    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-6 shadow-sm hover:shadow-2xl transition-all group cursor-pointer">
      <div className="relative">
        <img src={clinic.img} className="w-28 h-28 rounded-[2rem] object-cover" alt="" />
        <div className="absolute -top-2 -right-2 bg-green-500 text-white p-2 rounded-full border-4 border-white shadow-lg">
          <Zap size={14} fill="currentColor" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest bg-violet-50 px-3 py-1 rounded-full">Top Rated</span>
          <span className="text-[10px] font-bold text-slate-400">{clinic.dist.toFixed(1)}km</span>
        </div>
        <h3 className="font-black text-xl text-slate-900 mb-1">{clinic.title}</h3>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.15em]">{clinic.place}</p>
      </div>
      <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-inner">
        <ChevronRight size={24} />
      </div>
    </div>
  );
}

// --- Map Utilities ---
function MapController({ center }) {
  const map = useMap();
  useEffect(() => { 
    if (center) map.setView([center.lat, center.lng], 12, { animate: true });
  }, [center, map]);
  return null;
}

function calculateDistance(a, b) {
  const R = 6371; // Earth radius in km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const v = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
}

// --- Mock Data (Empty clinic to show 'Create' UI) ---
const massageClinics = []; 
const popularEvents = [
  { id: 1, title: "Summer Waves Festival", price: 120, category: "Music", dateLabel: "AUG 12", img: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800", place: "Cape Maclear", lat: -14.02, lng: 34.85 },
  { id: 2, title: "Tech Summit 2026", price: 45, category: "Tech", dateLabel: "SEP 05", img: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800", place: "Lilongwe City", lat: -13.96, lng: 33.77 }
];
const localEvents = [
  { id: 3, title: "Lakeside Yoga", price: 15, category: "Social", dateLabel: "DAILY", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800", place: "Mangochi Waterfront", lat: -14.47, lng: 35.26 }
];