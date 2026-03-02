import { motion, useMotionValue, useTransform } from "framer-motion";

export default function SwipeCard({ person, onSwipe }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-12, 0, 12]);

  return (
    <motion.div
      drag="x"
      style={{ x, rotate }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 150) onSwipe("right");
        else if (info.offset.x < -150) onSwipe("left");
      }}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-card"
    >
      <img src={person.photo} className="h-full w-full object-cover" />
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-4">
        <div className="text-white">
          <div className="text-xl font-semibold">{person.name}, {person.age}</div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-4 p-4">
        <div className="pointer-events-auto flex w-full justify-center gap-6">
          <button onClick={() => onSwipe("left")} className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card" aria-label="Nope">
            <i className="lni lni-close text-2xl text-gray-700" />
          </button>
          <button onClick={() => onSwipe("super")} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow" aria-label="Super like">
            <i className="lni lni-star text-2xl" />
          </button>
          <button onClick={() => onSwipe("right")} className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card" aria-label="Like">
            <i className="lni lni-heart text-2xl text-violet-600" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}