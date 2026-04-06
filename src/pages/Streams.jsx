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

const DEFAULT_AVATAR = "/me.jpg";

// ==========================================
// 🔔 SHADCN STYLE ALERT DIALOG
// ==========================================
function ShadcnAlert({ open, title, description, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Dialog */}
      <div className="relative max-w-md w-full rounded-xl border border-white/10 bg-neutral-900 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{description}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200 transition-colors active:scale-95"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

function IconPillButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center rounded-full bg-neutral-800/60 text-white backdrop-blur-md hover:bg-neutral-700/80 active:scale-90 transition-all duration-200"
    >
      {children}
    </button>
  );
}

function CountText({ children }) {
  return <div className="mt-1 text-[11px] font-medium text-neutral-300">{children}</div>;
}

function SwipeDownHint() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <ChevronDownIcon className="h-6 w-6 animate-bounce text-white/80" />
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
      <div className="relative overflow-hidden bg-neutral-950 h-dvh w-full sm:h-[92dvh] sm:max-h-[900px] sm:aspect-[9/16] sm:w-auto sm:rounded-[2.25rem] sm:border sm:border-white/10 sm:shadow-[0_30px_120px_rgba(0,0,0,0.85)]">
        {children}
      </div>
    </div>
  );
}

function StreamPage({ item, isActive, isNear, muted, toggleMute, onBack, onFollow, onOpenProfile, onViewed }) {
  const [liked, setLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const userPausedRef = useRef(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isActive) {
      if (!userPausedRef.current) {
        v.play().catch(() => {});
      }
    } else {
      v.pause();
      v.currentTime = 0;
      userPausedRef.current = false;
    }
  }, [isActive]);

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
  }, [isNear]);

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
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-black text-white">
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${item?.creator?.avatar_url || DEFAULT_AVATAR})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
            transform: "scale(1.2)",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-black/70" />

      <Stage>
        <button
          type="button"
          onClick={togglePlayPause}
          className="absolute inset-0 z-10"
          aria-label={isPaused ? "Play" : "Pause"}
        />

        {isNear ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={item.url}
            playsInline
            controls={false}
            muted={muted}
            loop
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 h-full w-full bg-neutral-900 grid place-items-center">
            <div className="h-10 w-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg scale-100 animate-in zoom-in-90 duration-150">
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
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 text-white backdrop-blur-md hover:bg-neutral-700 active:scale-90 transition-all"
                aria-label="Back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onFollow}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-100 active:scale-95 transition-all"
              >
                Follow
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 text-white backdrop-blur-md hover:bg-neutral-700 transition-all"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
              </button>

              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md border border-white/5">
                Streams
              </span>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 text-white backdrop-blur-md hover:bg-neutral-700 transition-all"
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
              <HeartIcon className={`h-6 w-6 transition-all duration-300 ${liked ? "text-red-500 scale-110" : "text-white"}`} />
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
              className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/20 hover:border-white/50 hover:scale-105 transition-all duration-200"
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
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-neutral-300">
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                <span className="w-1 h-1 bg-neutral-500 rounded-full" />
                <span>{formatCompact(item.views_count)} views</span>
              </div>
            </div>
          </div>

          {item.caption && (
            <div className="mt-3 rounded-xl bg-neutral-900/50 p-3.5 backdrop-blur-md border border-white/10">
              <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">{item.caption}</p>
            </div>
          )}
        </div>

        <SwipeDownHint />
      </Stage>
    </section>
  );
}

