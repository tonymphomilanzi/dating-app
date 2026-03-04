import { useEffect, useMemo, useState } from "react";
import TopBar from "../../components/TopBar.jsx";
import Tag from "../../components/Tag.jsx";
import Button from "../../components/Button.jsx";
import { supabase } from "../../../api/lib/supabase.js";
import { useNavigate } from "react-router-dom";

const DEFAULT_INTERESTS = [
  "Photography","Art","Travel","Cooking","Dogs","Fitness","Hiking",
  "Music","Yoga","Dancing","Outdoors","Reading","Tech","Gaming"
];

const norm = (s) => s.trim().toLowerCase();

export default function SetupInterests(){
  const nav = useNavigate();
  const [all, setAll] = useState([]);              // [{ id?, label }]
  const [pickedLabels, setPickedLabels] = useState([]); // ['Art', ...]
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState("");

  // label -> id map
  const idByLabel = useMemo(() => {
    const m = {};
    for (const i of all) if (i?.id) m[norm(i.label)] = i.id;
    return m;
  }, [all]);

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      setLoading(true);
      setError("");
      try {
        // 1) Load catalog
        const { data: interests, error: err1 } = await supabase
          .from("interests")
          .select("id,label")
          .order("label",{ascending:true});

        let finalAll = [];
        let fallback = false;

        if (err1 || !interests || interests.length === 0) {
          // Fallback to local defaults if DB empty or error
          finalAll = DEFAULT_INTERESTS.map(l => ({ label: l }));
          fallback = true;
        } else {
          finalAll = interests;
        }

        if (!mounted) return;
        setAll(finalAll);
        setUsingFallback(fallback);

        // 2) Load my current picks (if authenticated)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: mine, error: err2 } = await supabase
          .from("user_interests")
          .select("interest_id")
          .eq("user_id", user.id);

        if (!mounted) return;

        if (!err2 && mine && mine.length && !fallback) {
          const byId = new Map(finalAll.filter(i => i.id).map(i => [i.id, i.label]));
          const labels = mine.map(m => byId.get(m.interest_id)).filter(Boolean);
          setPickedLabels(labels);
        }
      } catch (e) {
        if (!mounted) return;
        setAll(DEFAULT_INTERESTS.map(l => ({ label: l })));
        setUsingFallback(true);
        setError(e.message || "Could not load interests, using defaults.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  },[]);

  const toggle = (label) =>
    setPickedLabels(v => v.includes(label) ? v.filter(x=>x!==label) : [...v, label]);

  const save = async ()=>{
    if (pickedLabels.length < 5) return;
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Map labels to IDs
      let map = { ...idByLabel };
      const missing = pickedLabels.filter(l => !map[norm(l)]);

      // If any picked labels don't exist in DB (e.g., fallback), try to upsert them (requires insert policy)
      if (missing.length > 0) {
        const payload = missing.map(l => ({ label: l }));
        const { error: upErr } = await supabase
          .from("interests")
          .upsert(payload, { onConflict: "label" });
        if (upErr) {
          // If you keep catalog read-only, run the SQL seed above and remove this upsert path
          throw new Error("Interests not seeded and insert blocked. Run the SQL seed or enable insert policy.");
        }

        // Re-fetch IDs for all picked labels
        const { data: rows, error: refetchErr } = await supabase
          .from("interests")
          .select("id,label")
          .in("label", pickedLabels);
        if (refetchErr) throw refetchErr;

        rows.forEach(r => { map[norm(r.label)] = r.id; });
      }

      const interestIds = pickedLabels.map(l => map[norm(l)]).filter(Boolean);
      if (interestIds.length < pickedLabels.length) {
        throw new Error("Some selected interests are missing IDs. Please retry.");
      }

      // Replace user_interests with the current selection
      const { error: delErr } = await supabase.from("user_interests").delete().eq("user_id", user.id);
      if (delErr) throw delErr;

      if (interestIds.length) {
        const rows = interestIds.map(id => ({ user_id: user.id, interest_id: id }));
        const { error: insErr } = await supabase.from("user_interests").insert(rows);
        if (insErr) throw insErr;
      }

      nav("/setup/photo");
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Your interests"/>
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Loading interests…</div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Pick at least 5.{" "}
              {usingFallback && (
                <span className="text-amber-600">Using defaults (DB not seeded)</span>
              )}
            </p>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex flex-wrap gap-2">
              {all.map(i => {
                const label = i.label;
                const active = pickedLabels.includes(label);
                return (
                  <Tag key={label} label={label} active={active} onClick={()=>toggle(label)} />
                );
              })}
            </div>
            <Button className="w-full" disabled={pickedLabels.length<5 || saving} onClick={save}>
              {saving ? "Saving..." : "Continue"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}