"use client";

import { useState, useMemo, useEffect, useRef } from "react";

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Searchable single-select dropdown with an inline "Add new" row.
 *
 * When the typed query doesn't exactly match an existing option, an
 * "+ Add …" row appears; clicking it calls {@link onAdd} with the trimmed
 * query so the parent can persist the new value (e.g. to a Dropdowns master)
 * and add it to {@link options}.
 *
 * This is the same control used for District selection in the OP token modal,
 * extracted here so Billing and Insurance screens can reuse it for TPA names.
 */
export default function CreatableSearchSelect({
  value,
  options,
  onChange,
  onAdd,
  placeholder = "Select or type to add…",
  searchPlaceholder = "Type to search or add…",
  addLabel = (q: string) => `+ Add "${q}"`,
  allowClear = false,
}: {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  onAdd: (newValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  addLabel?: (q: string) => string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [query, options]);

  const trimmedQuery = query.trim();
  const exactMatch =
    trimmedQuery !== "" && options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());
  const showAddRow = trimmedQuery !== "" && !exactMatch;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && boxRef.current) {
              const rect = boxRef.current.getBoundingClientRect();
              setDropUp(
                window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom
              );
            }
            return next;
          });
          setQuery("");
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <span className={selected || value ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {selected ? selected.label : (value || placeholder)}
        </span>
        <span className="flex items-center shrink-0 ml-2">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); } }}
              className="text-slate-400 hover:text-slate-600 mr-1 leading-none"
            >
              ×
            </span>
          )}
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden
          ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !showAddRow && (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors
                    ${o.value === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}
                >
                  {o.label}
                  {o.sublabel && <span className="block text-xs text-slate-400">{o.sublabel}</span>}
                </button>
              </li>
            ))}
            {showAddRow && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(trimmedQuery);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-sky-600 font-medium hover:bg-sky-50 transition-colors border-t border-slate-100"
                >
                  {addLabel(trimmedQuery)}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
