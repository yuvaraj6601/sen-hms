"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { toast } from "./Toaster";
import PrescriptionDraftEditor from "./PrescriptionDraftEditor";
import {
  buildSavePayload, emptyDraftItem, toDraft, validateDraftItems,
  type SaveContext, type VoiceDraft,
} from "../_lib/voice-prescription";

const MAX_RECORD_SECONDS = 300;

type Stage = "idle" | "recording" | "processing" | "review" | "saving";

interface Props {
  open: boolean;
  onClose: () => void;
  context: SaveContext;
  onSaved: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoicePrescriptionModal({ open, onClose, context, onSaved }: Props) {
  const [state, setState] = useState<{
    stage: Stage; seconds: number; draft: VoiceDraft | null;
  }>({ stage: "idle", seconds: 0, draft: null });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef  = useRef(false);

  function releaseMic() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  // Release the microphone if the modal unmounts mid-recording.
  useEffect(() => () => {
    discardRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    releaseMic();
  }, []);

  function reset() {
    setState({ stage: "idle", seconds: 0, draft: null });
  }

  function handleClose() {
    discardRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    releaseMic();
    reset();
    onClose();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardRef.current = false;
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        releaseMic();
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
        void uploadAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setState(p => ({ ...p, stage: "recording", seconds: 0 }));
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setState(p => ({ ...p, seconds: elapsed }));
        if (elapsed >= MAX_RECORD_SECONDS) stopRecording();
      }, 1000);
    } catch (err) {
      console.warn("Microphone unavailable", err);
      releaseMic();
      setState(p => ({ ...p, stage: "idle" })); toast.error("Microphone access was blocked. Allow it in the browser and try again.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  async function uploadAudio(blob: Blob) {
    if (blob.size === 0) {
      setState(p => ({ ...p, stage: "idle" })); toast.error("Nothing was recorded. Please try again.");
      return;
    }
    setState(p => ({ ...p, stage: "processing" }));
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("audio", blob, `dictation.${ext}`);
    try {
      const res  = await fetch("/api/prescriptions/voice-draft", { method: "POST", body: form, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(p => ({ ...p, stage: "idle" })); toast.error(json.error || "Could not create a draft. Please try again.");
        return;
      }
      const draft = toDraft(json.data);
      if (draft.items.length === 0) draft.items.push(emptyDraftItem());
      setState(p => ({ ...p, stage: "review", draft }));
      toast.warning("AI-generated draft — check every drug, dose and frequency before confirming.");
    } catch (err) {
      console.warn("Voice draft request failed", err);
      setState(p => ({ ...p, stage: "idle" })); toast.error("Cannot reach the server. Please try again.");
    }
  }

  async function confirmAndSave() {
    const draft = state.draft;
    if (!draft) return;
    const errors = validateDraftItems(draft.items);
    if (errors.length) { toast.error(errors.join(" · ")); return; }
    setState(p => ({ ...p, stage: "saving" }));
    try {
      const res  = await fetch("/api/prescriptions", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(draft, context, "VOICE")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(p => ({ ...p, stage: "review" })); toast.error(json.error || "Could not save the prescription.");
        return;
      }
      reset();
      toast.success("Prescription saved.");
      onSaved();
      onClose();
    } catch (err) {
      console.warn("Prescription save failed", err);
      setState(p => ({ ...p, stage: "review" })); toast.error("Cannot reach the server. Please try again.");
    }
  }

  const { stage, seconds, draft } = state;
  const reviewing = (stage === "review" || stage === "saving") && draft;

  const footer = reviewing ? (
    <>
      <button onClick={reset} disabled={stage === "saving"}
        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40">Discard &amp; re-record</button>
      <button onClick={confirmAndSave} disabled={stage === "saving"}
        className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {stage === "saving" ? "Saving…" : "Confirm & Save"}
      </button>
    </>
  ) : (
    <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Voice Prescription" size="xl" footer={footer}>
      <div className="space-y-4">

        {(stage === "idle" || stage === "recording") && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-slate-500 text-center max-w-md">
              Dictate the consultation and medicines (drug, dose, frequency, duration). The AI will prepare a draft that you review and edit before anything is saved.
            </p>
            {stage === "idle" ? (
              <button onClick={startRecording}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                <span className="w-3 h-3 rounded-full bg-white" /> Start recording
              </button>
            ) : (
              <>
                <p className="text-2xl font-mono text-red-600 tabular-nums" aria-live="polite">● {fmt(seconds)}</p>
                <button onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                  <span className="w-3 h-3 bg-white" /> Stop &amp; create draft
                </button>
              </>
            )}
          </div>
        )}

        {stage === "processing" && (
          <p className="text-center text-sm text-slate-500 py-10" aria-live="polite">Transcribing and preparing the draft…</p>
        )}

        {reviewing && draft && (
          <PrescriptionDraftEditor draft={draft} sourceLabel="What you said (transcript)"
            onChange={next => setState(p => ({ ...p, draft: next }))} />
        )}
      </div>
    </Modal>
  );
}
