import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MessagesList from "../components/MessagesList.jsx";
import { chatService } from "../services/chat.service.js";
import { formatChatListTime } from "../utils/time.js";
import { supabase } from "../lib/supabase.client.js";
import { ChatCache } from "../lib/cache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";

export default function Messages() {
  const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState(null);

  // Abort/race control
  const abortRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastRefetchTsRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Helper: timeout + abort wrapper (since supabase-js doesn't accept AbortSignal)
  const withTimeoutAndAbort = (promise, ac, ms, label = "timeout") => {
    return Promise.race([
      promise,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`${label}:${ms}`)), ms)
      ),
      new Promise((_, rej) =>
        ac?.signal?.addEventListener("abort", () => rej(new Error("aborted")), { once: true })
      ),
    ]);
  };

  const mapThreads = (items) => {
    const list = (items || []).map((i) => {
      const ts = i.last?.created_at || i.last_message_at || i.created_at;
      return {
        id: i.id,
        name: i.other?.display_name || "User",
        avatar: i.other?.avatar_url || "https://picsum.photos/80",
        lastMessage: i.last
          ? { text: i.last.text || "", time: formatChatListTime(ts, { hour12: true }) }
          : null,
        unreadCount: i.unreadCount || 0,
        blurred: i.last?.blurred || i.blurred || false,
        updatedAt: ts,
      };
    });
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return list;
  };

  const refresh = useCallback(
    async ({ foreground = false } = {}) => {
      // cancel previous in-flight request
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (foreground) setLoading(true);

      try {
        // If your chatService.list accepts opts, you can pass { signal: ac.signal, timeoutMs: 10000 }
        // Otherwise we wrap it with a hard timeout + abort race:
        const items = await chatService.list({ signal: ac.signal, timeoutMs: 10000 });
        if (!isMountedRef.current || ac.signal.aborted) return;

        const list = mapThreads(items);
        setThreads(list);
        setAll(list);
        if (meId) ChatCache.saveThreads(meId, list);
      } catch (e) {
        if (!isMountedRef.current || ac.signal.aborted) return;
        // Fail soft: keep current/cached threads; optionally log
        // console.warn("[Messages] refresh error:", e.message || e);
      } finally {
        if (isMountedRef.current && !ac.signal.aborted && foreground) {
          setLoading(false);
        }
      }
    },
    [meId]
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancel) return;
      const uid = user?.id || "me";
      setMeId(uid);

      // show cached immediately
      const cached = ChatCache.loadThreads(uid);
      if (cached.length) {
        setThreads(cached);
        setAll(cached);
        setLoading(false);
      }
      // refresh in background (or foreground if no cache)
      refresh({ foreground: !cached.length });
    })();
    return () => {
      cancel = true;
    };
  }, [refresh]);

  // Revalidate on focus/online/visibility + every 60s, with cooldown
  useRevalidate({
    refetch: () => refresh({ foreground: false }),
    intervalMs: 60000,
    onFocus: true,
    onVisibility: true,
    onOnline: true,
    cooldownMs: 2000,
  });

  const favorites = useMemo(
    () =>
      all.slice(0, 8).map((t) => ({
        id: t.id,
        name: t.name,
        avatar: t.avatar,
        thread: t,
        online: false,
      })),
    [all]
  );

  const openThread = (t) => nav(`/chat/${t.id}`);

  const onSearch = (q) => {
    const s = (q || "").trim().toLowerCase();
    if (!s) {
      setThreads(all);
      return;
    }
    setThreads(
      all.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(s) ||
          (t.lastMessage?.text || "").toLowerCase().includes(s)
      )
    );
  };

  if (loading && !threads.length) {
    return <div className="grid min-h-dvh place-items-center text-gray-600">Loading…</div>;
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