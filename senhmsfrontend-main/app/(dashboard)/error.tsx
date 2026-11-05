"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-800">Something went wrong</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          {error.message || "An unexpected error occurred. Try refreshing the page."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg">
          Try again
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
