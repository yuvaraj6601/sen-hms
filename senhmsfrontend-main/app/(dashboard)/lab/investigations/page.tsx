"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { getSession } from "../../../_lib/auth";
import { printHtml, printHtmlDocs } from "../../../_lib/print";
import { HOSPITAL } from "../../../_lib/hospital-config";
import { buildLabEstimationSlipHtml } from "../../../_lib/lab-estimation-slip";
import { buildLabReportHtml, type LabReportData, type LabReportTest } from "../../../_lib/lab-report";
import { isAgeBanded, ageBandAbnormal, parseAgeBands, type AgeBand } from "../../../_lib/age-band";
import Badge from "../../../_components/Badge";
import TestSearchSelect from "../../../_components/TestSearchSelect";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";
import HScrollArea from "../../../_components/HScrollArea";

// ─── backend types ─────────────────────────────────────────────────────────────
interface LabInvestigationResponse {
  id: number;
  labId: string;
  orderGroupId: string | null;
  patientId: number;
  patientName: string;
  uhid: string;
  patientType: string;
  age: number | null;
  gender: string | null;
  doctorName: string;
  doctorId: number | null;
  admissionId: number | null;
  admissionNo: string | null;
  visitId: number | null;
  testCode: string;
  investigationName: string;
  category: string;
  sampleType: string | null;
  normalRange: string | null;
  unit: string | null;
  turnaroundTime: string | null;
  price: number;
  priority: string; // ROUTINE | URGENT | STAT
  orderedDate: string; // YYYY-MM-DD
  orderedTime: string;
  orderedBy: string;
  collectedDate: string | null;
  collectedTime: string | null;
  collectedBy: string | null;
  result: string | null;
  /** JSON array of saved per-parameter results (null for simple tests). */
  parameterResults: string | null;
  /** JSON array of the master's parameter template (null when none defined). */
  parametersTemplate: string | null;
  /** Result type from the lab master: NUMERIC | TEXT | POSITIVE_NEGATIVE | DROPDOWN | CULTURE_SENSITIVITY | PDF */
  resultType: string | null;
  abnormal: boolean;
  completedDate: string | null;
  completedTime: string | null;
  completedBy: string | null;
  actualTatMinutes: number | null;
  cancelReason: string | null;
  status: string; // PENDING | AWAITING_PAYMENT | PAID | IN_PROGRESS | COMPLETED | CANCELLED
  billedInBillId: number | null;
  /** Relative server path for the uploaded PDF report (resultType=PDF only). */
  reportPdfPath: string | null;
  /** JSON array of relative server paths for attached images. */
  reportImages: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Structured parameter result types ──────────────────────────────────────
// A single parameter template entry (mirrors the Lab Master `parameters` JSON).
interface ParamTemplate {
  group: string;
  subGroup: string;
  name: string;
  unit: string;
  normalRange: string;
  normalMin: number | "";
  normalMax: number | "";
  maleMin: number | "";
  maleMax: number | "";
  femaleMin: number | "";
  femaleMax: number | "";
  childMin: number | "";
  childMax: number | "";
  criticalLow: number | "";
  criticalHigh: number | "";
}

// A saved per-parameter result row (what we persist + print).
interface ParamResult {
  group: string;
  subGroup: string;
  name: string;
  unit: string;
  normalRange: string;
  value: string;
  abnormal: boolean;
}

function num(v: unknown): number | "" {
  return v === "" || v == null ? "" : Number(v);
}

function parseParamTemplate(raw: string | null): ParamTemplate[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p: Record<string, unknown>) => ({
      group: String(p.group ?? ""),
      subGroup: String(p.subGroup ?? ""),
      name: String(p.name ?? ""),
      unit: String(p.unit ?? ""),
      normalRange: String(p.normalRange ?? ""),
      normalMin: num(p.normalMin),
      normalMax: num(p.normalMax),
      maleMin: num(p.maleMin),
      maleMax: num(p.maleMax),
      femaleMin: num(p.femaleMin),
      femaleMax: num(p.femaleMax),
      childMin: num(p.childMin),
      childMax: num(p.childMax),
      criticalLow: num(p.criticalLow),
      criticalHigh: num(p.criticalHigh),
    }));
  } catch { return []; }
}

function parseParamResults(raw: string | null): ParamResult[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p: Record<string, unknown>) => ({
      group: String(p.group ?? ""),
      subGroup: String(p.subGroup ?? ""),
      name: String(p.name ?? ""),
      unit: String(p.unit ?? ""),
      normalRange: String(p.normalRange ?? ""),
      value: String(p.value ?? ""),
      abnormal: Boolean(p.abnormal),
    }));
  } catch { return []; }
}

/**
 * Expand a lab investigation into the report rows to print. Multi-parameter
 * tests (CBC, Coagulation Profile, etc.) become one row per parameter, carrying
 * group/subGroup so the renderer can print the Apollo-style grouped layout.
 * The investigation name is printed as the category heading. Simple tests
 * collapse to a single row using the flat `result`.
 */
function buildReportTests(t: LabInvestigationResponse): LabReportTest[] {
  const params = parseParamResults(t.parameterResults);
  if (params.length > 0) {
    return params.map(p => ({
      labId:             t.labId,
      investigationName: p.name,
      // Banding on the report (outer → inner):
      //   category = master test name (e.g. COMPLETE BLOOD COUNT) → top band
      //   testName = parameter group (e.g. HAEMATOLOGY)           → sub-band
      //   subGroup = optional mid-level (e.g. PROTHROMBIN TIME)
      category:          t.investigationName,
      testName:          p.group || null,
      subGroup:          p.subGroup || null,
      result:            p.value,
      unit:              p.unit || null,
      normalRange:       p.normalRange || null,
      abnormal:          p.abnormal,
    }));
  }
  return [{
    labId:             t.labId,
    investigationName: t.investigationName,
    category:          t.category,
    subGroup:          null,
    result:            t.result,
    unit:              t.unit,
    normalRange:       t.normalRange,
    abnormal:          t.abnormal,
  }];
}

/**
 * Pick the effective normal range for display. Prefers the explicit free-text
 * normalRange; otherwise builds "min - max" from the numeric bounds.
 */
function templateRangeText(t: ParamTemplate): string {
  if (t.normalRange) return t.normalRange;
  if (t.normalMin !== "" && t.normalMax !== "") return `${t.normalMin} - ${t.normalMax}`;
  if (t.normalMax !== "") return `< ${t.normalMax}`;
  if (t.normalMin !== "") return `> ${t.normalMin}`;
  return "";
}

/**
 * Decide whether a numeric value is abnormal for a parameter, using critical
 * bounds first, then the normal min/max. Non-numeric values are never flagged.
 */
function paramAbnormal(value: string, t: ParamTemplate): boolean {
  const v = parseFloat(value.replace(/[^0-9.\-]/g, ""));
  if (Number.isNaN(v)) return false;
  const lo = t.normalMin !== "" ? Number(t.normalMin) : null;
  const hi = t.normalMax !== "" ? Number(t.normalMax) : null;
  if (lo != null && v < lo) return true;
  if (hi != null && v > hi) return true;
  return false;
}

