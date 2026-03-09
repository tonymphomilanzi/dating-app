import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

// Map libs
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function EventDetail({ fallbackEvent }) {
  const nav = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();

  // Prefer state from navigation; else fallback
  const e =
    state?.event ||
    fallbackEvent || {
      id,
      title: "Celebration Concert",
      category: "Concert",
      place: "245 Oceanview Blvd, Miami",
      price: 400,
      dateLabel: "31 July",
      dateISO: "2026-07-31T20:00:00Z",
      img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
      short: "A night of lights, music, and energy.",
      attendees: [
        "https://i.pravatar.cc/80?img=1",
        "https://i.pravatar.cc/80?img=2",
        "https://i.pravatar.cc/80?img=3",
      ],
      // Add coordinates for the interactive map (Miami)
      lat: 25.7617,
      lng: -80.1918,
    };

  const dayTime = new Date(e.dateISO || Date.now()).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="relative aspect-[16/10] bg-gray-100">
          <img
            src={e.img}
            alt={e.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
          {/* top controls */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <button
              onClick={() => nav(-1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white"
              aria-label="Back"
            >
              <i className="lni lni-chevron-left text-lg" />
            </button>
            <div className="flex items-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white" aria-label="Share">
                <i className="lni lni-share" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white" aria-label="Bookmark">
                <i className="lni lni-bookmark" />
              </button>
            </div>
          </div>

          {/* Date pill */}
          <div className="absolute left-3 bottom-3 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
            {e.dateLabel}
          </div>

          {/* bottom gradient for readability */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{e.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">
                <i className="lni lni-music text-sm" />
                {e.category}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-600">
                <i className="lni lni-calendar" />
                {dayTime}
              </span>
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-violet-50 px-2.5 py-1 text-sm font-semibold text-violet-700 ring-1 ring-violet-200">
            ${e.price}
            <span className="text-xs text-gray-500">/Person</span>
          </div>
        </div>

        {/* Location */}
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <i className="lni lni-map-marker text-violet-600" />
          <span>{e.place}</span>
        </div>

        {/* Attendees */}
        {e.attendees?.length ? (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {e.attendees.slice(0, 5).map((a, i) => (
                <img
                  key={a + i}
                  src={a}
                  className="h-8 w-8 rounded-full ring-2 ring-white"
                  alt=""
                  draggable={false}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">Attending</span>
          </div>
        ) : null}

        {/* About */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold">About</h2>
          <p className="mt-1 text-sm leading-6 text-gray-700">
            {e.about || e.short}
          </p>
          <button className="mt-1 text-sm font-medium text-violet-700">Read more</button>
        </div>

        {/* Quick info cards */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <InfoCard icon="lni lni-timer" label="Duration" value="3h approx." />
          <InfoCard icon="lni lni-ticket" label="Tickets" value="Limited seats" />
          <InfoCard icon="lni lni-parking" label="Parking" value="On site" />
          <InfoCard icon="lni lni-shield" label="Policy" value="Refundable" />
        </div>

        {/* Interactive Map */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="relative">
            <EventMap
              lat={e.lat}
              lng={e.lng}
              title={e.title}
              place={e.place}
            />
            {/* Directions pill */}
            {e.lat && e.lng && (
              <a
                className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm text-gray-800 ring-1 ring-gray-200 shadow-sm hover:bg-white"
                href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                target="_blank" rel="noreferrer"
              >
                Get directions
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
            <div className="text-gray-600">Price</div>
            <div className="font-semibold text-violet-700">
              ${e.price} <span className="text-xs text-gray-500">/Person</span>
            </div>
          </div>
          <button
            className="shrink-0 rounded-full bg-violet-600 px-6 py-3 font-semibold text-white shadow-card hover:bg-violet-700 active:scale-[0.99]"
            onClick={() => alert("Ticket flow")}
          >
            Get Tickets
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <i className={`${icon} text-violet-600`} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-1 text-sm text-gray-900">{value}</div>
    </div>
  );
}

/* ---------------- Map sub-component ---------------- */

function EventMap({ lat, lng, title, place }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return (
      <div className="aspect-[16/9] grid place-items-center bg-gray-100 text-sm text-gray-500">
        Location unavailable
      </div>
    );
  }

  const position = [lat, lng];

  // Pretty gradient pin (DivIcon) in your palette
  const pinIcon = React.useMemo(
    () =>
      L.divIcon({
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
              <path d="M12 13a3 3 0 100-6 3 3 0 000 6z" fill="#fff"/>
            </svg>
          </div>
        `,
      }),
    []
  );

  return (
    <MapContainer
      center={position}
      zoom={14}
      scrollWheelZoom
      style={{ height: 260, width: "100%" }}
      className="touch-pan-y"
      zoomControl={false}
    >
      <TileLayer
        // Free OSM tiles
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={position} icon={pinIcon}>
        <Popup>
          <div className="text-sm">
            <div className="font-semibold">{title}</div>
            <div className="text-gray-600">{place}</div>
          </div>
        </Popup>
      </Marker>
      <Recenter position={position} />
    </MapContainer>
  );
}

function Recenter({ position }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(position, 14, { animate: true });
  }, [position, map]);
  return null;
}