import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import { streamsService } from "../services/streams.service.js";

// Keep static assets outside of components to avoid unnecessary re-renders
const DEFAULT_AVATAR = "/me.jpg";

function IconPillButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 active:scale-95 transition"
    >
      {children}
    </button>
  );
}

function CountText({ children }) {
  return <div className="mt-1 text-[11px] font-semibold text-white/90">{children}</div>;
}

function SwipeDownHint() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <ChevronDownIcon className="h-6 w-6 animate-bounce text-white/85" />
    </div>
  );
}

function formatCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`.replace(".0", "");
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`.replace(".0", "");
  return `${num}`;
}

function Stage({ children }) {
  return (
    <div className="relative z-10 mx-auto flex h-dvh w-full items-center justify-center px-0 sm:px-4 md:px-8">
      <div className="relative overflow-hidden bg-black h-dvh w-full sm:h-[92dvh] sm:max-h-[900px] sm:aspect-[9/16] sm:w-auto sm:rounded-[2.25rem] sm:border sm:border-white/10 sm:shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        {children}
      </div>
    </div>
  );
}

/**
 * Optimizations inside StreamPage:
 * - Only mounts the actual <video> tag if it is "isNear" (active, prev, or next).
 * - Autoplays when active and pauses when inactive, freeing up system resources.
 */
