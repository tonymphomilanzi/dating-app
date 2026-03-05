// src/pages/Discover.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { discoverService } from "../services/discover.service.js";
import { storiesService } from "../services/stories.service.js";
import { saveBrowserLocationToProfile } from "../utils/location.js";
import { kmBetween } from "../utils/geo.js";
import { DiscoverCache } from "../lib/discoverCache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";

const tabs = [
  { key: "matches", label: "Matches" },
  { key: "nearby", label: "Nearby" },
  { key: "for_you", label: "For You" },
];

const numOrNull = (v) => (v == null ? null : (Number.isFinite(+v) ? +v : parseFloat(String(v)) || null));
const normalizeCoords = (p) => ({
  lat: numOrNull(p.lat ?? p.latitude),
  lng: numOrNull(p.lng ?? p.longitude ?? p.long),
});

export default function Discover() {
  const nav = useNavigate();
  const { profile, reloadProfile } = useAuth();
  const uid = profile?.id || "me";

  const [mode, setMode] = useState("for_you");
  const [activeMode, setActiveMode] = useState("for_you");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // location
  const myLat = numOrNull(profile?.lat);
  const myLng = numOrNull(profile?.lng);
  const userHasLocation = myLat != null && myLng != null;
  const [locBusy, setLocBusy] = useState(false);

  // stories
  const [storyUsers, setStoryUsers] = useState([]);
  const [hasMyStory, setHasMyStory] = useState(false);

  // requests race guard
  const reqIdRef = useRef(0);

  // map + normalize distance
  const mapAndNormalize = (data) => {
    if (myLat != null && myLng != null) {
      return data.map((p) => {
        const { lat, lng } = normalizeCoords(p);
        let distance_km = p.distance_km;
        if ((distance_km == null || Number.isNaN(Number(distance_km))) && lat != null && lng != null) {
          const d = kmBetween(myLat, myLng, lat, lng);
          distance_km = Math.round(d * 10) / 10;
        }
        return { ...p, lat, lng, distance_km };
      });
    }
    return data.map((p) => ({ ...p, ...normalizeCoords(p) }));
  };

  // fetch current mode (foreground or background)
  const fetchMode = async (requestedMode, { background = false } = {}) => {
    const myReq = ++reqIdRef.current;
    if (!background) { setLoading(true); setErr(""); }

    try {
      const res = await discoverService.list(requestedMode, 20, { debug: false });
      let data = Array.isArray(res) ? res : [];
      data = mapAndNormalize(data);

      // Ignore stale responses
      if (reqIdRef.current !== myReq) return;

      setItems(data);
      setActiveMode(requestedMode);
      DiscoverCache.save(uid, requestedMode, data);
    } catch (e) {
      if (reqIdRef.current !== myReq) return;
      setErr(e.message || "Failed to load");
    } finally {
      if (!background && reqIdRef.current === myReq) setLoading(false);
    }
  };

  // initial load on tab change: cache-first, then background refresh if stale
  useEffect(() => {
    const cached = DiscoverCache.load(uid, mode);
    if (cached.items?.length) {
      setItems(cached.items);
      setActiveMode(mode);
      setLoading(false);
      if (DiscoverCache.isStale(cached.ts)) fetchMode(mode, { background: true });
    } else {
      fetchMode(mode, { background: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, uid, myLat, myLng]);

  // Revalidate on focus/visibility/online + periodic background refresh
  useRevalidate({
    refetch: () => fetchMode(mode, { background: true }),
    intervalMs: 60_000,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
  });

  // stories: load once (lightweight)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [users, hasMine] = await Promise.all([
          storiesService.listActiveUsers(30).catch(() => []),
          storiesService.hasMyActive().catch(() => false),
        ]);
        if (!cancel) {
          setStoryUsers(users);
          setHasMyStory(hasMine);
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  const enableLocation = async () => {
    if (locBusy) return;
    setLocBusy(true);
    try {
      await saveBrowserLocationToProfile();
      await reloadProfile();
      setMode("nearby");
    } catch (e) {
      alert(e.message || "Could not get your location");
    } finally {
      setLocBusy(false);
    }
  };

  const stories = useMemo(() => (items || []).slice(0, 6), [items]);
  const showEnableNearby = activeMode === "nearby" && !userHasLocation;

  return (
    <div className="flex min-h-[70vh] flex-col bg-white text-gray-900">
      <header className="px-4 pt-4">
        {/* Top row */}
        <div className="mb-3 flex items-center gap-3">
          <img
            src={profile?.avatar_url || "/me.jpg"}
            alt="Me"
            className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-600 ring-offset-2"
          />
          <div className="text-sm leading-tight">
            <p className="text-gray-500">Discover</p>
          </div>
        <Link to="/filters" className="ml-auto rounded-full p-2 hover:bg-gray-100" aria-label="Filters">
            <i className="lni lni-filter text-xl" />
          </Link>
        </div>

        {/* Stories row */}
        <div className="no-scrollbar mb-3 flex items-start gap-3 overflow-x-auto pb-1">
          {/* My story */}
          <div className="flex w-16 flex-col items-center">
            <button
              className={[
                "grid h-14 w-14 place-items-center rounded-full",
                hasMyStory
                  ? "ring-2 ring-violet-600"
                  : "border-2 border-dashed border-violet-600 text-violet-600",
              ].join(" ")}
              onClick={() => nav("/stories/new")}
              aria-label="My story"
            >
              <i className="lni lni-plus" />
            </button>
            <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">My story</span>
          </div>

          {/* Other users with active stories */}
          {storyUsers.map((u) => (
            <button
              key={u.user_id}
              onClick={() => nav(`/stories/${u.user_id}`)}
              className="flex w-16 flex-col items-center"
              aria-label={`Open ${u.name}'s story`}
            >
              <img
                src={u.avatar || "/me.jpg"}
                alt={u.name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-200"
                draggable={false}
              />
              <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">
                {String(u.name).split(" ")[0]}
              </span>
            </button>
          ))}
        </div>

        <p className="font-semibold">
          Let’s Find Your <span className="text-violet-600">Matches</span>
        </p>

        {/* Pill tabs */}
        <div className="items-center mt-2">
          <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  mode === t.key ? "bg-violet-600 text-white shadow" : "text-gray-700 hover:bg-violet-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {mode !== activeMode && !loading && (
            <div className="mt-2 text-xs text-gray-500">
              No results in “{mode.replace("_", " ")}” — showing “{activeMode.replace("_", " ")}”.
            </div>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 pb-6">
        {loading && items.length === 0 ? (
          <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
              <span className="relative inline-block h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
              </span>
              <span className="text-sm font-medium text-gray-700">Loading…</span>
            </div>
          </div>
        ) : err ? (
          <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
            <div>
              <p className="text-red-600 font-medium">Failed to load</p>
              <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
              <button className="btn-outline mt-3" onClick={() => fetchMode(mode, { background: false })}>
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {showEnableNearby && (
              <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center justify-between gap-3">
                  <span>Enable your location to see people Nearby.</span>
                  <button
                    onClick={enableLocation}
                    disabled={locBusy}
                    className="rounded-full bg-amber-600 px-3 py-1 text-white"
                  >
                    {locBusy ? "Enabling…" : "Enable"}
                  </button>
                </div>
              </div>
            )}
            <SwipeDeck initialItems={items} mode={activeMode} myLoc={{ lat: myLat, lng: myLng }} />
          </>
        )}
      </main>
    </div>
  );
}