import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";

const slides = [
  { title:"Meet your match", desc:"Smart discovery that learns your vibe.", img:"https://images.unsplash.com/photo-1516594798947-e65505dbb29d?q=80&w=1200&auto=format&fit=crop" },
  { title:"Curated matches", desc:"People nearby who share your interests.", img:"https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=1200&auto=format&fit=crop" },
  { title:"Boost your journey", desc:"Stand out with boosts and super-likes.", img:"https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=1200&auto=format&fit=crop" },
];

export default function Onboarding(){
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const nav = useNavigate();
  const s = slides[i];

  const next = () => (i < slides.length - 1 ? (setDir(1), setI(i+1)) : nav("/auth"));
  const prev = () => i > 0 && (setDir(-1), setI(i-1));

  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[45vh] w-[45vh] rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-[50vh] w-[50vh] rounded-full bg-violet-600/25 blur-3xl" />
      </div>

      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={s.img}
            custom={dir}
            initial={{ x: dir>0 ? "100%" : "-100%", scale: 1.05, opacity: 0.7 }}
            animate={{ x: 0, scale: 1, opacity: 1 }}
            exit={{ x: dir>0 ? "-30%" : "30%", opacity: 0 }}
            transition={{ type:"spring", stiffness: 260, damping: 30 }}
            drag="x" dragConstraints={{ left:0, right:0 }} dragElastic={0.4}
            onDragEnd={(_, info)=>{ if(info.offset.x < -80) next(); else if(info.offset.x > 80) prev(); }}
            className="absolute inset-0"
            style={{ backgroundImage:`url(${s.img})`, backgroundSize:"cover", backgroundPosition:"center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <button onClick={()=>nav("/auth")} className="rounded-full bg-white/20 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/30">Skip</button>
        <div className="flex gap-1">
          {slides.map((_, idx)=>(
            <div key={idx} className={`h-1 w-8 rounded-full ${idx<=i ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col justify-end px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-5">
          <h1 className="text-3xl font-extrabold leading-tight text-white drop-shadow-sm">{s.title}</h1>
          <p className="mt-2 text-sm text-white/90">{s.desc}</p>
        </div>
        <div className="flex items-center justify-between pb-safe">
          <button onClick={prev} disabled={i===0} className={`rounded-full px-4 py-2 text-white/90 ${i===0 ? "opacity-40" : "hover:bg-white/10"}`}>Back</button>
          <Button onClick={next}>{i < slides.length - 1 ? "Next" : "Get started"}</Button>
        </div>
        <div className="h-3" />
      </div>
    </div>
  );
}