import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function EventDetail({ fallbackEvent }) {
  const nav = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();

  // Prefer event passed via navigation state; else use fallback
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
      about:
        "Join us for an unforgettable night of sound and color. Doors open at 7PM. All ages welcome. Food trucks and merch available.",
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

        {/* Map placeholder or image */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
          <div className="aspect-[16/9] relative">
            <img
              src="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=1200&auto=format&fit=crop"
              alt="Map"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm text-gray-800 ring-1 ring-gray-200">
              Venue map
            </div>
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