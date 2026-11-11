"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { toast } from "./Toaster";
import VoiceField from "./VoiceField";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface DraftObservation {
  date: string | null;
  time: string | null;
  doctorName: string | null;
  type: string | null;
  chiefComplaint: string | null;
  clinicalFindings: string | null;
  generalExamination: string | null;
  systemicExamination: string | null;
  diagnosis: string | null;
  plan: string | null;
  advice: string | null;
  notes: string | null;
}

export interface DraftVital {
  recordedAt: string | null;
  recordedBy: string | null;
  bloodPressure: string | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  respiratoryRate: number | null;
  weight: number | null;
  height: number | null;
  bloodGlucose: number | null;
  drainage: string | null;
  aspiration: string | null;
  intake: string | null;
  output: string | null;
  remarks: string | null;
}

/** Nested discharge-summary template — leaves are strings. */
export type DischargeNode = { [key: string]: string | DischargeNode };

export interface CaseSheetDraft {
  observations: DraftObservation[];
  vitals: DraftVital[];
  dischargeSummary: DischargeNode | null;
}

type Stage = "pick" | "processing" | "review" | "saving";
type ReviewTab = "observations" | "vitals" | "discharge";

interface Props {
  open: boolean;
  onClose: () => void;
  admissionId: number;
  onSaved: () => void;
}

const baseCls = "w-full px-2.5 text-sm text-slate-800 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-[#00059f] focus:ring-2 focus:ring-blue-100 transition-colors";
/** Single-line controls — every input, select and date picker shares this exact height. */
const inputCls = `${baseCls} h-9`;
/** Multi-line notes — all the same height, user can drag taller. */
const textareaCls = `${baseCls} py-2 min-h-[4.5rem] resize-y leading-snug`;

