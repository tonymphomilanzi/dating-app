// src/pages/EventDetail.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ================================================================
   CONSTANTS & FORMATTERS
   ================================================================ */
const priceFmt = new Intl.NumberFormat("en-US", {
  style:                "currency",
  currency:             "USD",
  maximumFractionDigits: 0,
});

/* ================================================================
   LEAFLET PIN — created once at module level, never inside render
   ================================================================ */
const customPin = L.divIcon({
  className:  "",
  iconSize:   [48, 48],
  iconAnchor: [24, 44],
  popupAnchor:[0, -44],
  html: `
    <div style="
      position:relative;width:48px;height:48px;
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        width:40px;height:40px;border-radius:9999px;
        background:linear-gradient(135deg,#8b5cf6,#7c3aed);
        border:4px solid #fff;
        box-shadow:0 8px 24px rgba(124,58,237,.5);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="rgba(255,255,255,0.9)"/>
          <circle cx="12" cy="9" r="2.5" fill="#7c3aed"/>
        </svg>
      </div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:8px solid #7c3aed;
      "/>
    </div>`,
});

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Normalise any raw API shape into the fields this page needs.
 * This is the ONLY place field names are mapped — never inline.
 */
function normaliseEvent(raw) {
  if (!raw) return null;
  return {
    id:              raw.id,
    title:           raw.title          || "Untitled Event",
    description:     raw.description    || "",
    cover_url:       raw.cover_url      || raw.img        || raw.image_url || "",
    category:        raw.category       || "Event",
    city:            raw.city           || raw.place      || raw.location  || "",
    address:         raw.address        || raw.venue      || "",
    lat:             raw.lat  != null   ? Number(raw.lat)  : null,
    lng:             raw.lng  != null   ? Number(raw.lng)  : null,
    starts_at:       raw.starts_at      || raw.start_date || raw.date     || null,
    ends_at:         raw.ends_at        || raw.end_date   || null,
    price:           raw.price  != null ? Number(raw.price) : 0,
    capacity:        raw.capacity != null ? Number(raw.capacity) : null,
    attendees_count: raw.attendees_count != null
                       ? Number(raw.attendees_count)
                       : raw.attendees != null
                         ? Number(raw.attendees)
                         : 0,
    host: {
      name:   raw.host?.name   || raw.organizer?.name   || raw.organiser?.name   || "Event Organiser",
      avatar: raw.host?.avatar || raw.organizer?.avatar || raw.organiser?.avatar || "",
      bio:    raw.host?.bio    || raw.organizer?.bio    || raw.organiser?.bio    || "",
    },
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

function formatDateTime(isoString) {
  if (!isoString) return { date: "Date TBA", time: "" };
  const d = new Date(isoString);
  if (isNaN(d)) return { date: "Date TBA", time: "" };
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "long",
      month:   "long",
      day:     "numeric",
      year:    "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour:   "2-digit",
      minute: "2-digit",
    }),
    relative: relativeDay(d),
    iso:      d.toISOString(),
  };
}

function relativeDay(date) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tgt   = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff  = Math.round((tgt - today) / 86_400_000);
  if (diff === 0)           return "Today";
  if (diff === 1)           return "Tomorrow";
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  if (diff < 0)             return "Past event";
  return "";
}

function isValidCoord(lat, lng) {
  return (
    lat != null && lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    !(Number(lat) === 0 && Number(lng) === 0)
  );
}

