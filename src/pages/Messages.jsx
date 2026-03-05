import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MessagesList from "../components/MessagesList.jsx";
import { chatService } from "../services/chat.service.js";
import { formatChatListTime } from "../utils/time.js";
import { supabase } from "../lib/supabase";
import { ChatCache } from "../lib/cache.js";
import { useRevalidate } from "../hooks/useRevalidate.js";

export default function Messages(){
  const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState(null);

  const mapThreads = (items) => {
    const list = (items || []).map(i => {
      const ts = i.last?.created_at || i.last_message_at || i.created_at;
      return {
        id: i.id,
        name: i.other?.display_name || "User",
        avatar: i.other?.avatar_url || "https://picsum.photos/80",
        lastMessage: i.last ? { text: i.last.text || "", time: formatChatListTime(ts, { hour12: true }) } : null,
        unreadCount: i.unreadCount || 0,
        blurred: i.last?.blurred || i.blurred || false,
        updatedAt: ts,
      };
    });
    list.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    return list;
  };

  const refresh = async ({ foreground = false } = {}) => {
    if (foreground) setLoading(true);
    const items = await chatService.list().catch(()=>[]);
    const list = mapThreads(items);
    setThreads(list); setAll(list);
    if (meId) ChatCache.saveThreads(meId, list);
    if (foreground) setLoading(false);
  };

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      const { data: { user } } = await supabase.auth.getUser();
      if (cancel) return;
      setMeId(user?.id || "me");

      // show cached
      const cached = ChatCache.loadThreads(user?.id || "me");
      if (cached.length) {
        setThreads(cached); setAll(cached); setLoading(false);
      }
      // refresh in background
      refresh({ foreground: !cached.length });
    })();
    return ()=>{ cancel = true; };
  },[]);

  // revalidate on focus/online/visibility + every 60s
  useRevalidate({ refetch: ()=>refresh({ foreground:false }), intervalMs: 60_000 });

  const favorites = useMemo(()=> all.slice(0,8).map(t => ({
    id: t.id, name: t.name, avatar: t.avatar, thread: t, online: false,
  })), [all]);

  const openThread = (t) => nav(`/chat/${t.id}`);

  const onSearch = (q) => {
    const s = (q||"").trim().toLowerCase();
    if (!s) { setThreads(all); return; }
    setThreads(all.filter(t =>
      (t.name||"").toLowerCase().includes(s) ||
      (t.lastMessage?.text||"").toLowerCase().includes(s)
    ));
  };

  if (loading && !threads.length) {
    return <div className="grid min-h-dvh place-items-center text-gray-600">Loading…</div>;
  }
  return <MessagesList threads={threads} favorites={favorites} onOpenThread={openThread} onSearch={onSearch} />;
}