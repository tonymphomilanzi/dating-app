import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function clamp(i, len) {
  if (len === 0) return 0;
  return Math.max(0, Math.min(i, len - 1));
}

function detectType(story) {
  if (story.type) return story.type;
  const url = (story.url || "").toLowerCase().split("?")[0];
  if (/\.(mp4|webm|ogg|mov)$/.test(url)) return "video";
  return "image";
}

// ─── MediaItem ───────────────────────────────────────────────────────────────
// Renders either an image or video, filling the container without cropping.

function MediaItem({ story, userName, onVideoReady, onVideoDuration }) {
  const videoRef = useRef(null);
  const type = detectType(story);

  useEffect(() => {
    if (type !== "video" || !videoRef.current) return;
    const vid = videoRef.current;

    const handleMeta = () => {
      if (vid.duration && isFinite(vid.duration)) {
        onVideoDuration?.(vid.duration * 1000);
      }
      onVideoReady?.();
    };

    const handleCanPlay = () => onVideoReady?.();

    vid.addEventListener("loadedmetadata", handleMeta);
    vid.addEventListener("canplay", handleCanPlay);

    // Reset & play
    vid.currentTime = 0;
    vid.play().catch(() => {});

    return () => {
      vid.removeEventListener("loadedmetadata", handleMeta);
      vid.removeEventListener("canplay", handleCanPlay);
      vid.pause();
    };
  }, [story.url, type, onVideoReady, onVideoDuration]);

  if (type === "video") {
    return (
      <video
        ref={videoRef}
        src={story.url}
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: "contain",
          objectPosition: "center",
          background: "#000",
        }}
        playsInline
        muted
        loop={false}
        preload="auto"
        draggable={false}
      />
    );
  }

  return (
    <img
      src={story.url}
      alt={`${userName || "Story"} photo`}
      className="absolute inset-0 h-full w-full"
      style={{
        objectFit: "contain",
        objectPosition: "center",
        background: "#000",
      }}
      draggable={false}
    />
  );
}

// ─── ProgressBars ─────────────────────────────────────────────────────────

