"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { toast } from "./Toaster";
import PrescriptionDraftEditor from "./PrescriptionDraftEditor";
import {
  buildSavePayload, emptyDraftItem, toDraft, validateDraftItems,
  type SaveContext, type VoiceDraft,
} from "../_lib/voice-prescription";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Stage = "pick" | "processing" | "review" | "saving";

interface Props {
  open: boolean;
  onClose: () => void;
  context: SaveContext;
  onSaved: () => void;
}

interface UploadState {
  stage: Stage;
  file: File | null;
  previewUrl: string;
  draft: VoiceDraft | null;
}

const INITIAL: UploadState = { stage: "pick", file: null, previewUrl: "", draft: null };

export default function UploadPrescriptionModal({ open, onClose, context, onSaved }: Props) {
  const [state, setState] = useState<UploadState>(INITIAL);

  // Free the object URL whenever the preview changes or the modal unmounts.
  useEffect(() => {
    const url = state.previewUrl;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [state.previewUrl]);

  function reset() {
    setState(INITIAL);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG or WEBP images are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large (max 10 MB).");
      return;
    }
    setState(p => ({ ...p, file, previewUrl: URL.createObjectURL(file) }));
  }

  async function readPrescription() {
    const file = state.file;
    if (!file) return;
    setState(p => ({ ...p, stage: "processing" }));
    const form = new FormData();
    form.append("image", file, file.name);
    try {
      const res  = await fetch("/api/prescriptions/image-draft", { method: "POST", body: form, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState(p => ({ ...p, stage: "pick" })); toast.error(json.error || "Could not read the prescription. Please try again.");
        return;
      }
      const draft = toDraft(json.data);
      if (draft.items.length === 0) draft.items.push(emptyDraftItem());
      setState(p => ({ ...p, stage: "review", draft }));
      toast.warning("AI-generated draft — check every drug, dose and frequency before confirming.");
    } catch (err) {
      console.warn("Image draft request failed", err);
      setState(p => ({ ...p, stage: "pick" })); toast.error("Cannot reach the server. Please try again.");
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
        body: JSON.stringify(buildSavePayload(draft, context, "HANDWRITTEN")),
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

  const { stage, file, previewUrl, draft } = state;
  const reviewing = (stage === "review" || stage === "saving") && draft;

  const footer = reviewing ? (
    <>
      <button onClick={reset} disabled={stage === "saving"}
        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40">Discard &amp; re-upload</button>
      <button onClick={confirmAndSave} disabled={stage === "saving"}
        className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {stage === "saving" ? "Saving…" : "Confirm & Save"}
      </button>
    </>
  ) : (
    <>
      <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
      <button onClick={readPrescription} disabled={!file || stage === "processing"}
        className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {stage === "processing" ? "Reading…" : "Read prescription"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Upload Handwritten Prescription" size="xl" footer={footer}>
      <div className="space-y-4">

        {(stage === "pick" || stage === "processing") && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-slate-500 text-center max-w-md">
              Upload a clear photo or scan of the handwritten prescription. The AI will read it and prepare a draft that you review and edit before anything is saved.
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-[#00059f] text-[#00059f] bg-white hover:bg-blue-50 cursor-pointer transition-colors">
              {file ? "Choose a different image" : "Choose image / take photo"}
              <input type="file" accept={ACCEPTED_TYPES.join(",")} capture="environment" className="hidden"
                disabled={stage === "processing"}
                onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset
              <img src={previewUrl} alt="Uploaded prescription preview"
                className="max-h-80 rounded-lg border border-slate-200 object-contain" />
            )}
            {stage === "processing" && (
              <p className="text-sm text-slate-500" aria-live="polite">Reading the handwriting and preparing the draft…</p>
            )}
          </div>
        )}

        {reviewing && draft && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset
              <img src={previewUrl} alt="Uploaded prescription"
                className="w-full max-h-[32rem] rounded-lg border border-slate-200 object-contain lg:sticky lg:top-0" />
            )}
            <div className={`space-y-4 ${previewUrl ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <PrescriptionDraftEditor draft={draft} sourceLabel="Text read from the image"
                onChange={next => setState(p => ({ ...p, draft: next }))} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