// Structured per-parameter result entry grid. Groups rows by group → sub-group
// to mirror the physical report layout (e.g. HAEMATOLOGY → PROTHROMBIN TIME).
function ParamResultGrid({
  template, values, onChange,
}: {
  template: ParamTemplate[];
  values: Record<number, string>;
  onChange: (index: number, value: string) => void;
}) {
  // Build an ordered render plan: group header, then sub-group header (if any),
  // then each parameter row — preserving the template's order.
  let lastGroup: string | null = null;
  let lastSub: string | null = null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_90px_140px] gap-2 bg-slate-100 px-3 py-2
        text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <span>Parameter</span><span>Result</span><span>Unit</span><span>Normal Range</span>
      </div>
      <div className="divide-y divide-slate-100">
        {template.map((row, i) => {
          const blocks: React.ReactNode[] = [];
          const g = (row.group || "").trim();
          const s = (row.subGroup || "").trim();
          if (g && g !== lastGroup) {
            lastGroup = g; lastSub = null;
            blocks.push(
              <div key={`g-${i}`} className="bg-slate-50 px-3 py-1.5 text-xs font-bold
                text-slate-600 uppercase tracking-wide">{g}</div>
            );
          }
          if (s && s !== lastSub) {
            lastSub = s;
            blocks.push(
              <div key={`s-${i}`} className="bg-white px-3 py-1 pl-5 text-xs font-semibold
                text-slate-500 uppercase">{s}</div>
            );
          } else if (!s) {
            lastSub = null;
          }
          const val = values[i] ?? "";
          const abn = paramAbnormal(val, row);
          blocks.push(
            <div key={`r-${i}`}
              className={`grid grid-cols-[1fr_120px_90px_140px] gap-2 px-3 py-1.5 items-start
                ${s ? "pl-5" : ""}`}>
              <span className="text-sm text-slate-700 pt-1.5">{row.name}</span>
              <textarea
                value={val}
                rows={1}
                ref={el => {
                  // size to content on mount/edit (pre-filled multi-line results)
                  if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
                }}
                onChange={e => {
                  onChange(i, e.target.value);
                  // auto-grow to fit content (for multi-line narrative results)
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder="—"
                className={`px-2 py-1 text-sm rounded border w-full resize-none overflow-hidden
                  leading-snug focus:outline-none focus:ring-1
                  ${abn ? "border-red-300 bg-red-50 text-red-700 focus:ring-red-300"
                        : "border-slate-200 bg-white focus:ring-emerald-400"}`}
              />
              <span className="text-xs text-slate-400 pt-1.5">{row.unit || "—"}</span>
              <span className="text-xs text-slate-500 pt-1.5">{templateRangeText(row) || "—"}</span>
            </div>
          );
          return <Fragment key={i}>{blocks}</Fragment>;
        })}
      </div>
    </div>
  );
}

// A group of tests ordered together (shared orderGroupId), derived client-side.
interface OrderGroup {
  orderGroupId: string;
  patientName: string;
  uhid: string;
  patientType: string;
  doctorName: string;
  orderedDate: string;
  orderedTime: string;
  orderedBy: string;
  tests: LabInvestigationResponse[];
  estimatedTotal: number;
  billedInBillId: number | null;
  groupStatus: string;
}

interface PatientSummary {
  id: number;
  name: string;
  uhid: string;
  phone: string;
  patientType: string;
  doctorName: string | null;
  age: number | null;
}

interface LabMaster {
  id: number;
  testCode: string;
  name: string;
  category: string;
  price: number;
  sampleType?: string;
  normalRange?: string;
  unit?: string;
  turnaroundTime?: string;
  status: string;
}

// ─── constants ────────────────────────────────────────────────────────────────
const STATUS_DISPLAY: Record<string, string> = {
  PENDING:          "Pending Estimate",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID:             "Paid",
  IN_PROGRESS:      "In Progress",
  COMPLETED:        "Completed",
  CANCELLED:        "Cancelled",
  MIXED:            "Mixed",
};

const PRIORITY_DISPLAY: Record<string, string> = {
  ROUTINE: "Routine",
  URGENT:  "Urgent",
  STAT:    "STAT",
};

const STATUS_COLORS: Record<string, "yellow" | "sky" | "green" | "red" | "orange" | "purple"> = {
  PENDING:          "yellow",
  AWAITING_PAYMENT: "orange",
  PAID:             "purple",
  IN_PROGRESS:      "sky",
  COMPLETED:        "green",
  CANCELLED:        "red",
  MIXED:            "yellow",
};

const PRIORITY_COLORS: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-600",
  URGENT:  "bg-orange-100 text-orange-700",
  STAT:    "bg-red-100 text-red-700",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function inr(n: number) { return "\u20B9" + n.toLocaleString("en-IN"); }
