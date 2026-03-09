// src/components/SwipeCard.jsx
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useState, useCallback } from "react";

/* ---------------- Constants ---------------- */
const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;

export default function SwipeCard({ person, isActive = true, onSwipe, onOpen }) {
  // Motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transforms
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const cardScale = useTransform(
    x,
    [-300, -100, 0, 100, 300],
    [0.95, 0.98, 1, 0.98, 0.95]
  );

  // Like stamp transforms
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const likeScale = useTransform(x, [40, 120], [0.5, 1]);
  const likeRotate = useTransform(x, [40, 200], [-25, -15]);

  // Nope stamp transforms
  const nopeOpacity = useTransform(x, [-120, -40], [1, 0]);
  const nopeScale = useTransform(x, [-120, -40], [1, 0.5]);
  const nopeRotate = useTransform(x, [-200, -40], [15, 25]);

  // Background color overlay
  const bgGreen = useTransform(x, [0, 150], ["rgba(34,197,94,0)", "rgba(34,197,94,0.15)"]);
  const bgRed = useTransform(x, [-150, 0], ["rgba(239,68,68,0.15)", "rgba(239,68,68,0)"]);

  // State
  const isDraggingRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSuperLike, setShowSuperLike] = useState(false);
  const [ripplePos, setRipplePos] = useState(null);

  // Image source with fallback
  const imgSrc =
    person.avatar_url ||
    person.photo ||
    person.photo_url ||
    person.photos?.[0] ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`;

  const name = person.display_name || person.name || "Member";

  // Throw card out
  const throwOut = useCallback(
    async (direction) => {
      if (isAnimating) return;
      setIsAnimating(true);

      const targetX = direction === "right" ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
      const targetY = direction === "super" ? -window.innerHeight : 0;

      if (direction === "super") {
        setShowSuperLike(true);
        await new Promise((r) => setTimeout(r, 300));
      }

      const controls = animate(x, targetX, {
        type: "spring",
        stiffness: 600,
        damping: 50,
        velocity: direction === "right" ? 800 : -800,
      });

      if (direction === "super") {
        animate(y, targetY, {
          type: "spring",
          stiffness: 600,
          damping: 50,
        });
      }

      await controls;
      onSwipe?.(direction);
    },
    [isAnimating, x, y, onSwipe]
  );

  // Snap back to center
  const snapBack = useCallback(async () => {
    await Promise.all([
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 }),
      animate(y, 0, { type: "spring", stiffness: 500, damping: 30 }),
    ]);
  }, [x, y]);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (_, info) => {
      isDraggingRef.current = false;
      if (isAnimating) return;

      const { offset, velocity } = info;

      // Check for swipe
      if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
        return throwOut("right");
      }
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
        return throwOut("left");
      }

      // Snap back
      await snapBack();
    },
    [isAnimating, throwOut, snapBack]
  );

  // Stop event propagation
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  // Handle card click (open profile)
  const handleCardClick = () => {
    if (!isDraggingRef.current && !isAnimating && isActive) {
      onOpen?.(person);
    }
  };

  // Action button handlers
  const handleNope = (e) => {
    stopPropagation(e);
    setRipplePos({ x: e.clientX, y: e.clientY, color: "red" });
    setTimeout(() => setRipplePos(null), 600);
    throwOut("left");
  };

  const handleLike = (e) => {
    stopPropagation(e);
    setRipplePos({ x: e.clientX, y: e.clientY, color: "green" });
    setTimeout(() => setRipplePos(null), 600);
    throwOut("right");
  };

  const handleSuperLike = (e) => {
    stopPropagation(e);
    throwOut("super");
  };

  if (!isActive) {
    // Render non-interactive card for stack
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-card border border-gray-100">
        <img src={imgSrc} alt={name} className="h-full w-full object-cover" draggable={false} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-20 left-4 right-4 text-white">
          <div className="text-xl font-bold drop-shadow-lg">
            {name}
            {person.age ? `, ${person.age}` : ""}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global ripple effect */}
      {ripplePos && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: ripplePos.x - 50, top: ripplePos.y - 50 }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`h-24 w-24 rounded-full ${
              ripplePos.color === "green" ? "bg-green-400" : "bg-red-400"
            }`}
          />
        </div>
      )}

      <motion.div
        drag={isActive ? "x" : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.9}
        onDragStart={() => (isDraggingRef.current = true)}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        style={{ x, y, rotate, scale: cardScale }}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-xl border border-gray-100 cursor-grab active:cursor-grabbing"
      >
        {/* Photo */}
        <img
          src={imgSrc}
          alt={name}
          className="h-full w-full object-cover select-none"
          draggable={false}
        />

        {/* Color overlay based on swipe direction */}
        <motion.div
          style={{ backgroundColor: bgGreen }}
          className="pointer-events-none absolute inset-0"
        />
        <motion.div
          style={{ backgroundColor: bgRed }}
          className="pointer-events-none absolute inset-0"
        />

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
          {/* Distance badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
          >
            <i className="lni lni-map-marker text-[10px]" />
            {person.distance_km != null ? `${person.distance_km} km` : "—"}
          </motion.div>

          {/* Match score badge */}
          {person.match_score != null && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
            >
              <i className="lni lni-heart-fill text-[10px]" />
              {person.match_score}%
            </motion.div>
          )}
        </div>

        {/* LIKE Stamp */}
        <motion.div
          style={{
            opacity: likeOpacity,
            scale: likeScale,
            rotate: likeRotate,
          }}
          className="pointer-events-none absolute right-6 top-20 origin-center"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 rounded-xl bg-green-400/30 blur-xl" />
            <div className="relative rounded-lg border-[5px] border-green-500 bg-green-500/20 px-6 py-2 backdrop-blur-sm">
              <span className="text-3xl font-black tracking-wider text-green-500 drop-shadow-lg">
                LIKE
              </span>
            </div>
          </div>
        </motion.div>

        {/* NOPE Stamp */}
        <motion.div
          style={{
            opacity: nopeOpacity,
            scale: nopeScale,
            rotate: nopeRotate,
          }}
          className="pointer-events-none absolute left-6 top-20 origin-center"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 rounded-xl bg-red-400/30 blur-xl" />
            <div className="relative rounded-lg border-[5px] border-red-500 bg-red-500/20 px-6 py-2 backdrop-blur-sm">
              <span className="text-3xl font-black tracking-wider text-red-500 drop-shadow-lg">
                NOPE
              </span>
            </div>
          </div>
        </motion.div>

        {/* SUPER LIKE Effect */}
        {showSuperLike && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            {/* Radial burst */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.02 }}
                  className="absolute h-4 w-1 rounded-full bg-cyan-400"
                  style={{ rotate: `${i * 30}deg`, transformOrigin: "center 100px" }}
                />
              ))}
            </div>

            {/* Center glow */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.5, 1] }}
              transition={{ duration: 0.4 }}
              className="absolute h-40 w-40 rounded-full bg-cyan-400/30 blur-2xl"
            />

            {/* Star icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: [0, 1.3, 1], rotate: 0 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="relative"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-2xl">
                <i className="lni lni-star-fill text-4xl text-white" />
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-1/3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 shadow-xl"
            >
              <span className="text-2xl font-black tracking-wider text-white">
                SUPER LIKE
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* Person info */}
        <div className="absolute bottom-24 left-4 right-4 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-baseline gap-2"
          >
            <span className="text-2xl font-bold drop-shadow-lg">{name}</span>
            {person.age && (
              <span className="text-xl font-light text-white/90">{person.age}</span>
            )}
            {person.verified && (
              <span className="ml-1 text-blue-400">
                <i className="lni lni-checkmark-circle" />
              </span>
            )}
          </motion.div>

          {person.city && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-1 flex items-center gap-1 text-sm text-white/80"
            >
              <i className="lni lni-map-marker text-xs" />
              {person.city}
            </motion.div>
          )}

          {person.bio && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-2 line-clamp-2 text-sm text-white/70"
            >
              {person.bio}
            </motion.p>
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="flex w-full max-w-xs items-center justify-center gap-4">
            {/* Nope button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onPointerDown={stopPropagation}
              onClick={handleNope}
              className="group relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-xl transition-shadow hover:shadow-red-200"
              aria-label="Nope"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-red-500 opacity-0 group-hover:opacity-10"
                layoutId="nope-bg"
              />
              <i className="lni lni-close text-2xl text-red-500" />
            </motion.button>

            {/* Super Like button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onPointerDown={stopPropagation}
              onClick={handleSuperLike}
              className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-xl shadow-blue-200/50"
              aria-label="Super Like"
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-20" />
              <i className="lni lni-star-fill text-2xl text-white" />
            </motion.button>

            {/* Like button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onPointerDown={stopPropagation}
              onClick={handleLike}
              className="group relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-xl transition-shadow hover:shadow-green-200"
              aria-label="Like"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-green-500 opacity-0 group-hover:opacity-10"
                layoutId="like-bg"
              />
              <i className="lni lni-heart-fill text-2xl text-green-500" />
            </motion.button>
          </div>
        </div>

        {/* Tap to view profile hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-[100px] left-1/2 -translate-x-1/2"
        >
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/60 backdrop-blur-sm">
            Tap to view profile
          </span>
        </motion.div>
      </motion.div>
    </>
  );
}