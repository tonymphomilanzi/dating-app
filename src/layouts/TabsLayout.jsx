import { Outlet } from "react-router-dom";
import BottomTabs from "../components/BottomTabs.jsx";

export default function TabsLayout() {
  return (
    <div className="relative min-h-dvh">
      <div className="pb-28">
        <Outlet />
      </div>
      <BottomTabs />
    </div>
  );
}