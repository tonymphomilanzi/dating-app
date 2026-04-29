// src/pages/FeedDetail.jsx
import React, {
  useCallback, useEffect, useRef, useState, useMemo,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import FeedShareSheet from "../components/FeedShareSheet.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */
const MAX_COMMENT_LEN = 1000;
const COMMENT_PAGE    = 50;
const COMMENT_SELECT  = `
  id, feed_id, parent_id, body, likes_count, created_at,
  user:feed_comments_user_id_fkey(id, display_name, avatar_url)
`;

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
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function fmtCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ================================================================
   HOOK — useFeedDetail
   ================================================================ */
function useFeedDetail(id, userId) {
  const [feed,    setFeed]    = useState(null);
  const [liked,   setLiked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const mountedRef = useRef(true);
  const rtRef      = useRef(null);
  const viewedRef  = useRef(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    supabase
      .from("feeds")
      .select(`
        id, title, content, image_url, tags, pinned,
        views_count, likes_count, comments_count, shares_count,
        created_at, updated_at,
        admin:admin_users(id, username, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("published", true)
      .single()
      .then(async ({ data, error: err }) => {
        if (!mountedRef.current) return;
        if (err || !data) { setError("Post not found"); setLoading(false); return; }
        setFeed(data);
        setLoading(false);

        /* record view once */
        if (!viewedRef.current) {
          viewedRef.current = true;
          supabase.rpc("increment_feed_view", { p_feed_id: id }).catch(() => {});
        }

        /* check if user liked */
        if (userId) {
          const { data: like } = await supabase
            .from("feed_likes")
            .select("feed_id")
            .eq("feed_id", id)
            .eq("user_id", userId)
            .maybeSingle();
          if (mountedRef.current) setLiked(!!like);
        }
      });
  }, [id, userId]);

  /* realtime count updates */
  useEffect(() => {
    if (!id) return;
    rtRef.current = supabase
      .channel(`feed-detail-${id}-${Date.now()}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "feeds", filter: `id=eq.${id}` },
        (payload) => {
          if (!mountedRef.current) return;
          setFeed((prev) => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(rtRef.current); };
  }, [id]);

  const toggleLike = useCallback(async () => {
    if (!userId || !id) return;
    const wasLiked = liked;

    /* optimistic */
    setLiked(!wasLiked);
    setFeed((prev) => prev
      ? { ...prev, likes_count: Math.max(0, (prev.likes_count || 0) + (wasLiked ? -1 : 1)) }
      : prev
    );

    try {
      if (wasLiked) {
        const { error } = await supabase.from("feed_likes").delete()
          .eq("feed_id", id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feed_likes")
          .insert({ feed_id: id, user_id: userId });
        if (error && error.code !== "23505") throw error;
      }
    } catch (e) {
      console.error("toggleLike:", e.message);
      setLiked(wasLiked);
      setFeed((prev) => prev
        ? { ...prev, likes_count: Math.max(0, (prev.likes_count || 0) + (wasLiked ? 1 : -1)) }
        : prev
      );
    }
  }, [userId, id, liked]);

  return { feed, liked, loading, error, toggleLike, setFeed };
}

/* ================================================================
   HOOK — useComments (identical pattern to Feeds.jsx)
   ================================================================ */
function useComments(feedId) {
  const [comments,    setComments]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [myLikes,     setMyLikes]     = useState(new Set());
  const mountedRef = useRef(true);
  const rtRef      = useRef(null);
  const { user }   = useAuth();

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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
      if (!mountedRef.current) return;
      setComments(data ?? []);

      if (user?.id && data?.length) {
        const ids = data.map((c) => c.id);
        const { data: liked } = await supabase
          .from("feed_comment_likes").select("comment_id")
          .eq("user_id", user.id).in("comment_id", ids);
        if (mountedRef.current && liked)
          setMyLikes(new Set(liked.map((l) => l.comment_id)));
      }
    } catch (e) { console.error("fetchComments:", e.message); }
    finally { if (mountedRef.current) setLoading(false); }
  }, [feedId, user?.id]);

  useEffect(() => {
    if (!feedId) return;
    fetchComments();

    rtRef.current = supabase
      .channel(`cmt-detail-${feedId}-${Date.now()}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "feed_comments", filter: `feed_id=eq.${feedId}` },
        async (payload) => {
          if (!mountedRef.current) return;
          const { data } = await supabase.from("feed_comments")
            .select(COMMENT_SELECT).eq("id", payload.new.id).single();
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
  }, [feedId, fetchComments]);

  const submitComment = useCallback(async (body, parentId = null) => {
    if (!user?.id || !feedId || !body.trim()) return false;
    setSubmitting(true); setSubmitError("");

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId, feed_id: feedId, parent_id: parentId,
      body: body.trim(), likes_count: 0, created_at: new Date().toISOString(),
      user: {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "You",
        avatar_url: user.user_metadata?.avatar_url || null,
      },
    };
    setComments((prev) => [...prev, tempComment]);

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
      c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) + (isLiked ? -1 : 1)) } : c
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
        c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) + (isLiked ? 1 : -1)) } : c
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
   MAIN — FeedDetail
   ================================================================ */
export default function FeedDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user }     = useAuth();

  const { feed, liked, loading, error, toggleLike } = useFeedDetail(id, user?.id);
  const {
    threaded, loading: cLoading, submitting, submitError,
    myLikes, submitComment, toggleCommentLike, deleteComment,
  } = useComments(id);

  const [showShare,  setShowShare]  = useState(false);
  const [imgError,   setImgError]   = useState(false);
  const [body,       setBody]       = useState("");
  const [replyTo,    setReplyTo]    = useState(null);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  /* share logging */
  const handleShareLog = useCallback(() => {
    if (!user?.id || !feed) return;
    supabase.from("feed_shares")
      .insert({ feed_id: feed.id, user_id: user.id })
      .then(({ error }) => { if (error) console.warn("share log:", error.message); });
  }, [user?.id, feed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) { navigate("/auth"); return; }
    if (!body.trim()) return;
    const ok = await submitComment(body, replyTo?.id ?? null);
    if (ok) {
      setBody(""); setReplyTo(null);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 150);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <SpinnerIcon className="h-8 w-8 text-violet-500" />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !feed) {
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
          <AlertIcon className="h-10 w-10 text-gray-400" />
        </div>
        <p className="text-lg font-bold text-gray-700">Post not found</p>
        <p className="text-sm text-gray-400">This post may have been removed.</p>
        <button
          onClick={() => navigate("/feeds")}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition-colors"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const admin     = feed.admin;
  const adminName = admin?.display_name || admin?.username || "Admin";

  return (
    <div className="min-h-dvh bg-gray-50 antialiased">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{feed.title}</p>
            <p className="text-xs text-gray-400">{timeAgo(feed.created_at)}</p>
          </div>
          {/* Share button in header */}
          <button
            onClick={() => setShowShare(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl pb-32">

        {/* ── Hero image ── */}
        {feed.image_url && !imgError && (
          <div className="relative w-full bg-gray-200 overflow-hidden" style={{ maxHeight: 400 }}>
            <img
              src={feed.image_url}
              alt={feed.title}
              className="w-full object-cover"
              style={{ maxHeight: 400 }}
              onError={() => setImgError(true)}
            />
            {feed.pinned && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 shadow-lg">
                <PinIcon className="h-3 w-3 text-white" />
                <span className="text-[11px] font-bold text-white">Pinned</span>
              </div>
            )}
          </div>
        )}

        {/* ── Post body ── */}
        <div className="bg-white px-4 pt-6 pb-4">

          {/* Author */}
          <div className="flex items-center gap-3 mb-5">
            {admin?.avatar_url ? (
              <img
                src={admin.avatar_url} alt={adminName}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-violet-100"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white">
                {adminName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-gray-900">{adminName}</span>
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
          <h1 className="text-2xl font-extrabold text-gray-900 leading-tight mb-4">
            {feed.title}
          </h1>

          {/* Full content — no truncation on detail page */}
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">
            {feed.content}
          </div>

          {/* Tags */}
          {feed.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {feed.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-violet-50 border border-violet-100 px-3 py-1 text-[11px] font-semibold text-violet-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="h-px bg-gray-100 mb-4" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
            <span>{fmtCount(feed.likes_count)} likes</span>
            <span>{fmtCount(feed.comments_count)} comments</span>
            <span>{fmtCount(feed.shares_count)} shares</span>
            <span>{fmtCount(feed.views_count)} views</span>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => user?.id ? toggleLike() : navigate("/auth")}
              className={[
                "flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95",
                liked
                  ? "bg-red-50 text-red-500 border border-red-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200",
              ].join(" ")}
            >
              <HeartIcon className="h-4 w-4" filled={liked} />
              {liked ? "Liked" : "Like"}
            </button>

            <button
              onClick={() => inputRef.current?.focus()}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all active:scale-95"
            >
              <CommentIcon className="h-4 w-4" /> Comment
            </button>

            <button
              onClick={() => setShowShare(true)}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all active:scale-95"
            >
              <ShareIcon className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        {/* ── Comments section ── */}
        <div className="bg-white mt-2 px-4 pt-5 pb-4">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <CommentIcon className="h-5 w-5 text-violet-500" />
            Comments
            {threaded.length > 0 && (
              <span className="ml-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                {threaded.length}
              </span>
            )}
          </h2>

          {/* Comment list */}
          <div ref={listRef} className="space-y-4 mb-5">
            {cLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded-full bg-gray-200" />
                      <div className="h-3 w-full rounded-full bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!cLoading && threaded.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CommentIcon className="h-10 w-10 text-gray-200" />
                <p className="text-sm font-bold text-gray-400">No comments yet</p>
                <p className="text-xs text-gray-400">Be the first to share your thoughts!</p>
              </div>
            )}

            {threaded.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                userId={user?.id}
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
        </div>
      </div>

      {/* ── Fixed comment input ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-100 px-4 pt-3 shadow-xl"
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
              Replying to <span className="font-bold">{replyTo.name}</span>
            </p>
            <button onClick={() => setReplyTo(null)} className="text-violet-400 hover:text-violet-600">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* User avatar */}
          {user ? (
            <div className="h-8 w-8 rounded-full shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white">
              {(user.user_metadata?.display_name || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full shrink-0 bg-gray-200" />
          )}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
              }}
              placeholder={user ? "Write a comment…" : "Sign in to comment"}
              disabled={!user || submitting}
              rows={1}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50"
              style={{ maxHeight: 100, overflowY: "auto" }}
            />
            <p className="absolute right-3 bottom-2.5 text-[10px] text-gray-400">
              {body.length}/{MAX_COMMENT_LEN}
            </p>
          </div>
          <button
            type="submit"
            disabled={!body.trim() || submitting || !user}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md"
          >
            {submitting ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* Share sheet */}
      {showShare && (
        <FeedShareSheet
          feed={feed}
          userId={user?.id}
          onClose={() => setShowShare(false)}
          onShare={handleShareLog}
        />
      )}
    </div>
  );
}

/* ================================================================
   COMMENT THREAD + ROW  (shared with Feeds.jsx pattern)
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
            className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors">
            {showReplies
              ? "Hide replies"
              : `View ${comment.replies.length} repl${comment.replies.length !== 1 ? "ies" : "y"}`}
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
            {liked ? "Liked" : "Like"}
            {comment.likes_count > 0 && ` · ${fmtCount(comment.likes_count)}`}
          </button>
          {isTop && (
            <button onClick={() => onReply(comment.id, authorName)}
              className="text-[11px] font-bold text-gray-400 hover:text-violet-600 transition-colors">
              Reply
            </button>
          )}
          {isOwn && (
            <div className="relative ml-auto">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="text-gray-300 hover:text-gray-500 transition-colors">
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
   ICONS
   ================================================================ */
function ArrowLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
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
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function EyeIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
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
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
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
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
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
function DotsIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
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