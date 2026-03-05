export default function LoaderOverlay({ text = "Loading…" }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-white/80 backdrop-blur">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
        <span className="relative inline-block h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-violet-600" />
        </span>
        <span className="text-sm font-medium text-gray-700">{text}</span>
      </div>
    </div>
  );
}
