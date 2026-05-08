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
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS & FORMATTERS
   ================================================================ */
const priceFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const priceFmtExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ================================================================
   PAYMENT CONFIG
   ================================================================ */
const CRYPTO_OPTIONS = [
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    network: "Bitcoin Network",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    confirmations: "1 confirmation (~10 min)",
    iconId: "bitcoin",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    ring: "ring-orange-400",
  },
  {
    id: "usdt_trc20",
    symbol: "USDT",
    name: "Tether (TRC-20)",
    network: "TRON Network",
    address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    confirmations: "20 confirmations (~1 min)",
    iconId: "tether",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-400",
  },
];

const PAYMENT_METHODS = [
  {
    id: "crypto",
    label: "Crypto",
    sublabel: "BTC · USDT",
    iconId: "crypto",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    accentBtn: "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200",
  },
  {
    id: "momo",
    label: "Mobile Money",
    sublabel: "Instant transfer",
    iconId: "phone",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    accentBtn: "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200",
    fields: [
      { label: "Provider", value: "MTN Mobile Money / Orange Money" },
      { label: "Phone Number", value: "+1 (555) 000-0000", copyable: true },
      { label: "Account Name", value: "MatchApp Inc." },
    ],
    instructions: [
      "Open your Mobile Money app.",
      'Select "Send Money" or "Transfer".',
      "Enter the phone number above.",
      "Enter the exact amount shown.",
      "Use your Order ID as the payment reason.",
      'Tap "Confirm" and save your receipt.',
    ],
  },
  {
    id: "western_union",
    label: "Western Union",
    sublabel: "Global transfer",
    iconId: "western_union",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    accentBtn: "bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-200",
    fields: [
      { label: "Recipient Name", value: "John Smith", copyable: true },
      { label: "Country", value: "United States" },
      { label: "State / City", value: "New York, NY" },
      { label: "Test Question", value: "What is the code?" },
      { label: "Test Answer", value: "MATCHAPP2024", copyable: true },
    ],
    instructions: [
      "Visit any Western Union agent or westernunion.com.",
      "Send to the recipient details above.",
      "Enter the exact amount.",
      "Note your MTCN (Money Transfer Control Number).",
      "Submit the MTCN as your payment reference.",
    ],
  },
  {
    id: "bank",
    label: "Bank Transfer",
    sublabel: "SWIFT · SEPA",
    iconId: "bank",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    accentBtn: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    fields: [
      { label: "Bank Name", value: "Chase Bank" },
      { label: "Account Name", value: "MatchApp Inc." },
      { label: "Account Number", value: "000123456789", copyable: true },
      { label: "Routing / ABA", value: "021000021", copyable: true },
      { label: "SWIFT / BIC", value: "CHASUS33", copyable: true },
      { label: "IBAN", value: "US29 CHAS 0210 0002 1000 1234", copyable: true },
      { label: "Reference", value: "Use your Order ID" },
    ],
    instructions: [
      "Log in to your online banking portal.",
      "Start a new international or domestic transfer.",
      "Enter the account details above exactly.",
      "Use your Order ID as the payment reference.",
      "Allow 1–3 business days for processing.",
    ],
  },
];

/* ================================================================
   HELPERS
   ================================================================ */
function normaliseEvent(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    title: raw.title || "Untitled Event",
    description: raw.description || "",
    cover_url: raw.cover_url || raw.img || raw.image_url || "",
    category: raw.category || "Event",
    city: raw.city || raw.place || raw.location || "",
    address: raw.address || raw.venue || "",
    lat: raw.lat != null ? Number(raw.lat) : null,
    lng: raw.lng != null ? Number(raw.lng) : null,
    starts_at: raw.starts_at || raw.start_date || raw.date || null,
    ends_at: raw.ends_at || raw.end_date || null,
    price: raw.price != null ? Number(raw.price) : 0,
    capacity: raw.capacity != null ? Number(raw.capacity) : null,
    attendees_count:
      raw.attendees_count != null
        ? Number(raw.attendees_count)
        : raw.attendees != null
        ? Number(raw.attendees)
        : 0,
    host: {
      name:
        raw.host?.name ||
        raw.organizer?.name ||
        raw.organiser?.name ||
        "Event Organiser",
      avatar:
        raw.host?.avatar ||
        raw.organizer?.avatar ||
        raw.organiser?.avatar ||
        "",
      bio: raw.host?.bio || raw.organizer?.bio || raw.organiser?.bio || "",
    },
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

function formatDateTime(isoString) {
  if (!isoString)
    return { date: "Date TBA", time: "", relative: "", iso: "" };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime()))
      return { date: "Date TBA", time: "", relative: "", iso: "" };
    return {
      date: d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      relative: relativeDay(d),
      iso: d.toISOString(),
    };
  } catch {
    return { date: "Date TBA", time: "", relative: "", iso: "" };
  }
}

