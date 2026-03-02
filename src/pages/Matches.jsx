import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { matchesService } from "../services/matches.service.js";

export default function Matches(){
  const [items, setItems] = useState([]);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      setLoading(true); setErr("");
      try {
        const { items, limited } = await matchesService.list();
        if (cancel) return;
        setItems(items || []);
        setLimited(limited);
      } catch (e) {
        if (cancel) return;
        setErr(e.message || "Failed to load matches");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return ()=>{ cancel = true; };
  },[]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="p-4"><h1 className="text-lg font-semibold">Matches</h1></header>
      <div className="px-4">
        {loading ? (
          <div className="rounded-2xl bg-white p-4 text-gray-600 shadow-card">Loading…</div>
        ) : err ? (
          <div className="rounded-2xl bg-white p-4 text-center shadow-card">
            <div className="text-red-600">Failed to load</div>
            <div className="text-xs text-gray-500 mt-1">{String(err)}</div>
          </div>
        ) : !items.length ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-card text-gray-600">No matches yet. Keep swiping!</div>
        ) : (
          <>
            {limited && (
              <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                You’re seeing the first 5 matches. Upgrade to see all.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pb-4">
              {items.map(m => {
                const other = m.other || {};
                return (
                  <Link to={`/profile/${other.id || m.id}`} key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
                    <img src={other.avatar_url || "https://picsum.photos/400/600"} className="aspect-[3/4] w-full object-cover" />
                    <div className="p-2 text-sm font-medium">{other.display_name || "Match"}</div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}