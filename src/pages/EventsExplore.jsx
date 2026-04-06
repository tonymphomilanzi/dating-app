import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  Search, Sliders, MapPin, ChevronRight, 
  Calendar, Plus, Flower2, Zap, Navigation2, 
  Compass, ShieldCheck, Heart, LayoutGrid
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
  
  // Tabs: 'explore' | 'massage' | 'nearby'
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
            .then(data => setPlaceName(data.address.city || data.address.town || "Nearby"));
        },
        () => { setUserLoc(MANGOCHI); setPlaceName("Mangochi"); }
      );
    }
  }, []);

  // Filter Logic
  const displayData = useMemo(() => {
    let source = activeTab === "massage" ? massageClinics : [...popularEvents, ...localEvents];
    
    return source
      .map(item => ({ ...item, dist: userLoc ? calculateDistance(userLoc, item) : 0 }))
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const withinRadius = (activeTab === "nearby" || activeTab === "massage") ? item.dist <= radius : true;
        return matchesSearch && withinRadius;
      })
      .sort((a, b) => (activeTab !== "explore" ? a.dist - b.dist : 0));
  }, [activeTab, searchQuery, userLoc, radius]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      
      {/* --- PREMIUM STICKY HEADER --- */}
      <div className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-50 backdrop-blur-xl bg-white/95">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white rotate-3 shadow-lg">
                <Zap size={20} fill="currentColor" />
              </div>
              <span className="font-black text-xl tracking-tighter uppercase italic">Vibe.</span>
            </div>
            <div className="flex items-center gap-2 bg-violet-50 py-2 px-4 rounded-full border border-violet-100">
               <MapPin size={14} className="text-violet-600" />
               <span className="text-[11px] font-black uppercase text-violet-700 tracking-wider">{placeName}</span>
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tighter leading-[0.8] mb-10 text-slate-900">
            {activeTab === 'explore' && "Discover \nNew Events"}
            {activeTab === 'massage' && "Wellness \nCenters"}
            {activeTab === 'nearby' && "Around \nYou Now"}
          </h1>

          {/* --- THE NAVIGATION TABS (THE CHANGE IS HERE) --- */}
          <div className="flex gap-2 bg-slate-100 p-2 rounded-[2rem] mb-8 shadow-inner">
            <button 
              onClick={() => setActiveTab("explore")}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${
                activeTab === "explore" ? "bg-white text-violet-600 shadow-xl scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Compass size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Explore</span>
            </button>

            <button 
              onClick={() => setActiveTab("massage")}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${
                activeTab === "massage" ? "bg-white text-violet-600 shadow-xl scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Heart size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Massage</span>
            </button>

            <button 
              onClick={() => setActiveTab("nearby")}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all duration-300 ${
                activeTab === "nearby" ? "bg-white text-violet-600 shadow-xl scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Navigation2 size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Nearby</span>
            </button>
          </div>

          {/* Search Area */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" size={20} />
            <input 
              placeholder={`Find ${activeTab}...`}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-bold focus:border-violet-600/20 focus:bg-white transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* --- DYNAMIC CONTENT --- */}
      <main className="max-w-xl mx-auto px-6 mt-10">
        
        {/* CASE 1: EXPLORE */}
        {activeTab === "explore" && (
          <div className="grid gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {displayData.map(event => (
              <div key={event.id} className="group bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all">
                <div className="h-64 relative overflow-hidden">
                  <img src={event.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                  <div className="absolute top-6 left-6 bg-black text-white px-5 py-2 rounded-2xl font-black text-xs shadow-2xl">
                    ${event.price}
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-2 text-[10px] font-black text-violet-600 uppercase tracking-widest mb-4">
                    <Calendar size={14} /> {event.dateLabel}
                  </div>
                  <h3 className="text-3xl font-black mb-3 leading-none tracking-tighter">{event.title}</h3>
                  <p className="text-slate-400 text-sm font-bold flex items-center gap-2">
                    <MapPin size={16} className="text-slate-300" /> {event.place}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CASE 2: MASSAGE (THE CREATE UI) */}
        {activeTab === "massage" && (
          <div className="animate-in fade-in zoom-in duration-500">
            {displayData.length === 0 ? (
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3.5rem] p-12 text-white shadow-2xl shadow-violet-200 relative overflow-hidden text-center">
                <Flower2 className="absolute -right-10 -top-10 w-64 h-64 opacity-10 rotate-12" />
                <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                   <Plus size={40} strokeWidth={3} />
                </div>
                <h2 className="text-4xl font-black leading-[0.9] mb-6">No Wellness <br/>Clinics Found.</h2>
                <p className="text-violet-100 font-medium mb-10 max-w-xs mx-auto opacity-80">Be the first to list your clinic in {placeName} and reach local clients today.</p>
                <button 
                  onClick={() => navigate("/create-massage-clinic")}
                  className="bg-white text-indigo-700 w-full py-6 rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase hover:scale-105 transition-all shadow-xl shadow-black/10 active:scale-95"
                >
                  Create Clinic Page
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {displayData.map(clinic => <ClinicRow key={clinic.id} clinic={clinic} />)}
              </div>
            )}
          </div>
        )}

        {/* CASE 3: NEARBY (MAP + LIST) */}
        {activeTab === "nearby" && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="h-80 rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl relative">
              <MapContainer center={userLoc || MANGOCHI} zoom={13} style={{ height: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <MapCenterer coords={userLoc || MANGOCHI} />
                {displayData.map(item => (
                  <Marker key={item.id} position={[item.lat, item.lng]} icon={markerIcon} />
                ))}
              </MapContainer>
            </div>
            <div className="space-y-6">
              <h3 className="font-black text-2xl tracking-tighter">Locals in {placeName}</h3>
              {displayData.map(item => (
                <div key={item.id} className="flex items-center gap-6 p-4 bg-white rounded-[2rem] border border-slate-50 hover:shadow-xl transition-all cursor-pointer group">
                  <img src={item.img} className="w-20 h-20 rounded-[1.5rem] object-cover" alt="" />
                  <div className="flex-1">
                    <h4 className="font-black text-lg group-hover:text-violet-600 transition-colors">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-tighter mt-1">{item.dist.toFixed(1)} km away</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-300 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    <ChevronRight size={20}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// --- Internal Helper UI ---

function ClinicRow({ clinic }) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-6 shadow-sm hover:shadow-xl transition-all group cursor-pointer">
      <div className="w-20 h-20 bg-violet-50 rounded-[1.5rem] flex items-center justify-center text-violet-600 shadow-inner group-hover:bg-violet-600 group-hover:text-white transition-colors">
        <Flower2 size={32} />
      </div>
      <div className="flex-1">
        <h4 className="font-black text-xl mb-1">{clinic.title}</h4>
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-green-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Expert</span>
        </div>
      </div>
      <ChevronRight size={24} className="text-slate-200 group-hover:text-violet-600" />
    </div>
  );
}

function calculateDistance(a, b) {
  const R = 6371; 
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const v = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
}

function MapCenterer({ coords }) {
  const map = useMap();
  useEffect(() => { if(coords) map.setView([coords.lat, coords.lng], 13, { animate: true }); }, [coords, map]);
  return null;
}

// --- Mock Data ---
const massageClinics = []; // KEEP EMPTY TO SEE THE 'CREATE CLINIC' GRADIENT BOX
const popularEvents = [
  { id: 1, title: "Lake of Stars", price: 150, category: "Music", dateLabel: "OCT 24", img: "https://images.unsplash.com/photo-1459749411177-042180ce673c?w=800", place: "Senga Bay", lat: -13.72, lng: 34.61 },
  { id: 2, title: "Sunday Grill", price: 25, category: "Social", dateLabel: "EVERY SUN", img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", place: "Lilongwe Area 10", lat: -13.95, lng: 33.79 }
];
const localEvents = [
  { id: 3, title: "Morning Yoga", price: 10, category: "Social", dateLabel: "07:00 AM", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800", place: "Mangochi Main", lat: -14.47, lng: 35.26 }
];