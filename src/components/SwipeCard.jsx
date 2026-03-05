import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useState } from "react";

export default function SwipeCard({ person, onSwipe, onOpen }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);

  // Stamps opacity/scale
  const likeOpacity = useTransform(x, [80, 180], [0, 1]);
  const likeScale = useTransform(x, [80, 180], [0.9, 1]);
  const nopeOpacity = useTransform(x, [-180, -80], [1, 0]);
  const nopeScale = useTransform(x, [-180, -80], [1, 0.9]);

  // State flags
  const draggingRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const [superFx, setSuperFx] = useState(false);

  const imgSrc =
    person.avatar_url ||
    person.photo ||
    person.photo_url ||
    person.photos?.[0] ||
    "https://picsum.photos/800/1200";
  const name = person.display_name || person.name || "Member";

  const throwOut = async (dir) => {
    if (animating) return;
    setAnimating(true);
    const to = dir === "right" ? window.innerWidth : -window.innerWidth;
    const ctrl = animate(x, to, { type: "spring", stiffness: 400, damping: 40, restDelta: 1 });
    await ctrl.finished.catch(() => {});
    onSwipe?.(dir);
    // parent removes this card; we don't reset x here
  };

  const snapBack = async () => {
    const ctrl = animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
    await ctrl.finished.catch(() => {});
  };

  const handleDragEnd = async (_, info) => {
    draggingRef.current = false;
    if (animating) return;
    const dx = info.offset.x;
    if (dx > 140) return throwOut("right");
    if (dx < -140) return throwOut("left");
    await snapBack();
  };

  const stopAll = (e) => {
    e.stopPropagation();
    e.preventDefault?.();
  };

  const onClickOpen = () => {
    if (!draggingRef.current && !animating) onOpen?.(person);
  };

  const onActionLeft = (e) => {
    stopAll(e);
    throwOut("left");
  };
  const onActionRight = (e) => {
    stopAll(e);
    throwOut("right");
  };
  const onActionSuper = async (e) => {
    stopAll(e);
    if (animating) return;
    setAnimating(true);
    setSuperFx(true);
    // small pulse then dispatch
    setTimeout(() => {
      onSwipe?.("super");
    }, 280);
  };

  return (
    <motion.div
      drag="x"
      style={{ x, rotate }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={() => (draggingRef.current = true)}
      onDragEnd={handleDragEnd}
      onClick={onClickOpen}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-card border border-gray-100"
    >
      {/* Photo */}
      <img
        src={imgSrc}
        alt={name}
        className="h-full w-full object-cover"
        draggable={false}
      />

      {/* Gradient for readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Content overlay (reserve space for dock) */}
      <div className="absolute inset-0 flex flex-col px-4 pt-4 pb-28">
        {/* Top badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="rounded-full bg-black/40 text-white text-xs px-3 py-1 backdrop-blur-sm ring-1 ring-white/10">
            {person.distance_km != null ? `${person.distance_km} km away` : "Distance n/a"}
          </div>
          <div className="rounded-full bg-violet-600 text-white text-xs px-3 py-1 shadow-glow">
            {person.match_score != null ? `${person.match_score}% Match` : "—% Match"}
          </div>
        </div>

        {/* Name/meta pinned above dock */}
        <div className="mt-auto text-white drop-shadow">
          <div className="text-xl font-semibold">
            {name}{person.age ? `, ${person.age}` : ""}
          </div>
          {person.city && <div className="text-sm text-white/90">{person.city}</div>}
        </div>
      </div>

      {/* LIKE stamp (top-right) */}
      <motion.div
        style={{ opacity: likeOpacity, scale: likeScale }}
        className="pointer-events-none absolute right-4 top-4 -rotate-12 rounded-lg border-4 border-green-500/90 bg-white/20 px-4 py-1 text-2xl font-extrabold uppercase text-green-500/90 shadow-[0_0_20px_rgba(34,197,94,0.35)] backdrop-blur-sm"
      >
        LIKE
      </motion.div>

      {/* NOPE stamp (top-left) */}
      <motion.div
        style={{ opacity: nopeOpacity, scale: nopeScale }}
        className="pointer-events-none absolute left-4 top-4 rotate-12 rounded-lg border-4 border-red-500/90 bg-white/20 px-4 py-1 text-2xl font-extrabold uppercase text-red-500/90 shadow-[0_0_20px_rgba(239,68,68,0.35)] backdrop-blur-sm"
      >
        NOPE
      </motion.div>

      {/* SUPER LIKE burst */}
      {superFx && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* radial glow */}
          <div className="absolute left-1/2 top-8 -translate-x-1/2">
            <div className="h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl" />
          </div>
          <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-lg border-4 border-cyan-400/90 bg-white/20 px-4 py-1 text-2xl font-extrabold uppercase text-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.35)] backdrop-blur-sm">
            SUPER LIKE
          </div>
        </div>
      )}

      {/* Action dock (above bottom, not overlapping text) */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
        <div className="flex w-full max-w-sm items-center justify-center gap-6">
          <button
            onPointerDown={stopAll}
            onClick={onActionLeft}
            className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card"
            aria-label="Nope"
          >
            <i className="lni lni-close text-2xl text-red-500" />
          </button>
          <button
            onPointerDown={stopAll}
            onClick={onActionSuper}
            className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow"
            aria-label="Super like"
          >
            <i className="lni lni-star text-2xl" />
          </button>
          <button
            onPointerDown={stopAll}
            onClick={onActionRight}
            className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card"
            aria-label="Like"
          >
            <i className="lni lni-heart text-2xl text-green-500" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}