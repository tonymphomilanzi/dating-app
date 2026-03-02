import { useEffect, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { prefsService } from "../services/prefs.service.js";

export default function Filters(){
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [interested, setInterested] = useState("everyone");
  const [distance, setDistance] = useState(50);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(99);

  useEffect(()=>{
    let cancel = false;
    (async ()=>{
      try {
        const p = await prefsService.get();
        if (cancel) return;
        setInterested(p.interested_in);
        setDistance(p.distance_km);
        setMinAge(p.min_age);
        setMaxAge(p.max_age);
      } catch (e) {
        setErr(e.message || "Failed to load preferences");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return ()=>{ cancel = true; };
  },[]);

  const save = async ()=>{
    setSaving(true); setErr("");
    try {
      await prefsService.save({
        interested_in: interested,
        distance_km: Number(distance),
        min_age: Number(minAge),
        max_age: Number(maxAge),
      });
      history.back();
    } catch(e) {
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Filters" />
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow-card text-gray-600">Loading…</div>
        ) : (
          <>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Interested in</span>
                <div className="flex gap-2">
                  <button
                    onClick={()=>setInterested("women")}
                    className={`chip ${interested==="women"?"chip-on":"chip-off"}`}
                  >Women</button>
                  <button
                    onClick={()=>setInterested("men")}
                    className={`chip ${interested==="men"?"chip-on":"chip-off"}`}
                  >Men</button>
                  <button
                    onClick={()=>setInterested("everyone")}
                    className={`chip ${interested==="everyone"?"chip-on":"chip-off"}`}
                  >All</button>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm text-gray-600">Distance ({distance} km)</label>
                <input type="range" min={1} max={200} value={distance} onChange={e=>setDistance(e.target.value)} className="w-full accent-violet-600"/>
              </div>

              <div className="mt-5">
                <label className="text-sm text-gray-600">Age range</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input type="number" className="field" min={18} max={99} value={minAge} onChange={e=>setMinAge(e.target.value)} />
                  <input type="number" className="field" min={18} max={99} value={maxAge} onChange={e=>setMaxAge(e.target.value)} />
                </div>
                <div className="mt-1 text-right text-sm text-gray-500">{minAge} – {maxAge}</div>
              </div>
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}