function relativeDay(date) {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tgt = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const diff = Math.round((tgt - today) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 0 && diff < 7) return `In ${diff} days`;
    if (diff < 0) return "Past event";
    return "";
  } catch {
    return "";
  }
}

function isValidCoord(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    !(Number(lat) === 0 && Number(lng) === 0)
  );
}

function avatarFallback(name = "Host") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=ede9fe&color=7c3aed&bold=true&size=128`;
}

function shareEvent(event) {
  if (!event) return;
  const url = window.location.href;
  const text = `${event.title} – ${event.city}`;
  if (navigator.share) {
    navigator.share({ title: event.title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

function generateOrderId() {
  return (
    "TKT-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/* ================================================================
   MAP — lazy loaded vanilla Leaflet, no top-level imports
   ================================================================ */
const EventMap = memo(function EventMap({ lat, lng, title, address }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !containerRef.current) return;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        const position = [Number(lat), Number(lng)];
        const pin = L.divIcon({
          className: "",
          iconSize: [48, 48],
          iconAnchor: [24, 44],
          popupAnchor: [0, -44],
          html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
            <div style="width:40px;height:40px;border-radius:9999px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:4px solid #fff;box-shadow:0 8px 24px rgba(124,58,237,.5);display:flex;align-items:center;justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.9)"/>
                <circle cx="12" cy="9" r="2.5" fill="#7c3aed"/>
              </svg>
            </div>
            <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #7c3aed;"/>
          </div>`,
        });
        const map = L.map(containerRef.current, {
          center: position,
          zoom: 15,
          scrollWheelZoom: false,
          zoomControl: false,
        });
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          }
        ).addTo(map);
        const marker = L.marker(position, { icon: pin }).addTo(map);
        if (title) {
          marker.bindPopup(
            `<div style="font-size:13px;font-weight:600;color:#1f2937;min-width:120px">
              ${title}
              ${
                address
                  ? `<p style="font-size:11px;color:#6b7280;margin-top:2px;font-weight:400">${address}</p>`
                  : ""
              }
            </div>`
          );
        }
        mapRef.current = map;
        if (!cancelled) setReady(true);
      } catch (err) {
        console.warn("Map failed to load:", err);
      }
    }

    initMap();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, title, address]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-gray-100 shadow-lg"
      style={{ height: 280 }}
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {!ready && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-3xl">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <SpinnerIcon className="h-6 w-6 animate-spin" />
            <span className="text-xs">Loading map…</span>
          </div>
        </div>
      )}
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
      <div className="px-5 -mt-8 relative z-10 space-y-5 max-w-lg mx-auto pt-4">
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
        </div>
        <div className="h-64 bg-gray-200 rounded-3xl" />
      </div>
    </div>
  );
}

/* ================================================================
   ERROR STATE
   ================================================================ */
function ErrorState({ message, onBack, onRetry }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center text-4xl">
        🎪
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Event not found</h2>
        <p className="mt-1.5 text-sm text-gray-500 max-w-xs">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onRetry}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
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
    <div
      className={`bg-white rounded-3xl p-5 border border-gray-100 shadow-sm ${className}`}
    >
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
   TOAST
   ================================================================ */
function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="fixed left-1/2 top-6 z-[300] -translate-x-1/2 pointer-events-none">
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border text-sm font-semibold ${
          isError
            ? "bg-red-500 border-red-400 text-white"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        {isError ? (
          <AlertIcon className="h-4 w-4 shrink-0" />
        ) : (
          <CheckIcon className="h-4 w-4 shrink-0 text-green-500" />
        )}
        {toast.message}
      </div>
    </div>
  );
}

/* ================================================================
   EXPANDABLE TEXT
   ================================================================ */
