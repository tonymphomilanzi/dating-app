import { useEffect, useState } from "react";
import { useNavigate,useLocation  } from "react-router-dom";
import { eventsService } from "../services/events.service.js";
import { supabase } from "../lib/supabase.client.js";


export default function Events() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
    const nav = useNavigate();
  const locState = useLocation();
  const [mode, setMode] = useState("explore");
  const [cat, setCat] = useState("All");
  
  // Track user-created events separately; merge into views
  const [mine, setMine] = useState([]);

  useEffect(() => {
    const created = locState.state?.created;
    if (created) {
      setMine((prev) => [created, ...prev]);
      // clear state so it doesn't re-add on back/forward
      nav("/events", { replace: true, state: null });
    }
  }, [locState.state, nav]);


  useEffect(() => {
    // Wire real fetch here later (eventsService.list)
    // setLoading(true);
    // eventsService.list().then(setItems).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-gray-900">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Events</h1>
      </header>

      <main className="px-4 pb-24">
        {loading ? (
          <div className="grid h-[60vh] place-items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
              <span className="relative inline-block h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
              </span>
              <span className="text-sm font-medium text-gray-700">Loading…</span>
            </div>
          </div>
        ) : err ? (
          <div className="grid h-[60vh] place-items-center text-center">
            <div>
              <p className="text-red-600 font-medium">Failed to load</p>
              <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
              <button
                className="btn-outline mt-3"
                onClick={() => {
                  setErr("");
                  setLoading(true);
                  // re-fetch later
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-500">
              <i className="lni lni-calendar text-2xl" />
            </div>
            <div className="mt-3 text-sm text-gray-700">No events yet</div>
            <p className="mt-1 text-xs text-gray-500">Create or discover events near you.</p>
            <div className="mt-4 flex justify-center">
          <button
  className="btn-primary"
  onClick={() => nav("/events/new")}
>
  <i className="lni lni-plus mr-1" /> Create event
</button>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((e) => (
              <li key={e.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-semibold">{e.title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(e.starts_at).toLocaleString()}
                    </div>
                  </div>
                  <button className="rounded-full p-2 hover:bg-gray-100">
                    <i className="lni lni-chevron-right" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}