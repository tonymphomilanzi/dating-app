import { Outlet } from "react-router-dom";

export default function RootLayout() {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-md bg-gray-50">
      <Outlet />
    </div>
  );
}