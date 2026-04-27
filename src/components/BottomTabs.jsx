// src/components/BottomTabs.jsx  (or wherever your BottomTabs lives)
import { NavLink } from "react-router-dom";

const Tab = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center gap-1 rounded-2xl px-3 py-2 ${
        isActive ? "text-violet-600" : "text-gray-500"
      }`
    }
  >
    <i className={`lni ${icon} text-xl`} />
    <span className="text-xs">{label}</span>
  </NavLink>
);

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-white/90 px-2 py-2 shadow-card backdrop-blur pb-safe">
      <div className="grid grid-cols-5">
        <Tab to="/discover" icon="lni-home" label="Discover" />
        <Tab to="/matches" icon="lni-heart" label="Matches" />
        <Tab to="/messages" icon="lni-comments" label="Messages" />
        <Tab to= "/massage-clinics" icon="lni-hand"  label="Massage" />
        <Tab to="/events" icon="lni-calendar" label="Events" />
        {/* Replaces Profile tab */}
        <Tab to="/streams" icon="lni-video" label="Streams" />
      </div>
    </nav>
  );
}