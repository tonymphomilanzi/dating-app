import React, { useMemo, useState } from "react";

const categories = ["All", "Concert", "Exhibition", "Art", "Sport", "Tech"];

const popular = [
  {
    id: "p1",
    title: "Celebration Concert",
    dateLabel: "31 July",
    category: "Concert",
    place: "245 Downtown, Miami",
    price: 400,
    img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
    attendees: [
      "https://i.pravatar.cc/80?img=1",
      "https://i.pravatar.cc/80?img=2",
      "https://i.pravatar.cc/80?img=3",
      "https://i.pravatar.cc/80?img=4",
    ],
  },
  {
    id: "p2",
    title: "Urban Crowd",
    dateLabel: "05 Aug",
    category: "Art",
    place: "Urban Croud",
    price: 450,
    img: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1600&auto=format&fit=crop",
    attendees: [
      "https://i.pravatar.cc/80?img=5",
      "https://i.pravatar.cc/80?img=6",
      "https://i.pravatar.cc/80?img=7",
    ],
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
  },
  {
    id: "u2",
    day: "14",
    month: "Aug",
    title: "Indie Live Night",
    place: "LA Live, Los Angeles",
    price: 120,
    img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "u3",
    day: "21",
    month: "Sep",
    title: "Art & Wine Evening",
    place: "Downtown Gallery, SF",
    price: 95,
    img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop",
  },
];

export default function EventsExplore() {
  const [tab, setTab] = useState("All");
  const filtered = useMemo(
    () => (tab === "All" ? popular : popular.filter((e) => e.category === tab)),
    [tab]
  );

  return (
    <div className="min-h-dvh bg-[#0B1220] text-white pb-6">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img
            src="https://i.pravatar.cc/100?img=13"
            alt="Me"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-[#101828]"
          />
          <div className="leading-tight">
            <div className="text-sm text-gray-300">Welcome back</div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <i className="lni lni-map-marker text-blue-400/80" />
              San Diego, CA
            </div>
          </div>
          <button className="ml-auto grid h-10 w-10 place-items-center rounded-xl bg-[#0F1A2C] text-gray-300 ring-1 ring-[#1E293B]">
            <i className="lni lni-user" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl bg-[#0F1A2C] px-4 py-3 ring-1 ring-[#1F2A44]">
            <i className="lni lni-search text-gray-400" />
            <input
              placeholder="Search for event"
              className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none"
            />
            <button className="grid h-8 w-8 place-items-center rounded-lg bg-[#0B1628] text-gray-300 ring-1 ring-[#1E293B]">
              <i className="lni lni-sliders" />
            </button>
          </div>
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
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors",
                tab === c
                  ? "bg-[#2563EB] text-white ring-[#2563EB]"
                  : "bg-[#0F1A2C] text-gray-300 ring-[#1F2A44] hover:bg-[#12213a]"
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Horizontal cards */}
        <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1">
          {filtered.map((e) => (
            <PopularCard key={e.id} event={e} />
          ))}
        </div>

        {/* Upcoming */}
        <HeaderRow title="Upcoming events" />

        <div className="mt-3 space-y-3">
          {upcoming.map((e) => (
            <UpcomingRow key={e.id} item={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderRow({ title }) {
  return (
    <div className="mt-6 flex items-center">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <button className="ml-auto text-sm font-medium text-blue-400 hover:text-blue-300">
        See All
      </button>
    </div>
  );
}

function PopularCard({ event }) {
  return (
    <div className="w-[265px] shrink-0 rounded-2xl bg-[#0F1A2C] ring-1 ring-[#1F2A44] shadow-[0_10px_25px_rgba(0,0,0,0.25)]">
      <div className="relative h-40 overflow-hidden rounded-2xl">
        <img
          src={event.img}
          alt={event.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {/* Date pill */}
        <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white ring-1 ring-white/10">
          {event.dateLabel}
        </div>
        {/* Bookmark */}
        <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/10">
          <i className="lni lni-bookmark" />
        </button>
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-white">{event.title}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <i className="lni lni-map-marker text-blue-400/80" />
          {event.place}
        </div>

        <div className="mt-3 flex items-center justify-between">
          {/* Avatars */}
          <div className="flex -space-x-2">
            {event.attendees.slice(0, 4).map((a, idx) => (
              <img
                key={a + idx}
                src={a}
                className="h-7 w-7 rounded-full ring-2 ring-[#0B1220]"
                alt=""
                draggable={false}
              />
            ))}
          </div>
          <div className="text-sm font-semibold text-blue-400">
            ${event.price}
            <span className="text-[11px] text-gray-400">/Person</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingRow({ item }) {
  return (
    <div className="flex items-stretch gap-3">
      {/* Date stub */}
      <div className="grid w-14 place-items-center rounded-xl bg-[#0F1A2C] ring-1 ring-[#1F2A44]">
        <div className="text-center leading-tight">
          <div className="text-lg font-bold text-blue-400">{item.day}</div>
          <div className="text-[11px] text-gray-400">{item.month}</div>
        </div>
      </div>

      {/* Card */}
      <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl bg-[#0F1A2C] p-3 ring-1 ring-[#1F2A44]">
        <div className="h-16 w-24 overflow-hidden rounded-lg">
          <img
            src={item.img}
            alt={item.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {item.title}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <i className="lni lni-map-marker text-blue-400/80" />
            {item.place}
          </div>
          <div className="mt-1 text-sm font-semibold text-blue-400">
            ${item.price}
            <span className="text-[11px] text-gray-400">/Person</span>
          </div>
        </div>
      </div>
    </div>
  );
}