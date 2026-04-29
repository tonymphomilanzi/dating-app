// src/components/BottomTabs.jsx
import { NavLink } from "react-router-dom";

const Tab = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-all duration-200 ${
        isActive
          ? "text-violet-600"
          : "text-gray-400 hover:text-gray-600"
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span className="relative flex items-center justify-center">
          {/* Active pill background */}
          {isActive && (
            <span className="absolute -inset-2 rounded-xl bg-violet-50" />
          )}
          <i className={`lni ${icon} text-xl relative z-10`} />
        </span>
        <span
          className={`text-[11px] font-semibold leading-none ${
            isActive ? "text-violet-600" : "text-gray-400"
          }`}
        >
          {label}
        </span>
      </>
    )}
  </NavLink>
);

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-white/90 px-2 py-2 shadow-xl shadow-gray-200/60 backdrop-blur-xl border border-gray-100"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="grid grid-cols-5">
        <Tab to="/discover"        icon="lni-home"       label="Discover" />
        <Tab to="/feeds"           icon="lni-rss-feed"   label="Feeds"    />
        <Tab to="/massage-clinics" icon="lni-hand"       label="Massage"  />
        <Tab to="/events"          icon="lni-calendar"   label="Events"   />
        <Tab to="/streams"         icon="lni-video"      label="Streams"  />
      </div>
    </nav>
  );
}