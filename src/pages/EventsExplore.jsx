import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  Search, Sliders, MapPin, ChevronRight, 
  Calendar, Plus, Flower2, Zap, Navigation2, 
  Compass, ShieldCheck, Info
} from "lucide-react";

// --- Configuration ---
const MANGOCHI = { lat: -14.4783, lng: 35.2645 };

const markerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-5 h-5 bg-violet-600 border-4 border-white rounded-full shadow-2xl"></div>`,
  iconSize: [20, 20]
});

export default function EventsHome() {
  const navigate = useNavigate();
  
  // Navigation Modes: 'explore' | 'massage' | 'nearby'
  const [activeTab, setActiveTab] = useState("explore"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [userLoc, setUserLoc] = useState(null);
  const [placeName, setPlaceName] = useState("Locating...");
  const [radius, setRadius] = useState(50);

  // Geolocation Setup
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(coords);
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
            .then(res => res.json())
            .then(data => setPlaceName(data.address.city || data.address.town || "Nearby Area"));
        },
        () => { setUserLoc(MANGOCHI); setPlaceName("Mangochi"); }
      );
    }
  }, []);

  // Centralized Data Filtering
  const displayData = useMemo(() => {
    // 1. Pick the correct data source based on tab
    let source = activeTab === "massage" ? massageClinics : [...popularEvents, ...localEvents];
    
    // 2. Map distances and filter
    return source
      .map(item => ({ ...item, dist: userLoc ? calculateDistance(userLoc, item) : 0 }))
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        // For 'nearby' and 'massage' tabs, we strictly enforce the radius
        const withinRadius = (activeTab === "nearby" || activeTab === "massage") ? item.dist <= radius : true;
        return matchesSearch && withinRadius;
      })
      .sort((a, b) => (activeTab !== "explore" ? a.dist - b.dist : 0));
  }, [activeTab, searchQuery, userLoc, radius]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      
      {/* --- HEADER & BRANDING --- */}
      <div className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white">
                <Zap size={16} fill="currentColor" />
              </div>
              <span className="font-black text-lg tracking-tighter uppercase">VibeCheck</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-100 py-1.5 px-3 rounded-full">
               <MapPin size={12} className="text-violet-600" />
               <span className="text-[10px] font-black uppercase tracking-wider">{placeName}</span>
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight leading-[0.9] mb-8">
            {activeTab === 'explore' && "Find Your \nNext Event"}
            {activeTab === 'massage' && "Premium \nWellness"}
            {activeTab === 'nearby' && "Happening \nRight Now"}
          </h1>

          {/* --- MAIN NAVIGATION TABS --- */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-[1.5rem] mb-6">
            <NavBtn label="Explore" id="explore" active={activeTab} setter={setActiveTab} Icon={Compass} />
            <NavBtn label="Massage" id="massage" active={activeTab} setter={setActiveTab} Icon={Flower2} />
            <NavBtn label="Nearby" id="nearby" active={activeTab} setter={setActiveTab} Icon={Navigation2} />
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" size={18} />
            <input 
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-violet-600/5 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="max-w-xl mx-auto px-6 mt-8">
        
        {/* Case 1: Explore Results */}
        {activeTab === "explore" && (
          <div className="grid gap-6">
            {displayData.map(event => <EventCard key={event.id} item={event} />)}
          </div>
        )}

        {/* Case 2: Nearby Mode (Map View) */}
        {activeTab === "nearby" && (
          <div className="space-y-6">
            <div className="h-64 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative">
              <MapContainer center={userLoc || MANGOCHI} zoom={13} style={{ height: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <MapCenterer coords={userLoc || MANGOCHI} />
                {displayData.map(item => (
                  <Marker key={item.id} position={[item.lat, item.lng]} icon={markerIcon} />
                ))}
              </MapContainer>
            </div>
            <div className="space-y-4">
              <h3 className="font-black text-lg">Local Discoveries</h3>
              {displayData.map(item => <MiniRow key={item.id} item={item} />)}
            </div>
          </div>
        )}

        {/* Case 3: Massage Clinics (with Create logic) */}
        {activeTab === "massage" && (
          <div className="space-y-6">
            {displayData.length === 0 ? (
              <div className="bg-white rounded-[3rem] p-10 border-2 border-dashed border-slate-200 text-center shadow-sm">
                <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6 text-violet-600">
                  <Flower2 size={40} />
                </div>
                <h2 className="text-2xl font-black mb-3">No Clinics Found</h2>
                <p className="text-slate-400 text-sm font-medium mb-8">There are currently no listed massage clinics in your immediate area.</p>
                <button 
                  onClick={() => navigate("/create-massage-clinic")}
                  className="bg-slate-900 text-white w-full py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-violet-600 transition-all shadow-xl shadow-slate-200"
                >
                  <Plus size={18} /> CREATE A CLINIC LISTING
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {displayData.map(clinic => <ClinicRow key={clinic.id} clinic={clinic} />)}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// --- Internal UI Components ---

function NavBtn({ label, id, active, setter, Icon }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => setter(id)}
      className={`flex flex-col items-center justify-center py-3 rounded-[1.2rem] transition-all ${
        isActive ? "bg-white text-violet-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <Icon size={18} className={isActive ? "animate-pulse" : ""} />
      <span className="text-[9px] font-black uppercase mt-1 tracking-tighter">{label}</span>
    </button>
  );
}

function EventCard({ item }) {
  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
      <div className="h-52 relative">
        <img src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl font-black text-xs">
          ${item.price}
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 text-[10px] font-black text-violet-600 uppercase mb-2">
          <Calendar size={12} /> {item.dateLabel}
        </div>
        <h3 className="text-xl font-black mb-1">{item.title}</h3>
        <p className="text-slate-400 text-xs font-bold flex items-center gap-1">
          <MapPin size={12} /> {item.place}
        </p>
      </div>
    </div>
  );
}

function MiniRow({ item }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-white rounded-3xl border border-slate-50">
      <img src={item.img} className="w-16 h-16 rounded-2xl object-cover" alt="" />
      <div className="flex-1">
        <h4 className="font-black text-sm">{item.title}</h4>
        <p className="text-[10px] text-slate-400 font-bold">{item.dist.toFixed(1)} km away</p>
      </div>
      <button className="p-2 text-slate-300 hover:text-violet-600"><ChevronRight size={20}/></button>
    </div>
  );
}

function ClinicRow({ clinic }) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-violet-600">
        <Flower2 size={24} />
      </div>
      <div className="flex-1">
        <h4 className="font-black text-md">{clinic.title}</h4>
        <div className="flex items-center gap-2 mt-1">
          <ShieldCheck size={12} className="text-green-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase">Verified Clinic</span>
        </div>
      </div>
      <ChevronRight size={20} className="text-slate-300" />
    </div>
  );
}

// --- Utilities ---

function calculateDistance(a, b) {
  const R = 6371; 
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const v = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
}

function MapCenterer({ coords }) {
  const map = useMap();
  useEffect(() => { if(coords) map.setView([coords.lat, coords.lng]); }, [coords, map]);
  return null;
}

// --- Data ---
const massageClinics = []; // EMPTY: Triggers the "Create Clinic" UI
const popularEvents = [
  { id: 1, title: "Summer Waves", price: 120, category: "Music", dateLabel: "AUG 12", img: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500", place: "Cape Maclear", lat: -14.02, lng: 34.85 },
  { id: 2, title: "Jazz Night", price: 30, category: "Music", dateLabel: "SEP 10", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500", place: "Lilongwe", lat: -13.96, lng: 33.77 }
];
const localEvents = [
  { id: 3, title: "Yoga at Sunrise", price: 10, category: "Social", dateLabel: "DAILY", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500", place: "Mangochi", lat: -14.47, lng: 35.26 }
];