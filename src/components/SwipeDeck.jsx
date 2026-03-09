// src/components/SwipeDeck.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./SwipeCard.jsx";
import MatchModal from "./MatchModal.jsx";
import { swipesService } from "../services/swipes.service.js";
import { kmBetween } from "../utils/geo.js";

/* ---------------- Helpers ---------------- */
function parseNumber(value) {
  if (value == null) return null;
  const num = Number.isFinite(+value) ? +value : parseFloat(String(value));
  return Number.isNaN(num) ? null : num;
}

function normalizeCoords(profile) {
  return {
    lat: parseNumber(profile.lat ?? profile.latitude),
    lng: parseNumber(profile.lng ?? profile.longitude ?? profile.long),
  };
}

/* ---------------- Main Component ---------------- */
export default function SwipeDeck({ initialItems = [], mode, myLoc }) {
  const navigate = useNavigate();
  const [people, setPeople] = useState(initialItems);
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [lastAction, setLastAction] = useState(null); // For undo feature
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync with initial items
  useEffect(() => {
    setPeople(initialItems);
  }, [initialItems]);

  // Calculate distances
  const displayPeople = useMemo(() => {
    const myLat = parseNumber(myLoc?.lat);
    const myLng = parseNumber(myLoc?.lng);

    return (people || []).map((person) => {
      const { lat, lng } = normalizeCoords(person);
      let distanceKm = person.distance_km;

      if (
        (distanceKm == null || Number.isNaN(Number(distanceKm))) &&
        myLat != null &&
        myLng != null &&
        lat != null &&
        lng != null
      ) {
        const distance = kmBetween(myLat, myLng, lat, lng);
        distanceKm = Math.round(distance * 10) / 10;
      }

      return { ...person, lat, lng, distance_km: distanceKm };
    });
  }, [people, myLoc?.lat, myLoc?.lng]);

  // Open profile detail
  const handleOpenProfile = useCallback(
    (person) => {
      navigate(`/profile/${person.id}`, { state: { person } });
    },
    [navigate]
  );

  // Handle swipe action
  const handleSwipe = useCallback(
    async (direction, person) => {
      if (isProcessing) return;
      setIsProcessing(true);

      // Optimistically remove card
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      setLastAction({ person, direction });

      try {
        const result = await swipesService.swipe({
          targetUserId: person.id,
          dir: direction,
        });

        // Check for match
        if (result?.matched) {
          setMatchedPerson(person);
          setTimeout(() => setShowMatchModal(true), 400);
        }
      } catch (error) {
        console.error("[SwipeDeck] swipe error:", error);

        // Restore card on error
        setPeople((prev) => [person, ...prev]);
        setLastAction(null);

        if (error.status === 402) {
          alert(error.message || "Premium required for this action.");
        } else {
          alert("Action failed. Please try again.");
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing]
  );

  // Undo last action
  const handleUndo = useCallback(async () => {
    if (!lastAction || isProcessing) return;

    setIsProcessing(true);
    try {
      // Add card back
      setPeople((prev) => [lastAction.person, ...prev]);

      // Remove swipe from backend
      await swipesService.undo(lastAction.person.id);
      setLastAction(null);
    } catch (error) {
      console.error("[SwipeDeck] undo error:", error);
      // Remove card again if undo failed
      setPeople((prev) => prev.filter((p) => p.id !== lastAction.person.id));
    } finally {
      setIsProcessing(false);
    }
  }, [lastAction, isProcessing]);

  // Close match modal
  const handleCloseMatch = useCallback(() => {
    setShowMatchModal(false);
    setMatchedPerson(null);
  }, []);

  // Empty state
  if (!displayPeople.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid h-[70vh] place-items-center rounded-3xl bg-gradient-to-br from-violet-50 to-pink-50 text-center shadow-card border border-gray-100"
      >
        <div className="px-6">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse",
            }}
            className="mx-auto mb-4 text-6xl"
          >
            🎉
          </motion.div>
          <p className="text-lg font-semibold text-gray-800">You're all caught up!</p>
          <p className="mt-2 text-sm text-gray-500">
            {mode === "nearby"
              ? "Try expanding the distance or check back later."
              : "Try a different tab or check back later."}
          </p>

          {lastAction && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleUndo}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-200 transition-colors"
            >
              <i className="lni lni-reload" />
              Undo last swipe
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div className="relative h-[70vh]">
        {/* Decorative stacked cards */}
        <div className="pointer-events-none absolute inset-x-3 top-6 -z-10">
          {displayPeople.length > 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto h-[60vh] max-w-md rotate-[8deg] rounded-3xl bg-gradient-to-br from-violet-100 to-violet-50 shadow-sm"
            />
          )}
          {displayPeople.length > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="mx-auto -mt-[58vh] h-[60vh] max-w-md -rotate-[4deg] rounded-3xl bg-gradient-to-br from-pink-100 to-pink-50 shadow-sm"
            />
          )}
        </div>

        {/* Cards stack */}
        <AnimatePresence mode="popLayout">
          {displayPeople
            .slice(0, 3)
            .reverse()
            .map((person, index, arr) => {
              const isTop = index === arr.length - 1;
              const stackIndex = arr.length - 1 - index;

              return (
                <motion.div
                  key={person.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{
                    scale: 1 - stackIndex * 0.03,
                    y: stackIndex * 8,
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.2 },
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                  }}
                  className="absolute inset-0 p-2"
                  style={{ zIndex: 10 - stackIndex }}
                >
                  <SwipeCard
                    person={person}
                    isActive={isTop}
                    onSwipe={(dir) => handleSwipe(dir, person)}
                    onOpen={handleOpenProfile}
                    canUndo={!!lastAction}
                    onUndo={handleUndo}
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* Undo button (floating) */}
        <AnimatePresence>
          {lastAction && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={handleUndo}
              className="absolute -top-2 left-4 z-50 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-lg border border-gray-100 hover:bg-gray-50"
            >
              <i className="lni lni-reload text-violet-600" />
              Undo
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Match Modal */}
      <MatchModal
        isOpen={showMatchModal}
        person={matchedPerson}
        onClose={handleCloseMatch}
        onMessage={() => {
          handleCloseMatch();
          navigate(`/chat/${matchedPerson?.id}`);
        }}
      />
    </>
  );
}