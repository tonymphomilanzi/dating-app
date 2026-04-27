// src/pages/Discover.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { discoverService } from "../services/discover.service.js";
import { storiesService } from "../services/stories.service.js";
import { updateProfileLocation } from "../utils/location.js";
import { DiscoverCache } from "../lib/discoverCache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";
import { useGeolocation } from "../hooks/useGeolocation.js";

/* ================================================================
   CONSTANTS
   ================================================================ */

const TABS = [
  { key: "matches", label: "Matches" },
  { key: "nearby",  label: "Nearby"  },
  { key: "for_you", label: "For You" },
];

const LOC_SAVE_INTERVAL_MS = 300_000; // 5 minutes

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function Discover() {
  const navigate    = useNavigate();
  const { profile } = useAuth();
  const userId      = profile?.id || "me";

  // ── Tab state ───────────────────────────────────────────────────
  const [mode,       setMode]       = useState("for_you");
  const [activeMode, setActiveMode] = useState("for_you");

  // ── Per-tab data maps ───────────────────────────────────────────
  const [profilesMap, setProfilesMap] = useState({});
  const [loadingMap,  setLoadingMap]  = useState({});
  const [errorMap,    setErrorMap]    = useState({});

  // ── Stories ─────────────────────────────────────────────────────
  const [stories, setStories] = useState({ users: [], mine: false });

  // ── Refs ────────────────────────────────────────────────────────
  const reqId            = useRef({});
  const abortCtrls       = useRef({});
  const lastSave         = useRef(0);
  const initializedModes = useRef(new Set());

  // ── Derived state ────────────────────────────────────────────────
  // `loading` defaults to `false` when profilesMap already has data for this
  // mode — avoids the loading flash when switching back to an already-loaded tab.
  // It defaults to `true` only when we have no data yet.
  const profiles = profilesMap[mode] ?? [];
  const loading  = loadingMap[mode]  ?? !profilesMap[mode];
  const error    = errorMap[mode]    ?? "";

  // ── Location ─────────────────────────────────────────────────────
  const onLocChange = useCallback(async ({ lat, lng }) => {
    if (!lat || !lng) return;
    if (Date.now() - lastSave.current < LOC_SAVE_INTERVAL_MS) return;
    try {
      await updateProfileLocation(lat, lng);
      lastSave.current = Date.now();
    } catch { /* silent */ }
  }, []);

  const { location: geo, status: geoStatus, refresh: geoRefresh } = useGeolocation({
    watch:            true,
    updateIntervalMs: 30_000,
    onLocationChange: onLocChange,
  });

  const myLoc = useMemo(() => {
    if (geo?.lat && geo?.lng) return { ...geo, isRealtime: true };
    if (profile?.lat && profile?.lng)
      return { lat: +profile.lat, lng: +profile.lng, isRealtime: false };
    return null;
  }, [geo, profile?.lat, profile?.lng]);

  // Ref mirror — lets loadProfiles read the latest location without
  // being in its dependency array (prevents recreation on every GPS tick)
  const myLocRef = useRef(myLoc);
  useEffect(() => { myLocRef.current = myLoc; }, [myLoc]);

  // ── Core fetch ───────────────────────────────────────────────────
  const loadProfiles = useCallback(
    async (targetMode, silent = false) => {
      if (!reqId.current[targetMode]) reqId.current[targetMode] = 0;
      const id = ++reqId.current[targetMode];

      abortCtrls.current[targetMode]?.abort();
      abortCtrls.current[targetMode] = new AbortController();

      if (!silent) {
        setLoadingMap((prev) => ({ ...prev, [targetMode]: true }));
        setErrorMap  ((prev) => ({ ...prev, [targetMode]: ""   }));
      }

      try {
        const loc  = myLocRef.current;
        const data = await discoverService.list(targetMode, 20, {
          lat:    loc?.lat,
          lng:    loc?.lng,
          signal: abortCtrls.current[targetMode].signal,
        });

        if (id !== reqId.current[targetMode]) return; // stale

        const list = Array.isArray(data) ? data : [];
        setProfilesMap((prev) => ({ ...prev, [targetMode]: list }));
        setActiveMode(targetMode);
        DiscoverCache.save(userId, targetMode, list);
      } catch (err) {
        if (id !== reqId.current[targetMode]) return;
        if (err?.name === "AbortError") return;
        setErrorMap((prev) => ({
          ...prev,
          [targetMode]: err?.message || "Failed to load profiles",
        }));
      } finally {
        if (id === reqId.current[targetMode] && !silent) {
          setLoadingMap((prev) => ({ ...prev, [targetMode]: false }));
        }
      }
    },
    [userId]
  );

  // ── Mode initialisation ──────────────────────────────────────────
  const initMode = useCallback(
    (targetMode) => {
      if (initializedModes.current.has(targetMode)) return;
      initializedModes.current.add(targetMode);

      const cached = DiscoverCache.load(userId, targetMode);
      if (cached.items?.length) {
        setProfilesMap((prev) => ({ ...prev, [targetMode]: cached.items }));
        setLoadingMap ((prev) => ({ ...prev, [targetMode]: false }));
        setActiveMode(targetMode);
        if (DiscoverCache.isStale(cached.ts)) {
          loadProfiles(targetMode, true);
        }
      } else {
        loadProfiles(targetMode);
      }
    },
    [userId, loadProfiles]
  );

  // ── Effects ─────────────────────────────────────────────────────

  // ✅ FIX: Reset initializedModes on UNMOUNT so that navigating away
  // and back causes a fresh init. Without this, coming back from another
  // route skips initMode entirely and the page stays blank.
  useEffect(() => {
    return () => {
      initializedModes.current = new Set();
      // Abort all in-flight requests on unmount
      Object.values(abortCtrls.current).forEach((ac) => ac?.abort());
      abortCtrls.current = {};
    };
  }, []); // runs once — cleanup fires on unmount

  // Init active tab on mode change
  useEffect(() => { initMode(mode); }, [mode, initMode]);

  // Reset all per-tab state when the user changes
  useEffect(() => {
    initializedModes.current = new Set();
    setProfilesMap({});
    setLoadingMap ({});
    setErrorMap   ({});
  }, [userId]);

  // Load stories once per mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      storiesService.listActiveUsers(30).catch(() => []),
      storiesService.hasMyActive().catch(() => false),
    ]).then(([users, mine]) => {
      if (!cancelled) setStories({ users, mine });
    });
    return () => { cancelled = true; };
  }, []);

  // Background revalidation (stable ref — no listener churn)
  const silentRefetch = useCallback(
    () => loadProfiles(mode, true),
    [mode, loadProfiles]
  );
  useRevalidate({ refetch: silentRefetch, intervalMs: 60_000 });

  // ── Handlers ────────────────────────────────────────────────────
  const handleTabChange = useCallback((key) => { setMode(key); }, []);

  const handleRetry = useCallback(() => {
    initializedModes.current.delete(mode);
    initMode(mode);
  }, [mode, initMode]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">

      <header className="px-4 pt-4">
        <div className="mb-4 flex items-center justify-between">

          {/* Left — Messages · Notifications · Filter */}
          <div className="flex items-center gap-2">
            <IconButton icon="messages" aria-label="Messages"
              onClick={() => navigate("/messages")} />
            <IconButton icon="bell" aria-label="Notifications" count={3}
              onClick={() => navigate("/notifications")} />
            <IconButton icon="filter" aria-label="Filter"
              onClick={() => navigate("/filters")} />
          </div>

          {/* Centre */}
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Discover
            </span>
            <LocationStatus geo={myLoc} status={geoStatus} />
          </div>

          {/* Right — avatar */}
          <Link to="/profile" className="relative group">
            <img
              src={profile?.avatar_url || "/me.jpg"}
              alt="My profile"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-violet-600
                ring-offset-2 transition-transform group-active:scale-90"
            />
          </Link>
        </div>

        <StoriesRow
          data={stories}
          onMine={() => navigate("/stories/new")}
          onUser={(id) => navigate(`/stories/${id}`)}
        />

        <h1 className="text-xl font-bold mt-2">
          Find Your <span className="text-violet-600">Matches</span>
        </h1>

        <div className="mt-3 flex gap-1 rounded-full bg-gray-100 p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                mode === t.key
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        {loading && !profiles.length ? (
          // ✅ Replaced "Scanning for matches…" with instant skeleton cards
          // so the UI feels responsive immediately instead of showing a
          // full-page spinner that can take 2-3 seconds.
          <ProfileSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          <div className="relative h-full">
            {mode === "nearby" && !myLoc && (
              <LocationPrompt
                onEnable={geoRefresh}
                loading={geoStatus === "loading"}
              />
            )}
            <SwipeDeck
              initialItems={profiles}
              mode={activeMode}
              myLoc={myLoc}
            />
          </div>
        )}
      </main>
    </div>
  );
}

