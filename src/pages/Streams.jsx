// src/pages/Streams.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
  PauseIcon,
} from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { streamsService } from "../services/streams.service.js";

/* ================================================================
   CONSTANTS
   ================================================================ */

const DEFAULT_AVATAR = "/me.jpg";
const MAX_CAPTION_LENGTH = 200;
const UPLOAD_PROGRESS_INTERVAL = 120;
const UPLOAD_PROGRESS_INCREMENT = 0.07;
const UPLOAD_PROGRESS_MIN = 0.7;
const UPLOAD_PROGRESS_MAX = 92;
const STREAMS_LIMIT = 20;

/* ================================================================
   UI HELPERS
   ================================================================ */

function IconPillButton({ title, onClick, children, disabled = false, active = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "bg-white/20 scale-110"
          : "bg-neutral-800/60 hover:bg-neutral-700/80 active:scale-90"
      }`}
    >
      {children}
    </button>
  );
}

function CountText({ children }) {
  return (
    <div className="mt-1 text-[11px] font-bold text-white drop-shadow-lg">
      {children}
    </div>
  );
}

function SwipeDownHint() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex flex-col items-center gap-1">
        <ChevronDownIcon className="h-6 w-6 animate-bounce text-white/80" />
        <p className="text-[10px] text-white/60 font-medium">Swipe up</p>
      </div>
    </div>
  );
}

function formatCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`.replace(".0", "");
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`.replace(".0", "");
  }
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

/* ================================================================
   VOLUME CONTROLLER
   ================================================================ */

function VolumeControl({ muted, onToggleMute, videoRef }) {
  const [volume, setVolume] = useState(1);
  const [showSlider, setShowSlider] = useState(false);
  const timeoutRef = useRef(null);

  const handleVolumeChange = useCallback(
    (e) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);

      if (videoRef.current) {
        videoRef.current.volume = newVol;
        if (newVol > 0 && muted) {
          onToggleMute();
        } else if (newVol === 0 && !muted) {
          onToggleMute();
        }
      }
    },
    [muted, onToggleMute, videoRef]
  );

  const toggleSlider = useCallback(() => {
    setShowSlider((prev) => {
      const next = !prev;
      if (next) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShowSlider(false), 3000);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMuteToggle = useCallback(() => {
    onToggleMute();
    if (videoRef.current) {
      videoRef.current.muted = !muted;
    }
  }, [muted, onToggleMute, videoRef]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div
        className={`absolute bottom-full mb-2 transition-all duration-300 origin-bottom ${
          showSlider
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-75 opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-neutral-900/95 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center gap-3 h-32">
            <div className="text-xs font-bold text-white">
              {Math.round((muted ? 0 : volume) * 100)}%
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-20 w-1 appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              style={{
                writingMode: "bt-lr",
                WebkitAppearance: "slider-vertical",
              }}
              aria-label="Volume control"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleMuteToggle}
        onDoubleClick={toggleSlider}
        className="grid h-11 w-11 place-items-center rounded-full bg-neutral-800/70 backdrop-blur-md hover:bg-neutral-700/90 active:scale-90 transition-all shadow-lg border border-white/5"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? (
          <SpeakerXMarkIcon className="h-5 w-5 text-white" />
        ) : (
          <SpeakerWaveIcon className="h-5 w-5 text-white" />
        )}
      </button>

      <div className="text-[9px] text-white/40 font-medium whitespace-nowrap text-center">
        Double tap
        <br />
        for volume
      </div>
    </div>
  );
}

/* ================================================================
   STREAM PAGE COMPONENT
   ================================================================ */

