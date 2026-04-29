// src/pages/Feeds.jsx
import React, {
  useCallback, useEffect, useRef, useState, useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import FeedShareSheet from "../components/FeedShareSheet";

/* ================================================================
   CONSTANTS
   ================================================================ */
const PAGE_SIZE       = 10;
const MAX_COMMENT_LEN = 1000;
const COMMENT_PAGE    = 20;
const PREVIEW_LEN     = 180;

/* ================================================================
   HELPERS
   ================================================================ */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { day:"numeric", month:"short", year:"numeric" });
}
function fmtCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

/* ================================================================
   HOOK — useFeeds
   ================================================================ */
function useFeeds(userId) {
  const [feeds,       setFeeds]       = useState([]);
  const [myLikes,     setMyLikes]     = useState(new Set());
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState("");

  const offsetRef  = useRef(0);
  const mountedRef = useRef(true);
  const rtRef      = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (replace = false) => {
    if (replace) { offsetRef.current = 0; setLoading(true); }
    else setLoadingMore(true);
    setError("");
    try {
      const from = offsetRef.current;
      const to   = from + PAGE_SIZE - 1;
      const { data, error: err } = await supabase
        .from("feeds")
        .select(`
          id, title, content, image_url, tags, pinned,
          views_count, likes_count, comments_count, shares_count,
          created_at, updated_at,
          admin:admin_users(id, username, display_name, avatar_url)
        `)
        .eq("published", true)
        .order("pinned",     { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (err) throw err;
      if (!mountedRef.current) return;
      const rows = data ?? [];
      setFeeds((prev) => replace ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = from + rows.length;

      if (userId && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: liked } = await supabase
          .from("feed_likes").select("feed_id")
          .eq("user_id", userId).in("feed_id", ids);
        if (mountedRef.current && liked) {
          setMyLikes((prev) => {
            const next = new Set(prev);
            liked.forEach((l) => next.add(l.feed_id));
            return next;
          });
        }
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message || "Failed to load feeds");
    } finally {
      if (mountedRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [userId]);

  useEffect(() => { load(true); }, [load]);

  useEffect(() => {
    rtRef.current = supabase
      .channel("feeds-rt-" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "feeds" }, (payload) => {
        if (!mountedRef.current) return;
        if (payload.eventType === "INSERT" && payload.new.published) {
          setFeeds((prev) => prev.some((f) => f.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setFeeds((prev) => prev.map((f) => f.id === payload.new.id ? { ...f, ...payload.new } : f));
        } else if (payload.eventType === "DELETE") {
          setFeeds((prev) => prev.filter((f) => f.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(rtRef.current); };
  }, []);

  const toggleLike = useCallback(async (feedId) => {
    if (!userId) return;
    const isLiked = myLikes.has(feedId);
    setMyLikes((prev) => { const n = new Set(prev); isLiked ? n.delete(feedId) : n.add(feedId); return n; });
    setFeeds((prev) => prev.map((f) =>
      f.id === feedId ? { ...f, likes_count: Math.max(0, (f.likes_count||0) + (isLiked ? -1 : 1)) } : f
    ));
    try {
      if (isLiked) {
        const { error } = await supabase.from("feed_likes").delete().eq("feed_id", feedId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_likes").insert({ feed_id: feedId, user_id: userId });
        if (error && error.code !== "23505") throw error;
      }
    } catch (e) {
      console.error("toggleLike:", e.message);
      setMyLikes((prev) => { const n = new Set(prev); isLiked ? n.add(feedId) : n.delete(feedId); return n; });
      setFeeds((prev) => prev.map((f) =>
        f.id === feedId ? { ...f, likes_count: Math.max(0, (f.likes_count||0) + (isLiked ? 1 : -1)) } : f
      ));
    }
  }, [userId, myLikes]);

  const recordView = useCallback(async (feedId) => {
    try { await supabase.rpc("increment_feed_view", { p_feed_id: feedId }); }
    catch (e) { console.warn("recordView:", e.message); }
  }, []);

  return { feeds, myLikes, loading, loadingMore, hasMore, error, load, toggleLike, recordView };
}

/* ================================================================
   HOOK — useComments
   ================================================================ */
function useComments(feedId, open) {
  const [comments,    setComments]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [myLikes,     setMyLikes]     = useState(new Set());
  const mountedRef = useRef(true);
  const rtRef      = useRef(null);
  const { user }   = useAuth();

  const COMMENT_SELECT = `
    id, feed_id, parent_id, body, likes_count, created_at,
    user:feed_comments_user_id_fkey(id, display_name, avatar_url)
  `;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { if (!feedId) { setComments([]); setSubmitError(""); } }, [feedId]);

  const fetchComments = useCallback(async () => {
    if (!feedId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feed_comments").select(COMMENT_SELECT)
        .eq("feed_id", feedId).order("created_at", { ascending: true }).limit(COMMENT_PAGE);
      if (error) throw error;
      if (!mountedRef.current) return;
      setComments(data ?? []);
      if (user?.id && data?.length) {
        const ids = data.map((c) => c.id);
        const { data: liked } = await supabase
          .from("feed_comment_likes").select("comment_id")
          .eq("user_id", user.id).in("comment_id", ids);
        if (mountedRef.current && liked) setMyLikes(new Set(liked.map((l) => l.comment_id)));
      }
    } catch (e) { console.error("fetchComments:", e.message); }
    finally { if (mountedRef.current) setLoading(false); }
  }, [feedId, user?.id]);

  useEffect(() => {
    if (!open || !feedId) return;
    fetchComments();
    rtRef.current = supabase
      .channel(`comments-${feedId}-${Date.now()}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "feed_comments", filter: `feed_id=eq.${feedId}` },
        async (payload) => {
          if (!mountedRef.current) return;
          const { data, error } = await supabase.from("feed_comments")
            .select(COMMENT_SELECT).eq("id", payload.new.id).single();
          if (error) { console.error("rt insert fetch:", error.message); return; }
          if (data && mountedRef.current)
            setComments((prev) => prev.some((c) => c.id === data.id) ? prev : [...prev, data]);
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "feed_comments", filter: `feed_id=eq.${feedId}` },
        (payload) => {
          if (!mountedRef.current) return;
          setComments((prev) => prev.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c));
        }
      )
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "feed_comments", filter: `feed_id=eq.${feedId}` },
        (payload) => {
          if (!mountedRef.current) return;
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(rtRef.current); };
  }, [open, feedId, fetchComments]);

  const submitComment = useCallback(async (body, parentId = null) => {
    if (!user?.id || !feedId || !body.trim()) return false;
    setSubmitting(true); setSubmitError("");
    const tempId = `temp-${Date.now()}`;
    setComments((prev) => [...prev, {
      id: tempId, feed_id: feedId, parent_id: parentId,
      body: body.trim(), likes_count: 0, created_at: new Date().toISOString(),
      user: { id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "You",
        avatar_url: user.user_metadata?.avatar_url || null },
    }]);
    try {
      const { data, error } = await supabase.from("feed_comments")
        .insert({ feed_id: feedId, user_id: user.id, parent_id: parentId ?? null, body: body.trim() })
        .select(COMMENT_SELECT).single();
      if (error) throw error;
      if (mountedRef.current && data)
        setComments((prev) => prev.map((c) => c.id === tempId ? data : c));
      return true;
    } catch (e) {
      console.error("submitComment:", e.message);
      if (mountedRef.current) {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setSubmitError(e.message || "Failed to post comment");
      }
      return false;
    } finally { if (mountedRef.current) setSubmitting(false); }
  }, [user, feedId]);

  const toggleCommentLike = useCallback(async (commentId) => {
    if (!user?.id) return;
    const isLiked = myLikes.has(commentId);
    setMyLikes((prev) => { const n = new Set(prev); isLiked ? n.delete(commentId) : n.add(commentId); return n; });
    setComments((prev) => prev.map((c) =>
      c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count||0) + (isLiked ? -1 : 1)) } : c
    ));
    try {
      if (isLiked) {
        const { error } = await supabase.from("feed_comment_likes").delete()
          .eq("comment_id", commentId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_comment_likes")
          .insert({ comment_id: commentId, user_id: user.id });
        if (error && error.code !== "23505") throw error;
      }
    } catch (e) {
      console.error("toggleCommentLike:", e.message);
      setMyLikes((prev) => { const n = new Set(prev); isLiked ? n.add(commentId) : n.delete(commentId); return n; });
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count||0) + (isLiked ? 1 : -1)) } : c
      ));
    }
  }, [user?.id, myLikes]);

  const deleteComment = useCallback(async (commentId) => {
    if (!user?.id) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    const { error } = await supabase.from("feed_comments").delete()
      .eq("id", commentId).eq("user_id", user.id);
    if (error) { console.error("deleteComment:", error.message); fetchComments(); }
  }, [user?.id, fetchComments]);

  const threaded = useMemo(() => {
    const top     = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) =>  c.parent_id);
    return top.map((c) => ({ ...c, replies: replies.filter((r) => r.parent_id === c.id) }));
  }, [comments]);

  return { threaded, loading, submitting, submitError, myLikes, submitComment, toggleCommentLike, deleteComment };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function Feeds() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { feeds, myLikes: likedPosts, loading, loadingMore, hasMore, error, load, toggleLike, recordView } = useFeeds(user?.id);

  const [activeCommentFeed, setActiveCommentFeed] = useState(null);
  const [activeShareFeed,   setActiveShareFeed]   = useState(null);
  const [toast,             setToast]             = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleShare = useCallback((feed) => { setActiveShareFeed(feed); }, []);
  const handleShareLog = useCallback((feed) => {
    if (!user?.id || !feed) return;
    supabase.from("feed_shares").insert({ feed_id: feed.id, user_id: user.id })
      .then(({ error }) => { if (error) console.warn("share log:", error.message); });
  }, [user?.id]);

  const loaderRef = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore) load(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, load]);

  return (
    <div className="min-h-dvh bg-[#f0f0f5] pb-28 antialiased">
      <Toast toast={toast} />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-xl px-4 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Feed</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Latest from the team</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-emerald-700">Live</span>
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div className="mx-auto max-w-xl pt-4 space-y-4 px-0 sm:px-4">
        {loading && feeds.length === 0 && <FeedSkeleton />}

        {error && (
          <div className="mx-4 rounded-2xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
            <AlertIcon className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button onClick={() => load(true)}
              className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && feeds.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="h-20 w-20 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <NewsIcon className="h-10 w-10 text-gray-300" />
            </div>
            <p className="text-lg font-bold text-gray-600">No posts yet</p>
            <p className="text-sm text-gray-400">Check back soon for updates.</p>
          </div>
        )}

        {feeds.map((feed) => (
          <FeedCard
            key={feed.id}
            feed={feed}
            liked={likedPosts.has(feed.id)}
            userId={user?.id}
            onLike={() => toggleLike(feed.id)}
            onComment={() => setActiveCommentFeed(feed)}
            onShare={() => handleShare(feed)}
            onView={() => recordView(feed.id)}
          />
        ))}

        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-6">
            {loadingMore && <SpinnerIcon className="h-6 w-6 text-violet-400" />}
          </div>
        )}
        {!hasMore && feeds.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-6">You're all caught up ✓</p>
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
          userId={user?.id}
          onClose={() => setActiveShareFeed(null)}
          onShare={() => handleShareLog(activeShareFeed)}
        />
      )}
    </div>
  );
}

/* ================================================================
   FEED CARD — Instagram-style image + clean card
   ================================================================ */
const FeedCard = React.memo(function FeedCard({ feed, liked, userId, onLike, onComment, onShare, onView }) {
  const [imgError,  setImgError]  = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const viewedRef  = useRef(false);
  const cardRef    = useRef(null);

  /* record view once 50% visible */
  useEffect(() => {
    if (viewedRef.current || !cardRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !viewedRef.current) {
        viewedRef.current = true;
        onView();
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, [onView]);

  const admin     = feed.admin;
  const adminName = admin?.display_name || admin?.username || "Admin";
  const hasImage  = feed.image_url && !imgError;
  const isLong    = feed.content.length > PREVIEW_LEN;
  const preview   = isLong ? feed.content.slice(0, PREVIEW_LEN).trimEnd() + "…" : feed.content;

  return (
    <article
      ref={cardRef}
      className="bg-white sm:rounded-2xl overflow-hidden border-y sm:border border-gray-100 shadow-none sm:shadow-sm"
    >
      {/* ── Author bar ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link to={`/feeds/${feed.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          {admin?.avatar_url ? (
            <img src={admin.avatar_url} alt={adminName}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-100 shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white">
              {adminName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-extrabold text-gray-900 leading-tight">{adminName}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                <ShieldIcon className="h-2 w-2" /> Admin
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{timeAgo(feed.created_at)}</p>
          </div>
        </Link>

        {/* Views + pinned */}
        <div className="flex items-center gap-2 shrink-0">
          {feed.pinned && (
            <span className="flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5">
              <PinIcon className="h-2.5 w-2.5 text-white" />
              <span className="text-[9px] font-bold text-white">Pinned</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <EyeIcon className="h-3.5 w-3.5" />
            {fmtCount(feed.views_count)}
          </span>
        </div>
      </div>

      {/* ── Image — Instagram square/portrait ratio ── */}
      {hasImage && (
        /* Use Link so the whole image is a proper anchor — no bubbling issues */
        <Link to={`/feeds/${feed.id}`} className="block relative w-full bg-gray-100 overflow-hidden">
          {/* Aspect ratio box: 1:1 on mobile, 4:3 on larger screens */}
          <div className="w-full" style={{ paddingBottom: "min(100%, 75vw)" }} />
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="h-8 w-8 rounded-full border-2 border-violet-300 border-t-transparent animate-spin" />
            </div>
          )}
          <img
            src={feed.image_url}
            alt={feed.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: imgLoaded ? 1 : 0 }}
            draggable={false}
          />
        </Link>
      )}

      {/* ── Action buttons (Instagram-style, above caption) ── */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        {/* Like */}
        <button
          onClick={(e) => { e.stopPropagation(); userId ? onLike() : null; }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-all active:scale-90 ${
            liked ? "text-red-500" : "text-gray-600 hover:text-red-400"
          }`}
        >
          <HeartIcon className="h-5 w-5" filled={liked} />
          <span className="text-xs">{fmtCount(feed.likes_count)}</span>
        </button>

        {/* Comment */}
        <Link
          to={`/feeds/${feed.id}`}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-gray-600 hover:text-violet-500 transition-colors active:scale-90"
        >
          <CommentIcon className="h-5 w-5" />
          <span className="text-xs">{fmtCount(feed.comments_count)}</span>
        </Link>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-gray-600 hover:text-emerald-500 transition-colors active:scale-90"
        >
          <ShareIcon className="h-5 w-5" />
          <span className="text-xs">{fmtCount(feed.shares_count)}</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bookmark-style "read" */}
        <Link to={`/feeds/${feed.id}`}
          className="rounded-full p-2 text-gray-400 hover:text-violet-500 transition-colors active:scale-90">
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
      </div>

      {/* ── Caption (Instagram style) ── */}
      <div className="px-4 pb-4">
        {/* Title */}
        <Link to={`/feeds/${feed.id}`} className="block">
          <h2 className="text-[15px] font-extrabold text-gray-900 leading-snug mb-1 hover:text-violet-700 transition-colors">
            {feed.title}
          </h2>
        </Link>

        {/* Preview text */}
        <p className="text-sm text-gray-600 leading-relaxed">
          <span className="font-bold text-gray-800 mr-1">{adminName}</span>
          {preview}
        </p>

        {/* Read more */}
        {isLong && (
          <Link
            to={`/feeds/${feed.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-violet-600 transition-colors"
          >
            more
          </Link>
        )}

        {/* Tags */}
        {feed.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {feed.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-[11px] font-semibold text-violet-500">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
});

/* ================================================================
   COMMENT SHEET
   ================================================================ */
function CommentSheet({ feed, userId, onClose, onRequireAuth }) {
  const { threaded, loading, submitting, submitError, myLikes, submitComment, toggleCommentLike, deleteComment } = useComments(feed?.id, !!feed);
  const [body, setBody]       = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => {
    if (feed) { setBody(""); setReplyTo(null); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [feed?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) { onRequireAuth(); return; }
    if (!body.trim()) return;
    const ok = await submitComment(body, replyTo?.id ?? null);
    if (ok) {
      setBody(""); setReplyTo(null);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 150);
    }
  };

  if (!feed) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] flex flex-col bg-white rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-2xl max-h-[92dvh] md:max-h-none">

        {/* Drag handle + header */}
        <div className="relative flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-gray-200" />
          <div className="flex items-center gap-2.5">
            <CommentIcon className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-sm font-extrabold text-gray-900">Comments</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{feed.title}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {loading && [1,2,3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded-full bg-gray-200" />
                <div className="h-3 w-full rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
          {!loading && threaded.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CommentIcon className="h-12 w-12 text-gray-200" />
              <p className="text-sm font-bold text-gray-400">No comments yet</p>
              <p className="text-xs text-gray-400">Be the first to share your thoughts!</p>
            </div>
          )}
          {threaded.map((comment) => (
            <CommentThread key={comment.id} comment={comment} userId={userId}
              myLikes={myLikes} onLike={toggleCommentLike} onDelete={deleteComment}
              onReply={(id, name) => { setReplyTo({ id, name }); inputRef.current?.focus(); }} />
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
          {submitError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-2">
              <AlertIcon className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-medium">{submitError}</p>
            </div>
          )}
          {replyTo && (
            <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 mb-2">
              <p className="text-xs text-violet-700 font-medium">
                Replying to <span className="font-bold">{replyTo.name}</span>
              </p>
              <button onClick={() => setReplyTo(null)} className="text-violet-400 hover:text-violet-600">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LEN))}
                onKeyDown={(e) => { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSubmit(e);} }}
                placeholder={userId ? "Write a comment…" : "Sign in to comment"}
                disabled={!userId || submitting} rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50"
                style={{ maxHeight: 120, overflowY: "auto" }} />
              <p className="absolute right-3 bottom-3 text-[10px] text-gray-400">{body.length}/{MAX_COMMENT_LEN}</p>
            </div>
            <button type="submit" disabled={!body.trim()||submitting||!userId}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md">
              {submitting ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
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
      <CommentRow comment={comment} userId={userId} liked={myLikes.has(comment.id)}
        onLike={() => onLike(comment.id)} onDelete={() => onDelete(comment.id)}
        onReply={onReply} isTop />
      {comment.replies?.length > 0 && (
        <div className="ml-10 mt-2 space-y-2">
          <button onClick={() => setShowReplies(!showReplies)}
            className="text-xs font-bold text-violet-500 hover:text-violet-700 transition-colors">
            {showReplies ? "Hide replies" : `View ${comment.replies.length} repl${comment.replies.length!==1?"ies":"y"}`}
          </button>
          {showReplies && comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} userId={userId}
              liked={myLikes.has(reply.id)} onLike={() => onLike(reply.id)}
              onDelete={() => onDelete(reply.id)} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, userId, liked, onLike, onDelete, onReply, isTop = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const author     = comment.user;
  const authorName = author?.display_name || "User";
  const isOwn      = userId && userId === author?.id;

  return (
    <div className="flex gap-2.5">
      {author?.avatar_url ? (
        <img src={author.avatar_url} alt={authorName}
          className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 mt-0.5 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-xs font-bold text-white">
          {authorName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-full rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
          <p className="text-xs font-extrabold text-gray-900 mb-0.5">{authorName}</p>
          <p className="text-sm text-gray-700 leading-relaxed break-words">{comment.body}</p>
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
          <button onClick={onLike}
            className={`text-[11px] font-bold transition-colors ${liked ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}>
            {liked ? "Liked" : "Like"}{comment.likes_count > 0 && ` · ${fmtCount(comment.likes_count)}`}
          </button>
          {isTop && (
            <button onClick={() => onReply(comment.id, authorName)}
              className="text-[11px] font-bold text-gray-400 hover:text-violet-600 transition-colors">
              Reply
            </button>
          )}
          {isOwn && (
            <div className="relative ml-auto">
              <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-300 hover:text-gray-500">
                <DotsIcon className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-6 rounded-2xl bg-white border border-gray-100 shadow-xl py-1 z-10 min-w-[120px]">
                  <button onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
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
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white sm:rounded-2xl overflow-hidden border-y sm:border border-gray-100 animate-pulse">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="h-9 w-9 rounded-full bg-gray-200" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-1/3 rounded-full bg-gray-200" />
              <div className="h-2.5 w-1/5 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="w-full bg-gray-200" style={{ paddingBottom: "min(100%, 75vw)" }} />
          <div className="px-4 py-4 space-y-2">
            <div className="h-3.5 w-3/4 rounded-full bg-gray-200" />
            <div className="h-3 w-full rounded-full bg-gray-200" />
            <div className="h-3 w-2/3 rounded-full bg-gray-200" />
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
      <div className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border text-sm font-semibold ${
        isErr ? "bg-red-500 border-red-400 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
        {isErr ? <AlertIcon className="h-4 w-4 shrink-0" /> : <CheckIcon className="h-4 w-4 shrink-0 text-green-500" />}
        {toast.message}
      </div>
    </div>
  );
}

/* ================================================================
   ICONS
   ================================================================ */
function HeartIcon({ className="h-5 w-5", filled=false }) {
  return <svg className={className} fill={filled?"currentColor":"none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
}
function CommentIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}
function ShareIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
function EyeIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function PinIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6.5L22 10l-5 5 1.5 7L12 19l-6.5 3L7 15 2 10l7-1.5L12 2z"/></svg>;
}
function ShieldIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function AlertIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function CheckIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>;
}
function XIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
}
function SendIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
function SpinnerIcon({ className="h-5 w-5" }) {
  return <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"/></svg>;
}
function NewsIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>;
}
function ArrowRightIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
}
function DotsIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
}
function TrashIcon({ className="h-5 w-5" }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
}