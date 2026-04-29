import { useNavigate } from "react-router-dom";

export default function TopBar({ title, right }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-4 py-3 backdrop-blur">
      <button
        onClick={() => nav("/discover")}
        className="rounded-full p-2 hover:bg-gray-100"
        aria-label="Back"
      >
        <i className="lni lni-chevron-left text-gray-700 text-xl leading-none" />
      </button>
      {title && <h1 className="text-base font-semibold">{title}</h1>}
      <div className="w-8 flex justify-end">{right}</div>
    </header>
  );
}