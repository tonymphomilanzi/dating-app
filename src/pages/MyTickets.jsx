// src/pages/MyTickets.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function MyTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming"); // upcoming | past | pending

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadTickets();
  }, [user?.id]);

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      // Get all ticket purchases for this user
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("event_ticket_purchases")
        .select(
          `
          *,
          event:event_id ( id, title, starts_at, city, cover_url, category ),
          ticket_type:ticket_type_id ( id, name, description, price )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (purchasesError) throw purchasesError;

      setPurchases(purchasesData || []);

      // Get individual tickets if they exist
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("event_tickets")
        .select(
          `
          *,
          event:event_id ( id, title, starts_at ),
          ticket_type:ticket_type_id ( name )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);
    } catch (err) {
      console.error("Error loading tickets:", err);
      setError(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-6xl">🎫</div>
        <h1 className="text-2xl font-bold text-gray-900">Sign in to view tickets</h1>
        <button
          onClick={() => navigate("/login")}
          className="mt-4 rounded-full bg-violet-600 px-8 py-3 text-sm font-bold text-white hover:bg-violet-700 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  const now = new Date();
  const upcomingPurchases = purchases.filter(
    (p) =>
      p.status === "confirmed" &&
      new Date(p.event?.starts_at) > now
  );
  const pastPurchases = purchases.filter(
    (p) =>
      p.status === "confirmed" &&
      new Date(p.event?.starts_at) <= now
  );
  const pendingPurchases = purchases.filter((p) => p.status === "pending");

  let displayedPurchases = [];
  if (activeTab === "upcoming") displayedPurchases = upcomingPurchases;
  else if (activeTab === "past") displayedPurchases = pastPurchases;
  else displayedPurchases = pendingPurchases;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-violet-600 animate-spin" />
          <p className="text-sm">Loading your tickets…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-extrabold text-gray-900">My Tickets</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: "upcoming", label: "Upcoming", count: upcomingPurchases.length },
              { id: "pending", label: "Pending", count: pendingPurchases.length },
              { id: "past", label: "Past", count: pastPurchases.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold bg-white/30">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-5 py-6">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {displayedPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="text-6xl opacity-40">🎫</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {activeTab === "pending"
                  ? "No pending purchases"
                  : activeTab === "upcoming"
                  ? "No upcoming events"
                  : "No past events"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === "pending"
                  ? "Your payment confirmations will appear here"
                  : "Explore events and get tickets"}
              </p>
            </div>
            {activeTab !== "pending" && (
              <button
                onClick={() => navigate("/events")}
                className="mt-4 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition-colors"
              >
                Browse Events
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPurchases.map((purchase) => (
              <PurchaseCard
                key={purchase.id}
                purchase={purchase}
                onViewDetails={() =>
                  navigate(`/ticket-detail/${purchase.id}`)
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ================================================================
   PURCHASE CARD
   ================================================================ */
function PurchaseCard({ purchase, onViewDetails }) {
  const eventDate = new Date(purchase.event?.starts_at);
  const isUpcoming = eventDate > new Date();
  const statusConfig = {
    pending: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      badge: "bg-amber-100 text-amber-700",
      label: "⏳ Awaiting Verification",
    },
    confirmed: {
      bg: isUpcoming ? "bg-green-50" : "bg-gray-50",
      border: isUpcoming ? "border-green-100" : "border-gray-100",
      badge: isUpcoming ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700",
      label: isUpcoming ? "✓ Confirmed" : "✓ Attended",
    },
    cancelled: {
      bg: "bg-red-50",
      border: "border-red-100",
      badge: "bg-red-100 text-red-700",
      label: "✕ Cancelled",
    },
  };

  const cfg = statusConfig[purchase.status] || statusConfig.pending;

  return (
    <button
      onClick={onViewDetails}
      className={`w-full overflow-hidden rounded-3xl border ${cfg.border} ${cfg.bg} shadow-sm transition-all hover:shadow-md active:scale-[0.98]`}
    >
      <div className="flex gap-4 p-4">
        {/* Event Image */}
        {purchase.event?.cover_url && (
          <div className="relative h-20 w-20 shrink-0 rounded-2xl overflow-hidden bg-gray-200">
            <img
              src={purchase.event.cover_url}
              alt={purchase.event.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate">
              {purchase.event?.title}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.badge} whitespace-nowrap`}
            >
              {cfg.label}
            </span>
          </div>

          <div className="text-xs text-gray-500 space-y-0.5">
            <p>
              📅{" "}
              {eventDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
            {purchase.event?.city && (
              <p>📍 {purchase.event.city}</p>
            )}
            <p>
              🎫 {purchase.quantity} ×{" "}
              {purchase.ticket_type?.name || "Ticket"}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-current border-opacity-10 px-4 py-3 flex items-center justify-between bg-white/40">
        <span className="text-xs font-mono text-gray-500">
          {purchase.order_id}
        </span>
        <span className="text-sm font-bold text-gray-900">
          ${purchase.total_amount?.toFixed(2) || "0.00"}
        </span>
      </div>
    </button>
  );
}

/* ================================================================
   TICKET DETAIL PAGE
   ================================================================ */
function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("event_ticket_purchases")
          .select(
            `
            *,
            event:event_id ( id, title, starts_at, address, city, cover_url ),
            ticket_type:ticket_type_id ( name, description )
          `
          )
          .eq("id", ticketId)
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setPurchase(data);
      } catch (err) {
        console.error("Error loading ticket:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, ticketId]);

  if (loading) return <DetailSkeleton />;
  if (!purchase) return <ErrorState onBack={() => navigate(-1)} />;

  const eventDate = new Date(purchase.event?.starts_at);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center gap-3 px-5 py-4 max-w-lg mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold text-gray-900">Ticket Details</h1>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* Event Image */}
        {purchase.event?.cover_url && (
          <div className="relative h-48 w-full rounded-3xl overflow-hidden bg-gray-200 shadow-lg">
            <img
              src={purchase.event.cover_url}
              alt={purchase.event.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Event Info */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            {purchase.event?.title}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <CalendarIcon className="h-4 w-4 text-violet-600 shrink-0" />
              {eventDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            {purchase.event?.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPinIcon className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  {purchase.event.address}
                  {purchase.event.city && `, ${purchase.event.city}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ticket Info */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
            Your Ticket
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ticket Type</span>
              <span className="font-bold text-gray-900">
                {purchase.ticket_type?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Quantity</span>
              <span className="font-bold text-gray-900">{purchase.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Price per ticket</span>
              <span className="font-bold text-gray-900">
                ${purchase.unit_price?.toFixed(2)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Total Paid
              </span>
              <span className="text-lg font-extrabold text-violet-600">
                ${purchase.total_amount?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order ID</span>
            <span className="font-mono font-bold text-gray-900">
              {purchase.order_id}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <span
              className={`font-bold ${
                purchase.status === "confirmed"
                  ? "text-green-700"
                  : purchase.status === "pending"
                  ? "text-amber-700"
                  : "text-gray-700"
              }`}
            >
              {purchase.status.charAt(0).toUpperCase() +
                purchase.status.slice(1)}
            </span>
          </div>
          {purchase.payment_method && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment Method</span>
              <span className="font-bold text-gray-900 capitalize">
                {purchase.payment_method}
              </span>
            </div>
          )}
        </div>

        {purchase.status === "pending" && (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-sm font-semibold text-amber-800">
              ⏳ Awaiting Verification
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Our team is reviewing your payment. You'll receive an email once confirmed.
            </p>
          </div>
        )}

        {purchase.status === "confirmed" && (
          <button className="w-full rounded-2xl bg-violet-600 text-white font-bold py-3 hover:bg-violet-700 transition-colors">
            Add to Apple Wallet
          </button>
        )}
      </main>
    </div>
  );
}

/* ================================================================
   ICONS (reuse from EventDetail.jsx)
   ================================================================ */
function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function CalendarIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function CheckIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="px-5 space-y-4 pt-6 max-w-lg mx-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onBack }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="text-6xl">⚠️</div>
      <h2 className="text-xl font-bold text-gray-900">Ticket not found</h2>
      <button
        onClick={onBack}
        className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
      >
        Go Back
      </button>
    </div>
  );
}