import { describe, it, expect } from "vitest";
import {
  toRouteEnum,
  toTimingEnum,
  validateDraftItems,
  buildSavePayload,
  emptyDraftItem,
  type DraftItem,
  type VoiceDraft,
} from "../app/_lib/voice-prescription";

const item = (over: Partial<DraftItem> = {}): DraftItem => ({
  drugName: "Paracetamol", dosage: "500mg", frequency: "1-0-1",
  route: "ORAL", timing: "AFTER_FOOD", duration: "5 days", instructions: "",
  ...over,
});

const draft = (over: Partial<VoiceDraft> = {}): VoiceDraft => ({
  transcript: "tab paracetamol 500 twice daily",
  diagnosis: "Viral fever", notes: "", items: [item()],
  ...over,
});

describe("toRouteEnum", () => {
  it("maps display labels to backend enums", () => {
    expect(toRouteEnum("Oral")).toBe("ORAL");
    expect(toRouteEnum("IV")).toBe("IV");
    expect(toRouteEnum("Inhaled")).toBe("INHALATION");
  });
  it("falls back to OTHER for unknown and ORAL for empty", () => {
    expect(toRouteEnum("weird")).toBe("OTHER");
    expect(toRouteEnum("")).toBe("ORAL");
  });
  it("passes through valid enums unchanged", () => {
    expect(toRouteEnum("SUBLINGUAL")).toBe("SUBLINGUAL");
  });
});

describe("toTimingEnum", () => {
  it("maps known values and returns null for unknown or empty", () => {
    expect(toTimingEnum("AFTER_FOOD")).toBe("AFTER_FOOD");
    expect(toTimingEnum("after food")).toBe("AFTER_FOOD");
    expect(toTimingEnum("whenever")).toBeNull();
    expect(toTimingEnum("")).toBeNull();
  });
});

describe("validateDraftItems", () => {
  it("returns no errors for a complete item", () => {
    expect(validateDraftItems([item()])).toEqual([]);
  });
  it("rejects an empty list", () => {
    expect(validateDraftItems([])).toContain("Add at least one medicine");
  });
  it("flags rows missing drug name, dosage or frequency with the row number", () => {
    const errs = validateDraftItems([item(), item({ drugName: " " }), item({ dosage: "" }), item({ frequency: "" })]);
    expect(errs).toHaveLength(3);
    expect(errs[0]).toContain("Row 2");
    expect(errs[1]).toContain("Row 3");
    expect(errs[2]).toContain("Row 4");
  });
});

describe("emptyDraftItem", () => {
  it("returns a blank ORAL row", () => {
    expect(emptyDraftItem()).toMatchObject({ drugName: "", dosage: "", frequency: "", route: "ORAL" });
  });
});

describe("buildSavePayload", () => {
  const ctx = { patientId: 1, uhid: "UH001", admissionId: 5, doctorName: "Dr. Ravi" };

  it("builds a VOICE payload keeping the transcript", () => {
    const p = buildSavePayload(draft(), ctx, "VOICE");
    expect(p).toMatchObject({
      patientId: 1, uhid: "UH001", admissionId: 5, doctorName: "Dr. Ravi",
      source: "VOICE", voiceTranscript: "tab paracetamol 500 twice daily", diagnosis: "Viral fever",
    });
    expect(p.items).toHaveLength(1);
  });
  it("omits the transcript for MANUAL source", () => {
    expect(buildSavePayload(draft(), ctx, "MANUAL").voiceTranscript).toBeUndefined();
  });
  it("trims text fields and drops empty optional fields", () => {
    const p = buildSavePayload(draft({ items: [item({ drugName: "  Paracetamol ", duration: "  ", instructions: "" })] }), ctx, "VOICE");
    expect(p.items[0].drugName).toBe("Paracetamol");
    expect(p.items[0].duration).toBeUndefined();
    expect(p.items[0].instructions).toBeUndefined();
  });
  it("omits admissionId when there is none", () => {
    expect(buildSavePayload(draft(), { ...ctx, admissionId: undefined }, "VOICE").admissionId).toBeUndefined();
  });
  it("filters out fully blank rows", () => {
    const p = buildSavePayload(draft({ items: [item(), item({ drugName: "", dosage: "", frequency: "" })] }), ctx, "VOICE");
    expect(p.items).toHaveLength(1);
  });
});
