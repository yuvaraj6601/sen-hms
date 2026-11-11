"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "./Toaster";

type MicState = "idle" | "recording" | "transcribing";

const MIN_RECORDING_MS = 400;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/**
 * Hold-to-talk mic: press and hold to record, release to transcribe.
 * The spoken text is passed to onText — nothing is stored server-side.
 */
export function MicButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<MicState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const releasedRef = useRef(false);

  // Stop the mic if the field unmounts mid-recording.
  useEffect(() => () => recorderRef.current?.stream.getTracks().forEach(t => t.stop()), []);

  async function start(e: React.PointerEvent) {
    e.preventDefault();
    if (disabled || state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    releasedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstart = ev => { startedAtRef.current = ev.timeStamp; };
      rec.onstop = ev => {
        stream.getTracks().forEach(t => t.stop());
        const tooShort = ev.timeStamp - startedAtRef.current < MIN_RECORDING_MS;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
        if (tooShort || blob.size === 0) {
          setState("idle");
          toast.warning("Hold the mic while you speak.");
          return;
        }
        void transcribe(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");
      // Released while the permission prompt / mic was still starting up.
      if (releasedRef.current) rec.stop();
    } catch (err) {
      console.warn("Microphone unavailable", err);
      toast.error("Microphone access was blocked. Allow it in the browser to use voice input.");
      setState("idle");
    }
  }

  function stop() {
    releasedRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  }

  async function transcribe(blob: Blob) {
    setState("transcribing");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("audio", blob, `dictation.${ext}`);
    try {
      const res = await fetch("/api/case-sheet/transcribe", { method: "POST", body: form, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not transcribe. Please try again.");
      } else if (!json.data?.text) {
        toast.warning("No speech detected.");
      } else {
        onText(json.data.text as string);
      }
    } catch (err) {
      console.warn("Transcription failed", err);
      toast.error("Cannot reach the server. Please try again.");
    } finally {
      setState("idle");
    }
  }

  const label = state === "recording" ? "Release to stop" : state === "transcribing" ? "Transcribing…" : "Hold to speak";

  return (
    <button type="button" title={label} aria-label={label} disabled={disabled || state === "transcribing"}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      className={`flex items-center justify-center w-7 h-7 rounded-full select-none touch-none transition-colors
        ${state === "recording" ? "bg-red-500 text-white animate-pulse"
          : state === "transcribing" ? "bg-slate-100 text-slate-400"
          : "text-slate-400 hover:text-[#00059f] hover:bg-blue-50"} disabled:opacity-50`}>
      {state === "transcribing" ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z" /></svg>
      )}
    </button>
  );
}

/**
 * Wraps an input / textarea with a hold-to-talk mic in its top-right corner.
 * Spoken text is appended to the current value (so dictation adds to what is there).
 * The wrapped control should leave right padding (pr-9) so text does not run under the mic.
 */
export default function VoiceField({ value, onChange, children, disabled }: {
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  return (
    <div className="relative">
      {children}
      <div className="absolute top-1 right-1">
        <MicButton disabled={disabled} onText={text => {
          const current = valueRef.current ?? "";
          onChange(current.trim() ? `${current.trimEnd()} ${text}` : text);
        }} />
      </div>
    </div>
  );
}
