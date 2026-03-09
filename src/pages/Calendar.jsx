// src/pages/Calendar.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { eventsService } from "../services/events.service.js";

/* ---------------- date helpers ---------------- */
const DAY_MS = 24 * 3600 * 1000;

function atMidnight(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}
function startOfMonth(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), 1);
  return atMidnight(t);
}
function endOfMonth(d) {
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  t.setHours(23, 59, 59, 999);
  return t;
}
function addMonths(d, n) {
  const t = new Date(d);
  t.setMonth(t.getMonth() + n);
  return t;
}
function addDays(d, n) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}
function startOfCalendarGrid(monthDate, weekStartsOn = 0) {
  // weekStartsOn: 0=Sun, 1=Mon
  const first = startOfMonth(monthDate);
  const day = first.getDay(); // 0..6
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(first, -diff);
}
function toYMD(d) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d) {
  return isSameDay(d, new Date());
}
function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function currency(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat([], { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

/* ---------------- calendar/color helpers ---------------- */
const catColor = (cat = "Other") => {
  const k = String(cat).toLowerCase();
  if (k.includes("music") || k.includes("concert")) return "bg-pink-500";
  if (k.includes("sport")) return "bg-emerald-500";
  if (k.includes("food") || k.includes("drink")) return "bg-orange-500";
  if (k.includes("tech")) return "bg-sky-500";
  if (k.includes("art")) return "bg-violet-500";
  if (k.includes("business")) return "bg-indigo-500";
  return "bg-gray-400";
};

/* ---------------- auth-safe fetch ---------------- */
async function listRangeWithAuth({ from, to, signal }) {
  // 1) If your service exposes .range({ from, to, signal })
  if (typeof eventsService?.range === "function") {
    try {
      return await eventsService.range({ from, to, signal });
    } catch (e) {
      const status = e?.status || e?.response?.status;
      if (status === 401) throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
      throw e;
    }
  }

  // 2) Else try .list and client-filter
  if (typeof eventsService?.list === "function") {
    try {
      const supportsSignal = eventsService.list.length > 0;
      const rows = supportsSignal ? await eventsService.list({ signal }) : await eventsService.list();
      const f = new Date(from);
      const t = new Date(to);
      return rows.filter((ev) => {
        const s = new Date(ev.starts_at || ev.dateISO);
        return s >= f && s <= t;
      });
    } catch (e) {
      const status = e?.status || e?.response?.status;
      if (status === 401) throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
      // fallthrough to fetch
    }
  }

  // 3) Fallback fetch with credentials + optional bearer
  const token = localStorage.getItem("access_token");
  const r = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    method: "GET",
    signal,
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
  const json = await r.json().catch(() => ({}));
  return json.items || json || [];
}

/* ---------------- ICS + Google helpers ---------------- */
function googleCalendarUrl({ title, startsAt, endsAt, location = "", details = "" }) {
  const fmt = (dt) => dt.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const s = new Date(startsAt);
  const e = new Date(endsAt || s.getTime() + 2 * 3600_000);
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Event",
    dates: `${fmt(s)}/${fmt(e)}`,
    location,
    details,
  }).toString();
  return `https://calendar.google.com/calendar/render?${qs}`;
}
function downloadICS({ title, startsAt, endsAt, location = "", details = "" }) {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@app`;
  const fmtICS = (d) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const s = fmtICS(startsAt);
  const e = fmtICS(endsAt || new Date(new Date(startsAt).getTime() + 2 * 3600_000));
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YourApp//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtICS(new Date())}`,
    `DTSTART:${s}`,
    `DTEND:${e}`,
    `SUMMARY:${(title || "Event").replace(/\n/g, " ")}`,
    `LOCATION:${(location || "").replace(/\n/g, " ")}`,
    `DESCRIPTION:${(details || "").replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "event.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- map row ---------------- */
function mapRow(ev) {
  const starts = ev.starts_at || ev.dateISO;
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description || "",
    cover_url: ev.cover_url || ev.img || "",
    starts_at: starts,
    ends_at: ev.ends_at || ev.ends_at || null,
    city: ev.city || "",
    lat: typeof ev.lat === "number" ? ev.lat : Number(ev.lat ?? NaN),
    lng: typeof ev.lng === "number" ? ev.lng : Number(ev.lng ?? NaN),
    category: ev.category || "Other",
    price: Number(ev.price ?? 0),
    creator_id: ev.creator_id, // useful for "Hosting"
    am_attending: ev.am_attending ?? ev.attending_by_me ?? false, // if API provides
  };
}

/* ---------------- main ---------------- */
export default function Calendar() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const initDate = useMemo(() => {
    const d = sp.get("d");
    if (!d) return new Date();
    const t = new Date(d);
    return isNaN(t.getTime()) ? new Date() : t;
  }, [sp]);

  const [cursor, setCursor] = useState(startOfMonth(initDate));
  const [selected, setSelected] = useState(atMidnight(initDate));
  const [view, setView] = useState("month"); // month | agenda
  const [filter, setFilter] = useState("All"); // All | Going | Hosting

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const abortRef = useRef(null);
  const userIdRef = useRef(null); // fill this from your auth context if you have one

  const rangeStart = useMemo(() => startOfCalendarGrid(cursor, 0), [cursor]);
  const rangeEnd = useMemo(() => addDays(rangeStart, 41), [rangeStart]);

  // fetch visible range
  useEffect(() => {
    let mounted = true;
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setErr("");

    const from = toYMD(rangeStart) + "T00:00:00Z";
    const to = toYMD(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59)) + "Z";

    (async () => {
      try {
        const rows = await listRangeWithAuth({ from, to, signal: ac.signal });
        const mapped = rows.map(mapRow);
        if (!mounted) return;
        setEvents(mapped);
      } catch (e) {
        if (!mounted || e?.name === "AbortError") return;
        const status = e?.status || e?.response?.status;
        if (status === 401) setErr("Session expired. Please sign in again.");
        else setErr(e.message || "Failed to load events");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [rangeStart, rangeEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const k = toYMD(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    return map;
  }, [events]);

  const selectedKey = toYMD(selected);
  const rawList = eventsByDay.get(selectedKey) || [];

  // filter: Going/Hosting (if your API provides am_attending; hosting via creator_id)
  const filteredList = useMemo(() => {
    if (filter === "All") return rawList;
    if (filter === "Going") {
      const anyFlag = rawList.some((e) => e.am_attending === true);
      return anyFlag ? rawList.filter((e) => e.am_attending) : rawList; // graceful fallback
    }
    if (filter === "Hosting") {
      const uid = userIdRef.current;
      if (!uid) return rawList;
      return rawList.filter((e) => e.creator_id === uid);
    }
    return rawList;
  }, [rawList, filter]);

  const monthTitle = useMemo(
    () => cursor.toLocaleDateString([], { month: "long", year: "numeric" }),
    [cursor]
  );

  const gridDays = useMemo(() => {
    const arr = [];
    const first = startOfCalendarGrid(cursor, 0);
    for (let i = 0; i < 42; i++) {
      const d = addDays(first, i);
      const key = toYMD(d);
      const items = eventsByDay.get(key) || [];
      arr.push({ date: d, key, items });
    }
    return arr;
  }, [cursor, eventsByDay]);

  const goToday = () => {
    const t = new Date();
    setCursor(startOfMonth(t));
    setSelected(atMidnight(t));
  };

  const onAddToCalendar = (ev) => {
    const s = new Date(ev.starts_at);
    const e = new Date(ev.ends_at || s.getTime() + 2 * 3600_000);

    // Quick action: try web share to Google URL, else fall back to ICS download
    const url = googleCalendarUrl({
      title: ev.title,
      startsAt: s,
      endsAt: e,
      location: ev.city,
      details: ev.description,
    });
    if (navigator.share) {
      navigator
        .share({ title: ev.title, text: ev.description || "", url })
        .catch(() => downloadICS({ title: ev.title, startsAt: s, endsAt: e, location: ev.city, details: ev.description }));
    } else {
      downloadICS({ title: ev.title, startsAt: s, endsAt: e, location: ev.city, details: ev.description });
    }
  };

  const onOpenDetail = (ev) => nav(`/events/${ev.id}`, { state: { event: ev } });

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-md px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                onClick={() => setCursor((c) => addMonths(c, -1))}
                aria-label="Previous month"
              >
                <i className="lni lni-chevron-left" />
              </button>
              <div className="text-lg font-semibold">{monthTitle}</div>
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                onClick={() => setCursor((c) => addMonths(c, 1))}
                aria-label="Next month"
              >
                <i className="lni lni-chevron-right" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToday}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Today
              </button>
              <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
                <button
                  onClick={() => setView("month")}
                  className={`rounded-full px-3 py-1.5 text-sm ${view === "month" ? "bg-violet-600 text-white" : "text-gray-700 hover:bg-violet-50"}`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView("agenda")}
                  className={`rounded-full px-3 py-1.5 text-sm ${view === "agenda" ? "bg-violet-600 text-white" : "text-gray-700 hover:bg-violet-50"}`}
                >
                  Agenda
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-2 flex items-center gap-2">
            {["All", "Going", "Hosting"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm",
                  filter === f ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-800 border-gray-200 hover:bg-violet-50",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-md px-4 pt-3 pb-24">
        {err ? (
          <CalendarError
            err={err}
            onSignIn={() => nav("/login", { state: { from: "/calendar" } })}
            onRetry={() => setCursor((c) => new Date(c))}
          />
        ) : (
          <>
            {view === "month" && (
              <>
                {/* Weekday header */}
                <div className="grid grid-cols-7 text-center text-[11px] text-gray-500">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>
                {/* Month grid */}
                <div className="grid grid-cols-7 gap-[6px]">
                  {gridDays.map(({ date, key, items }) => {
                    const inMonth = date.getMonth() === cursor.getMonth();
                    const sel = isSameDay(date, selected);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelected(atMidnight(date));
                          // auto switch to agenda on small screens
                          if (window.innerWidth < 640) setView("agenda");
                        }}
                        className={[
                          "group relative h-20 rounded-xl border p-2 text-left transition",
                          sel ? "border-violet-600 ring-2 ring-violet-200" : "border-gray-200 hover:border-violet-200",
                          inMonth ? "bg-white" : "bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`text-xs ${inMonth ? "text-gray-800" : "text-gray-400"}`}>
                            {date.getDate()}
                          </div>
                          {isToday(date) && (
                            <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-medium text-violet-700">Today</span>
                          )}
                        </div>
                        {/* dots */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {items.slice(0, 4).map((ev) => (
                            <span key={ev.id} className={`inline-block h-2.5 w-2.5 rounded-full ${catColor(ev.category)}`} title={ev.title} />
                          ))}
                          {items.length > 4 && (
                            <span className="ml-1 text-[11px] text-gray-500">+{items.length - 4}</span>
                          )}
                        </div>
                        {/* selected highlight bg */}
                        {sel && <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-violet-600/20" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Agenda (selected day) */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium text-gray-700">
                  {selected.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                </div>
                <div className="text-xs text-gray-500">{filteredList.length} event(s)</div>
              </div>
              <div className="mt-3 space-y-3">
                {loading ? (
                  <div className="animate-pulse h-24 rounded-2xl bg-gray-100" />
                ) : filteredList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
                    No events on this day.
                  </div>
                ) : (
                  filteredList.map((ev) => (
                    <div key={ev.id} className="flex items-stretch gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-card">
                      <div className="grid w-12 place-items-center rounded-xl border border-gray-200 bg-white text-center leading-tight">
                        <div className="text-[11px] text-gray-500">Start</div>
                        <div className="text-sm font-semibold text-violet-700">{timeLabel(ev.starts_at)}</div>
                      </div>
                      <div className="h-16 w-24 overflow-hidden rounded-lg bg-gray-100">
                        {ev.cover_url ? (
                          <img src={ev.cover_url} alt={ev.title} className="h-full w-full object-cover" draggable={false} />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-gray-400">No cover</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{ev.title}</div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] text-white ${catColor(ev.category)}`}>
                            {ev.category}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <i className="lni lni-map-marker text-violet-600" />
                          {ev.city || "—"}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-violet-700">{currency(ev.price)}</div>

                        <div className="mt-2 flex gap-2">
                          <button
                            className="btn-outline !px-2.5 !py-1 text-xs"
                            onClick={() => onOpenDetail(ev)}
                          >
                            View details
                          </button>
                          <button
                            className="btn-primary !px-2.5 !py-1 text-xs"
                            onClick={() => onAddToCalendar(ev)}
                          >
                            Add to Calendar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating create */}
      <button
        onClick={() => nav("/events/new")}
        className="fixed bottom-20 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
        title="Create event"
      >
        <i className="lni lni-plus" />
      </button>
    </div>
  );
}

function CalendarError({ err, onSignIn, onRetry }) {
  const isAuth = /session expired|unauthorized|401/i.test(String(err));
  return (
    <div className="grid h-[60vh] place-items-center text-center">
      <div>
        <p className={isAuth ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
          {isAuth ? "You need to sign in" : "Failed to load"}
        </p>
        <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {isAuth ? (
            <button className="btn-primary" onClick={onSignIn}>
              <i className="lni lni-unlock mr-1" />
              Sign in
            </button>
          ) : (
            <button className="btn-outline" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}