import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import { streamsService } from "../services/streams.service.js";

// Constants
const DEFAULT_AVATAR = "/me.jpg";
const MAX_CAPTION_LENGTH = 200;
const UPLOAD_PROGRESS_INTERVAL = 120;
const UPLOAD_PROGRESS_INCREMENT = 0.07;
const UPLOAD_PROGRESS_MIN = 0.7;
const UPLOAD_PROGRESS_MAX = 92;
const STREAMS_LIMIT = 20;
const LIKES_CACHE_DURATION = 60000;

// ==========================================
// UI HELPERS
// ==========================================

function IconPillButton({ title, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="grid h-12 w-12 place-items-center rounded-full bg-neutral-800/60 text-white backdrop-blur-md hover:bg-neutral-700/80 active:scale-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function CountText({ children }) {
  return (
    <div className="mt-1 text-[11px] font-medium text-neutral-300">
      {children}
    </div>
  );
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

// ==========================================
// VOLUME CONTROLLER
// ==========================================

function VolumeControl({ muted, onToggleMute, videoRef }) {
  const [volume, setVolume] = useState(1);
  const [showSlider, setShowSlider] = useState(false);

  const handleVolumeChange = useCallback(
    (e) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);

      if (videoRef.current) {
        videoRef.current.volume = newVol;
        if (newVol > 0 && muted) {
          onToggleMute();
        }
      }
    },
    [muted, onToggleMute, videoRef]
  );

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      {/* Volume Slider Popover */}
      <div
        className={`absolute bottom-full mb-3 transition-all duration-300 origin-bottom ${
          showSlider
            ? "scale-100 opacity-100"
            : "scale-75 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-neutral-900/90 backdrop-blur-xl p-3 rounded-2xl h-32 flex items-center justify-center border border-white/10 shadow-2xl">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="accent-white h-24 cursor-pointer"
            style={{ WebkitAppearance: "slider-vertical" }}
            aria-label="Volume control"
          />
        </div>
      </div>

      <button
        onClick={onToggleMute}
        className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 backdrop-blur-md hover:bg-neutral-700 transition-colors"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? (
          <SpeakerXMarkIcon className="h-5 w-5 text-white" />
        ) : (
          <SpeakerWaveIcon className="h-5 w-5 text-white" />
        )}
      </button>
    </div>
  );
}

// ==========================================
// STREAM PAGE COMPONENT
// ==========================================

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

  // Track view
  useEffect(() => {
    if (isActive && !viewedOnceRef.current) {
      viewedOnceRef.current = true;
      onViewed?.();
    }
    if (!isActive) {
      viewedOnceRef.current = false;
    }
  }, [isActive, onViewed]);

  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      userPausedRef.current = false;
      try {
        await video.play();
      } catch (error) {
        console.error("Play failed:", error);
      }
    } else {
      video.pause();
      userPausedRef.current = true;
    }
  }, []);

  const handleLike = useCallback(() => {
    onLike(item.id, !isLiked);
  }, [item.id, isLiked, onLike]);

  const handleShare = useCallback(async () => {
    setShareLoading(true);
    try {
      await onShare(item.id);
      toast.success("Stream shared successfully");
    } catch (error) {
      console.error("Share failed:", error);
      toast.error("Failed to share stream");
    } finally {
      setShareLoading(false);
    }
  }, [item.id, onShare]);

  const likeCount = useMemo(() => {
    return formatCompact(item.likes + (isLiked ? 1 : 0));
  }, [item.likes, isLiked]);

  return (
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-black text-white">
      <Stage>
        <button
          type="button"
          onClick={togglePlayPause}
          className="absolute inset-0 z-10"
          aria-label="Play or pause video"
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
          <div className="absolute inset-0 h-full w-full bg-neutral-900 grid place-items-center" />
        )}

        {/* Gradient overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 to-transparent" />

        {/* Play indicator */}
        {isPaused && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg animate-in zoom-in-90">
              <PlayIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="absolute left-0 right-0 top-0 z-30 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-800/60 backdrop-blur-md hover:bg-neutral-700 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onFollow}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-100 transition-colors"
              >
                Follow
              </button>
            </div>

            <div className="flex items-center gap-2">
              <VolumeControl
                muted={muted}
                onToggleMute={toggleMute}
                videoRef={videoRef}
              />
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6">
          {/* Like Button */}
          <div className="flex flex-col items-center">
            <IconPillButton
              title={isLiked ? "Unlike" : "Like"}
              onClick={handleLike}
              disabled={loadingLikes.has(item.id)}
            >
              <HeartIcon
                className={`h-6 w-6 transition-all ${
                  isLiked ? "text-red-500 scale-110" : "text-white"
                }`}
              />
            </IconPillButton>
            <CountText>{likeCount}</CountText>
          </div>

          {/* Comments Button */}
          <div className="flex flex-col items-center">
            <IconPillButton
              title="Comments coming soon"
              onClick={() => toast.info("Comments coming soon")}
              disabled
            >
              <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-white" />
            </IconPillButton>
            <CountText>{formatCompact(item.comments || 0)}</CountText>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center">
            <IconPillButton
              title="Share stream"
              onClick={handleShare}
              disabled={shareLoading}
            >
              <ShareIcon className="h-6 w-6 text-white" />
            </IconPillButton>
          </div>
        </div>

        {/* Bottom Creator Info */}
        <div className="absolute bottom-0 left-0 right-0 z-30 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenProfile}
              className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/20 hover:border-white/40 transition-colors"
              aria-label="View creator profile"
            >
              <img
                src={item?.creator?.avatar_url || DEFAULT_AVATAR}
                alt={item?.creator?.display_name || "Creator"}
                className="h-full w-full object-cover"
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {item?.creator?.display_name || "Unknown"}
              </p>
              <p className="text-[11px] text-neutral-300">
                {formatCompact(item.views_count)} views
              </p>
            </div>
          </div>

          {item.caption && (
            <div className="mt-3 rounded-xl bg-neutral-900/50 p-3.5 backdrop-blur-md border border-white/10">
              <p className="text-xs text-neutral-200 leading-relaxed">
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

// ==========================================
// UPLOAD SHEET COMPONENT
// ==========================================

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

  if (!open) return null;

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }, [setFile]);

  const handleCaptionChange = useCallback(
    (e) => {
      const value = e.target.value.slice(0, MAX_CAPTION_LENGTH);
      setCaption(value);
    },
    [setCaption]
  );

  const handleBackdropClick = useCallback(() => {
    if (!uploading) {
      onClose();
    }
  }, [uploading, onClose]);

  const isUploadDisabled = uploading || !file;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl flex flex-col rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl h-[85dvh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5">
          <p className="text-sm font-semibold">Upload Stream</p>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 hover:bg-white/5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close upload sheet"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            {/* Video Preview */}
            <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/5">
              {previewUrl ? (
                <video
                  className="h-full w-full object-cover"
                  src={previewUrl}
                  muted
                  playsInline
                />
              ) : (
                <div className="grid h-full place-items-center text-[10px] text-neutral-500">
                  No Preview
                </div>
              )}
            </div>

            {/* Upload Form */}
            <div className="space-y-5">
              {/* File Input */}
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-xl border border-white/5 bg-white/5 p-4 text-left hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold">
                  {file ? file.name : "Choose video file"}
                </p>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />

              {/* Caption Input */}
              <div>
                <textarea
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="Caption..."
                  className="w-full rounded-xl bg-white/5 p-4 text-sm outline-none focus:ring-1 ring-white/20 h-28 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={uploading}
                  maxLength={MAX_CAPTION_LENGTH}
                  aria-label="Stream caption"
                />
                <p className="text-xs text-neutral-400 mt-1">
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </p>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white/80">
                      Uploading
                    </span>
                    <span className="font-semibold text-white/80">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={uploading}
                  className="flex-1 py-3 rounded-full border border-white/10 text-sm hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={onUpload}
                  disabled={isUploadDisabled}
                  className="flex-1 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN STREAMS COMPONENT
// ==========================================

export default function Streams() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);
  const progressTimerRef = useRef(null);

  // Stream data
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Audio preference
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem("streams_muted") !== "false";
  });

  // Upload sheet state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Like management
  const [likedStreams, setLikedStreams] = useState(new Set());
  const [loadingLikes, setLoadingLikes] = useState(new Set());
  const likesCacheRef = useRef(null);

  // Load streams and likes
  useEffect(() => {
    const fetchStreamsAndLikes = async () => {
      try {
        const [streamsData, likedSet] = await Promise.all([
          streamsService.listApproved(STREAMS_LIMIT),
          streamsService.getUserLikedStreams().catch(() => new Set()),
        ]);
        
        setItems(streamsData);
        setLikedStreams(likedSet);
        
        likesCacheRef.current = {
          timestamp: Date.now(),
          data: likedSet,
        };
      } catch (error) {
        console.error("Failed to load streams:", error);
        toast.error("Failed to load streams");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreamsAndLikes();
  }, []);

  // Handle file preview
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

  // Progress management
  const startProgress = useCallback(() => {
    setProgress(0);
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(() => {
      setProgress((prevProgress) => {
        const increment = Math.max(
          UPLOAD_PROGRESS_MIN,
          (UPLOAD_PROGRESS_MAX - prevProgress) * UPLOAD_PROGRESS_INCREMENT
        );
        const nextProgress = prevProgress + increment;
        return nextProgress >= UPLOAD_PROGRESS_MAX
          ? UPLOAD_PROGRESS_MAX
          : nextProgress;
      });
    }, UPLOAD_PROGRESS_INTERVAL);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const resetUpload = useCallback(() => {
    setFile(null);
    setCaption("");
    setProgress(0);
    setUploading(false);
  }, []);

  // Upload handler
  const handleUpload = useCallback(async () => {
    if (!file) return;

    const toastId = toast.loading("Uploading your stream...");

    try {
      setUploading(true);
      startProgress();

      await streamsService.createPending({
        caption: caption.trim().slice(0, MAX_CAPTION_LENGTH),
        file,
      });

      stopProgress();
      setProgress(100);

      setTimeout(() => {
        setUploadOpen(false);
        resetUpload();
        toast.success("Stream Uploaded Successfully!", {
          id: toastId,
          description: "Your video is in the queue and will appear shortly.",
        });
      }, 450);
    } catch (error) {
      console.error("Upload failed:", error);
      stopProgress();
      setUploading(false);
      setProgress(0);
      toast.error("Upload Failed", {
        id: toastId,
        description: error.message || "Please try again later.",
      });
    }
  }, [file, caption, startProgress, stopProgress, resetUpload]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgress();
    };
  }, [stopProgress]);

  // Like handler
  const handleLike = useCallback((streamId, isLiking) => {
    setLoadingLikes((prev) => new Set(prev).add(streamId));

    setLikedStreams((prev) => {
      const newSet = new Set(prev);
      if (isLiking) {
        newSet.add(streamId);
      } else {
        newSet.delete(streamId);
      }
      return newSet;
    });

    const likePromise = isLiking
      ? streamsService.likeStream(streamId)
      : streamsService.unlikeStream(streamId);

    likePromise
      .catch(() => {
        setLikedStreams((prev) => {
          const newSet = new Set(prev);
          if (isLiking) {
            newSet.delete(streamId);
          } else {
            newSet.add(streamId);
          }
          return newSet;
        });
        toast.error(isLiking ? "Failed to like stream" : "Failed to unlike stream");
      })
      .finally(() => {
        setLoadingLikes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(streamId);
          return newSet;
        });
      });
  }, []);

  // Share handler
  const handleShare = useCallback(async (streamId) => {
    try {
      await streamsService.trackShareStream(streamId);
      return true;
    } catch (error) {
      console.error("Share tracking failed:", error);
      throw error;
    }
  }, []);

  // Toggle mute and persist
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const newMuted = !prev;
      localStorage.setItem("streams_muted", String(newMuted));
      return newMuted;
    });
  }, []);

  // Handle scroll
  const handleScroll = useCallback((e) => {
    const newActiveIndex = Math.round(e.target.scrollTop / window.innerHeight);
    setActiveIndex(newActiveIndex);
  }, []);

  // Handle upload sheet close
  const handleUploadSheetClose = useCallback(() => {
    if (uploading) return;
    setUploadOpen(false);
    resetUpload();
  }, [uploading, resetUpload]);

  if (isLoading) {
    return (
      <div className="h-dvh grid place-items-center bg-black">
        <div className="h-10 w-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh bg-neutral-950">
      {/* Upload Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setUploadOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow-lg hover:scale-105 active:scale-95 transition-all"
          aria-label="Upload stream"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Upload Sheet */}
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

      {/* Streams Scroller */}
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
              likes: item.likes_count || 1200,
              comments: item.comments_count || 0,
            }}
            isActive={activeIndex === index}
            isNear={Math.abs(index - activeIndex) <= 1}
            muted={muted}
            toggleMute={toggleMute}
            onBack={() => navigate(-1)}
            onFollow={() => navigate("/profile")}
            onOpenProfile={() => navigate(`/profile/${item.creator.id}`)}
            onViewed={() =>
              streamsService.incrementView(item.id).catch((error) => {
                console.error("Failed to increment view:", error);
              })
            }
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