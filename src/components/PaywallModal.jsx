export default function PaywallModal({ open, onClose, reason = "Premium feature", onUpgrade }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-2 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white">
            <i className="lni lni-crown" />
          </div>
          <div className="text-lg font-semibold">Go Premium</div>
        </div>
        <p className="text-sm text-gray-600">
          {reason || "This action is for Premium members."}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            className="btn-outline flex-1"
            onClick={onClose}
          >
            Not now
          </button>
          <button
            className="btn-primary flex-1"
            onClick={onUpgrade}
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}