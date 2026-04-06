import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ---------- Helpers ----------
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

// ---------- Demo data (swap with your API) ----------
const popularAll = [
  {
    id: "p1",
    title: "Celebration Concert",
    dateLabel: "31 July",
    category: "Concert",
    place: "245 Oceanview Blvd, Miami",
    lat: 25.7617, lng: -80.1918,
    price: 400,
    img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=1","https://i.pravatar.cc/80?img=2","https://i.pravatar.cc/80?img=3","https://i.pravatar.cc/80?img=4"],
    short: "A night of lights, music, and energy.",
    dateISO: "2026-07-31T20:00:00Z",
  },
  {
    id: "p2",
    title: "Urban Crowd",
    dateLabel: "05 Aug",
    category: "Art",
    place: "Urban Croud, Los Angeles",
    lat: 34.0522, lng: -118.2437,
    price: 450,
    img: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=5","https://i.pravatar.cc/80?img=6","https://i.pravatar.cc/80?img=7"],
    short: "Immersive art and live visuals.",
    dateISO: "2026-08-05T19:00:00Z",
  },
  {
    id: "p3",
    title: "Photo Exhibition",
    dateLabel: "12 Sep",
    category: "Exhibition",
    place: "Art Hall, New York",
    lat: 40.7128, lng: -74.0060,
    price: 250,
    img: "https://images.unsplash.com/photo-1493612276216-ee3925520721?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=8","https://i.pravatar.cc/80?img=9"],
    short: "Curated shots from global artists.",
    dateISO: "2026-09-12T18:30:00Z",
  },
];

const mangochiEvents = [
  {
    id: "m1",
    title: "Lake Malawi Beach Party",
    dateLabel: "05 Aug",
    category: "Concert",
    place: "Nkopola Bay, Mangochi",
    lat: -14.463, lng: 35.292,
    price: 150,
    img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=10","https://i.pravatar.cc/80?img=11","https://i.pravatar.cc/80?img=12"],
    dateISO: "2026-08-05T17:00:00Z",
  },
  {
    id: "m2",
    title: "Mangochi Arts Fair",
    dateLabel: "12 Aug",
    category: "Exhibition",
    place: "Boma Grounds, Mangochi",
    lat: -14.483, lng: 35.26,
    price: 60,
    img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=13","https://i.pravatar.cc/80?img=14"],
    dateISO: "2026-08-12T10:00:00Z",
  },
  {
    id: "m3",
    title: "Cape Maclear Sunset Jam",
    dateLabel: "20 Aug",
    category: "Concert",
    place: "Cape Maclear, Mangochi District",
    lat: -14.0349, lng: 34.8281,
    price: 90,
    img: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?q=80&w=1600&auto=format&fit=crop",
    attendees: ["https://i.pravatar.cc/80?img=15"],
    dateISO: "2026-08-20T18:00:00Z",
  },
];

const upcomingAll = [
  {
    id: "u1",
    day: "05", month: "Aug",
    title: "SpaceX Launch",
    place: "Cape Canaveral, FL",
    lat: 28.3968, lng: -80.6057,
    price: 250,
    img: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop",
    dateISO: "2026-08-05T14:00:00Z",
  },
  {
    id: "u2",
    day: "14", month: "Aug",
    title: "Indie Live Night",
    place: "LA Live, Los Angeles",
    lat: 34.0453, lng: -118.2669,
    price: 120,
    img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1200&auto=format&fit=crop",
    dateISO: "2026-08-14T21:00:00Z",
  },
];

// Brand pin for map
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

