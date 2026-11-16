"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function fmt(v: string) {
  if (!v) return "Select date & time";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** Date & time picker that only applies the value when OK is pressed. */
export default function DateTimeOkInput({ value, onChange, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPicker() {
    setDate(value ? value.slice(0, 10) : "");
    setTime(value ? value.slice(11, 16) : "");
    setOpen(true);
  }

  function confirm() {
    if (!date) return;
    onChange(`${date}T${time || "00:00"}`);
    setOpen(false);
  }

  const fieldCls = "w-full h-9 px-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-[#00059f] focus:ring-2 focus:ring-blue-100";

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => (open ? setOpen(false) : openPicker())}
        className={`${className} text-left ${value ? "text-slate-800" : "text-slate-400"}`}>
        {fmt(value)}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg space-y-2">
          <input type="date" className={fieldCls} value={date} onChange={e => setDate(e.target.value)} />
          <input type="time" className={fieldCls} value={time} onChange={e => setTime(e.target.value)} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
            <button type="button" onClick={confirm} disabled={!date}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-[#00059f] rounded-md hover:bg-blue-800 disabled:opacity-40">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
