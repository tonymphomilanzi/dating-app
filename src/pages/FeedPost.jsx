// src/pages/FeedPost.jsx - rewrite to fetch from supabase directly
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function fmtCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function FeedPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isMounted = useRef(true);
  const commentInputRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    window.scrollTo(0, 0);
    return () => { isMounted.current = false; };
  }, []);

  // Fetch post
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setPost(null);

    const run = async () => {
      try {
        const { data, error: err } = await supabase
          .from("feeds")
          .select(`
            id, title, content, image_url, tags, pinned,
            views_count, likes_count, comments_count, shares_count,
            created_at, updated_at, published,
            admin:admin_users(id, username, display_name, avatar_url)
          `)
          .eq("id", id)
          .eq("published", true)
          .single();

        if (!isMounted.current) return;
        if (err || !data) { setError("Post not found."); return; }
        setPost(data);

        // Record view
        supabase.rpc("increment_feed_view", { p_feed_id: id }).catch(() => {});

        // Check if liked
        if (user?.id) {
          const { data: likeData } = await supabase
            .from("feed_likes")
            .select("feed_id")
            .eq("feed_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (isMounted.current) setLiked(!!likeData);
        }
      } catch (e) {
        if (isMounted.current) setError(e.message || "Failed to load post.");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    run();
  }, [id, user?.id]);

  // Fetch comments when drawer opens
  useEffect(() => {
    if (!commentsOpen || !id) return;
    setCommentsLoading(true);

    supabase
      .from("feed_comments")
      .select(`
        id, body, created_at, parent_id,
        user:feed_comments_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq("feed_id", id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (isMounted.current) {
          setComments(data ?? []);
          setCommentsLoading(false);
        }
      });

    setTimeout(() => commentInputRef.current?.focus(), 200);
  }, [commentsOpen, id]);

  const handleToggleLike = async () => {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setPost((p) => p ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) + (next ? 1 : -1)) } : p);

    try {
      if (next) {
        await supabase.from("feed_likes").insert({ feed_id: id, user_id: user.id });
      } else {
        await supabase.from("feed_likes").delete().eq("feed_id", id).eq("user_id", user.id);
      }
    } catch {
      // Revert on error
      setLiked(!next);
      setPost((p) => p ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) + (next ? -1 : 1)) } : p);
    }
  };

  const handleAddComment = async () => {
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    const text = commentText.trim();
    setCommentText("");

    try {
      const { data } = await supabase
        .from("feed_comments")
        .insert({ feed_id: id, user_id: user.id, body: text })
        .select(`id, body, created_at, parent_id, user:feed_comments_user_id_fkey(id, display_name, avatar_url)`)
        .single();

      if (data && isMounted.current) {
        setComments((prev) => [data, ...prev]);
        setPost((p) => p ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
      }
    } catch (e) {
      console.error("addComment:", e.message);
      setCommentText(text); // restore on error
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: post?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("share:", e.message);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 pb-28 antialiased">
        <FeedPostSkeleton onBack={() => navigate(-1)} />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !post) {
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-3xl"></span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Post Not Found</h2>
          <p className="mt-1 text-sm text-gray-500">{error || "This post doesn't exist or was removed."}</p>
        </div>
        <button onClick={() => navigate("/feeds")}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 active:scale-95 transition-all">
          ← Back to Feed
        </button>
      </div>
    );
  }

  const admin = post.admin;
  const adminName = admin?.display_name || admin?.username || "Admin";

  /* ── Main render ── */
  return (
    <div className="min-h-dvh bg-gray-50 pb-28 antialiased">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/feeds")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-600 transition-colors active:scale-95">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-bold text-gray-900 truncate">{post.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 pt-5 space-y-4">

        {/* Cover image */}
        {post.image_url && (
          <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            <img src={post.image_url} alt={post.title}
              className="w-full object-cover max-h-80"
              loading="eager" />
          </div>
        )}

        {/* Post card */}
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">

          {/* Author */}
          <div className="flex items-center gap-3 mb-4">
            {admin?.avatar_url ? (
              <img src={admin.avatar_url} alt={adminName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-violet-100" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white">
                {adminName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-gray-900">{adminName}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  Admin
                </span>
              </div>
              <p className="text-xs text-gray-400">{timeAgo(post.created_at)}</p>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-extrabold text-gray-900 leading-snug mb-3">{post.title}</h1>

          {/* Content */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</p>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="my-4 h-px bg-gray-100" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
            <span>{fmtCount(post.likes_count)} likes</span>
            <span>{fmtCount(post.comments_count)} comments</span>
            <span>{fmtCount(post.views_count)} views</span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleToggleLike}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95 ${liked ? "bg-red-50 text-red-500 border border-red-200" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200"}`}>
              <svg className="h-4 w-4" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              {liked ? "Liked" : "Like"}
            </button>

            <button onClick={() => setCommentsOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all active:scale-95">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Comment
            </button>

            <button onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all active:scale-95">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Comments overlay */}
      {commentsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setCommentsOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl max-h-[80vh]">

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-900">
                Comments · {fmtCount(post.comments_count)}
              </p>
              <button onClick={() => setCommentsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {commentsLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded-full bg-gray-200" />
                        <div className="h-3 w-2/3 rounded-full bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">💬</p>
                  <p className="text-sm font-semibold text-gray-600">No comments yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first!</p>
                </div>
              ) : (
                comments.map((c) => {
                  const name = c.user?.display_name || "User";
                  return (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-xs font-bold text-white">
                        {name.slice(0,1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="inline-block rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                          <p className="text-xs font-extrabold text-gray-900 mb-0.5">{name}</p>
                          <p className="text-sm text-gray-700 leading-relaxed break-words">{c.body}</p>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 px-1">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-gray-100 px-4 py-3"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
              {user ? (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="Write a comment…"
                    rows={1}
                    disabled={submitting}
                    className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50"
                    style={{ maxHeight: 100, overflowY: "auto" }}
                  />
                  <button onClick={handleAddComment}
                    disabled={!commentText.trim() || submitting}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 active:scale-95 transition-all shadow-md">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500">
                  <button onClick={() => navigate("/auth")} className="font-bold text-violet-600 hover:underline">
                    Sign in
                  </button>{" "}to comment
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeedPostSkeleton({ onBack }) {
  return (
    <div className="animate-pulse">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="h-9 w-9 rounded-full bg-gray-200" />
        <div className="h-5 w-48 rounded-full bg-gray-200" />
      </div>
      <div className="mx-auto max-w-2xl px-4 pt-5 space-y-4">
        <div className="h-64 rounded-3xl bg-gray-200" />
        <div className="rounded-3xl bg-white border border-gray-100 p-5 space-y-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 rounded-full bg-gray-200" />
              <div className="h-3 w-1/4 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="h-6 w-3/4 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-full bg-gray-200" />
            <div className="h-4 w-full rounded-full bg-gray-200" />
            <div className="h-4 w-2/3 rounded-full bg-gray-200" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map((i) => <div key={i} className="h-11 rounded-2xl bg-gray-100" />)}
          </div>
        </div>
      </div>
    </div>
  );
}