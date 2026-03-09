// src/pages/EventDetail.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

// Map libs
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { eventsService } from "../services/events.service.js";

/* ---------------- helpers ---------------- */
function dateLabelFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}
function dayMonthFromISO(iso) {
  const d = new Date(iso);
  return { day: String(d.getDate()).padStart(2, "0"), month: d.toLocaleDateString([], { month: "short" }) };
}
function fmtDayTime(iso) {
  const d = new Date(iso || Date.now());
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function googleCalendarUrl({ title, startsAt, durationHours = 3, location = "", details = "" }) {
  const start = new Date(startsAt || Date.now());
  const end = new Date(start.getTime() + durationHours * 3600_000);
  const fmt = (dt) => dt.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Event",
    dates: `${fmt(start)}/${fmt(end)}`,
    location,
    details,
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

// Pretty gradient pin
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

/* ---------------- main ---------------- */
export default function EventDetail({ fallbackEvent }) {
  const nav = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();

  // Prefer state from navigation; else fallback
  const navEvent = state?.event;
  const initial = useMemo(() => {
    return (
      navEvent ||
      fallbackEvent || {
        id,
        title: "Celebration Concert",
        category: "Concert",
        place: "245 Oceanview Blvd, Miami",
        price: 400,
        dateISO: "2026-07-31T20:00:00Z",
        dateLabel: "31 Jul",
        img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
        short: "A night of lights, music, and energy.",
        attendees: [
          "https://i.pravatar.cc/80?img=1",
          "https://i.pravatar.cc/80?img=2",
          "https://i.pravatar.cc/80?img=3",
        ],
        lat: 25.7617,
        lng: -80.1918,
      }
    );
  }, [navEvent, fallbackEvent, id]);

  const [e, setE] = useState(initial);
  const [loading, setLoading] = useState(!navEvent && !fallbackEvent); // fetch if navigated directly
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  // Map server row to UI shape
  const mapRow = useCallback((row) => {
    if (!row) return null;
    const starts = row.starts_at || row.dateISO;
    const mapped = {
      id: row.id,
      title: row.title,
      category: row.category || "Other",
      place: row.city || row.place || "Unknown place",
      price: row.price || 0,
      dateISO: starts,
      dateLabel: dateLabelFromISO(starts),
      ...dayMonthFromISO(starts),
      img: row.cover_url || row.img || "",
      about: row.about || row.description || row.short || "",
      attendees: row.attendees || [],
      lat: row.lat,
      lng: row.lng,
    };
    return mapped;
  }, []);

  // Abortable fetch if user loaded detail directly
  const abortRef = useRef(null);
  useEffect(() => {
    if (navEvent) return; // we already have data
    let mounted = true;

    async function fetchById() {
      setLoading(true);
      setErr("");
      abortRef.current?.abort?.();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        let row;

        // Try service first if present
        const hasGet = typeof eventsService?.get === "function";
        if (hasGet) {
          // Prefer supporting signal if your service accepts it
          try {
            const maybeSignalAware = eventsService.get.length >= 2;
            row = maybeSignalAware ? await eventsService.get(id, { signal: ac.signal }) : await eventsService.get(id);
          } catch (e) {
            const status = e?.status || e?.response?.status;
            if (status === 401) throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
            throw e;
          }
        } else {
          // Fallback to direct fetch with credentials + optional bearer
          const token = localStorage.getItem("access_token");
          const r = await fetch(`/api/events/${id}`, {
            method: "GET",
            signal: ac.signal,
            credentials: "include",
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (r.status === 401) throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
          if (!r.ok) {
            const t = await r.text().catch(() => "");
            throw new Error(`HTTP ${r.status}${t ? ` – ${t.slice(0, 120)}` : ""}`);
          }
          row = await r.json().catch(() => null);
          row = row?.item || row; // adjust if your API wraps
        }

        if (!mounted) return;
        const mapped = mapRow(row);
        if (mapped) setE(mapped);
      } catch (e) {
        if (!mounted || e?.name === "AbortError") return;
        setErr(e.message || "Failed to load event");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchById();
    return () => {
      mounted = false;
      abortRef.current?.abort?.();
    };
  }, [id, navEvent, mapRow]);

  const dateTime = fmtDayTime(e?.dateISO);

  const onShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({ title: e.title, text: e.about || e.short || "", url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied");
      }
    } catch {}
  };

  const calUrl = useMemo(
    () =>
      googleCalendarUrl({
        title: e?.title,
        startsAt: e?.dateISO,
        location: e?.place,
        details: e?.about || e?.short || "",
      }),
    [e]
  );

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="relative aspect-[16/10] bg-gray-100">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-gray-100" />
          ) : e?.img ? (
            <img src={e.img} alt={e.title} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="grid h-full w-full place-items-center text-gray-400">No cover</div>
          )}

          {/* top controls (glassy) */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <button
              onClick={() => nav(-1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white"
              aria-label="Back"
            >
              <i className="lni lni-chevron-left text-lg" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onShare}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white"
                aria-label="Share"
              >
                <i className="lni lni-share" />
              </button>
              <button
                onClick={() => setSaved((s) => !s)}
                className={`grid h-10 w-10 place-items-center rounded-full ${
                  saved ? "bg-violet-600 text-white" : "bg-white/85 text-gray-800"
                } shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white`}
                aria-label="Bookmark"
              >
                <i className={saved ? "lni lni-bookmark" : "lni lni-bookmark"} />
              </button>
            </div>
          </div>

          {/* Date pill */}
          {!loading && e?.dateLabel && (
            <div className="absolute left-3 bottom-3 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
              {e.dateLabel}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-4">
        {err ? (
          <ErrorCard
            err={err}
            onBack={() => nav(-1)}
            onSignIn={() => nav("/login", { state: { from: `/events/${id}` } })}
          />
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h1 className="text-xl font-semibold">{e?.title || "Event"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">
                    <i className="lni lni-music text-sm" />
                    {e?.category || "Other"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-gray-600">
                    <i className="lni lni-calendar" />
                    {dateTime}
                  </span>
                </div>
              </div>
              <div className="shrink-0 rounded-lg bg-violet-50 px-2.5 py-1 text-sm font-semibold text-violet-700 ring-1 ring-violet-200">
                ${e?.price ?? 0}
                <span className="text-xs text-gray-500">/Person</span>
              </div>
            </div>

            {/* Location */}
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <i className="lni lni-map-marker text-violet-600" />
              <span>{e?.place}</span>
            </div>

            {/* Attendees */}
            {e?.attendees?.length ? (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {e.attendees.slice(0, 5).map((a, i) => (
                    <img key={a + i} src={a} className="h-8 w-8 rounded-full ring-2 ring-white" alt="" draggable={false} />
                  ))}
                </div>
                <span className="text-xs text-gray-500">Attending</span>
              </div>
            ) : null}

            {/* About */}
            {(e?.about || e?.short) && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold">About</h2>
                <p className="mt-1 text-sm leading-6 text-gray-700 line-clamp-5">
                  {e.about || e.short}
                </p>
                <button className="mt-1 text-sm font-medium text-violet-700" onClick={() => alert("Expand details")}>
                  Read more
                </button>
              </div>
            )}

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
                <EventMap lat={e?.lat} lng={e?.lng} title={e?.title} place={e?.place} />
                {typeof e?.lat === "number" && typeof e?.lng === "number" && (
                  <a
                    className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm text-gray-800 ring-1 ring-gray-200 shadow-sm hover:bg-white"
                    href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get directions
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky CTA */}
      {!err && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <a
              href={calUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
              title="Add to Calendar"
            >
              <div className="text-gray-600">Add to Calendar</div>
              <div className="font-medium text-gray-900 truncate">{e?.title}</div>
            </a>
            <button
              className="shrink-0 rounded-full bg-violet-600 px-6 py-3 font-semibold text-white shadow-card hover:bg-violet-700 active:scale-[0.99]"
              onClick={() => alert("Ticket flow")}
            >
              Get Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- small pieces ---------------- */
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

function EventMap({ lat, lng, title, place }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return <div className="aspect-[16/9] grid place-items-center bg-gray-100 text-sm text-gray-500">Location unavailable</div>;
  }
  const position = [lat, lng];
  return (
    <MapContainer center={position} zoom={14} scrollWheelZoom style={{ height: 260, width: "100%" }} className="touch-pan-y" zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={position} icon={pinIcon}>
        <Popup>
          <div className="text-sm">
            <div className="font-semibold">{title}</div>
            <div className="text-gray-600">{place}</div>
          </div>
        </Popup>
      </Marker>
      <RecenterDetail position={position} />
    </MapContainer>
  );
}
function RecenterDetail({ position }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 14, { animate: true });
  }, [position, map]);
  return null;
}

function ErrorCard({ err, onBack, onSignIn }) {
  const isAuth = /session expired|unauthorized|401/i.test(String(err));
  return (
    <div className="mt-10 text-center">
      <p className={isAuth ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
        {isAuth ? "You need to sign in" : "Failed to load"}
      </p>
      <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button className="btn-outline" onClick={onBack}>
          Go back
        </button>
        {isAuth && (
          <button className="btn-primary" onClick={onSignIn}>
            <i className="lni lni-unlock mr-1" />
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}