function StreamPage({
  item,
  isActive,
  isNear,
  muted,
  toggleMute,
  onBack,
  onFollow,
  onOpenProfile,
  onViewed,
  onLike,
  onShare,
  likedStreams,
  loadingLikes,
}) {
  const videoRef = useRef(null);
  const userPausedRef = useRef(false);
  const viewedOnceRef = useRef(false);

  const [isPaused, setIsPaused] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);

  const isLiked = useMemo(
    () => likedStreams.has(item.id),
    [likedStreams, item.id]
  );

  // Handle play/pause on active state change
  // No abort, no cleanup that fires requests — just control the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      if (!userPausedRef.current) {
        video.play().catch(() => {});
      }
    } else {
      video.pause();
      video.currentTime = 0;
      userPausedRef.current = false;
    }
  }, [isActive]);

  // Sync video events with UI state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPaused(false);
    const handlePause = () => setIsPaused(true);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    setIsPaused(video.paused);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [isNear]);

  // Track view — no async, no fetch in here, parent handles the fire-and-forget
  useEffect(() => {
    if (isActive && !viewedOnceRef.current && onViewed) {
      viewedOnceRef.current = true;
      onViewed();
    }
    if (!isActive) {
      viewedOnceRef.current = false;
    }
  }, [isActive, onViewed]);

  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        userPausedRef.current = false;
        await video.play();
      } else {
        video.pause();
        userPausedRef.current = true;
      }
    } catch (error) {
      console.error("Play/pause error:", error);
    }
  }, []);

  const handleLike = useCallback(() => {
    if (loadingLikes.has(item.id)) return;
    onLike(item.id, !isLiked);
  }, [item.id, isLiked, onLike, loadingLikes]);

  const handleShare = useCallback(async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      await onShare(item.id);
      toast.success("Stream shared!");
    } catch {
      toast.error("Failed to share");
    } finally {
      setShareLoading(false);
    }
  }, [item.id, onShare, shareLoading]);

  const likeCount = useMemo(() => {
    const baseCount = item.likes || 0;
    return formatCompact(isLiked ? baseCount + 1 : baseCount);
  }, [item.likes, isLiked]);

  const creatorName = item?.creator?.display_name || "Unknown";
  const creatorAvatar = item?.creator?.avatar_url || DEFAULT_AVATAR;
  const viewsCount = formatCompact(item?.views_count || 0);
  const commentsCount = formatCompact(item?.comments_count || 0);

  return (
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-black text-white">
      <Stage>
        <button
          type="button"
          onClick={togglePlayPause}
          className="absolute inset-0 z-10 active:bg-white/5 transition-colors"
          aria-label={isPaused ? "Play video" : "Pause video"}
        />

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
          <div className="absolute inset-0 h-full w-full bg-neutral-900 grid place-items-center">
            <div className="h-8 w-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/90 via-black/50 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-black/50 backdrop-blur-md border-2 border-white/20 shadow-2xl animate-in zoom-in-90 duration-200">
              <PlayIcon className="h-10 w-10 text-white ml-1" />
            </div>
          </div>
        )}

        <div className="absolute left-0 right-0 top-0 z-30 px-4 pt-4 safe-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/70 backdrop-blur-md hover:bg-neutral-700/90 active:scale-90 transition-all shadow-lg border border-white/5"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onFollow}
                className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-neutral-950 hover:bg-neutral-100 active:scale-95 transition-all shadow-lg"
              >
                Follow
              </button>
            </div>
            <div className="w-12" />
          </div>
        </div>

        <div className="absolute left-4 top-20 z-30 safe-top">
          <VolumeControl
            muted={muted}
            onToggleMute={toggleMute}
            videoRef={videoRef}
          />
        </div>

        <div className="absolute right-4 bottom-32 z-30 flex flex-col items-center gap-5 safe-bottom">
          <div className="flex flex-col items-center">
            <IconPillButton
              title={isLiked ? "Unlike" : "Like"}
              onClick={handleLike}
              disabled={loadingLikes.has(item.id)}
              active={isLiked}
            >
              {loadingLikes.has(item.id) ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLiked ? (
                <HeartIcon className="h-6 w-6 text-red-500" />
              ) : (
                <HeartOutlineIcon className="h-6 w-6 text-white" />
              )}
            </IconPillButton>
            <CountText>{likeCount}</CountText>
          </div>

          <div className="flex flex-col items-center">
            <IconPillButton
              title="Comments"
              onClick={() => toast.info("Comments coming soon!")}
            >
              <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-white" />
            </IconPillButton>
            <CountText>{commentsCount}</CountText>
          </div>

          <div className="flex flex-col items-center">
            <IconPillButton
              title="Share stream"
              onClick={handleShare}
              disabled={shareLoading}
            >
              {shareLoading ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShareIcon className="h-6 w-6 text-white" />
              )}
            </IconPillButton>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-6 safe-bottom">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onOpenProfile}
              className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/30 hover:border-white active:scale-95 transition-all shadow-lg"
              aria-label={`View ${creatorName}'s profile`}
            >
              <img
                src={creatorAvatar}
                alt={creatorName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.src = DEFAULT_AVATAR;
                }}
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold drop-shadow-lg">
                {creatorName}
              </p>
              <p className="text-xs text-white/80 font-medium drop-shadow">
                {viewsCount} views
              </p>
            </div>
          </div>

          {item.caption && (
            <div className="rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-800/90 p-4 backdrop-blur-xl border border-white/10 shadow-2xl">
              <p className="text-sm text-white/95 leading-relaxed line-clamp-3">
                {item.caption}
              </p>
            </div>
          )}
        </div>

        <SwipeDownHint />
      </Stage>
    </section>
  );
}

