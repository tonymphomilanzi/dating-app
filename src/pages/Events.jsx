// src/pages/Events.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { eventsService } from "../services/events.service.js";

// ---------- Geo helpers ----------
const toRad = (d) => (d * Math.PI) / 180;
function kmBetween(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
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
const distanceLabel = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// ---------- Map pin ----------
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

// ---------- Date helpers ----------
function dateLabelFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}
function dayMonthFromISO(iso) {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleDateString([], { month: "short" }),
  };
}

// ---------- Main page ----------
export default function Events() {
  const nav = useNavigate();
  const locState = useLocation();

  // Mode + filters
  const [mode, setMode] = useState("explore"); // explore | near
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(50);
  const [view, setView] = useState("list"); // list | map
  const [filterOpen, setFilterOpen] = useState(false);

  // Location
  const [loc, setLoc] = useState(null);
  const [locStatus, setLocStatus] = useState("loading");
  const [placeLabel, setPlaceLabel] = useState("");

  // Data
  const [events, setEvents] = useState([]); // everyone’s events
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState("All");

  // Merge a freshly created event (from /events/new navigation state)
  useEffect(() => {
    const created = locState.state?.created;
    if (created) {
      setEvents(prev => {
        const exists = prev.some(e => e.id === created.id);
        return exists ? prev : [created, ...prev];
      });
      nav("/events", { replace: true, state: null });
    }
  }, [locState.state, nav]);

  // Fetch all events (everyone’s)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const r = await eventsService.list?.().catch(() => null);
        const rows = Array.isArray(r?.items) ? r.items : (Array.isArray(r) ? r : []);
        const mapped = rows.map((ev) => ({
          id: ev.id,
          title: ev.title,
          description: ev.description || "",
          img: ev.cover_url || "",
          dateISO: ev.starts_at,
          dateLabel: dateLabelFromISO(ev.starts_at),
          ...dayMonthFromISO(ev.starts_at),
          category: ev.category || "Other",
          place: ev.city || "Unknown",
          lat: ev.lat, lng: ev.lng,
          price: ev.price || 0,
          created_at: ev.created_at,
        }));
        if (!cancel) {
          setEvents(mapped);
          setErr("");
        }
      } catch (e) {
        if (!cancel) setErr(e.message || "Failed to load events");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Geolocation
  useEffect(() => { getMyLocation(); }, []);
  async function getMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) };
        setLoc(p);
        setLocStatus("granted");
        reverseGeocode(p).catch(() => {});
      },
      () => {
        setLocStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  }
  async function reverseGeocode({ lat, lng }) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    const city =
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.county ||
      data?.address?.state ||
      "";
    setPlaceLabel(city || "Your area");
  }

  // Categories derived from data
  const categories = useMemo(() => {
    const set = new Set(events.map(e => e.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [events]);

  // Search + filter (Explore)
  const exploreFiltered = useMemo(() => {
    let base = events.slice();
    if (cat !== "All") base = base.filter(e => e.category === cat);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      base = base.filter(e =>
        e.title.toLowerCase().includes(s) ||
        e.place.toLowerCase().includes(s)
      );
    }
    // Sort: nearest date first; tie-break by created_at desc
    base.sort((a,b) => new Date(a.dateISO) - new Date(b.dateISO) || new Date(b.created_at) - new Date(a.created_at));
    // If we have location, sort by proximity within same day as a secondary feel
    if (loc) {
      base = base
        .map(e => ({ ...e, _d: kmBetween(loc, e) }))
        .sort((a,b) => (new Date(a.dateISO) - new Date(b.dateISO)) || (a._d - b._d))
        .map(({_d, ...rest}) => rest);
    }
    return base;
  }, [events, cat, q, loc]);

  // Popular (horizontal) – take first N from exploreFiltered
  const popular = useMemo(() => exploreFiltered.slice(0, 12), [exploreFiltered]);

  // Upcoming (vertical) – also from exploreFiltered with day/month chips
  const upcoming = useMemo(() => exploreFiltered.slice(0, 10), [exploreFiltered]);

  // Near you
  const nearEvents = useMemo(() => {
    if (!loc) return [];
    const pool = events.map(e => ({ ...e, distanceKm: kmBetween(loc, e) }));
    let list = pool.filter(e => e.distanceKm <= radius);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(e => (e.title||"").toLowerCase().includes(s) || (e.place||"").toLowerCase().includes(s));
    }
    list.sort((a,b) => a.distanceKm - b.distanceKm);
    return list;
  }, [events, loc, radius, q]);

  const openDetail = (event) => nav(`/events/${event.id}`, { state: { event } });

  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-6">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Segmented header */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            {["explore", "near"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  mode === m ? "bg-violet-600 text-white shadow" : "text-gray-700 hover:bg-violet-50"
                }`}
              >
                {m === "explore" ? "Explore" : "Near You"}
              </button>
            ))}
          </div>

          {/* Change location chip */}
          <button
            onClick={getMyLocation}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <i className="lni lni-map-marker text-violet-600" />
            {placeLabel || (locStatus === "loading" ? "Locating…" : locStatus === "denied" ? "Location off" : "Change")}
            <i className="lni lni-reload text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <i className="lni lni-search-alt text-gray-400" />
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
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
          <div className="mt-2 flex items-center gap-2 text-xs">
            <i className="lni lni-navigation text-violet-600" />
            {mode === "near" ? (
              <>
                {locStatus === "loading" && <span className="text-gray-500">Finding your position…</span>}
                {locStatus !== "loading" && (
                  <span className="text-gray-600">
                    {nearEvents.length} results within {radius} km of{" "}
                    <span className="font-medium text-gray-800">{placeLabel || "your area"}</span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-600">Discover top picks and upcoming events</span>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingCard />
        ) : err ? (
          <ErrorCard err={err} onRetry={()=>window.location.reload()} />
        ) : events.length === 0 ? (
          <EmptyCreate onCreate={()=>nav("/events/new")} />
        ) : mode === "explore" ? (
          <ExploreSection
            categories={categories}
            cat={cat}
            setCat={setCat}
            popular={popular}
            upcoming={upcoming}
            openDetail={openDetail}
          />
        ) : (
          <NearYouSection
            loc={loc}
            radius={radius}
            setRadius={setRadius}
            view={view}
            setView={setView}
            events={nearEvents}
            openDetail={openDetail}
          />
        )}
      </div>

      {filterOpen && (
        <FilterSheet
          radius={radius}
          setRadius={setRadius}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------- Explore tab ---------------- */

function ExploreSection({ categories, cat, setCat, popular, upcoming, openDetail }) {
  // counts by category
  const countsByCat = useMemo(() => {
    const pool = [...popular, ...upcoming];
    const counts = { All: pool.length };
    for (const c of categories.slice(1)) counts[c] = pool.filter(e => e.category === c).length;
    return counts;
  }, [categories, popular, upcoming]);

  return (
    <>
      <HeaderRow title="Popular Events" />
      {/* Chips with counters */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={[
              "shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors border",
              cat === c
                ? "bg-violet-600 text-white border-violet-600 shadow"
                : "bg-white text-gray-800 border-gray-200 hover:bg-violet-50",
            ].join(" ")}
          >
            <span>{c}</span>
            <span
              className={[
                "rounded-full px-1.5 text-[11px]",
                cat === c ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600",
              ].join(" ")}
            >
              {countsByCat[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Horizontal popular cards */}
      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1">
        {popular.length === 0 && <div className="w-full text-sm text-gray-500">No events found.</div>}
        {popular
          .filter(e => cat === "All" || e.category === cat)
          .map((e) => (
          <button
            key={e.id}
            onClick={() => openDetail(e)}
            className="group w-[265px] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-card hover:shadow-md"
          >
            <div className="relative h-44">
              {e.img ? (
                <img src={e.img} alt={e.title} className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">No cover</div>
              )}
              <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
                {e.dateLabel}
              </div>
              <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-gray-800 ring-1 ring-gray-200">
                {e.category}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute inset-x-2 bottom-2 flex items-end justify-between">
                <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
                  {e.title}
                </div>
                <div className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                  ${e.price}
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <i className="lni lni-map-marker text-violet-600" />
                {e.place}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Upcoming vertical */}
      <HeaderRow title="Upcoming events" />
      <div className="mt-3 space-y-3">
        {upcoming.map((e) => (
          <UpcomingRow key={e.id} item={e} onOpen={openDetail} />
        ))}
      </div>
    </>
  );
}

/* ---------------- Near You tab ---------------- */

function NearYouSection({ loc, radius, setRadius, view, setView, events, openDetail }) {
  return (
    <>
      {/* Radius + View toggle */}
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[10, 25, 50, 100].map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                radius === r ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-800 border-gray-200 hover:bg-violet-50"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
        <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
          <button
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1.5 text-sm ${view === "list" ? "bg-violet-600 text-white" : "text-gray-700 hover:bg-violet-50"}`}
          >
            <i className="lni lni-list" /> List
          </button>
          <button
            onClick={() => setView("map")}
            className={`rounded-full px-3 py-1.5 text-sm ${view === "map" ? "bg-violet-600 text-white" : "text-gray-700 hover:bg-violet-50"}`}
          >
            <i className="lni lni-map" /> Map
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "map" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
          {loc ? (
            <NearMap center={loc} events={events} onOpen={openDetail} />
          ) : (
            <div className="aspect-[16/9] grid place-items-center text-sm text-gray-500">
              { "Locating…" }
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {events.length === 0 ? (
            <EmptyState msg={`No events within ${radius} km. Try widening the radius.`} />
          ) : (
            events.map((e) => (
              <button
                key={e.id}
                onClick={() => openDetail(e)}
                className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-card hover:shadow-md"
              >
                <div className="h-20 w-28 overflow-hidden rounded-lg bg-gray-100">
                  {e.img ? (
                    <img src={e.img} alt={e.title} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-gray-400">No cover</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{e.title}</div>
                    <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
                      {distanceLabel(e.distanceKm)} away
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <i className="lni lni-map-marker text-violet-600" />
                    {e.place}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-violet-700">
                    ${e.price}
                    <span className="text-[11px] text-gray-500">/Person</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Shared bits ---------------- */

function HeaderRow({ title }) {
  return (
    <div className="mt-6 flex items-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <span className="ml-auto text-sm font-medium text-violet-700 opacity-70">
        {/* Reserved for "See all" link later */}
      </span>
    </div>
  );
}

function UpcomingRow({ item, onOpen }) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-card hover:shadow-md"
    >
      <div className="grid w-14 place-items-center rounded-xl border border-gray-200 bg-white">
        <div className="text-center leading-tight">
          <div className="text-lg font-bold text-violet-700">{item.day}</div>
          <div className="text-[11px] text-gray-500">{item.month}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="h-16 w-24 overflow-hidden rounded-lg bg-gray-100">
          {item.img ? (
            <img src={item.img} alt={item.title} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="grid h-full w-full place-items-center text-gray-400">No cover</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{item.title}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <i className="lni lni-map-marker text-violet-600" />
            {item.place}
          </div>
          <div className="mt-1 text-sm font-semibold text-violet-700">
            ${item.price}
            <span className="text-[11px] text-gray-500">/Person</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ msg }) {
  const nav = useNavigate();
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-500">
        <i className="lni lni-calendar text-2xl" />
      </div>
      <div className="mt-3 text-sm text-gray-700">{msg}</div>
      <p className="mt-1 text-xs text-gray-500">Create or discover events near you.</p>
      <div className="mt-4 flex justify-center">
        <button
          className="btn-primary"
          onClick={() => nav("/events/new")}
        >
          <i className="lni lni-plus mr-1" /> Create event
        </button>
      </div>
    </div>
  );
}

function NearMap({ center, events, onOpen }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: 340, width: "100%" }} className="touch-pan-y" zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter position={[center.lat, center.lng]} />
      {events.map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon} eventHandlers={{ click: () => onOpen(e) }}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{e.title}</div>
              <div className="text-gray-600">{e.place}</div>
              <div className="mt-1 text-violet-700 font-semibold">${e.price}</div>
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

/* ---------------- Filter Sheet ---------------- */

function FilterSheet({ radius, setRadius, onClose }) {
  const [localRadius, setLocalRadius] = useState(radius);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close filters" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" />
        <h3 className="mt-4 text-lg font-semibold">Filters</h3>

        {/* Distance */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-700">Distance</span>
            <span className="font-medium text-violet-700">{localRadius} km</span>
          </div>
          <input
            type="range" min={5} max={200} step={5}
            value={localRadius}
            onChange={(e) => setLocalRadius(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>5</span><span>50</span><span>100</span><span>200</span>
          </div>
        </div>

        {/* Price */}
        <div className="mt-5">
          <div className="mb-2 text-sm text-gray-700">Price range</div>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} value={minPrice}
              onChange={(e)=>setMinPrice(Number(e.target.value))}
              className="w-1/2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Min"
            />
            <input
              type="number" min={0} value={maxPrice}
              onChange={(e)=>setMaxPrice(Number(e.target.value))}
              className="w-1/2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Max"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { setRadius(localRadius); onClose(); }}
            className="flex-1 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}