function StreamPage({ item, isActive, isNear, muted, toggleMute, onBack, onFollow, onOpenProfile, onViewed }) {
  const [liked, setLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const userPausedRef = useRef(false);
  const videoRef = useRef(null);

  // Auto-play / Auto-pause when visibility changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isActive) {
      if (!userPausedRef.current) {
        v.play().catch(() => {});
      }
    } else {
      v.pause();
      v.currentTime = 0; // Reset video to beginning when scrolled away
      userPausedRef.current = false; // Reset the manual pause memory
    }
  }, [isActive]);

  // Read video playing/paused state natively
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    setIsPaused(v.paused);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [isNear]); // Remount listener if video mounts

  const viewedOnceRef = useRef(false);
  useEffect(() => {
    if (isActive && !viewedOnceRef.current) {
      viewedOnceRef.current = true;
      onViewed?.();
    }
    if (!isActive) viewedOnceRef.current = false;
  }, [isActive, onViewed]);

  const togglePlayPause = async () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      userPausedRef.current = false;
      try { await v.play(); } catch {}
    } else {
      v.pause();
      userPausedRef.current = true;
    }
  };

  return (
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-neutral-950 text-white">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${item?.creator?.avatar_url || DEFAULT_AVATAR})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(28px)",
            transform: "scale(1.12)",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-black/65" />

      <Stage>
        {/* Tap layer */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="absolute inset-0 z-10"
          aria-label={isPaused ? "Play" : "Pause"}
          title={isPaused ? "Play" : "Pause"}
        />

        {/* On-demand video rendering & prefetching */}
        {isNear ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={item.url}
            playsInline
            controls={false}
            muted={muted}
            loop
            preload="metadata" // This guarantees prefetching of metadata and a few buffer frames
          />
        ) : (
          /* Skeleton placeholder when out of range to keep DOM light */
          <div className="absolute inset-0 h-full w-full bg-neutral-900 grid place-items-center">
            <div className="h-10 w-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Readability gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 to-transparent" />

        {/* Play icon when paused */}
        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-black/35 backdrop-blur border border-white/10">
              <PlayIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-30 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 active:scale-95 transition"
                aria-label="Back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onFollow}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-white/90 active:scale-95 transition"
              >
                Follow
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
              </button>

              <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                Streams
              </span>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
                title="More"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6 sm:right-5">
          <div className="flex flex-col items-center">
            <IconPillButton title={liked ? "Unlike" : "Like"} onClick={() => setLiked((v) => !v)}>
              <HeartIcon className={`h-6 w-6 transition-colors ${liked ? "text-pink-500" : "text-white"}`} />
            </IconPillButton>
            <CountText>{liked ? formatCompact(item.likes + 1) : formatCompact(item.likes)}</CountText>
          </div>

          <div className="flex flex-col items-center">
            <IconPillButton title="Comments" onClick={() => {}}>
              <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-white" />
            </IconPillButton>
            <CountText>{formatCompact(item.comments)}</CountText>
          </div>

          <div className="flex flex-col items-center">
            <IconPillButton title="Share" onClick={() => {}}>
              <ShareIcon className="h-6 w-6 text-white" />
            </IconPillButton>
          </div>
        </div>

        {/* Bottom profile and caption */}
        <div className="absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenProfile}
              className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-white/35 hover:scale-105 transition"
              title="Open creator"
            >
              <img
                src={item?.creator?.avatar_url || DEFAULT_AVATAR}
                alt={item?.creator?.display_name || "Creator"}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {item?.creator?.display_name || "Unknown"}
              </p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-white/75">
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                <span>{formatCompact(item.views_count)} views</span>
              </div>
            </div>
          </div>

          {item.caption && (
            <div className="mt-3 rounded-2xl bg-black/30 p-3 backdrop-blur border border-white/10">
              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{item.caption}</p>
            </div>
          )}
        </div>

        <SwipeDownHint />
      </Stage>
    </section>
  );
}

/** * Keep UploadSheet UI as is since it was already well bounded.
 * (Left intact based on your specific request focusing on streams viewing performance)
 */
function UploadSheet({ open, onClose, onUpload, uploading, progress, caption, setCaption, file, setFile, previewUrl }) {
  const inputRef = useRef(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button type="button" className="absolute inset-0 bg-black/70" onClick={uploading ? undefined : onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-[0_-30px_120px_rgba(0,0,0,0.7)] max-h-[92dvh] overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><VideoCameraIcon className="h-5 w-5 text-white" /></div>
            <div>
              <p className="text-sm font-semibold">Upload Stream</p>
              <p className="text-xs text-white/60">Pending admin approval after upload</p>
            </div>
          </div>
          <button type="button" onClick={uploading ? undefined : onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-50" disabled={uploading}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black md:sticky md:top-0">
              <div className="aspect-[9/16]">
                {previewUrl ? <video className="h-full w-full object-cover" src={previewUrl} muted playsInline controls /> : (
                  <div className="grid h-full w-full place-items-center text-white/60 text-center px-6">
                    <p className="text-sm font-semibold text-white/80">No video selected</p>
                    <p className="mt-1 text-xs">Pick a vertical video (9:16)</p>
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 disabled:opacity-50">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><ArrowUpTrayIcon className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Choose video</p>
                    <p className="mt-0.5 truncate text-xs text-white/60">{file ? file.name : "MP4 recommended"}</p>
                  </div>
                </div>
              </button>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              <div className="mt-4">
                <label className="text-xs font-semibold text-white/70">Caption</label>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write something…" className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20" rows={4} disabled={uploading} />
                <div className="mt-1 flex justify-between text-[11px] text-white/45"><span>Keep it short and clear</span><span>{caption.length}/200</span></div>
              </div>
              {uploading && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-white/80">Uploading…</span><span className="font-semibold text-white/80">{Math.round(progress)}%</span></div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>
                </div>
              )}
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={onClose} disabled={uploading} className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={onUpload} disabled={uploading || !file} className="flex-1 rounded-full bg-white px-4 py-3 text-sm font-bold text-neutral-950 hover:bg-white/90 disabled:opacity-50">{uploading ? "Uploading…" : "Upload"}</button>
              </div>
              <p className="mt-3 text-[11px] text-white/45">After upload, your stream will be <span className="text-white/70 font-semibold">pending</span> until approved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Streams() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem("streams_muted");
    return saved == null ? true : saved === "true";
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [activeIndex, setActiveIndex] = useState(0);

  const enriched = useMemo(
    () => items.map((s) => ({ ...s, likes: 1200, comments: 188 })),
    [items]
  );

  const PAGE_SIZE = 10;

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await streamsService.listApproved(PAGE_SIZE, 0); // added offset logic
        if (!cancelled) {
          setItems(data);
          if (data.length < PAGE_SIZE) setHasMore(false);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load streams");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch more streams when close to bottom (On-Demand loading)
  const fetchMoreStreams = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;
    try {
      setIsFetchingMore(true);
      const data = await streamsService.listApproved(PAGE_SIZE, items.length);
      if (data.length < PAGE_SIZE) setHasMore(false);
      setItems((prev) => [...prev, ...data]);
    } catch (e) {
      console.error("Failed to load more streams", e);
    } finally {
      setIsFetchingMore(false);
    }
  }, [items.length, isFetchingMore, hasMore]);

  // Track active index based on scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const h = window.innerHeight || el.clientHeight || 1;
      const index = Math.round(el.scrollTop / h);
      setActiveIndex(index);
      
      // Load more when reaching the second to last loaded video
      if (index >= items.length - 2) {
        fetchMoreStreams();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length, fetchMoreStreams]);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const newVal = !m;
      localStorage.setItem("streams_muted", String(newVal));
      return newVal;
    });
  }, []);

  // Timer handling for uploads
  const progressTimerRef = useRef(null);
  const startProgress = () => {
    setProgress(0);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.max(0.7, (92 - p) * 0.07);
        return next >= 92 ? 92 : next;
      });
    }, 120);
  };
  const stopProgress = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  };

  const resetUpload = () => { setFile(null); setCaption(""); setProgress(0); setUploading(false); };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      startProgress();
      await streamsService.createPending({ caption: caption.trim().slice(0, 200), file });
      stopProgress();
      setProgress(100);
      setTimeout(() => {
        alert("Uploaded! Your stream is pending admin approval.");
        setUploadOpen(false);
        resetUpload();
      }, 450);
    } catch (e) {
      stopProgress();
      setUploading(false);
      setProgress(0);
      alert(e.message || "Upload failed");
    }
  };

  useEffect(() => () => stopProgress(), []);

  if (isLoading) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white">
        <div className="h-10 w-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="font-semibold">Failed to load</p>
          <p className="mt-1 text-xs text-white/70">{error}</p>
          <button className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-neutral-950">
      <div className="fixed top-4 right-4 z-50">
        <button type="button" onClick={() => setUploadOpen(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-950 shadow hover:bg-white/90" title="Upload stream"><ArrowUpTrayIcon className="h-5 w-5" /></button>
      </div>

      <UploadSheet open={uploadOpen} onClose={() => { if (!uploading) { setUploadOpen(false); resetUpload(); } }} onUpload={handleUpload} uploading={uploading} progress={progress} caption={caption} setCaption={setCaption} file={file} setFile={setFile} previewUrl={previewUrl} />

      {!enriched.length ? (
        <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="font-semibold">No streams yet</p>
            <p className="mt-1 text-xs text-white/70">Upload one.</p>
            <button className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      ) : (
        <div ref={scrollerRef} className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
          {enriched.map((item, index) => {
            // "Windowing" check: only render video player if it's currently active or the immediate sibling
            const isNear = Math.abs(index - activeIndex) <= 1;

            return (
              <StreamPage
                key={item.id}
                item={item}
                isActive={activeIndex === index}
                isNear={isNear}
                muted={muted}
                toggleMute={toggleMute}
                onBack={() => navigate(-1)}
                onFollow={() => {}}
                onOpenProfile={() => navigate("/profile")}
                onViewed={() => streamsService.incrementView(item.id).catch(() => {})}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}