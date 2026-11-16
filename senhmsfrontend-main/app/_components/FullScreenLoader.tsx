"use client";

import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  message?: string;
}

/** Blocks the whole screen while the AI is reading a document. */
export default function FullScreenLoader({ open, message = "AI is processing the document…" }: Props) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-slate-900/60 backdrop-blur-sm" role="alert" aria-busy="true" aria-live="assertive">
      <div className="h-14 w-14 rounded-full border-4 border-white/30 border-t-white animate-spin" />
      <p className="max-w-sm px-6 text-center text-sm font-medium text-white">{message}</p>
    </div>,
    document.body,
  );
}
