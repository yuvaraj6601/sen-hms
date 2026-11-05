"use client";

import { useRouter } from "next/navigation";

interface UnderDevelopmentProps {
  title: string;
  description?: string;
}

export default function UnderDevelopment({ title, description }: UnderDevelopmentProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
        <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0
              001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
        </svg>
      </div>

      {/* Text */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
          {description ?? "This page is currently under development and will be available soon."}
        </p>
      </div>

      {/* Badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
        bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Under Development
      </span>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200
          bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:text-slate-900
          hover:border-slate-300 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        Go Back
      </button>
    </div>
  );
}
