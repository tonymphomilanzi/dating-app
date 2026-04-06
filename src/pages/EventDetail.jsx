import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  ChevronLeft, Bookmark, Share2, Calendar, 
  MapPin, User, Ticket, ExternalLink, Info 
} from "lucide-react";

// --- Pure Utility: Moved outside to prevent re-declarations ---
const priceFmt = new Intl.NumberFormat("en-US", { 
  style: "currency", currency: "USD", maximumFractionDigits: 0 
});

const customPin = L.divIcon({
  className: "custom-pin",
  html: `<div class="w-10 h-10 bg-violet-600 border-4 border-white rounded-full shadow-2xl animate-pulse-subtle"></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const EventMap = memo(({ lat, lng }) => (
  <div className="h-64 w-full rounded-[2.5rem] overflow-hidden border-4 border-white shadow-inner relative group">
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full grayscale-[0.2] contrast-[1.1]">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <Marker position={[lat, lng]} icon={customPin} />
      <MapAutoCenter pos={[lat, lng]} />
    </MapContainer>
    <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/5 rounded-[2.5rem]" />
  </div>
));

export default function EventDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  
  // State initialization with "Nullish Coalescing" for speed
  const [event, setEvent] = useState(() => state?.event || null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoaded, setIsLoaded] = useState(!!state?.event);

  // Performance: AbortController for clean unmounting
  useEffect(() => {
    if (event) return;
    const controller = new AbortController();
    
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${id}`, { signal: controller.signal });
        const data = await res.json();
        setEvent(data.item || data);
        setIsLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      }
    };

    fetchEvent();
    return () => controller.abort();
  }, [id, event]);

  // UI calculations moved to useMemo
  const stats = useMemo(() => {
    if (!event) return { pct: 0, formattedDate: "" };
    const pct = event.capacity ? Math.round(((event.attendees_count || 0) / event.capacity) * 100) : 0;
    const date = new Date(event.starts_at || Date.now());
    return {
      pct,
      date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  }, [event]);

  if (!event && !isLoaded) return <DetailSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans selection:bg-violet-100">
      {/* 1. Header Navigation (Floating Glass) */}
      <nav className="fixed top-0 inset-x-0 z-50 p-6 flex justify-between items-center pointer-events-none">
        <button 
          onClick={() => navigate(-1)}
          className="pointer-events-auto h-12 w-12 rounded-full bg-white/80 backdrop-blur-md border border-white shadow-xl flex items-center justify-center active:scale-90 transition-all"
        >
          <ChevronLeft size={24} className="text-slate-900" />
        </button>
        <div className="flex gap-3 pointer-events-auto">
          <button 
            onClick={() => setIsSaved(!isSaved)}
            className={`h-12 w-12 rounded-full border shadow-xl flex items-center justify-center transition-all ${
              isSaved ? "bg-violet-600 border-violet-600 text-white" : "bg-white/80 backdrop-blur-md border-white text-slate-900"
            }`}
          >
            <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
          </button>
          <button className="h-12 w-12 rounded-full bg-white/80 backdrop-blur-md border border-white shadow-xl flex items-center justify-center active:scale-90 transition-all">
            <Share2 size={20} />
          </button>
        </div>
      </nav>

      {/* 2. Hero Section (Editorial Style) */}
      <div className="relative h-[60vh] w-full overflow-hidden bg-slate-900">
        <img 
          src={event.cover_url || event.img} 
          className="w-full h-full object-cover opacity-90 scale-105 animate-slow-zoom" 
          alt={event.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
        
        <div className="absolute bottom-12 left-0 right-0 px-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-lg shadow-violet-600/30">
            {event.category || "Exclusive Event"}
          </span>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-2">
            {event.title}
          </h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <MapPin size={16} className="text-violet-500" />
            <span>{event.city || event.place}</span>
          </div>
        </div>
      </div>

      {/* 3. Info Grid */}
      <main className="px-6 -mt-6 relative z-10 space-y-8 max-w-2xl mx-auto">
        {/* Host Card */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200 border border-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={event.host?.avatar || `https://ui-avatars.com/api/?name=${event.host?.name}`} 
                className="h-14 w-14 rounded-full border-4 border-slate-50" 
                alt="host"
              />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Organizer</p>
              <h4 className="font-black text-slate-900">{event.host?.name || "Premium Host"}</h4>
            </div>
          </div>
          <button className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold text-xs hover:bg-violet-600 hover:text-white transition-all">
            Contact
          </button>
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-2 gap-4">
          <DetailCard icon={<Calendar className="text-violet-500" />} label="Date" value={stats.date} sub={stats.time} />
          <DetailCard 
            icon={<Ticket className="text-violet-500" />} 
            label="Availability" 
            value={`${stats.pct}% Filled`} 
            customChild={
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-violet-600 transition-all duration-1000" style={{ width: `${stats.pct}%` }} />
              </div>
            }
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
             <Info size={20} className="text-violet-500" />
             About This Event
          </h3>
          <p className="text-slate-600 leading-relaxed font-medium">
            {event.description}
          </p>
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-black text-slate-900">Location</h3>
            <a 
              href={`https://maps.google.com/?q=${event.lat},${event.lng}`}
              target="_blank" rel="noreferrer"
              className="text-xs font-bold text-violet-600 flex items-center gap-1 hover:underline"
            >
              GET DIRECTIONS <ExternalLink size={12} />
            </a>
          </div>
          {event.lat && <EventMap lat={event.lat} lng={event.lng} />}
        </div>
      </main>

      {/* 4. Bottom CTA (High Impact) */}
      <footer className="fixed bottom-0 inset-x-0 p-6 z-50 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent">
        <div className="max-w-2xl mx-auto flex items-center gap-4 bg-slate-900 p-4 rounded-[2rem] shadow-2xl shadow-violet-900/20">
          <div className="flex-1 pl-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Starting from</p>
            <p className="text-2xl font-black text-white">{priceFmt.format(event.price)}</p>
          </div>
          <button className="bg-violet-600 text-white h-16 px-10 rounded-2xl font-black text-lg hover:bg-violet-500 active:scale-95 transition-all shadow-lg shadow-violet-600/40">
            Secure Spot
          </button>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components for better performance & clean code ---

const DetailCard = ({ icon, label, value, sub, customChild }) => (
  <div className="bg-white p-5 rounded-3xl border border-white shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <p className="font-black text-slate-900 leading-tight">{value}</p>
    {sub && <p className="text-xs font-medium text-slate-400 mt-0.5">{sub}</p>}
    {customChild}
  </div>
);

function MapAutoCenter({ pos }) {
  const map = useMap();
  useEffect(() => { map.setView(pos); }, [pos, map]);
  return null;
}

const DetailSkeleton = () => (
  <div className="animate-pulse p-8 space-y-8">
    <div className="h-64 bg-slate-200 rounded-3xl" />
    <div className="h-12 bg-slate-200 w-3/4 rounded-xl" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-24 bg-slate-200 rounded-3xl" />
      <div className="h-24 bg-slate-200 rounded-3xl" />
    </div>
  </div>
);