import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Format "1 hour ago"
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
  user = { name: "Arlene Nancy", avatar: "https://i.pravatar.cc/80?img=5", postedAt: Date.now() - 3600_000 },
  stories = [
    { id: "s1", url: "https://images.unsplash.com/photo-1548142813-c348350df52b?q=80&w=1600&auto=format&fit=crop", durationMs: 7000 },
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
  const [progress, setProgress] = useState(0); // 0..1 for current item

  // Auto progress using rAF
  useEffect(() => {
    if (!items.length) return;
    let raf = 0;
    const dur = items[index]?.durationMs || 7000;
    let start = performance.now();
    const tick = (t) => {
      if (!paused) {
        const p = Math.min(1, (t - start) / dur);
        setProgress(p);
        if (p >= 1) {
          next();
          return;
        }
      } else {
        // keep start in sync while paused
        start = t - progress * dur;
      }
      raf = requestAnimationFrame(tick);
    };
    setProgress(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, items.length]);

  const next = () => {
    if (index < items.length - 1) setIndex((i) => i + 1);
    else onClose?.();
  };
  const prev = () => setIndex((i) => (i > 0 ? i - 1 : 0));

  // Drag/swipe gestures on the media
  const directionRef = useRef(0);
  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0.9, scale: 0.995 }),
    center: { x: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30 } },
    exit: (dir) => ({ x: dir < 0 ? 80 : -80, opacity: 0.9, scale: 0.995, transition: { duration: 0.16 } }),
  };

  // Handle like toggle
  const toggleLike = () => {
    const v = !liked;
    setLiked(v);
    onReact?.(v);
  };

  if (!items.length) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 text-white">
        <div className="text-center">
          <p>No story</p>
          <button className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm" onClick={() => onClose?.()}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 select-none bg-black"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      {/* Media */}
      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={directionRef.current}>
          <motion.img
            key={items[index]?.id || items[index]?.url || index}
            src={items[index]?.url}
            alt={`${user?.name || "Story"} ${index + 1}`}
            custom={directionRef.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) return onClose?.(); // swipe down to close
              if (info.offset.x < -80) {
                directionRef.current = 1;
                next();
              } else if (info.offset.x > 80) {
                directionRef.current = -1;
                prev();
              }
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* Top gradient for readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      {/* Progress bar (single slim bar like the mock; supports multiple items) */}
      <div className="absolute left-0 right-0 top-3 px-3">
        <div className="mx-auto flex max-w-md gap-1">
          {items.map((_, i) => (
            <div key={`p-${i}`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className={`h-full bg-white transition-[width] duration-150`}
                style={{
                  width:
                    i < index ? "100%" : i > index ? "0%" : `${Math.round(progress * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Header: avatar, name, time, close */}
      <div className="absolute left-3 right-3 top-6 mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70"
            draggable={false}
          />
          <div className="leading-tight">
            <div className="text-sm font-medium text-white">{user?.name || "User"}</div>
            <div className="text-[11px] text-white/80">{timeAgo(user?.postedAt)}</div>
          </div>
        </div>
        <button
          onClick={() => onClose?.()}
          className="rounded-full p-2 text-white hover:bg-white/10 active:scale-95"
          aria-label="Close"
        >
          <i className="lni lni-close text-xl" />
        </button>
      </div>

      {/* Tap zones for prev/next (don’t interfere with bottom buttons) */}
      <button
        aria-label="Previous"
        onClick={() => {
          directionRef.current = -1;
          prev();
        }}
        className="absolute left-0 top-0 h-[70%] w-1/2"
      />
      <button
        aria-label="Next"
        onClick={() => {
          directionRef.current = 1;
          next();
        }}
        className="absolute right-0 top-0 h-[70%] w-1/2"
      />

      {/* Bottom actions: Send Message + Like */}
      <div className="absolute inset-x-0 bottom-6 px-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => onSendMessage?.()}
            className="rounded-full border border-white/70 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/10 active:scale-95"
          >
            Send Message
          </button>

          <button
            onClick={toggleLike}
            aria-label="Like"
            className={`grid h-14 w-14 place-items-center rounded-full text-white shadow-lg active:scale-95
              ${liked
                ? "bg-gradient-to-b from-fuchsia-600 to-violet-600"
                : "bg-gradient-to-b from-fuchsia-600/70 to-violet-600/70"}
            `}
          >
            <i className={`lni lni-heart text-2xl ${liked ? "" : "opacity-90"}`} />
          </button>
        </div>
      </div>

      {/* Safe-area spacer (iOS home indicator) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}