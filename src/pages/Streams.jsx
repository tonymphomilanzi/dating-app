import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  toast 
} from "sonner";
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
//UI COMPONENTS
// ==========================================

function IconPillButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
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

// ==========================================
// 📺 INDIVIDUAL STREAM PAGE
// ==========================================

function StreamPage({ item, isActive, isNear, muted, toggleMute, onBack, onFollow, onOpenProfile, onViewed }) {
  const [liked, setLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const userPausedRef = useRef(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isActive) {
      if (v) { v.pause(); v.currentTime = 0; }
      userPausedRef.current = false;
      return;
    }
    if (!userPausedRef.current) v.play().catch(() => {});
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

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
      <Stage>
        <button type="button" onClick={togglePlayPause} className="absolute inset-0 z-10" />
        
        {isNear ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={item.url}
            playsInline
            muted={muted}
            loop
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 h-full w-full bg-neutral-900 grid place-items-center" />
        )}

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 to-transparent" />

        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 animate-in zoom-in-90 duration-150">
              <PlayIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-30 px-4 pt-4 sm:px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 backdrop-blur-md hover:bg-neutral-700 transition-all">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button onClick={onFollow} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-100 transition-all">
                Follow
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 backdrop-blur-md">
                {muted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
              </button>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium border border-white/5">Streams</span>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center">
            <IconPillButton onClick={() => setLiked(!liked)}>
              <HeartIcon className={`h-6 w-6 transition-all ${liked ? "text-red-500 scale-110" : "text-white"}`} />
            </IconPillButton>
            <CountText>{liked ? formatCompact(item.likes + 1) : formatCompact(item.likes)}</CountText>
          </div>
          <div className="flex flex-col items-center">
            <IconPillButton><ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-white" /></IconPillButton>
            <CountText>{formatCompact(item.comments)}</CountText>
          </div>
          <IconPillButton><ShareIcon className="h-6 w-6 text-white" /></IconPillButton>
        </div>

        {/* Bottom profile */}
        <div className="absolute bottom-0 left-0 right-0 z-30 p-4">
          <div className="flex items-center gap-3">
            <button onClick={onOpenProfile} className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/20">
              <img src={item?.creator?.avatar_url || DEFAULT_AVATAR} alt="Avatar" className="h-full w-full object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{item?.creator?.display_name || "Unknown"}</p>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-neutral-300">
                <span>{formatCompact(item.views_count)} views</span>
              </div>
            </div>
          </div>
          {item.caption && (
            <div className="mt-3 rounded-xl bg-neutral-900/50 p-3.5 backdrop-blur-md border border-white/10">
              <p className="text-xs text-neutral-200 leading-relaxed">{item.caption}</p>
            </div>
          )}
        </div>
        <SwipeDownHint />
      </Stage>
    </section>
  );
}

// ==========================================
// 📱 MOBILE-FLEXIBLE UPLOAD SHEET
// ==========================================

function UploadSheet({ open, onClose, onUpload, uploading, progress, caption, setCaption, file, setFile, previewUrl }) {
  const inputRef = useRef(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={uploading ? undefined : onClose} />
      <div className="relative mx-auto w-full max-w-3xl flex flex-col rounded-t-3xl border border-white/10 bg-neutral-900 text-white shadow-2xl h-[85dvh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <VideoCameraIcon className="h-5 w-5 text-neutral-400" />
            <p className="text-sm font-semibold">Upload Stream</p>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-2 hover:bg-white/5 rounded-full"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <div className="overflow-hidden rounded-xl bg-black border border-white/5">
              <div className="aspect-[16/9] md:aspect-[9/16] w-full grid place-items-center">
                {previewUrl ? <video className="h-full w-full object-cover" src={previewUrl} muted playsInline /> : <span className="text-[10px] text-neutral-500">No Preview</span>}
              </div>
            </div>

            <div className="space-y-5">
              <button onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full rounded-xl border border-white/5 bg-white/5 p-4 text-left hover:bg-white/10 transition-all">
                <p className="text-sm font-semibold">{file ? file.name : "Select Video File"}</p>
                <p className="text-xs text-neutral-400">Click to browse your device</p>
              </button>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
              
              <textarea 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                placeholder="Write a caption..." 
                className="w-full rounded-xl bg-white/5 p-4 text-sm outline-none focus:ring-1 ring-white/20 h-28 resize-none"
                disabled={uploading}
              />

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-medium text-neutral-400">
                    <span>Uploading...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} disabled={uploading} className="flex-1 py-3 rounded-full border border-white/10 text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={onUpload} disabled={uploading || !file} className="flex-1 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-all">Publish</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 🚀 MAIN STREAMS PAGE
// ==========================================

export default function Streams() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("streams_muted") === "true");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await streamsService.listApproved(10, 0);
        setItems(data);
      } catch (e) {
        toast.error("Failed to load feed", { description: e.message });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;

    // 🌟 SONNER LOADING TOAST
    const toastId = toast.loading("Processing upload...");
    
    try {
      setUploading(true);
      setProgress(10);
      
      await streamsService.createPending({ 
        caption: caption.trim(), 
        file 
      });

      setProgress(100);
      
      setTimeout(() => {
        setUploadOpen(false);
        setUploading(false);
        setFile(null);
        setCaption("");
        
        // ✨ UPDATE EXISTING TOAST TO SUCCESS
        toast.success("Stream Uploaded!", {
          id: toastId,
          description: "Your video has been sent for moderation.",
        });
      }, 400);

    } catch (e) {
      setUploading(false);
      setProgress(0);
      
      // ❌ UPDATE EXISTING TOAST TO ERROR
      toast.error("Upload Failed", {
        id: toastId,
        description: e.message || "An unexpected error occurred.",
      });
    }
  };

  if (isLoading) return <div className="h-dvh grid place-items-center bg-black"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="h-dvh bg-black">
      <div className="fixed top-4 right-4 z-50">
        <button onClick={() => setUploadOpen(true)} className="h-10 w-10 grid place-items-center rounded-full bg-white text-black shadow-lg hover:scale-105 active:scale-95 transition-all">
          <ArrowUpTrayIcon className="h-5 w-5" />
        </button>
      </div>

      <UploadSheet 
        open={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        onUpload={handleUpload}
        uploading={uploading} 
        progress={progress} 
        caption={caption} 
        setCaption={setCaption} 
        file={file} 
        setFile={setFile} 
        previewUrl={previewUrl} 
      />

      <div 
        ref={scrollerRef} 
        className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={(e) => setActiveIndex(Math.round(e.target.scrollTop / window.innerHeight))}
      >
        {items.map((item, index) => (
          <StreamPage
            key={item.id}
            item={{ ...item, likes: 1200, comments: 188 }}
            isActive={activeIndex === index}
            isNear={Math.abs(index - activeIndex) <= 1}
            muted={muted}
            toggleMute={() => setMuted((prev) => {
              localStorage.setItem("streams_muted", String(!prev));
              return !prev;
            })}
            onBack={() => navigate(-1)}
            onOpenProfile={() => navigate("/profile")}
            onViewed={() => streamsService.incrementView(item.id).catch(() => {})}
          />
        ))}
      </div>
    </div>
  );
}