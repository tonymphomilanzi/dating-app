// src/components/SwipeDeck.jsx
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./SwipeCard.jsx";
import MatchModal from "./MatchModal.jsx";
import { swipesService } from "../services/swipes.service.js";
import { chatService } from "../services/chat.service.js";

/* ---------------- Helpers ---------------- */
function parseNumber(value) {
  if (value == null) return null;
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
}

function kmBetween(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.abs(Math.round(distance * 10) / 10);
}

/* ---------------- Main Component ---------------- */
export default function SwipeDeck({ initialItems = [], mode, myLoc }) {
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync with initial items
  useEffect(() => {
    setPeople(initialItems);
  }, [initialItems]);

  // Prevent body scroll when dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isDragging]);

  // Calculate distances with current location
  const displayPeople = useMemo(() => {
    const myLat = parseNumber(myLoc?.lat);
    const myLng = parseNumber(myLoc?.lng);

    console.log("📍 Calculating distances with location:", { myLat, myLng });

    return people.map((person) => {
      const personLat = parseNumber(person.lat);
      const personLng = parseNumber(person.lng);

      let distanceKm = parseNumber(person.distance_km);

      // Recalculate distance if we have both locations
      if (myLat != null && myLng != null && personLat != null && personLng != null) {
        distanceKm = kmBetween(myLat, myLng, personLat, personLng);
      }

      return {
        ...person,
        lat: personLat,
        lng: personLng,
        distance_km: distanceKm,
      };
    });
  }, [people, myLoc?.lat, myLoc?.lng]);

  const handleOpenProfile = useCallback(
    (person) => {
      navigate(`/profile/${person.id}`, { state: { person } });
    },
    [navigate]
  );

  const handleDragStateChange = useCallback((dragging) => {
    setIsDragging(dragging);
  }, []);

  const handleSwipe = useCallback(
    async (direction, person) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setIsDragging(false);

      // Optimistically remove card
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      setLastAction({ person, direction });

      console.log("💫 Swiping:", { direction, personId: person.id, personName: person.display_name });

      try {
        const result = await swipesService.swipe({
          targetUserId: person.id,
          dir: direction,
        });

        console.log("✅ Swipe result:", result);

        if (!isMountedRef.current) return;

        // Check for match
        if (result?.matched && result?.isNew) {
          setMatchedPerson({
            ...person,
            matchId: result.match?.id,
          });
          setTimeout(() => {
            if (isMountedRef.current) {
              setShowMatchModal(true);
            }
          }, 400);
        }
      } catch (error) {
        console.error("❌ Swipe error:", error);

        if (!isMountedRef.current) return;

        // Restore card
        setPeople((prev) => [person, ...prev]);
        setLastAction(null);

        if (error.status === 402) {
          alert(error.message || "Premium required for this action.");
        } else {
          alert(error.message || "Action failed. Please try again.");
        }
      } finally {
        if (isMountedRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [isProcessing]
  );

  const handleUndo = useCallback(async () => {
    if (!lastAction || isProcessing) return;

    setIsProcessing(true);
    try {
      setPeople((prev) => [lastAction.person, ...prev]);
      await swipesService.undo(lastAction.person.id);
      setLastAction(null);
    } catch (error) {
      console.error("Undo error:", error);
      setPeople((prev) => prev.filter((p) => p.id !== lastAction.person.id));
    } finally {
      setIsProcessing(false);
    }
  }, [lastAction, isProcessing]);

  const handleCloseMatch = useCallback(() => {
    setShowMatchModal(false);
    setMatchedPerson(null);
  }, []);

  // Empty state
  if (!displayPeople.length) {
    return (

      <motion.div
        className="grid h-[70vh] place-items-center rounded-3xl bg-gradient-to-br from-violet-50 to-pink-50 text-center shadow-lg border border-gray-100"
      >


        
        <div className="px-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
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
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo last swipe
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div
        className="relative h-[70vh] select-none"
        style={{ touchAction: isDragging ? "none" : "pan-y" }}
      >
        {/* Background cards */}
        <div className="pointer-events-none absolute inset-x-3 top-6 -z-10">
          {displayPeople.length > 2 && (
            <div className="mx-auto h-[60vh] max-w-md rotate-[6deg] rounded-3xl bg-gradient-to-br from-violet-100 to-violet-50 shadow-sm" />
          )}
          {displayPeople.length > 1 && (
            <div className="mx-auto -mt-[58vh] h-[60vh] max-w-md -rotate-[3deg] rounded-3xl bg-gradient-to-br from-pink-100 to-pink-50 shadow-sm" />
          )}
        </div>

        {/* Cards */}
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
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute inset-0 p-2"
                  style={{ zIndex: 10 - stackIndex }}
                >
                  <SwipeCard
                    person={person}
                    isActive={isTop}
                    onSwipe={(dir) => handleSwipe(dir, person)}
                    onOpen={handleOpenProfile}
                    onDragStateChange={handleDragStateChange}
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* Undo button */}
        <AnimatePresence>
          {lastAction && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleUndo}
              className="absolute -top-2 left-4 z-50 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-lg border border-gray-100"
            >
              <svg className="h-3.5 w-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </motion.button>
          )}
        </AnimatePresence>
      </div>

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