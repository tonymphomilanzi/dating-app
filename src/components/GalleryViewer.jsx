import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function wrapIndex(i, len) { return (i + len) % len; }

export default function GalleryViewer({ images = [], initialIndex = 0, onClose, name = "Photo" }) {
  const pics = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(() => wrapIndex(initialIndex, pics.length));
  const [direction, setDirection] = useState(0);

  if (!pics.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <div className="text-center">
          <p className="text-gray-700">No photos</p>
          <button className="mt-2 text-violet-600" onClick={onClose}>Go back</button>
        </div>
      </div>
    );
  }

  const paginate = (dir) => { setDirection(dir); setIndex((i) => wrapIndex(i + dir, pics.length)); };
  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 140 : -140, opacity: 0, scale: 0.98 }),
    center: { x: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30 } },
    exit: (dir) => ({ x: dir < 0 ? 140 : -140, opacity: 0, scale: 0.98, transition: { duration: 0.18 } }),
  };

  return (
    <div className="relative min-h-screen bg-white text-gray-900">
      <div className="absolute left-4 top-4 z-20">
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-violet-200 bg-white text-violet-600 shadow-sm" aria-label="Back">
          <i className="lni lni-chevron-left text-lg" />
        </button>
      </div>

      <div className="pt-16 px-0 md:px-4">
        <div className="mx-auto w-full max-w-md md:max-w-2xl">
          <div className="relative overflow-hidden rounded-xl bg-gray-100">
            <div className="relative aspect-[3/4] select-none touch-pan-y">
              <AnimatePresence custom={direction} initial={false}>
                <motion.img
                  key={index}
                  src={pics[index]}
                  alt={`${name} ${index + 1}`}
                  custom={direction}
                  variants={variants}
                  initial="enter" animate="center" exit="exit"
                  drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4}
                  onDragEnd={(_, info) => { if (info.offset.x > 80) paginate(-1); else if (info.offset.x < -80) paginate(1); }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>

              <button className="absolute inset-y-0 left-0 w-1/3" aria-label="Previous" onClick={() => paginate(-1)} />
              <button className="absolute inset-y-0 right-0 w-1/3" aria-label="Next" onClick={() => paginate(1)} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="mx-auto mt-3 w-full max-w-md md:max-w-2xl">
          <div className="no-scrollbar mx-auto w-fit rounded-2xl border border-gray-100 bg-white/90 p-2 shadow-card">
            <div className="flex items-center gap-2 overflow-x-auto">
              {pics.map((src, i) => {
                const active = i === index;
                return (
                  <button
                    key={src + i}
                    onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                    className={`h-16 w-16 overflow-hidden rounded-xl bg-gray-100 ${active ? "ring-2 ring-violet-600" : "ring-1 ring-gray-200 opacity-80 hover:opacity-100"}`}
                    aria-label={`Go to image ${i + 1}`}
                  >
                    <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}