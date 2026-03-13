import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";

import slide1 from "../assets/onboarding/1.png";
import slide2 from "../assets/onboarding/2.png";
import slide3 from "../assets/onboarding/3.png";

const slides = [
  { title:"Meet your match", desc:"Smart discovery that learns your vibe.", img: slide1 },
  { title:"Curated matches", desc:"People nearby who share your interests.", img: slide2 },
  { title:"Boost your journey", desc:"Stand out with boosts and super-likes.", img: slide3 },
];

export default function Onboarding(){

  const [i,setI] = useState(0);
  const [dir,setDir] = useState(1);
  const nav = useNavigate();
  const s = slides[i];

  const next = () => (i < slides.length - 1 ? (setDir(1), setI(i+1)) : nav("/auth"));
  const prev = () => i > 0 && (setDir(-1), setI(i-1));

  return (
    <div className="relative flex min-h-dvh flex-col items-center bg-white px-6 py-8 text-gray-900">

      
      {/* top controls */}
      <div className="relative z-10 flex w-full max-w-sm items-center justify-between">

        <button
          onClick={()=>nav("/auth")}
          className="rounded-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Skip
        </button>

        <div className="flex gap-1.5">
          {slides.map((_,idx)=>(
            <div
              key={idx}
              className={[
                "h-1.5 w-7 rounded-full transition-all",
                idx <= i ? "bg-violet-600" : "bg-gray-200"
              ].join(" ")}
            />
          ))}
        </div>

      </div>

      {/* image */}
      <div className="relative z-10 mt-10 w-full max-w-sm">

        <div className="relative aspect-[4/5] overflow-hidden">

          <AnimatePresence initial={false} custom={dir}>

            <motion.img
              key={s.img}
              src={s.img}
              alt={s.title}
              custom={dir}
              initial={{ x: dir > 0 ? "100%" : "-100%", opacity:0.7 }}
              animate={{ x:0, opacity:1 }}
              exit={{ x: dir > 0 ? "-20%" : "20%", opacity:0 }}
              transition={{ type:"spring", stiffness:260, damping:30 }}
              drag="x"
              dragConstraints={{ left:0,right:0 }}
              dragElastic={0.4}
              onDragEnd={(_,info)=>{
                if(info.offset.x < -80) next()
                else if(info.offset.x > 80) prev()
              }}
              className="absolute inset-0 h-full w-full object-contain select-none"
            />

          </AnimatePresence>

        </div>

      </div>

      {/* text */}
      <div className="relative z-10 mt-10 w-full max-w-sm text-center">

        <h1 className="text-3xl font-bold tracking-tight">
          {s.title}
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          {s.desc}
        </p>

      </div>

      {/* bottom actions */}
      <div className="relative z-10 mt-auto flex w-full max-w-sm items-center justify-between pt-10">

        <button
          onClick={prev}
          disabled={i===0}
          className={[
            "text-sm",
            i===0 ? "text-gray-400" : "text-violet-700"
          ].join(" ")}
        >
          Back
        </button>

        <Button onClick={next}>
          {i < slides.length - 1 ? "Next" : "Get started"}
        </Button>

      </div>

      <div className="h-[env(safe-area-inset-bottom)]"/>

    </div>
  );
}