import SwipeDeck from "../components/SwipeDeck.jsx";
import { Link } from "react-router-dom";

export default function Discover(){
  return (
    <div className="flex min-h-[70vh] flex-col">
      <header className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Discover</h1>
        <Link to="/filters" className="rounded-full p-2 hover:bg-gray-100" aria-label="Filters">
          <i className="lni lni-sliders text-xl" />
        </Link>
      </header>
      <main className="px-4">
        <SwipeDeck />
      </main>
    </div>
  );
}