/* ================================================================
   ICON BUTTON
   ================================================================ */

const IconButton = memo(function IconButton({
  icon,
  onClick,
  count,
  "aria-label": ariaLabel,
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? icon}
      className="relative rounded-full bg-gray-50 p-2.5 text-gray-700
        hover:bg-gray-100 active:scale-90 transition-all"
    >
      {icon === "messages" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9
               8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512
               15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
      {icon === "bell" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
               6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6
               8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6
               0a3 3 0 11-6 0m6 0H9" />
        </svg>
      )}
      {icon === "filter" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0
               100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0
               100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      )}
      {count != null && count > 0 && (
        <span
          aria-label={`${count} unread`}
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center
            justify-center rounded-full bg-red-500 text-[10px] font-bold
            text-white ring-2 ring-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
});

/* ================================================================
   LOCATION STATUS
   ================================================================ */

const LocationStatus = memo(function LocationStatus({ geo, status }) {
  if (!geo) return null;
  const isUpdating = status === "loading";
  return (
    <div className={`flex items-center justify-center gap-1 text-[10px] font-bold
      ${isUpdating ? "text-amber-500" : "text-green-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current
        ${isUpdating ? "animate-pulse" : ""}`} />
      {isUpdating ? "SYNCING" : geo.accuracy ? `${Math.round(geo.accuracy)}m` : "ACTIVE"}
    </div>
  );
});

/* ================================================================
   STORIES ROW
   ================================================================ */

const StoriesRow = memo(function StoriesRow({ data, onMine, onUser }) {
  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto py-2">
      <button onClick={onMine}
        className="flex flex-col items-center gap-1 shrink-0"
        aria-label="My story">
        <div className={`grid h-14 w-14 place-items-center rounded-full border-2
          ${data.mine ? "border-violet-600 p-0.5" : "border-dashed border-gray-300"}`}>
          <div className="grid h-full w-full place-items-center rounded-full
            bg-gray-50 text-violet-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>
        <span className="text-[10px] font-medium text-gray-500">My Story</span>
      </button>

      {data.users.map((u) => (
        <button key={u.user_id} onClick={() => onUser(u.user_id)}
          className="flex flex-col items-center gap-1 shrink-0"
          aria-label={`${u.name}'s story`}>
          <img src={u.avatar || "/me.jpg"} alt={u.name}
            className="h-14 w-14 rounded-full border-2 border-violet-200 p-0.5 object-cover" />
          <span className="text-[10px] font-medium text-gray-600 w-14 truncate text-center">
            {u.name?.split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
});

/* ================================================================
   PROFILE SKELETON  — replaces the old "Scanning for matches…" spinner
   Renders instantly, matches the real SwipeDeck card shape so there's
   no layout shift when data arrives.
   ================================================================ */

function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 animate-pulse">
      {/* Main card skeleton */}
      <div className="w-full max-w-sm">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-100">
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]
            bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Bottom info strip */}
          <div className="absolute bottom-0 inset-x-0 p-5 space-y-2">
            <div className="h-6 w-2/3 rounded-full bg-gray-200/70" />
            <div className="h-4 w-1/3 rounded-full bg-gray-200/50" />
          </div>
        </div>

        {/* Action buttons row */}
        <div className="mt-4 flex items-center justify-center gap-4">
          {[
            "h-12 w-12 bg-gray-100",
            "h-16 w-16 bg-violet-100",
            "h-12 w-12 bg-gray-100",
          ].map((cls, i) => (
            <div key={i} className={`rounded-full ${cls}`} />
          ))}
        </div>
      </div>

      {/* Subtle hint text — brief, not "scanning" language */}
      <p className="text-xs text-gray-400 font-medium">Finding people near you…</p>
    </div>
  );
}

/* ================================================================
   ERROR STATE
   ================================================================ */

const ErrorState = ({ error, onRetry }) => (
  <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
    <div className="mb-4 rounded-full bg-red-50 p-3 text-red-500">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
             1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
             16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <p className="text-sm font-semibold text-gray-800">
      {error || "Something went wrong"}
    </p>
    <button
      onClick={onRetry}
      className="mt-4 text-xs font-bold text-violet-600 uppercase tracking-widest"
    >
      Try Again
    </button>
  </div>
);

/* ================================================================
   LOCATION PROMPT
   ================================================================ */

const LocationPrompt = ({ onEnable, loading }) => (
  <div className="mb-6 flex items-center justify-between rounded-2xl
    bg-violet-600 p-4 text-white shadow-lg shadow-violet-200">
    <div>
      <p className="text-sm font-bold">Nearby Mode</p>
      <p className="text-xs opacity-80">Enable location to find local matches.</p>
    </div>
    <button
      onClick={onEnable}
      disabled={loading}
      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-violet-600
        active:scale-95 transition-transform disabled:opacity-60"
    >
      {loading ? "Locating…" : "Enable"}
    </button>
  </div>
);