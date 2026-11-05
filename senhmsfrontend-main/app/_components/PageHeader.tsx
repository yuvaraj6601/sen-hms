import React from "react";
import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Crumb[];
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  children?: React.ReactNode;
}

export default function PageHeader({ title, breadcrumbs, action, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-slate-400 mb-1" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-sky-500 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-600">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action && (
          action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white
                text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {action.icon ?? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white
                text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {action.icon ?? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {action.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
