import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";

export default function Filters(){
  return (
    <div className="min-h-dvh">
      <TopBar title="Filters" />
      <div className="space-y-6 p-6">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Interested in</span>
            <div className="flex gap-2">
              <button className="chip chip-on">Women</button>
              <button className="chip chip-off">Men</button>
              <button className="chip chip-off">All</button>
            </div>
          </div>
          <div className="mt-5">
            <label className="text-sm text-gray-600">Distance</label>
            <input type="range" min={1} max={100} defaultValue={25} className="w-full accent-violet-600"/>
            <div className="mt-1 text-right text-sm text-gray-500">25 km</div>
          </div>
          <div className="mt-5">
            <label className="text-sm text-gray-600">Age</label>
            <input type="range" min={18} max={60} defaultValue={28} className="w-full accent-violet-600"/>
            <div className="mt-1 text-right text-sm text-gray-500">18 – 35</div>
          </div>
        </div>
        <Button className="w-full">Continue</Button>
      </div>
    </div>
  );
}