function ProgressBars({ items, index, progress }) {
  return (
    <div
      className="absolute left-0 right-0 px-3"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)", zIndex: 20 }}
    >
      <div className="mx-auto flex max-w-md gap-[3px]">
        {items.map((_, i) => (
          <div
            key={`pb-${i}`}
            className="h-[3px] flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.35)" }}
          >
            <div
              className="h-full rounded-full bg-white"
              style={{
                width:
                  i < index
                    ? "100%"
                    : i > index
                    ? "0%"
                    : `${Math.round(progress * 100)}%`,
                transition: i === index ? "width 100ms linear" : "none",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StoryViewer ─────────────────────────────────────────────────────────────

/**
 * Props:
 * - user: { name, avatar, postedAt }
 * - stories: [{ id, url, type?: "image"|"video", durationMs?: number }]
 * - initialIndex?: number
 * - onClose?: () => void
 * - onSendMessage?: () => void
 * - onReact?: (liked: boolean) => void
 */
export default function StoryViewer({
  user = {
    name: "Arlene Nancy",
    avatar: "https://i.pravatar.cc/80?img=5",
    postedAt: Date.now() - 3_600_000,
  },
  stories = [
    {
      id: "s1",
      url: "https://images.unsplash.com/photo-1548142813-c348350df52b?q=80&w=1600&auto=format&fit=crop",
      durationMs: 7000,
    },
  ],
  initialIndex = 0,
  onClose,
  onSendMessage,
  onReact,
}) {
  const items = useMemo(() => stories.filter(Boolean), [stories]);

  const [index, setIndex] = useState(() => clamp(initialIndex, items.length));
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [direction, setDirection] = useState(0); // for animation
  const [videoDur, setVideoDur] = useState(null); // ms override for current video

  // Stable refs to avoid stale closures in rAF
  const pausedRef = useRef(paused);
  const progressRef = useRef(progress);
  pausedRef.current = paused;
  progressRef.current = progress;

  // Compute duration: video overrides durationMs, fallback 7s
  const getDuration = useCallback(
    (i) => {
      const item = items[i];
      if (!item) return 7000;
      if (detectType(item) === "video" && videoDur) return videoDur;
      return item.durationMs || 7000;
    },
    [items, videoDur]
  );

  const goNext = useCallback(() => {
    if (index < items.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else {
      onClose?.();
    }
  }, [index, items.length, onClose]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  // rAF-based progress
  useEffect(() => {
    if (!items.length) return;

    let rafId = 0;
    let startTime = null;
    let cancelled = false;

    setProgress(0);

    const dur = getDuration(index);

    const tick = (now) => {
      if (cancelled) return;

      if (!pausedRef.current) {
        if (startTime === null) startTime = now - progressRef.current * dur;
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / dur);
        setProgress(p);
        progressRef.current = p;

        if (p >= 1) {
          // advance after a single frame
          rafId = requestAnimationFrame(() => {
            if (!cancelled) goNext();
          });
          return;
        }
      } else {
        // while paused: slide startTime forward so we resume from the same spot
        if (startTime !== null) {
          startTime = now - progressRef.current * dur;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [index, items.length, getDuration, goNext]);

  // Reset video duration when index changes
  useEffect(() => {
    setVideoDur(null);
  }, [index]);

  const toggleLike = () => {
    const v = !liked;
    setLiked(v);
    onReact?.(v);
  };

  // Slide variants
  const variants = {
    enter: (dir) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 380, damping: 32 },
    },
    exit: (dir) => ({
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: { duration: 0.18, ease: "easeIn" },
    }),
  };

  if (!items.length) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black text-white">
        <div className="text-center space-y-3">
          <p className="text-white/70">No stories available</p>
          <button
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/20"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentItem = items[index];
  const currentType = detectType(currentItem);

  return (
    <div
      className="fixed inset-0 z-50 select-none overflow-hidden bg-black"
      // Pause on hold (long press / pointer down)
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      {/* ── Media Layer ─────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentItem?.id || currentItem?.url || index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              const { offset } = info;
              if (offset.y > 150) {
                onClose?.();
                return;
              }
              if (offset.x < -60) {
                setDirection(1);
                goNext();
              } else if (offset.x > 60) {
                setDirection(-1);
                goPrev();
              }
            }}
            className="absolute inset-0"
            style={{ willChange: "transform" }}
          >
            <MediaItem
              story={currentItem}
              userName={user?.name}
              onVideoReady={() => setPaused(false)}
              onVideoDuration={(ms) => setVideoDur(ms)}
            />

            {/* Subtle vignette so UI text stays readable */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 70%, rgba(0,0,0,0.65) 100%)",
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Progress Bars ───────────────────────────────────── */}
      <ProgressBars items={items} index={index} progress={progress} />

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="absolute left-0 right-0 px-3"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 22px)",
          zIndex: 20,
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Avatar + name + time */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/70">
              <img
                src={user?.avatar}
                alt={user?.name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white drop-shadow">
                {user?.name || "User"}
              </div>
              <div className="text-[11px] font-normal text-white/75 drop-shadow">
                {timeAgo(user?.postedAt)}
              </div>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 active:scale-90"
            aria-label="Close"
          >
            {/* Simple × icon that doesn't need an icon library */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tap Zones (prev / next) ──────────────────────────── */}
      {/* Only cover the top 68% so bottom controls stay untouched */}
      <button
        aria-label="Previous story"
        onPointerDown={(e) => {
          e.stopPropagation();
          setPaused(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setPaused(false);
          setDirection(-1);
          goPrev();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          setPaused(false);
        }}
        className="absolute left-0 top-0 w-1/3"
        style={{ height: "68%", zIndex: 10, background: "transparent" }}
      />
      <button
        aria-label="Next story"
        onPointerDown={(e) => {
          e.stopPropagation();
          setPaused(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setPaused(false);
          setDirection(1);
          goNext();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          setPaused(false);
        }}
        className="absolute right-0 top-0 w-1/3"
        style={{ height: "68%", zIndex: 10, background: "transparent" }}
      />

      {/* ── Paused indicator ─────────────────────────────────── */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 15 }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="white">
                <rect x="3" y="2" width="5" height="18" rx="1.5" />
                <rect x="14" y="2" width="5" height="18" rx="1.5" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Actions ───────────────────────────────────── */}
      <div
        className="absolute inset-x-0 px-5"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          zIndex: 20,
        }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          {/* Send message – takes remaining width */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendMessage?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center rounded-full border border-white/50 bg-white/10 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
          >
            Send Message
          </button>

          {/* Like button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            aria-label={liked ? "Unlike" : "Like"}
            className="flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-full transition active:scale-90"
            style={{
              width: 52,
              height: 52,
              background: liked
                ? "linear-gradient(160deg,#c026d3,#7c3aed)"
                : "linear-gradient(160deg,rgba(192,38,211,0.6),rgba(124,58,237,0.6))",
              boxShadow: liked ? "0 0 18px 2px rgba(167,139,250,0.45)" : "none",
            }}
          >
            {liked ? (
              // Filled heart
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              // Outline heart
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}