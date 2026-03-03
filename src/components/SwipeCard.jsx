import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRef } from "react";

export default function SwipeCard({ person, onSwipe, onOpen }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const draggingRef = useRef(false);

  const imgSrc =
    person.avatar_url ||
    person.photo ||
    person.photo_url ||
    person.photos?.[0] ||
    "https://picsum.photos/800/1200";
  const name = person.display_name || person.name || "Member";

  const stopDrag = (e) => e.stopPropagation();

  return (
    <motion.div
      drag="x"
      style={{ x, rotate }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={() => (draggingRef.current = true)}
      onDragEnd={(_, info) => {
        // swipe commit
        if (info.offset.x > 150) onSwipe?.("right", person);
        else if (info.offset.x < -150) onSwipe?.("left", person);
        // allow click after a tick
        setTimeout(() => (draggingRef.current = false), 0);
      }}
      onClick={() => {
        if (!draggingRef.current) onOpen?.(person);
      }}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-card border border-gray-100"
    >
      <img src={imgSrc} alt={name} className="h-full w-full object-cover" draggable={false} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Content overlay reserved space for dock */}
      <div className="absolute inset-0 flex flex-col px-4 pt-4 pb-28">
        <div className="flex items-start justify-between gap-2">
          <div className="rounded-full bg-black/40 text-white text-xs px-3 py-1 backdrop-blur-sm ring-1 ring-white/10">
            {person.distance_km != null ? `${person.distance_km} km away` : "Distance n/a"}
          </div>
          <div className="rounded-full bg-violet-600 text-white text-xs px-3 py-1 shadow-glow">
            {person.match_score != null ? `${person.match_score}% Match` : "—% Match"}
          </div>
        </div>

        <div className="mt-auto text-white drop-shadow">
          <div className="text-xl font-semibold">
            {(person.display_name || person.name || "Member")}{person.age ? `, ${person.age}` : ""}
          </div>
          {person.city && <div className="text-sm text-white/90">{person.city}</div>}
        </div>
      </div>

      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-4 top-4 -rotate-12 rounded-md border-2 border-violet-500 bg-white/10 px-3 py-1 text-sm font-bold uppercase text-violet-500 backdrop-blur-sm"
      >
        Like
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-4 top-4 rotate-12 rounded-md border-2 border-gray-300 bg-white/10 px-3 py-1 text-sm font-bold uppercase text-gray-200 backdrop-blur-sm"
      >
        Nope
      </motion.div>

      {/* Action dock above bottom, not overlapping text */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
        <div className="flex w-full max-w-sm items-center justify-center gap-6">
          <button onPointerDown={stopDrag} onClick={() => onSwipe?.("left", person)} className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card" aria-label="Nope">
            <i className="lni lni-close text-2xl text-gray-700" />
          </button>
          <button onPointerDown={stopDrag} onClick={() => onSwipe?.("super", person)} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow" aria-label="Super like">
            <i className="lni lni-star text-2xl" />
          </button>
          <button onPointerDown={stopDrag} onClick={() => onSwipe?.("right", person)} className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card" aria-label="Like">
            <i className="lni lni-heart text-2xl text-violet-600" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}