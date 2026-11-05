// Pure helpers for the voice-prescription flow (no React, no fetch) — unit tested in __tests__/.

export type RouteEnum =
  | "ORAL" | "IV" | "IM" | "SC" | "TOPICAL" | "INHALATION"
  | "SUBLINGUAL" | "RECTAL" | "NASAL" | "OTHER";

export type TimingEnum =
  | "BEFORE_FOOD" | "AFTER_FOOD" | "WITH_FOOD" | "EMPTY_STOMACH" | "AT_BEDTIME" | "AS_DIRECTED";

export type PrescriptionSource = "VOICE" | "MANUAL";

export interface DraftItem {
  drugName: string;
  dosage: string;
  frequency: string;
  route: RouteEnum;
  timing: TimingEnum | null;
  duration: string;
  instructions: string;
}

export interface VoiceDraft {
  transcript: string;
  diagnosis: string;
  notes: string;
  items: DraftItem[];
}

export interface SaveContext {
  patientId: number;
  uhid: string;
  admissionId?: number;
  doctorName: string;
}

export interface SaveItemPayload {
  drugName: string;
  dosage: string;
  frequency: string;
  route: RouteEnum;
  timing?: TimingEnum;
  duration?: string;
  instructions?: string;
}

export interface SavePayload {
  patientId: number;
  uhid: string;
  admissionId?: number;
  doctorName: string;
  diagnosis?: string;
  notes?: string;
  source: PrescriptionSource;
  voiceTranscript?: string;
  items: SaveItemPayload[];
}

export const ROUTE_OPTIONS: { value: RouteEnum; label: string }[] = [
  { value: "ORAL", label: "Oral" },
  { value: "IV", label: "IV" },
  { value: "IM", label: "IM" },
  { value: "SC", label: "SC" },
  { value: "TOPICAL", label: "Topical" },
  { value: "INHALATION", label: "Inhaled" },
  { value: "SUBLINGUAL", label: "Sublingual" },
  { value: "RECTAL", label: "Rectal" },
  { value: "NASAL", label: "Nasal" },
  { value: "OTHER", label: "Other" },
];

export const TIMING_OPTIONS: { value: TimingEnum; label: string }[] = [
  { value: "BEFORE_FOOD", label: "Before food" },
  { value: "AFTER_FOOD", label: "After food" },
  { value: "WITH_FOOD", label: "With food" },
  { value: "EMPTY_STOMACH", label: "Empty stomach" },
  { value: "AT_BEDTIME", label: "At bedtime" },
  { value: "AS_DIRECTED", label: "As directed" },
];

const ROUTE_ALIASES: Record<string, RouteEnum> = { INHALED: "INHALATION" };

export function toRouteEnum(value: string): RouteEnum {
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (!key) return "ORAL";
  if (ROUTE_ALIASES[key]) return ROUTE_ALIASES[key];
  const hit = ROUTE_OPTIONS.find(o => o.value === key);
  return hit ? hit.value : "OTHER";
}

export function toTimingEnum(value: string): TimingEnum | null {
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  const hit = TIMING_OPTIONS.find(o => o.value === key);
  return hit ? hit.value : null;
}

export function emptyDraftItem(): DraftItem {
  return { drugName: "", dosage: "", frequency: "", route: "ORAL", timing: null, duration: "", instructions: "" };
}

function isBlankRow(i: DraftItem): boolean {
  return !i.drugName.trim() && !i.dosage.trim() && !i.frequency.trim();
}

/** Returns human-readable errors; an empty array means the draft can be saved. */
export function validateDraftItems(items: DraftItem[]): string[] {
  if (items.length === 0) return ["Add at least one medicine"];
  const errors: string[] = [];
  items.forEach((i, idx) => {
    const missing: string[] = [];
    if (!i.drugName.trim()) missing.push("drug name");
    if (!i.dosage.trim()) missing.push("dosage");
    if (!i.frequency.trim()) missing.push("frequency");
    if (missing.length) errors.push(`Row ${idx + 1}: ${missing.join(", ")} required`);
  });
  return errors;
}

function opt(s: string): string | undefined {
  const t = s.trim();
  return t ? t : undefined;
}

export function buildSavePayload(draft: VoiceDraft, ctx: SaveContext, source: PrescriptionSource): SavePayload {
  return {
    patientId: ctx.patientId,
    uhid: ctx.uhid,
    admissionId: ctx.admissionId,
    doctorName: ctx.doctorName,
    diagnosis: opt(draft.diagnosis),
    notes: opt(draft.notes),
    source,
    voiceTranscript: source === "VOICE" ? opt(draft.transcript) : undefined,
    items: draft.items
      .filter(i => !isBlankRow(i))
      .map(i => ({
        drugName: i.drugName.trim(),
        dosage: i.dosage.trim(),
        frequency: i.frequency.trim(),
        route: i.route,
        timing: i.timing ?? undefined,
        duration: opt(i.duration),
        instructions: opt(i.instructions),
      })),
  };
}