function ExpandableText({ text, maxChars = 200 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const needsTruncation = text.length > maxChars;
  const displayed =
    expanded || !needsTruncation
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
   PAYMENT METHOD ICON RESOLVERS
   ================================================================ */
function MethodIcon({ iconId, className }) {
  if (iconId === "crypto") return <CryptoIcon className={className} />;
  if (iconId === "phone") return <PhoneIcon className={className} />;
  if (iconId === "western_union")
    return <WesternUnionIcon className={className} />;
  if (iconId === "bank") return <BankIcon className={className} />;
  return <CryptoIcon className={className} />;
}

function CryptoOptionIcon({ iconId, className }) {
  if (iconId === "bitcoin") return <BitcoinIcon className={className} />;
  if (iconId === "tether") return <TetherIcon className={className} />;
  return <CryptoIcon className={className} />;
}

/* ================================================================
   IMPORTANT BOX
   ================================================================ */
function ImportantBox({ orderId, total, currency }) {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertIcon className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-bold text-amber-900">Important</p>
      </div>
      <ul className="space-y-1.5 pl-1">
        {[
          `Send the exact amount: $${total} ${currency}`,
          `Include Order ID in your payment note: ${orderId}`,
          "Double-check the address before sending.",
          "Keep your receipt — you'll need it to confirm.",
        ].map((line, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs text-amber-800"
          >
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================
   SUMMARY ROW
   ================================================================ */
function Row({ label, value, truncate = false, highlight = false }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`font-semibold text-right ${
          truncate ? "truncate max-w-[180px]" : ""
        } ${highlight ? "text-amber-600" : "text-gray-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ================================================================
   TICKET TYPE SKELETON (loading state inside modal)
   ================================================================ */
function TicketSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-2xl bg-gray-100 border border-gray-200"
        />
      ))}
    </div>
  );
}

/* ================================================================
   GET TICKETS MODAL
   Steps: select → method → details → confirm → done
   ================================================================ */
const MODAL_STEP = {
  SELECT: "select",
  METHOD: "method",
  DETAILS: "details",
  CONFIRM: "confirm",
  DONE: "done",
};

function GetTicketsModal({ event, onClose }) {
  const { user } = useAuth();

  /* ── ticket selection ── */
  const [step, setStep] = useState(MODAL_STEP.SELECT);
  const [qty, setQty] = useState(1);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  /* ── payment ── */
  const [method, setMethod] = useState(null);
  const [cryptoOption, setCryptoOption] = useState(null);
  const [orderId] = useState(() => generateOrderId());
  const [txRef, setTxRef] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ── toast ── */
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const copyToClipboard = useCallback(
    async (text, label) => {
      try {
        await navigator.clipboard.writeText(String(text));
        showToast(`${label} copied!`);
      } catch {
        showToast("Copy failed — please copy manually", "error");
      }
    },
    [showToast]
  );

  /* ── load ticket types from DB ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingTypes(true);
      try {
        const { data, error } = await supabase
          .from("event_ticket_types")
          .select("*")
          .eq("event_id", event.id)
          .eq("is_active", true)
          .order("sort_order");

        if (cancelled) return;
        if (error) throw error;

        if (data && data.length > 0) {
          setTicketTypes(data);
          setSelectedTypeId(data[0].id);
        } else {
          /* fallback: synthesise from event.price */
          const fallback = [
            {
              id: "__fallback_general__",
              name: event.price === 0 ? "Free Admission" : "General Admission",
              price: event.price || 0,
              capacity: event.capacity,
              sold_count: event.attendees_count || 0,
              description: "",
            },
          ];
          if (event.price > 0) {
            fallback.push({
              id: "__fallback_vip__",
              name: "VIP Access",
              price: Math.round(event.price * 2.5),
              capacity: null,
              sold_count: 0,
              description: "Premium experience",
            });
          }
          setTicketTypes(fallback);
          setSelectedTypeId(fallback[0].id);
        }
      } catch {
        /* error fallback */
        const fallback = [
          {
            id: "__fallback_general__",
            name: event.price === 0 ? "Free Admission" : "General Admission",
            price: event.price || 0,
            capacity: event.capacity,
            sold_count: event.attendees_count || 0,
            description: "",
          },
        ];
        if (!cancelled) {
          setTicketTypes(fallback);
          setSelectedTypeId(fallback[0].id);
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [event.id, event.price, event.capacity, event.attendees_count]);

  /* ── derived values ── */
  const selectedTicket =
    ticketTypes.find((t) => t.id === selectedTypeId) || ticketTypes[0];

  const isFree = !selectedTicket || Number(selectedTicket.price) === 0;

  const spotsLeft =
    selectedTicket?.capacity != null
      ? Math.max(
          0,
          Number(selectedTicket.capacity) -
            Number(selectedTicket.sold_count || 0)
        )
      : 999;

  const maxQty = Math.min(10, spotsLeft);
  const soldOut = selectedTicket?.capacity != null && spotsLeft === 0;
  const subtotal = selectedTicket ? Number(selectedTicket.price) * qty : 0;
  const fees = isFree ? 0 : Math.round(subtotal * 0.05);
  const total = subtotal + fees;
  const totalStr = total.toFixed(2);

  /* ── close / keyboard / scroll lock ── */
  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ── helpers ── */
  const isFallback = (id) =>
    typeof id === "string" && id.startsWith("__fallback");

  /* ── free RSVP ── */
  async function handleFreeRSVP() {
    if (!user?.id) {
      showToast("You must be signed in to RSVP", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (!isFallback(selectedTicket?.id)) {
        /* real ticket type → write to event_ticket_purchases */
        const { error } = await supabase
          .from("event_ticket_purchases")
          .insert({
            event_id: event.id,
            ticket_type_id: selectedTicket.id,
            user_id: user.id,
            order_id: orderId,
            quantity: 1,
            unit_price: 0,
            total_amount: 0,
            payment_method: "free",
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        /* fallback → write directly to event_attendees */
        const { error } = await supabase
          .from("event_attendees")
          .upsert(
            { event_id: event.id, user_id: user.id },
            { onConflict: "event_id,user_id" }
          );
        if (error) throw error;
      }
      setStep(MODAL_STEP.DONE);
    } catch (err) {
      showToast(err.message || "RSVP failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── method select ── */
  function handleMethodSelect(m) {
    setMethod(m);
    if (m.id === "crypto") setCryptoOption(CRYPTO_OPTIONS[0]);
    setStep(MODAL_STEP.DETAILS);
  }

  /* ── paid submit ── */
  async function handleSubmit() {
    if (!txRef.trim()) {
      showToast("Please enter your transaction reference", "error");
      return;
    }
    if (!user?.id) {
      showToast("You must be signed in", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (!isFallback(selectedTicket?.id)) {
        /* real ticket type */
        const { error } = await supabase
          .from("event_ticket_purchases")
          .insert({
            event_id: event.id,
            ticket_type_id: selectedTicket.id,
            user_id: user.id,
            order_id: orderId,
            quantity: qty,
            unit_price: Number(selectedTicket.price),
            total_amount: parseFloat(totalStr),
            payment_method: method?.id,
            payment_reference: txRef.trim(),
            proof_url: proofUrl.trim() || null,
            note: note.trim() || null,
            status: "pending",
          });
        if (error) throw error;
      } else {
        /* fallback → subscription_requests table */
        const { error } = await supabase
          .from("subscription_requests")
          .insert({
            user_id: user.id,
            order_id: orderId,
            plan_id: event.id,
            plan_name: `${event.title} — ${selectedTicket.name} × ${qty}`,
            billing_cycle: "one_time",
            price_usd: Number(selectedTicket.price),
            total_usd: parseFloat(totalStr),
            method: method?.id,
            crypto_option: cryptoOption?.id ?? null,
            tx_reference: txRef.trim(),
            proof_url: proofUrl.trim() || null,
            note: note.trim() || null,
            status: "pending",
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      setStep(MODAL_STEP.DONE);
    } catch (err) {
      showToast(err.message || "Submission failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── back logic ── */
  function handleBack() {
    if (step === MODAL_STEP.METHOD) setStep(MODAL_STEP.SELECT);
    else if (step === MODAL_STEP.DETAILS) setStep(MODAL_STEP.METHOD);
    else if (step === MODAL_STEP.CONFIRM) setStep(MODAL_STEP.DETAILS);
    else onClose();
  }

  /* ── header title ── */
  const headerTitle = {
    [MODAL_STEP.SELECT]: isFree ? "RSVP" : "Get Tickets",
    [MODAL_STEP.METHOD]: "Payment Method",
    [MODAL_STEP.DETAILS]: "Payment Details",
    [MODAL_STEP.CONFIRM]: "Confirm Payment",
    [MODAL_STEP.DONE]: isFree ? "You're going! 🎉" : "Payment Submitted! 🎉",
  }[step];

  const showBack =
    step !== MODAL_STEP.SELECT && step !== MODAL_STEP.DONE;

  /* ── render ── */
  return (
    <>
      <Toast toast={toast} />
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        <div
          className="relative w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl"
          style={{ maxHeight: "92vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-[2rem] sm:rounded-t-[2rem]">
            {showBack && (
              <button
                onClick={handleBack}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all shrink-0"
                aria-label="Back"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold text-gray-900">
                {headerTitle}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {event.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* ══════════════════════════════════
              SELECT STEP
          ══════════════════════════════════ */}
          {step === MODAL_STEP.SELECT && (
            <div className="px-6 py-5 space-y-5">
              {soldOut && !loadingTypes && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
                  <p className="text-base font-bold text-red-700">Sold Out</p>
                  <p className="text-xs text-red-500 mt-1">
                    No spots remaining for this event.
                  </p>
                </div>
              )}

              {/* Ticket type selector */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Ticket Type
                </p>
                {loadingTypes ? (
                  <TicketSkeleton />
                ) : (
                  ticketTypes.map((tt) => {
                    const ttSpotsLeft =
                      tt.capacity != null
                        ? Math.max(
                            0,
                            Number(tt.capacity) - Number(tt.sold_count || 0)
                          )
                        : null;
                    const ttSoldOut =
                      tt.capacity != null && ttSpotsLeft === 0;
                    const isSelected = selectedTypeId === tt.id;

                    return (
                      <button
                        key={tt.id}
                        onClick={() => {
                          if (!ttSoldOut) {
                            setSelectedTypeId(tt.id);
                            setQty(1);
                          }
                        }}
                        disabled={ttSoldOut}
                        className={`w-full flex items-start justify-between rounded-2xl border-2 px-4 py-3.5 transition-all duration-150 text-left ${
                          isSelected
                            ? "border-violet-600 bg-violet-50"
                            : ttSoldOut
                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                            : "border-gray-100 bg-white hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-violet-600 bg-violet-600"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900">
                              {tt.name}
                              {ttSoldOut && (
                                <span className="ml-2 text-[10px] font-bold text-red-500 uppercase">
                                  Sold out
                                </span>
                              )}
                            </p>
                            {tt.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">
                                {tt.description}
                              </p>
                            )}
                            {ttSpotsLeft != null && !ttSoldOut && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {ttSpotsLeft} spot
                                {ttSpotsLeft !== 1 ? "s" : ""} left
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-sm text-violet-700 shrink-0 ml-3 mt-0.5">
                          {Number(tt.price) === 0
                            ? "Free"
                            : priceFmtExact.format(Number(tt.price))}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Quantity — paid only */}
              {!loadingTypes && !isFree && !soldOut && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    Quantity
                  </p>
                  <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      className="h-10 w-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-700 disabled:opacity-30 hover:bg-gray-50 active:scale-90 transition-all"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="text-lg font-extrabold text-gray-900 w-12 text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      disabled={qty >= maxQty}
                      className="h-10 w-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-700 disabled:opacity-30 hover:bg-gray-50 active:scale-90 transition-all"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {spotsLeft < 999 && (
                    <p className="text-xs text-gray-400 text-center">
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining
                    </p>
                  )}
                </div>
              )}

              {/* Order summary — paid only */}
              {!loadingTypes && !isFree && !soldOut && (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Order Summary
                  </p>
                  <Row
                    label={`${qty} × ${selectedTicket?.name}`}
                    value={priceFmtExact.format(subtotal)}
                  />
                  <Row
                    label="Service fee (5%)"
                    value={priceFmtExact.format(fees)}
                  />
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-violet-700 text-base">
                      {priceFmtExact.format(total)}
                    </span>
                  </div>
                </div>
              )}

              {/* CTA */}
              {!loadingTypes && !soldOut && (
                <button
                  onClick={() =>
                    isFree ? handleFreeRSVP() : setStep(MODAL_STEP.METHOD)
                  }
                  disabled={submitting || !selectedTicket}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-extrabold text-base shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-violet-400 active:scale-95 transition-all duration-150 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <SpinnerIcon className="h-5 w-5 animate-spin" />
                      Reserving…
                    </>
                  ) : isFree ? (
                    "Reserve My Spot — Free"
                  ) : (
                    `Continue · ${priceFmtExact.format(total)}`
                  )}
                </button>
              )}
            </div>
          )}

          {/* ══════════════════════════════════
              METHOD STEP
          ══════════════════════════════════ */}
          {step === MODAL_STEP.METHOD && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">
                Select payment method
              </p>

              {/* Order summary chip */}
              <div className="rounded-2xl bg-violet-50 border border-violet-100 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {qty} × {selectedTicket?.name}
                </span>
                <span className="font-extrabold text-violet-700">
                  {priceFmtExact.format(total)}
                </span>
              </div>

              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleMethodSelect(m)}
                  className="w-full flex items-center gap-4 rounded-3xl border-2 border-gray-200 bg-white p-5 text-left hover:shadow-lg hover:border-gray-300 active:scale-[0.99] transition-all duration-200"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.bg}`}
                  >
                    <MethodIcon
                      iconId={m.iconId}
                      className={`h-6 w-6 ${m.color}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.sublabel}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300 shrink-0" />
                </button>
              ))}

              <div className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <ShieldIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    Admin-verified payments
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                    Our team reviews every payment manually and confirms your
                    ticket within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
              DETAILS STEP
          ══════════════════════════════════ */}
          {step === MODAL_STEP.DETAILS && method && (
            <div className="px-6 py-5 space-y-4">
              {/* Method chip */}
              <div
                className={`flex items-center gap-4 rounded-3xl border-2 ${method.border} ${method.bg} p-5`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <MethodIcon
                    iconId={method.iconId}
                    className={`h-6 w-6 ${method.color}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-gray-900">{method.label}</p>
                  <p className="text-xs text-gray-500">{method.sublabel}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-extrabold text-gray-900">
                    {priceFmtExact.format(total)}
                  </p>
                </div>
              </div>

              {/* CRYPTO */}
              {method.id === "crypto" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {CRYPTO_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setCryptoOption(opt)}
                        className={[
                          "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all",
                          cryptoOption?.id === opt.id
                            ? `${opt.border} ring-2 ${opt.ring} bg-white shadow-md`
                            : "border-gray-200 bg-white hover:border-gray-300",
                        ].join(" ")}
                      >
                        <div
                          className={`h-10 w-10 rounded-full ${opt.bg} flex items-center justify-center`}
                        >
                          <CryptoOptionIcon
                            iconId={opt.iconId}
                            className={`h-5 w-5 ${opt.color}`}
                          />
                        </div>
                        <p className="font-extrabold text-sm text-gray-900">
                          {opt.symbol}
                        </p>
                        <p className="text-[11px] text-gray-400 text-center leading-tight">
                          {opt.network}
                        </p>
                      </button>
                    ))}
                  </div>

                  {cryptoOption && (
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-gray-200 bg-white p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-gray-900 text-sm">
                            Send {cryptoOption.symbol}
                          </p>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cryptoOption.bg} ${cryptoOption.color}`}
                          >
                            {cryptoOption.network}
                          </span>
                        </div>
                        {/* QR placeholder */}
                        <div className="flex justify-center">
                          <div className="h-40 w-40 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 gap-2">
                            <QrIcon className="h-10 w-10 text-gray-300" />
                            <p className="text-[10px] text-gray-400 font-semibold">
                              QR Code
                            </p>
                          </div>
                        </div>
                        {/* Address */}
                        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            {cryptoOption.symbol} Address
                          </p>
                          <p className="font-mono text-xs text-gray-800 break-all leading-relaxed">
                            {cryptoOption.address}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                cryptoOption.address,
                                `${cryptoOption.symbol} address`
                              )
                            }
                            className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 ${cryptoOption.bg} ${cryptoOption.color} border ${cryptoOption.border}`}
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                            Copy Address
                          </button>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
                          <ClockIcon className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-xs text-amber-700 font-medium">
                            {cryptoOption.confirmations}
                          </p>
                        </div>
                      </div>
                      <ImportantBox
                        orderId={orderId}
                        total={totalStr}
                        currency={cryptoOption.symbol}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* NON-CRYPTO */}
              {method.id !== "crypto" && (
                <div className="space-y-4">
                  {/* How to pay */}
                  <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-3 border-b border-gray-50 flex items-center gap-2">
                      <InfoIcon className="h-4 w-4 text-violet-500 shrink-0" />
                      <p className="text-sm font-bold text-gray-900">
                        How to pay
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      {method.instructions?.map((line, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${method.bg} ${method.color}`}
                          >
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {line}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment fields */}
                  <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                      <p className="text-sm font-bold text-gray-900">
                        Payment details
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      {method.fields?.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-2xl bg-gray-50 border border-gray-100 p-4"
                        >
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                            {field.label}
                          </p>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-gray-900 break-all">
                              {field.value}
                            </p>
                            {field.copyable && (
                              <button
                                onClick={() =>
                                  copyToClipboard(field.value, field.label)
                                }
                                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                              >
                                <CopyIcon className="h-3 w-3" />
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ImportantBox
                    orderId={orderId}
                    total={totalStr}
                    currency="USD"
                  />
                </div>
              )}

              <button
                onClick={() => setStep(MODAL_STEP.CONFIRM)}
                className={`w-full rounded-2xl py-4 text-base font-extrabold text-white shadow-lg active:scale-[0.98] transition-all ${method.accentBtn}`}
              >
                I've Paid — Submit Proof
              </button>
            </div>
          )}

          {/* ══════════════════════════════════
              CONFIRM STEP
          ══════════════════════════════════ */}
          {step === MODAL_STEP.CONFIRM && method && (
            <div className="px-6 py-5 space-y-4">
              {/* Recap chip */}
              <div
                className={`rounded-3xl border-2 ${method.border} ${method.bg} p-5`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <MethodIcon
                      iconId={method.iconId}
                      className={`h-5 w-5 ${method.color}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-gray-900">
                      {method.label}
                    </p>
                    {cryptoOption && (
                      <p className="text-xs text-gray-500">
                        {cryptoOption.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Total sent</p>
                    <p className="font-extrabold text-gray-900">${totalStr}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/70 border border-white px-4 py-2.5">
                  <p className="text-xs text-gray-500 font-medium">Order ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs font-bold text-gray-900">
                      {orderId}
                    </p>
                    <button
                      onClick={() => copyToClipboard(orderId, "Order ID")}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                  <p className="text-sm font-bold text-gray-900">
                    Payment confirmation
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Our team will verify and confirm your ticket within 24
                    hours.
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  {/* TX ref */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      Transaction / Reference ID
                      <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <HashIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={txRef}
                        onChange={(e) => setTxRef(e.target.value)}
                        placeholder={
                          method.id === "crypto"
                            ? "BTC / USDT transaction hash"
                            : method.id === "momo"
                            ? "MoMo reference number"
                            : method.id === "western_union"
                            ? "MTCN number"
                            : "Bank transfer reference"
                        }
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 pl-1">
                      Copy this exactly from your receipt or transaction
                      history.
                    </p>
                  </div>

                  {/* Proof URL */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      Receipt / Screenshot URL
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        (optional)
                      </span>
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="url"
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                        placeholder="https://imgur.com/your-screenshot"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      Additional Note
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Any extra info that helps our team verify faster..."
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !txRef.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-extrabold text-white shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-fuchsia-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <SpinnerIcon className="h-5 w-5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    Submit for Verification
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-gray-400 leading-relaxed px-4">
                Once submitted, our team verifies your payment and confirms
                your ticket within 24 hours.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════
              DONE STEP
          ══════════════════════════════════ */}
          {step === MODAL_STEP.DONE && (
            <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
              {/* Success ring */}
              <div className="relative flex items-center justify-center">
                <div className="absolute h-28 w-28 rounded-full bg-green-100 animate-ping opacity-30" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-xl shadow-green-200">
                  <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {isFree ? "RSVP Confirmed!" : "Payment Submitted!"}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  {isFree
                    ? "Your spot has been reserved. We'll send a reminder before the event."
                    : `Our team will verify your ${method?.label} payment and confirm your ticket within 24 hours.`}
                </p>
              </div>

              {/* Summary */}
              <div className="w-full bg-violet-50 rounded-2xl p-4 text-left space-y-2">
                <Row label="Event" value={event.title} truncate />
                <Row
                  label="Date"
                  value={formatDateTime(event.starts_at).date}
                />
                <Row
                  label="Ticket"
                  value={
                    isFree
                      ? selectedTicket?.name || "Free Admission"
                      : `${qty} × ${selectedTicket?.name}`
                  }
                />
                {!isFree && (
                  <>
                    <Row label="Order ID" value={orderId} />
                    <Row label="Method" value={method?.label} />
                    <div className="flex justify-between text-sm border-t border-violet-100 pt-2">
                      <span className="font-bold text-gray-900">
                        Total Paid
                      </span>
                      <span className="font-bold text-violet-700">
                        ${totalStr}
                      </span>
                    </div>
                    <Row
                      label="Status"
                      value="Pending verification"
                      highlight
                    />
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-extrabold text-base shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-violet-400 active:scale-95 transition-all duration-150"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function EventDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();

  const [event, setEvent] = useState(() =>
    normaliseEvent(state?.event ?? null)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showTickets, setShowTickets] = useState(false);

  /* ── FETCH ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/events/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `Server error ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        const raw = data?.item ?? data?.event ?? data;
        setEvent(normaliseEvent(raw));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not load this event.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, retryKey]);

  /* ── DERIVED ── */
  const dt = useMemo(
    () => formatDateTime(event?.starts_at),
    [event?.starts_at]
  );

  const capacityPct = useMemo(() => {
    if (!event?.capacity || !event?.attendees_count) return 0;
    return Math.min(
      100,
      Math.round((event.attendees_count / event.capacity) * 100)
    );
  }, [event?.capacity, event?.attendees_count]);

  const hasMap = useMemo(
    () => !!(event && isValidCoord(event.lat, event.lng)),
    [event]
  );

  const mapsUrl = useMemo(() => {
    if (!hasMap || !event) return "#";
    return `https://maps.google.com/?q=${event.lat},${event.lng}`;
  }, [hasMap, event]);

  const handleShare = useCallback(() => shareEvent(event), [event]);

  const handleRetry = useCallback(() => {
    setEvent(null);
    setRetryKey((k) => k + 1);
  }, []);

  const handleOpenTickets = useCallback(() => setShowTickets(true), []);
  const handleCloseTickets = useCallback(() => setShowTickets(false), []);

  /* ── GUARDS ── */
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

  /* ── RENDER ── */
  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-36 antialiased">
        {/* Floating Nav */}
        <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between p-4 pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="pointer-events-auto h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-lg border border-white/60 shadow-lg flex items-center justify-center hover:bg-white active:scale-90 transition-all duration-150"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-900" />
          </button>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setIsSaved((s) => !s)}
              aria-label={isSaved ? "Unsave event" : "Save event"}
              className={`h-11 w-11 rounded-2xl border shadow-lg flex items-center justify-center transition-all duration-200 ${
                isSaved
                  ? "bg-violet-600 border-violet-600 text-white scale-105"
                  : "bg-white/90 backdrop-blur-lg border-white/60 text-gray-700 hover:bg-white"
              }`}
            >
              <BookmarkIcon className="h-5 w-5" filled={isSaved} />
            </button>
            <button
              onClick={handleShare}
              aria-label="Share event"
              className="h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-lg border border-white/60 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-90 transition-all duration-150"
            >
              <ShareIcon className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* Hero */}
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
            <div className="h-full w-full bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 flex items-end pb-16 pl-6">
              <span className="text-8xl opacity-40">🎪</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/10 to-transparent" />
          <div className="absolute left-5 bottom-20">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/90 backdrop-blur-sm border border-white/20 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-violet-900/30">
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
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    dt.relative === "Today" || dt.relative === "Tomorrow"
                      ? "bg-green-50 text-green-700"
                      : dt.relative === "Past event"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-violet-50 text-violet-700"
                  }`}
                >
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
                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Organiser card */}
          <div className="flex items-center justify-between gap-4 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={event.host.avatar || avatarFallback(event.host.name)}
                  onError={(e) => {
                    e.currentTarget.src = avatarFallback(event.host.name);
                  }}
                  alt={event.host.name}
                  className="h-12 w-12 rounded-2xl object-cover border-2 border-violet-100"
                />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                  <CheckIcon className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Organiser
                </p>
                <p className="font-bold text-gray-900 truncate">
                  {event.host.name}
                </p>
                {event.host.bio && (
                  <p className="text-xs text-gray-500 truncate">
                    {event.host.bio}
                  </p>
                )}
              </div>
            </div>
            <button className="shrink-0 rounded-2xl bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 active:scale-95 transition-all duration-150">
              Contact
            </button>
          </div>

          {/* Date + Capacity grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard
              label="Date & Time"
              icon={<CalendarIcon className="h-4 w-4 text-violet-600" />}
            >
              <p className="text-sm font-bold text-gray-900 leading-snug">
                {dt.date}
              </p>
              {dt.time && (
                <p className="mt-1 text-xs font-medium text-gray-500">
                  {dt.time}
                </p>
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
                        capacityPct >= 90
                          ? "bg-red-500"
                          : capacityPct >= 70
                          ? "bg-amber-500"
                          : "bg-violet-600"
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
                  className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline"
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
              <div className="rounded-3xl bg-gray-100 border border-dashed border-gray-200 h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
                <MapPinIcon className="h-8 w-8 opacity-40" />
                <span className="text-sm">Location details TBA</span>
              </div>
            )}
          </div>

          {/* Stale-data warning */}
          {error && event && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <WarningIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Showing cached data
                </p>
                <p className="text-xs text-amber-600 mt-0.5">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="shrink-0 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </main>

        {/* Bottom CTA */}
        <footer className="fixed bottom-0 inset-x-0 z-50">
          <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-xl border-t border-gray-200/60" />
          <div className="relative px-5 pt-3 pb-8 max-w-lg mx-auto">
            <div className="flex items-center gap-4 bg-gray-900 rounded-3xl p-3 shadow-2xl shadow-gray-900/30">
              <div className="flex-1 pl-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {event.price === 0 ? "Admission" : "Starting from"}
                </p>
                <p className="text-2xl font-extrabold text-white mt-0.5">
                  {event.price === 0 ? "Free" : priceFmt.format(event.price)}
                </p>
              </div>
              <button
                onClick={handleOpenTickets}
                className="flex-shrink-0 h-14 px-8 rounded-2xl font-extrabold text-base bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-600/40 hover:from-violet-500 hover:to-violet-400 active:scale-95 transition-all duration-150"
              >
                {event.price === 0 ? "RSVP Free" : "Get Tickets"}
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Tickets Modal */}
      {showTickets && (
        <GetTicketsModal event={event} onClose={handleCloseTickets} />
      )}
    </>
  );
}

/* ================================================================
   ICONS — all inline SVG, zero external icon lib imports
   ================================================================ */
function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function TicketIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 010-6h20a3 3 0 010 6" />
      <path d="M2 15a3 3 0 000 6h20a3 3 0 000-6" />
      <line x1="2" y1="9" x2="2" y2="15" />
      <line x1="22" y1="9" x2="22" y2="15" />
    </svg>
  );
}
function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="8" strokeWidth={2.5} strokeLinecap="round" />
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
function CheckCircleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function AlertIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function XIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function MinusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function ShieldIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function CopyIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function QrIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h.01M14 17h3M17 14v3M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01" />
    </svg>
  );
}
function ClockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
function HashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}
function LinkIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
function PhoneIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
function BankIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-7 9 7" />
      <path d="M3 10v10h18V10" />
      <path d="M9 10v10M15 10v10" />
      <path d="M3 20h18" />
    </svg>
  );
}
function CryptoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9h4a1.5 1.5 0 010 3h-4m0 0h4.5a1.5 1.5 0 010 3H9.5m0-6V7m0 8v2m3-10v-1m0 11v-1" />
    </svg>
  );
}
function BitcoinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8h5a2 2 0 010 4H9V8zm0 4h5.5a2 2 0 010 4H9v-4z" />
      <path d="M11 6v2M13 6v2M11 16v2M13 16v2" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
function TetherIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 9h10M12 9v6M9 15a6 6 0 006 0" />
    </svg>
  );
}
function WesternUnionIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l5 10 4-7 4 7 5-10" />
    </svg>
  );
}