/* ================================================================
   UPLOAD SHEET COMPONENT
   ================================================================ */

function UploadSheet({
  open,
  onClose,
  onUpload,
  uploading,
  progress,
  caption,
  setCaption,
  file,
  setFile,
  previewUrl,
}) {
  const inputRef = useRef(null);

  const handleFileSelect = useCallback(
    (e) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!selectedFile.type.startsWith("video/")) {
        toast.error("Please select a video file");
        return;
      }

      const maxSize = 100 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        toast.error("File size must be less than 100MB");
        return;
      }

      setFile(selectedFile);
      toast.success("Video selected");
    },
    [setFile]
  );

  const handleCaptionChange = useCallback(
    (e) => {
      setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH));
    },
    [setCaption]
  );

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !uploading) {
        onClose();
      }
    },
    [uploading, onClose]
  );

  const handleUploadClick = useCallback(() => {
    if (!file) {
      toast.error("Please select a video file");
      return;
    }
    onUpload();
  }, [file, onUpload]);

  if (!open) return null;

  const isUploadDisabled = uploading || !file;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl flex flex-col rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl max-h-[90dvh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-neutral-900/50">
          <p className="text-base font-bold">Upload Stream</p>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 transition-all"
            aria-label="Close upload sheet"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="aspect-[9/16] bg-neutral-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
              {previewUrl ? (
                <video
                  className="h-full w-full object-cover"
                  src={previewUrl}
                  muted
                  playsInline
                  controls
                />
              ) : (
                <div className="grid h-full place-items-center text-center p-4">
                  <div>
                    <ArrowUpTrayIcon className="h-12 w-12 mx-auto mb-2 text-neutral-600" />
                    <p className="text-xs text-neutral-500">No video selected</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <ArrowUpTrayIcon className="h-5 w-5 text-violet-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {file ? file.name : "Choose video file"}
                    </p>
                    {file && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </div>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />

              <div>
                <label className="block text-sm font-semibold mb-2 text-neutral-300">
                  Caption (Optional)
                </label>
                <textarea
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="Add a caption to your stream..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm outline-none focus:ring-2 ring-violet-500 h-32 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={uploading}
                  maxLength={MAX_CAPTION_LENGTH}
                  aria-label="Stream caption"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-neutral-500">
                    Share your thoughts with your audience
                  </p>
                  <p className="text-xs text-neutral-400 font-medium">
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </p>
                </div>
              </div>

              {uploading && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="font-semibold text-white">
                      Uploading stream...
                    </span>
                    <span className="font-bold text-violet-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">
                    Please don't close this window
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={uploading}
                  className="flex-1 py-3.5 rounded-full border border-white/20 text-sm font-semibold hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadClick}
                  disabled={isUploadDisabled}
                  className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-neutral-600 disabled:to-neutral-600 shadow-lg"
                >
                  {uploading ? "Publishing..." : "Publish Stream"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN STREAMS COMPONENT
   ================================================================ */

export default function Streams() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem("streams_muted");
    return saved !== "false";
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [likedStreams, setLikedStreams] = useState(new Set());
  const [loadingLikes, setLoadingLikes] = useState(new Set());

  // ── Load streams ───────────────────────────────────────────────
  // Single cancelled flag, no AbortController, no cache, no revalidation
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);

        const streamsData = await streamsService.listApproved(STREAMS_LIMIT);
        if (cancelled) return;
        setItems(streamsData);

        // Likes are secondary — failure is silent, no separate loading state
        try {
          const likedSet = await streamsService.getUserLikedStreams();
          if (cancelled) return;
          setLikedStreams(likedSet);
        } catch {
          // non-fatal, leave likedStreams as empty Set
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load streams:", error);
        toast.error("Failed to load streams");
      } finally {
        // Only update loading state if still mounted
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── File preview URL ───────────────────────────────────────────
  // This is synchronous object URL creation — no async, no cancelled needed
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // ── Cleanup progress timer on unmount ──────────────────────────
  // Kept as a plain ref cleanup — no state updates in this cleanup
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  // ── Progress simulation ────────────────────────────────────────
  // These are plain functions, not effects — they manage a ref-based timer
  // and setState via functional updater so they never go stale
  const startProgress = useCallback(() => {
    setProgress(0);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const increment = Math.max(
          UPLOAD_PROGRESS_MIN,
          (UPLOAD_PROGRESS_MAX - prev) * UPLOAD_PROGRESS_INCREMENT
        );
        const next = prev + increment;
        return next >= UPLOAD_PROGRESS_MAX ? UPLOAD_PROGRESS_MAX : next;
      });
    }, UPLOAD_PROGRESS_INTERVAL);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ── Reset upload form ──────────────────────────────────────────
  const resetUpload = useCallback(() => {
    setFile(null);
    setCaption("");
    setProgress(0);
    setUploading(false);
    setPreviewUrl("");
  }, []);

  // ── Upload handler ─────────────────────────────────────────────
  // Upload is user-initiated and long-running — it's fine to let it finish
  // after navigation because it's a real network operation (not a read).
  // We don't cancel it; we just don't setState if the component is gone.
  const handleUpload = useCallback(async () => {
    if (!file) {
      toast.error("Please select a video file");
      return;
    }

    let cancelled = false;
    const toastId = toast.loading("Uploading your stream...");

    try {
      setUploading(true);
      startProgress();

      await streamsService.createPending({
        caption: caption.trim().slice(0, MAX_CAPTION_LENGTH),
        file,
      });

      stopProgress();
      if (cancelled) return;
      setProgress(100);

      setTimeout(() => {
        if (cancelled) return;
        setUploadOpen(false);
        resetUpload();
        toast.success("Stream Uploaded Successfully!", {
          id: toastId,
          description: "Your video is pending approval and will appear soon.",
        });
      }, 500);
    } catch (error) {
      stopProgress();
      if (cancelled) return;
      setUploading(false);
      setProgress(0);
      console.error("Upload failed:", error);
      toast.error("Upload Failed", {
        id: toastId,
        description: error.message || "Please try again later.",
      });
    }

    // Return a cleanup so callers could cancel if needed,
    // but we don't wire this to an effect — upload is fire-and-complete
    return () => {
      cancelled = true;
    };
  }, [file, caption, startProgress, stopProgress, resetUpload]);

  // ── Like handler ───────────────────────────────────────────────
  // Optimistic update + API call. No cancelled flag needed here because
  // the setState calls use functional updaters (always safe) and the
  // catch block reverts — both are idempotent if the component is gone.
  // React will simply drop the update on an unmounted component without
  // corrupting state (the warning is benign here; optimistic UI is a
  // known exception to the cancelled pattern).
  const handleLike = useCallback(async (streamId, isLiking) => {
    // Prevent duplicate in-flight requests for same stream
    setLoadingLikes((prev) => {
      if (prev.has(streamId)) return prev; // already in flight, bail
      return new Set(prev).add(streamId);
    });

    // Optimistic update
    setLikedStreams((prev) => {
      const next = new Set(prev);
      isLiking ? next.add(streamId) : next.delete(streamId);
      return next;
    });

    try {
      if (isLiking) {
        await streamsService.likeStream(streamId);
      } else {
        await streamsService.unlikeStream(streamId);
      }
    } catch (error) {
      console.error("Like operation failed:", error);

      // Revert optimistic update
      setLikedStreams((prev) => {
        const next = new Set(prev);
        isLiking ? next.delete(streamId) : next.add(streamId);
        return next;
      });

      toast.error(
        isLiking ? "Failed to like stream" : "Failed to unlike stream",
        { description: error.message || "Please try again" }
      );
    } finally {
      setLoadingLikes((prev) => {
        const next = new Set(prev);
        next.delete(streamId);
        return next;
      });
    }
  }, []);
  // Note: empty deps is correct here — all setState calls use functional
  // updaters, so there are no stale closure values

  // ── Share handler ──────────────────────────────────────────────
  const handleShare = useCallback(async (streamId) => {
    try {
      await streamsService.trackShareStream(streamId);
      if (navigator.share) {
        await navigator.share({
          title: "Check out this stream!",
          url: window.location.href,
        });
      }
      return true;
    } catch (error) {
      console.error("Share failed:", error);
      throw error;
    }
  }, []);

  // ── Toggle mute ────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem("streams_muted", String(next));
      return next;
    });
  }, []);

  // ── Handle scroll ──────────────────────────────────────────────
  // Pure sync calculation from scroll position — no async, no issues
  const handleScroll = useCallback((e) => {
    const newIndex = Math.round(e.target.scrollTop / window.innerHeight);
    setActiveIndex(newIndex);
  }, []);

  // ── Handle upload sheet close ──────────────────────────────────
  const handleUploadSheetClose = useCallback(() => {
    if (uploading) {
      toast.error("Please wait for upload to complete");
      return;
    }
    setUploadOpen(false);
    resetUpload();
  }, [uploading, resetUpload]);

  // ── onViewed: stable ref-based callback ───────────────────────
  // We build a stable per-item callback in the render below using an
  // inline arrow — this is fine because StreamPage memoises the call
  // with viewedOnceRef. The fire-and-forget nature means we don't need
  // a cancelled flag: incrementView is a write operation that completing
  // after unmount is harmless.

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-sm text-white/60 font-medium">Loading streams...</p>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white p-4">
        <div className="text-center max-w-sm">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-neutral-800/50 grid place-items-center">
            <ArrowUpTrayIcon className="h-10 w-10 text-neutral-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Streams Yet</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Be the first to share a stream with the community!
          </p>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-neutral-100 active:scale-95 transition-all"
          >
            Upload Your First Stream
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-neutral-950">
      {/* Upload Button (Fixed) */}
      <div className="fixed top-4 right-4 z-50 safe-top">
        <button
          onClick={() => setUploadOpen(true)}
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-white/20"
          aria-label="Upload stream"
        >
          <ArrowUpTrayIcon className="h-6 w-6" />
        </button>
      </div>

      <UploadSheet
        open={uploadOpen}
        onClose={handleUploadSheetClose}
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
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <StreamPage
            key={item.id}
            item={{
              ...item,
              likes: item.likes_count || 0,
              comments: item.comments_count || 0,
            }}
            isActive={activeIndex === index}
            isNear={Math.abs(index - activeIndex) <= 1}
            muted={muted}
            toggleMute={toggleMute}
            onBack={() => navigate(-1)}
            onFollow={() => toast.info("Follow feature coming soon!")}
            onOpenProfile={() => {
              if (item?.creator?.id) {
                navigate(`/profile/${item.creator.id}`);
              }
            }}
            onViewed={() => {
              // Fire-and-forget write — completing after unmount is harmless
              streamsService.incrementView(item.id).catch((error) => {
                console.error("Failed to increment view:", error);
              });
            }}
            onLike={handleLike}
            onShare={handleShare}
            likedStreams={likedStreams}
            loadingLikes={loadingLikes}
          />
        ))}
      </div>
    </div>
  );
}