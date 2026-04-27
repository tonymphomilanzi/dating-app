// src/pages/Messages.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import MessagesList from "../components/MessagesList.jsx";
import { chatService } from "../services/chat.service.js";
import { formatChatListTime } from "../utils/time.js";
import { supabase } from "../lib/supabase.client.js";
import { ChatCache } from "../lib/cache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const REVALIDATE_INTERVAL_MS = 60_000;
const REVALIDATE_COOLDOWN_MS = 2_000;
const FAVORITES_COUNT = 8;
const FALLBACK_AVATAR = "https://picsum.photos/80";

// ─── Pure Helpers (module-level — not recreated on each render) ───────────────

/**
 * Race a promise against a hard timeout and an AbortController signal.
 * Cleans up the abort listener whether the promise wins or loses.
 *
 * @param {Promise}          promise
 * @param {AbortController}  ac
 * @param {number}           ms       - Timeout in milliseconds
 * @returns {Promise}
 */
function withTimeoutAndAbort(promise, ac, ms) {
  return new Promise((resolve, reject) => {
    let settled = false;

    // Guard: call reject/resolve only once
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    // Abort signal listener — cleaned up automatically via { once: true }
    const onAbort = () => settle(reject, new Error("aborted"));

    // Hard timeout
    const timerId = setTimeout(
      () => settle(reject, new Error(`Request timed out after ${ms}ms`)),
      ms
    );

    const cleanup = () => {
      clearTimeout(timerId);
      ac?.signal?.removeEventListener("abort", onAbort);
    };

    // Listen for abort (with once:true for auto-cleanup on fire)
    ac?.signal?.addEventListener("abort", onAbort, { once: true });

    // The actual request
    promise.then(
      (value) => settle(resolve, value),
      (err)   => settle(reject, err)
    );
  });
}

/**
 * Normalise raw API thread items into the shape expected by MessagesList.
 * Sorted newest-first by last activity.
 *
 * @param {Array} items - Raw items from chatService.list()
 * @returns {Array}
 */
