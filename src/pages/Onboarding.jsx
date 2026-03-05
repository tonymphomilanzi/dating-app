import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";

// Import images from your assets folder (adjust paths to match your project)
import slide1 from "../assets/onboarding/1.png";  
import slide2 from "../assets/onboarding/2.png";
import slide3 from "../assets/onboarding/3.png";

const slides = [
  { title:"Meet your match", desc:"Smart discovery that learns your vibe.", img: slide1 },
  { title:"Curated matches", desc:"People nearby who share your interests.", img: slide2 },
  { title:"Boost your journey", desc:"Stand out with boosts and super-likes.", img: slide3 },
];

export default function Onboarding(){
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const nav = useNavigate();
  const s = slides[i];

  const next = () => (i < slides.length - 1 ? (setDir(1), setI(i+1)) : nav("/auth"));
  const prev = () => i > 0 && (setDir(-1), setI(i-1));

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-gray-900">
      {/* Soft brand glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[38vh] w-[38vh] rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="absolute -bottom-28 -right-24 h-[42vh] w-[42vh] rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      {/* Top bar: Skip + progress */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <button
          onClick={()=>nav("/auth")}
          className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
        >
          Skip
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, idx)=>(
            <div
              key={idx}
              className={[
                "h-1.5 w-8 rounded-full transition-colors",
                idx <= i ? "bg-violet-600" : "bg-gray-200"
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 pt-3">
        {/* Image card (no more full-screen overlap) */}
        <div className="relative mx-auto w-full">
          <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gray-100 shadow-card">
            <div className="relative aspect-[4/5] select-none">
              <AnimatePresence initial={false} custom={dir}>
                <motion.img
                  key={s.img}
                  src={s.img}
                  alt={s.title}
                  custom={dir}
                  initial={{ x: dir > 0 ? "100%" : "-100%", opacity: 0.7, scale: 1.02 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: dir > 0 ? "-15%" : "15%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -80) next();
                    else if (info.offset.x > 80) prev();
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
              {/* Soft gradient at bottom of image (subtle, for depth) */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
            </div>

            
          </div>
        </div>

        {/* Copy */}
        <div className="mt-6 text-center">
          <h1 className="text-3xl font-extrabold leading-tight text-gray-900">
            {s.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {s.desc}
          </p>
        </div>

        {/* Controls */}
        <div className="mt-auto flex items-center justify-between">
          <button
            onClick={prev}
            disabled={i===0}
            className={[
              "rounded-full px-4 py-2 text-sm",
              i===0 ? "text-gray-400" : "text-violet-700 hover:bg-violet-50"
            ].join(" ")}
          >
            Back
          </button>

          {/* Your Button component for primary action */}
          <Button onClick={next}>
            {i < slides.length - 1 ? "Next" : "Get started"}
          </Button>
        </div>
      </div>

      {/* Safe-area spacer */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}