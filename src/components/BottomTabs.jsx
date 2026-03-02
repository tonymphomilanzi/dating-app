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
    <i className={`lni ${icon} text-xl leading-none`} />
    <span className="text-xs">{label}</span>
  </NavLink>
);

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-white/90 px-2 py-2 shadow-card backdrop-blur pb-safe">
      <div className="grid grid-cols-4">
        <Tab to="/discover" icon="lni-home" label="Discover" />
        <Tab to="/matches" icon="lni-heart" label="Matches" />
        <Tab to="/messages" icon="lni-comments" label="Messages" />
        <Tab to="/profile"  icon="lni-user" label="Profile" />
      </div>
    </nav>
  );
}