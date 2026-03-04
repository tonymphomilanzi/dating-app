import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.client.js";
import { useNavigate } from "react-router-dom";

const DEFAULT_INTERESTS = [
  "Photography","Art","Travel","Cooking","Dogs","Fitness","Hiking",
  "Music","Yoga","Dancing","Outdoors","Reading","Tech","Gaming",
  "Shopping","Karaoke","Tennis","Swimming","Run","Extreme","Drink","Video games"
];

const norm = (s) => s.trim().toLowerCase();

// Simple icon mapper (Lineicons). Falls back gracefully.
const ICONS = {
  photography: "lni lni-camera",
  art: "lni lni-brush",
  travel: "lni lni-plane",
  cooking: "lni lni-restaurant",
  dogs: "lni lni-paw",
  fitness: "lni lni-dumbbell",
  hiking: "lni lni-map",
  music: "lni lni-music",
  yoga: "lni lni-leaf",
  dancing: "lni lni-music",
  outdoors: "lni lni-sun",
  reading: "lni lni-book",
  tech: "lni lni-code",
  gaming: "lni lni-game",
  shopping: "lni lni-shopping-basket",
  karaoke: "lni lni-mic",
  tennis: "lni lni-tennis-ball",
  swimming: "lni lni-wave",
  run: "lni lni-bolt",
  extreme: "lni lni-thunder",
  drink: "lni lni-coffee-cup",
  "video games": "lni lni-game",
};
const iconFor = (label) => ICONS[norm(label)] || "lni lni-heart";

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

  const canContinue = pickedLabels.length >= 5 && !saving;

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Top bar: back + Skip */}
      <div className="sticky top-0 z-10 bg-white/90 px-4 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center">
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <i className="lni lni-chevron-left text-lg" />
          </button>
          <button
            onClick={() => nav("/setup/photo")}
            className="ml-auto text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-4">
        <h1 className="text-3xl font-bold">Your interests</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a few of your interests and let everyone know what you're passionate about.
        </p>

        {usingFallback && (
          <div className="mt-3 text-xs text-amber-600">
            Using defaults (DB not seeded)
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-500">Loading interests…</div>
        ) : (
          <>
            {/* Chips grid (2 columns) */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {all.map((i) => {
                const label = i.label;
                const active = pickedLabels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggle(label)}
                    className={[
                      "flex items-center justify-start gap-2 rounded-full border px-4 py-2.5 text-left text-sm transition",
                      active
                        ? "border-violet-600 bg-violet-600 text-white shadow"
                        : "border-gray-200 bg-white text-gray-800 hover:border-violet-200 hover:bg-violet-50/50"
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <i
                      className={[
                        iconFor(label),
                        "text-base",
                        active ? "text-white" : "text-violet-600"
                      ].join(" ")}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Helper: count + requirement */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-gray-600">Pick at least 5</span>
              <span className={`font-medium ${pickedLabels.length >= 5 ? "text-violet-700" : "text-gray-500"}`}>
                {pickedLabels.length} selected
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom sticky continue */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            onClick={save}
            disabled={!canContinue}
            className={[
              "w-full rounded-full px-4 py-3.5 text-center text-base font-semibold shadow-card transition active:scale-[0.99]",
              canContinue
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-violet-300 text-white"
            ].join(" ")}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}