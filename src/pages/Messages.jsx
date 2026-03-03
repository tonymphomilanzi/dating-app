import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MessagesList from "../components/MessagesList.jsx";
import { chatService } from "../services/chat.service.js";

export default function Messages(){
const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      try {
        const items = await chatService.list();
        if (cancel) return;
        const list = (items || []).map(i => ({
          id: i.id,
          name: i.other?.display_name || "User",
          avatar: i.other?.avatar_url || "https://picsum.photos/80",
          lastMessage: i.last ? { text: i.last.text || "", time: i.last.created_at } : null,
          unreadCount: i.unreadCount || 0,
          blurred: i.last?.blurred || i.blurred || false,
        }));
        setThreads(list);
        setAll(list);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return ()=>{ cancel = true; };
  },[]);

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

  if (loading) return <div className="grid min-h-dvh place-items-center text-gray-600">Loading…</div>;

  return <MessagesList threads={threads} favorites={favorites} onOpenThread={openThread} onSearch={onSearch} />;
}