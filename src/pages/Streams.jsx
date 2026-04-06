// src/pages/Streams.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function IconButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/55 active:scale-95 transition"
    >
      {children}
    </button>
  );
}

function CountPill({ children }) {
  return (
    <div className="mt-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
      {children}
    </div>
  );
}

function VideoPlaceholder({ gradient = "from-violet-600 via-fuchsia-600 to-amber-500" }) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
      {/* subtle “noise/shine” overlay */}
      <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-[radial-gradient(circle_at_20%_10%,white,transparent_35%),radial-gradient(circle_at_80%_40%,white,transparent_40%),radial-gradient(circle_at_50%_90%,white,transparent_40%)]" />
      {/* fake video UI */}
      <div className="absolute left-3 top-3 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
        LIVE-ish • Preview
      </div>
    </div>
  );
}

function StreamsCard({ item, onOpenProfile }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <article className="w-full">
      {/* 16:9 frame */}
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        {/* 16:9 ratio */}
        <div className="relative aspect-video">
          <VideoPlaceholder gradient={item.gradient} />

          {/* Top overlay: category + more */}
          <div className="absolute left-0 right-0 top-0 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                  {item.topic}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                  {item.length}
                </span>
              </div>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
                title="More"
                aria-label="More"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right overlay actions */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 space-y-3">
            <div className="flex flex-col items-center">
              <IconButton
                title={liked ? "Unlike" : "Like"}
                onClick={() => setLiked((v) => !v)}
              >
                <svg
                  className={`h-5 w-5 ${liked ? "text-pink-300" : "text-white"}`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 21s-6.716-4.35-9.33-8.273C.646 9.6 1.55 6.77 3.77 5.32c2.1-1.37 4.69-.86 6.23.67 1.54-1.53 4.13-2.04 6.23-.67 2.22 1.45 3.12 4.28 1.1 7.407C18.716 16.65 12 21 12 21z" />
                </svg>
              </IconButton>
              <CountPill>{liked ? item.likes + 1 : item.likes}</CountPill>
            </div>

            <div className="flex flex-col items-center">
              <IconButton title="Comments" onClick={() => {}}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4a2 2 0 00-2 2v14a2 2 0 002 2h4l4 3 4-3h4a2 2 0 002-2V4a2 2 0 00-2-2z" />
                </svg>
              </IconButton>
              <CountPill>{item.comments}</CountPill>
            </div>

            <div className="flex flex-col items-center">
              <IconButton title="Share" onClick={() => {}}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8a3 3 0 10-2.83-4H15a3 3 0 00.17 1H8.82A3 3 0 006 4a3 3 0 103 3c0-.35-.06-.69-.17-1h6.35c-.11.31-.17.65-.17 1a3 3 0 103 3c0-.35-.06-.69-.17-1H13v2h4.82c-.11.31-.17.65-.17 1a3 3 0 103 3 3 3 0 00-2.83-4H13v2h2.17A3 3 0 0018 18a3 3 0 003-3 3 3 0 00-3-3 3 3 0 00-2.83 2H13V10h2.17A3 3 0 0018 8z" />
                </svg>
              </IconButton>
              <CountPill>Share</CountPill>
            </div>

            <div className="flex flex-col items-center">
              <IconButton
                title={saved ? "Saved" : "Save"}
                onClick={() => setSaved((v) => !v)}
              >
                <svg
                  className={`h-5 w-5 ${saved ? "text-amber-200" : "text-white"}`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 2h12a2 2 0 012 2v18l-8-4-8 4V4a2 2 0 012-2z" />
                </svg>
              </IconButton>
              <CountPill>{saved ? "Saved" : "Save"}</CountPill>
            </div>
          </div>

          {/* Bottom overlay: creator + caption */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="rounded-2xl bg-black/35 p-3 backdrop-blur border border-white/10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/40"
                  title="Open creator"
                  aria-label="Open creator"
                >
                  <img
                    src={item.avatar}
                    alt={item.creator}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{item.creator}</p>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-white/90">{item.caption}</p>
                  <p className="mt-1 text-[11px] text-white/80">
                    ♫ {item.audio}
                  </p>
                </div>

                <button
                  type="button"
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100 active:scale-95 transition"
                >
                  Follow
                </button>
              </div>
            </div>
          </div>

          {/* Play hint */}
          <div className="absolute left-3 bottom-3">
            <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              Tap to play (placeholder)
            </div>
          </div>
        </div>
      </div>

      {/* Under-card meta (desktop comfort) */}
      <div className="mt-3 flex items-center justify-between px-1 text-xs text-gray-500">
        <span>{item.timeAgo}</span>
        <span>{item.views} views</span>
      </div>
    </article>
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

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      {/* Top bar (sticky) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/75 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/15 active:scale-95 transition"
            aria-label="Back"
            title="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-xs text-white/70">Streams</p>
            <p className="truncate text-base font-semibold tracking-tight">
              Watch • Learn • Connect
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15 transition"
              title="Search"
            >
              Search
            </button>
            <button
              type="button"
              className="rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-950 hover:bg-white/90 transition"
              title="Upload (later)"
            >
              Upload
            </button>
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        {/* Mode chips */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {["For You", "Following", "Nearby", "Events"].map((t) => (
            <button
              key={t}
              type="button"
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {items.map((item) => (
            <StreamsCard
              key={item.id}
              item={item}
              onOpenProfile={() => navigate("/profile")} // placeholder behavior
            />
          ))}
        </div>

        {/* Bottom spacer (nice scroll end) */}
        <div className="h-10" />
      </main>
    </div>
  );
}