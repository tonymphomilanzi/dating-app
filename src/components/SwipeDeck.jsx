// src/components/SwipeDeck.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./SwipeCard.jsx";
import MatchModal from "./MatchModal.jsx";
import { swipesService } from "../services/swipes.service.js";
import { kmBetween } from "../utils/geo.js";

/* ---------------- Helpers ---------------- */
 // Add alongside helpers
const toNum = (v) => (v == null ? null : Number(v));
const isValidLatLng = (lat, lng) => {
  const la = toNum(lat), ln = toNum(lng);
  return Number.isFinite(la) && Number.isFinite(ln) &&
         la >= -90 && la <= 90 && ln >= -180 && ln <= 180 &&
         !(la === 0 && ln === 0);
};


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
  const [lastAction, setLastAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Sync with initial items
  useEffect(() => {
    setPeople(initialItems);
  }, [initialItems]);

  // Prevent body scroll when dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    };
  }, [isDragging]);

  // Calculate distances

// Update displayPeople
const displayPeople = useMemo(() => {
  const myLat = toNum(myLoc?.lat);
  const myLng = toNum(myLoc?.lng);
  const hasMyLoc = isValidLatLng(myLat, myLng);

  console.log("📍 Calculating distances with location:", {
    myLat, myLng, valid: hasMyLoc
  });

  return people.map((person) => {
    const personLat = toNum(person.lat);
    const personLng = toNum(person.lng);
    const hasPersonLoc = isValidLatLng(personLat, personLng);

    let distanceKm = toNum(person.distance_km);

    if (hasMyLoc && hasPersonLoc) {
      distanceKm = kmBetween(myLat, myLng, personLat, personLng);
    }

    return {
      ...person,
      lat: hasPersonLoc ? personLat : null,
      lng: hasPersonLoc ? personLng : null,
      distance_km: distanceKm ?? null,
    };
  });
}, [people, myLoc?.lat, myLoc?.lng]);

  // Open profile
  const handleOpenProfile = useCallback(
    (person) => {
      navigate(`/profile/${person.id}`, { state: { person } });
    },
    [navigate]
  );

  // Handle drag state from child
  const handleDragStateChange = useCallback((dragging) => {
    setIsDragging(dragging);
  }, []);

  // Handle swipe
  const handleSwipe = useCallback(
    async (direction, person) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setIsDragging(false);

      // Optimistically remove card
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      setLastAction({ person, direction });

      try {
        const result = await swipesService.swipe({
          targetUserId: person.id,
          dir: direction,
        });

        // Check for match (only show modal for new matches)
        if (result?.matched && result?.isNew) {
          setMatchedPerson({
            ...person,
            matchId: result.match?.id,
            conversationId: result.match?.conversationId,
          });
          setTimeout(() => setShowMatchModal(true), 400);
        }
      } catch (error) {
        console.error("[SwipeDeck] swipe error:", error);

        // Restore card
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

  // Undo
  const handleUndo = useCallback(async () => {
    if (!lastAction || isProcessing) return;

    setIsProcessing(true);
    try {
      setPeople((prev) => [lastAction.person, ...prev]);
      await swipesService.undo(lastAction.person.id);
      setLastAction(null);
    } catch (error) {
      console.error("[SwipeDeck] undo error:", error);
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
        className="relative h-[70vh] select-none overscroll-none"
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
 // Cards
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
          style={{
            zIndex: 10 - stackIndex,
            pointerEvents: isTop ? "auto" : "none", // only top card is interactive
          }}
        >
          <SwipeCard
            person={person}
            isActive={isTop}
            canSwipe={!isProcessing}          // NEW
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