export default function EventsHome() {
  const nav = useNavigate();
  const [mode, setMode] = useState("explore"); // explore | near
  const [cat, setCat] = useState("All");

  // Location
  const [loc, setLoc] = useState(null);
  const [locStatus, setLocStatus] = useState("loading");
  const [placeLabel, setPlaceLabel] = useState("");

  // Near You
  const [view, setView] = useState("list"); // list | map
  const [radius, setRadius] = useState(50);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    getMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getMyLocation() {
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
        reverseGeocode(p).catch(() => {});
      },
      () => {
        setLocStatus("denied");
        setLoc(MANGOCHI);
        setPlaceLabel("Mangochi");
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

  const countsByCat = useMemo(() => {
    const pool = [...popularAll, ...mangochiEvents];
    const counts = { All: pool.length };
    for (const c of categories.slice(1)) counts[c] = pool.filter(e => e.category === c).length;
    return counts;
  }, []);

  const filteredPopular = useMemo(() => {
    const base = cat === "All" ? popularAll : popularAll.filter(e => e.category === cat);
    if (!loc) return base;
    return [...base].sort((a, b) => kmBetween(loc, a) - kmBetween(loc, b));
  }, [cat, loc]);

  const nearPool = useMemo(() => [...mangochiEvents, ...popularAll], []);
  const nearEvents = useMemo(() => {
    if (!loc) return [];
    return nearPool
      .map(e => ({ ...e, distanceKm: kmBetween(loc, e) }))
      .filter(e => e.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [loc, radius, nearPool]);

  const distanceLabel = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
  const openDetail = (event) => nav(`/events/${event.id}`, { state: { event: { ...event } } });

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
            {placeLabel || (locStatus === "loading" ? "Locating…" : "Mangochi")}
            <i className="lni lni-reload text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <i className="lni lni-search-alt text-gray-400" />
            <input
              placeholder={mode === "explore" ? "Search for event" : "Search nearby events"}
              className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              onClick={() => setFilterOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
              aria-label="Filters"
            >
              <i className="lni lni-sliders" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <i className="lni lni-navigation text-violet-600" />
            {mode === "near" ? (
              <>
                {locStatus === "loading" && <span className="text-gray-500">Finding your position…</span>}
                {locStatus !== "loading" && (
                  <span className="text-gray-600">
                    {nearEvents.length} results within {radius} km of{" "}
                    <span className="font-medium text-gray-800">{placeLabel || "Mangochi"}</span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-600">Discover top picks and upcoming events</span>
            )}
          </div>
        </div>

        {mode === "explore" ? (
          <ExploreSection
            cat={cat}
            setCat={setCat}
            countsByCat={countsByCat}
            popular={filteredPopular}
            upcoming={upcomingAll}
            openDetail={openDetail}
            locReady={!!loc}
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
            distanceLabel={distanceLabel}
            locStatus={locStatus}
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

function ExploreSection({ cat, setCat, countsByCat, popular, upcoming, openDetail, locReady }) {
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
        {popular.length === 0 && (
          <div className="w-full text-sm text-gray-500">No events found.</div>
        )}
        {popular.map((e) => (
          <button
            key={e.id}
            onClick={() => openDetail(e)}
            className="group w-[265px] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-card hover:shadow-md"
          >
            <div className="relative h-44">
              <img src={e.img} alt={e.title} className="h-full w-full object-cover" draggable={false} />
              {/* Top left date */}
              <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
                {e.dateLabel}
              </div>
              {/* Category tag */}
              <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-gray-800 ring-1 ring-gray-200">
                {e.category}
              </div>
              {/* Gradient bottom */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              {/* Title + price on image */}
              <div className="absolute inset-x-2 bottom-2 flex items-end justify-between">
                <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
                  {e.title}
                </div>
                <div className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                  ${e.price}
                </div>
              </div>
            </div>
            {/* Footer: place + attendees */}
            <div className="p-3">
              <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <i className="lni lni-map-marker text-violet-600" />
                {e.place}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {e.attendees?.slice(0, 4).map((a, idx) => (
                    <img key={a + idx} src={a} className="h-7 w-7 rounded-full ring-2 ring-white" alt="" />
                  ))}
                </div>
                {locReady ? (
                  <i className="lni lni-arrow-right text-gray-400 group-hover:text-violet-700" />
                ) : (
                  <span className="text-[11px] text-gray-400">Tap for details</span>
                )}
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

function NearYouSection({ loc, radius, setRadius, view, setView, events, openDetail, distanceLabel, locStatus }) {
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
              {locStatus === "loading" ? "Locating…" : "Location unavailable"}
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
                  <img src={e.img} alt={e.title} className="h-full w-full object-cover" draggable={false} />
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
      <button className="ml-auto text-sm font-medium text-violet-700 hover:underline">
        See All
      </button>
    </div>
  );
}

function UpcomingRow({ item, onOpen }) {
  return (
    <button
      onClick={() =>
        onOpen({
          id: item.id,
          title: item.title,
          place: item.place,
          price: item.price,
          img: item.img,
          dateLabel: `${item.day} ${item.month}`,
          dateISO: item.dateISO,
          category: "General",
          attendees: [],
          lat: item.lat,
          lng: item.lng,
          short: "",
        })
      }
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
          <img src={item.img} alt={item.title} className="h-full w-full object-cover" draggable={false} />
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
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-violet-700">
        <i className="lni lni-map-marker" />
      </div>
      <p className="mt-2 text-sm text-gray-600">{msg}</p>
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
  const [maxPrice, setMaxPrice] = useState(500);

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
            type="range"
            min={5}
            max={200}
            step={5}
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
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              className="w-1/2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Min"
            />
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
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