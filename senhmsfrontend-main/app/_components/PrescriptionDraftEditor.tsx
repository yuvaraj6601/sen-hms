"use client";

import { FormField, Input, Select, Textarea } from "./Modal";
import {
  ROUTE_OPTIONS, TIMING_OPTIONS, emptyDraftItem, toRouteEnum, toTimingEnum,
  type DraftItem, type VoiceDraft,
} from "../_lib/voice-prescription";

interface Props {
  draft: VoiceDraft;
  /** Label for the source-text box: the voice transcript or the text read from a handwritten image. */
  sourceLabel: string;
  onChange: (next: VoiceDraft) => void;
}

/** Editable review form for an AI-generated prescription draft (voice or handwritten upload). */
export default function PrescriptionDraftEditor({ draft, sourceLabel, onChange }: Props) {
  function updateItem(idx: number, patch: Partial<DraftItem>) {
    onChange({ ...draft, items: draft.items.map((it, i) => i === idx ? { ...it, ...patch } : it) });
  }

  return (
    <>
      <FormField label={sourceLabel}>
        <Textarea rows={3} value={draft.transcript}
          onChange={e => onChange({ ...draft, transcript: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Diagnosis">
          <Input value={draft.diagnosis} onChange={e => onChange({ ...draft, diagnosis: e.target.value })} />
        </FormField>
        <FormField label="Notes / advice">
          <Input value={draft.notes} onChange={e => onChange({ ...draft, notes: e.target.value })} />
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
            <button type="button" onClick={() => onChange({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
              className="text-xs text-red-500 hover:text-red-700">Remove medicine</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...draft, items: [...draft.items, emptyDraftItem()] })}
          className="text-sm font-semibold text-[#00059f] hover:underline">+ Add medicine</button>
      </div>
    </>
  );
}
