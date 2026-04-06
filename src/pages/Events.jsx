import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  Search, Sliders, MapPin, Navigation, 
  ChevronRight, Calendar, Users, X, Check, 
  Plus, Flower2, Zap 
} from "lucide-react";

const MANGOCHI = { lat: -14.4783, lng: 35.2645 };

export default function EventsHome() {
  const nav = useNavigate();
  const [mode, setMode] = useState("explore"); 
  const [activeCat, setActiveCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [userLoc, setUserLoc] = useState(null);
  const [placeName, setPlaceName] = useState("Locating...");
  const [radius, setRadius] = useState(50);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(coords);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
          .then(res => res.json())
          .then(data => setPlaceName(data.address.city || data.address.town || "Nearby"));
      },
      () => { setUserLoc(MANGOCHI); setPlaceName("Mangochi"); }
    );
  }, []);

  // Filter Logic including Clinics
  const content = useMemo(() => {
    let pool = mode === "massage" ? massageClinics : [...popularAll, ...mangochiEvents];
    
    return pool
      .map(item => ({ ...item, dist: userLoc ? calculateDistance(userLoc, item) : 0 }))
      .filter(item => {
        const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDist = (mode === "near" || mode === "massage") ? item.dist <= radius : true;
        
        if (mode === "massage") return matchSearch && matchDist;
        
        const matchCat = activeCat === "All" || item.category === activeCat;
        const matchPrice = item.price >= priceRange[0] && item.price <= priceRange[1];
        return matchCat && matchSearch && matchDist && matchPrice;
      })
      .sort((a, b) => (mode === "near" || mode === "massage" ? a.dist - b.dist : 0));
  }, [userLoc, activeCat, searchQuery, radius, mode, priceRange]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans selection:bg-violet-100">
      {/* Sticky Editorial Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 pt-8 pb-6 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Your Location</p>
              <button className="flex items-center gap-1.5 group bg-slate-100 px-3 py-1.5 rounded-full">
                <MapPin size={14} className="text-violet-600" />
                <span className="font-bold text-xs tracking-tight">{placeName}</span>
              </button>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-900 rotate-3 overflow-hidden border-4 border-white shadow-xl">
               <img src="https://i.pravatar.cc/100?u=tonympho" alt="Profile" className="-rotate-3 scale-110" />
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tighter mb-8 leading-[0.9]">
            {mode === "explore" && "Discover \nEvents"}
            {mode === "near" && "Right \nNearby"}
            {mode === "massage" && "Wellness \nCenters"}
          </h1>

          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" size={18} />
              <input 
                placeholder={`Search ${mode}...`}
                className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="bg-slate-900 text-white px-5 rounded-2xl hover:bg-violet-600 transition-all shadow-xl shadow-slate-200 active:scale-90"
            >
              <Sliders size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-8">
        {/* Navigation Tabs (Editorial Style) */}
        <div className="flex gap-8 mb-8 border-b border-slate-100">
          {["explore", "near", "massage"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-black pb-4 tracking-widest uppercase transition-all relative ${
                mode === m ? "text-slate-900" : "text-slate-300"
              }`}
            >
              {m}
              {mode === m && <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-600 rounded-full animate-in fade-in zoom-in duration-300" />}
            </button>
          ))}
        </div>

        {/* Dynamic Content Rendering */}
        {mode === "explore" && (
          <ExploreLayout events={content} activeCat={activeCat} setActiveCat={setActiveCat} />
        )}
        
        {mode === "near" && (
          <NearLayout items={content} radius={radius} center={userLoc || MANGOCHI} />
        )}

        {mode === "massage" && (
          <MassageLayout items={content} onAdd={() => nav("/create-massage-clinic")} />
        )}
      </div>

      {isFilterOpen && (
        <FilterDrawer radius={radius} setRadius={setRadius} priceRange={priceRange} setPriceRange={setPriceRange} onClose={() => setIsFilterOpen(false)} />
      )}
    </div>
  );
}

// --- Specialized Layouts ---

function MassageLayout({ items, onAdd }) {
  if (items.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-violet-200">
          <Flower2 className="absolute -right-8 -top-8 w-48 h-48 opacity-10 rotate-12" />
          <h2 className="text-3xl font-black leading-none mb-4 relative z-10">No clinics in <br/>your area yet.</h2>
          <p className="text-violet-100 font-medium mb-8 relative z-10">Be the first to list a wellness center and reach thousands of local clients.</p>
          <button 
            onClick={onAdd}
            className="bg-white text-violet-600 px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-black/10"
          >
            <Plus size={18} strokeWidth={3} /> CREATE CLINIC
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 opacity-40 grayscale pointer-events-none">
           <div className="h-40 bg-slate-200 rounded-3xl" />
           <div className="h-40 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {items.map(clinic => (
        <div key={clinic.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-5 shadow-sm hover:shadow-xl transition-all group">
          <div className="relative">
            <img src={clinic.img} className="w-24 h-24 rounded-3xl object-cover" alt="" />
            <div className="absolute -top-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white">
              <Zap size={12} fill="currentColor" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-tighter bg-violet-50 px-2 py-0.5 rounded-md">Verified Clinic</span>
              <span className="text-[10px] font-bold text-slate-400">{clinic.dist.toFixed(1)}km away</span>
            </div>
            <h3 className="font-black text-lg text-slate-900 group-hover:text-violet-600 transition-colors">{clinic.title}</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{clinic.place}</p>
          </div>
          <button className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}

// (Keep ExploreLayout, NearLayout, and cards from previous refactor but update styling to match)
// Use font-black and rounded-[2rem] consistently.

const massageClinics = []; // Initial empty state to test the "Create" UI
const popularAll = []; 
const mangochiEvents = [];