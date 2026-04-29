// src/pages/FeedPost.jsx  ← new page for /feeds/:id
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";

export default function FeedPost() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) { navigate("/feeds", { replace: true }); return; }

    supabase
      .from("feeds")
      .select(`
        id, title, content, image_url, tags, pinned,
        views_count, likes_count, comments_count, shares_count,
        created_at,
        admin:admin_users(id, username, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("published", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("Post not found");
        } else {
          setFeed(data);
          /* Increment view via RPC */
          supabase.rpc("increment_feed_view", { p_feed_id: id }).then(() => {});
        }
      });
  }, [id, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-4">
        <p className="text-lg font-bold text-gray-700">Post not found</p>
        <button
          onClick={() => navigate("/feeds")}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  /* Redirect into the main feed with this post highlighted */
  navigate("/feeds", { replace: true, state: { highlightFeedId: id } });
  return null;
}