function mapThreads(items) {
  const list = (items ?? []).map((item) => {
    // Prefer the most specific timestamp available
    const ts =
      item.last?.created_at ||
      item.last_message_at  ||
      item.created_at       ||
      null;

    return {
      id:          item.id,
      name:        item.other?.display_name || "User",
      avatar:      item.other?.avatar_url   || FALLBACK_AVATAR,
      lastMessage: item.last
        ? {
            text: item.last.text || "",
            // Guard against null ts before passing to formatter
            time: ts ? formatChatListTime(ts, { hour12: true }) : "",
          }
        : null,
      unreadCount: item.unreadCount || 0,
      blurred:     item.last?.blurred || item.blurred || false,
      // Keep raw ts for sorting; null sorts to the bottom
      updatedAt:   ts,
    };
  });

  // Newest first; items with no timestamp sink to the bottom
  list.sort((a, b) => {
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return list;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Messages() {
  const nav = useNavigate();

  // Full (unfiltered) thread list — source of truth for search
  const [all, setAll] = useState([]);
  // Currently displayed threads (may be a filtered subset of `all`)
  const [threads, setThreads] = useState([]);
  // True only during the very first foreground load (no cached data yet)
  const [loading, setLoading] = useState(true);
  // Non-null once auth is resolved
  const [meId, setMeId] = useState(null);
  // Exposed to UI so the initial load failure isn't silently swallowed
  const [error, setError] = useState(null);

  // Ref for the active fetch — lets us cancel in-flight requests on remount
  // or when a newer request supersedes the current one
  const abortRef = useRef(null);

  // ── Core fetch ───────────────────────────────────────────────────────────

  /**
   * Fetch the thread list from the API.
   *
   * @param {{ foreground?: boolean, uid?: string }} opts
   *   foreground — show the full-page loading spinner and surface errors
   *   uid        — use this user-id for cache writes (avoids stale-closure
   *                issues when called before `meId` state has settled)
   */
  const refresh = useCallback(
    async ({ foreground = false, uid } = {}) => {
      // Cancel any in-flight request before starting a new one
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (foreground) {
        setLoading(true);
        setError(null);
      }

      try {
        const raw = await withTimeoutAndAbort(
          // Pass signal + timeout so the service layer can also cancel early
          chatService.list({ signal: ac.signal, timeoutMs: REQUEST_TIMEOUT_MS }),
          ac,
          REQUEST_TIMEOUT_MS
        );

        // Discard result if this request was superseded or component unmounted
        if (ac.signal.aborted) return;

        const list = mapThreads(raw);

        setAll(list);
        setThreads(list);

        // Persist to cache using the uid we were given (or the current state)
        const cacheKey = uid ?? meId;
        if (cacheKey) ChatCache.saveThreads(cacheKey, list);
      } catch (err) {
        // Ignore errors from aborted / superseded requests
        if (ac.signal.aborted) return;

        if (foreground) {
          // Surface the error on the initial load so the user knows something
          // went wrong. Background refreshes fail silently to avoid disrupting
          // an active session.
          setError(err?.message || "Failed to load messages.");
        } else {
          // Background failure — keep whatever data is already on screen
          console.warn("[Messages] background refresh failed:", err?.message ?? err);
        }
      } finally {
        // Only clear the foreground loading spinner for this specific request
        if (!ac.signal.aborted && foreground) {
          setLoading(false);
        }
      }
    },
    // meId is intentionally omitted from deps — we pass `uid` explicitly
    // from the init effect to avoid stale closure issues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Initialisation ───────────────────────────────────────────────────────

  useEffect(() => {
    // Local flag to guard against state updates after cleanup
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (authError) throw authError;

        const uid = user?.id ?? "me";
        setMeId(uid);

        // Show cached data immediately so the UI isn't blank
        const cached = ChatCache.loadThreads(uid);
        if (cached?.length) {
          setAll(cached);
          setThreads(cached);
          setLoading(false);
          // Refresh silently in the background — user already sees data
          refresh({ foreground: false, uid });
        } else {
          // No cache — show the loading spinner until the first fetch lands
          refresh({ foreground: true, uid });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[Messages] init error:", err?.message ?? err);
        setError("Could not authenticate. Please try again.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Abort the active request so it doesn't update unmounted state
      abortRef.current?.abort();
    };
  }, [refresh]);

  // ── Background revalidation ───────────────────────────────────────────────

  // Revalidate on window focus / visibility restore / coming back online,
  // and on a 60-second polling interval. A cooldown prevents thundering-herd
  // when multiple events fire simultaneously (e.g. tab switch + network up).
  useRevalidate({
    refetch:      () => refresh({ foreground: false }),
    intervalMs:   REVALIDATE_INTERVAL_MS,
    onFocus:      true,
    onVisibility: true,
    onOnline:     true,
    cooldownMs:   REVALIDATE_COOLDOWN_MS,
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  /**
   * "Favorites" — currently the 8 most-recent threads.
   * NOTE: This is recency-based, not a true user-curated favorites list.
   * When a real favorites API is available, replace `all.slice` with a
   * filtered list based on a `isFavorite` flag.
   */
  const favorites = useMemo(
    () =>
      all.slice(0, FAVORITES_COUNT).map((t) => ({
        id:     t.id,
        name:   t.name,
        avatar: t.avatar,
        thread: t,
        online: false, // TODO: wire up presence/online status
      })),
    [all]
  );

  // ── Callbacks (stable refs — avoid unnecessary MessagesList re-renders) ───

  const openThread = useCallback(
    (t) => nav(`/chat/${t.id}`),
    [nav]
  );

  const onSearch = useCallback(
    (q) => {
      const s = (q ?? "").trim().toLowerCase();
      if (!s) {
        // Restore the full list when the query is cleared
        setThreads(all);
        return;
      }
      setThreads(
        all.filter(
          (t) =>
            t.name.toLowerCase().includes(s) ||
            (t.lastMessage?.text ?? "").toLowerCase().includes(s)
        )
      );
    },
    [all]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // Full-page spinner on the very first load (no cached data available)
  if (loading && !threads.length) {
    return (
      <div className="grid min-h-dvh place-items-center text-gray-600">
        Loading…
      </div>
    );
  }

  // Surface auth / network errors on the initial load
  if (error && !threads.length) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="mb-4 text-gray-700">{error}</p>
          <button
            onClick={() => refresh({ foreground: true, uid: meId })}
            className="rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <MessagesList
      threads={threads}
      favorites={favorites}
      onOpenThread={openThread}
      onSearch={onSearch}
    />
  );
}