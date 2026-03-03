import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SwipeCard from "./SwipeCard.jsx";
import { swipesService } from "../services/swipes.service.js";
import { kmBetween } from "../utils/geo.js";

const numOrNull = (v) => (v == null ? null : (Number.isFinite(+v) ? +v : parseFloat(String(v)) || null));
const normalizeCoords = (p) => ({ lat: numOrNull(p.lat ?? p.latitude), lng: numOrNull(p.lng ?? p.longitude ?? p.long) });

export default function SwipeDeck({ initialItems = [], mode, myLoc }) {
  const nav = useNavigate();
  const [people, setPeople] = useState(initialItems);
  useEffect(()=>{ setPeople(initialItems); }, [initialItems]);

  const displayPeople = useMemo(() => {
    const myLat = numOrNull(myLoc?.lat), myLng = numOrNull(myLoc?.lng);
    return (people || []).map((p) => {
      const { lat, lng } = normalizeCoords(p);
      let distance_km = p.distance_km;
      if ((distance_km == null || Number.isNaN(Number(distance_km))) && myLat != null && myLng != null && lat != null && lng != null) {
        const d = kmBetween(myLat, myLng, lat, lng);
        distance_km = Math.round(d * 10) / 10;
      }
      return { ...p, lat, lng, distance_km };
    });
  }, [people, myLoc?.lat, myLoc?.lng]);

  const openProfile = (person) => {
    nav(`/profile/${person.id}`, { state: { person } });
  };

  const handleSwipe = async (dir, person) => {
    setPeople(prev => prev.filter(p => p.id !== person.id));
    try {
      await swipesService.swipe({ targetUserId: person.id, dir });
    } catch (e) {
      console.error("[SwipeDeck] swipe error:", e);
      setPeople(prev => [person, ...prev]);
      if (e.status === 402) alert(e.message || "Premium required for this action.");
      else alert("Action failed. Please try again.");
    }
  };

  if (!displayPeople.length) {
    return (
      <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card border border-gray-100">
        <div>
          <p className="text-gray-700">You're all caught up!</p>
          <p className="text-sm text-gray-500">Try {mode==="nearby" ? "expanding distance" : "a different tab"}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh]">
      <div className="pointer-events-none absolute inset-x-3 top-6 -z-10">
        <div className="mx-auto h-[60vh] max-w-md rotate-[6deg] rounded-3xl bg-violet-50 shadow-card" />
        <div className="mx-auto -mt-10 h-[60vh] max-w-md -rotate-[4deg] rounded-3xl bg-amber-50 shadow-card" />
      </div>

      {displayPeople.map((p) => (
        <div key={p.id} className="absolute inset-0 p-2">
          <SwipeCard person={p} onSwipe={(d) => handleSwipe(d, p)} onOpen={openProfile} />
        </div>
      )).reverse()}
    </div>
  );
}