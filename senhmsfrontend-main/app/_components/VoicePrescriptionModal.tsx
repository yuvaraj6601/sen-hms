"use client";

import { useEffect, useRef, useState } from "react";
import Modal, { FormField, Input, Select, Textarea } from "./Modal";
import {
  ROUTE_OPTIONS, TIMING_OPTIONS, buildSavePayload, emptyDraftItem, toRouteEnum, toTimingEnum,
  validateDraftItems,
  type DraftItem, type SaveContext, type VoiceDraft,
} from "../_lib/voice-prescription";

const MAX_RECORD_SECONDS = 300;

type Stage = "idle" | "recording" | "processing" | "review" | "saving";

interface Props {
  open: boolean;
  onClose: () => void;
  context: SaveContext;
  onSaved: () => void;
}

interface DraftApiItem {
  drugName?: string; dosage?: string; frequency?: string;
  route?: string; timing?: string | null; duration?: string | null; instructions?: string | null;
}
interface DraftApiResponse {
  transcript?: string; diagnosis?: string | null; notes?: string | null; items?: DraftApiItem[];
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function toDraft(api: DraftApiResponse): VoiceDraft {
  return {
    transcript: api.transcript ?? "",
    diagnosis: api.diagnosis ?? "",
    notes: api.notes ?? "",
    items: (api.items ?? []).map((i): DraftItem => ({
      drugName: i.drugName ?? "",
      dosage: i.dosage ?? "",
      frequency: i.frequency ?? "",
      route: toRouteEnum(i.route ?? ""),
      timing: toTimingEnum(i.timing ?? ""),
      duration: i.duration ?? "",
      instructions: i.instructions ?? "",
    })),
  };
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoicePrescriptionModal({ open, onClose, context, onSaved }: Props) {
  const [state, setState] = useState<{
    stage: Stage; seconds: number; error: string; draft: VoiceDraft | null;
  }>({ stage: "idle", seconds: 0, error: "", draft: null });

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
    setState({ stage: "idle", seconds: 0, error: "", draft: null });
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
      setState(p => ({ ...p, error: "Voice recording is not supported in this browser." }));
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
      setState(p => ({ ...p, stage: "recording", seconds: 0, error: "" }));
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setState(p => ({ ...p, seconds: elapsed }));
        if (elapsed >= MAX_RECORD_SECONDS) stopRecording();
      }, 1000);
    } catch (err) {
      console.warn("Microphone unavailable", err);
      releaseMic();
      setState(p => ({ ...p, stage: "idle", error: "Microphone access was blocked. Allow it in the browser and try again." }));
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  async function uploadAudio(blob: Blob) {
    if (blob.size === 0) {
      setState(p => ({ ...p, stage: "idle", error: "Nothing was recorded. Please try again." }));
      return;
    }
    setState(p => ({ ...p, stage: "processing", error: "" }));
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("audio", blob, `dictation.${ext}`);
    try {
      const res  = await fetch("/api/prescriptions/voice-draft", { method: "POST", body: form, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(p => ({ ...p, stage: "idle", error: json.error ?? "Could not create a draft. Please try again." }));
        return;
      }
      const draft = toDraft(json.data as DraftApiResponse);
      if (draft.items.length === 0) draft.items.push(emptyDraftItem());
      setState(p => ({ ...p, stage: "review", draft }));
    } catch (err) {
      console.warn("Voice draft request failed", err);
      setState(p => ({ ...p, stage: "idle", error: "Cannot reach the server. Please try again." }));
    }
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setState(p => p.draft ? {
      ...p, draft: { ...p.draft, items: p.draft.items.map((it, i) => i === idx ? { ...it, ...patch } : it) },
    } : p);
  }

  async function confirmAndSave() {
    const draft = state.draft;
    if (!draft) return;
    const errors = validateDraftItems(draft.items);
    if (errors.length) { setState(p => ({ ...p, error: errors.join(" · ") })); return; }
    setState(p => ({ ...p, stage: "saving", error: "" }));
    try {
      const res  = await fetch("/api/prescriptions", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(draft, context, "VOICE")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(p => ({ ...p, stage: "review", error: json.error ?? "Could not save the prescription." }));
        return;
      }
      reset();
      onSaved();
      onClose();
    } catch (err) {
      console.warn("Prescription save failed", err);
      setState(p => ({ ...p, stage: "review", error: "Cannot reach the server. Please try again." }));
    }
  }

  const { stage, seconds, error, draft } = state;
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
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

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
          <>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              AI-generated draft — check every drug, dose and frequency before confirming.
            </p>
            <FormField label="What you said (transcript)">
              <Textarea rows={2} value={draft.transcript}
                onChange={e => setState(p => p.draft ? { ...p, draft: { ...p.draft, transcript: e.target.value } } : p)} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Diagnosis">
                <Input value={draft.diagnosis}
                  onChange={e => setState(p => p.draft ? { ...p, draft: { ...p.draft, diagnosis: e.target.value } } : p)} />
              </FormField>
              <FormField label="Notes / advice">
                <Input value={draft.notes}
                  onChange={e => setState(p => p.draft ? { ...p, draft: { ...p.draft, notes: e.target.value } } : p)} />
              </FormField>
            </div>

            <div className="space-y-3">
              {draft.items.map((it, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Drug" required>
                      <Input value={it.drugName} onChange={e => updateItem(idx, { drugName: e.target.value })} />
                    </FormField>
                    <FormField label="Dosage" required>
                      <Input value={it.dosage} onChange={e => updateItem(idx, { dosage: e.target.value })} />
                    </FormField>
                    <FormField label="Frequency" required>
                      <Input value={it.frequency} onChange={e => updateItem(idx, { frequency: e.target.value })} placeholder="e.g. 1-0-1" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <FormField label="Route">
                      <Select value={it.route} onChange={e => updateItem(idx, { route: toRouteEnum(e.target.value) })}>
                        {ROUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Timing">
                      <Select value={it.timing ?? ""} onChange={e => updateItem(idx, { timing: toTimingEnum(e.target.value) })}>
                        <option value="">—</option>
                        {TIMING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Duration">
                      <Input value={it.duration} onChange={e => updateItem(idx, { duration: e.target.value })} placeholder="e.g. 5 days" />
                    </FormField>
                    <FormField label="Instructions">
                      <Input value={it.instructions} onChange={e => updateItem(idx, { instructions: e.target.value })} />
                    </FormField>
                  </div>
                  <button type="button" onClick={() => setState(p => p.draft ? { ...p, draft: { ...p.draft, items: p.draft.items.filter((_, i) => i !== idx) } } : p)}
                    className="text-xs text-red-500 hover:text-red-700">Remove medicine</button>
                </div>
              ))}
              <button type="button" onClick={() => setState(p => p.draft ? { ...p, draft: { ...p.draft, items: [...p.draft.items, emptyDraftItem()] } } : p)}
                className="text-sm font-semibold text-[#00059f] hover:underline">+ Add medicine</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
