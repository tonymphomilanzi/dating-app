import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../api/lib/supabase";
import { useAuth } from "../contexts/AuthContext.jsx";
import { kmBetween } from "../utils/geo.js";
import { swipesService } from "../services/swipes.service.js";
import { chatService } from "../services/chat.service.js";
// Skeletons
const Sk = {
  block: ({ className = "" }) => <div className={`animate-pulse rounded bg-gray-200 ${className}`} />,
  line: ({ w = "w-40", h = "h-4", className = "" }) => <div className={`animate-pulse rounded ${w} ${h} bg-gray-200 ${className}`} />,
  chip: () => <div className="animate-pulse rounded-full bg-gray-200 h-6 w-20" />,
  tile: ({ ratio = "aspect-square" }) => <div className={`animate-pulse rounded-xl bg-gray-200 ${ratio}`} />,
};

export default function UserProfile() {
  const nav = useNavigate();
  const { id } = useParams();
  const loc = useLocation();
  // seed from card (fast first paint)
  const seed = loc.state?.person || null;
  const { profile: me } = useAuth();

  const [profile, setProfile] = useState(seed || null);
  const [interests, setInterests] = useState([]);
  const [heroUrl, setHeroUrl] = useState(null);
  const [gallery, setGallery] = useState([]); // grid only (hero excluded)
  const [loading, setLoading] = useState(!seed);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Public profile
        const { data: p, error: e1 } = await supabase
          .from("profile_public")
          .select("id, display_name, age, avatar_url, city, lat, lng, gender, bio, dob")
          .eq("id", id)
          .maybeSingle();
        if (e1) throw e1;

        // Interests (RLS policy above allows read)
        const r2 = await supabase
          .from("user_interests")
          .select("interests:interests(label)")
          .eq("user_id", id);
        const labels = !r2.error && Array.isArray(r2.data)
          ? r2.data.map(r => r.interests?.label).filter(Boolean)
          : [];

        // Photos
        const { data: photos, error: e3 } = await supabase
          .from("photos")
          .select("path, is_primary, sort, created_at")
          .eq("user_id", id)
          .order("is_primary", { ascending: false })
          .order("sort", { ascending: true })
          .order("created_at", { ascending: true });
        if (e3) throw e3;

        // De-dupe by path
        const byPath = new Map();
        for (const ph of photos || []) if (!byPath.has(ph.path)) byPath.set(ph.path, ph);
        const unique = Array.from(byPath.values());

        // Pick hero: primary or first
        const primary = unique.find(ph => ph.is_primary) || unique[0];
        const toUrl = (path) => supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

        const hero = primary?.path ? toUrl(primary.path) : (p?.avatar_url || null);
        // Grid = all others except hero path; if only hero exists, grid = []
        const gridUrls = unique
          .filter(ph => ph.path !== primary?.path)
          .map(ph => toUrl(ph.path))
          .filter(Boolean);

        if (cancelled) return;

        setProfile({
          id: p?.id,
          display_name: p?.display_name,
          age: p?.age ?? (p?.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25*24*3600*1000)) : null),
          avatar_url: p?.avatar_url,
          city: p?.city || "",
          lat: p?.lat, lng: p?.lng,
          bio: p?.bio || "", // leave blank if none
        });
        setInterests(labels);
        setHeroUrl(hero);
        setGallery(gridUrls);
      } catch (e) {
        console.error("[UserProfile] load error:", e);
        setErr(e.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const distanceKm = useMemo(() => {
    if (me?.lat != null && me?.lng != null && profile?.lat != null && profile?.lng != null) {
      return Math.round(kmBetween(+me.lat, +me.lng, +profile.lat, +profile.lng) * 10) / 10;
    }
    return profile?.distance_km ?? null;
  }, [me?.lat, me?.lng, profile?.lat, profile?.lng, profile?.distance_km]);

  const name = profile?.display_name || "Member";
  const about = profile?.bio || ""; // blank if none

  const doSwipe = async (dir) => {
    try { await swipesService.swipe({ targetUserId: id, dir }); }
    catch (e) { console.error("[UserProfile] swipe error", e); alert(e.message || "Failed"); }
  };

  // open viewer: hero is index 0, grid images start at 1
  const openViewer = (initialIndex = 0) => {
    const images = [heroUrl, ...gallery].filter(Boolean);
    if (!images.length) return;
    nav(`/profile/${id}/gallery?i=${initialIndex}`, { state: { images, name } });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <div className="relative h-[46vh] w-full overflow-hidden">
        {loading ? (
          <Sk.block className="h-full w-full" />
        ) : heroUrl ? (
          <img onClick={() => openViewer(0)} src={heroUrl} alt={name} className="h-full w-full object-cover cursor-zoom-in" draggable={false} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">No photo</div>
        )}
        {/* Top controls */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm" aria-label="Back">
            <i className="lni lni-chevron-left text-xl" />
          </button>
          <div className="flex items-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm" aria-label="Share">
              <i className="lni lni-share text-lg" />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm" aria-label="More">
              <i className="lni lni-more text-lg" />
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Content sheet */}
      <div className="relative -mt-8 rounded-t-3xl bg-white px-5 pb-8 pt-10">
        {/* Floating actions */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => doSwipe("left")} className="grid h-12 w-12 place-items-center rounded-full bg-white text-gray-700 shadow-card" aria-label="Nope">
              <i className="lni lni-close text-2xl text-orange-500" />
            </button>
            <button onClick={() => doSwipe("right")} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-fuchsia-600 to-violet-600 text-white shadow-glow" aria-label="Like">
              <i className="lni lni-heart text-2xl" />
            </button>
            <button onClick={() => doSwipe("super")} className="grid h-12 w-12 place-items-center rounded-full bg-white text-violet-600 shadow-card" aria-label="Favorite">
              <i className="lni lni-star text-2xl" />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="mt-6 flex items-start gap-3">
          <div className="flex-1">
            {loading ? (
              <>
                <Sk.line w="w-40" h="h-5" />
                <Sk.line w="w-24" h="h-3" className="mt-2" />
              </>
            ) : (
              <h1 className="text-xl font-semibold">
                {name}{profile?.age ? `, ${profile.age}` : ""}
              </h1>
            )}
          </div>
        <button
  onClick={async ()=>{
    try {
      const r = await chatService.openOrSendToUser({ userId: id });
      const convId = r?.conversation?.id;
      if (convId) nav(`/chat/${convId}`);
    } catch (e) { alert(e.message || "Failed to open chat"); }
  }}
  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 text-violet-600"
  aria-label="Send"
>
  <i className="lni lni-telegram-original text-lg" />
</button>
        </div>

        {/* Location */}
        <div className="mt-5">
          <h2 className="text-sm font-semibold">Location</h2>
          <div className="mt-1 flex items-center justify-between">
            {loading ? (
              <>
                <Sk.line w="w-48" />
                <Sk.chip />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">{profile?.city || ""}</p>
                {distanceKm != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                    <i className="lni lni-map-marker text-sm" />
                    {distanceKm} km
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* About (blank if none) */}
        {loading ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold">About</h2>
            <div className="mt-2 space-y-2">
              <Sk.line w="w-full" />
              <Sk.line w="w-5/6" />
              <Sk.line w="w-2/3" />
            </div>
          </div>
        ) : about ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold">About</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">{about}</p>
          </div>
        ) : null}

        {/* Interests */}
        {loading ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold">Interests</h2>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => <Sk.chip key={i} />)}
            </div>
          </div>
        ) : interests.length ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold">Interests</h2>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {interests.map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-sm text-violet-700 ring-1 ring-violet-200">
                  <i className="lni lni-checkmark text-xs" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Gallery (grid only if there are images beyond hero) */}
        {loading ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <Sk.line w="w-24" />
              <Sk.line w="w-12" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Sk.tile ratio="aspect-[4/5]" />
              <Sk.tile ratio="aspect-[4/5]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Sk.tile /><Sk.tile /><Sk.tile />
            </div>
          </div>
        ) : gallery.length ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Gallery</h2>
              <button className="text-sm font-medium text-violet-700" onClick={() => openViewer(0)}>See all</button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {gallery.slice(0, 2).map((src, i) => (
                <button key={`g-top-${i}`} onClick={() => openViewer(i + 1)} className="aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                  <img src={src} alt={`Gallery ${i+1}`} className="h-full w-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
            {gallery.length > 2 && (
              <div className="grid grid-cols-3 gap-3">
                {gallery.slice(2, 5).map((src, i) => (
                  <button key={`g-bot-${i}`} onClick={() => openViewer(i + 3)} className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    <img src={src} alt={`Gallery ${i+3}`} className="h-full w-full object-cover" draggable={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {err && <div className="mt-6 text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}