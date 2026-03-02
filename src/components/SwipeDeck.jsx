import { useState } from "react";
import SwipeCard from "./SwipeCard.jsx";

const sample = [
  { id:"1", name:"Jess", age:23, photo:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop" },
  { id:"2", name:"Camila", age:25, photo:"https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop" },
  { id:"3", name:"Brad", age:28, photo:"https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?q=80&w=800&auto=format&fit=crop" },
];

export default function SwipeDeck() {
  const [people, setPeople] = useState(sample);
  const handle = () => setPeople(([ , ...rest]) => rest);

  if (people.length === 0) {
    return (
      <div className="grid h-[70vh] place-items-center rounded-3xl bg-white text-center shadow-card">
        <div>
          <p className="text-gray-700">You're all caught up 🎉</p>
          <p className="text-sm text-gray-500">Adjust your filters to see more people.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh]">
      {people.map((p) => (
        <div key={p.id} className="absolute inset-0">
          <SwipeCard person={p} onSwipe={handle} />
        </div>
      )).reverse()}
    </div>
  );
}