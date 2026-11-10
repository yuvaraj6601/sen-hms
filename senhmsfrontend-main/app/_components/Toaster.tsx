"use client";

import { useEffect, useState } from "react";

export type ToastKind = "error" | "warning" | "success";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

// A window event (not a module-level listener set) so toasts survive hot reloads
// and duplicate module instances — sender and <Toaster /> always share one channel.
const TOAST_EVENT = "hms:toast";
let nextId = 1;

function emit(kind: ToastKind, message: string) {
  if (typeof window === "undefined" || !message.trim()) return;
  const item: ToastItem = { id: Date.now() + nextId++, kind, message };
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: item }));
}

/** Fire-and-forget toasts. Render <Toaster /> once (dashboard layout) for them to show. */
export const toast = {
  error:   (message: string) => emit("error", message),
  warning: (message: string) => emit("warning", message),
  success: (message: string) => emit("success", message),
};

const DURATION_MS: Record<ToastKind, number> = { error: 6000, warning: 7000, success: 4000 };

const STYLES: Record<ToastKind, string> = {
  error:   "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const t: ToastItem = e.detail;
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== t.id)), DURATION_MS[t.kind]);
    };
    window.addEventListener(TOAST_EVENT, listener);
    return () => window.removeEventListener(TOAST_EVENT, listener);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))]" aria-live="polite">
      {items.map(t => (
        <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-sm shadow-lg ${STYLES[t.kind]}`}>
          <p className="flex-1">{t.message}</p>
          <button onClick={() => setItems(prev => prev.filter(i => i.id !== t.id))}
            aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}
