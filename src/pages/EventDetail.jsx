// src/pages/EventDetail.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { eventsService } from "../services/events.service.js";

/* helpers (same as before, trimmed) */
const currency = (n) => new Intl.NumberFormat([], { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
const fmtDayTime = (iso) => new Date(iso || Date.now()).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const pinIcon = L.divIcon({ className: "", iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -34], html: `<div style="width:40px;height:40px;border-radius:9999px;background:linear-gradient(135deg,#f0abfc 0%,#7c3aed 100%);display:flex;align-items:center;justify-content:center;color:#fff;border:2px solid #fff;box-shadow:0 10px 24px rgba(124,58,237,0.35);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-7-10a7 7 0 1114 0c0 5.65-7 10-7 10z" fill="rgba(255,255,255,0.25)"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>` });

function googleCalendarUrl({ title, startsAt, endsAt, location = "", details = "" }) {
  const fmt = (dt) => dt.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const s = new Date(startsAt);
  const e = new Date(endsAt || s.getTime() + 2 * 3600_000);
  const qs = new URLSearchParams({ action: "TEMPLATE", text: title || "Event", dates: `${fmt(s)}/${fmt(e)}`, location, details }).toString();
  return `https://calendar.google.com/calendar/render?${qs}`;
}
function downloadICS({ title, startsAt, endsAt, location = "", details = "" }) {
  const fmtICS = (d) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const s = fmtICS(startsAt); const e = fmtICS(endsAt || new Date(new Date(startsAt).getTime() + 2 * 3600_000));
  const body = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourApp//Calendar//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${Date.now()}-${Math.random().toString(36).slice(2)}@app
DTSTAMP:${fmtICS(new Date())}
DTSTART:${s}
DTEND:${e}
SUMMARY:${(title || "Event").replace(/\n/g, " ")}
LOCATION:${(location || "").replace(/\n/g, " ")}
DESCRIPTION:${(details || "").replace(/\n/g, " ")}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, "\r\n");
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "event.ics"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function EventDetail({ fallbackEvent }) {
  const nav = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();
  const navEvent = state?.event;

  const [e, setE] = useState(
    navEvent ||
      fallbackEvent || {
        id, title: "Celebration Concert", category: "Concert", city: "Miami, FL",
        price: 120, starts_at: "2026-07-31T20:00:00Z", cover_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
        description: "A night of lights, music, and energy.", lat: 25.7617, lng: -80.1918, capacity: 500, attendees_count: 312, host: { name: "Wave Productions", avatar: "https://i.pravatar.cc/80?img=8" },
      }
  );
  const [loading, setLoading] = useState(!navEvent && !fallbackEvent);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const mapRow = useCallback((row) => {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      category: row.category || "Other",
      city: row.city || "Unknown place",
      price: Number(row.price ?? 0),
      starts_at: row.starts_at || row.dateISO,
      ends_at: row.ends_at || null,
      cover_url: row.cover_url || row.img || "",
      description: row.about || row.description || row.short || "",
      lat: typeof row.lat === "number" ? row.lat : Number(row.lat ?? NaN),
      lng: typeof row.lng === "number" ? row.lng : Number(row.lng ?? NaN),
      capacity: row.capacity || null,
      attendees_count: row.attendees_count || row.attendees?.length || null,
      host: row.host || row.creator || null, // if API returns
    };
  }, []);

  const abortRef = useRef(null);
  useEffect(() => {
    if (navEvent) return;
    let mounted = true;
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        setLoading(true);
        let row;
        if (typeof eventsService?.get === "function") {
          const sigAware = eventsService.get.length >= 2;
          row = sigAware ? await eventsService.get(id, { signal: ac.signal }) : await eventsService.get(id);
        } else {
          const token = localStorage.getItem("access_token");
          const r = await fetch(`/api/events/${id}`, {
            method: "GET",
            signal: ac.signal,
            credentials: "include",
            headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          if (r.status === 401) throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          row = (await r.json())?.item || (await r.json());
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
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [id, navEvent, mapRow]);

  const dt = fmtDayTime(e?.starts_at);
  const attendFill = useMemo(() => {
    const cap = e?.capacity || 0;
    const cnt = e?.attendees_count || 0;
    const pct = cap > 0 ? Math.min(100, Math.round((cnt / cap) * 100)) : 0;
    return { cnt, cap, pct };
  }, [e]);

  const onAddToCalendar = () => {
    const s = new Date(e.starts_at);
    const url = googleCalendarUrl({ title: e.title, startsAt: s, endsAt: e.ends_at, location: e.city, details: e.description });
    if (navigator.share) {
      navigator.share({ title: e.title, text: e.description || "", url }).catch(() =>
        downloadICS({ title: e.title, startsAt: s, endsAt: e.ends_at, location: e.city, details: e.description })
      );
    } else {
      downloadICS({ title: e.title, startsAt: s, endsAt: e.ends_at, location: e.city, details: e.description });
    }
  };

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* HERO */}
      <div className="relative">
        <div className="relative aspect-[16/10] overflow-hidden">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-gray-100" />
          ) : e?.cover_url ? (
            <img src={e.cover_url} alt={e.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">No cover</div>
          )}
          {/* Cinematic gradients */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          {/* Glass controls */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white">
              <i className="lni lni-chevron-left text-lg" />
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setSaved((s) => !s)} className={`grid h-10 w-10 place-items-center rounded-full ${saved ? "bg-violet-600 text-white" : "bg-white/85 text-gray-800"} shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white`}>
                <i className="lni lni-bookmark" />
              </button>
              <button onClick={() => navigator.share?.({ title: e.title, url: window.location.href })} className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-gray-800 shadow-sm ring-1 ring-gray-200 backdrop-blur hover:bg-white">
                <i className="lni lni-share" />
              </button>
            </div>
          </div>

          {/* Title + meta overlay */}
          {!loading && (
            <div className="absolute inset-x-4 bottom-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2 py-0.5 text-xs text-white ring-1 ring-white/20 backdrop-blur">
                    <i className="lni lni-calendar" /> {dt}
                  </div>
                  <h1 className="mt-1 truncate text-2xl font-semibold text-white drop-shadow">{e?.title}</h1>
                  <div className="mt-1 text-sm text-white/90">
                    <i className="lni lni-map-marker text-white/90" /> {e?.city}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl bg-white/90 px-3 py-2 text-right text-sm font-semibold text-violet-700 ring-1 ring-violet-200 backdrop-blur">
                  {currency(e?.price)} <span className="block text-[11px] font-normal text-gray-500">per person</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-4">
        {err ? (
          <div className="text-center">
            <p className="text-red-600 font-medium">Failed to load</p>
            <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
          </div>
        ) : (
          <>
            {/* Host + capacity */}
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 shadow-card">
              <div className="flex items-center gap-3">
                {e?.host?.avatar ? (
                  <img src={e.host.avatar} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-violet-600">
                    <i className="lni lni-user" />
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500">Hosted by</div>
                  <div className="text-sm font-medium">{e?.host?.name || "Organizer"}</div>
                </div>
              </div>
              {e?.capacity ? (
                <div className="w-36">
                  <div className="flex items-center justify-between text-[11px] text-gray-600">
                    <span>{e?.attendees_count ?? 0}/{e.capacity}</span>
                    <span>Filled</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-violet-600" style={{ width: `${attendFill.pct}%` }} />
                  </div>
                </div>
              ) : null}
            </div>

            {/* About */}
            {e?.description && (
              <div className="mt-5">
                <h2 className="text-sm font-semibold">About</h2>
                <p className="mt-1 text-sm leading-6 text-gray-700">{e.description}</p>
              </div>
            )}

            {/* Map */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="relative">
                {typeof e?.lat === "number" && typeof e?.lng === "number" ? (
                  <EventMap lat={e.lat} lng={e.lng} title={e.title} place={e.city} />
                ) : (
                  <div className="aspect-[16/9] grid place-items-center bg-gray-100 text-sm text-gray-500">Location unavailable</div>
                )}
                {typeof e?.lat === "number" && typeof e?.lng === "number" && (
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

            {/* Quick actions */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                to={`/calendar?d=${encodeURIComponent(new Date(e.starts_at).toISOString().slice(0,10))}`}
                className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm hover:bg-gray-50"
              >
                <div className="text-sm font-semibold text-gray-900">Open Calendar</div>
                <div className="text-xs text-gray-500">See your day</div>
              </Link>
              <button onClick={onAddToCalendar} className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-center text-violet-700 shadow-sm hover:bg-violet-100">
                <div className="text-sm font-semibold">Add to Calendar</div>
                <div className="text-xs opacity-80">Google/ICS</div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sticky CTA */}
      {!err && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <div className="text-gray-600">Price</div>
              <div className="font-semibold text-violet-700">
                {currency(e?.price)} <span className="text-xs text-gray-500">/Person</span>
              </div>
            </div>
            <button className="shrink-0 rounded-full bg-violet-600 px-6 py-3 font-semibold text-white shadow-card hover:bg-violet-700 active:scale-[0.99]" onClick={() => alert("Ticket flow")}>
              Get Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventMap({ lat, lng, title, place }) {
  const pos = [lat, lng];
  return (
    <MapContainer center={pos} zoom={14} style={{ height: 260, width: "100%" }} className="touch-pan-y" zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={pos} icon={pinIcon}>
        <Popup>
          <div className="text-sm">
            <div className="font-semibold">{title}</div>
            <div className="text-gray-600">{place}</div>
          </div>
        </Popup>
      </Marker>
      <Recenter position={pos} />
    </MapContainer>
  );
}
function Recenter({ position }) {
  const map = useMap();
  useEffect(() => { map.setView(position, 14, { animate: true }); }, [position, map]);
  return null;
}