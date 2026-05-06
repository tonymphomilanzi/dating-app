// src/pages/Messages.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import MessagesList from "../components/MessagesList.jsx";
import { chatService } from "../services/chat.service.js";
import { formatChatListTime } from "../utils/time.js";
import { supabase } from "../lib/supabase.client.js";

/* ================================================================
   CONSTANTS
   ================================================================ */
const FAVORITES_COUNT  = 8;
const FALLBACK_AVATAR  = "https://picsum.photos/80";

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Normalise raw API thread items into the shape MessagesList expects.
 * Sorted newest-first by last activity.
 */
function mapThreads(items) {
  const list = (items ?? []).map((item) => {
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
            time: ts ? formatChatListTime(ts, { hour12: true }) : "",
          }
        : null,
      unreadCount: item.unreadCount || 0,
      blurred:     item.last?.blurred || item.blurred || false,
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

/* ================================================================
   COMPONENT
   ================================================================ */
export default function Messages() {
  const nav = useNavigate();

  // Source of truth — full unfiltered list
  const [all,     setAll]     = useState([]);
  // What the list actually renders (may be a search-filtered subset)
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ──────────────────────────────────────────────────────────────
     FETCH — plain async function, no abort controller,
     no caching, no revalidation hook.
     Keeping it simple is what lets navigation work instantly.
  ────────────────────────────────────────────────────────────── */
  async function load(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
      setError(null);
    }
    try {
      // Resolve current user first so we know who we're fetching for
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) throw authErr;
      if (!user)   throw new Error("Not authenticated");

      const raw  = await chatService.list();
      const list = mapThreads(raw);

      setAll(list);
      setThreads(list);
    } catch (err) {
      console.error("[Messages] load:", err?.message ?? err);
      setError(err?.message || "Failed to load messages.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  /* ──────────────────────────────────────────────────────────────
     EFFECTS
  ────────────────────────────────────────────────────────────── */

  // Initial load on mount
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when tab regains visibility (silent — no spinner)
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") {
        load(false);
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ──────────────────────────────────────────────────────────────
     DERIVED STATE
  ────────────────────────────────────────────────────────────── */

  // "Favorites" — 8 most-recent threads
  // Replace with a real favorites filter when the API supports it
  const favorites = useMemo(
    () =>
      all.slice(0, FAVORITES_COUNT).map((t) => ({
        id:     t.id,
        name:   t.name,
        avatar: t.avatar,
        thread: t,
        online: false, // TODO: wire up presence
      })),
    [all]
  );

  /* ──────────────────────────────────────────────────────────────
     HANDLERS
  ────────────────────────────────────────────────────────────── */
  const openThread = useCallback(
    (t) => nav(`/chat/${t.id}`),
    [nav]
  );

  const onSearch = useCallback(
    (q) => {
      const s = (q ?? "").trim().toLowerCase();
      if (!s) {
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

  /* ──────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────── */

  // Full-page spinner only on first load with no data
  if (loading && !threads.length) {
    return (
      <div className="grid min-h-dvh place-items-center text-gray-600">
        Loading…
      </div>
    );
  }

  // Surface errors only when there's nothing to show
  if (error && !threads.length) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="mb-4 text-gray-700">{error}</p>
          <button
            onClick={() => load()}
            className="rounded-full border border-gray-200 bg-white px-6 py-2.5
                       text-sm font-medium text-gray-700 hover:bg-gray-50"
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