import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { matchesService } from "../services/matches.service.js";

// Heuristic to get a timestamp from any item shape
function getTs(it) {
  const t =
    it?.created_at ||
    it?.matched_at ||
    it?.liked_at ||
    it?.ts ||
    it?.other?.created_at ||
    it?.other?.ts ||
    it?.createdAt ||
    it?.updatedAt;
  return t ? new Date(t).getTime() : Date.now();
}

function labelFor(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 3600 * 1000;
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";
  return "Earlier";
}

function groupByDay(items) {
  const map = new Map();
  for (const it of items) {
    const k = labelFor(getTs(it));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  const order = ["Today", "Yesterday", "Earlier"];
  return order
    .filter(k => map.has(k))
    .map(k => ({ label: k, items: map.get(k) }));
}

export default function Matches() {
  const [mode, setMode] = useState("likes"); // likes | matches
  const [items, setItems] = useState([]);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Flexible: support matchesService.list(mode) or list({mode})
        const res = await (matchesService.list.length >= 1
          ? matchesService.list(mode)
          : matchesService.list({ mode }));
        if (cancel) return;
        setItems(res?.items || []);
        setLimited(!!res?.limited);
      } catch (e) {
        if (cancel) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode]);

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-gray-900">
      <header className="px-4 pt-4">
        <div className="mx-auto flex max-w-md items-center">
          <h1 className="text-2xl font-bold">Matches</h1>
          <div className="ml-auto inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            {[
              { key: "likes", label: "Likes" },
              { key: "matches", label: "Matches" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  mode === t.key
                    ? "bg-violet-600 text-white shadow"
                    : "text-gray-700 hover:bg-violet-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-1 max-w-md px-0 text-sm text-gray-600">
          {mode === "likes"
            ? "People who liked you — like back to match."
            : "People you liked — we’ll notify you when it’s a match."}
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-3">
        {loading ? (
          <SkeletonGrid />
        ) : err ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-card">
            <div className="text-red-600">Failed to load</div>
            <div className="mt-1 text-xs text-gray-500">{String(err)}</div>
            <div className="mt-3 text-xs text-gray-500">Pull to refresh or try again later.</div>
          </div>
        ) : !items.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-card">
            {mode === "likes" ? "No likes yet. Keep exploring!" : "No likes sent yet. Try liking some profiles."}
          </div>
        ) : (
          <>
            {limited && (
              <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                You’re seeing the first 5 {mode}. Upgrade to see all.
              </div>
            )}

            {groups.map((g) => (
              <section key={g.label} className="mb-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">{g.label}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {g.items.map((m) => {
                    const other = m.other || m;
                    const to = `/profile/${other.id || m.id}`;
                    return (
                      <MatchCard
                        key={m.id || other.id}
                        name={other.display_name || other.name || "Member"}
                        age={other.age}
                        img={other.avatar_url || other.photo || "https://picsum.photos/400/600"}
                        to={to}
                        mode={mode}
                        onPass={async () => {
                          try {
                            // Optional: decline/skip
                            if (matchesService.pass) await matchesService.pass(m.id || other.id, { mode });
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        onLike={async () => {
                          try {
                            // Optional: like back or re-like (depending on tab)
                            if (matchesService.likeBack) await matchesService.likeBack(m.id || other.id);
                            else if (matchesService.like) await matchesService.like(m.id || other.id);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

/* ============== UI Bits ============== */

function MatchCard({ name, age, img, to, mode, onPass, onLike }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
      <Link to={to} className="block">
        <div className="relative aspect-[3/4] w-full">
          <img src={img} alt={name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          {/* subtle top gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/20 to-transparent" />
          {/* bottom gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {/* name */}
          <div className="absolute left-2 bottom-12 right-2 text-white drop-shadow">
            <div className="truncate text-sm font-semibold">
              {name}
              {age ? `, ${age}` : ""}
            </div>
          </div>
        </div>
      </Link>

      {/* actions bar */}
      <div className="relative flex items-center justify-between px-3 py-2">
        <button
          onClick={onPass}
          className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          aria-label="Pass"
        >
          <i className="lni lni-close" />
        </button>

        {/* center divider (like the inspiration) */}
        <div className="h-6 w-px bg-gray-200" />

        <button
          onClick={onLike}
          className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white shadow-sm hover:bg-violet-700"
          aria-label={mode === "likes" ? "Like back" : "Like"}
        >
          <i className="lni lni-heart" />
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid({ n = 8 }) {
  return (
    <div className="animate-pulse">
      <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
            <div className="aspect-[3/4] w-full bg-gray-200" />
            <div className="flex items-center justify-between px-3 py-2">
              <div className="h-9 w-9 rounded-full bg-gray-200" />
              <div className="h-6 w-px bg-gray-200" />
              <div className="h-9 w-9 rounded-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}