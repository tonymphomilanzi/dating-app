// src/components/SwipeCard.jsx
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useState, useCallback } from "react";

/* ---------------- Constants ---------------- */
const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 400;

/* ---------------- Helper Functions ---------------- */
function formatDistance(distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return null;
  }
  
  // Handle absolute value (distance should never be negative)
  const distance = Math.abs(distanceKm);
  
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  }
  return `${Math.round(distance)}km`;
}

export default function SwipeCard({ person, isActive = true, onSwipe, onOpen }) {
  // Motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Card transforms
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const cardScale = useTransform(
    x,
    [-300, -100, 0, 100, 300],
    [0.95, 0.98, 1, 0.98, 0.95]
  );

  // LIKE stamp - appears immediately when dragging right
  const likeOpacity = useTransform(x, [0, 30, 100], [0, 0.5, 1]);
  const likeScale = useTransform(x, [0, 30, 100], [0.6, 0.8, 1]);
  const likeRotate = useTransform(x, [0, 150], [-25, -12]);
  const likeBorderWidth = useTransform(x, [0, 100], [3, 5]);

  // NOPE stamp - appears immediately when dragging left
  const nopeOpacity = useTransform(x, [-100, -30, 0], [1, 0.5, 0]);
  const nopeScale = useTransform(x, [-100, -30, 0], [1, 0.8, 0.6]);
  const nopeRotate = useTransform(x, [-150, 0], [12, 25]);
  const nopeBorderWidth = useTransform(x, [-100, 0], [5, 3]);

  // Background color overlay - immediate feedback
  const bgGreen = useTransform(
    x,
    [0, 50, 150],
    ["rgba(34,197,94,0)", "rgba(34,197,94,0.1)", "rgba(34,197,94,0.25)"]
  );
  const bgRed = useTransform(
    x,
    [-150, -50, 0],
    ["rgba(239,68,68,0.25)", "rgba(239,68,68,0.1)", "rgba(239,68,68,0)"]
  );

  // State
  const isDraggingRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSuperLike, setShowSuperLike] = useState(false);
  const [ripple, setRipple] = useState(null);

  // Image source
  const imgSrc =
    person.avatar_url ||
    person.photo ||
    person.photo_url ||
    person.photos?.[0] ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`;

  const name = person.display_name || person.name || "Member";
  const distanceText = formatDistance(person.distance_km);

  // Throw card animation
  const throwOut = useCallback(
    async (direction) => {
      if (isAnimating) return;
      setIsAnimating(true);

      if (direction === "super") {
        setShowSuperLike(true);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      const targetX =
        direction === "right"
          ? window.innerWidth * 1.5
          : direction === "left"
          ? -window.innerWidth * 1.5
          : 0;

      const targetY = direction === "super" ? -window.innerHeight * 0.5 : 0;

      await Promise.all([
        animate(x, targetX, {
          type: "spring",
          stiffness: 500,
          damping: 40,
          velocity: direction === "right" ? 800 : direction === "left" ? -800 : 0,
        }),
        direction === "super" &&
          animate(y, targetY, {
            type: "spring",
            stiffness: 500,
            damping: 40,
          }),
      ]);

      onSwipe?.(direction);
    },
    [isAnimating, x, y, onSwipe]
  );

  // Snap back animation
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

      // Swipe right
      if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
        return throwOut("right");
      }
      // Swipe left
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
        return throwOut("left");
      }

      await snapBack();
    },
    [isAnimating, throwOut, snapBack]
  );

  // Event handlers
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  const handleCardClick = () => {
    if (!isDraggingRef.current && !isAnimating && isActive) {
      onOpen?.(person);
    }
  };

  const createRipple = (e, color) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      color,
    });
    setTimeout(() => setRipple(null), 600);
  };

  const handleNope = (e) => {
    stopPropagation(e);
    createRipple(e, "red");
    throwOut("left");
  };

  const handleLike = (e) => {
    stopPropagation(e);
    createRipple(e, "green");
    throwOut("right");
  };

  const handleSuperLike = (e) => {
    stopPropagation(e);
    throwOut("super");
  };

  // Non-active card (in stack)
  if (!isActive) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-lg">
        <img
          src={imgSrc}
          alt={name}
          className="h-full w-full object-cover"
          draggable={false}
        />
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
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragStart={() => (isDraggingRef.current = true)}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      style={{ x, y, rotate, scale: cardScale }}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gray-200 shadow-xl cursor-grab active:cursor-grabbing touch-none"
    >
      {/* Photo */}
      <img
        src={imgSrc}
        alt={name}
        className="h-full w-full object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* Color overlays - immediate feedback */}
      <motion.div
        style={{ backgroundColor: bgGreen }}
        className="pointer-events-none absolute inset-0 transition-colors"
      />
      <motion.div
        style={{ backgroundColor: bgRed }}
        className="pointer-events-none absolute inset-0 transition-colors"
      />

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2 pointer-events-none">
        {/* Distance badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>{distanceText || "Nearby"}</span>
        </motion.div>

        {/* Match score badge */}
        {person.match_score != null && person.match_score > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{person.match_score}%</span>
          </motion.div>
        )}
      </div>

      {/* LIKE Stamp - appears immediately on drag right */}
      <motion.div
        style={{
          opacity: likeOpacity,
          scale: likeScale,
          rotate: likeRotate,
        }}
        className="pointer-events-none absolute right-4 top-16 origin-center"
      >
        <div className="relative">
          {/* Glow */}
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute -inset-3 rounded-xl bg-green-400/40 blur-xl"
          />
          {/* Stamp */}
          <motion.div
            style={{ borderWidth: likeBorderWidth }}
            className="relative rounded-lg border-green-500 bg-green-500/20 px-5 py-1.5 backdrop-blur-sm"
          >
            <span className="text-2xl font-black tracking-widest text-green-500 drop-shadow-lg">
              LIKE
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* NOPE Stamp - appears immediately on drag left */}
      <motion.div
        style={{
          opacity: nopeOpacity,
          scale: nopeScale,
          rotate: nopeRotate,
        }}
        className="pointer-events-none absolute left-4 top-16 origin-center"
      >
        <div className="relative">
          {/* Glow */}
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute -inset-3 rounded-xl bg-red-400/40 blur-xl"
          />
          {/* Stamp */}
          <motion.div
            style={{ borderWidth: nopeBorderWidth }}
            className="relative rounded-lg border-red-500 bg-red-500/20 px-5 py-1.5 backdrop-blur-sm"
          >
            <span className="text-2xl font-black tracking-widest text-red-500 drop-shadow-lg">
              NOPE
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* SUPER LIKE Effect */}
      {showSuperLike && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 z-20"
        >
          {/* Radial burst */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.8, delay: i * 0.015 }}
                className="absolute h-3 w-1 rounded-full bg-gradient-to-t from-cyan-400 to-blue-500"
                style={{
                  rotate: `${i * 22.5}deg`,
                  transformOrigin: "center 80px",
                }}
              />
            ))}
          </div>

          {/* Center glow */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 2, 1.5] }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-cyan-400/40 blur-2xl"
          />

          {/* Star */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: [0, 1.4, 1], rotate: 0 }}
            transition={{ type: "spring", damping: 12 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl shadow-cyan-400/50">
              <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="absolute left-1/2 top-1/2 mt-16 -translate-x-1/2"
          >
            <div className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 shadow-xl">
              <span className="text-xl font-black tracking-wider text-white">
                SUPER LIKE
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Person info */}
      <div className="absolute bottom-24 left-4 right-4 text-white pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-baseline gap-2"
        >
          <span className="text-2xl font-bold drop-shadow-lg">{name}</span>
          {person.age && (
            <span className="text-xl font-light text-white/90">{person.age}</span>
          )}
        </motion.div>

        {person.city && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-1 flex items-center gap-1.5 text-sm text-white/80"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{person.city}</span>
          </motion.div>
        )}

        {person.bio && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
            className="relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-xl overflow-hidden"
            aria-label="Pass"
          >
            {ripple?.color === "red" && (
              <motion.span
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 3, opacity: 0 }}
                className="absolute inset-0 bg-red-400"
                style={{
                  borderRadius: "50%",
                  transformOrigin: `${ripple.x}px ${ripple.y}px`,
                }}
              />
            )}
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>

          {/* Super Like button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onPointerDown={stopPropagation}
            onClick={handleSuperLike}
            className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-xl shadow-blue-300/50"
            aria-label="Super Like"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-20" />
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </motion.button>

          {/* Like button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onPointerDown={stopPropagation}
            onClick={handleLike}
            className="relative grid h-14 w-14 place-items-center rounded-full bg-white shadow-xl overflow-hidden"
            aria-label="Like"
          >
            {ripple?.color === "green" && (
              <motion.span
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 3, opacity: 0 }}
                className="absolute inset-0 bg-green-400"
                style={{
                  borderRadius: "50%",
                  transformOrigin: `${ripple.x}px ${ripple.y}px`,
                }}
              />
            )}
            <svg className="h-7 w-7 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Tap hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-[92px] left-1/2 -translate-x-1/2 pointer-events-none"
      >
        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/50 backdrop-blur-sm">
          Tap to view profile
        </span>
      </motion.div>
    </motion.div>
  );
}