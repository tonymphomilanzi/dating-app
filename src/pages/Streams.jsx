// src/pages/Streams.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  HeartIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ShareIcon,
} from "@heroicons/react/24/solid";

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

function VideoPlaceholder({ gradient }) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
      <div className="absolute inset-0 opacity-25 mix-blend-overlay bg-[radial-gradient(circle_at_20%_10%,white,transparent_35%),radial-gradient(circle_at_80%_40%,white,transparent_40%),radial-gradient(circle_at_50%_90%,white,transparent_40%)]" />
    </div>
  );
}

function SwipeDownHint() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex flex-col items-center gap-1 text-white/85">
        <ChevronDownIcon className="h-6 w-6 animate-bounce" />
      </div>
    </div>
  );
}

/**
 * TikTok-style page:
 * - Full screen snap page
 * - 9:16 stage (fills on mobile; centered phone on desktop)
 */
function StreamPage({ item, onBack, onFollow, onOpenProfile }) {
  const [liked, setLiked] = useState(false);

  return (
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-neutral-950 text-white">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-30">
        <VideoPlaceholder gradient={item.gradient} />
      </div>
      <div className="absolute inset-0 bg-black/55" />

      {/* Center stage */}
      <div className="relative z-10 mx-auto flex h-dvh w-full max-w-4xl items-center justify-center px-0 md:px-6">
        <div
          className={[
            "relative w-full h-dvh md:h-[92dvh]",
            "md:max-h-[920px]",
            "md:rounded-[2.25rem]",
            "overflow-hidden bg-black",
            "md:border md:border-white/10",
            "md:shadow-[0_30px_120px_rgba(0,0,0,0.65)]",
            "md:aspect-[9/16] md:w-auto",
          ].join(" ")}
        >
          {/* The "video" */}
          <VideoPlaceholder gradient={item.gradient} />

          {/* readability gradients */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 to-transparent" />

          {/* Top bar: back + follow together on the left */}
          <div className="absolute left-0 right-0 top-0 z-30 px-4 pt-4">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 active:scale-95 transition"
                  aria-label="Back"
                  title="Back"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={onFollow}
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-white/90 active:scale-95 transition"
                  title="Follow"
                  aria-label="Follow"
                >
                  Follow
                </button>
              </div>

              {/* right side: chips + more */}
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                  {item.topic}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                  {item.length}
                </span>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
                  title="More"
                  aria-label="More"
                >
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right actions (spaced, no save, no share text) */}
          <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <IconPillButton title={liked ? "Unlike" : "Like"} onClick={() => setLiked((v) => !v)}>
                <HeartIcon className={`h-6 w-6 ${liked ? "text-pink-300" : "text-white"}`} />
              </IconPillButton>
              <CountText>{liked ? item.likes + 1 : item.likes}</CountText>
            </div>

            <div className="flex flex-col items-center">
              <IconPillButton title="Comments" onClick={() => {}}>
                <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-white" />
              </IconPillButton>
              <CountText>{item.comments}</CountText>
            </div>

            <div className="flex flex-col items-center">
              <IconPillButton title="Share" onClick={() => {}}>
                <ShareIcon className="h-6 w-6 text-white" />
              </IconPillButton>
            </div>
          </div>

          {/* Bottom creator + meta + caption */}
          <div className="absolute bottom-0 left-0 right-0 z-30 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenProfile}
                className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-white/35"
                title="Open creator"
                aria-label="Open creator"
              >
                <img src={item.avatar} alt={item.creator} className="h-full w-full object-cover" draggable={false} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{item.creator}</p>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {item.tag}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-[11px] text-white/75">
                  <span>{item.timeAgo}</span>
                  <span>{item.views} views</span>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-3 backdrop-blur border border-white/10">
              <p className="text-xs text-white/90 leading-relaxed">{item.caption}</p>
              <p className="mt-1 text-[11px] text-white/75">♫ {item.audio}</p>
            </div>
          </div>

          {/* Swipe down hint (animated arrow only) */}
          <SwipeDownHint />

          {/* Center play hint (placeholder) */}
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="rounded-full bg-black/30 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur">
              Tap to play (placeholder)
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Streams() {
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      {
        id: "s1",
        topic: "Dating Tips",
        length: "0:32",
        creator: "Ava Rivers",
        tag: "Trending",
        caption: "3 conversation starters that actually work (and don’t feel cringe).",
        audio: "Late Night Talk • Original",
        likes: 1240,
        comments: 188,
        views: "18.2K",
        timeAgo: "2h ago",
        avatar: "/me.jpg",
        gradient: "from-violet-600 via-fuchsia-600 to-amber-500",
      },
      {
        id: "s2",
        topic: "Events",
        length: "1:12",
        creator: "Kai Morgan",
        tag: "Nearby",
        caption: "Quick walk-through of tonight’s event vibe—come say hi.",
        audio: "City Lights • Remix",
        likes: 842,
        comments: 74,
        views: "9.6K",
        timeAgo: "5h ago",
        avatar: "/me.jpg",
        gradient: "from-sky-600 via-indigo-600 to-violet-600",
      },
      {
        id: "s3",
        topic: "Glow Up",
        length: "0:45",
        creator: "Nina Park",
        tag: "For You",
        caption: "Confidence hack: film yourself talking for 7 days. Results are wild.",
        audio: "Soft Focus • Original",
        likes: 2099,
        comments: 301,
        views: "24.1K",
        timeAgo: "1d ago",
        avatar: "/me.jpg",
        gradient: "from-emerald-600 via-teal-600 to-cyan-600",
      },
    ],
    []
  );

  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const h = window.innerHeight || el.clientHeight || 1;
      const idx = Math.round(el.scrollTop / h);
      if (idx !== activeIndex) setActiveIndex(idx);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIndex]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      // Desktop: wheel behaves like next/prev page
      if (wheelLockRef.current) return;
      if (Math.abs(e.deltaY) < 10) return;

      e.preventDefault();
      wheelLockRef.current = true;

      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(items.length - 1, activeIndex + dir));
      el.scrollTo({ top: next * window.innerHeight, behavior: "smooth" });

      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 450);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activeIndex, items.length]);

  return (
    <div className="h-dvh bg-neutral-950">
      <div
        ref={scrollerRef}
        className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item) => (
          <StreamPage
            key={item.id}
            item={item}
            onBack={() => navigate(-1)}
            onFollow={() => {}}
            onOpenProfile={() => navigate("/profile")}
          />
        ))}
      </div>

      {/* Page indicator (desktop) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden sm:block">
        <div className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur border border-white/10">
          {Math.min(activeIndex + 1, items.length)} / {items.length}
        </div>
      </div>
    </div>
  );
}