// Local calendar date (YYYY-MM-DD). Must NOT use toISOString(), which returns
// the UTC date — between 00:00–05:30 IST that is still the *previous* day, so
// orderedDate would disagree with the local orderedTime and inflate lab TAT by
// ~24h. Building from local getFullYear/Month/Date keeps date + time on the
// same clock.
function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LabInvestigationsPage() {
  const session   = getSession();
  const role      = session?.role ?? "Lab Tech";
  const userName  = session?.name ?? "System";
  const isLabTech = role === "Lab Tech" || role === "Admin" || role === "Managing Director"
    || role === "Lab/Ins/Reception" || role === "Receptionist";
  const isDoctor  = role === "Doctor";

  const [tests,     setTests]     = useState<LabInvestigationResponse[]>([]);
  const [labMaster, setLabMaster] = useState<LabMaster[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // patient search for order modal
  const [patients,      setPatients]      = useState<PatientSummary[]>([]);
  const [ptSearching,   setPtSearching]   = useState(false);
  const ptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // filters
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [prioFilter,   setPrioFilter]   = useState("");
  const [catFilter,    setCatFilter]    = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // new order modal
  const [orderOpen,   setOrderOpen]   = useState(false);
  const [ptQuery,     setPtQuery]     = useState("");
  const [ptDropOpen,  setPtDropOpen]  = useState(false);
  const [selPatient,  setSelPatient]  = useState<PatientSummary | null>(null);
  const [orderLines,  setOrderLines]  = useState<{
    id: number; testCode: string; name: string; category: string; price: number;
    normalRange?: string; unit?: string; sampleType?: string; turnaroundTime?: string;
    priority: string;
  }[]>([]);

  // result modal
  const [resultTarget, setResultTarget] = useState<LabInvestigationResponse | null>(null);
  const [resultValue,  setResultValue]  = useState("");
  const [resultErr,    setResultErr]    = useState("");
  // Structured per-parameter entry: the master template + a value per parameter
  // (keyed by row index). Empty template → fall back to the single Result Value.
  const [paramTemplate, setParamTemplate] = useState<ParamTemplate[]>([]);
  const [paramValues,   setParamValues]   = useState<Record<number, string>>({});

  // ── C&S antibiogram state ──────────────────────────────────────────────────
  const [csOrganism,    setCsOrganism]    = useState("");
  const [csColonyCount, setCsColonyCount] = useState("");
  const [csGramStain,   setCsGramStain]   = useState("");
  const [csAntibiotics, setCsAntibiotics] = useState<{ name: string; sensitivity: "S" | "I" | "R" | "" }[]>([]);
  const [csComment,     setCsComment]     = useState("");

  // ── Bulk selection (checkboxes on child tests, revealed on first selection) ──
  const [selectedTests, setSelectedTests] = useState<Set<number>>(new Set());
  const selectionActive = selectedTests.size > 0;
  const [bulkBusy, setBulkBusy] = useState(false);
  // Worksheet-style bulk result modal: list of IN_PROGRESS tests + a value per test.
  const [worksheet, setWorksheet] = useState<LabInvestigationResponse[] | null>(null);
  const [worksheetValues, setWorksheetValues] = useState<Record<number, string>>({});
  const [worksheetErr, setWorksheetErr] = useState("");

  // cancel modal
  const [cancelTarget, setCancelTarget] = useState<LabInvestigationResponse | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr,    setCancelErr]    = useState("");

  // ── PDF / Image upload modal (resultType = PDF tests) ─────────────────────
  const [uploadTarget,   setUploadTarget]   = useState<LabInvestigationResponse | null>(null);
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploadType,     setUploadType]     = useState<"pdf" | "image">("pdf");
  const [uploadBusy,     setUploadBusy]     = useState(false);
  const [uploadErr,      setUploadErr]      = useState("");
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // ── Image lightbox ─────────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);

  // grouped view: expand + estimation
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [estimatingGroup, setEstimatingGroup] = useState<string | null>(null);
  function toggleGroup(id: string) { setExpandedGroup(prev => prev === id ? null : id); }

  // ── letterhead print mode ──
  // When on, the code-drawn report header is hidden and 5.5cm is left blank at
  // the top for pre-printed letterhead paper. Persisted across sessions.
  const [letterheadMode, setLetterheadMode] = useState(false);
  useEffect(() => {
    try {
      setLetterheadMode(localStorage.getItem("labReportLetterheadMode") === "1");
    } catch { /* ignore */ }
  }, []);
  function toggleLetterhead(on: boolean) {
    setLetterheadMode(on);
    try { localStorage.setItem("labReportLetterheadMode", on ? "1" : "0"); } catch { /* ignore */ }
  }

  // ── Build a completed lab result report (shared by single + bulk print) ─────
  // Formats "YYYY-MM-DD" + "HH:mm" into "DD-MM-YYYY h:mmAM/PM" to match the
  // physical SEN Hospital lab report.
  function fmtDateTime(date: string | null, time: string | null): string | null {
    if (!date) return null;
    const [y, m, dd] = date.split("-");
    const datePart = (dd && m && y) ? `${dd}-${m}-${y}` : date;
    if (!time) return datePart;
    const [hh, mm] = time.split(":").map(Number);
    if (Number.isNaN(hh)) return datePart;
    const ampm = hh >= 12 ? "PM" : "AM";
    return `${datePart} ${hh % 12 || 12}:${String(mm).padStart(2, "0")}${ampm}`;
  }

  // Build ONE report document for a SINGLE test — each lab test has its own
  // report (matching how the lab issues one report sheet per investigation).
  // Age/gender/IP number come enriched on the lab response from the backend.
  function buildSingleTestReportHtml(t: LabInvestigationResponse): string {
    const data: LabReportData = {
      uhid:            t.uhid,
      patientName:     t.patientName,
      age:             t.age,
      gender:          t.gender,
      doctorName:      t.doctorName,
      labTestId:       t.labId,
      ipNumber:        t.admissionNo ?? "—",
      sampleCollected: fmtDateTime(t.collectedDate, t.collectedTime),
      reportCompleted: fmtDateTime(t.completedDate, t.completedTime),
      tests: buildReportTests(t),
      labIncharge:     HOSPITAL.labSignatories.labIncharge,
      labTechnician:   t.completedBy || HOSPITAL.labSignatories.labTechnician,
      medicalDirector: HOSPITAL.labSignatories.medicalDirector,
      letterheadMode,
    };
    return buildLabReportHtml(data);
  }

  // Single-result print (per-row action) — one report for this one test.
  function printLabResult(t: LabInvestigationResponse) {
    printHtml(buildSingleTestReportHtml(t));
  }

  // ── load investigations ──
  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "0", size: "500" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      if (isDoctor && session?.doctorId) params.set("doctorId", String(session.doctorId));
      const { ok, data, error: err } = await apiFetch(`/api/lab/investigations?${params}`);
      if (!ok) throw new Error(err);
      // backend may return paged or array
      const list: LabInvestigationResponse[] = Array.isArray(data) ? data : (data?.content ?? []);
      setTests(list);
    } catch (e: any) {
      setError(e.message ?? "Failed to load investigations");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, isDoctor, session?.doctorId]);

  // ── load lab master ──
  const loadLabMaster = useCallback(async () => {
    const { ok, data } = await apiFetch("/api/masters/lab-masters?page=0&size=500");
    if (ok) {
      const list: LabMaster[] = Array.isArray(data) ? data : (data?.content ?? []);
      setLabMaster(list.filter(l => l.status === "ACTIVE" || l.status === "Active"));
    }
  }, []);

  useEffect(() => {
    loadInvestigations();
    loadLabMaster();
  }, [loadInvestigations, loadLabMaster]);

  // ── patient search (debounced) ──
  function handlePtQueryChange(q: string) {
    setPtQuery(q);
    setPtDropOpen(true);
    if (!q) { setSelPatient(null); setPatients([]); return; }
    if (ptDebounceRef.current) clearTimeout(ptDebounceRef.current);
    ptDebounceRef.current = setTimeout(async () => {
      if (q.length < 2) return;
      setPtSearching(true);
      const { ok, data } = await apiFetch(
        `/api/patients?search=${encodeURIComponent(q)}&page=0&size=10`
      );
      if (ok) {
        const list: PatientSummary[] = Array.isArray(data) ? data : (data?.content ?? []);
        setPatients(list);
      }
      setPtSearching(false);
    }, 300);
  }

  function selectPatient(p: PatientSummary) {
    setSelPatient(p);
    setPtQuery(p.name + " — " + p.uhid);
    setPtDropOpen(false);
    }

  // ── place order ──
  async function handleOrder() {
    if (!selPatient || orderLines.length === 0) return;
    const now = new Date();
    const body = {
      patientId:   selPatient.id,
      uhid:        selPatient.uhid,
      patientName: selPatient.name,
      patientType: selPatient.patientType === "IP" ? "IP" : "OP",
      doctorName:  selPatient.doctorName ?? "",
      doctorId:    null,
      orderedDate: today(),
      orderedTime: now.toTimeString().slice(0, 5),
      orderedBy:   userName,
      tests: orderLines.map(t => ({
        testCode:          t.testCode,
        investigationName: t.name,
        category:          t.category,
        sampleType:        t.sampleType ?? null,
        normalRange:       t.normalRange ?? null,
        unit:              t.unit ?? null,
        turnaroundTime:    t.turnaroundTime ?? null,
        price:             t.price,
        priority:          t.priority,
      })),
    };
    const { ok, error: err } = await apiFetch("/api/lab/investigations", {
      method: "POST",
      body:   JSON.stringify(body),
    });
    if (!ok) { alert(err); return; }
    await loadInvestigations();
    setOrderOpen(false);
    setSelPatient(null);
    setPtQuery("");
    setOrderLines([]);
  }

  // ── collect sample ──
  async function handleCollect(t: LabInvestigationResponse) {
    const { ok, error: err } = await apiFetch(
      `/api/lab/investigations/${t.id}/collect`,
      { method: "PATCH", body: JSON.stringify({ collectedBy: userName }) }
    );
    if (!ok) { alert(err); return; }
    await loadInvestigations();
  }

  // ── enter result ──
  function openResult(t: LabInvestigationResponse) {
    setResultTarget(t);
    setResultValue(t.result ?? "");
    setResultErr("");

    const template = parseParamTemplate(t.parametersTemplate);
    setParamTemplate(template);
    // Seed values from any previously-saved parameter results, matched by name.
    const saved = parseParamResults(t.parameterResults);
    const seeded: Record<number, string> = {};
    template.forEach((row, i) => {
      const prev = saved.find(s => s.name === row.name && s.subGroup === row.subGroup);
      seeded[i] = prev?.value ?? "";
    });
    setParamValues(seeded);

    // ── Seed C&S state ────────────────────────────────────────────────────────
    if (t.resultType === "CULTURE_SENSITIVITY") {
      // If a result was previously saved, parse it back into the form fields.
      let parsed: { organism?: string; colonyCount?: string; gramStain?: string;
        antibiotics?: { name: string; sensitivity: string }[]; comment?: string } = {};
      try { if (t.result) parsed = JSON.parse(t.result); } catch { /* ignore */ }

      setCsOrganism(parsed.organism ?? "");
      setCsColonyCount(parsed.colonyCount ?? "");
      setCsGramStain(parsed.gramStain ?? "");
      setCsComment(parsed.comment ?? "");

      // Antibiotic list: prefer previously saved results, else seed from parameter
      // template rows (each parameter name = one antibiotic in the C&S master setup).
      if (parsed.antibiotics && parsed.antibiotics.length > 0) {
        setCsAntibiotics(parsed.antibiotics.map(a => ({
          name: a.name,
          sensitivity: (["S", "I", "R"].includes(a.sensitivity) ? a.sensitivity : "") as "S" | "I" | "R" | "",
        })));
      } else if (template.length > 0) {
        setCsAntibiotics(template.map(row => ({ name: row.name, sensitivity: "" as const })));
      } else {
        // No template — start with a few blank rows the tech can fill in.
        setCsAntibiotics([
          { name: "", sensitivity: "" },
          { name: "", sensitivity: "" },
          { name: "", sensitivity: "" },
        ]);
      }
    } else {
      setCsOrganism(""); setCsColonyCount(""); setCsGramStain("");
      setCsAntibiotics([]); setCsComment("");
    }
  }

  async function handleComplete() {
    if (!resultTarget) return;

    // ── C&S path ─────────────────────────────────────────────────────────────
    if (resultTarget.resultType === "CULTURE_SENSITIVITY") {
      if (!csOrganism.trim() && csAntibiotics.every(a => !a.sensitivity)) {
        setResultErr("Enter at least an organism name or one antibiotic result");
        return;
      }
      const csJson = JSON.stringify({
        organism:    csOrganism.trim(),
        colonyCount: csColonyCount.trim(),
        gramStain:   csGramStain.trim(),
        antibiotics: csAntibiotics
          .filter(a => a.name.trim())
          .map(a => ({ name: a.name.trim(), sensitivity: a.sensitivity || "—" })),
        comment: csComment.trim(),
      });
      const { ok, error: err } = await apiFetch(
        `/api/lab/investigations/${resultTarget.id}/result`,
        { method: "PATCH", body: JSON.stringify({ result: csJson, completedBy: userName }) }
      );
      if (!ok) { setResultErr(err); return; }
      await loadInvestigations();
      setResultTarget(null);
      return;
    }

    const hasTemplate = paramTemplate.length > 0;
    let body: Record<string, unknown>;

    if (hasTemplate) {
      // Save EVERY template row — including blank ones — so the printed report
      // shows the full panel (e.g. Sugar F/PP/R all listed even if only one is
      // filled), matching the physical lab report layout. We still require at
      // least one value to be entered before completing.
      const results: ParamResult[] = paramTemplate.map((row, i) => {
        const value = (paramValues[i] ?? "").trim();
        return {
          group: row.group,
          subGroup: row.subGroup,
          name: row.name,
          unit: row.unit,
          normalRange: templateRangeText(row),
          value,
          abnormal: value !== "" && paramAbnormal(value, row),
        };
      });
      if (results.every(r => r.value === "")) {
        setResultErr("Enter at least one parameter result");
        return;
      }
      body = { parameterResults: JSON.stringify(results), completedBy: userName };
    } else {
      if (!resultValue.trim()) { setResultErr("Result value is required"); return; }
      // Detect abnormal: for age-banded tests use the patient's age + band thresholds;
      // for plain numeric ranges, a simple parse suffices. Falls back to false when
      // the range is non-numeric (NEGATIVE, culture text, etc.)
      let abnormal = false;
      const nr = resultTarget.normalRange ?? "";
      if (isAgeBanded(nr)) {
        abnormal = ageBandAbnormal(resultValue.trim(), nr, resultTarget.age) === true;
      } else {
        // Simple numeric check against normalRange free text ("70-110", "< 115", etc.)
        const numVal = parseFloat(resultValue.replace(/[^0-9.\-]/g, ""));
        if (!Number.isNaN(numVal)) {
          const ltMatch = nr.match(/^<=?\s*([\d.]+)/);
          const gtMatch = nr.match(/^>=?\s*([\d.]+)/);
          const rangeMatch = nr.match(/^([\d.]+)\s*[-–]\s*([\d.]+)/);
          if (ltMatch)    abnormal = numVal >= parseFloat(ltMatch[1]);
          else if (gtMatch)  abnormal = numVal <= parseFloat(gtMatch[1]);
          else if (rangeMatch) {
            abnormal = numVal < parseFloat(rangeMatch[1]) || numVal > parseFloat(rangeMatch[2]);
          }
        }
      }
      body = { result: resultValue.trim(), abnormal, completedBy: userName };
    }

    const { ok, error: err } = await apiFetch(
      `/api/lab/investigations/${resultTarget.id}/result`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    if (!ok) { setResultErr(err); return; }
    await loadInvestigations();
    setResultTarget(null);
  }

  // ── Bulk selection helpers ──────────────────────────────────────────────────
  function toggleTest(id: number) {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  // Per-group select-all over the tests that can be acted on (not cancelled).
  function groupSelectableIds(g: OrderGroup) {
    return g.tests.filter(t => t.status !== "CANCELLED").map(t => t.id);
  }
  function toggleGroupSelect(g: OrderGroup) {
    const ids = groupSelectableIds(g);
    setSelectedTests(prev => {
      const next = new Set(prev);
      const allSel = ids.length > 0 && ids.every(id => next.has(id));
      if (allSel) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }
  function isGroupAllSelected(g: OrderGroup) {
    const ids = groupSelectableIds(g);
    return ids.length > 0 && ids.every(id => selectedTests.has(id));
  }
  function clearSelection() { setSelectedTests(new Set()); }

  // The selected test objects (across all groups), resolved from the flat list.
  const selectedTestObjs = useMemo(
    () => tests.filter(t => selectedTests.has(t.id)),
    [tests, selectedTests],
  );

  // ── Bulk Collect: PAID → IN_PROGRESS for every selected PAID test ────────────
  async function handleBulkCollect() {
    // OP must be PAID; IP may be collected once the estimation bill is raised
    // (AWAITING_PAYMENT) since they settle at reception on release.
    const targets = selectedTestObjs.filter(t => t.status === "PAID"
      || (t.patientType?.toUpperCase() === "IP" && t.status === "AWAITING_PAYMENT"));
    if (targets.length === 0) { alert("None of the selected tests are ready to collect (OP must be Paid; IP needs an estimation generated)."); return; }
    setBulkBusy(true);
    try {
      for (const t of targets) {
        await apiFetch(`/api/lab/investigations/${t.id}/collect`,
          { method: "PATCH", body: JSON.stringify({ collectedBy: userName }) });
      }
      await loadInvestigations();
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  }

  // ── Bulk Print: combine COMPLETED selected tests into one print document ─────
  function handleBulkPrint() {
    const targets = selectedTestObjs.filter(t => t.status === "COMPLETED");
    if (targets.length === 0) { alert("None of the selected tests have a completed result to print."); return; }
    // Each test is its own report, but they print as ONE job: a single Save/Print
    // dialog, with each report on its own page (page-break between them). Scroll
    // in the preview shows report after report; the printer prints them in order.
    printHtmlDocs(targets.map(t => buildSingleTestReportHtml(t)));
  }

  // ── Bulk Result: open worksheet modal for selected IN_PROGRESS tests ─────────
  function openWorksheet() {
    const targets = selectedTestObjs.filter(t => t.status === "IN_PROGRESS");
    if (targets.length === 0) { alert("None of the selected tests are ready for results (must be collected / In Progress)."); return; }
    setWorksheet(targets);
    setWorksheetValues(Object.fromEntries(targets.map(t => [t.id, ""])));
    setWorksheetErr("");
  }
  async function handleSaveWorksheet() {
    if (!worksheet) return;
    const filled = worksheet.filter(t => (worksheetValues[t.id] ?? "").trim() !== "");
    if (filled.length === 0) { setWorksheetErr("Enter at least one result value."); return; }
    setBulkBusy(true);
    try {
      const savedIds: number[] = [];
      const failed: string[] = [];
      for (const t of filled) {
        const { ok, error: err } = await apiFetch(`/api/lab/investigations/${t.id}/result`,
          { method: "PATCH", body: JSON.stringify({ result: worksheetValues[t.id].trim(), completedBy: userName }) });
        if (ok) savedIds.push(t.id);
        else failed.push(`${t.labId}: ${err ?? "failed"}`);
      }
      await loadInvestigations();
      // Deselect only the tests that saved successfully; keep failed ones selected
      // (and the modal open) so the user can retry them.
      setSelectedTests(prev => {
        const next = new Set(prev);
        savedIds.forEach(id => next.delete(id));
        return next;
      });
      if (failed.length > 0) {
        setWorksheetErr(`Some results failed to save:\n${failed.join("\n")}`);
        // Drop the saved rows from the worksheet; leave failures for retry.
        setWorksheet(w => (w ? w.filter(t => !savedIds.includes(t.id)) : w));
        setWorksheetValues(v => {
          const next = { ...v };
          savedIds.forEach(id => delete next[id]);
          return next;
        });
      } else {
        closeWorksheet();
      }
    } finally {
      setBulkBusy(false);
    }
  }
  // Reset all worksheet modal state (used by Save success and Cancel).
  function closeWorksheet() {
    setWorksheet(null);
    setWorksheetValues({});
    setWorksheetErr("");
  }

  // ── open upload modal ────────────────────────────────────────────────────────
  function openUpload(t: LabInvestigationResponse, type: "pdf" | "image") {
    setUploadTarget(t);
    setUploadType(type);
    setUploadFile(null);
    setUploadErr("");
    // reset file input
    setTimeout(() => { if (uploadFileRef.current) uploadFileRef.current.value = ""; }, 0);
  }

  async function handleUpload() {
    if (!uploadTarget || !uploadFile) { setUploadErr("Please select a file"); return; }
    setUploadBusy(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("type", uploadType);
      fd.append("completedBy", userName);
      const res  = await fetch(`/api/lab/investigations/${uploadTarget.id}/upload`, {
        method: "POST",
        body: fd,
        // Do NOT set Content-Type — browser sets it with the correct multipart boundary
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setUploadErr(json.error ?? "Upload failed");
        return;
      }
      await loadInvestigations();
      setUploadTarget(null);
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  // Helper: parse image JSON array from the response field
  function parseImagePaths(raw: string | null): string[] {
    if (!raw) return [];
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
  }

  // Build a full URL for a stored lab file (served by the proxy → Spring Boot)
  function labFileUrl(relativePath: string): string {
    // relativePath = "lab-reports/<filename>"
    const filename = relativePath.split("/").pop() ?? relativePath;
    return `/api/lab/investigations/files/${filename}`;
  }

  // ── cancel ──
  function openCancel(t: LabInvestigationResponse) {
    setCancelTarget(t);
    setCancelReason("");
    setCancelErr("");
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { setCancelErr("Reason is required"); return; }
    const { ok, error: err } = await apiFetch(
      `/api/lab/investigations/${cancelTarget.id}/cancel`,
      { method: "PATCH", body: JSON.stringify({ reason: cancelReason }) }
    );
    if (!ok) { setCancelErr(err); return; }
    await loadInvestigations();
    setCancelTarget(null);
  }

  // ── generate estimation (creates the bill, flips group to AWAITING_PAYMENT) ──
  async function handleGenerateEstimation(group: OrderGroup) {
    setEstimatingGroup(group.orderGroupId);
    const { ok, data, error: err } = await apiFetch(
      `/api/lab/investigations/orders/${encodeURIComponent(group.orderGroupId)}/estimate`,
      { method: "POST", body: JSON.stringify({ generatedBy: userName }) }
    );
    setEstimatingGroup(null);
    if (!ok) { alert(err); return; }

    // Print the estimation slip (OP-receipt style) from the returned group.
    const g = data as {
      billNo: string | null;
      uhid: string;
      patientName: string;
      patientType: string | null;
      age: number | null;
      gender: string | null;
      phone: string | null;
      doctorName: string | null;
      admissionId: number | null;
      admissionNo: string | null;
      orderedDate: string;
      orderedTime: string | null;
      tests: {
        labId: string; testCode: string; investigationName: string;
        category: string | null; price: number | null;
      }[];
    } | null;
    if (g && Array.isArray(g.tests)) {
      try {
        const html = buildLabEstimationSlipHtml({
          billNo:      g.billNo,
          uhid:        g.uhid,
          patientName: g.patientName,
          patientType: g.patientType,
          age:         g.age,
          gender:      g.gender,
          phone:       g.phone,
          doctorName:  g.doctorName,
          admissionId: g.admissionId,
          admissionNo: g.admissionNo,
          orderedDate: g.orderedDate,
          orderedTime: g.orderedTime,
          generatedBy: userName,
          tests: g.tests.map(t => ({
            labId:             t.labId,
            testCode:          t.testCode,
            investigationName: t.investigationName,
            category:          t.category,
            price:             t.price,
          })),
        });
        printHtml(html);
      } catch { /* printing is best-effort — ignore slip errors */ }
    }

    await loadInvestigations();
  }

  function clearFilters() {
    setSearch(""); setStatusFilter(""); setPrioFilter("");
    setCatFilter(""); setDateFrom(""); setDateTo("");
  }
  const anyFilter = !!(search || statusFilter || prioFilter || catFilter || dateFrom || dateTo);

  // ── client-side filtering ──
  const base = useMemo(() => tests, [tests]);

  const filtered = useMemo(() => {
    return base
      .filter(t => {
        const q = search.toLowerCase();
        const ms = !q ||
          t.labId.toLowerCase().includes(q) ||
          t.patientName.toLowerCase().includes(q) ||
          t.uhid.toLowerCase().includes(q) ||
          t.investigationName.toLowerCase().includes(q);
        const mst = !statusFilter || t.status   === statusFilter;
        const mp  = !prioFilter   || t.priority === prioFilter;
        const mc  = !catFilter    || t.category === catFilter;
        const mdf = !dateFrom     || t.orderedDate >= dateFrom;
        const mdt = !dateTo       || t.orderedDate <= dateTo;
        return ms && mst && mp && mc && mdf && mdt;
      })
      .sort((a, b) => {
        const prio: Record<string, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };
        const pd = (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3);
        if (pd !== 0) return pd;
        return b.orderedDate.localeCompare(a.orderedDate);
      });
  }, [base, search, statusFilter, prioFilter, catFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    base.forEach(t => { m[t.status] = (m[t.status] ?? 0) + 1; });
    return m;
  }, [base]);

  // ── group the filtered tests into orders (shared orderGroupId) ──
  const groups = useMemo<OrderGroup[]>(() => {
    const map = new Map<string, LabInvestigationResponse[]>();
    for (const t of filtered) {
      const key = t.orderGroupId ?? `lab-${t.id}`;
      const arr = map.get(key);
      if (arr) arr.push(t); else map.set(key, [t]);
    }
    const rollup = (tests: LabInvestigationResponse[]): string => {
      const active = [...new Set(tests.filter(t => t.status !== "CANCELLED").map(t => t.status))];
      if (active.length === 0) return "CANCELLED";
      if (active.length === 1) return active[0];
      for (const s of ["PENDING", "AWAITING_PAYMENT", "PAID", "IN_PROGRESS", "COMPLETED"]) {
        if (active.includes(s)) return s;
      }
      return "MIXED";
    };
    return [...map.entries()].map(([orderGroupId, tests]) => {
      const first = tests[0];
      return {
        orderGroupId,
        patientName: first.patientName,
        uhid:        first.uhid,
        patientType: first.patientType,
        doctorName:  first.doctorName,
        orderedDate: first.orderedDate,
        orderedTime: first.orderedTime,
        orderedBy:   first.orderedBy,
        tests,
        estimatedTotal: tests.reduce((s, t) => s + (t.price ?? 0), 0),
        billedInBillId: tests.map(t => t.billedInBillId).find(b => b != null) ?? null,
        groupStatus: rollup(tests),
      };
    });
  }, [filtered]);

  const categories = useMemo(() => [...new Set(tests.map(t => t.category))], [tests]);

  const STATUS_TABS = ["All", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  return (
    <div>
      <PageHeader
        title="Lab Investigations"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Lab" }, { label: "Investigations" }]}
        action={isLabTech ? { label: "New Order", onClick: () => setOrderOpen(true) } : undefined}
      />

      {/* error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200
          text-red-700 text-sm px-4 py-3 rounded-xl">
          <span>{error}</span>
          <button onClick={loadInvestigations}
            className="text-xs font-semibold underline ml-4">Retry</button>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SC label="Total"       value={String(base.length)}                      color="text-slate-900"/>
        <SC label="Pending"     value={String(statusCounts["PENDING"] ?? 0)}     color="text-amber-600"/>
        <SC label="In Progress" value={String(statusCounts["IN_PROGRESS"] ?? 0)} color="text-sky-600"/>
        <SC label="Completed"   value={String(statusCounts["COMPLETED"] ?? 0)}   color="text-emerald-600"/>
      </div>

      {/* status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => {
          const active = t === "All" ? statusFilter === "" : statusFilter === t;
          return (
            <button key={t} onClick={() => setStatusFilter(t === "All" ? "" : t)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-medium whitespace-nowrap transition-colors border
                ${active ? "bg-sky-500 text-white border-sky-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
              {STATUS_DISPLAY[t] ?? t}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t === "All" ? base.length : (statusCounts[t] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Lab ID, patient, UHID, test name…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <DF value={prioFilter} onChange={setPrioFilter} options={[
          { value: "",        label: "All Priority" },
          { value: "STAT",    label: "🔴 STAT" },
          { value: "URGENT",  label: "🟠 Urgent" },
          { value: "ROUTINE", label: "🟢 Routine" },
        ]}/>
        <DF value={catFilter} onChange={setCatFilter} options={[
          { value: "", label: "All Categories" },
          ...categories.map(c => ({ value: c, label: c })),
        ]}/>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        {anyFilter && (
          <button onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center">{filtered.length} records</p>
        {isLabTech && (
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
            bg-white text-slate-700 text-xs font-medium cursor-pointer select-none hover:border-sky-300 self-center"
            title="Hide the printed report header and leave 5.5 cm blank at the top for pre-printed letterhead paper">
            <input type="checkbox" className="accent-sky-600"
              checked={letterheadMode}
              onChange={e => toggleLetterhead(e.target.checked)} />
            Print on letterhead
          </label>
        )}
      </div>

      {/* loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded w-20" />)}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="h-3 bg-slate-200 rounded w-32" />
              <div className="h-5 bg-slate-200 rounded-full w-16" />
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-3 bg-slate-200 rounded w-12" />
              <div className="h-5 bg-slate-200 rounded-full w-14 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* ── Bulk selection action bar ── */}
      {selectionActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-4 py-3
          rounded-xl border border-sky-200 bg-sky-50">
          <span className="text-sm font-semibold text-sky-800">
            {selectedTests.size} test{selectedTests.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            {isLabTech && (
              <button onClick={handleBulkCollect} disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500
                  hover:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50">
                🧪 Collect Selected
              </button>
            )}
            {isLabTech && (
              <button onClick={openWorksheet} disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500
                  hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                ✏ Enter Results
              </button>
            )}
            <button onClick={handleBulkPrint} disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300
                bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2
                    4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2
                    2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              Print Selected
            </button>
            <button onClick={clearSelection}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* grouped order table (pharmacy-style expandable rows) */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <HScrollArea>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["", "Patient", "UHID", "Type", "Doctor", "Ordered", "Tests",
                    "Est. Total", "Bill", "Status", "Action"
                  ].map((h, i) => (
                    <th key={h || `c-${i}`} className="px-4 py-3 text-left text-xs font-semibold
                      text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                            M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                      No lab orders found
                    </div>
                  </td></tr>
                ) : groups.map(g => {
                  const isExpanded = expandedGroup === g.orderGroupId;
                  const isInpatient = (g.patientType ?? "").toUpperCase() === "IP";
                  // Both IP and OP generate an estimation. For IP the bill is a
                  // "bill submitted" (AWAITING_PAYMENT) settled at reception on
                  // release; the discharge-bill auto-fill skips already-billed labs.
                  const canEstimate = isLabTech
                    && g.tests.some(t => t.status === "PENDING") && !g.billedInBillId;
                  return (
                    <Fragment key={g.orderGroupId}>
                      {/* ── group header row ── */}
                      <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? "bg-sky-50/40" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleGroup(g.orderGroupId)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                              ${isExpanded ? "bg-sky-100 text-sky-600 rotate-90" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
                            title={isExpanded ? "Collapse" : "Expand tests"}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 whitespace-nowrap">{g.patientName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{g.uhid}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                            ${g.patientType === "IP" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}`}>
                            {g.patientType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{g.doctorName || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          <p>{g.orderedDate}</p>
                          <p className="text-slate-400">{g.orderedTime}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold
                            text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                            {g.tests.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{inr(g.estimatedTotal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {g.billedInBillId
                            ? <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">#{g.billedInBillId}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge label={STATUS_DISPLAY[g.groupStatus] ?? g.groupStatus}
                            variant={STATUS_COLORS[g.groupStatus] ?? "yellow"} dot />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {canEstimate ? (
                            <button onClick={() => handleGenerateEstimation(g)}
                              disabled={estimatingGroup === g.orderGroupId}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                                bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 transition-colors">
                              {estimatingGroup === g.orderGroupId ? "Generating…" : "Generate Estimation"}
                            </button>
                          ) : g.groupStatus === "AWAITING_PAYMENT" ? (
                            <span className="text-xs text-orange-600 font-medium">
                              {isInpatient ? "Bill submitted · pay at release" : "Awaiting payment at reception"}
                            </span>
                          ) : isInpatient && g.groupStatus === "PAID" ? (
                            <span className="text-xs text-purple-600 font-medium">
                              Released · bills with IP
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── expanded: individual test line items ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="bg-slate-50/60 border-b border-slate-200 px-0 py-0">
                            <div className="px-10 py-4">
                              <table className="w-full text-xs rounded-lg overflow-hidden">
                                <thead>
                                  <tr className="bg-slate-100/70 text-slate-600 uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left w-8">
                                      {selectionActive && (
                                        <input type="checkbox"
                                          checked={isGroupAllSelected(g)}
                                          onChange={() => toggleGroupSelect(g)}
                                          className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                          title="Select all tests in this order" />
                                      )}
                                    </th>
                                    {["Lab ID", "Test", "Category", "Sample", "Priority", "Price",
                                      "Result", "Status", "Actions"].map(h => (
                                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.tests.map(t => {
                                    const selectable = t.status !== "CANCELLED";
                                    return (
                                    <tr key={t.id} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                                      <td className="px-3 py-2 w-8">
                                        {selectable && (
                                          <input type="checkbox"
                                            checked={selectedTests.has(t.id)}
                                            onChange={() => toggleTest(t.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                                        )}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-sky-700">{t.labId}</td>
                                      <td className="px-3 py-2">
                                        <p className="font-semibold text-slate-800">{t.investigationName}</p>
                                        <p className="text-slate-400">{t.testCode}</p>
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">{t.category}</td>
                                      <td className="px-3 py-2 text-slate-500">{t.sampleType ? `🧪 ${t.sampleType}` : "—"}</td>
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                                          ${PRIORITY_COLORS[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                                          {PRIORITY_DISPLAY[t.priority] ?? t.priority}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 font-semibold text-slate-800">{inr(t.price ?? 0)}</td>
                                      <td className="px-3 py-2 max-w-[140px]">
                                        {t.result
                                          ? <span className={`font-semibold ${t.abnormal ? "text-red-600" : "text-emerald-700"}`}>
                                              {t.abnormal && "⚠ "}{t.result}{t.unit ? ` ${t.unit}` : ""}
                                            </span>
                                          : <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="px-3 py-2">
                                        <Badge label={STATUS_DISPLAY[t.status] ?? t.status}
                                          variant={STATUS_COLORS[t.status] ?? "yellow"} dot />
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                          {isLabTech && (t.status === "PAID"
                                            || (t.patientType?.toUpperCase() === "IP" && t.status === "AWAITING_PAYMENT")) && (
                                            <button onClick={() => handleCollect(t)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                                              🧪 Collect
                                            </button>
                                          )}
                                          {isLabTech && t.status === "IN_PROGRESS" && (
                                            <button onClick={() => openResult(t)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                              ✏ Result
                                            </button>
                                          )}
                                          {/* PDF upload button — shown for PDF-type tests that are IN_PROGRESS */}
                                          {isLabTech && t.status === "IN_PROGRESS" && t.resultType === "PDF" && (
                                            <button onClick={() => openUpload(t, "pdf")}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors">
                                              📎 Upload PDF
                                            </button>
                                          )}
                                          {/* Image upload — available for IN_PROGRESS PDF-type tests */}
                                          {isLabTech && t.status === "IN_PROGRESS" && t.resultType === "PDF" && (
                                            <button onClick={() => openUpload(t, "image")}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                                              🖼 Add Image
                                            </button>
                                          )}
                                          {t.status === "COMPLETED" && t.resultType === "PDF" && t.reportPdfPath && (
                                            <a href={labFileUrl(t.reportPdfPath)} target="_blank" rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors">
                                              📄 View PDF
                                            </a>
                                          )}
                                          {t.status === "COMPLETED" && t.resultType === "PDF" && parseImagePaths(t.reportImages).length > 0 && (
                                            <button
                                              onClick={() => {
                                                setLightboxImages(parseImagePaths(t.reportImages).map(labFileUrl));
                                                setLightboxIndex(0);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                                text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                                              🖼 Images ({parseImagePaths(t.reportImages).length})
                                            </button>
                                          )}
                                          {t.status === "COMPLETED" && t.resultType !== "PDF" && (
                                            <button onClick={() => printLabResult(t)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100
                                                hover:text-slate-700 transition-colors" title="Print result">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0
                                                    002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2
                                                    2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                              </svg>
                                            </button>
                                          )}
                                          {isLabTech && (t.status === "PENDING" || t.status === "AWAITING_PAYMENT"
                                            || t.status === "PAID" || t.status === "IN_PROGRESS") && (
                                            <button onClick={() => openCancel(t)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50
                                                hover:text-red-500 transition-colors" title="Cancel">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                              </svg>
                                            </button>
                                          )}
                                          {t.status === "AWAITING_PAYMENT" && t.patientType?.toUpperCase() !== "IP" && (
                                            <span className="text-xs text-orange-500">Pay at reception</span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </HScrollArea>
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {groups.length} order{groups.length !== 1 ? "s" : ""} · {filtered.length} tests
          </div>
        </div>
      )}

      {/* ── New Order Modal ── */}
      <Modal open={orderOpen} onClose={() => { setOrderOpen(false); setSelPatient(null); setPtQuery(""); setOrderLines([]); }}
        title="New Lab Order" size="lg"
        footer={
          <>
            <button onClick={() => { setOrderOpen(false); setSelPatient(null); setPtQuery(""); setOrderLines([]); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleOrder}
              disabled={!selPatient || orderLines.length === 0}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40
                text-white font-medium rounded-lg">
              Place Order ({orderLines.length} test{orderLines.length !== 1 ? "s" : ""})
            </button>
          </>
        }>
        <div className="space-y-4">
          {/* Patient search */}
          <SH>Patient</SH>
          <div className="relative">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input value={ptQuery}
                onChange={e => handlePtQueryChange(e.target.value)}
                onFocus={() => setPtDropOpen(true)}
                placeholder="Search patient by name, UHID or phone…"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
                  text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
            </div>
            {ptDropOpen && (patients.length > 0 || ptSearching) && (
              <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200
                rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
                {ptSearching && (
                  <li className="px-4 py-3 text-slate-400 text-xs">Searching…</li>
                )}
                {!ptSearching && patients.map(p => (
                  <li key={p.id}>
                    <button type="button" onMouseDown={() => selectPatient(p)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-sky-50 text-left">
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center
                        justify-center text-xs font-bold mt-0.5
                        ${p.patientType === "IP" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>
                        {p.patientType}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.uhid}
                          {p.age != null ? ` · ${p.age}y` : ""}
                          {p.phone ? ` · ${p.phone}` : ""}
                          {p.doctorName ? ` · ${p.doctorName}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selPatient && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <IP label="Patient"  value={selPatient.name}/>
              <IP label="UHID"     value={selPatient.uhid}/>
              <IP label="Type"     value={selPatient.patientType}/>
              <IP label="Doctor"   value={selPatient.doctorName ?? "—"}/>
            </div>
          )}

          {/* Test picker */}
          <SH>Select Tests</SH>
          <TestSearchSelect
            options={labMaster}
            excludeIds={new Set(orderLines.map(ol => ol.id))}
            accent="sky"
            onAdd={t => setOrderLines(prev => [...prev, { ...t, priority: "ROUTINE" }])}
          />

          {orderLines.length > 0 && (
            <div className="space-y-2">
              {orderLines.map((t, idx) => (
                <div key={t.testCode} className="flex items-center gap-3 bg-white border
                  border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">
                      {t.category} · {inr(t.price)}
                      {t.sampleType && ` · 🧪 ${t.sampleType}`}
                      {t.turnaroundTime && ` · TAT: ${t.turnaroundTime}`}
                    </p>
                  </div>
                  <select value={t.priority}
                    onChange={e => setOrderLines(prev => prev.map((x, i) =>
                      i === idx ? { ...x, priority: e.target.value } : x))}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none
                      ${t.priority === "STAT" ? "bg-red-50 text-red-700 border-red-200"
                        : t.priority === "URGENT" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                  <button onClick={() => setOrderLines(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex justify-between text-xs text-slate-500 px-1">
                <span>{orderLines.length} test{orderLines.length !== 1 ? "s" : ""}</span>
                <span className="font-semibold text-slate-700">
                  Total: {inr(orderLines.reduce((s, t) => s + t.price, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Enter Result Modal ── */}
      <Modal open={!!resultTarget} onClose={() => setResultTarget(null)}
        title={`Enter Result — ${resultTarget?.labId}`} size={paramTemplate.length > 0 || resultTarget?.resultType === "CULTURE_SENSITIVITY" ? "lg" : "sm"}
        footer={
          <>
            <button onClick={() => setResultTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleComplete}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg">
              Complete
            </button>
          </>
        }>
        {resultTarget && (
          resultTarget.resultType === "PDF" ? (
            /* PDF-type tests: redirect the tech to the upload button */
            <div className="space-y-3">
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-4 text-center space-y-2">
                <p className="text-2xl">📄</p>
                <p className="text-sm font-semibold text-violet-800">This test uses a PDF report</p>
                <p className="text-xs text-violet-600">
                  Close this dialog and use the <strong>Upload PDF</strong> button on the test row
                  to attach the report from the external lab.
                </p>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">{resultTarget.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Test</span>
                <span className="font-semibold text-slate-800">{resultTarget.investigationName}</span>
              </div>
              {paramTemplate.length === 0 && resultTarget.normalRange && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Normal Range</span>
                  {isAgeBanded(resultTarget.normalRange) ? (
                    <span className="text-slate-600 text-right">
                      {(() => {
                        const bands = parseAgeBands(resultTarget.normalRange);
                        const age = resultTarget.age;
                        const match = age != null
                          ? bands.find(b => age >= b.fromAge && age <= b.toAge)
                          : null;
                        return match
                          ? <><span className="font-semibold text-sky-700">{match.rangeText}</span>
                              <span className="ml-1 text-xs text-slate-400">({match.label})</span></>
                          : <span className="text-xs text-slate-400">Age-banded — see report</span>;
                      })()}
                    </span>
                  ) : (
                    <span className="text-slate-600">{resultTarget.normalRange} {resultTarget.unit}</span>
                  )}
                </div>
              )}
            </div>
            {resultErr && <p className="text-xs text-red-500">{resultErr}</p>}

            {paramTemplate.length > 0 ? (
              <ParamResultGrid
                template={paramTemplate}
                values={paramValues}
                onChange={(i, v) => { setParamValues(prev => ({ ...prev, [i]: v })); setResultErr(""); }}
              />
            ) : resultTarget.resultType === "CULTURE_SENSITIVITY" ? (
              /* ── C&S Antibiogram Entry ── */
              <div className="space-y-4">
                <SH>Culture Details</SH>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Organism / Growth">
                    <input value={csOrganism} autoFocus
                      onChange={e => { setCsOrganism(e.target.value); setResultErr(""); }}
                      placeholder="e.g. E. coli, No growth, Sterile"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </FormField>
                  <FormField label="Colony Count">
                    <input value={csColonyCount}
                      onChange={e => setCsColonyCount(e.target.value)}
                      placeholder="e.g. > 10⁵ CFU/mL, Significant"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </FormField>
                </div>
                <FormField label="Gram Stain">
                  <input value={csGramStain}
                    onChange={e => setCsGramStain(e.target.value)}
                    placeholder="e.g. Gram Negative Bacilli"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </FormField>

                <SH>Antibiotic Sensitivity</SH>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px] bg-slate-50 border-b border-slate-200
                    px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span>Antibiotic</span>
                    <span className="text-center">S / I / R</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {csAntibiotics.map((ab, i) => (
                      <div key={i} className="grid grid-cols-[1fr_120px] px-3 py-1.5 items-center gap-2">
                        <input value={ab.name}
                          onChange={e => setCsAntibiotics(prev => prev.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="Antibiotic name"
                          className="px-2 py-1 text-sm rounded border border-slate-200 w-full
                            focus:outline-none focus:ring-1 focus:ring-orange-400" />
                        <div className="flex gap-1 justify-center">
                          {(["S", "I", "R"] as const).map(s => (
                            <button key={s} type="button"
                              onClick={() => setCsAntibiotics(prev => prev.map((x, j) =>
                                j === i ? { ...x, sensitivity: x.sensitivity === s ? "" : s } : x))}
                              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors
                                ${ab.sensitivity === s
                                  ? s === "S" ? "bg-emerald-500 text-white border-emerald-500"
                                    : s === "I" ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-red-500 text-white border-red-500"
                                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                    <button type="button"
                      onClick={() => setCsAntibiotics(prev => [...prev, { name: "", sensitivity: "" }])}
                      className="text-xs text-orange-600 font-medium hover:text-orange-800 transition-colors
                        inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      Add antibiotic
                    </button>
                  </div>
                </div>

                <FormField label="Comment / Remarks">
                  <textarea value={csComment} rows={2}
                    onChange={e => setCsComment(e.target.value)}
                    placeholder="e.g. ESBL producer suspected. Treat as per sensitivity."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                </FormField>
              </div>
            ) : (
              <FormField label="Result Value" required>
                {/* Textarea so lab techs can enter multi-line text results
                    (e.g. SMEAR STUDY, culture findings, narrative reports).
                    Auto-grows to fit the content; pre-wrap is preserved on print. */}
                <textarea
                  value={resultValue}
                  rows={3}
                  autoFocus
                  onChange={e => {
                    setResultValue(e.target.value);
                    setResultErr("");
                    // auto-grow to content height
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  placeholder={`e.g. ${resultTarget.normalRange ?? "value"}`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none overflow-hidden
                    leading-snug"
                />
              </FormField>
            )}

            <p className="text-xs text-slate-400">
              Completed time will be recorded automatically. TAT will be calculated.
              <br/>
              <span className="font-medium text-sky-600">Completed by: {session?.name ?? "You"}</span>
            </p>
          </div>
        )
        )}
      </Modal>

      {/* ── Bulk Result Worksheet Modal ── */}
      <Modal open={!!worksheet} onClose={closeWorksheet}
        title={`Enter Results — ${worksheet?.length ?? 0} test${(worksheet?.length ?? 0) === 1 ? "" : "s"}`} size="lg"
        footer={
          <>
            <button onClick={closeWorksheet}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSaveWorksheet} disabled={bulkBusy}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50
                text-white font-medium rounded-lg">
              {bulkBusy ? "Saving…" : "Save All Results"}
            </button>
          </>
        }>
        {worksheet && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Enter a value for each test. Blank rows are skipped and stay In Progress.
            </p>
            {worksheetErr && <p className="text-xs text-red-500">{worksheetErr}</p>}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-100">
              {worksheet.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.investigationName}</p>
                    <p className="text-xs text-slate-400">
                      {t.labId}{t.patientName ? ` · ${t.patientName}` : ""}
                      {t.normalRange ? ` · Ref: ${t.normalRange}${t.unit ? ` ${t.unit}` : ""}` : ""}
                    </p>
                  </div>
                  {/* Textarea so multi-line text results (smear study, culture, etc.)
                      can be entered in the bulk worksheet without losing line breaks. */}
                  <textarea
                    rows={1}
                    value={worksheetValues[t.id] ?? ""}
                    onChange={e => {
                      setWorksheetValues(v => ({ ...v, [t.id]: e.target.value }));
                      setWorksheetErr("");
                      // auto-grow to content height
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    placeholder={t.normalRange ? `e.g. ${t.normalRange}` : "value"}
                    className="w-40 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none overflow-hidden
                      leading-snug" />
                  {t.unit && <span className="text-xs text-slate-400 w-10">{t.unit}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Cancel Modal ── */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)}
        title={`Cancel Test — ${cancelTarget?.labId}`} size="sm"
        footer={
          <>
            <button onClick={() => setCancelTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Back</button>
            <button onClick={handleCancel}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg">
              Cancel Test
            </button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Cancelling <span className="font-semibold">{cancelTarget?.investigationName}</span> for{" "}
            <span className="font-semibold">{cancelTarget?.patientName}</span>.
          </p>
          {cancelErr && <p className="text-xs text-red-500">{cancelErr}</p>}
          <FormField label="Reason" required>
            <Textarea value={cancelReason}
              onChange={e => { setCancelReason(e.target.value); setCancelErr(""); }}
              placeholder="Patient refused, duplicate order, wrong test…" rows={2} autoFocus/>
          </FormField>
        </div>
      </Modal>

      {/* ── Upload PDF / Image Modal ── */}
      <Modal
        open={!!uploadTarget}
        onClose={() => { setUploadTarget(null); setUploadFile(null); setUploadErr(""); }}
        title={uploadType === "pdf"
          ? `Upload PDF Report — ${uploadTarget?.labId}`
          : `Add Image — ${uploadTarget?.labId}`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setUploadTarget(null); setUploadFile(null); setUploadErr(""); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploadBusy}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40
                ${uploadType === "pdf" ? "bg-violet-600 hover:bg-violet-700" : "bg-sky-500 hover:bg-sky-600"}`}>
              {uploadBusy ? "Uploading…" : uploadType === "pdf" ? "Upload & Complete" : "Add Image"}
            </button>
          </>
        }>
        {uploadTarget && (
          <div className="space-y-4">
            {/* Test info */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">{uploadTarget.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Test</span>
                <span className="font-semibold text-slate-800">{uploadTarget.investigationName}</span>
              </div>
            </div>

            {uploadErr && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {uploadErr}
              </p>
            )}

            {uploadType === "pdf" ? (
              <FormField label="PDF Report File" required>
                <div className="space-y-2">
                  <input
                    ref={uploadFileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={e => {
                      setUploadFile(e.target.files?.[0] ?? null);
                      setUploadErr("");
                    }}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3
                      file:rounded-lg file:border-0 file:text-xs file:font-semibold
                      file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100
                      border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  />
                  {uploadFile && (
                    <p className="text-xs text-slate-500">
                      {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Max 20 MB · PDF only · Uploading will mark this test as Completed.
                  </p>
                </div>
              </FormField>
            ) : (
              <FormField label="Image File (morphology chart, scan, etc.)" required>
                <div className="space-y-2">
                  <input
                    ref={uploadFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={e => {
                      setUploadFile(e.target.files?.[0] ?? null);
                      setUploadErr("");
                    }}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3
                      file:rounded-lg file:border-0 file:text-xs file:font-semibold
                      file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100
                      border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  />
                  {uploadFile && (
                    <p className="text-xs text-slate-500">
                      {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Max 20 MB · JPG, PNG, WebP, GIF · You can add multiple images one by one.
                  </p>
                </div>
              </FormField>
            )}
          </div>
        )}
      </Modal>

      {/* ── Image Lightbox ── */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
          onClick={() => setLightboxImages([])}>
          {/* Close */}
          <button
            onClick={() => setLightboxImages([])}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-bold
              w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
            ✕
          </button>
          {/* Counter */}
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
            {lightboxIndex + 1} / {lightboxImages.length}
          </p>
          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImages[lightboxIndex]}
            alt={`Lab report image ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
          {/* Prev / Next */}
          {lightboxImages.length > 1 && (
            <div className="flex gap-4 mt-4" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium">
                ← Prev
              </button>
              <button
                onClick={() => setLightboxIndex(i => (i + 1) % lightboxImages.length)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium">
                Next →
              </button>
            </div>
          )}
          {/* Download current */}
          <a
            href={lightboxImages[lightboxIndex]}
            download
            onClick={e => e.stopPropagation()}
            className="mt-3 text-xs text-white/50 hover:text-white/80 underline">
            Download
          </a>
        </div>
      )}

    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function SC({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function DF({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
      </svg>
    </div>
  );
}

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-slate-100"/>
    </div>
  );
}

function IP({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold text-sky-900">{value}</p>
    </div>
  );
}
