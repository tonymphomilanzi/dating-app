// src/pages/Feeds.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import FeedShareSheet from "../components/FeedShareSheet";

/* ================================================================
   CONSTANTS
   ================================================================ */
const PAGE_SIZE = 10;
const MAX_COMMENT_LEN = 1000;
const COMMENT_PAGE = 20;

const COMMENT_SELECT = `
  id, feed_id, parent_id, body, likes_count, created_at,
  user:feed_comments_user_id_fkey(id, display_name, avatar_url)
`;

/* ================================================================
   HELPERS
   ================================================================ */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ================================================================
   HOOK — useFeeds
   ================================================================ */
function useFeeds(userId) {
  const [feeds, setFeeds] = useState([]);
  const [myLikes, setMyLikes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const offsetRef = useRef(0);
  const isMounted = useRef(true);
  const userIdRef = useRef(userId); // stable ref so callbacks don't go stale

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchLikes = useCallback(async (ids) => {
    const uid = userIdRef.current;
    if (!uid || !ids.length) return;
    try {
      const { data: liked } = await supabase
        .from("feed_likes")
        .select("feed_id")
        .eq("user_id", uid)
        .in("feed_id", ids);
      if (isMounted.current && liked) {
        setMyLikes((prev) => {
          const next = new Set(prev);
          liked.forEach((l) => next.add(l.feed_id));
          return next;
        });
      }
    } catch (e) {
      console.warn("fetchLikes:", e.message);
    }
  }, []); // no deps — uses refs

  const load = useCallback(
    async (replace = false) => {
      if (replace) {
        offsetRef.current = 0;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError("");

      try {
        const from = offsetRef.current;
        const to = from + PAGE_SIZE - 1;

        const { data, error: err } = await supabase
          .from("feeds")
          .select(
            `id, title, content, image_url, tags, pinned,
             views_count, likes_count, comments_count, shares_count,
             created_at, updated_at,
             admin:admin_users(id, username, display_name, avatar_url)`
          )
          .eq("published", true)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (err) throw err;
        if (!isMounted.current) return;

        const rows = data ?? [];
        setFeeds((prev) => (replace ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
        offsetRef.current = from + rows.length;

        if (rows.length > 0) {
          await fetchLikes(rows.map((r) => r.id));
        }
      } catch (e) {
        if (isMounted.current) setError(e.message || "Failed to load feeds");
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchLikes]
  );

  // Initial load
  useEffect(() => {
    load(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription — set up once
  useEffect(() => {
    const channel = supabase
      .channel("feeds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feeds" },
        (payload) => {
          if (!isMounted.current) return;
          if (payload.eventType === "INSERT" && payload.new.published) {
            setFeeds((prev) =>
              prev.some((f) => f.id === payload.new.id)
                ? prev
                : [payload.new, ...prev]
            );
          } else if (payload.eventType === "UPDATE") {
            setFeeds((prev) =>
              prev.map((f) =>
                f.id === payload.new.id ? { ...f, ...payload.new } : f
              )
            );
          } else if (payload.eventType === "DELETE") {
            setFeeds((prev) => prev.filter((f) => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleLike = useCallback(async (feedId) => {
    const uid = userIdRef.current;
    if (!uid) return;

    const isLiked = myLikes.has(feedId);

    // Optimistic update
    setMyLikes((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(feedId) : next.add(feedId);
      return next;
    });
    setFeeds((prev) =>
      prev.map((f) =>
        f.id === feedId
          ? {
              ...f,
              likes_count: Math.max(0, (f.likes_count || 0) + (isLiked ? -1 : 1)),
            }
          : f
      )
    );

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("feed_likes")
          .delete()
          .eq("feed_id", feedId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("feed_likes")
          .insert({ feed_id: feedId, user_id: uid });
        if (error && error.code !== "23505") throw error;
      }
    } catch (e) {
      console.error("toggleLike:", e.message);
      // Revert
      setMyLikes((prev) => {
        const next = new Set(prev);
        isLiked ? next.add(feedId) : next.delete(feedId);
        return next;
      });
      setFeeds((prev) =>
        prev.map((f) =>
          f.id === feedId
            ? {
                ...f,
                likes_count: Math.max(
                  0,
                  (f.likes_count || 0) + (isLiked ? 1 : -1)
                ),
              }
            : f
        )
      );
    }
  }, [myLikes]); // myLikes needed to read current state

  const recordView = useCallback(async (feedId) => {
    try {
      await supabase.rpc("increment_feed_view", { p_feed_id: feedId });
    } catch (e) {
      console.warn("recordView:", e.message);
    }
  }, []);

  return {
    feeds,
    myLikes,
    loading,
    loadingMore,
    hasMore,
    error,
    load,
    toggleLike,
    recordView,
  };
}

/* ================================================================
   HOOK — useComments
   ================================================================ */
function useComments(feedId, open) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [myLikes, setMyLikes] = useState(new Set());

  const isMounted = useRef(true);
  const { user } = useAuth();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset when feedId changes
  useEffect(() => {
    setComments([]);
    setSubmitError("");
    setMyLikes(new Set());
  }, [feedId]);

  const fetchComments = useCallback(async () => {
    if (!feedId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feed_comments")
        .select(COMMENT_SELECT)
        .eq("feed_id", feedId)
        .order("created_at", { ascending: true })
        .limit(COMMENT_PAGE);

      if (error) throw error;
      if (!isMounted.current) return;

      const list = data ?? [];
      setComments(list);

      if (user?.id && list.length > 0) {
        const ids = list.map((c) => c.id);
        const { data: liked } = await supabase
          .from("feed_comment_likes")
          .select("comment_id")
          .eq("user_id", user.id)
          .in("comment_id", ids);
        if (isMounted.current && liked) {
          setMyLikes(new Set(liked.map((l) => l.comment_id)));
        }
      }
    } catch (e) {
      console.error("fetchComments:", e.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [feedId, user?.id]);

  // Fetch + subscribe when sheet opens
  useEffect(() => {
    if (!open || !feedId) return;

    fetchComments();

    const channel = supabase
      .channel(`comments-${feedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feed_comments",
          filter: `feed_id=eq.${feedId}`,
        },
        async (payload) => {
          if (!isMounted.current) return;
          // Fetch full row with joined user
          const { data } = await supabase
            .from("feed_comments")
            .select(COMMENT_SELECT)
            .eq("id", payload.new.id)
            .single();
          if (data && isMounted.current) {
            setComments((prev) =>
              prev.some((c) => c.id === data.id) ? prev : [...prev, data]
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feed_comments",
          filter: `feed_id=eq.${feedId}`,
        },
        (payload) => {
          if (!isMounted.current) return;
          setComments((prev) =>
            prev.map((c) =>
              c.id === payload.new.id ? { ...c, ...payload.new } : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "feed_comments",
          filter: `feed_id=eq.${feedId}`,
        },
        (payload) => {
          if (!isMounted.current) return;
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, feedId, fetchComments]);

  const submitComment = useCallback(
    async (body, parentId = null) => {
      if (!user?.id || !feedId || !body.trim()) return false;
      setSubmitting(true);
      setSubmitError("");

      const tempId = `temp-${Date.now()}`;
      const tempComment = {
        id: tempId,
        feed_id: feedId,
        parent_id: parentId,
        body: body.trim(),
        likes_count: 0,
        created_at: new Date().toISOString(),
        user: {
          id: user.id,
          display_name:
            user.user_metadata?.display_name ||
            user.email?.split("@")[0] ||
            "You",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      };
      setComments((prev) => [...prev, tempComment]);

      try {
        const { data, error } = await supabase
          .from("feed_comments")
          .insert({
            feed_id: feedId,
            user_id: user.id,
            parent_id: parentId ?? null,
            body: body.trim(),
          })
          .select(COMMENT_SELECT)
          .single();

        if (error) throw error;

        if (isMounted.current && data) {
          setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
        }
        return true;
      } catch (e) {
        console.error("submitComment:", e.message);
        if (isMounted.current) {
          setComments((prev) => prev.filter((c) => c.id !== tempId));
          setSubmitError(e.message || "Failed to post comment");
        }
        return false;
      } finally {
        if (isMounted.current) setSubmitting(false);
      }
    },
    [user, feedId]
  );

  const toggleCommentLike = useCallback(
    async (commentId) => {
      if (!user?.id) return;
      const isLiked = myLikes.has(commentId);

      setMyLikes((prev) => {
        const next = new Set(prev);
        isLiked ? next.delete(commentId) : next.add(commentId);
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likes_count: Math.max(
                  0,
                  (c.likes_count || 0) + (isLiked ? -1 : 1)
                ),
              }
            : c
        )
      );

      try {
        if (isLiked) {
          const { error } = await supabase
            .from("feed_comment_likes")
            .delete()
            .eq("comment_id", commentId)
            .eq("user_id", user.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("feed_comment_likes")
            .insert({ comment_id: commentId, user_id: user.id });
          if (error && error.code !== "23505") throw error;
        }
      } catch (e) {
        console.error("toggleCommentLike:", e.message);
        // Revert
        setMyLikes((prev) => {
          const next = new Set(prev);
          isLiked ? next.add(commentId) : next.delete(commentId);
          return next;
        });
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likes_count: Math.max(
                    0,
                    (c.likes_count || 0) + (isLiked ? 1 : -1)
                  ),
                }
              : c
          )
        );
      }
    },
    [user?.id, myLikes]
  );

  const deleteComment = useCallback(
    async (commentId) => {
      if (!user?.id) return;
      // Optimistic removal
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      const { error } = await supabase
        .from("feed_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);
      if (error) {
        console.error("deleteComment:", error.message);
        fetchComments(); // reconcile
      }
    },
    [user?.id, fetchComments]
  );

  const threaded = useMemo(() => {
    const top = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);
    return top.map((c) => ({
      ...c,
      replies: replies.filter((r) => r.parent_id === c.id),
    }));
  }, [comments]);

  return {
    threaded,
    loading,
    submitting,
    submitError,
    myLikes,
    submitComment,
    toggleCommentLike,
    deleteComment,
  };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function Feeds() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    feeds,
    myLikes: likedPosts,
    loading,
    loadingMore,
    hasMore,
    error,
    load,
    toggleLike,
    recordView,
  } = useFeeds(user?.id);

  const [activeCommentFeed, setActiveCommentFeed] = useState(null);
  const [activeShareFeed, setActiveShareFeed] = useState(null);
  const [toast, setToast] = useState(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleShare = useCallback((feed) => {
    setActiveShareFeed(feed);
  }, []);

  const handleShareLog = useCallback(
    async (feed) => {
      if (!user?.id || !feed) return;
      try {
        await supabase
          .from("feed_shares")
          .insert({ feed_id: feed.id, user_id: user.id });
      } catch (e) {
        console.warn("share log:", e.message);
      }
    },
    [user?.id]
  );

  // Navigate to feed detail
const handleCardClick = useCallback(
  (feedId) => {
    navigate(`/FeedPostDetail/${feedId}`);
  },
  [navigate]
);
  /* Infinite scroll */
  const loaderRef = useRef(null);
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) load();
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, load]);

  return (
    <div className="min-h-dvh bg-gray-50 pb-28 antialiased">
      <Toast toast={toast} />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/discover")}
            aria-label="Go back to Discover"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-600 transition-colors active:scale-95"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900">Feed</h1>
            <p className="text-xs text-gray-400 mt-0.5">Latest from the team</p>
          </div>

          <span className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[11px] font-bold text-green-700">Live</span>
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        {loading && feeds.length === 0 && <FeedSkeleton />}

        {error && (
          <div className="rounded-3xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
            <AlertIcon className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button
              onClick={() => load(true)}
              className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && feeds.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
              <NewsIcon className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-bold text-gray-700">No posts yet</p>
            <p className="text-sm text-gray-400">Check back soon for updates.</p>
          </div>
        )}

        {feeds.map((feed) => (
          <FeedCard
            key={feed.id}
            feed={feed}
            liked={likedPosts.has(feed.id)}
            userId={user?.id}
            onLike={(e) => {
              e.stopPropagation();
              toggleLike(feed.id);
            }}
            onComment={(e) => {
              e.stopPropagation();
              setActiveCommentFeed(feed);
            }}
            onShare={(e) => {
              e.stopPropagation();
              handleShare(feed);
            }}
            onView={() => recordView(feed.id)}
            onClick={() => handleCardClick(feed.id)}
          />
        ))}

        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-4">
            {loadingMore && <SpinnerIcon className="h-6 w-6 text-violet-500" />}
          </div>
        )}

        {!hasMore && feeds.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-4">
            You're all caught up ✓
          </p>
        )}
      </div>

      {/* Comment sheet */}
      <CommentSheet
        feed={activeCommentFeed}
        userId={user?.id}
        onClose={() => setActiveCommentFeed(null)}
        onRequireAuth={() => navigate("/auth")}
      />

      {/* Share sheet */}
      {activeShareFeed && (
        <FeedShareSheet
          feed={activeShareFeed}
          onClose={() => setActiveShareFeed(null)}
          onShare={() => handleShareLog(activeShareFeed)}
        />
      )}
    </div>
  );
}

/* ================================================================
   FEED CARD
   ================================================================ */
function FeedCard({ feed, liked, userId, onLike, onComment, onShare, onView, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const viewedRef = useRef(false);

  // View tracking via IntersectionObserver
  useEffect(() => {
    viewedRef.current = false; // reset if feed changes
  }, [feed.id]);

  useEffect(() => {
    const el = document.getElementById(`feed-${feed.id}`);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          onView();
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [feed.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const admin = feed.admin;
  const adminName = admin?.display_name || admin?.username || "Admin";
  const isLong = (feed.content || "").length > 280;
  const displayed =
    isLong && !expanded
      ? feed.content.slice(0, 280) + "…"
      : feed.content || "";

  return (
    <article
      id={`feed-${feed.id}`}
      onClick={onClick}
      className="group rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer"
    >
      {/* Cover image */}
      {feed.image_url && !imgError && (
        <div
          className="relative w-full bg-gray-100 overflow-hidden"
          style={{ maxHeight: 480 }}
        >
          <img
            src={feed.image_url}
            alt={feed.title}
            className="w-full object-cover"
            style={{ maxHeight: 480 }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
          {feed.pinned && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 shadow-lg">
              <PinIcon className="h-3 w-3 text-white" />
              <span className="text-[11px] font-bold text-white">Pinned</span>
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          {admin?.avatar_url ? (
            <img
              src={admin.avatar_url}
              alt={adminName}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-violet-100"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white">
              {adminName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-gray-900">
                {adminName}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                <ShieldIcon className="h-2.5 w-2.5" /> Admin
              </span>
            </div>
            <p className="text-xs text-gray-400">{timeAgo(feed.created_at)}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <EyeIcon className="h-3.5 w-3.5" />
            {fmtCount(feed.views_count)}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-extrabold text-gray-900 leading-snug mb-2">
          {feed.title}
        </h2>

        {/* Content */}
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {displayed}
        </p>
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mt-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}

        {/* Tags */}
        {feed.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {feed.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="my-4 h-px bg-gray-100" />

        {/* Counts */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
          <span>{fmtCount(feed.likes_count)} likes</span>
          <span>{fmtCount(feed.comments_count)} comments</span>
          <span>{fmtCount(feed.shares_count)} shares</span>
        </div>

        {/* Action buttons — stopPropagation so card click doesn't fire */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onLike}
            aria-label={liked ? "Unlike" : "Like"}
            className={[
              "flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition-all active:scale-95",
              liked
                ? "bg-red-50 text-red-500 border border-red-200"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200",
            ].join(" ")}
          >
            <HeartIcon className="h-4 w-4" filled={liked} />
            <span className="hidden sm:inline">{liked ? "Liked" : "Like"}</span>
          </button>

          <button
            onClick={onComment}
            aria-label="Comment"
            className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all active:scale-95"
          >
            <CommentIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Comment</span>
          </button>

          <button
            onClick={onShare}
            aria-label="Share"
            className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all active:scale-95"
          >
            <ShareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/* ================================================================
   COMMENT SHEET
   ================================================================ */
function CommentSheet({ feed, userId, onClose, onRequireAuth }) {
  const {
    threaded,
    loading,
    submitting,
    submitError,
    myLikes,
    submitComment,
    toggleCommentLike,
    deleteComment,
  } = useComments(feed?.id, !!feed);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset form when sheet opens for a different feed
  useEffect(() => {
    if (feed) {
      setBody("");
      setReplyTo(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [feed?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (!body.trim()) return;

    const ok = await submitComment(body, replyTo?.id ?? null);
    if (ok) {
      setBody("");
      setReplyTo(null);
      setTimeout(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 150);
    }
  };

  if (!feed) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] flex flex-col bg-white rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-2xl">

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-gray-300" />
          <div className="flex items-center gap-3">
            <CommentIcon className="h-5 w-5 text-violet-600" />
            <div>
              <p className="text-sm font-extrabold text-gray-900">Comments</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">
                {feed.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Comments list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        >
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded-full bg-gray-200" />
                    <div className="h-3 w-full rounded-full bg-gray-200" />
                    <div className="h-3 w-2/3 rounded-full bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && threaded.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CommentIcon className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold text-gray-500">No comments yet</p>
              <p className="text-xs text-gray-400">
                Be the first to share your thoughts!
              </p>
            </div>
          )}

          {threaded.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              userId={userId}
              myLikes={myLikes}
              onLike={toggleCommentLike}
              onDelete={deleteComment}
              onReply={(id, name) => {
                setReplyTo({ id, name });
                inputRef.current?.focus();
              }}
            />
          ))}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {submitError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-2">
              <AlertIcon className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-medium">{submitError}</p>
            </div>
          )}
          {replyTo && (
            <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 mb-2">
              <p className="text-xs text-violet-700 font-medium">
                Replying to{" "}
                <span className="font-bold">{replyTo.name}</span>
              </p>
              <button
                onClick={() => setReplyTo(null)}
                className="text-violet-400 hover:text-violet-600"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={body}
                onChange={(e) =>
                  setBody(e.target.value.slice(0, MAX_COMMENT_LEN))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  userId ? "Write a comment…" : "Sign in to comment"
                }
                disabled={!userId || submitting}
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50"
                style={{ maxHeight: 120, overflowY: "auto" }}
              />
              <p className="absolute right-3 bottom-3 text-[10px] text-gray-400">
                {body.length}/{MAX_COMMENT_LEN}
              </p>
            </div>
            <button
              type="submit"
              disabled={!body.trim() || submitting || !userId}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md"
            >
              {submitting ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   COMMENT THREAD + ROW
   ================================================================ */
function CommentThread({ comment, userId, myLikes, onLike, onDelete, onReply }) {
  const [showReplies, setShowReplies] = useState(true);

  return (
    <div>
      <CommentRow
        comment={comment}
        userId={userId}
        liked={myLikes.has(comment.id)}
        onLike={() => onLike(comment.id)}
        onDelete={() => onDelete(comment.id)}
        onReply={onReply}
        isTop
      />
      {comment.replies?.length > 0 && (
        <div className="ml-10 mt-2 space-y-2">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
          >
            {showReplies
              ? "Hide replies"
              : `View ${comment.replies.length} repl${
                  comment.replies.length !== 1 ? "ies" : "y"
                }`}
          </button>
          {showReplies &&
            comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                userId={userId}
                liked={myLikes.has(reply.id)}
                onLike={() => onLike(reply.id)}
                onDelete={() => onDelete(reply.id)}
                onReply={onReply}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  userId,
  liked,
  onLike,
  onDelete,
  onReply,
  isTop = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const author = comment.user;
  const authorName = author?.display_name || "User";
  const isOwn = !!(userId && userId === author?.id);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="flex gap-2.5">
      {author?.avatar_url ? (
        <img
          src={author.avatar_url}
          alt={authorName}
          className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 mt-0.5 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-xs font-bold text-white">
          {authorName.slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-full rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
          <p className="text-xs font-extrabold text-gray-900 mb-0.5">
            {authorName}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed break-words">
            {comment.body}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-[11px] text-gray-400">
            {timeAgo(comment.created_at)}
          </span>

          <button
            onClick={onLike}
            className={`text-[11px] font-bold transition-colors ${
              liked
                ? "text-red-500"
                : "text-gray-400 hover:text-red-500"
            }`}
          >
            {liked ? "Liked" : "Like"}
            {comment.likes_count > 0 && ` · ${fmtCount(comment.likes_count)}`}
          </button>

          {isTop && (
            <button
              onClick={() => onReply(comment.id, authorName)}
              className="text-[11px] font-bold text-gray-400 hover:text-violet-600 transition-colors"
            >
              Reply
            </button>
          )}

          {isOwn && (
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <DotsIcon className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-6 rounded-2xl bg-white border border-gray-100 shadow-xl py-1 z-10 min-w-[120px]">
                  <button
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <TrashIcon className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */
function FeedSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-3xl bg-white border border-gray-100 overflow-hidden animate-pulse"
        >
          <div className="h-56 bg-gray-200" />
          <div className="p-5 space-y-3">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-1/3 rounded-full bg-gray-200" />
                <div className="h-3 w-1/4 rounded-full bg-gray-200" />
              </div>
            </div>
            <div className="h-5 w-3/4 rounded-full bg-gray-200" />
            <div className="h-3.5 w-full rounded-full bg-gray-200" />
            <div className="h-3.5 w-5/6 rounded-full bg-gray-200" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="h-10 rounded-2xl bg-gray-100" />
              <div className="h-10 rounded-2xl bg-gray-100" />
              <div className="h-10 rounded-2xl bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   TOAST
   ================================================================ */
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 pointer-events-none">
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border text-sm font-semibold ${
          isErr
            ? "bg-red-500 border-red-400 text-white"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        {isErr ? (
          <AlertIcon className="h-4 w-4 shrink-0" />
        ) : (
          <CheckIcon className="h-4 w-4 shrink-0 text-green-500" />
        )}
        {toast.message}
      </div>
    </div>
  );
}

/* ================================================================
   ICONS
   ================================================================ */
function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function HeartIcon({ className = "h-5 w-5", filled = false }) {
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function CommentIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function ShareIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function EyeIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function PinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 6.5L22 10l-5 5 1.5 7L12 19l-6.5 3L7 15 2 10l7-1.5L12 2z" />
    </svg>
  );
}
function ShieldIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function AlertIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function CheckIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function XIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function SendIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}
function NewsIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
    </svg>
  );
}
function DotsIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}