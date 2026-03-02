import { useEffect, useState } from "react";
import SwipeDeck from "../components/SwipeDeck.jsx";
import { discoverService } from "../services/discover.service.js";

const tabs = [
  { key: "matches", label: "Matches" },
  { key: "nearby", label: "Nearby" },
  { key: "for_you", label: "For You" },
];

export default function Discover(){
  const [mode, setMode] = useState("for_you");
  const [items, setItems] = useState([]);

  useEffect(()=>{ discoverService.list(mode, 20).then(setItems).catch(console.error); }, [mode]);

  return (
    <div className="flex min-h-[70vh] flex-col">
      <header className="p-4">
        <h1 className="text-lg font-semibold mb-3">Discover</h1>
        <div className="flex items-center gap-2">
          {tabs.map(t=>(
            <button key={t.key}
              onClick={()=>setMode(t.key)}
              className={`rounded-full px-4 py-2 text-sm ${mode===t.key ? "bg-violet-600 text-white" : "bg-white text-gray-700 border border-gray-200"}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto">
            <a href="/filters" className="rounded-full p-2 hover:bg-gray-100" aria-label="Filters">
              <i className="lni lni-sliders text-xl" />
            </a>
          </div>
        </div>
      </header>
      <main className="px-4">
        <SwipeDeck initialItems={items} mode={mode} />
      </main>
    </div>
  );
}