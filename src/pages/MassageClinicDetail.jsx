// src/pages/MassageClinicDetail.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */

const DAYS_ORDER = [
  "Monday","Tuesday","Wednesday","Thursday",
  "Friday","Saturday","Sunday",
];

const CLINIC_SELECT = `
  id, name, description, phone, email, website,
  address, city, state, country,
  lat, lng, cover_url, rating, review_count,
  opening_hours, status, is_verified, is_featured,
  created_at, owner_id,
  clinic_specialties ( name ),
  clinic_media ( url, caption, sort_order )
`;

/* ================================================================
   PURE HELPERS
   ================================================================ */

function to12h(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

function formatDistanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1_000)} m` : `${km.toFixed(1)} km`;
}

function parseHours(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function getOpenStatus(hours) {
  if (!hours.length) return "unknown";
  const now      = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // Mon = 0
  const today    = DAYS_ORDER[todayIdx];
  const slot     = hours.find((h) => h.day === today);
  if (!slot) return "closed";
  const [fh, fm] = slot.from.split(":").map(Number);
  const [th, tm] = slot.to.split(":").map(Number);
  const nowMins  = now.getHours() * 60 + now.getMinutes();
  return nowMins >= fh * 60 + fm && nowMins < th * 60 + tm ? "open" : "closed";
}

function normaliseClinic(data) {
  return {
    ...data,
    specialties: data.clinic_specialties?.map((s) => s.name) ?? [],
    media: (data.clinic_media ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((m) => m.url),
  };
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ================================================================
   useFetchClinic
   ================================================================ */

function useFetchClinic(id) {
  const location = useLocation();

  // Seed from nav state but always re-fetch in background for freshness
  const [clinic,  setClinic]  = useState(() => {
    const s = location.state?.clinic;
    return s ? normaliseClinic(s) : null;
  });
  const [loading, setLoading] = useState(true); // always true on mount → triggers bg fetch
  const [error,   setError]   = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const doFetch = useCallback(async ({ showLoader = false } = {}) => {
    if (!id) { setError("Invalid clinic ID."); setLoading(false); return; }
    if (showLoader) setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("massage_clinics")
      .select(CLINIC_SELECT)
      .eq("id", id)
      .single();

    if (!mountedRef.current) return;

    if (err) {
      // Only show error if we have no cached data
      if (!clinic) setError("Clinic not found.");
    } else if (data) {
      setClinic(normaliseClinic(data));
    }
    setLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background fetch on mount (or explicit refetch)
  useEffect(() => {
    // If we have nav-state data, do a silent background refresh
    doFetch({ showLoader: !location.state?.clinic });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-validate on focus / visibility (handles back navigation)
  useEffect(() => {
    const onFocus    = () => doFetch({ showLoader: false });
    const onVisible  = () => {
      if (document.visibilityState === "visible") doFetch({ showLoader: false });
    };
    window.addEventListener("focus",            onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus",            onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [doFetch]);

  // Optimistic local update — lets callers patch the clinic without a full refetch
  const patchClinic = useCallback((patch) => {
    setClinic((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return { clinic, loading, error, refetch: () => doFetch({ showLoader: false }), patchClinic };
}

/* ================================================================
   useReviews
   ================================================================ */

function useReviews(clinicId) {
  const [reviews,        setReviews]        = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [myReview,       setMyReview]       = useState(null);
  const { user } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadReviews = useCallback(async () => {
    if (!clinicId) return;

    const { data } = await supabase
      .from("clinic_reviews")
      .select(`id, rating, body, created_at, author_id,
        profiles ( display_name, avatar_url )`)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!mountedRef.current) return;
    const list = data ?? [];
    setReviews(list);
    setMyReview(user ? (list.find((r) => r.author_id === user.id) ?? null) : null);
    setLoadingReviews(false);
  }, [clinicId, user]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const submitReview = useCallback(async ({ rating, body }) => {
    if (!user || !clinicId) throw new Error("Must be signed in to review.");
    const payload = { clinic_id: clinicId, author_id: user.id, rating, body };

    const { error } = myReview
      ? await supabase.from("clinic_reviews")
          .update({ rating, body }).eq("id", myReview.id)
      : await supabase.from("clinic_reviews").insert(payload);

    if (error) throw new Error(error.message);

    // Optimistic update — immediately show new review without a reload
    const now = new Date().toISOString();
    const newReview = {
      id:         myReview?.id ?? `temp-${Date.now()}`,
      rating,
      body,
      created_at: myReview?.created_at ?? now,
      author_id:  user.id,
      profiles:   { display_name: user.user_metadata?.display_name ?? "You", avatar_url: null },
    };
    setReviews((prev) =>
      myReview
        ? prev.map((r) => (r.id === myReview.id ? newReview : r))
        : [newReview, ...prev]
    );
    setMyReview(newReview);

    // Reconcile in background
    loadReviews();
  }, [user, clinicId, myReview, loadReviews]);

  const deleteReview = useCallback(async () => {
    if (!myReview) return;
    await supabase.from("clinic_reviews").delete().eq("id", myReview.id);
    // Optimistic removal
    setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
    setMyReview(null);
    loadReviews();
  }, [myReview, loadReviews]);

  return { reviews, loadingReviews, myReview, submitReview, deleteReview, loadReviews };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function MassageClinicDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { clinic, loading, error, refetch, patchClinic } = useFetchClinic(id);
  const { reviews, loadingReviews, myReview, submitReview, deleteReview } =
    useReviews(id);

  const [activePhoto,      setActivePhoto]      = useState(0);
  const [showAllHours,     setShowAllHours]      = useState(false);
  const [reviewDraft,      setReviewDraft]       = useState({ rating: 0, body: "" });
  const [reviewMode,       setReviewMode]        = useState(false);
  const [reviewSubmitting, setReviewSubmitting]  = useState(false);
  const [reviewError,      setReviewError]       = useState("");
  const [copied,           setCopied]            = useState(false);
  const [imgError,         setImgError]          = useState({});

  useEffect(() => {
    if (myReview) setReviewDraft({ rating: myReview.rating, body: myReview.body ?? "" });
  }, [myReview]);

  // Reset active photo when clinic changes (e.g. back-nav)
  useEffect(() => { setActivePhoto(0); }, [id]);

  const hours      = clinic ? parseHours(clinic.opening_hours) : [];
  const openStatus = getOpenStatus(hours);
  const isOwner    = !!(user && clinic && user.id === clinic.owner_id);

  const photos = [
    ...(clinic?.cover_url ? [clinic.cover_url] : []),
    ...(clinic?.media ?? []),
  ].filter((_, i) => !imgError[i]);

  /* ── handlers ──────────────────────────────────────────────── */

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: clinic?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      }
    } catch { /* user cancelled */ }
  }, [clinic?.name]);

  const handleReviewSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (isOwner) {
      setReviewError("Owners cannot review their own clinic.");
      return;
    }
    if (!reviewDraft.rating) {
      setReviewError("Please select a star rating.");
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await submitReview(reviewDraft);
      setReviewMode(false);
      // Optimistically update the aggregate rating shown in the header card
      patchClinic({
        review_count: (clinic?.review_count ?? 0) + (myReview ? 0 : 1),
      });
    } catch (err) {
      setReviewError(err.message || "Failed to submit. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }, [reviewDraft, submitReview, isOwner, myReview, clinic?.review_count, patchClinic]);

  const handleDeleteReview = useCallback(async () => {
    if (!confirm("Delete your review?")) return;
    await deleteReview();
    setReviewDraft({ rating: 0, body: "" });
    patchClinic({ review_count: Math.max(0, (clinic?.review_count ?? 1) - 1) });
  }, [deleteReview, patchClinic, clinic?.review_count]);

  /* ── loading / error ────────────────────────────────────────── */

  if (loading && !clinic) return <DetailSkeleton onBack={() => navigate(-1)} />;

  if (error && !clinic) {
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center
        justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-red-50 flex items-center
          justify-center">
          <WarningIcon className="h-10 w-10 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Clinic Not Found</h2>
          <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
            {error}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600
            px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700
            active:scale-95 transition-all"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-dvh bg-gray-50 pb-32 antialiased">

      {/* ══ PHOTO GALLERY ════════════════════════════════════════ */}
      <div className="relative bg-gray-900 select-none">
        {photos.length > 0 ? (
          <>
            <img
              key={photos[activePhoto]}
              src={photos[activePhoto]}
              alt={`${clinic.name} photo ${activePhoto + 1}`}
              onError={() => setImgError((prev) => ({ ...prev, [activePhoto]: true }))}
              className="h-72 w-full object-cover"
              loading="eager"
            />

            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t
              from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Dot indicators */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2
                flex items-center gap-1.5 z-10">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`rounded-full transition-all duration-200 ${
                      i === activePhoto
                        ? "h-2 w-6 bg-white"
                        : "h-1.5 w-1.5 bg-white/50 hover:bg-white/80"
                    }`}
                    aria-label={`View photo ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Photo count badge */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 right-4 rounded-full
                bg-black/50 backdrop-blur-sm px-2.5 py-1
                text-[11px] font-semibold text-white z-10">
                {activePhoto + 1} / {photos.length}
              </div>
            )}
          </>
        ) : (
          <div className="h-72 w-full bg-gradient-to-br from-violet-500
            to-purple-700 flex items-end pb-8 pl-6">
            <span className="text-7xl opacity-30">💆</span>
          </div>
        )}

        {/* ── Nav buttons overlay ── */}
        <div className="absolute left-4 right-4 top-4 flex items-center
          justify-between z-20">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl
              bg-black/40 backdrop-blur-md text-white border border-white/10
              hover:bg-black/60 active:scale-90 transition-all"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Share */}
            <button
              onClick={handleShare}
              className="flex h-10 w-10 items-center justify-center rounded-2xl
                bg-black/40 backdrop-blur-md text-white border border-white/10
                hover:bg-black/60 active:scale-90 transition-all"
              aria-label={copied ? "Copied!" : "Share"}
            >
              {copied
                ? <CheckIcon className="h-4 w-4 text-green-400" />
                : <ShareIcon className="h-4 w-4" />
              }
            </button>

            {/* Edit (owner) */}
            {isOwner && (
              <button
                onClick={() => navigate(`/massage-clinics/${id}/edit`)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl
                  bg-violet-600/90 backdrop-blur-md text-white border
                  border-violet-400/30 hover:bg-violet-700 active:scale-90
                  transition-all"
                aria-label="Edit clinic"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Status badges (bottom-left of hero) ── */}
        <div className="absolute left-4 bottom-8 flex items-center gap-2 z-10">
          {clinic.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full
              bg-amber-500/90 backdrop-blur-sm px-3 py-1
              text-[11px] font-bold text-white">
              <StarIcon className="h-3 w-3" filled />
              Featured
            </span>
          )}
          {clinic.status === "pending" && (
            <span className="rounded-full bg-amber-100/90 backdrop-blur-sm
              px-3 py-1 text-[11px] font-bold text-amber-800">
              Pending Approval
            </span>
          )}
        </div>
      </div>

      {/* ══ CONTENT ══════════════════════════════════════════════ */}
      <div className="mx-auto max-w-lg px-4 space-y-4 pt-4">

        {/* ── Stale data notice ── */}
        {error && clinic && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3
            flex items-center gap-3">
            <InfoIcon className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 flex-1">
              Showing cached data — {error}
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs font-bold text-amber-700 hover:text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Name / rating / address card ── */}
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Name + verified */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-extrabold text-gray-900 leading-tight">
                    {clinic.name}
                  </h1>
                  {clinic.is_verified && (
                    <VerifiedIcon className="h-5 w-5 text-violet-600 shrink-0" />
                  )}
                </div>

                {/* Address */}
                {(clinic.address || clinic.city) && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-sm text-gray-500">
                    <MapPinIcon className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
                    <span className="leading-snug">
                      {[clinic.address, clinic.city, clinic.state]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}

                {/* Rating */}
                {clinic.rating > 0 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <StarRow rating={Number(clinic.rating)} size="sm" />
                    <span className="text-sm font-bold text-gray-800">
                      {Number(clinic.rating).toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-400">
                      · {clinic.review_count ?? 0} review{(clinic.review_count ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Distance */}
                {clinic.distance_km != null && (
                  <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    {formatDistanceLabel(clinic.distance_km)} away
                  </p>
                )}
              </div>

              {/* Open / Closed pill */}
              {openStatus !== "unknown" && (
                <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs font-bold
                  flex items-center gap-1.5 ${
                    openStatus === "open"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    openStatus === "open" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  {openStatus === "open" ? "Open Now" : "Closed"}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          {/* ── Quick action strip ── */}
          <div className={`grid border-t border-gray-100 ${
            [clinic.phone, clinic.website, clinic.lat && clinic.lng, clinic.email]
              .filter(Boolean).length === 4
              ? "grid-cols-4"
              : [clinic.phone, clinic.website, clinic.lat && clinic.lng, clinic.email]
                  .filter(Boolean).length === 3
                ? "grid-cols-3"
                : "grid-cols-2"
          }`}>
            {clinic.phone && (
              <QuickAction
                href={`tel:${clinic.phone}`}
                icon={<PhoneIcon className="h-5 w-5" />}
                label="Call"
                first
              />
            )}
            {clinic.website && (
              <QuickAction
                href={clinic.website}
                icon={<GlobeIcon className="h-5 w-5" />}
                label="Website"
                external
              />
            )}
            {clinic.lat && clinic.lng && (
              <QuickAction
                href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`}
                icon={<DirectionsIcon className="h-5 w-5" />}
                label="Directions"
                external
              />
            )}
            {clinic.email && (
              <QuickAction
                href={`mailto:${clinic.email}`}
                icon={<MailIcon className="h-5 w-5" />}
                label="Email"
                last
              />
            )}
          </div>
        </div>

        {/* ── About ── */}
        {clinic.description && (
          <SectionCard title="About">
            <ExpandableText text={clinic.description} maxChars={250} />
          </SectionCard>
        )}

        {/* ── Specialties ── */}
        {clinic.specialties?.length > 0 && (
          <SectionCard title="Services & Specialties">
            <div className="flex flex-wrap gap-2">
              {clinic.specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full border
                    border-violet-200 bg-violet-50 px-3.5 py-1.5 text-sm
                    font-medium text-violet-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Opening hours ── */}
        {hours.length > 0 && (
          <SectionCard title="Opening Hours">
            <div className="space-y-0.5">
              {(showAllHours ? DAYS_ORDER : DAYS_ORDER).map((day, i) => {
                const slot    = hours.find((h) => h.day === day);
                const todayIdx = (new Date().getDay() + 6) % 7;
                const isToday  = i === todayIdx;
                if (!showAllHours && !isToday && i > todayIdx + 1) return null;
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between rounded-xl
                      px-3 py-2 text-sm transition-colors ${
                        isToday
                          ? "bg-violet-50 ring-1 ring-violet-100"
                          : "hover:bg-gray-50"
                      }`}
                  >
                    <span className={`font-medium ${
                      isToday ? "text-violet-700" : "text-gray-700"
                    }`}>
                      {day}
                      {isToday && (
                        <span className="ml-2 inline-block rounded-full
                          bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold
                          text-violet-600 uppercase tracking-wide">
                          Today
                        </span>
                      )}
                    </span>
                    {slot ? (
                      <span className={`tabular-nums ${
                        isToday
                          ? "font-bold text-violet-700"
                          : "text-gray-500"
                      }`}>
                        {to12h(slot.from)}–{to12h(slot.to)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowAllHours((v) => !v)}
              className="mt-2 text-xs font-bold text-violet-600
                hover:text-violet-800 transition-colors"
            >
              {showAllHours ? "Show less" : "Show all hours"}
            </button>
          </SectionCard>
        )}

        {/* ── Contact ── */}
        {(clinic.phone || clinic.email || clinic.website) && (
          <SectionCard title="Contact">
            <div className="space-y-1">
              {clinic.phone && (
                <ContactRow
                  icon={<PhoneIcon className="h-4 w-4" />}
                  label="Phone"
                  value={clinic.phone}
                  href={`tel:${clinic.phone}`}
                />
              )}
              {clinic.email && (
                <ContactRow
                  icon={<MailIcon className="h-4 w-4" />}
                  label="Email"
                  value={clinic.email}
                  href={`mailto:${clinic.email}`}
                />
              )}
              {clinic.website && (
                <ContactRow
                  icon={<GlobeIcon className="h-4 w-4" />}
                  label="Website"
                  value={clinic.website.replace(/^https?:\/\//, "")}
                  href={clinic.website}
                  external
                />
              )}
            </div>
          </SectionCard>
        )}

        {/* ══ REVIEWS ══════════════════════════════════════════════ */}
        <SectionCard
          title={`Reviews${clinic.review_count ? ` · ${clinic.review_count}` : ""}`}
        >
          {/* Owner notice */}
          {isOwner && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl
              bg-blue-50 border border-blue-100 p-4">
              <InfoIcon className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">This is your clinic</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Owners can't review their own listing.
                </p>
              </div>
            </div>
          )}

          {/* Write / edit CTA */}
          {user && !isOwner && (
            <div className="mb-4">
              {!reviewMode ? (
                <button
                  onClick={() => setReviewMode(true)}
                  className="w-full rounded-2xl border border-violet-200
                    bg-gradient-to-br from-violet-50 to-fuchsia-50/50
                    py-3 text-sm font-bold text-violet-700
                    hover:from-violet-100 hover:to-fuchsia-100
                    active:scale-[0.99] transition-all"
                >
                  {myReview ? "✏️ Edit Your Review" : "⭐ Write a Review"}
                </button>
              ) : (
                <ReviewForm
                  draft={reviewDraft}
                  onChange={setReviewDraft}
                  onSubmit={handleReviewSubmit}
                  onCancel={() => {
                    setReviewMode(false);
                    setReviewError("");
                  }}
                  submitting={reviewSubmitting}
                  error={reviewError}
                  isEdit={!!myReview}
                  onDelete={myReview ? handleDeleteReview : undefined}
                />
              )}
            </div>
          )}

          {/* Sign-in prompt */}
          {!user && (
            <div className="mb-4 rounded-2xl bg-gray-50 border border-gray-100
              p-4 text-center">
              <p className="text-sm text-gray-600">
                <button
                  onClick={() => navigate("/sign-in", {
                    state: { returnTo: window.location.pathname },
                  })}
                  className="font-bold text-violet-600 hover:underline"
                >
                  Sign in
                </button>
                {" "}to leave a review
              </p>
            </div>
          )}

          {/* List */}
          {loadingReviews ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <ReviewSkeleton key={i} />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm font-semibold text-gray-700">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} isMyReview={r.id === myReview?.id} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ================================================================
   QUICK ACTION STRIP ITEM
   ================================================================ */

function QuickAction({ href, icon, label, external = false, first, last }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`flex flex-col items-center gap-1.5 py-4 text-violet-600
        hover:bg-violet-50 active:bg-violet-100 transition-colors
        ${first  ? "rounded-bl-3xl" : ""}
        ${last   ? "rounded-br-3xl" : ""}
        border-r border-gray-100 last:border-r-0`}
    >
      {icon}
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
    </a>
  );
}

/* ================================================================
   SECTION CARD
   ================================================================ */

function SectionCard({ title, children }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
      <h2 className="mb-4 text-sm font-bold text-gray-900 tracking-tight">
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ================================================================
   EXPANDABLE TEXT
   ================================================================ */

function ExpandableText({ text, maxChars = 200 }) {
  const [expanded, setExpanded] = useState(false);
  const needsTrunc = text.length > maxChars;
  const shown = expanded || !needsTrunc ? text : `${text.slice(0, maxChars).trimEnd()}…`;
  return (
    <div>
      <p className="text-sm text-gray-600 leading-relaxed">{shown}</p>
      {needsTrunc && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800
            transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/* ================================================================
   STAR ROW
   ================================================================ */

function StarRow({ rating, interactive = false, onRate, size = "md" }) {
  const sz = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? "button" : undefined}
          onClick={interactive ? () => onRate(star) : undefined}
          disabled={!interactive}
          className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
          aria-label={interactive ? `Rate ${star} star${star !== 1 ? "s" : ""}` : undefined}
        >
          <StarIcon
            className={`${sz} transition-colors ${
              star <= Math.round(rating) ? "text-amber-400" : "text-gray-200"
            }`}
            filled
          />
        </button>
      ))}
    </div>
  );
}

/* ================================================================
   REVIEW FORM
   ================================================================ */

function ReviewForm({ draft, onChange, onSubmit, onCancel,
  submitting, error, isEdit, onDelete }) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-violet-100 bg-gradient-to-br
        from-violet-50/60 to-fuchsia-50/30 p-4 space-y-4"
    >
      {/* Star picker */}
      <div>
        <p className="text-xs font-bold text-gray-700 mb-2">Your Rating *</p>
        <div className="flex items-center gap-2">
          <StarRow
            rating={draft.rating}
            interactive
            onRate={(r) => onChange((d) => ({ ...d, rating: r }))}
            size="lg"
          />
          {draft.rating > 0 && (
            <span className="text-sm font-bold text-amber-500">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][draft.rating]}
            </span>
          )}
        </div>
      </div>

      {/* Text area */}
      <div>
        <p className="text-xs font-bold text-gray-700 mb-1.5">
          Your Review
          <span className="ml-1 font-normal text-gray-400">(optional)</span>
        </p>
        <textarea
          value={draft.body}
          onChange={(e) => onChange((d) => ({ ...d, body: e.target.value }))}
          placeholder="Share your experience…"
          rows={3}
          maxLength={1_000}
          className="w-full resize-none rounded-2xl border border-gray-200
            bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400
            focus:outline-none focus:border-violet-300 focus:ring-2
            focus:ring-violet-100 transition-all"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {draft.body.length}/1000
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50
          border border-red-200 px-4 py-3">
          <WarningIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-violet-600 py-2.5 text-sm font-bold
            text-white hover:bg-violet-700 disabled:opacity-60
            active:scale-[0.98] transition-all"
        >
          {submitting
            ? <span className="inline-flex items-center gap-2">
                <SpinnerIcon className="h-4 w-4" />
                Saving…
              </span>
            : isEdit ? "Update Review" : "Submit Review"
          }
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5
            text-sm font-medium text-gray-600 hover:bg-gray-50
            active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-10 w-10 items-center justify-center rounded-2xl
              bg-red-50 text-red-500 hover:bg-red-100 active:scale-90
              transition-all"
            aria-label="Delete review"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}

/* ================================================================
   REVIEW CARD
   ================================================================ */

function ReviewCard({ review, isMyReview }) {
  const author = review.profiles;
  return (
    <div className={`flex gap-3 ${isMyReview ? "p-3 rounded-2xl bg-violet-50/50 border border-violet-100" : ""}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {author?.avatar_url ? (
          <img
            src={author.avatar_url}
            alt={author.display_name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white"
            loading="lazy"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400
            to-fuchsia-400 flex items-center justify-center text-sm font-bold text-white
            ring-2 ring-white">
            {(author?.display_name?.[0] ?? "?").toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate">
              {author?.display_name ?? "Anonymous"}
            </span>
            {isMyReview && (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5
                text-[10px] font-bold text-violet-700">
                You
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {timeAgo(review.created_at)}
          </span>
        </div>

        <StarRow rating={review.rating} size="sm" />

        {review.body && (
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
            {review.body}
          </p>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CONTACT ROW
   ================================================================ */

function ContactRow({ icon, label, value, href, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5
        hover:bg-gray-50 active:bg-gray-100 transition-colors group"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center
        rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-100
        transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <p className="text-sm text-gray-800 truncate">{value}</p>
      </div>
      <ChevronRightIcon className="h-4 w-4 text-gray-300 shrink-0
        group-hover:text-gray-400 transition-colors" />
    </a>
  );
}

/* ================================================================
   SKELETONS
   ================================================================ */

function DetailSkeleton({ onBack }) {
  return (
    <div className="min-h-dvh bg-gray-50 animate-pulse">
      <div className="relative h-72 bg-gray-200">
        <button
          onClick={onBack}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center
            rounded-2xl bg-black/30 text-white"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        <div className="rounded-3xl bg-white border border-gray-100 p-5 space-y-3">
          <div className="h-6 bg-gray-200 rounded-full w-2/3" />
          <div className="h-4 bg-gray-100 rounded-full w-1/2" />
          <div className="flex gap-1">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-4 w-4 rounded bg-gray-200" />
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2">
            {[1,2,3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-3xl bg-white border border-gray-100 p-5 space-y-2">
            <div className="h-4 bg-gray-200 rounded-full w-24" />
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 bg-gray-100 rounded-full w-1/3" />
        <div className="h-3 bg-gray-100 rounded-full w-1/4" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
      </div>
    </div>
  );
}

/* ================================================================
   SVG ICONS
   ================================================================ */

function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ShareIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59"  y2="10.49" />
    </svg>
  );
}

function PencilIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
      <path d="M17.586 3.586a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function StarIcon({ className = "h-5 w-5", filled = false }) {
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969
           0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755
           1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197
           -1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588
           -1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function PhoneIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07
        9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7
        2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.52a2 2 0 012.11-.45
        12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function MailIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function GlobeIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function DirectionsIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="8" strokeWidth={2.5} />
      <line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}

function VerifiedIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0
           001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066
           0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066
           0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066
           0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066
           0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9
           10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
    </svg>
  );
}