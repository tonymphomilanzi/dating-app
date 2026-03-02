import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";
import { chatService } from "../services/chat.service.js";

export default function Messages(){
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      try {
        const data = await chatService.list();
        if (cancel) return;
        setItems(data);
      } catch(e) {
        if (cancel) return;
        setErr(e.message || "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return ()=>{ cancel = true; };
  },[]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Messages</h1>
        <div className="flex items-center gap-1">
          <button className="rounded-full p-2 hover:bg-gray-100" aria-label="Search"><i className="lni lni-search text-xl" /></button>
          <button className="rounded-full p-2 hover:bg-gray-100" aria-label="More"><i className="lni lni-more text-xl" /></button>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl bg-white p-4 mx-4 shadow-card text-gray-600">Loading…</div>
      ) : err ? (
        <div className="rounded-2xl bg-white p-4 mx-4 shadow-card text-center">
          <div className="text-red-600">Failed to load</div>
          <div className="text-xs text-gray-500 mt-1">{String(err)}</div>
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl bg-white p-6 mx-4 shadow-card text-center text-gray-600">No conversations yet.</div>
      ) : (
        <div className="divide-y">
          {items.map(c=>(
            <Link key={c.id} to={`/chat/${c.id}`} className="flex items-center gap-3 bg-white px-4 py-3">
              <Avatar size={44} src={c.other?.avatar_url}/>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.other?.display_name || "Match"}</div>
                  <div className="text-xs text-gray-500">{c.last?.created_at ? new Date(c.last.created_at).toLocaleTimeString() : ""}</div>
                </div>
                <div className={`text-sm line-clamp-1 ${c.last?.blurred ? "text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-gray-300" : "text-gray-600"}`}>
                  {c.last?.text || "Say hello 👋"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}