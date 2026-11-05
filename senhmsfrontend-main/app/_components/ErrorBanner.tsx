"use client";

/**
 * Inline error banner — shown inside the page content area
 * when an API call fails. Does NOT replace the whole page.
 */
export default function ErrorBanner({
  msg,
  onRetry,
}: {
  msg: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* warning icon */}
        <svg
          className="w-4 h-4 shrink-0 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <span className="font-medium truncate">{msg}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors text-xs"
        >
          Retry
        </button>
      )}
    </div>
  );
}
