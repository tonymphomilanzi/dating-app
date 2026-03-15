import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
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

// Helpers
const isFiniteNum = (n) => Number.isFinite(Number(n));
const isValidLatLng = (lat, lng) =>
  isFiniteNum(lat) && isFiniteNum(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

const withSupaTimeout = async (promise, ms, label = "timeout") => {
  let timer;
  try {
    const out = await Promise.race([
      promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${label}:${ms}`)), ms); }),
    ]);
    return out; // { data, error }
  } finally {
    clearTimeout(timer);
  }
};

export default function UserProfile() {
  const nav = useNavigate();
  const { id } = useParams();
  const loc = useLocation();
  // Seed from card (fast first paint)
  const seed = loc.state?.person || null;
  const { profile: me } = useAuth();

  const [profile, setProfile] = useState(seed || null);
  const [interests, setInterests] = useState([]);
  const [heroUrl, setHeroUrl] = useState(null);
  const [gallery, setGallery] = useState([]); // grid only (hero excluded)
  const [loading, setLoading] = useState(!seed);
  const [err, setErr] = useState("");

  // Guards for race/abort
  const isMountedRef = useRef(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Load data
  useEffect(() => {
    let cancelled = false;
    const rid = ++reqIdRef.current;

    (async () => {
      setErr(seed ? "" : "");
      if (!seed) setLoading(true);

      try {
        // 1) Profile: try profile_public first; fallback to profiles if missing
        let p = null;
        try {
          const { data: p1, error: e1 } = await withSupaTimeout(
            supabase
              .from("profile_public")
              .select("id, display_name, age, avatar_url, city, lat, lng, gender, bio, dob")
              .eq("id", id)
              .maybeSingle(),
            8000,
            "profile"
          );
          if (e1) throw e1;
          p = p1;
        } catch {
          // Fallback: profiles (fields subset)
          const { data: p2, error: e2 } = await withSupaTimeout(
            supabase
              .from("profiles")
              .select("id, display_name, avatar_url, city, lat, lng, gender, bio, dob")
              .eq("id", id)
              .maybeSingle(),
            8000,
            "profile-fallback"
          );
          if (e2) throw e2;
          // Derive age from dob if exists
          if (p2?.dob) {
            const birth = new Date(p2.dob);
            const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
            p = { ...p2, age };
          } else {
            p = p2;
          }
        }

        if (cancelled || reqIdRef.current !== rid || !isMountedRef.current) return;

        // 2) Interests
        let labels = [];
        try {
          const { data: r2, error: e2 } = await withSupaTimeout(
            supabase
              .from("user_interests")
              .select("interests:interests(label)")
              .eq("user_id", id),
            6000,
            "interests"
          );
          if (!e2 && Array.isArray(r2)) {
            labels = r2.map((r) => (r?.interests?.label ? String(r.interests.label) : null)).filter(Boolean);
          }
        } catch {
          // ignore errors — show no interests
        }

        if (cancelled || reqIdRef.current !== rid || !isMountedRef.current) return;

        // 3) Photos
        let photos = [];
        try {
          const { data: ph, error: e3 } = await withSupaTimeout(
            supabase
              .from("photos")
              .select("path, is_primary, sort, created_at")
              .eq("user_id", id)
              .order("is_primary", { ascending: false })
              .order("sort", { ascending: true })
              .order("created_at", { ascending: true }),
            6000,
            "photos"
          );
          if (e3) throw e3;
          photos = ph || [];
        } catch {
          // ignore errors — use avatar_url only
          photos = [];
        }

        if (cancelled || reqIdRef.current !== rid || !isMountedRef.current) return;

        // Deduplicate + derive hero + grid
        const byPath = new Map();
        for (const ph of photos) if (ph?.path && !byPath.has(ph.path)) byPath.set(ph.path, ph);
        const unique = Array.from(byPath.values());

        const primary = unique.find((ph) => ph.is_primary) || unique[0];
        const toUrl = (path) => supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

        const hero = primary?.path ? toUrl(primary.path) : (p?.avatar_url || null);
        const gridUrls = unique
          .filter((ph) => ph.path !== primary?.path)
          .map((ph) => toUrl(ph.path))
          .filter(Boolean);

        // Set state
        setProfile({
          id: p?.id,
          display_name: p?.display_name || seed?.display_name,
          age: p?.age ?? (p?.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : seed?.age ?? null),
          avatar_url: p?.avatar_url || seed?.avatar_url || null,
          city: p?.city || seed?.city || "",
          lat: isFiniteNum(p?.lat) ? Number(p.lat) : seed?.lat ?? null,
          lng: isFiniteNum(p?.lng) ? Number(p.lng) : seed?.lng ?? null,
          bio: p?.bio || seed?.bio || "",
          distance_km: seed?.distance_km ?? null,
        });
        setInterests(labels);
        setHeroUrl(hero);
        setGallery(gridUrls);
        setErr("");
      } catch (e) {
        console.error("[UserProfile] load error:", e);
        if (!cancelled && reqIdRef.current === rid && isMountedRef.current) {
          setErr(e.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled && reqIdRef.current === rid && isMountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [id, seed]);

  // Distance (safe)
  const distanceKm = useMemo(() => {
    const myLat = me?.lat, myLng = me?.lng;
    const theirLat = profile?.lat, theirLng = profile?.lng;

    if (isValidLatLng(Number(myLat), Number(myLng)) && isValidLatLng(Number(theirLat), Number(theirLng))) {
      const d = kmBetween(Number(myLat), Number(myLng), Number(theirLat), Number(theirLng));
      return Math.round(d * 10) / 10;
    }
    return profile?.distance_km ?? null;
  }, [me?.lat, me?.lng, profile?.lat, profile?.lng, profile?.distance_km]);

  const name = profile?.display_name || "Member";
  const about = profile?.bio || "";

  const doSwipe = useCallback(async (dir) => {
    try {
      await swipesService.swipe({ targetUserId: id, dir });
    } catch (e) {
      console.error("[UserProfile] swipe error", e);
      alert(e.message || "Failed");
    }
  }, [id]);

  // open viewer: hero is index 0, grid images start at 1
  const openViewer = useCallback((initialIndex = 0) => {
    const images = [heroUrl, ...gallery].filter(Boolean);
    if (!images.length) return;
    nav(`/profile/${id}/gallery?i=${initialIndex}`, { state: { images, name } });
  }, [heroUrl, gallery, id, name, nav]);

  const handleOpenChat = useCallback(async () => {
    try {
      const r = await chatService.openOrSendToUser({ userId: id });
      const convId = r?.conversation?.id || r?.conversationId || r?.id;
      if (convId) nav(`/chat/${convId}`);
      else alert("Could not open conversation");
    } catch (e) {
      alert(e.message || "Failed to open chat");
    }
  }, [id, nav]);

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
            onClick={handleOpenChat}
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

        {/* About */}
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
                  <img src={src} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
            {gallery.length > 2 && (
              <div className="grid grid-cols-3 gap-3">
                {gallery.slice(2, 5).map((src, i) => (
                  <button key={`g-bot-${i}`} onClick={() => openViewer(i + 3)} className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    <img src={src} alt={`Gallery ${i + 3}`} className="h-full w-full object-cover" draggable={false} />
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