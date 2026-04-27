// src/pages/Matches.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { matchesService } from "../services/matches.service.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const REFETCH_COOLDOWN_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const ACTION_TIMEOUT_MS = 8_000;
const DAY_LABEL_ORDER = ["Today", "Yesterday", "Earlier"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a numeric timestamp from various API response shapes.
 * Returns 0 (not Date.now()) so items without timestamps sort into "Earlier"
 * rather than always appearing as "Today".
 */
function getTimestamp(item) {
  const raw =
    item?.created_at ||
    item?.matched_at ||
    item?.liked_at ||
    item?.other?.created_at;
  return raw ? new Date(raw).getTime() : 0;
}

/**
 * Map a numeric timestamp to a human-readable day label.
 * Computes day boundaries once per call — acceptable for list sizes here.
 */
function getLabelForTimestamp(timestamp) {
  // Items with no timestamp (ts === 0) always go to "Earlier"
  if (timestamp === 0) return "Earlier";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfYesterday) return "Yesterday";
  return "Earlier";
}

/**
 * Group a flat list of items into ordered day buckets.
 * Order is always: Today → Yesterday → Earlier (omitting empty buckets).
 */
function groupByDay(items) {
  const groups = new Map();

  for (const item of items) {
    const label = getLabelForTimestamp(getTimestamp(item));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  // Fixed iteration order — never rely on Map insertion order for display
  return DAY_LABEL_ORDER.filter((label) => groups.has(label)).map(
    (label) => ({ label, items: groups.get(label) })
  );
}

/**
 * Derive a stable, unique key for an item regardless of API shape.
 */
function getItemId(item) {
  return item?.other?.id ?? item?.id ?? null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Matches() {
  const navigate = useNavigate();

  // "likes" | "matches"
  const [mode, setMode] = useState("likes");

  // Per-tab state so switching tabs doesn't flash stale data
  const [tabState, setTabState] = useState({
    likes:   { items: [], limited: false, total: 0 },
    matches: { items: [], limited: false, total: 0 },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Track which item ID is currently being actioned (like-back or pass)
  const [actionLoading, setActionLoading] = useState(null);

  // Abort controller for the active list-fetch request
  const abortRef = useRef(null);

  // Timestamp of last successful refetch for cooldown logic
  const lastRefetchTsRef = useRef(0);

  // ── Fetch ────────────────────────────────────────────────────────────────

  /**
   * Fetch items for the given mode (defaults to current mode).
   * Cancels any in-flight request before starting a new one.
   * All state updates are guarded by the local abort signal so that
   * responses from cancelled requests are silently discarded.
   */
  const fetchItems = useCallback(async (nextMode) => {
    // Cancel in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError("");

    try {
      const response = await matchesService.list(nextMode, {
        signal: ac.signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      // Discard response if this request was superseded
      if (ac.signal.aborted) return;

      setTabState((prev) => ({
        ...prev,
        [nextMode]: {
          items:   response.items   ?? [],
          limited: Boolean(response.limited),
          total:   Number(response.total ?? 0),
        },
      }));
    } catch (err) {
      // Ignore errors from aborted/superseded requests
      if (ac.signal.aborted) return;
      setError(err?.message || "Failed to load");
    } finally {
      // Only clear loading if this is still the active request
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, []); // No deps — nextMode is passed explicitly; setters are stable

  // Fetch whenever the active tab changes
  useEffect(() => {
    fetchItems(mode);
    // Abort the in-flight request when the effect is cleaned up
    return () => abortRef.current?.abort();
  }, [mode, fetchItems]);

  // ── Background Revalidation ───────────────────────────────────────────────

  /**
   * Revalidate on window focus, tab visibility restore, or coming back online.
   * A cooldown prevents hammering the API when multiple events fire together.
   */
  useEffect(() => {
    const maybeRefetch = () => {
      const now = Date.now();
      if (now - lastRefetchTsRef.current < REFETCH_COOLDOWN_MS) return;
      lastRefetchTsRef.current = now;
      fetchItems(mode);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefetch();
    };

    window.addEventListener("focus", maybeRefetch);
    window.addEventListener("online", maybeRefetch);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", maybeRefetch);
      window.removeEventListener("online", maybeRefetch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, fetchItems]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const { items, limited, total } = tabState[mode];
  const groups = useMemo(() => groupByDay(items), [items]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => fetchItems(mode), [fetchItems, mode]);

  /**
   * Optimistically remove the item from the list and decrement the total.
   * If the API call fails, show an alert (a toast system would be better).
   */
  const removeItemOptimistically = useCallback((targetId) => {
    setTabState((prev) => {
      const tab = prev[mode]; // captured via closure — always current
      return {
        ...prev,
        [mode]: {
          ...tab,
          items: tab.items.filter((i) => getItemId(i) !== targetId),
          total: Math.max(0, tab.total - 1),
        },
      };
    });
  }, [mode]);

  const handleLikeBack = useCallback(
    async (item) => {
      const targetId = getItemId(item);
      if (!targetId || actionLoading) return; // prevent double-action

      setActionLoading(targetId);
      try {
        const result = await matchesService.likeBack(targetId, {
          timeoutMs: ACTION_TIMEOUT_MS,
        });

        removeItemOptimistically(targetId);

        if (result?.matched) {
          // TODO: Replace alert with a toast/modal for better UX
          console.info("🎉 It's a match with", targetId);
        }
      } catch (err) {
        console.error("Like back failed:", err);
        // TODO: Replace with toast notification
        alert(err?.message || "Failed to like back. Please try again.");
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, removeItemOptimistically]
  );

  const handlePass = useCallback(
    async (item) => {
      const targetId = getItemId(item);
      if (!targetId || actionLoading) return; // prevent double-action

      setActionLoading(targetId);
      try {
        await matchesService.pass(targetId, { timeoutMs: ACTION_TIMEOUT_MS });
        removeItemOptimistically(targetId);
      } catch (err) {
        console.error("Pass failed:", err);
        // TODO: Replace with toast notification
        alert(err?.message || "Failed to pass. Please try again.");
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, removeItemOptimistically]
  );

  const handleMessage = useCallback(
    (item) => {
      // Prefer an existing conversation ID; fall back to the other user's ID
      const dest = item.conversationId ?? item.other?.id ?? null;
      if (dest) navigate(`/chat/${dest}`);
    },
    [navigate]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col bg-white text-gray-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Matches</h1>

            {/* Tab toggle */}
            <TabToggle
              mode={mode}
              onSelect={setMode}
              likesCount={tabState.likes.total}
              matchesCount={tabState.matches.total}
            />
          </div>

          <p className="mt-2 text-sm text-gray-500">
            {mode === "likes"
              ? "People who liked you — like back to match!"
              : "Your matches — start a conversation!"}
          </p>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
        {loading ? (
          <SkeletonGrid mode={mode} />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : items.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          <>
            {/* Premium limit banner */}
            <AnimatePresence>
              {limited && (
                <PremiumBanner total={total} mode={mode} />
              )}
            </AnimatePresence>

            {/* Grouped item grid */}
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
                <section key={group.label} className="mb-6">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <AnimatePresence mode="popLayout">
                      {group.items.map((item) => {
                        const other    = item.other ?? item;
                        const otherId  = getItemId(item);
                        const isActing = actionLoading === otherId;

                        return (
                          <motion.div
                            key={item.id ?? otherId}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                          >
                            <MatchCard
                              name={
                                other.display_name ||
                                other.name ||
                                "Member"
                              }
                              age={other.age}
                              city={other.city}
                              img={other.avatar_url || other.photo}
                              isSuper={Boolean(item.is_super)}
                              to={`/profile/${otherId}`}
                              mode={mode}
                              isActing={isActing}
                              // Disable all action buttons while any action is pending
                              disabled={Boolean(actionLoading)}
                              onPass={() => handlePass(item)}
                              onLike={() => handleLikeBack(item)}
                              onMessage={() => handleMessage(item)}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </section>
              ))}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Tab Toggle ───────────────────────────────────────────────────────────────

/**
 * Segmented control for switching between "likes" and "matches" tabs.
 * Shows a badge count for each tab when > 0.
 */
function TabToggle({ mode, onSelect, likesCount, matchesCount }) {
  const tabs = [
    { key: "likes",   label: "Likes",   count: likesCount },
    { key: "matches", label: "Matches", count: matchesCount },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === tab.key
              ? "bg-violet-600 text-white shadow"
              : "text-gray-700 hover:bg-violet-50"
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1 text-xs">
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Premium Banner ───────────────────────────────────────────────────────────

function PremiumBanner({ total, mode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <StarIcon className="h-5 w-5 text-amber-600" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            You have {total} {mode}!
          </p>
          <p className="text-xs text-amber-600">
            Upgrade to Premium to see all.
          </p>
        </div>

        {/* CTA */}
        <Link
          to="/premium"
          className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition-shadow"
        >
          Upgrade
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

/**
 * @param {string}   name
 * @param {number}   [age]
 * @param {string}   [city]
 * @param {string}   [img]
 * @param {boolean}  isSuper
 * @param {string}   to          - Profile link href
 * @param {"likes"|"matches"} mode
 * @param {boolean}  isActing    - This specific card's action is in-flight
 * @param {boolean}  disabled    - Any card's action is in-flight (block all)
 * @param {Function} onPass
 * @param {Function} onLike
 * @param {Function} onMessage
 */
function MatchCard({
  name,
  age,
  city,
  img,
  isSuper,
  to,
  mode,
  isActing,
  disabled,
  onPass,
  onLike,
  onMessage,
}) {
  // Stable fallback avatar so broken URLs degrade gracefully
  const fallbackSrc = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  const handleImgError = (e) => {
    if (e.currentTarget.src !== fallbackSrc) {
      e.currentTarget.src = fallbackSrc;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* ── Photo ── */}
      <Link to={to} className="block">
        <div className="relative aspect-[3/4] w-full">
          <img
            src={img || fallbackSrc}
            alt={name}
            onError={handleImgError}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />

          {/* Super-like badge */}
          {isSuper && (
            <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg">
              <StarIcon className="h-4 w-4 text-white" />
            </div>
          )}

          {/* Top vignette */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" />
          {/* Bottom vignette */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

          {/* Name / age / city */}
          <div className="absolute bottom-14 left-3 right-3 text-white">
            <div className="truncate text-base font-semibold drop-shadow">
              {name}
              {age != null ? `, ${age}` : ""}
            </div>
            {city && (
              <div className="flex items-center gap-1 text-xs text-white/80">
                <LocationIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{city}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5">
        {mode === "likes" ? (
          <>
            {/* Pass button */}
            <button
              onClick={onPass}
              disabled={disabled}
              className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Pass"
            >
              {/* Show spinner on the pass button too when THIS card is acting */}
              {isActing ? (
                <Spinner className="h-5 w-5 text-gray-400" />
              ) : (
                <XIcon className="h-5 w-5" />
              )}
            </button>

            <div className="h-6 w-px bg-gray-200" />

            {/* Like-back button */}
            <button
              onClick={onLike}
              disabled={disabled}
              className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Like back"
            >
              {isActing ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <HeartIcon className="h-5 w-5" />
              )}
            </button>
          </>
        ) : (
          /* Message button */
          <button
            onClick={onMessage}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-violet-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChatIcon className="h-4 w-4" />
            Message
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Grid ────────────────────────────────────────────────────────────

/**
 * Placeholder grid shown while the list is loading.
 * Mirrors the real card layout — including the correct action row for the mode.
 */
function SkeletonGrid({ count = 6, mode = "likes" }) {
  return (
    <div className="animate-pulse">
      {/* Fake section label */}
      <div className="mb-3 h-4 w-20 rounded bg-gray-200" />

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
          >
            {/* Photo placeholder */}
            <div className="aspect-[3/4] w-full bg-gray-200" />

            {/* Action row placeholder */}
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5">
              {mode === "likes" ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div className="h-6 w-px bg-gray-200" />
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                </>
              ) : (
                <div className="h-10 flex-1 rounded-full bg-gray-200" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ mode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-violet-50 to-pink-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
        {mode === "likes" ? (
          <HeartIcon className="h-8 w-8 text-violet-400" filled />
        ) : (
          <PeopleIcon className="h-8 w-8 text-violet-400" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-800">
        {mode === "likes" ? "No likes yet" : "No matches yet"}
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        {mode === "likes"
          ? "Keep swiping! Your next like could be waiting."
          : "Like some profiles to start matching!"}
      </p>

      <Link
        to="/discover"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
      >
        <SearchIcon className="h-4 w-4" />
        Discover People
      </Link>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <WarningIcon className="h-8 w-8 text-red-400" />
      </div>

      <h3 className="text-lg font-semibold text-gray-800">Failed to load</h3>
      <p className="mt-2 text-sm text-gray-500">{error}</p>

      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  );
}

// ─── Inline SVG Icon Components ───────────────────────────────────────────────
// Extracted so they can be reused without duplication across card / states.

function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function StarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5", filled = false }) {
  return filled ? (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function XIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChatIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function LocationIcon({ className = "h-3 w-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function WarningIcon({ className = "h-8 w-8" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function PeopleIcon({ className = "h-8 w-8" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}