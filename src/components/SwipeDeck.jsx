import { useEffect, useState } from "react";
import SwipeCard from "./SwipeCard.jsx";
import { swipesService } from "../services/swipes.service.js";

export default function SwipeDeck({ initialItems = [], mode }) {
  const [people, setPeople] = useState(initialItems);
  useEffect(()=>{ setPeople(initialItems); }, [initialItems]);

  const handleSwipe = async (dir, userId) => {
    setPeople(prev => prev.filter(p => p.id !== userId));
    try { await swipesService.swipe({ targetUserId: userId, dir }); } catch (e) { console.error(e); }
  };

  if (!people.length) {
    return (
      <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card">
        <div>
          <p className="text-gray-700">You're all caught up 🎉</p>
          <p className="text-sm text-gray-500">Try {mode==="nearby" ? "expanding distance" : "a different tab"}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh]">
      {people.map((p) => (
        <div key={p.id} className="absolute inset-0">
          <SwipeCard person={p} onSwipe={(d) => handleSwipe(d, p.id)} />
        </div>
      )).reverse()}
    </div>
  );
}