//import { Outlet } from "react-router-dom";
import { Outlet } from "@tanstack/react-router";
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