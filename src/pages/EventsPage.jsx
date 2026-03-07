import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const categories = ["All", "Concert", "Exhibition", "Art", "Sport", "Tech"];

const popular = [
  {
    id: "p1",
    title: "Celebration Concert",
    dateLabel: "31 July",
    category: "Concert",
    place: "245 Oceanview Blvd, Miami",
    price: 400,
    img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
    attendees: [
      "https://i.pravatar.cc/80?img=1",
      "https://i.pravatar.cc/80?img=2",
      "https://i.pravatar.cc/80?img=3",
      "https://i.pravatar.cc/80?img=4",
    ],
    short: "A night of lights, music, and energy.",
    dateISO: "2026-07-31T20:00:00Z",
  },
  {
    id: "p2",
    title: "Urban Crowd",
    dateLabel: "05 Aug",
    category: "Art",
    place: "Urban Croud, LA",
    price: 450,
    img: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1600&auto=format&fit=crop",
    attendees: [
      "https://i.pravatar.cc/80?img=5",
      "https://i.pravatar.cc/80?img=6",
      "https://i.pravatar.cc/80?img=7",
    ],
    short: "Immersive art and live visuals.",
    dateISO: "2026-08-05T19:00:00Z",
  },
  {
    id: "p3",
    title: "Photo Exhibition",
    dateLabel: "12 Sep",
    category: "Exhibition",
    place: "Art Hall, NYC",
    price: 250,
    img: "https://images.unsplash.com/photo-1493612276216-ee3925520721?q=80&w=1600&auto=format&fit=crop",
    attendees: [
      "https://i.pravatar.cc/80?img=8",
      "https://i.pravatar.cc/80?img=9",
    ],
    short: "Curated shots from global artists.",
    dateISO: "2026-09-12T18:30:00Z",
  },
];

const upcoming = [
  {
    id: "u1",
    day: "05",
    month: "Aug",
    title: "SpaceX Launch",
    place: "Cape Canaveral, FL",
    price: 250,
    img: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop",
    dateISO: "2026-08-05T14:00:00Z",
  },
  {
    id: "u2",
    day: "14",
    month: "Aug",
    title: "Indie Live Night",
    place: "LA Live, Los Angeles",
    price: 120,
    img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1200&auto=format&fit=crop",
    dateISO: "2026-08-14T21:00:00Z",
  },
];

export default function EventsExplore() {
  const [tab, setTab] = useState("All");
  const nav = useNavigate();

  const filtered = useMemo(
    () => (tab === "All" ? popular : popular.filter((e) => e.category === tab)),
    [tab]
  );

  const openDetail = (event) => {
    nav(`/events/${event.id}`, { state: { event } });
  };

  return (
    <div className="min-h-dvh bg-white text-gray-900 pb-6">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Search only (no avatar) */}
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <i className="lni lni-search-alt text-gray-400" />
          <input
            placeholder="Search for event"
            className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-700 hover:bg-gray-100">
            <i className="lni lni-sliders" />
          </button>
        </div>

        {/* Popular Events */}
        <HeaderRow title="Popular Events" />
        {/* Chips */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={[
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors border",
                tab === c
                  ? "bg-violet-600 text-white border-violet-600 shadow"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-violet-50"
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Horizontal popular cards */}
        <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => openDetail(e)}
              className="w-[265px] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-card hover:shadow-md"
            >
              <div className="relative h-40">
                <img
                  src={e.img}
                  alt={e.title}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {/* Date pill */}
                <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
                  {e.dateLabel}
                </div>
                {/* Bookmark */}
                <div className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/10">
                  <i className="lni lni-bookmark" />
                </div>
              </div>

              <div className="p-3">
                <div className="text-sm font-semibold">{e.title}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <i className="lni lni-map-marker text-violet-600" />
                  {e.place}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {/* Avatars */}
                  <div className="flex -space-x-2">
                    {e.attendees.slice(0, 4).map((a, idx) => (
                      <img
                        key={a + idx}
                        src={a}
                        className="h-7 w-7 rounded-full ring-2 ring-white"
                        alt=""
                        draggable={false}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-semibold text-violet-700">
                    ${e.price}
                    <span className="text-[11px] text-gray-500">/Person</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Upcoming */}
        <HeaderRow title="Upcoming events" />

        <div className="mt-3 space-y-3">
          {upcoming.map((e) => (
            <button
              key={e.id}
              onClick={() => openDetail({
                id: e.id,
                title: e.title,
                place: e.place,
                price: e.price,
                img: e.img,
                dateLabel: `${e.day} ${e.month}`,
                dateISO: e.dateISO,
                category: "General",
                attendees: [],
                short: "",
              })}
              className="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-card hover:shadow-md"
            >
              {/* Date stub */}
              <div className="grid w-14 place-items-center rounded-xl border border-gray-200 bg-white">
                <div className="text-center leading-tight">
                  <div className="text-lg font-bold text-violet-700">{e.day}</div>
                  <div className="text-[11px] text-gray-500">{e.month}</div>
                </div>
              </div>

              {/* Card */}
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="h-16 w-24 overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={e.img}
                    alt={e.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{e.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <i className="lni lni-map-marker text-violet-600" />
                    {e.place}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-violet-700">
                    ${e.price}
                    <span className="text-[11px] text-gray-500">/Person</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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