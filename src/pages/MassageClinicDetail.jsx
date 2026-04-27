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

/**
 * Parse opening_hours — stored as a JSON string or array.
 * Returns an array of { day, from, to } or [].
 */
function parseHours(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/**
 * Determine if the clinic is open right now.
 * Returns "open" | "closed" | "unknown"
 */
function getOpenStatus(hours) {
  if (!hours.length) return "unknown";
  const now   = new Date();
  const today = DAYS_ORDER[(now.getDay() + 6) % 7]; // Mon=0
  const slot  = hours.find((h) => h.day === today);
  if (!slot) return "closed";

  const [fh, fm] = slot.from.split(":").map(Number);
  const [th, tm] = slot.to.split(":").map(Number);
  const nowMins  = now.getHours() * 60 + now.getMinutes();
  const fromMins = fh * 60 + fm;
  const toMins   = th * 60 + tm;

  return nowMins >= fromMins && nowMins < toMins ? "open" : "closed";
}

/* ================================================================
   HOOK: useFetchClinic
   Tries to use navigation state (passed from the list) first,
   then falls back to a Supabase query for direct URL access.
   ================================================================ */

function useFetchClinic(id) {
  const location = useLocation();

  const [clinic,    setClinic]    = useState(location.state?.clinic ?? null);
  const [loading,   setLoading]   = useState(!location.state?.clinic);
  const [error,     setError]     = useState("");

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Already have data from navigation state — no fetch needed
    if (clinic) return;
    if (!id) { setError("Invalid clinic ID."); setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      setError("");

      const { data, error: err } = await supabase
        .from("massage_clinics")
        .select(`
          id, name, description, phone, email, website,
          address, city, state, country,
          lat, lng, cover_url, rating, review_count,
          opening_hours, status, is_verified, is_featured,
          created_at, owner_id,
          clinic_specialties ( name ),
          clinic_media ( url, caption, sort_order )
        `)
        .eq("id", id)
        .single();

      if (!mountedRef.current) return;

      if (err) {
        setError("Clinic not found or you don't have permission to view it.");
      } else {
        setClinic({
          ...data,
          specialties : data.clinic_specialties?.map((s) => s.name) ?? [],
          media       : (data.clinic_media ?? [])
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((m) => m.url),
        });
      }
      setLoading(false);
    };

    fetch();
  }, [id, clinic]);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("massage_clinics")
      .select(`
        id, name, description, phone, email, website,
        address, city, state, country,
        lat, lng, cover_url, rating, review_count,
        opening_hours, status, is_verified, is_featured,
        created_at, owner_id,
        clinic_specialties ( name ),
        clinic_media ( url, caption, sort_order )
      `)
      .eq("id", id)
      .single();

    if (!mountedRef.current) return;
    if (!err && data) {
      setClinic({
        ...data,
        specialties: data.clinic_specialties?.map((s) => s.name) ?? [],
        media: (data.clinic_media ?? [])
                 .sort((a, b) => a.sort_order - b.sort_order)
                 .map((m) => m.url),
      });
    }
    setLoading(false);
  }, [id]);

  return { clinic, loading, error, refetch };
}

/* ================================================================
   HOOK: useReviews
   ================================================================ */

