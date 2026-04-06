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
  ArrowUpTrayIcon,
} from "@heroicons/react/24/solid";
import { streamsService } from "../services/streams.service.js";

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

function StreamPage({ item, onBack, onFollow, onOpenProfile, onViewed }) {
  const [liked, setLiked] = useState(false);

  // only count a view once per mount of this page
  useEffect(() => {
    onViewed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  return (
    <section className="relative h-dvh w-full snap-start overflow-hidden bg-neutral-950 text-white">
      {/* Ambient blur background */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${item?.creator?.avatar_url || "/me.jpg"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(24px)",
            transform: "scale(1.1)",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-black/65" />

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
          {/* Real video */}
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={item.url}
            playsInline
            controls={false}
            muted
            loop
            autoPlay
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 to-transparent" />

          {/* Top bar */}
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
                >
                  Follow
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                  Streams
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

          {/* Right actions */}
          <div className="absolute right-4 bottom-28 z-30 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <IconPillButton title={liked ? "Unlike" : "Like"} onClick={() => setLiked((v) => !v)}>
                <HeartIcon className={`h-6 w-6 ${liked ? "text-pink-300" : "text-white"}`} />
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

          {/* Bottom creator + views + caption */}
          <div className="absolute bottom-0 left-0 right-0 z-30 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenProfile}
                className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-white/35"
                title="Open creator"
                aria-label="Open creator"
              >
                <img
                  src={item?.creator?.avatar_url || "/me.jpg"}
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
                <p className="text-xs text-white/90 leading-relaxed">{item.caption}</p>
              </div>
            )}
          </div>

          <SwipeDownHint />
        </div>
      </div>
    </section>
  );
}

export default function Streams() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // MVP placeholder counts for likes/comments until you implement tables
  const enriched = useMemo(
    () =>
      items.map((s) => ({
        ...s,
        likes: 1200, // placeholder until stream_likes table
        comments: 188, // placeholder until stream_comments table
      })),
    [items]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        const data = await streamsService.listApproved(30);
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load streams");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Desktop wheel: next/prev page (optional, keeps your earlier behavior)
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const h = window.innerHeight || el.clientHeight || 1;
      const idx = Math.round(el.scrollTop / h);
      setActiveIndex(idx);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (wheelLockRef.current) return;
      if (Math.abs(e.deltaY) < 10) return;

      e.preventDefault();
      wheelLockRef.current = true;

      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(enriched.length - 1, activeIndex + dir));
      el.scrollTo({ top: next * window.innerHeight, behavior: "smooth" });

      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 450);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activeIndex, enriched.length]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const handlePickFile = () => fileInputRef.current?.click();

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      await streamsService.createPending({ caption, file });
      setCaption("");
      alert("Uploaded! Your stream is pending admin approval.");
    } catch (e) {
      alert(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white">
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">Loading streams…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold">Failed to load</p>
          <p className="mt-1 text-xs text-white/70">{error}</p>
          <button
            className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!enriched.length) {
    return (
      <div className="h-dvh grid place-items-center bg-neutral-950 text-white px-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold">No streams yet</p>
          <p className="mt-1 text-xs text-white/70">
            Upload one (it will be pending approval), then approve it in Supabase to test the feed.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-950"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            <button
              className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white border border-white/10"
              onClick={handlePickFile}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload stream"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-neutral-950">
      {/* Floating upload (MVP) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption…"
          className="hidden md:block w-64 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-white placeholder:text-white/60 backdrop-blur outline-none"
        />

        <button
          type="button"
          onClick={handlePickFile}
          disabled={uploading}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-950 shadow hover:bg-white/90 disabled:opacity-60"
          title="Upload stream"
          aria-label="Upload stream"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </div>

      <div
        ref={scrollerRef}
        className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {enriched.map((item) => (
          <StreamPage
            key={item.id}
            item={item}
            onBack={() => navigate(-1)}
            onFollow={() => {}}
            onOpenProfile={() => navigate("/profile")}
            onViewed={() => streamsService.incrementView(item.id).catch(() => {})}
          />
        ))}
      </div>
    </div>
  );
}