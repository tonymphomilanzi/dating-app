// src/pages/Notifications.jsx
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] bg-white text-gray-900">
      <header className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-2 hover:bg-gray-100 transition-colors"
          aria-label="Back"
          title="Back"
        >
          <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="leading-tight">
          <p className="text-sm text-gray-500">Notifications</p>
          <p className="text-base font-semibold">Your updates</p>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-sm font-medium text-gray-800">Coming soon</p>
          <p className="mt-1 text-xs text-gray-500">
            This page is a placeholder. We’ll add the notifications list + unread logic next.
          </p>
        </div>
      </main>
    </div>
  );
}