function avatarFallback(name = "Host") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ede9fe&color=7c3aed&bold=true&size=128`;
}

function shareEvent(event) {
  if (!event) return;
  const url  = window.location.href;
  const text = `${event.title} – ${event.city}`;
  if (navigator.share) {
    navigator.share({ title: event.title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

/* ================================================================
   MAP SUB-COMPONENTS
   ================================================================ */
function MapAutoCenter({ position }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    const key = position.join(",");
    if (prev.current === key) return;
    prev.current = key;
    map.setView(position, 15, { animate: true });
  }, [position, map]);
  return null;
}

const EventMap = memo(function EventMap({ lat, lng, title, address }) {
  const position = useMemo(() => [Number(lat), Number(lng)], [lat, lng]);
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-gray-100 shadow-lg"
      style={{ height: 280 }}
    >
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <Marker position={position} icon={customPin}>
          <Popup>
            <div className="text-sm font-semibold text-gray-800 min-w-[120px]">
              {title}
              {address && (
                <p className="text-xs text-gray-500 mt-0.5 font-normal">{address}</p>
              )}
            </div>
          </Popup>
        </Marker>
        <MapAutoCenter position={position} />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
    </div>
  );
});

/* ================================================================
   SKELETON
   ================================================================ */
function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-[55vh] bg-gray-200" />
      <div className="px-5 -mt-8 relative z-10 space-y-5 max-w-lg mx-auto">
        <div className="h-7 bg-gray-200 rounded-2xl w-1/3" />
        <div className="h-10 bg-gray-200 rounded-2xl w-full" />
        <div className="h-5 bg-gray-200 rounded-xl w-2/3" />
        <div className="h-24 bg-white rounded-3xl shadow-sm border border-gray-100" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-white rounded-3xl shadow-sm border border-gray-100" />
          <div className="h-28 bg-white rounded-3xl shadow-sm border border-gray-100" />
        </div>
        <div className="space-y-2.5">
          <div className="h-4 bg-gray-200 rounded-xl w-full" />
          <div className="h-4 bg-gray-200 rounded-xl w-full" />
          <div className="h-4 bg-gray-200 rounded-xl w-4/5" />
          <div className="h-4 bg-gray-200 rounded-xl w-3/4" />
        </div>
        <div className="h-64 bg-gray-200 rounded-3xl" />
      </div>
      <div className="fixed bottom-0 inset-x-0 h-28 bg-white/80 backdrop-blur-xl border-t border-gray-100" />
    </div>
  );
}

/* ================================================================
   ERROR STATE
   ================================================================ */
function ErrorState({ message, onBack, onRetry }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center
      justify-center gap-5 px-6 text-center">
      <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center text-4xl">
        🎪
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Event not found</h2>
        <p className="mt-1.5 text-sm text-gray-500">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-200 bg-white px-5 py-2.5
            text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onRetry}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold
            text-white hover:bg-violet-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   INFO CARD
   ================================================================ */
function InfoCard({ icon, label, children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl p-5 border border-gray-100 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function EventDetail() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const { state } = useLocation();

  // Seed from nav state immediately — avoids a flash of skeleton
  // when navigating from the events list which passes event data
  const [event,    setEvent]    = useState(() => normaliseEvent(state?.event ?? null));
  const [loading,  setLoading]  = useState(!state?.event);
  const [error,    setError]    = useState("");
  const [isSaved,  setIsSaved]  = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ──────────────────────────────────────────────────────────────
     FETCH
     - If nav state had the event, show it immediately and skip
       the initial fetch (no AbortController needed on mount).
     - Only fetch when: no nav state data, or user explicitly retries.
     - `cancelled` flag guards setState after unmount — no abort
       controller so nothing interferes with router transitions.
  ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // If we already have event data from nav state and this isn't
    // a manual retry, skip the fetch entirely
    if (event && retryKey === 0) return;

    let cancelled = false;

    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(`/api/events/${id}`);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `Server error ${res.status}`);
        }

        const data = await res.json();
        // Accept: { item: {...} } | { event: {...} } | raw object
        const raw  = data?.item ?? data?.event ?? data;

        if (cancelled) return;
        setEvent(normaliseEvent(raw));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not load this event.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, retryKey]);
  // `event` intentionally excluded — we only re-fetch on id change or retry

  /* ──────────────────────────────────────────────────────────────
     DERIVED DATA
  ────────────────────────────────────────────────────────────── */
  const dt = useMemo(() => formatDateTime(event?.starts_at), [event?.starts_at]);

  const capacityPct = useMemo(() => {
    if (!event?.capacity || !event?.attendees_count) return 0;
    return Math.min(100, Math.round((event.attendees_count / event.capacity) * 100));
  }, [event?.capacity, event?.attendees_count]);

  const hasMap = useMemo(
    () => event && isValidCoord(event.lat, event.lng),
    [event]
  );

  const mapsUrl = useMemo(() => {
    if (!hasMap) return "#";
    return `https://maps.google.com/?q=${event.lat},${event.lng}`;
  }, [hasMap, event]);

  const handleShare = useCallback(() => shareEvent(event), [event]);

  const handleRetry = useCallback(() => {
    setEvent(null);
    setRetryKey((k) => k + 1);
  }, []);

  /* ──────────────────────────────────────────────────────────────
     GUARDS
  ────────────────────────────────────────────────────────────── */
  if (loading && !event) return <DetailSkeleton />;

  if (error && !event) {
    return (
      <ErrorState
        message={error}
        onBack={() => navigate(-1)}
        onRetry={handleRetry}
      />
    );
  }

  if (!event) return <DetailSkeleton />;

  /* ──────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 pb-36 antialiased">

      {/* Floating Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between
        p-4 pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto h-11 w-11 rounded-2xl bg-white/90
            backdrop-blur-lg border border-white/60 shadow-lg
            flex items-center justify-center
            hover:bg-white active:scale-90 transition-all duration-150"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-900" />
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsSaved((s) => !s)}
            aria-label={isSaved ? "Unsave event" : "Save event"}
            className={`h-11 w-11 rounded-2xl border shadow-lg
              flex items-center justify-center transition-all duration-200
              ${isSaved
                ? "bg-violet-600 border-violet-600 text-white scale-105"
                : "bg-white/90 backdrop-blur-lg border-white/60 text-gray-700 hover:bg-white"
              }`}
          >
            <BookmarkIcon className="h-5 w-5" filled={isSaved} />
          </button>
          <button
            onClick={handleShare}
            aria-label="Share event"
            className="h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-lg
              border border-white/60 shadow-lg flex items-center justify-center
              text-gray-700 hover:bg-white active:scale-90 transition-all duration-150"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Hero Image */}
      <div className="relative h-[58vh] w-full overflow-hidden bg-gray-900">
        {event.cover_url && !imgError ? (
          <img
            src={event.cover_url}
            alt={event.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
            style={{ objectPosition: "center top" }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700
            flex items-end pb-16 pl-6">
            <span className="text-8xl opacity-40"></span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t
          from-gray-50 via-gray-50/10 to-transparent" />
        <div className="absolute left-5 bottom-20">
          <span className="inline-flex items-center gap-1.5 rounded-full
            bg-violet-600/90 backdrop-blur-sm border border-white/20
            px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white
            shadow-lg shadow-violet-900/30">
            {event.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 -mt-10 px-5 max-w-lg mx-auto space-y-5">

        {/* Title block */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">
            {event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {event.city && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPinIcon className="h-4 w-4 text-violet-500 shrink-0" />
                <span>{event.city}</span>
              </div>
            )}
            {dt.relative && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                text-xs font-semibold ${
                  dt.relative === "Today" || dt.relative === "Tomorrow"
                    ? "bg-green-50 text-green-700"
                    : dt.relative === "Past event"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-violet-50 text-violet-700"
                }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {dt.relative}
              </span>
            )}
          </div>
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px]
                    font-medium text-gray-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Organiser card */}
        <div className="flex items-center justify-between gap-4 bg-white
          rounded-3xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={event.host.avatar || avatarFallback(event.host.name)}
                onError={(e) => { e.currentTarget.src = avatarFallback(event.host.name); }}
                alt={event.host.name}
                className="h-12 w-12 rounded-2xl object-cover border-2 border-violet-100"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full
                bg-green-500 border-2 border-white flex items-center justify-center">
                <CheckIcon className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Organiser
              </p>
              <p className="font-bold text-gray-900 truncate">{event.host.name}</p>
              {event.host.bio && (
                <p className="text-xs text-gray-500 truncate">{event.host.bio}</p>
              )}
            </div>
          </div>
          <button className="shrink-0 rounded-2xl bg-violet-50 px-4 py-2 text-sm
            font-bold text-violet-700 hover:bg-violet-100 active:scale-95
            transition-all duration-150">
            Contact
          </button>
        </div>

        {/* Date + Capacity grid */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard
            label="Date & Time"
            icon={<CalendarIcon className="h-4 w-4 text-violet-600" />}
          >
            <p className="text-sm font-bold text-gray-900 leading-snug">{dt.date}</p>
            {dt.time && (
              <p className="mt-1 text-xs font-medium text-gray-500">{dt.time}</p>
            )}
          </InfoCard>

          <InfoCard
            label="Availability"
            icon={<TicketIcon className="h-4 w-4 text-violet-600" />}
          >
            {event.capacity ? (
              <>
                <p className="text-sm font-bold text-gray-900">
                  {event.capacity - event.attendees_count > 0
                    ? `${event.capacity - event.attendees_count} left`
                    : "Sold out"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {event.attendees_count}/{event.capacity} attending
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      capacityPct >= 90 ? "bg-red-500" :
                      capacityPct >= 70 ? "bg-amber-500" : "bg-violet-600"
                    }`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm font-bold text-gray-900">Open</p>
            )}
          </InfoCard>
        </div>

        {/* About */}
        {event.description && (
          <InfoCard
            label="About This Event"
            icon={<InfoIcon className="h-4 w-4 text-violet-600" />}
            className="col-span-2"
          >
            <ExpandableText text={event.description} />
          </InfoCard>
        )}

        {/* Location */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Location</h3>
            {hasMap && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold
                  text-violet-600 hover:underline"
              >
                Get directions
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            )}
          </div>

          {event.address && (
            <p className="text-sm text-gray-500 flex items-start gap-1.5">
              <MapPinIcon className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
              {event.address}
              {event.city ? `, ${event.city}` : ""}
            </p>
          )}

          {hasMap ? (
            <EventMap
              lat={event.lat}
              lng={event.lng}
              title={event.title}
              address={event.address || event.city}
            />
          ) : (
            <div className="rounded-3xl bg-gray-100 border border-dashed border-gray-200
              h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
              <MapPinIcon className="h-8 w-8 opacity-40" />
              <span className="text-sm">Location details TBA</span>
            </div>
          )}
        </div>

        {/* Non-fatal error banner — nav state data shown, background fetch failed */}
        {error && event && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4
            flex items-start gap-3">
            <WarningIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">Showing cached data</p>
              <p className="text-xs text-amber-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="shrink-0 text-xs font-bold text-amber-700
                hover:text-amber-900 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <footer className="fixed bottom-0 inset-x-0 z-50">
        <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-xl
          border-t border-gray-200/60" />
        <div className="relative px-5 pt-3 pb-8 max-w-lg mx-auto">
          <div className="flex items-center gap-4 bg-gray-900 rounded-3xl p-3
            shadow-2xl shadow-gray-900/30">
            <div className="flex-1 pl-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {event.price === 0 ? "Admission" : "Starting from"}
              </p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {event.price === 0 ? "Free" : priceFmt.format(event.price)}
              </p>
            </div>
            <button
              className="flex-shrink-0 h-14 px-8 rounded-2xl font-extrabold text-base
                bg-gradient-to-r from-violet-600 to-violet-500 text-white
                shadow-lg shadow-violet-600/40
                hover:from-violet-500 hover:to-violet-400
                active:scale-95 transition-all duration-150"
              onClick={() => {/* integrate booking flow */}}
            >
              {event.price === 0 ? "RSVP Free" : "Get Tickets"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================
   EXPANDABLE TEXT
   ================================================================ */
function ExpandableText({ text, maxChars = 200 }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxChars;
  const displayed = expanded || !needsTruncation
    ? text
    : `${text.slice(0, maxChars).trimEnd()}…`;

  return (
    <div>
      <p className="text-sm text-gray-600 leading-relaxed">{displayed}</p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/* ================================================================
   ICONS
   ================================================================ */
function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function BookmarkIcon({ className = "h-5 w-5", filled = false }) {
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}
function ShareIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5"  r="3" />
      <circle cx="6"  cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49" />
    </svg>
  );
}
function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function CalendarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2"  x2="16" y2="6"  />
      <line x1="8"  y1="2"  x2="8"  y2="6"  />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}
function TicketIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 010-6h20a3 3 0 010 6" />
      <path d="M2 15a3 3 0 000 6h20a3 3 0 000-6" />
      <line x1="2"  y1="9"  x2="2"  y2="15" />
      <line x1="22" y1="9"  x2="22" y2="15" />
    </svg>
  );
}
function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12" y2="8"  strokeWidth={2.5} strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  );
}
function CheckIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function ExternalLinkIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}