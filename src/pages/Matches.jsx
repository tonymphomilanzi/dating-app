// src/pages/Matches.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { matchesService } from "../services/matches.service.js";

/* ---------------- Helpers ---------------- */
function getTimestamp(item) {
  const timestamp =
    item?.created_at ||
    item?.matched_at ||
    item?.liked_at ||
    item?.other?.created_at;
  return timestamp ? new Date(timestamp).getTime() : Date.now();
}

function getLabelForTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const time = date.getTime();

  if (time >= startOfToday) return "Today";
  if (time >= startOfYesterday) return "Yesterday";
  return "Earlier";
}

function groupByDay(items) {
  const groups = new Map();

  for (const item of items) {
    const label = getLabelForTimestamp(getTimestamp(item));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  const order = ["Today", "Yesterday", "Earlier"];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label) }));
}

/* ---------------- Main Component ---------------- */
export default function Matches() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("likes"); // "likes" | "matches"
  const [items, setItems] = useState([]);
  const [limited, setLimited] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // For race control
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchItems = useCallback(async (nextMode = mode) => {
    const rid = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const response = await matchesService.list(nextMode); // expects { items, total, limited }
      if (!isMountedRef.current || requestIdRef.current !== rid) return;

      setItems(response.items || []);
      setLimited(Boolean(response.limited));
      setTotal(Number(response.total || 0));
    } catch (err) {
      if (!isMountedRef.current || requestIdRef.current !== rid) return;
      setError(err?.message || "Failed to load");
    } finally {
      if (isMountedRef.current && requestIdRef.current === rid) {
        setLoading(false);
      }
    }
  }, [mode]);

  // Load data on mode change
  useEffect(() => {
    fetchItems(mode);
  }, [mode, fetchItems]);

  // Retry really refetches now
  const handleRetry = useCallback(() => {
    fetchItems(mode);
  }, [fetchItems, mode]);

  // Handle like back
  const handleLikeBack = useCallback(
    async (item) => {
      const targetId = item.other?.id || item.id;
      if (!targetId) return;

      setActionLoading(targetId);
      try {
        const result = await matchesService.likeBack(targetId);
        // Remove from UI list
        setItems((prev) => prev.filter((i) => (i.other?.id || i.id) !== targetId));
        // Keep total accurate locally
        setTotal((t) => Math.max(0, t - 1));

        if (result?.matched) {
          // Optionally toast/modal
          console.log("🎉 It's a match!");
        }
      } catch (err) {
        console.error("Like back failed:", err);
        alert(err?.message || "Failed to like back");
      } finally {
        setActionLoading(null);
      }
    },
    []
  );

  // Handle pass
  const handlePass = useCallback(
    async (item) => {
      const targetId = item.other?.id || item.id;
      if (!targetId) return;

      setActionLoading(targetId);
      try {
        await matchesService.pass(targetId);
        // Remove from UI list
        setItems((prev) => prev.filter((i) => (i.other?.id || i.id) !== targetId));
        // Keep total accurate locally
        setTotal((t) => Math.max(0, t - 1));
      } catch (err) {
        console.error("Pass failed:", err);
        alert(err?.message || "Failed to pass");
      } finally {
        setActionLoading(null);
      }
    },
    []
  );

  // Handle message (for matches)
  const handleMessage = useCallback(
    (item) => {
      const targetId = item.other?.id;
      const conversationId = item.conversationId;

      // If we already have a conversation id, use it. Otherwise, go by user id.
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      } else if (targetId) {
        navigate(`/chat/${targetId}`);
      }
    },
    [navigate]
  );

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-4">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Matches</h1>

            {/* Tab toggle */}
            <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
              {[
                { key: "likes", label: "Likes", count: mode === "likes" ? total : null },
                { key: "matches", label: "Matches" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMode(tab.key)}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mode === tab.key
                      ? "bg-violet-600 text-white shadow"
                      : "text-gray-700 hover:bg-violet-50"
                  }`}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1 text-xs">
                      {tab.count > 99 ? "99+" : tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            {mode === "likes"
              ? "People who liked you — like back to match!"
              : "Your matches — start a conversation!"}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : items.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          <>
            {/* Premium limit warning */}
            {limited && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      You have {total} {mode}!
                    </p>
                    <p className="text-xs text-amber-600">
                      Upgrade to Premium to see all.
                    </p>
                  </div>
                  <Link
                    to="/premium"
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  >
                    Upgrade
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Grouped items */}
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
                <section key={group.label} className="mb-6">
                  <h2 className="mb-3 text-sm font-semibold text-gray-500">{group.label}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <AnimatePresence mode="popLayout">
                      {group.items.map((item) => {
                        const other = item.other || item;
                        const otherId = other.id || item.id;
                        const isLoading = actionLoading === otherId;

                        return (
                          <motion.div
                            key={item.id || otherId}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                          >
                            <MatchCard
                              name={other.display_name || other.name || "Member"}
                              age={other.age}
                              city={other.city}
                              img={other.avatar_url || other.photo}
                              isSuper={item.is_super}
                              to={`/profile/${otherId}`}
                              mode={mode}
                              isLoading={isLoading}
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

/* ---------------- Match Card ---------------- */
function MatchCard({
  name,
  age,
  city,
  img,
  isSuper,
  to,
  mode,
  isLoading,
  onPass,
  onLike,
  onMessage,
}) {
  const imgSrc = img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <Link to={to} className="block">
        <div className="relative aspect-[3/4] w-full">
          <img
            src={imgSrc}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />

          {/* Super like badge */}
          {isSuper && (
            <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          )}

          {/* Gradients */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

          {/* Info */}
          <div className="absolute left-3 right-3 bottom-14 text-white">
            <div className="truncate text-base font-semibold drop-shadow">
              {name}{age ? `, ${age}` : ""}
            </div>
            {city && (
              <div className="flex items-center gap-1 text-xs text-white/80">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                </svg>
                <span className="truncate">{city}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
        {mode === "likes" ? (
          <>
            <button
              onClick={onPass}
              disabled={isLoading}
              className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Pass"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <button
              onClick={onLike}
              disabled={isLoading}
              className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-sm hover:shadow-md disabled:opacity-50"
              aria-label="Like back"
            >
              {isLoading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onMessage}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Message
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Empty State ---------------- */
function EmptyState({ mode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-violet-50 to-pink-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
        {mode === "likes" ? (
          <svg className="h-8 w-8 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        ) : (
          <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
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
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Discover People
      </Link>
    </div>
  );
}

/* ---------------- Error State ---------------- */
function ErrorState({ error, onRetry }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
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

/* ---------------- Skeleton Grid ---------------- */
function SkeletonGrid({ count = 6 }) {
  return (
    <div className="animate-pulse">
      <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="aspect-[3/4] w-full bg-gray-200" />
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="h-6 w-px bg-gray-200" />
              <div className="h-10 w-10 rounded-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}