function useReviews(clinicId) {
  const [reviews,      setReviews]      = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [myReview,     setMyReview]     = useState(null);

  const { user } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadReviews = useCallback(async () => {
    if (!clinicId) return;
    setLoadingReviews(true);

    const { data } = await supabase
      .from("clinic_reviews")
      .select(`
        id, rating, body, created_at,
        profiles ( display_name, avatar_url )
      `)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!mountedRef.current) return;

    const list = data ?? [];
    setReviews(list);
    if (user) setMyReview(list.find((r) => r.author_id === user.id) ?? null);
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
    await loadReviews();
  }, [user, clinicId, myReview, loadReviews]);

  const deleteReview = useCallback(async () => {
    if (!myReview) return;
    await supabase.from("clinic_reviews").delete().eq("id", myReview.id);
    await loadReviews();
  }, [myReview, loadReviews]);

  return { reviews, loadingReviews, myReview, submitReview, deleteReview };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function MassageClinicDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const { clinic, loading, error, refetch } = useFetchClinic(id);
  const { reviews, loadingReviews, myReview, submitReview, deleteReview } =
    useReviews(id);

  const [activePhoto, setActivePhoto] = useState(0);
  const [showAllHours, setShowAllHours] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ rating: 0, body: "" });
  const [reviewMode, setReviewMode] = useState(false); // write | false
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [copied, setCopied] = useState(false);

  // Pre-fill draft with existing review
  useEffect(() => {
    if (myReview) setReviewDraft({ rating: myReview.rating, body: myReview.body ?? "" });
  }, [myReview]);

  const hours      = clinic ? parseHours(clinic.opening_hours) : [];
  const openStatus = getOpenStatus(hours);
  const isOwner    = user && clinic && user.id === clinic.owner_id;

  // All photos = cover + media gallery
  const photos = [
    ...(clinic?.cover_url ? [clinic.cover_url] : []),
    ...(clinic?.media ?? []),
  ];

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: clinic?.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [clinic?.name]);

  const handleReviewSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!reviewDraft.rating) { setReviewError("Please select a star rating."); return; }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await submitReview(reviewDraft);
      setReviewMode(false);
      refetch(); // refresh rating cache
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  }, [reviewDraft, submitReview, refetch]);

  const handleDeleteReview = useCallback(async () => {
    if (!window.confirm("Delete your review?")) return;
    await deleteReview();
    setReviewDraft({ rating: 0, body: "" });
    refetch();
  }, [deleteReview, refetch]);

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh bg-white">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="min-h-dvh bg-white flex flex-col items-center justify-center
        gap-4 p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-50 grid place-items-center">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
                 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800">{error || "Clinic not found"}</p>
        <button onClick={() => navigate(-1)}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm
            font-semibold text-white hover:bg-violet-700">
          Go Back
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-gray-50 pb-32">

      {/* ── Photo gallery ── */}
      <div className="relative bg-gray-100">
        {photos.length > 0 ? (
          <>
            <img
              src={photos[activePhoto]}
              alt={clinic.name}
              className="h-72 w-full object-cover"
              loading="eager"
            />
            {/* Dot indicators */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2
                flex items-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`rounded-full transition-all ${
                      i === activePhoto
                        ? "h-2 w-6 bg-white"
                        : "h-2 w-2 bg-white/50 hover:bg-white/80"
                    }`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="absolute bottom-10 left-0 right-0 overflow-x-auto
                no-scrollbar flex gap-2 px-4">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`shrink-0 h-10 w-10 overflow-hidden rounded-lg
                      transition-all ${i === activePhoto
                        ? "ring-2 ring-white ring-offset-1"
                        : "opacity-60 hover:opacity-90"}`}
                  >
                    <img src={p} alt={`Photo ${i + 1}`}
                      className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="h-72 w-full bg-gradient-to-br from-violet-100 to-purple-200
            grid place-items-center">
            <svg className="h-20 w-20 text-violet-300" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0
                   00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2
                   2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586
                   1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782
                   0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        )}

        {/* Back + action buttons overlay */}
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="grid h-9 w-9 place-items-center rounded-full
              bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {/* Share */}
            <button
              onClick={handleShare}
              className="grid h-9 w-9 place-items-center rounded-full
                bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
              aria-label="Share"
            >
              {copied ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938
                       -.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632
                       3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684
                       3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684
                       3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </button>

            {/* Edit (owner only) */}
            {isOwner && (
              <button
                onClick={() => navigate(`/massage-clinics/${id}/edit`)}
                className="grid h-9 w-9 place-items-center rounded-full
                  bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                aria-label="Edit clinic"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0
                       002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828
                       15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="absolute left-4 bottom-4 flex items-center gap-2">
          {clinic.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full
              bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-white
              backdrop-blur-sm">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1
                  1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1
                  1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8
                  -2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539
                  -1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38
                  -1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Featured
            </span>
          )}
          {clinic.status === "pending" && (
            <span className="rounded-full bg-amber-100/90 px-2.5 py-1
              text-[11px] font-bold text-amber-700 backdrop-blur-sm">
              Pending Approval
            </span>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-lg px-4 space-y-4 pt-5">

        {/* ── Name + rating ── */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {clinic.name}
                </h1>
                {clinic.is_verified && (
                  <span title="Verified clinic" className="shrink-0">
                    <svg className="h-5 w-5 text-violet-600" fill="currentColor"
                      viewBox="0 0 20 20">
                      <path fillRule="evenodd" clipRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0
                           013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812
                           2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010
                           3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812
                           2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976
                           0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812
                           -2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010
                           -3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812
                           -2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707
                           9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Address */}
              {clinic.address && (
                <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                  <svg className="h-3.5 w-3.5 shrink-0 text-violet-500" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827
                         0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="line-clamp-1">{clinic.address}</span>
                </div>
              )}
            </div>

            {/* Open/closed badge */}
            {openStatus !== "unknown" && (
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                openStatus === "open"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-red-50 text-red-600 ring-1 ring-red-200"
              }`}>
                {openStatus === "open" ? "Open Now" : "Closed"}
              </span>
            )}
          </div>

          {/* Rating row */}
          {(clinic.rating > 0 || clinic.review_count > 0) && (
            <div className="mt-3 flex items-center gap-2">
              <StarRow rating={Number(clinic.rating)} />
              <span className="text-sm font-semibold text-gray-800">
                {Number(clinic.rating).toFixed(1)}
              </span>
              <span className="text-sm text-gray-400">
                ({clinic.review_count} review{clinic.review_count !== 1 ? "s" : ""})
              </span>
            </div>
          )}

          {/* Distance (passed via nav state) */}
          {clinic.distance_km != null && (
            <p className="mt-2 text-xs text-gray-400">
              {formatDistanceLabel(clinic.distance_km)} away
            </p>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="grid grid-cols-3 gap-3">
          {clinic.phone && (
            <a href={`tel:${clinic.phone}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white
                border border-gray-100 py-3.5 shadow-sm hover:bg-violet-50
                hover:border-violet-200 transition-all group">
              <div className="grid h-9 w-9 place-items-center rounded-full
                bg-violet-50 group-hover:bg-violet-100 transition-colors">
                <svg className="h-5 w-5 text-violet-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1
                       1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516
                       5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0
                       01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Call</span>
            </a>
          )}

          {clinic.website && (
            <a href={clinic.website} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white
                border border-gray-100 py-3.5 shadow-sm hover:bg-violet-50
                hover:border-violet-200 transition-all group">
              <div className="grid h-9 w-9 place-items-center rounded-full
                bg-violet-50 group-hover:bg-violet-100 transition-colors">
                <svg className="h-5 w-5 text-violet-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0
                       01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657
                       0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Website</span>
            </a>
          )}

          {clinic.lat && clinic.lng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white
                border border-gray-100 py-3.5 shadow-sm hover:bg-violet-50
                hover:border-violet-200 transition-all group">
              <div className="grid h-9 w-9 place-items-center rounded-full
                bg-violet-50 group-hover:bg-violet-100 transition-colors">
                <svg className="h-5 w-5 text-violet-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0
                       011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553
                       2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15
                       4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Directions</span>
            </a>
          )}

          {clinic.email && (
            <a href={`mailto:${clinic.email}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white
                border border-gray-100 py-3.5 shadow-sm hover:bg-violet-50
                hover:border-violet-200 transition-all group">
              <div className="grid h-9 w-9 place-items-center rounded-full
                bg-violet-50 group-hover:bg-violet-100 transition-colors">
                <svg className="h-5 w-5 text-violet-600" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2
                       0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700">Email</span>
            </a>
          )}
        </div>

        {/* ── Description ── */}
        {clinic.description && (
          <Card title="About">
            <p className="text-sm text-gray-600 leading-relaxed">{clinic.description}</p>
          </Card>
        )}

        {/* ── Specialties ── */}
        {clinic.specialties?.length > 0 && (
          <Card title="Services & Specialties">
            <div className="flex flex-wrap gap-2">
              {clinic.specialties.map((s) => (
                <span key={s}
                  className="rounded-full border border-violet-200 bg-violet-50
                    px-3.5 py-1.5 text-sm font-medium text-violet-700">
                  {s}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* ── Opening hours ── */}
        {hours.length > 0 && (
          <Card title="Opening Hours">
            <div className="space-y-0.5">
              {(showAllHours ? DAYS_ORDER : DAYS_ORDER.slice(0, 3)).map((day) => {
                const slot    = hours.find((h) => h.day === day);
                const isToday = day === DAYS_ORDER[(new Date().getDay() + 6) % 7];
                return (
                  <div key={day}
                    className={`flex items-center justify-between rounded-xl
                      px-3 py-2 text-sm transition-colors
                      ${isToday ? "bg-violet-50" : ""}`}>
                    <span className={`font-medium ${
                      isToday ? "text-violet-700" : "text-gray-700"
                    }`}>
                      {day}
                      {isToday && (
                        <span className="ml-1.5 text-[10px] font-bold
                          text-violet-500 uppercase tracking-wide">Today</span>
                      )}
                    </span>
                    {slot ? (
                      <span className={isToday ? "text-violet-600 font-semibold" : "text-gray-500"}>
                        {to12h(slot.from)} – {to12h(slot.to)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            {DAYS_ORDER.length > 3 && (
              <button
                onClick={() => setShowAllHours((v) => !v)}
                className="mt-2 text-xs font-semibold text-violet-600
                  hover:text-violet-800 transition-colors">
                {showAllHours ? "Show less" : `Show all ${DAYS_ORDER.length} days`}
              </button>
            )}
          </Card>
        )}

        {/* ── Contact info ── */}
        {(clinic.phone || clinic.email || clinic.website) && (
          <Card title="Contact">
            <div className="space-y-3">
              {clinic.phone && (
                <ContactRow
                  icon={<PhoneIcon />}
                  label="Phone"
                  value={clinic.phone}
                  href={`tel:${clinic.phone}`}
                />
              )}
              {clinic.email && (
                <ContactRow
                  icon={<EmailIcon />}
                  label="Email"
                  value={clinic.email}
                  href={`mailto:${clinic.email}`}
                />
              )}
              {clinic.website && (
                <ContactRow
                  icon={<WebIcon />}
                  label="Website"
                  value={clinic.website.replace(/^https?:\/\//, "")}
                  href={clinic.website}
                  external
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Reviews ── */}
        <Card title={`Reviews${clinic.review_count ? ` (${clinic.review_count})` : ""}`}>

          {/* Write / edit review CTA */}
          {user && !isOwner && (
            <div className="mb-4">
              {!reviewMode ? (
                <button
                  onClick={() => setReviewMode(true)}
                  className="w-full rounded-2xl border border-violet-200 bg-violet-50
                    py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100
                    transition-colors">
                  {myReview ? "Edit Your Review" : "Write a Review"}
                </button>
              ) : (
                <ReviewForm
                  draft={reviewDraft}
                  onChange={setReviewDraft}
                  onSubmit={handleReviewSubmit}
                  onCancel={() => setReviewMode(false)}
                  submitting={reviewSubmitting}
                  error={reviewError}
                  isEdit={!!myReview}
                  onDelete={myReview ? handleDeleteReview : undefined}
                />
              )}
            </div>
          )}

          {/* Review list */}
          {loadingReviews ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <ReviewSkeleton key={i} />)}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">
              No reviews yet. Be the first!
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

// ── Section card wrapper ──────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// ── Star row ─────────────────────────────────────────────────────

function StarRow({ rating, interactive = false, onRate }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? "button" : undefined}
          onClick={interactive ? () => onRate(star) : undefined}
          disabled={!interactive}
          className={interactive ? "cursor-pointer" : "cursor-default"}
          aria-label={interactive ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
        >
          <svg
            className={`h-5 w-5 transition-colors ${
              star <= rating ? "text-amber-400" : "text-gray-200"
            } ${interactive ? "hover:text-amber-300" : ""}`}
            fill="currentColor" viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1
              1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1
              1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8
              -2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539
              -1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38
              -1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Review form ───────────────────────────────────────────────────

function ReviewForm({ draft, onChange, onSubmit, onCancel,
  submitting, error, isEdit, onDelete }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-violet-100
      bg-violet-50/40 p-4 space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">Your Rating</p>
        <StarRow
          rating={draft.rating}
          interactive
          onRate={(r) => onChange((d) => ({ ...d, rating: r }))}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">
          Your Review <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <textarea
          value={draft.body}
          onChange={(e) => onChange((d) => ({ ...d, body: e.target.value }))}
          placeholder="Share your experience…"
          rows={3}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-gray-200
            bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <p className="mt-0.5 text-right text-xs text-gray-400">
          {draft.body.length}/1000
        </p>
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={submitting}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold
            text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
          {submitting ? "Saving…" : isEdit ? "Update Review" : "Submit Review"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5
            text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium
              text-red-500 hover:bg-red-100 transition-colors"
            aria-label="Delete review">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                   01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1
                   1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}

// ── Review card ───────────────────────────────────────────────────

function ReviewCard({ review }) {
  const author = review.profiles;
  const date   = new Date(review.created_at).toLocaleDateString([], {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt={author.display_name}
            className="h-9 w-9 rounded-full object-cover" loading="lazy" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-violet-100 grid
            place-items-center text-sm font-bold text-violet-600">
            {(author?.display_name?.[0] ?? "?").toUpperCase()}
          </div>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {author?.display_name ?? "Anonymous"}
          </span>
          <span className="text-xs text-gray-400 shrink-0">{date}</span>
        </div>
        <StarRow rating={review.rating} />
        {review.body && (
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
            {review.body}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Contact row ───────────────────────────────────────────────────

function ContactRow({ icon, label, value, href, external }) {
  return (
    <a href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1
        hover:bg-gray-50 transition-colors group">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full
        bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="text-sm text-gray-800 truncate">{value}</p>
      </div>
      <svg className="h-4 w-4 text-gray-300 ml-auto shrink-0" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-72 w-full bg-gray-200" />
      <div className="mx-auto max-w-lg px-4 pt-5 space-y-4">
        <div className="rounded-2xl bg-white border border-gray-100 p-5">
          <div className="h-6 bg-gray-200 rounded-full w-2/3" />
          <div className="mt-2 h-4 bg-gray-100 rounded-full w-1/2" />
          <div className="mt-3 flex gap-1">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-5 w-5 rounded bg-gray-200" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 h-20" />
          ))}
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 p-5">
          <div className="h-4 bg-gray-200 rounded-full w-24 mb-3" />
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-3 bg-gray-100 rounded-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-100 rounded-full w-1/3" />
        <div className="h-3 bg-gray-100 rounded-full w-1/4" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
      </div>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────

const PhoneIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0
         01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13
         -2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2
         2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0
         002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WebIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0
         01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657
         0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);