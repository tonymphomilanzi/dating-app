import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StoryViewer from "../components/StoryViewer.jsx";
import { storiesService } from "../services/stories.service.js";
import { supabase } from "../lib/supabase.client.js";

export default function StoryPage() {
  const nav = useNavigate();
  const { userId } = useParams();
  const [user, setUser] = useState({ name: "User", avatar: "", postedAt: Date.now() });
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      try {
        // profile header
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", userId)
          .maybeSingle();
        if (!cancel) setUser({
          name: p?.display_name || "User",
          avatar: p?.avatar_url || "",
          postedAt: Date.now(),
        });

        const items = await storiesService.getUserStories(userId);
        if (!cancel) setStories(items);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return ()=>{ cancel = true; };
  }, [userId]);

  if (loading) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 text-white">Loading…</div>;

  return (
    <StoryViewer
      user={user}
      stories={stories}
      initialIndex={0}
      onClose={()=>nav(-1)}
      onSendMessage={()=>nav("/messages")}
      onReact={(liked)=>console.log("react", liked)}
    />
  );
}