import React from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  sub?: string;
  className?: string;
  href?: string;
}

export default function StatCard({
  label, value, icon, iconBg = "bg-sky-50", sub, className = "", href,
}: StatCardProps) {
  const isLink = Boolean(href);

  const cardClass = `group bg-white rounded-2xl border border-slate-100 shadow-sm
    hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
    overflow-hidden ${isLink ? "cursor-pointer hover:border-slate-200" : "cursor-default"} ${className}`;

  const inner = (
    <div className="flex items-start gap-3 p-4">

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl ${iconBg}
        flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium truncate leading-tight">
          {label}
        </p>
        <p className="text-[1.35rem] font-extrabold text-slate-900 leading-snug truncate mt-0.5">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
        )}
      </div>

      {/* Chevron — only for links, appears on hover */}
      {isLink && (
        <svg
          className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 opacity-0 -translate-x-1
            group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-slate-400
            transition-all duration-200"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );

  if (isLink) {
    return (
      <Link
        href={href!}
        aria-label={`${label}: ${value}. ${sub ?? ""}`.trim()}
        className={`block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
          focus-visible:ring-offset-2 rounded-2xl ${cardClass}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}
