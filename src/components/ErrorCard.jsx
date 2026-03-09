export default function ErrorCard({ err, onRetry }) {
  return (
    <div className="grid h-[60vh] place-items-center text-center">
      <div>
        <p className="text-red-600 font-medium">Failed to load</p>
       
<p className="mt-1 text-xs text-gray-500">
  {err?.message || err?.error || (typeof err === 'string' ? err : 'An error occurred')}
</p>
        <button className="btn-outline mt-3" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}