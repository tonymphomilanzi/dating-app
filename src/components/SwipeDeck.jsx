// src/components/SwipeDeck.jsx
import { useEffect, useState } from "react";
import SwipeCard from "./SwipeCard.jsx";
import { swipesService } from "../services/swipes.service.js";

export default function SwipeDeck({ initialItems = [], mode }) {
  const [people, setPeople] = useState(initialItems);
  useEffect(()=>{ setPeople(initialItems); }, [initialItems]);

  const handleSwipe = async (dir, person) => {
    // Optimistic remove
    setPeople(prev => prev.filter(p => p.id !== person.id));
    try {
      await swipesService.swipe({ targetUserId: person.id, dir });
    } catch (e) {
      console.error("[SwipeDeck] swipe error:", e);
      // restore on error
      setPeople(prev => [person, ...prev]);
      if (e.status === 402) {
        alert(e.message || "Premium required for this action.");
      } else {
        alert("Action failed. Please try again.");
      }
    }
  };

  if (!people.length) {
    return (
      <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
        <div>
          <p className="text-gray-700">You're all caught up 🎉</p>
          <p className="text-sm text-gray-500">
            Try {mode==="nearby" ? "expanding distance" : "a different tab"}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh]">
      {/* decorative stacked cards */}
      <div className="pointer-events-none absolute inset-x-3 top-6 -z-10">
        <div className="mx-auto h-[60vh] max-w-md rotate-[6deg] rounded-3xl bg-violet-50 shadow-card" />
        <div className="mx-auto -mt-10 h-[60vh] max-w-md -rotate-[4deg] rounded-3xl bg-amber-50 shadow-card" />
      </div>

      {people.map((p) => (
        <div key={p.id} className="absolute inset-0 p-2">
          <SwipeCard person={p} onSwipe={(d) => handleSwipe(d, p)} />
        </div>
      )).reverse()}
    </div>
  );
}