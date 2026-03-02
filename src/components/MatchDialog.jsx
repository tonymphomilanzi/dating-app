export default function MatchDialog({ open, onClose, other }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-card">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-violet-600 text-white shadow-glow">
          <i className="lni lni-heart text-3xl" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">It’s a match!</h2>
        <p className="mt-1 text-gray-600">
          You and {other?.display_name || "someone"} like each other.
        </p>
        <div className="mt-5 grid gap-3">
          <a href="/messages" className="btn-primary w-full text-center">Say hello</a>
          <button className="btn-outline w-full" onClick={onClose}>Keep swiping</button>
        </div>
      </div>
    </div>
  );
}