export default function UploadCaseSheetModal({ open, onClose, admissionId, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<CaseSheetDraft | null>(null);
  const [reviewTab, setReviewTab] = useState<ReviewTab>("observations");
  const [includeDischarge, setIncludeDischarge] = useState(true);

  function reset() {
    setStage("pick"); setFile(null); setDraft(null); setReviewTab("observations"); setIncludeDischarge(true);
  }

  function handleClose() {
    if (stage === "processing" || stage === "saving") return;
    reset();
    onClose();
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) { toast.error("Only PDF, JPG, PNG or WEBP files are accepted."); return; }
    if (f.size > MAX_BYTES) { toast.error("File is too large (max 20 MB)."); return; }
    setFile(f);
  }

  async function readReport() {
    if (!file) return;
    setStage("processing");
    const form = new FormData();
    form.append("file", file, file.name);
    try {
      const res  = await fetch(`/api/case-sheet/report-draft?admissionId=${admissionId}`, { method: "POST", body: form, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStage("pick"); toast.error(json.error || "Could not read the document. Please try again.");
        return;
      }
      const data = json.data as CaseSheetDraft;
      setDraft({ observations: data.observations ?? [], vitals: data.vitals ?? [], dischargeSummary: data.dischargeSummary ?? null });
      setIncludeDischarge(!!data.dischargeSummary);
      setStage("review");
      toast.warning("AI-generated draft — check every entry before confirming.");
    } catch (err) {
      console.warn("Case sheet draft request failed", err);
      setStage("pick"); toast.error("Cannot reach the server. Please try again.");
    }
  }

  async function confirmAndSave() {
    if (!draft) return;
    if (draft.vitals.some(v => !v.recordedAt)) {
      toast.error("Every vitals row needs a date & time (or remove the row)."); setReviewTab("vitals"); return;
    }
    setStage("saving");
    try {
      const res = await fetch(`/api/case-sheet/report-import?admissionId=${admissionId}`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observations: draft.observations,
          vitals: draft.vitals,
          dischargeSummary: includeDischarge ? draft.dischargeSummary : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStage("review"); toast.error(json.error || "Could not save the report.");
        return;
      }
      const d = json.data as { observationsSaved: number; vitalsSaved: number; dischargeSummarySaved: boolean };
      toast.success(`Saved ${d.observationsSaved} observation(s), ${d.vitalsSaved} vitals row(s)${d.dischargeSummarySaved ? " and the discharge summary" : ""}.`);
      reset();
      onSaved();
      onClose();
    } catch (err) {
      console.warn("Case sheet import failed", err);
      setStage("review"); toast.error("Cannot reach the server. Please try again.");
    }
  }

  function updateObs(i: number, patch: Partial<DraftObservation>) {
    setDraft(d => d && { ...d, observations: d.observations.map((o, j) => j === i ? { ...o, ...patch } : o) });
  }
  function updateVital(i: number, patch: Partial<DraftVital>) {
    setDraft(d => d && { ...d, vitals: d.vitals.map((v, j) => j === i ? { ...v, ...patch } : v) });
  }
  function updateDischarge(path: string[], value: string) {
    setDraft(d => {
      if (!d || !d.dischargeSummary) return d;
      const root: DischargeNode = structuredClone(d.dischargeSummary);
      let node = root;
      for (const k of path.slice(0, -1)) node = node[k] as DischargeNode;
      node[path[path.length - 1]] = value;
      return { ...d, dischargeSummary: root };
    });
  }

  function addObs() {
    setDraft(d => {
      if (!d) return d;
      const last = d.observations[d.observations.length - 1];
      const blank: DraftObservation = {
        date: null, time: null, doctorName: last?.doctorName ?? null, type: "ROUND",
        chiefComplaint: null, clinicalFindings: null, generalExamination: null, systemicExamination: null,
        diagnosis: last?.diagnosis ?? null, plan: null, advice: null, notes: null,
      };
      return { ...d, observations: [...d.observations, blank] };
    });
  }
  function addVital() {
    setDraft(d => {
      if (!d) return d;
      const blank: DraftVital = {
        recordedAt: null, recordedBy: null, bloodPressure: null, pulse: null, temperature: null, spo2: null,
        respiratoryRate: null, weight: null, height: null, bloodGlucose: null, drainage: null, aspiration: null,
        intake: null, output: null, remarks: null,
      };
      return { ...d, vitals: [...d.vitals, blank] };
    });
  }

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
      <button onClick={handleClose} disabled={stage === "processing"} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40">Cancel</button>
      <button onClick={readReport} disabled={!file || stage === "processing"}
        className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {stage === "processing" ? "Reading…" : "Read report"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Upload Case Sheet Report" size="xl" footer={footer}>
      {(stage === "pick" || stage === "processing") && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm text-slate-500 text-center max-w-md">
            Upload the scanned case sheet (PDF or image). The AI reads it and prepares observations, vitals and a discharge summary that you review and edit before anything is saved.
          </p>
          <label className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-[#00059f] text-[#00059f] bg-white hover:bg-blue-50 cursor-pointer transition-colors">
            {file ? "Choose a different file" : "Choose PDF / image"}
            <input type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" disabled={stage === "processing"}
              onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {file && <p className="text-sm text-slate-700">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          {stage === "processing" && (
            <p className="text-sm text-slate-500" aria-live="polite">Reading every page — this can take a few minutes for a long case sheet…</p>
          )}
        </div>
      )}

      {reviewing && draft && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-slate-200">
            {([
              ["observations", `Observations (${draft.observations.length})`],
              ["vitals", `Vitals (${draft.vitals.length})`],
              ["discharge", "Discharge Summary"],
            ] as [ReviewTab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setReviewTab(key)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${reviewTab === key ? "border-[#00059f] text-[#00059f]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>

          {reviewTab === "observations" && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {draft.observations.length === 0 && <p className="text-sm text-slate-500">No doctor&apos;s notes were found.</p>}
              {draft.observations.map((o, i) => (
                <div key={i} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-600">Observation {i + 1}</span>
                    <button onClick={() => setDraft(d => d && { ...d, observations: d.observations.filter((_, j) => j !== i) })}
                      className="text-xs font-medium text-red-600 hover:text-red-700">Remove</button>
                  </div>
                  <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Date"><input type="date" className={inputCls} value={o.date ?? ""} onChange={e => updateObs(i, { date: e.target.value || null })} /></Field>
                    <Field label="Time"><input type="time" className={inputCls} value={o.time ?? ""} onChange={e => updateObs(i, { time: e.target.value || null })} /></Field>
                    <Field label="Doctor"><VoiceField value={o.doctorName ?? ""} onChange={v => updateObs(i, { doctorName: v })}><input className={`${inputCls} pr-9`} value={o.doctorName ?? ""} onChange={e => updateObs(i, { doctorName: e.target.value })} /></VoiceField></Field>
                    <Field label="Type">
                      <select className={inputCls} value={o.type ?? "ROUND"} onChange={e => updateObs(i, { type: e.target.value })}>
                        {["ROUND", "CONSULTATION", "POST_OP", "EMERGENCY", "DISCHARGE_NOTE"].map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Chief complaint (C/o)"><VoiceField value={o.chiefComplaint ?? ""} onChange={v => updateObs(i, { chiefComplaint: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.chiefComplaint ?? ""} onChange={e => updateObs(i, { chiefComplaint: e.target.value })} /></VoiceField></Field>
                    <Field label="Diagnosis"><VoiceField value={o.diagnosis ?? ""} onChange={v => updateObs(i, { diagnosis: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.diagnosis ?? ""} onChange={e => updateObs(i, { diagnosis: e.target.value })} /></VoiceField></Field>
                    <Field label="General examination (O/E)"><VoiceField value={o.generalExamination ?? ""} onChange={v => updateObs(i, { generalExamination: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.generalExamination ?? ""} onChange={e => updateObs(i, { generalExamination: e.target.value })} /></VoiceField></Field>
                    <Field label="Systemic examination (S/E)"><VoiceField value={o.systemicExamination ?? ""} onChange={v => updateObs(i, { systemicExamination: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.systemicExamination ?? ""} onChange={e => updateObs(i, { systemicExamination: e.target.value })} /></VoiceField></Field>
                    <Field label="Plan"><VoiceField value={o.plan ?? ""} onChange={v => updateObs(i, { plan: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.plan ?? ""} onChange={e => updateObs(i, { plan: e.target.value })} /></VoiceField></Field>
                    <Field label="Advice"><VoiceField value={o.advice ?? ""} onChange={v => updateObs(i, { advice: v })}><textarea rows={3} className={`${textareaCls} pr-9`} value={o.advice ?? ""} onChange={e => updateObs(i, { advice: e.target.value })} /></VoiceField></Field>
                  </div>
                  </div>
                </div>
              ))}
              <button onClick={addObs}
                className="w-full py-2 text-sm font-semibold border border-dashed border-[#00059f] text-[#00059f] rounded-lg hover:bg-blue-50">
                + Add observation
              </button>
            </div>
          )}

          {reviewTab === "vitals" && (
            <div className="max-h-[60vh] overflow-auto">
              {draft.vitals.length === 0
                ? <p className="text-sm text-slate-500">No vitals rows were found.</p>
                : (
                  <table className="w-full min-w-[1180px] text-sm table-fixed border-separate border-spacing-0">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500 text-left sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-52">Date &amp; time</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-20">Pulse</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-28">BP</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-16">RR</th>
                        <th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-20">Temp °F</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-16">SpO2</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200 w-20">CBG</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200">Intake</th><th className="px-1.5 py-2 font-semibold border-b border-slate-200">Output</th><th className="w-10 border-b border-slate-200" />
                      </tr>
                    </thead>
                    <tbody>
                      {draft.vitals.map((v, i) => (
                        <tr key={i} className="odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/40">
                          <td className="px-1.5 py-1.5 align-middle"><input type="datetime-local" className={inputCls} value={v.recordedAt?.slice(0, 16) ?? ""} onChange={e => updateVital(i, { recordedAt: e.target.value || null })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><NumInput value={v.pulse} onChange={n => updateVital(i, { pulse: n })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><input className={inputCls} value={v.bloodPressure ?? ""} onChange={e => updateVital(i, { bloodPressure: e.target.value || null })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><NumInput value={v.respiratoryRate} onChange={n => updateVital(i, { respiratoryRate: n })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><NumInput value={v.temperature} onChange={n => updateVital(i, { temperature: n })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><NumInput value={v.spo2} onChange={n => updateVital(i, { spo2: n })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><NumInput value={v.bloodGlucose} onChange={n => updateVital(i, { bloodGlucose: n })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><input className={inputCls} title={v.intake ?? ""} value={v.intake ?? ""} onChange={e => updateVital(i, { intake: e.target.value || null })} /></td>
                          <td className="px-1.5 py-1.5 align-middle"><input className={inputCls} title={v.output ?? ""} value={v.output ?? ""} onChange={e => updateVital(i, { output: e.target.value || null })} /></td>
                          <td className="px-1.5 py-1.5 align-middle text-center">
                            <button onClick={() => setDraft(d => d && { ...d, vitals: d.vitals.filter((_, j) => j !== i) })}
                              className="text-xs text-red-600 hover:underline" aria-label="Remove row" title="Remove row">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              <button onClick={addVital}
                className="mt-2 w-full py-2 text-sm font-semibold border border-dashed border-[#00059f] text-[#00059f] rounded-lg hover:bg-blue-50">
                + Add vitals row
              </button>
            </div>
          )}

          {reviewTab === "discharge" && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {draft.dischargeSummary ? (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={includeDischarge} onChange={e => setIncludeDischarge(e.target.checked)} />
                    Save discharge summary (replaces the current one for this admission)
                  </label>
                  <DischargeEditor node={draft.dischargeSummary} path={[]} onChange={updateDischarge} />
                </>
              ) : <p className="text-sm text-slate-500">No discharge summary could be prepared.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <input type="text" inputMode="decimal" className={inputCls} value={value ?? ""}
      onChange={e => {
        const v = e.target.value.replace(/[^0-9.]/g, "");
        onChange(v === "" || isNaN(Number(v)) ? null : Number(v));
      }} />
  );
}

/** Short identity / date fields at the top of the summary — typed, not dictated. */
const HEADER_KEYS = new Set([
  "Patient Name", "IP No", "Age / Sex", "UHID", "Consultant", "Icu Consultant",
  "Date of Admission", "Time of Admission", "Date of Discharge", "Time of Discharge", "Drug Allergy",
]);

/** Grows with its content: one line when short, as tall as the text when long. */
function AutoGrowTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;   // +2 for the top/bottom border
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} onChange={e => onChange(e.target.value)}
      className={`${baseCls} py-2 pr-9 min-h-9 resize-none overflow-hidden leading-snug`} />
  );
}

function DischargeEditor({ node, path, onChange }: { node: DischargeNode; path: string[]; onChange: (path: string[], v: string) => void }) {
  return (
    <div className={path.length ? "pl-3 border-l-2 border-slate-100 space-y-2" : "space-y-3"}>
      {Object.entries(node).map(([key, val]) => typeof val === "string" ? (
        <Field key={key} label={key}>
          {path.length === 0 && HEADER_KEYS.has(key)
            ? <AutoGrowTextarea value={val} onChange={v => onChange([...path, key], v)} />
            : (
              <VoiceField value={val} onChange={v => onChange([...path, key], v)}>
                <AutoGrowTextarea value={val} onChange={v => onChange([...path, key], v)} />
              </VoiceField>
            )}
        </Field>
      ) : (
        <div key={key} className="space-y-2">
          <p className={`font-semibold ${path.length ? "text-xs text-slate-600" : "text-sm text-[#00059f]"}`}>{key}</p>
          <DischargeEditor node={val} path={[...path, key]} onChange={onChange} />
        </div>
      ))}
    </div>
  );
}
