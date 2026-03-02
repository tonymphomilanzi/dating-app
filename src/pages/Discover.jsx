import { useEffect, useMemo, useRef, useState } from "react";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { discoverService } from "../services/discover.service.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { saveBrowserLocationToProfile } from "../utils/location.js";

const tabs = [
  { key: "matches", label: "Matches" },
  { key: "nearby", label: "Nearby" },
  { key: "for_you", label: "For You" },
];

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 17) return "Good afternoon!";
  return "Good evening!";
}

export default function Discover(){
  const { profile, reloadProfile } = useAuth();
  const [mode, setMode] = useState("for_you");             // user-selected tab
  const [activeMode, setActiveMode] = useState("for_you"); // actually displayed results (fallback aware)
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const triedFallbackRef = useRef(false);

  const userHasLocation = !!(profile?.lat != null && profile?.lng != null);

  async function loadMode(requestedMode) {
    const data = await discoverService.list(requestedMode, 20);
    return Array.isArray(data) ? data : [];
  }

  // Load with fallback only when mode === "for_you"
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setErr("");
      triedFallbackRef.current = false;

      try {
        let data = await loadMode(mode);
        let used = mode;

        if (!data.length && mode === "for_you") {
          triedFallbackRef.current = true;
          let d2 = await loadMode("matches");
          if (d2.length) { data = d2; used = "matches"; }
          else {
            let d3 = await loadMode("nearby");
            if (d3.length) { data = d3; used = "nearby"; }
          }
        }

        if (cancel) return;
        setItems(data);
        setActiveMode(used);
      } catch (e) {
        if (cancel) return;
        console.error("[Discover] load error:", e);
        setErr(e.message || "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [mode]);

  const stories = useMemo(() => (items || []).slice(0, 6), [items]);

  const enableLocation = async () => {
    if (locBusy) return;
    setLocBusy(true);
    try {
      await saveBrowserLocationToProfile(); // writes lat/lng to profiles
      await reloadProfile();               // refresh profile in context so prompt hides
      setMode("nearby");                   // switch to Nearby; effect will reload items
    } catch (e) {
      console.warn("[Discover] enable location failed:", e);
      alert(e.message || "Could not get your location. Check browser permissions.");
    } finally {
      setLocBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col bg-white text-gray-900">
      <header className="px-4 pt-4">
        {/* Top row */}
        <div className="mb-3 flex items-center gap-3">
          <img
            src={profile?.avatar_url || "/me.jpg"}
            alt="Me"
            className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-600 ring-offset-2"
          />
          <div className="text-sm leading-tight">
            <p className="text-gray-500">{greetingText()}</p>
          </div>
          <a
            href="/filters"
            className="ml-auto rounded-full p-2 hover:bg-gray-100"
            aria-label="Filters"
          >
            <i className="lni lni-sliders text-xl" />
          </a>
        </div>

        {/* Stories row */}
        <div className="no-scrollbar mb-3 flex items-start gap-3 overflow-x-auto pb-1">
          <div className="flex w-16 flex-col items-center">
            <button className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-violet-600 text-violet-600">
              <i className="lni lni-plus" />
            </button>
            <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">
              My story
            </span>
          </div>

          {stories.map((s) => (
            <div key={s.id} className="flex w-16 flex-col items-center">
              <img
                src={s.avatar_url || s.avatar || s.photo || s.photoUrl}
                alt={(s.display_name || s.name || "User")}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-200"
              />
              <span className="mt-1 w-16 truncate text-center text-xs text-gray-600">
                {(s.display_name || s.name || "User").split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        <p className="font-semibold">
          Let’s Find Your <span className="text-violet-600">Matches</span>
        </p>

        {/* Pill tabs */}
        <div className="items-center mt-2">
          <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            {tabs.map((t)=>(
              <button
                key={t.key}
                onClick={()=>setMode(t.key)}
                className={`rounded-full px-4 py-2 text-sm transition-colors
                  ${mode===t.key
                    ? "bg-violet-600 text-white shadow"
                    : "text-gray-700 hover:bg-violet-50"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {mode !== activeMode && !loading && (
            <div className="mt-2 text-xs text-gray-500">
              No results in “{mode.replace("_"," ")}” — showing “{activeMode.replace("_"," ")}”.
            </div>
          )}
        </div>
      </header>

      <main className="px-4 pt-4 pb-6">
        {loading ? (
          <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
            <div className="text-gray-600">Loading…</div>
          </div>
        ) : err ? (
          <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
            <div>
              <p className="text-red-600 font-medium">Failed to load</p>
              <p className="mt-1 text-xs text-gray-500">{String(err)}</p>
              <button
                className="btn-outline mt-3"
                onClick={()=>{
                  setErr("");
                  setLoading(true);
                  discoverService.list(mode, 20)
                    .then(setItems)
                    .catch(e=>setErr(e.message||"Failed"))
                    .finally(()=>setLoading(false));
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Show CTA only if YOU don't have a location set and active tab is Nearby */}
            {activeMode === "nearby" && !userHasLocation && (
              <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center justify-between gap-3">
                  <span>Enable your location to see people Nearby.</span>
                  <button
                    onClick={enableLocation}
                    disabled={locBusy}
                    className="rounded-full bg-amber-600 px-3 py-1 text-white"
                  >
                    {locBusy ? "Enabling…" : "Enable"}
                  </button>
                </div>
              </div>
            )}

            {/* If you have a location but distances are null (others lack location),
                show a neutral info instead of asking you to enable */}
            {activeMode === "nearby" && userHasLocation && !items.some(i => i?.distance_km != null) && (
              <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Distances will appear as more profiles add their location.
              </div>
            )}

            <SwipeDeck initialItems={items} mode={activeMode} />
          </>
        )}
      </main>
    </div>
  );
}