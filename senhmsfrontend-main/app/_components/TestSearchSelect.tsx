"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * TestSearchSelect
 * ────────────────
 * A searchable lab-test picker used in the lab-order modals (case sheet + lab
 * investigations). Replaces the native <select> which showed the lab code and
 * required reopening the dropdown for every test.
 *
 * Behaviour:
 *   • Type to filter the list live by name or category (lab code is NOT shown).
 *   • Click a result to add it immediately (one click, no "select" step).
 *   • Added tests disappear from the list (excluded via `excludeIds`).
 *   • The search box keeps focus after adding so several tests can be added in
 *     a row without reopening anything.
 */

export interface PickableTest {
  id: number;
  name: string;
  category: string;
  price: number;
  sampleType?: string | null;
}

function inr(n: number) {
  return "₹" + (n ?? 0).toLocaleString("en-IN");
}

export default function TestSearchSelect<T extends PickableTest>({
  options,
  excludeIds,
  onAdd,
  placeholder = "Search test by name or category…",
  accent = "sky",
}: {
  options: T[];
  /** IDs already added to the order — excluded from the list. */
  excludeIds: Set<number>;
  onAdd: (test: T) => void;
  placeholder?: string;
  /** Tailwind accent colour family for the focus ring / hover. */
  accent?: "sky" | "blue";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside the component.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const ring = accent === "blue" ? "focus:ring-[#00059f]" : "focus:ring-sky-500";
  const hover = accent === "blue" ? "hover:bg-blue-50" : "hover:bg-sky-50";
  const priceColor = accent === "blue" ? "text-[#00059f]" : "text-sky-700";

  const available = useMemo(
    () => options.filter(o => !excludeIds.has(o.id)),
    [options, excludeIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? available.filter(
          o =>
            o.name.toLowerCase().includes(q) ||
            (o.category ?? "").toLowerCase().includes(q),
        )
      : available;
    // Cap the rendered list for performance; search narrows it down.
    return list.slice(0, 50);
  }, [available, query]);

  function add(test: T) {
    onAdd(test);
    setQuery("");
    // keep focus so the user can type the next test immediately
    inputRef.current?.focus();
  }

  return (
    <div>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white
            text-sm focus:outline-none focus:ring-2 ${ring}`}
        />
      </div>

      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            {available.length === 0 ? "All tests added" : "No matching tests"}
          </p>
        ) : (
          filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left
                transition-colors ${hover}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 truncate">{t.name}</span>
                <span className="block text-xs text-slate-400 truncate">
                  {t.category}{t.sampleType ? ` · ${t.sampleType}` : ""}
                </span>
              </span>
              <span className={`text-sm font-semibold shrink-0 ${priceColor}`}>{inr(t.price)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
