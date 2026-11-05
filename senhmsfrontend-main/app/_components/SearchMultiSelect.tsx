"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export interface MultiSelectOption {
  /** Unique, stable value for the option (used as the selection key). */
  value: string;
  /** Primary label shown in the list and the selected chips. */
  label: string;
  /** Optional secondary text shown muted on the right (e.g. a price). */
  hint?: string;
  /** Optional lower-cased, extra text to match against while searching. */
  searchText?: string;
}

interface SearchMultiSelectProps {
  options: MultiSelectOption[];
  /** Currently selected option values. */
  selected: string[];
  /** Fired with the next full set of selected values whenever it changes. */
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Shown when the search yields no matches. */
  emptyText?: string;
  /** Hide the selected chips row (useful when the caller renders selections elsewhere). */
  hideChips?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable searchable multi-select dropdown.
 *
 * - Type to filter options by label / hint / searchText (case-insensitive).
 * - Click an option (or press Enter on the highlighted one) to toggle it.
 * - Selected options show as removable chips above the input.
 * - Closes on outside click or Escape. Fully controlled via `selected`/`onChange`.
 */
export default function SearchMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  hideChips = false,
  disabled = false,
  className = "",
}: SearchMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  // Ref on the currently-highlighted option so arrow-key navigation can keep it
  // scrolled into view (keyboard-first use on desktop PCs).
  const activeRef = useRef<HTMLButtonElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.hint ?? "").toLowerCase().includes(q) ||
      (o.searchText ?? "").includes(q)
    );
  }, [options, query]);

  // Keep the keyboard highlight within bounds as the list changes.
  useEffect(() => { setActiveIdx(0); }, [query, open]);

  // Scroll the highlighted option into view as the user arrows up/down so the
  // active row never ends up hidden above/below the scroll area.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggle(value: string) {
    if (selectedSet.has(value)) onChange(selected.filter(v => v !== value));
    else onChange([...selected, value]);
  }

  function removeChip(value: string) {
    onChange(selected.filter(v => v !== value));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIdx]) {
        e.preventDefault();
        toggle(filtered[activeIdx].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      // Quick-remove the last chip when the input is empty.
      removeChip(selected[selected.length - 1]);
    }
  }

  const chips = !hideChips
    ? selected
        // Collapse duplicates so each selected value renders a single chip with
        // a unique key (a service may appear on several bill lines, but the
        // selector represents a set of services).
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map(v => options.find(o => o.value === v))
        .filter((o): o is MultiSelectOption => Boolean(o))
    : [];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {!hideChips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {chips.map(o => (
            <span key={o.value}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md
                bg-sky-50 border border-sky-200 text-xs text-sky-700">
              {o.label}
              <button type="button" onClick={() => removeChip(o.value)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-sky-100 text-sky-500"
                aria-label={`Remove ${o.label}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
            disabled:bg-slate-50 disabled:text-slate-500 transition-shadow"
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200
          bg-white shadow-lg py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">{emptyText}</div>
          ) : (
            filtered.map((o, idx) => {
              const checked = selectedSet.has(o.value);
              const active  = idx === activeIdx;
              return (
                <button
                  key={o.value}
                  ref={active ? activeRef : undefined}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
                    ${active ? "bg-sky-100 text-sky-900" : ""}
                    ${checked && !active ? "bg-sky-50/60" : ""}`}
                >
                  {/* Tick marker for already-selected options (no checkbox). */}
                  <span className="w-4 h-4 flex-none flex items-center justify-center">
                    {checked && (
                      <svg className="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex-1 min-w-0 truncate ${checked ? "text-sky-800 font-medium" : "text-slate-700"}`}>{o.label}</span>
                  {o.hint && <span className="flex-none text-xs text-slate-400 tabular-nums">{o.hint}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
