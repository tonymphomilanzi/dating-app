// src/components/Confetti.jsx
import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = [
  "#f43f5e", // rose
  "#ec4899", // pink
  "#a855f7", // purple
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
];

const SHAPES = ["circle", "square", "triangle"];

export default function Confetti({ count = 50 }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: `${piece.x}vw`,
            y: -20,
            rotate: piece.rotation,
            opacity: 1,
          }}
          animate={{
            y: "110vh",
            rotate: piece.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: "linear",
          }}
          className="absolute"
          style={{
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius:
              piece.shape === "circle"
                ? "50%"
                : piece.shape === "triangle"
                ? "0"
                : "2px",
            clipPath:
              piece.shape === "triangle"
                ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                : "none",
          }}
        />
      ))}
    </div>
  );
}