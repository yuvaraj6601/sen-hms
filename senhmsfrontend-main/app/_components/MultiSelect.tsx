"use client";

/**
 * MultiSelect — a clean dropdown with checkbox options.
 * Shows a summary ("All", "2 selected", or the single value) on the trigger
 * and a popover panel with checkboxes. Closes on outside click / Escape.
 */
import { useState, useRef, useEffect } from "react";

export interface Option { value: string; label: string; }

export function MultiSelect({
  options, selected, onChange, placeholder = "Select…", allLabel = "All",
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const allSelected = selected.length === options.length && options.length > 0;
  const summary = selected.length === 0
    ? placeholder
    : allSelected
      ? allLabel
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  }
  function toggleAll() { onChange(allSelected ? [] : options.map(o => o.value)); }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <span className={selected.length === 0 ? "text-slate-400" : ""}>{summary}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
          <button type="button" onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 border-b border-slate-100">
            <span className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
              {allSelected && <Check />}
            </span>
            {allLabel}
          </button>
          {options.map(o => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                  {on && <Check />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown — a single-select dropdown styled to match MultiSelect (used for
 * segmented-style choices we want to declutter into a menu).
 */
export function Dropdown({
  options, value, onChange,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  const current = options.find(o => o.value === value)?.label ?? value;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <span>{current}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 ${o.value === value ? "text-indigo-700 font-semibold bg-indigo-50" : "text-slate-700"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Check() {
  return (
    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
