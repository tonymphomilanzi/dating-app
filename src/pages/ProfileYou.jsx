// src/pages/ProfileYou.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import TextField from "../components/TextField.jsx";
import Tag from "../components/Tag.jsx";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_BIO_LENGTH  = 500;
const MAX_PHOTOS      = 9;
const PHOTO_MAX_SIZE  = 5 * 1024 * 1024;
const ALLOWED_TYPES   = ["image/jpeg", "image/png", "image/webp"];
const REQUEST_TIMEOUT = 10_000;

/* ================================================================
   UTILITIES
   ================================================================ */

const sanitizeName = (name) =>
  String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

function withTimeout(promise, ms, label = "request") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPublicUrl(path) {
  const { data } = supabase.storage.from("profiles").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/* ================================================================
   SKELETON
   ================================================================ */

function SkeletonBlock({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-gray-200 ${className}`} />
  );
}

function SkeletonLine({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-full bg-gray-200 ${className}`} />
  );
}

function SkeletonChip() {
  return <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />;
}

/* ================================================================
   TOAST
   ================================================================ */

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-in slide-in-from-top duration-300 pointer-events-none">
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-5 py-3
          shadow-2xl backdrop-blur-xl border text-sm font-semibold
          ${isError
            ? "bg-red-500/95 border-red-400/50 text-white"
            : "bg-white/97 border-gray-200 text-gray-900 shadow-gray-200/80"
          }`}
      >
        {isError
          ? <XCircleIcon className="h-5 w-5 shrink-0" />
          : <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" />
        }
        {toast.message}
      </div>
    </div>
  );
}

/* ================================================================
   COMPLETENESS BAR
   ================================================================ */

function CompletenessBar({ score, hints }) {
  const color =
    score >= 80 ? "from-green-400 to-emerald-500" :
    score >= 50 ? "from-amber-400 to-orange-400" :
                  "from-violet-500 to-fuchsia-500";

  return (
    <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-white">Profile Strength</span>
        <span className={`text-sm font-extrabold ${
          score >= 80 ? "text-green-300" :
          score >= 50 ? "text-amber-300" : "text-violet-300"
        }`}>
          {score}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>

      {hints.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {hints.slice(0, 3).map((hint, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/80">
              <ChevronRightIcon className="h-3 w-3 shrink-0 text-white/50" />
              {hint}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   HERO SECTION
   ================================================================ */

function HeroSection({
  heroUrl,
  heroPath,
  displayName,
  completeness,
  loading,
  onPreview,
  onAddPhotos,
  onDeleteHero,
}) {
  return (
    <div className="relative h-[48vh] w-full overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-50 to-pink-100">
      {loading ? (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      ) : heroUrl ? (
        <>
          <img
            src={heroUrl}
            alt="Primary profile photo"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-violet-400">
          <div className="h-20 w-20 rounded-full bg-violet-100 flex items-center justify-center">
            <ImageIcon className="h-10 w-10" />
          </div>
          <p className="text-sm font-semibold">Add your primary photo</p>
          <p className="text-xs text-violet-300">Make a great first impression</p>
        </div>
      )}

      {/* Top actions */}
      <div className="absolute inset-x-0 top-0 p-4 flex items-start justify-between gap-3">
        <div className="rounded-full bg-black/40 backdrop-blur-md border border-white/20 px-3.5 py-2">
          <span className="text-xs font-bold text-white tracking-wide">
            Edit Profile
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-black/55 active:scale-95 transition-all"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            Preview
          </button>

          <button
            onClick={onAddPhotos}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900 shadow-lg hover:bg-white/90 active:scale-95 transition-all"
          >
            <CameraIcon className="h-3.5 w-3.5" />
            Add Photos
          </button>

          {heroUrl && heroPath && (
            <button
              onClick={onDeleteHero}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-red-500/80 active:scale-95 transition-all"
              aria-label="Delete primary photo"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-5 space-y-3">
        {displayName || loading ? (
          loading ? (
            <SkeletonLine className="h-9 w-48" />
          ) : (
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight drop-shadow-lg">
              {displayName}
            </h1>
          )
        ) : (
          <h1 className="text-2xl font-bold text-white/50 italic">
            Your Name
          </h1>
        )}
        <CompletenessBar score={completeness.score} hints={completeness.hints} />
      </div>
    </div>
  );
}

/* ================================================================
   PHOTO TILE
   ================================================================ */

function PhotoTile({ src, index, isPrimary, onMakePrimary, onDelete }) {
  const [imgError,   setImgError]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this photo?")) return;
    setIsDeleting(true);
    try      { await onDelete(); }
    catch    (err) { console.error("Delete failed:", err); }
    finally  { setIsDeleting(false); }
  };

  if (imgError) {
    return (
      <div className="aspect-square rounded-2xl bg-gray-100 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400">
        <ImageIcon className="h-6 w-6" />
        <span className="text-[10px]">Failed</span>
      </div>
    );
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200">
      <img
        src={src}
        alt={`Photo ${index + 1}`}
        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        draggable={false}
        onError={() => setImgError(true)}
        loading="lazy"
      />

      {isPrimary && (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
          <StarIcon className="h-2.5 w-2.5" />
          Primary
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="absolute inset-x-2 bottom-2 flex gap-1.5">
          {!isPrimary && (
            <button
              onClick={onMakePrimary}
              className="flex-1 rounded-xl bg-white/95 py-1.5 text-[11px] font-bold text-gray-900 hover:bg-white active:scale-95 transition-all shadow"
            >
              Set Primary
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/90 text-white hover:bg-red-600 active:scale-95 transition-all shadow disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isDeleting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <SpinnerIcon className="h-6 w-6 text-white" />
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SECTION CARD WRAPPER
   ================================================================ */

function SectionCard({ children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-50">
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ================================================================
   ALERT BANNERS
   ================================================================ */

function AlertBanner({ type = "error", title, body, onDismiss }) {
  const styles = {
    error:   "bg-red-50 border-red-200 text-red-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    info:    "bg-violet-50 border-violet-200 text-violet-900",
    upload:  "bg-violet-50 border-violet-200 text-violet-900",
  };
  const iconColor = {
    error:   "text-red-500",
    warning: "text-amber-500",
    info:    "text-violet-500",
    upload:  "text-violet-500",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${iconColor[type]}`}>
          {type === "error"   && <XCircleIcon  className="h-5 w-5" />}
          {type === "warning" && <WarningIcon  className="h-5 w-5" />}
          {type === "info"    && <InfoIcon     className="h-5 w-5" />}
          {type === "upload"  && <SpinnerIcon  className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{title}</p>
          {body && <p className="mt-0.5 text-xs opacity-80">{body}</p>}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   PREMIUM BANNER (inline teaser)
   ================================================================ */

function PremiumTeaser({ onUpgrade }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-pink-500 p-5 shadow-lg shadow-orange-200">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-white/10" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">
          👑
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-white text-base leading-tight">
            Upgrade to Premium
          </p>
          <p className="mt-0.5 text-xs text-white/85 leading-relaxed">
            Unlimited likes · See who liked you · Boost visibility
          </p>
        </div>
      </div>

      <button
        onClick={onUpgrade}
        className="mt-4 w-full rounded-2xl bg-white py-3 text-sm font-extrabold text-orange-600 shadow-md hover:bg-orange-50 active:scale-[0.98] transition-all"
      >
        See Plans →
      </button>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function ProfileYou() {
  const navigate = useNavigate();
  const { profile: me, user, signOut, reloadProfile } = useAuth();

  /* ── UI state ─────────────────────────────────────────────── */
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [toast,      setToast]      = useState(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  /* ── Form fields ──────────────────────────────────────────── */
  const [displayName, setDisplayName] = useState("");
  const [profession,  setProfession]  = useState("");
  const [city,        setCity]        = useState("");
  const [bio,         setBio]         = useState("");
  const originalRef = useRef({});

  /* ── Interests ────────────────────────────────────────────── */
  const [allInterests,      setAllInterests]      = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [savingInterests,   setSavingInterests]   = useState(false);

  /* ── Photos ───────────────────────────────────────────────── */
  const [heroUrl,   setHeroUrl]   = useState(null);
  const [heroPath,  setHeroPath]  = useState(null);
  const [gallery,   setGallery]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef(null);

  /* ── Location / logout ────────────────────────────────────── */
  const [locating,   setLocating]   = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  /* ── Abort / mount guards ─────────────────────────────────── */
  const mountedRef   = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── Toast helper ─────────────────────────────────────────── */
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    const id = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 3_000);
    return () => clearTimeout(id);
  }, []);

  /* ── Unsaved-changes detection ────────────────────────────── */
  useEffect(() => {
    const orig = originalRef.current;
    setHasUnsaved(
      displayName !== orig.displayName ||
      profession  !== orig.profession  ||
      city        !== orig.city        ||
      bio         !== orig.bio
    );
  }, [displayName, profession, city, bio]);

  useEffect(() => {
    const handler = (e) => {
      if (hasUnsaved) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  /* ── Load all profile data ────────────────────────────────── */
  useEffect(() => {
    if (!me?.id) { setLoading(false); return; }

    let cancelled = false;
    const reqId   = ++requestIdRef.current;

    (async () => {
      try {
        setError("");

        const [
          { data: profile,      error: profErr },
          { data: interests                    },
          { data: userInterests                },
          { data: photos                       },
        ] = await Promise.all([
          withTimeout(
            supabase
              .from("profiles")
              .select("id,display_name,profession,bio,city,avatar_url,lat,lng")
              .eq("id", me.id)
              .maybeSingle(),
            REQUEST_TIMEOUT, "profile"
          ),
          withTimeout(
            supabase.from("interests").select("id,label").order("label"),
            REQUEST_TIMEOUT, "interests"
          ),
          withTimeout(
            supabase
              .from("user_interests")
              .select("interests:interests(label)")
              .eq("user_id", me.id),
            REQUEST_TIMEOUT, "user_interests"
          ),
          withTimeout(
            supabase
              .from("photos")
              .select("path,is_primary,sort,created_at")
              .eq("user_id", me.id)
              .order("is_primary", { ascending: false })
              .order("sort",       { ascending: true  })
              .order("created_at", { ascending: true  }),
            REQUEST_TIMEOUT, "photos"
          ),
        ]);

        if (profErr)                                     throw profErr;
        if (cancelled || requestIdRef.current !== reqId) return;

        const name = profile?.display_name || "";
        const prof = profile?.profession   || "";
        const cty  = profile?.city         || "";
        const bio_ = profile?.bio          || "";

        setDisplayName(name);
        setProfession(prof);
        setCity(cty);
        setBio(bio_);
        originalRef.current = { displayName: name, profession: prof, city: cty, bio: bio_ };

        setAllInterests(interests || []);
        setSelectedInterests(
          (userInterests || []).map((r) => r.interests?.label).filter(Boolean)
        );

        const unique = Array.from(
          new Map((photos || []).map((p) => [p.path, p])).values()
        );
        const primary     = unique.find((p) => p.is_primary) || unique[0] || null;
        const heroPublicUrl = primary?.path
          ? getPublicUrl(primary.path)
          : profile?.avatar_url || null;

        setHeroUrl(heroPublicUrl);
        setHeroPath(primary?.path ?? null);
        setGallery(
          unique
            .filter((p) => p.path !== primary?.path)
            .map((p) => ({ url: getPublicUrl(p.path), path: p.path }))
            .filter((p) => p.url)
        );
      } catch (err) {
        console.error("[ProfileYou] load:", err);
        if (!cancelled && requestIdRef.current === reqId)
          setError(err.message || "Failed to load profile");
      } finally {
        if (!cancelled && requestIdRef.current === reqId && mountedRef.current)
          setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [me?.id]);

  /* ── Profile completeness ─────────────────────────────────── */
  const completeness = useMemo(() => {
    let score = 0;
    const hints = [];

    if (displayName?.trim())             score += 20; else hints.push("Add your name");
    if (heroUrl)                         score += 25; else hints.push("Add a primary photo");
    if (selectedInterests.length >= 3)   score += 20;
    else hints.push(`Pick ${Math.max(0, 3 - selectedInterests.length)} more interest${3 - selectedInterests.length !== 1 ? "s" : ""}`);
    if (bio?.trim()?.length >= 50)       score += 15;
    else if (bio?.trim())                { score += 8; hints.push("Extend your bio to 50+ chars"); }
    else                                 hints.push("Write a bio about yourself");
    if (city?.trim())                    score += 10; else hints.push("Add your city");
    if (profession?.trim())              score += 5;  else hints.push("Add your profession");
    if (gallery.length >= 3)             score += 5;
    else hints.push(`Add ${Math.max(0, 3 - gallery.length)} more photo${3 - gallery.length !== 1 ? "s" : ""}`);

    return { score: Math.min(score, 100), hints };
  }, [displayName, heroUrl, selectedInterests.length, bio, city, profession, gallery.length]);

  /* ── Save profile ─────────────────────────────────────────── */
  const saveProfile = async () => {
    if (!me?.id) return;
    if (!displayName.trim()) { setError("Name is required"); return; }

    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          profession:   profession.trim() || null,
          city:         city.trim()       || null,
          bio:          bio.trim()        || null,
          updated_at:   new Date().toISOString(),
        })
        .eq("id", me.id);
      if (err) throw err;

      originalRef.current = { displayName, profession, city, bio };
      await reloadProfile();
      showToast("Profile saved!");
    } catch (err) {
      console.error("[ProfileYou] save:", err);
      setError(err.message || "Failed to save");
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Location ─────────────────────────────────────────────── */
  const setMyLocation = async () => {
    if (!me?.id) return;
    setLocating(true);
    setError("");
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000,
        });
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      const { error: err } = await supabase
        .from("profiles")
        .update({ lat, lng, location_updated_at: new Date().toISOString() })
        .eq("id", me.id);
      if (err) throw err;
      await reloadProfile();
      showToast("Location updated!");
    } catch (err) {
      console.error("[ProfileYou] location:", err);
      setError(err.message || "Failed to get location");
      showToast("Could not get location", "error");
    } finally {
      setLocating(false);
    }
  };

  /* ── Interests ────────────────────────────────────────────── */
  const toggleInterest = useCallback(
    (label) =>
      setSelectedInterests((prev) =>
        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
      ),
    []
  );

  const saveInterests = async () => {
    if (!me?.id) return;
    setSavingInterests(true);
    setError("");
    try {
      const { data: catalog } = await supabase.from("interests").select("id,label");
      const labelToId = Object.fromEntries(
        (catalog || []).map((i) => [String(i.label).toLowerCase(), i.id])
      );
      const ids = selectedInterests
        .map((l) => labelToId[String(l).toLowerCase()])
        .filter(Boolean);

      const { error: delErr } = await supabase
        .from("user_interests").delete().eq("user_id", me.id);
      if (delErr) throw delErr;

      if (ids.length > 0) {
        const { error: insErr } = await supabase
          .from("user_interests")
          .insert(ids.map((id) => ({ user_id: me.id, interest_id: id })));
        if (insErr) throw insErr;
      }
      showToast("Interests saved!");
    } catch (err) {
      console.error("[ProfileYou] interests:", err);
      setError(err.message || "Failed to save interests");
      showToast("Failed to save interests", "error");
    } finally {
      setSavingInterests(false);
    }
  };

  /* ── Photo upload ─────────────────────────────────────────── */
  const handlePhotoUpload = async (files) => {
    if (!files?.length || !user?.id) return;

    const totalNow = (heroUrl ? 1 : 0) + gallery.length;
    if (totalNow + files.length > MAX_PHOTOS) {
      const msg = `Maximum ${MAX_PHOTOS} photos allowed`;
      setError(msg); showToast(msg, "error"); return;
    }
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        const msg = "Only JPEG, PNG and WebP images are allowed";
        setError(msg); showToast(msg, "error"); return;
      }
      if (f.size > PHOTO_MAX_SIZE) {
        const msg = `Photos must be smaller than ${formatFileSize(PHOTO_MAX_SIZE)}`;
        setError(msg); showToast(msg, "error"); return;
      }
    }

    setUploading(true); setError(""); setUploadPct(0);
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const file     = files[i];
        const fileName = `${user.id}/${Date.now()}-${sanitizeName(file.name)}`;
        setUploadPct(Math.round(((i + 0.5) / files.length) * 100));
        const { error: upErr } = await supabase.storage.from("profiles").upload(fileName, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("photos").insert({ user_id: user.id, path: fileName, is_primary: false });
        if (insErr) throw insErr;
        const url = getPublicUrl(fileName);
        if (url) uploaded.push({ url, path: fileName });
        setUploadPct(Math.round(((i + 1) / files.length) * 100));
      }
      if (!heroUrl && uploaded.length > 0) {
        await makePrimaryPhoto(uploaded[0].path, true);
        if (uploaded.length > 1) setGallery((prev) => [...prev, ...uploaded.slice(1)]);
      } else {
        setGallery((prev) => [...prev, ...uploaded]);
      }
      showToast(`${uploaded.length} photo${uploaded.length !== 1 ? "s" : ""} uploaded!`);
    } catch (err) {
      console.error("[ProfileYou] upload:", err);
      setError(err.message || "Upload failed");
      showToast("Upload failed", "error");
    } finally {
      setUploading(false); setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── Make primary ─────────────────────────────────────────── */
  const makePrimaryPhoto = async (path, silent = false) => {
    if (!user?.id) return;
    try {
      await supabase.from("photos").update({ is_primary: false }).eq("user_id", user.id);
      const { error: err } = await supabase.from("photos").update({ is_primary: true }).eq("user_id", user.id).eq("path", path);
      if (err) throw err;
      const url = getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      const oldHeroUrl  = heroUrl;
      const oldHeroPath = heroPath;
      setHeroUrl(url);
      setHeroPath(path);
      setGallery((prev) => {
        const without = prev.filter((p) => p.path !== path);
        if (oldHeroUrl && oldHeroPath) return [{ url: oldHeroUrl, path: oldHeroPath }, ...without];
        return without;
      });
      if (!silent) showToast("Primary photo updated!");
    } catch (err) {
      console.error("[ProfileYou] makePrimary:", err);
      if (!silent) { setError(err.message || "Failed to set primary photo"); showToast("Failed to set primary photo", "error"); }
    }
  };

  /* ── Delete photo ─────────────────────────────────────────── */
  const deletePhoto = async (path) => {
    if (!me?.id) return;
    try {
      const { error: stErr } = await supabase.storage.from("profiles").remove([path]);
      if (stErr) throw stErr;
      const { error: dbErr } = await supabase.from("photos").delete().eq("path", path).eq("user_id", me.id);
      if (dbErr) throw dbErr;

      const deletingHero = path === heroPath;
      if (deletingHero) {
        const next = gallery[0] ?? null;
        if (next) { await makePrimaryPhoto(next.path, true); }
        else {
          setHeroUrl(null); setHeroPath(null);
          await supabase.from("profiles").update({ avatar_url: null }).eq("id", me.id);
        }
      } else {
        setGallery((prev) => prev.filter((p) => p.path !== path));
      }
      showToast("Photo deleted");
    } catch (err) {
      console.error("[ProfileYou] delete:", err);
      setError(err.message || "Failed to delete photo");
      showToast("Failed to delete photo", "error");
    }
  };

  /* ── Logout ───────────────────────────────────────────────── */
  const handleLogout = async () => {
    const msg = hasUnsaved ? "You have unsaved changes. Log out anyway?" : "Are you sure you want to log out?";
    if (!confirm(msg)) return;
    setLoggingOut(true);
    try { await signOut(); navigate("/auth", { replace: true }); }
    catch (err) {
      console.error("[ProfileYou] logout:", err);
      setError(err.message || "Failed to log out");
      showToast("Failed to log out", "error");
    } finally { setLoggingOut(false); }
  };

  const previewProfile = useCallback(() => {
    if (me?.id) navigate(`/profile/${me.id}`);
  }, [me?.id, navigate]);

  const totalPhotos = (heroUrl ? 1 : 0) + gallery.length;

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 pb-36 antialiased">
      <TopBar title="" />
      <Toast toast={toast} />

      {/* Hero */}
      <HeroSection
        heroUrl={heroUrl}
        heroPath={heroPath}
        displayName={displayName}
        completeness={completeness}
        loading={loading}
        onPreview={previewProfile}
        onAddPhotos={() => fileInputRef.current?.click()}
        onDeleteHero={() => heroPath && deletePhoto(heroPath)}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handlePhotoUpload(Array.from(e.target.files || []))}
      />

      {/* Content */}
      <div className="-mt-4 space-y-4 px-4 relative z-10">

        {error && (
          <AlertBanner type="error" title="Something went wrong" body={error} onDismiss={() => setError("")} />
        )}
        {hasUnsaved && !saving && (
          <AlertBanner type="warning" title="Unsaved changes" body="Don't forget to save your profile below." />
        )}
        {uploading && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-violet-900">Uploading…</span>
              <span className="text-sm font-extrabold text-violet-600">{uploadPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-violet-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Premium Teaser ── */}
        <PremiumTeaser onUpgrade={() => navigate("/subscription")} />

        {/* ── Basic Information ── */}
        <SectionCard>
          <SectionHeader
            title="Basic Information"
            subtitle="Shown on your public profile"
            action={
              saving && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600">
                  <SpinnerIcon className="h-3.5 w-3.5" />
                  Saving…
                </span>
              )
            }
          />
          <div className="p-5 space-y-4">
            {loading ? (
              <>
                <SkeletonLine className="h-12 w-full" />
                <SkeletonLine className="h-12 w-full" />
                <SkeletonLine className="h-12 w-full" />
                <SkeletonLine className="h-32 w-full" />
              </>
            ) : (
              <>
                <TextField
                  label="Name *"
                  placeholder="Your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <TextField
                  label="Profession"
                  placeholder="What do you do?"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                />
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <TextField
                      label="City"
                      placeholder="City, Country"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={setMyLocation}
                    disabled={locating}
                    title="Use my current location"
                    className="mb-0.5 flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-gray-200 text-violet-600 hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {locating ? <SpinnerIcon className="h-5 w-5" /> : <MapPinIcon className="h-5 w-5" />}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                    About You
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                    placeholder="Tell people about yourself, your hobbies, what you're looking for…"
                    rows={5}
                    maxLength={MAX_BIO_LENGTH}
                    className="w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <span className={`text-xs ${bio.length >= 50 ? "text-green-600 font-medium" : "text-gray-400"}`}>
                      {bio.length >= 50 ? "✓ Looks great!" : `${50 - bio.length} more characters to go`}
                    </span>
                    <span className={`text-xs font-medium ${bio.length >= MAX_BIO_LENGTH ? "text-red-500" : "text-gray-400"}`}>
                      {bio.length}/{MAX_BIO_LENGTH}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={saving || loading || !displayName.trim()}
                  className="w-full"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <SpinnerIcon className="h-4 w-4" /> Saving…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <SaveIcon className="h-4 w-4" /> Save Changes
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </SectionCard>

        {/* ── Interests ── */}
        <SectionCard>
          <SectionHeader
            title="Interests"
            subtitle={selectedInterests.length === 0 ? "Pick at least 3 to get better matches" : `${selectedInterests.length} selected`}
          />
          <div className="p-5 space-y-4">
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 14 }).map((_, i) => <SkeletonChip key={i} />)}
              </div>
            ) : allInterests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No interests available</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {allInterests.map((interest) => (
                    <Tag
                      key={interest.id}
                      label={interest.label}
                      active={selectedInterests.includes(interest.label)}
                      onClick={() => toggleInterest(interest.label)}
                    />
                  ))}
                </div>
                <Button
                  onClick={saveInterests}
                  disabled={savingInterests || loading || selectedInterests.length === 0}
                  className="w-full"
                  variant="secondary"
                >
                  {savingInterests ? (
                    <span className="inline-flex items-center gap-2">
                      <SpinnerIcon className="h-4 w-4" /> Saving…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <SaveIcon className="h-4 w-4" /> Save Interests
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </SectionCard>

        {/* ── Photo Gallery ── */}
        <SectionCard>
          <SectionHeader
            title="Photo Gallery"
            subtitle={`${totalPhotos} / ${MAX_PHOTOS} photos`}
            action={
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || totalPhotos >= MAX_PHOTOS}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add
              </button>
            }
          />
          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="aspect-square" />)}
              </div>
            ) : gallery.length === 0 && !heroUrl ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">No photos yet</p>
                  <p className="text-xs text-gray-400 mt-1">Profiles with 5+ photos get 3× more matches</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-100 px-5 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-200 active:scale-95 transition-all"
                >
                  <UploadIcon className="h-4 w-4" /> Upload Photos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {heroUrl && (
                  <PhotoTile
                    src={heroUrl} index={0} isPrimary
                    onMakePrimary={() => {}}
                    onDelete={() => deletePhoto(heroPath)}
                  />
                )}
                {gallery.map((photo, i) => (
                  <PhotoTile
                    key={photo.path}
                    src={photo.url}
                    index={heroUrl ? i + 1 : i}
                    isPrimary={false}
                    onMakePrimary={() => makePrimaryPhoto(photo.path)}
                    onDelete={() => deletePhoto(photo.path)}
                  />
                ))}
                {totalPhotos < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <PlusIcon className="h-7 w-7" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Add</span>
                  </button>
                )}
              </div>
            )}
            {gallery.length > 0 && gallery.length < 5 && (
              <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-3.5">
                <div className="flex items-start gap-2.5">
                  <InfoIcon className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    <span className="font-bold">Pro tip:</span>{" "}
                    Add at least 5 photos to increase your profile views by 3×!
                  </p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Account ── */}
        <SectionCard>
          <SectionHeader title="Account" subtitle={user?.email} />
          <div className="p-5 space-y-3">
            <button
              onClick={previewProfile}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <EyeIcon className="h-4 w-4" /> Preview My Profile
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loggingOut
                ? <><SpinnerIcon className="h-4 w-4" /> Logging out…</>
                : <><LogOutIcon  className="h-4 w-4" /> Log Out</>
              }
            </button>
          </div>
        </SectionCard>

        {/* ── Motivational footer ── */}
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-violet-200">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-2xl">
              ✨
            </div>
            <div>
              <h3 className="font-extrabold text-base mb-1">
                {completeness.score < 80 ? "Almost there!" : "Your profile rocks!"}
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {completeness.score < 80
                  ? `Complete your profile to ${100 - completeness.score}% more and get 5× more matches.`
                  : "Keep your profile fresh to stay at the top of discovery."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          STICKY PREMIUM CTA BAR  (like Tinder / Bumble)
          ════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
        {/* Fade-out mask so content beneath feels natural */}
        <div className="h-6 bg-gradient-to-t from-gray-50 to-transparent" />

        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 pt-3 pb-safe pointer-events-auto"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <button
            onClick={() => navigate("/subscription")}
            className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 py-4 text-base font-extrabold text-white shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 active:scale-[0.98] transition-all"
          >
            {/* Shimmer effect */}
            <span className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-200%] animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="relative flex items-center justify-center gap-2.5">
              <span className="text-xl">👑</span>
              Get Premium — Unlock Everything
              <span className="ml-1 rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold">
                50% OFF
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   INLINE SVG ICONS
   ================================================================ */

function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}
function CheckCircleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function XCircleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
function XIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="8" strokeWidth={2.5} /><line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  );
}
function ImageIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function CameraIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function EyeIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function StarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function SaveIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function ChevronRightIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function UploadIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
    </svg>
  );
}
function LogOutIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}