// ==========================================
// 📱 REFACTORED MOBILE-FLEXIBLE UPLOAD SHEET
// ==========================================
function UploadSheet({ open, onClose, onUpload, uploading, progress, caption, setCaption, file, setFile, previewUrl }) {
  const inputRef = useRef(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={uploading ? undefined : onClose} />
      
      {/* Container: Defined height and proper Flex layouts to allow internal body scrolling */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl flex flex-col rounded-t-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl h-[85dvh] max-h-[85dvh] overflow-hidden">
        
        {/* Header (Pinned) */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
              <VideoCameraIcon className="h-5 w-5 text-neutral-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Upload Stream</p>
              <p className="text-xs text-neutral-400">Moderated queue before listing</p>
            </div>
          </div>
          <button type="button" onClick={uploading ? undefined : onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50" disabled={uploading}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body (Guaranteed to scroll nicely on small devices) */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            
            {/* Video preview: Scale to landscape on mobile so it doesn't eat up scroll height! */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-black md:sticky md:top-0">
              <div className="aspect-[16/9] md:aspect-[9/16] w-full">
                {previewUrl ? <video className="h-full w-full object-cover" src={previewUrl} muted playsInline controls /> : (
                  <div className="grid h-full w-full place-items-center text-neutral-500 text-center px-4">
                    <div>
                      <p className="text-xs font-medium">No video selected</p>
                      <p className="mt-0.5 text-[10px]">Portrait $9:16$ works best</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="min-w-0 space-y-5">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3.5 text-left hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-800">
                    <ArrowUpTrayIcon className="h-5 w-5 text-neutral-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Choose video file</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-400">{file ? file.name : "Tap to browse your device"}</p>
                  </div>
                </div>
              </button>
              
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              
              <div>
                <label className="text-xs font-medium text-neutral-400">Caption / Description</label>
                <textarea 
                  value={caption} 
                  onChange={(e) => setCaption(e.target.value)} 
                  placeholder="Tell the community about your stream..." 
                  className="mt-2 w-full resize-none rounded-xl border border-white/5 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 focus:bg-white/10 transition-colors" 
                  rows={4} 
                  disabled={uploading} 
                />
                <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
                  <span>Aim for clear, punchy text</span>
                  <span className={caption.length > 190 ? "text-amber-500" : ""}>{caption.length}/200</span>
                </div>
              </div>

              {uploading && (
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-neutral-300">Uploading stream...</span>
                    <span className="text-white">{Math.round(progress)}%</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full rounded-full bg-white transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Actions Footer inside scrollable (sticks with form) */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={uploading} className="flex-1 rounded-full border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 active:scale-95 transition-all disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={onUpload} disabled={uploading || !file} className="flex-1 rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-50">
                  {uploading ? "Uploading..." : "Publish"}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 text-center">Subject to community guideline standards.</p>
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

  // Modal alert hooks
  const [alertConfig, setAlertConfig] = useState({ open: false, title: "", description: "" });

  const enriched = useMemo(
    () => items.map((s) => ({ ...s, likes: 1200, comments: 188 })),
    [items]
  );

  const PAGE_SIZE = 10;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await streamsService.listApproved(PAGE_SIZE, 0);
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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const h = window.innerHeight || el.clientHeight || 1;
      const index = Math.round(el.scrollTop / h);
      setActiveIndex(index);
      
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
        setUploadOpen(false);
        resetUpload();
        // Triggering the custom Shadcn Alert instead of boring default alerts
        setAlertConfig({
          open: true,
          title: "Upload Successful!",
          description: "Your video has been sent to our queue. It will appear on the feed shortly after automated checks."
        });
      }, 450);
    } catch (e) {
      stopProgress();
      setUploading(false);
      setProgress(0);
      setAlertConfig({
        open: true,
        title: "Upload Failed",
        description: e.message || "An unexpected error occurred while uploading. Please try again."
      });
    }
  };

  useEffect(() => () => stopProgress(), []);

  if (isLoading) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white">
        <div className="h-10 w-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center shadow-xl">
          <p className="font-semibold text-lg">Failed to load</p>
          <p className="mt-1 text-sm text-neutral-400">{error}</p>
          <button className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-neutral-950">
      
      {/* Dynamic Shadcn Alert Hook */}
      <ShadcnAlert 
        open={alertConfig.open}
        title={alertConfig.title}
        description={alertConfig.description}
        onConfirm={() => setAlertConfig({ ...alertConfig, open: false })}
      />

      <div className="fixed top-4 right-4 z-50">
        <button type="button" onClick={() => setUploadOpen(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-950 shadow-lg hover:bg-neutral-100 active:scale-90 transition-all" title="Upload stream"><ArrowUpTrayIcon className="h-5 w-5" /></button>
      </div>

      <UploadSheet open={uploadOpen} onClose={() => { if (!uploading) { setUploadOpen(false); resetUpload(); } }} onUpload={handleUpload} uploading={uploading} progress={progress} caption={caption} setCaption={setCaption} file={file} setFile={setFile} previewUrl={previewUrl} />

      {!enriched.length ? (
        <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center shadow-xl">
            <p className="font-semibold text-lg">No streams yet</p>
            <p className="mt-1 text-sm text-neutral-400">Upload one and approve it in your database to see it here.</p>
            <button className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      ) : (
        <div ref={scrollerRef} className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
          {enriched.map((item, index) => {
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