"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";
import {
  type AgeBand,
  isAgeBanded, parseAgeBands, serializeAgeBands,
  emptyBand, bandWithAutoLabel,
} from "../../../_lib/age-band";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabParam {
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
  displayOrder: number | "";
}

interface LabMasterResponse {
  id: number;
  testCode: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  // sample
  sampleType: string | null;
  container: string | null;
  sampleVolume: string | null;
  fastingRequired: boolean | null;
  patientInstructions: string | null;
  // reporting
  turnaroundTime: string | null;
  resultType: string | null;
  resultOptions: string | null;
  normalRange: string | null;
  unit: string | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  parameters: string | null;
  // advanced
  testMethod: string | null;
  specialInstructions: string | null;
  displayOrder: number | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface LabTest {
  _id: number;
  testCode: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  sampleType: string;
  container: string;
  sampleVolume: string;
  fastingRequired: boolean | null;
  patientInstructions: string;
  turnaroundTime: string;
  resultType: string;
  resultOptions: string[];
  normalRange: string;
  unit: string;
  criticalLow: number | null;
  criticalHigh: number | null;
  parameters: LabParam[];
  testMethod: string;
  specialInstructions: string;
  displayOrder: number | null;
  notes: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

function parseParams(raw: string | null): LabParam[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((p: Partial<LabParam>) => ({
      group: p.group ?? "",
      subGroup: p.subGroup ?? "",
      name: p.name ?? "",
      unit: p.unit ?? "",
      normalRange: p.normalRange ?? "",
      normalMin: p.normalMin ?? "",
      normalMax: p.normalMax ?? "",
      maleMin: p.maleMin ?? "",
      maleMax: p.maleMax ?? "",
      femaleMin: p.femaleMin ?? "",
      femaleMax: p.femaleMax ?? "",
      childMin: p.childMin ?? "",
      childMax: p.childMax ?? "",
      criticalLow: p.criticalLow ?? "",
      criticalHigh: p.criticalHigh ?? "",
      displayOrder: p.displayOrder ?? "",
    })) : [];
  } catch { return []; }
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

function toFrontend(r: LabMasterResponse): LabTest {
  return {
    _id:               r.id,
    testCode:          r.testCode,
    name:              r.name,
    category:          r.category,
    subcategory:       r.subcategory ?? "",
    price:             r.price,
    sampleType:        r.sampleType ?? "",
    container:         r.container ?? "",
    sampleVolume:      r.sampleVolume ?? "",
    fastingRequired:   r.fastingRequired ?? null,
    patientInstructions: r.patientInstructions ?? "",
    turnaroundTime:    r.turnaroundTime ?? "",
    resultType:        r.resultType ?? "",
    resultOptions:     parseOptions(r.resultOptions),
    normalRange:       r.normalRange ?? "",
    unit:              r.unit ?? "",
    criticalLow:       r.criticalLow ?? null,
    criticalHigh:      r.criticalHigh ?? null,
    parameters:        parseParams(r.parameters),
    testMethod:        r.testMethod ?? "",
    specialInstructions: r.specialInstructions ?? "",
    displayOrder:      r.displayOrder ?? null,
    notes:             r.notes ?? "",
    status:            r.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:         r.createdBy ?? "system",
    createdDate:       r.createdAt ? r.createdAt.slice(0, 10) : "",
  };
}

function emptyParam(): LabParam {
  return {
    group: "", subGroup: "", name: "", unit: "", normalRange: "",
    normalMin: "", normalMax: "",
    maleMin: "", maleMax: "",
    femaleMin: "", femaleMax: "",
    childMin: "", childMax: "",
    criticalLow: "", criticalHigh: "",
    displayOrder: "",
  };
}

type FormState = {
  name: string; category: string; subcategory: string;
  price: number; status: "ACTIVE" | "INACTIVE";
  sampleType: string; container: string; sampleVolume: string;
  fastingRequired: "" | "true" | "false";
  patientInstructions: string;
  turnaroundTime: string; resultType: string;
  normalRange: string; unit: string;
  criticalLow: string; criticalHigh: string;
  testMethod: string; specialInstructions: string;
  displayOrder: string; notes: string;
};

function emptyForm(): FormState {
  return {
    name: "", category: "", subcategory: "", price: 0, status: "ACTIVE",
    sampleType: "", container: "", sampleVolume: "",
    fastingRequired: "", patientInstructions: "",
    turnaroundTime: "", resultType: "",
    normalRange: "", unit: "",
    criticalLow: "", criticalHigh: "",
    testMethod: "", specialInstructions: "",
    displayOrder: "", notes: "",
  };
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiFetch(path: string) {
  const res = await fetch(path);
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data };
}

// ─── Range color helper ───────────────────────────────────────────────────────
// Returns CSS classes for a numeric result value relative to normal + critical range.

function rangeColor(
  value: number | null | undefined,
  normalMin: number | "" | null,
  normalMax: number | "" | null,
  critLow: number | "" | null,
  critHigh: number | "" | null,
): "green" | "yellow" | "red" | "none" {
  if (value == null) return "none";
  const nMin = normalMin !== "" && normalMin != null ? Number(normalMin) : null;
  const nMax = normalMax !== "" && normalMax != null ? Number(normalMax) : null;
  const cLow = critLow !== "" && critLow != null ? Number(critLow) : null;
  const cHigh = critHigh !== "" && critHigh != null ? Number(critHigh) : null;

  if ((cLow != null && value < cLow) || (cHigh != null && value > cHigh)) return "red";
  if ((nMin != null && value < nMin) || (nMax != null && value > nMax)) return "yellow";
  return "green";
}

const RANGE_STYLE: Record<string, string> = {
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red:    "bg-red-50 text-red-700 border-red-200",
  none:   "bg-slate-50 text-slate-500 border-slate-200",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-slate-100" />
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
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white
          text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function SC({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

// Tag input for dropdown result options
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput("");
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-white min-h-[42px]">
      {tags.map(t => (
        <span key={t}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
            className="hover:text-red-600 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={tags.length === 0 ? "Type option and press Enter…" : "Add more…"}
        className="flex-1 min-w-[120px] text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
      />
    </div>
  );
}

// Creatable searchable unit select
function CreatableUnitSelect({
  value, options, onChange, onAdd,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAdd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  const exactMatch = options.some(o => o.toLowerCase() === q);

  return (
    <div className="relative" ref={ref}>
      <button type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500">
        <span className={value ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {value || "e.g. mg/dL, g/dL, %"}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg top-full mt-1 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search or type new unit…"
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <ul className="max-h-40 overflow-y-auto py-1">
            {filtered.map(o => (
              <li key={o}>
                <button type="button" onClick={() => { onChange(o); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors
                    ${o === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}>
                  {o}
                </button>
              </li>
            ))}
            {q && !exactMatch && (
              <li>
                <button type="button"
                  onClick={() => { onAdd(query.trim()); onChange(query.trim()); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 text-sm text-sky-600 font-medium
                    hover:bg-sky-50 transition-colors border-t border-slate-100">
                  + Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Form tabs
type Tab = "basic" | "sample" | "reporting" | "advanced";
const TABS: { id: Tab; label: string }[] = [
  { id: "basic",     label: "Basic"      },
  { id: "sample",    label: "Sample"     },
  { id: "reporting", label: "Reporting"  },
  { id: "advanced",  label: "Advanced"   },
];

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

const CATEGORIES = [
  "Emergency", "Haematology", "Clinical Pathology", "Biochemistry",
  "Endocrinology", "Cardiology", "Microbiology", "Serology", "Molecular",
  "Urine", "Stool", "Histopathology", "Cytology", "Radiology", "Others",
];
const SAMPLE_TYPES = ["Blood", "Serum", "Plasma", "Urine", "Stool", "Swab", "Sputum", "CSF", "Tissue", "FNAC", "Other"];
const CONTAINER_TYPES = ["EDTA (Purple)", "Plain / SST (Red/Gold)", "Fluoride (Grey)", "Citrate (Blue)", "Heparin (Green)", "Urine Cup", "Sterile Container", "Other"];
const RESULT_TYPES = ["NUMERIC", "TEXT", "POSITIVE_NEGATIVE", "DROPDOWN", "CULTURE_SENSITIVITY", "PDF"];
const TAT_OPTIONS = ["1 hour", "2 hours", "4 hours", "6 hours", "Same day", "24 hours", "48 hours", "72 hours", "1 week"];

// Page size for server-side paging of the lab-masters list.
const PAGE_SIZE = 100;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LabMasterPage() {
  const session = getSession();
  const canEdit = checkEdit(session?.role ?? "Admin", "masters/lab");

  // ── Server-side search / filter / paging ──────────────────────────────────
  // filters
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [catFilter, setCatFilter]       = useState("");
  const [sampleFilter, setSampleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // `page` is 0-indexed (matches the backend).
  const [page, setPage]                 = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Current page's rows (server-paged at PAGE_SIZE).
  const [tests, setTests]       = useState<LabTest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // Load one page of lab tests from the server, applying search + filters there.
  const loadTests = useCallback(async (signal?: AbortSignal) => {
    // Yield once before touching state so this never runs setState synchronously
    // in the effect body (keeps renders cheap / lint-clean).
    await Promise.resolve();
    if (signal?.aborted) return;
    setLoading(true);
    setFetchErr(null);
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    const s = debouncedSearch.trim();
    if (s)            qs.set("search", s);
    if (catFilter)    qs.set("category", catFilter);
    if (sampleFilter) qs.set("sampleType", sampleFilter);
    if (statusFilter) qs.set("status", statusFilter === "Active" ? "ACTIVE" : "INACTIVE");
    try {
      const res  = await fetch(`/api/masters/lab-masters?${qs}`, { signal });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFetchErr(json.error ?? "Failed to load data");
        setTests([]); setTotalElements(0); setTotalPages(0);
      } else {
        const pr = json.data as { content?: LabMasterResponse[]; totalElements?: number; totalPages?: number };
        setTests((pr?.content ?? []).map(toFrontend));
        setTotalElements(pr?.totalElements ?? 0);
        setTotalPages(pr?.totalPages ?? 0);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // superseded — ignore
      setFetchErr("Network error. Please try again.");
      setTests([]); setTotalElements(0); setTotalPages(0);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, debouncedSearch, catFilter, sampleFilter, statusFilter]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  // On commit we also drop back to page 0 so the first page of results shows.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch whenever the debounced search / filters / page change.
  useEffect(() => {
    const ctrl = new AbortController();
    // loadTests is async and sets state only after awaiting; the rule's static
    // check can't see past the await, so it's disabled here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTests(ctrl.signal);
    return () => ctrl.abort();
  }, [loadTests]);

  const reload = useCallback(() => { loadTests(); }, [loadTests]);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<LabTest | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [form, setForm]           = useState<FormState>(emptyForm());
  const [params, setParams]       = useState<LabParam[]>([]);
  const [resultOptions, setResultOptions] = useState<string[]>([]);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState("");

  // age-banded normal range
  const [ageBanded, setAgeBanded] = useState(false);
  const [ageBands, setAgeBands]   = useState<AgeBand[]>([]);

  // remote dropdown data
  const [knownUnits, setKnownUnits]   = useState<string[]>([]);

  useEffect(() => {
    // Unit options: managed "Dropdowns" master (UNIT category, active) merged with
    // distinct units already recorded on existing lab tests so none are lost.
    Promise.all([
      apiFetch("/api/masters/dropdowns?category=UNIT&status=ACTIVE&size=1000"),
      apiFetch("/api/masters/lab-masters/distinct-units"),
    ]).then(([master, distinct]) => {
      const masterUnits: string[] = master.ok && master.data
        ? (((master.data as { content?: { label: string }[] }).content
            ?? (master.data as { label: string }[])) as { label: string }[]).map((o) => o.label)
        : [];
      const distinctUnits: string[] = distinct.ok && Array.isArray(distinct.data) ? (distinct.data as string[]) : [];
      const merged = Array.from(new Set([...masterUnits, ...distinctUnits].map((s) => s.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));
      setKnownUnits(merged);
    });
  }, []);

  // Persist a newly-typed Unit to the shared Dropdowns master (UNIT category) so
  // it becomes permanent and appears everywhere (and in the Dropdowns admin).
  const persistUnit = useCallback((rawValue: string) => {
    const val = rawValue.trim();
    if (!val) return;
    setKnownUnits((prev) => (prev.includes(val) ? prev : [...prev, val].sort((a, b) => a.localeCompare(b))));
    // idempotent=true → re-adding an existing unit never errors.
    masterCreate("/api/masters/dropdowns?idempotent=true", { category: "UNIT", label: val });
  }, []);

  // load subcategories when category changes — kept for backward compat but not shown in UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadSubcats = useCallback((_cat: string) => { /* subcategory hidden from UI */ }, []);
  useEffect(() => { /* no-op — subcategory field removed */ }, [form.category, loadSubcats]);

  // derived — filtering/search/paging happen server-side, so the table renders
  // the current page's rows directly. Stat cards / counts reflect this page.
  const filtered = tests;
  const pageActive = tests.filter(t => t.status === "Active").length;
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tests.forEach(t => { m[t.category] = (m[t.category] ?? 0) + 1; });
    return m;
  }, [tests]);

  // distinct subcategories no longer shown in filter bar — kept for search match only

  function setF(patch: Partial<FormState>) { setForm(f => ({ ...f, ...patch })); }

  function openAdd() {
    setForm(emptyForm()); setParams([]); setResultOptions([]);
    setAgeBanded(false); setAgeBands([]);
    setErrors({}); setApiError(""); setEditing(null); setActiveTab("basic"); setModalOpen(true);
  }

  function openEdit(t: LabTest) {
    const banded = isAgeBanded(t.normalRange);
    setAgeBanded(banded);
    setAgeBands(banded ? parseAgeBands(t.normalRange) : []);
    setForm({
      name: t.name, category: t.category, subcategory: t.subcategory,
      price: t.price, status: t.status === "Active" ? "ACTIVE" : "INACTIVE",
      sampleType: t.sampleType, container: t.container, sampleVolume: t.sampleVolume,
      fastingRequired: t.fastingRequired == null ? "" : t.fastingRequired ? "true" : "false",
      patientInstructions: t.patientInstructions,
      turnaroundTime: t.turnaroundTime, resultType: t.resultType,
      normalRange: banded ? "" : t.normalRange,
      unit: t.unit,
      criticalLow:  t.criticalLow  != null ? String(t.criticalLow)  : "",
      criticalHigh: t.criticalHigh != null ? String(t.criticalHigh) : "",
      testMethod: t.testMethod, specialInstructions: t.specialInstructions,
      displayOrder: t.displayOrder != null ? String(t.displayOrder) : "",
      notes: t.notes,
    });
    setParams(t.parameters.length ? t.parameters : []);
    setResultOptions(t.resultOptions);
    setErrors({}); setApiError(""); setEditing(t); setActiveTab("basic"); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())      e.name     = "Test name is required";
    if (!form.category)         e.category = "Category is required";
    if (!form.price || form.price <= 0) e.price = "Enter a valid price";
    if (form.resultType === "DROPDOWN" && resultOptions.length === 0)
      e.resultOptions = "Add at least one dropdown option";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // jump to the tab that has the error
      if (e.name || e.category || e.price) setActiveTab("basic");
      else if (e.resultOptions) setActiveTab("reporting");
    }
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:        form.name,
      category:    form.category,
      subcategory: form.subcategory || undefined,
      price:       form.price,
      status:      form.status,
      // sample
      sampleType:          form.sampleType || undefined,
      container:           form.container || undefined,
      sampleVolume:        form.sampleVolume || undefined,
      fastingRequired:     form.fastingRequired === "" ? undefined : form.fastingRequired === "true",
      patientInstructions: form.patientInstructions || undefined,
      // reporting
      turnaroundTime: form.turnaroundTime || undefined,
      resultType:     form.resultType || undefined,
      resultOptions:  form.resultType === "DROPDOWN" && resultOptions.length > 0
                        ? JSON.stringify(resultOptions) : undefined,
      normalRange:    ageBanded
                        ? (serializeAgeBands(ageBands) || undefined)
                        : (form.normalRange || undefined),
      unit:           form.unit || undefined,
      criticalLow:    form.criticalLow !== "" ? Number(form.criticalLow) : undefined,
      criticalHigh:   form.criticalHigh !== "" ? Number(form.criticalHigh) : undefined,
      parameters:     params.length > 0 ? JSON.stringify(params) : null,
      // advanced
      testMethod:          form.testMethod || undefined,
      specialInstructions: form.specialInstructions || undefined,
      displayOrder:        form.displayOrder !== "" ? Number(form.displayOrder) : undefined,
      notes:               form.notes || undefined,
    };
    const result = editing
      ? await masterUpdate("/api/masters/lab-masters", editing._id, body)
      : await masterCreate("/api/masters/lab-masters", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  function clearFilters() { setSearch(""); setCatFilter(""); setSampleFilter(""); setStatusFilter(""); setPage(0); }
  const anyFilter = !!(search || catFilter || sampleFilter || statusFilter);

  // Full-page skeleton only on the very first load; later page/filter changes
  // keep the page mounted (the table shows its own "Loading…" row).
  if (loading && tests.length === 0 && totalElements === 0) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Lab Masters"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Lab Masters" }]}
        action={canEdit ? { label: "Add Test", onClick: openAdd } : undefined}
      />

      {/* stat cards (Total reflects the full result set; others reflect this page) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SC label="Total Tests"       value={totalElements.toLocaleString()} color="text-slate-900" />
        <SC label="Active (page)"     value={String(pageActive)}             color="text-emerald-600" />
        <SC label="Inactive (page)"   value={String(tests.length - pageActive)} color="text-slate-400" />
        <SC label="Categories (page)" value={String(Object.keys(catCounts).length)} color="text-sky-600" />
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, category…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <DF value={catFilter} onChange={v => { setCatFilter(v); setPage(0); }}
          options={[
            { value: "", label: "All Categories" },
            ...CATEGORIES.map(c => ({ value: c, label: c })),
          ]} />
        <DF value={sampleFilter} onChange={v => { setSampleFilter(v); setPage(0); }}
          options={[{ value: "", label: "All Samples" }, ...SAMPLE_TYPES.map(s => ({ value: s, label: s }))]} />
        <DF value={statusFilter} onChange={v => { setStatusFilter(v); setPage(0); }}
          options={[
            { value: "",         label: "All Status" },
            { value: "Active",   label: "Active" },
            { value: "Inactive", label: "Inactive" },
          ]} />
        {anyFilter && (
          <button onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center">{totalElements.toLocaleString()} test{totalElements !== 1 ? "s" : ""}</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Code", "Test Name", "Category", "Price", "Sample", "TAT",
                  "Result Type", "Critical", "Params", "Status",
                  ...(canEdit ? ["Actions"] : [])
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 12 : 11}
                  className="px-4 py-12 text-center text-slate-400">
                  {loading ? "Loading…" : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                            M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      No tests found
                    </div>
                  )}
                </td></tr>
              ) : filtered.map((t, idx) => (
                <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                      {t.testCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 whitespace-nowrap">{t.name}</p>
                    {t.unit && <p className="text-xs text-slate-400">{t.unit}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={t.category} variant="purple" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{inr(t.price)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.sampleType
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">🧪 {t.sampleType}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {t.turnaroundTime || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.resultType
                      ? <ResultTypeBadge type={t.resultType} />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(t.criticalLow != null || t.criticalHigh != null) ? (
                      <div className="flex flex-col gap-0.5">
                        {t.criticalLow  != null && <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">▼ {t.criticalLow}</span>}
                        {t.criticalHigh != null && <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">▲ {t.criticalHigh}</span>}
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.parameters.length > 0
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">📋 {t.parameters.length} params</span>
                      : <span className="text-xs text-slate-300">Simple</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={t.status} variant={t.status === "Active" ? "green" : "gray"} dot />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={async () => { await masterToggle("/api/masters/lab-masters", t._id); reload(); }}
                          className={`p-1.5 rounded-lg transition-colors ${t.status === "Active"
                            ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={t.status === "Active" ? "Deactivate" : "Activate"}>
                          {t.status === "Active" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-500 whitespace-nowrap">
            {totalElements > 0
              ? `Showing ${(page * PAGE_SIZE) + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${totalElements.toLocaleString()} tests`
              : "No tests"}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Previous
            </button>
            <span className="text-sm text-slate-500 whitespace-nowrap">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit — ${editing.testCode} · ${editing.name}` : "Add Lab Test"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300
                text-white font-medium rounded-lg flex items-center gap-2">
              {saving && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {editing ? "Save Changes" : "Add Test"}
            </button>
          </>
        }>

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 mb-5 -mt-1 gap-0">
          {TABS.map(tab => (
            <button key={tab.id} type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors
                ${activeTab === tab.id
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {apiError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {apiError}
          </div>
        )}

        {/* ── Tab: Basic ── */}
        {activeTab === "basic" && (
          <div className="space-y-4">
            <SH>Required</SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Test Name" required error={errors.name}>
                <Input autoFocus value={form.name}
                  onChange={e => setF({ name: e.target.value })}
                  placeholder="e.g. CBC, LFT, Blood Sugar Fasting" />
              </FormField>
              <FormField label="Price (₹)" required error={errors.price}>
                <Input type="number" min={0} value={form.price || ""}
                  onChange={e => setF({ price: Number(e.target.value) })}
                  placeholder="e.g. 250" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Category" required error={errors.category}>
                <Select value={form.category}
                  onChange={e => setF({ category: e.target.value, subcategory: "" })}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </Select>
              </FormField>
            </div>
            <SH>Status</SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Status">
                <Select value={form.status}
                  onChange={e => setF({ status: e.target.value as "ACTIVE" | "INACTIVE" })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FormField>
              <FormField label="Display Order">
                <Input type="number" min={0} value={form.displayOrder}
                  onChange={e => setF({ displayOrder: e.target.value })}
                  placeholder="e.g. 1 (lower = first on report)" />
              </FormField>
            </div>
          </div>
        )}

        {/* ── Tab: Sample & Collection ── */}
        {activeTab === "sample" && (
          <div className="space-y-4">
            <SH>Sample & Collection</SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Sample Type">
                <Select value={form.sampleType} onChange={e => setF({ sampleType: e.target.value })}>
                  <option value="">Select sample type…</option>
                  {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
                </Select>
              </FormField>
              <FormField label="Container / Tube">
                <Select value={form.container} onChange={e => setF({ container: e.target.value })}>
                  <option value="">Select container…</option>
                  {CONTAINER_TYPES.map(c => <option key={c}>{c}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Sample Volume">
                <Input value={form.sampleVolume}
                  onChange={e => setF({ sampleVolume: e.target.value })}
                  placeholder="e.g. 2 mL, 5 mL" />
              </FormField>
              <FormField label="Fasting Required">
                <Select value={form.fastingRequired}
                  onChange={e => setF({ fastingRequired: e.target.value as "" | "true" | "false" })}>
                  <option value="">Not specified</option>
                  <option value="true">Yes — fasting required</option>
                  <option value="false">No — not required</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Patient Preparation / Instructions">
              <textarea
                value={form.patientInstructions}
                onChange={e => setF({ patientInstructions: e.target.value })}
                rows={3}
                placeholder="e.g. 8–12 hours fasting required. Avoid strenuous exercise 24h before."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
            </FormField>
          </div>
        )}

        {/* ── Tab: Reporting ── */}
        {activeTab === "reporting" && (
          <div className="space-y-4">
            <SH>Result Configuration</SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="TAT (Turnaround Time)">
                <Select value={form.turnaroundTime}
                  onChange={e => setF({ turnaroundTime: e.target.value })}>
                  <option value="">Select TAT…</option>
                  {TAT_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </Select>
              </FormField>
              <FormField label="Result Type">
                <Select value={form.resultType}
                  onChange={e => setF({ resultType: e.target.value })}>
                  <option value="">Select result type…</option>
                  {RESULT_TYPES.map(r => <option key={r} value={r}>{r.replace("_", " / ")}</option>)}
                </Select>
              </FormField>
            </div>

            {/* Dropdown options — shown only when resultType = DROPDOWN */}
            {form.resultType === "DROPDOWN" && (
              <FormField label="Dropdown Options" required error={errors.resultOptions}>
                <TagInput tags={resultOptions} onChange={setResultOptions} />
                <p className="text-xs text-slate-400 mt-1">Type an option and press Enter or comma to add</p>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Unit">
                <CreatableUnitSelect
                  value={form.unit}
                  options={knownUnits}
                  onChange={v => setF({ unit: v })}
                  onAdd={persistUnit} />
              </FormField>
              <FormField label="Normal / Reference Range">
                {/* Toggle: simple range OR age-banded (NTproBNP, HbA1C, etc.) */}
                <label className="inline-flex items-center gap-2 mb-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-sky-600"
                    checked={ageBanded}
                    onChange={e => {
                      setAgeBanded(e.target.checked);
                      if (e.target.checked && ageBands.length === 0) {
                        setAgeBands([emptyBand()]);
                      }
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    Has age-banded ranges
                    <span className="ml-1 font-normal text-slate-400">(NTproBNP, HbA1C, etc.)</span>
                  </span>
                </label>

                {!ageBanded ? (
                  <>
                    <textarea
                      value={form.normalRange}
                      rows={3}
                      onChange={e => setF({ normalRange: e.target.value })}
                      placeholder={"e.g. 70–110 mg/dL  or  M:14-16 / F:12-15\nFor multi-line: Non Diabetic : 4.5-6.0\nGood control : 6.1-7.0"}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y font-mono leading-snug"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs">Enter</kbd> for
                      a new line — each line prints separately on the report.
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border border-sky-200 overflow-hidden">
                    {/* Column headers */}
                    <div className="grid grid-cols-[70px_70px_1fr_28px] gap-2 bg-sky-50
                      border-b border-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 uppercase tracking-wide">
                      <span>From (yrs)</span>
                      <span>To (yrs)</span>
                      <span>Normal Range Text</span>
                      <span/>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {ageBands.map((b, i) => (
                        <div key={i} className="grid grid-cols-[70px_70px_1fr_28px] gap-2 px-3 py-1.5 items-center bg-white">
                          <input
                            type="number" min={0} max={120}
                            value={b.fromAge || ""}
                            onChange={e => setAgeBands(prev => prev.map((x, j) =>
                              j === i ? bandWithAutoLabel({ ...x, fromAge: Number(e.target.value) || 0 }) : x))}
                            placeholder="18"
                            className="px-2 py-1 text-xs rounded border border-slate-200
                              focus:outline-none focus:ring-1 focus:ring-sky-400 w-full"
                          />
                          <input
                            type="number" min={0} max={999}
                            value={b.toAge >= 999 ? "" : b.toAge || ""}
                            onChange={e => setAgeBands(prev => prev.map((x, j) =>
                              j === i ? bandWithAutoLabel({ ...x, toAge: e.target.value === "" ? 999 : Number(e.target.value) }) : x))}
                            placeholder="75+"
                            className="px-2 py-1 text-xs rounded border border-slate-200
                              focus:outline-none focus:ring-1 focus:ring-sky-400 w-full"
                          />
                          <div className="flex flex-col gap-0.5">
                            <input
                              value={b.rangeText}
                              onChange={e => setAgeBands(prev => prev.map((x, j) =>
                                j === i ? { ...x, rangeText: e.target.value } : x))}
                              placeholder="e.g. < 115 pg/ml"
                              className="px-2 py-1 text-xs rounded border border-slate-200
                                focus:outline-none focus:ring-1 focus:ring-sky-400 w-full"
                            />
                            {b.label && (
                              <span className="text-xs text-slate-400 pl-0.5">{b.label}</span>
                            )}
                          </div>
                          <button type="button"
                            onClick={() => setAgeBands(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-sky-50/50 border-t border-sky-100 flex items-center justify-between">
                      <button type="button"
                        onClick={() => setAgeBands(prev => [...prev, emptyBand()])}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600
                          hover:text-sky-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                        </svg>
                        Add band
                      </button>
                      <span className="text-xs text-slate-400">
                        Leave To blank (empty) for open-ended (75+)
                      </span>
                    </div>
                  </div>
                )}
              </FormField>
            </div>

            <SH>
              Critical Values
              <span className="ml-2 text-slate-400 font-normal normal-case tracking-normal text-xs">
                (numeric — auto-flags results outside these)
              </span>
            </SH>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Critical Low">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">▼</span>
                  <Input type="number" step="any"
                    className="pl-8"
                    value={form.criticalLow}
                    onChange={e => setF({ criticalLow: e.target.value })}
                    placeholder="e.g. 2.5" />
                </div>
              </FormField>
              <FormField label="Critical High">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">▲</span>
                  <Input type="number" step="any"
                    className="pl-8"
                    value={form.criticalHigh}
                    onChange={e => setF({ criticalHigh: e.target.value })}
                    placeholder="e.g. 6.9" />
                </div>
              </FormField>
            </div>

            {/* Color key */}
            {(form.normalRange || form.criticalLow || form.criticalHigh) && (
              <div className="flex gap-2 flex-wrap mt-1">
                <span className={`text-xs px-2 py-1 rounded border ${RANGE_STYLE.green}`}>🟢 Normal range</span>
                <span className={`text-xs px-2 py-1 rounded border ${RANGE_STYLE.yellow}`}>🟡 Borderline (outside normal, within critical)</span>
                <span className={`text-xs px-2 py-1 rounded border ${RANGE_STYLE.red}`}>🔴 Critical — immediate attention</span>
              </div>
            )}

            {/* ── Result Parameters grid ── */}
            <SH>
              Result Parameters
              <span className="ml-2 text-slate-400 font-normal normal-case tracking-normal text-xs">
                for CBC, LFT, Lipid Profile etc. — leave empty for simple tests
              </span>
            </SH>

            <p className="text-xs text-slate-400 -mt-1">
              <span className="font-medium text-slate-500">Group</span> = category heading (e.g. HAEMATOLOGY).{" "}
              <span className="font-medium text-slate-500">Sub-group</span> = optional mid-level heading for panels like
              {" "}PROTHROMBIN TIME or APTT whose rows (Patient Time, INR, Control) print indented beneath it. Leave Sub-group blank for a flat row.
            </p>

            {params.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  {/* column headers */}
                  <div style={{ minWidth: 1230 }}
                    className="grid grid-cols-[130px_130px_160px_70px_130px_70px_70px_70px_70px_70px_70px_70px_70px_70px_70px_28px]
                      gap-1.5 bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {["Group", "Sub-group", "Parameter", "Unit", "Normal Range", "Nml Min", "Nml Max", "♂ Min", "♂ Max", "♀ Min", "♀ Max", "Child Min", "Child Max", "Crit↓", "Crit↑", ""].map((h, hi) => (
                      <span key={hi}>{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {params.map((p, i) => {
                      const color = rangeColor(
                        typeof p.normalMin === "number" ? p.normalMin : undefined,
                        p.normalMin, p.normalMax, p.criticalLow, p.criticalHigh,
                      );
                      return (
                        <div key={i}
                          style={{ minWidth: 1230 }}
                          className={`grid grid-cols-[130px_130px_160px_70px_130px_70px_70px_70px_70px_70px_70px_70px_70px_70px_70px_28px]
                            gap-1.5 px-3 py-1.5 items-center border-l-4 ${
                            color === "red" ? "border-l-red-400 bg-red-50/30" :
                            color === "yellow" ? "border-l-amber-400 bg-amber-50/30" :
                            "border-l-transparent"
                          }`}>
                          {(["group", "subGroup", "name", "unit"] as const).map(field => (
                            <input key={field} value={String(p[field])}
                              onChange={e => setParams(prev => prev.map((r, j) => j === i ? { ...r, [field]: e.target.value } : r))}
                              placeholder={
                                field === "group" ? "HAEMATOLOGY" :
                                field === "subGroup" ? "PROTHROMBIN TIME" :
                                field === "name" ? "HAEMOGLOBIN" :
                                "g/dL"}
                              className="px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400 w-full bg-white"
                            />
                          ))}
                          {/* normalRange gets a textarea so multi-line ranges
                              (HbA1C, NTproBNP age-bands) can be entered per-parameter */}
                          <textarea
                            rows={1}
                            value={String(p.normalRange)}
                            onChange={e => {
                              const v = e.target.value;
                              setParams(prev => prev.map((r, j) => j === i ? { ...r, normalRange: v } : r));
                              // auto-grow
                              const el = e.target as HTMLTextAreaElement;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            placeholder="14.0–16.0"
                            className="px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400 w-full bg-white resize-none overflow-hidden leading-snug"
                          />
                          {(["normalMin", "normalMax", "maleMin", "maleMax", "femaleMin", "femaleMax", "childMin", "childMax", "criticalLow", "criticalHigh"] as const).map(field => (
                            <input key={field} type="number" step="any"
                              value={p[field] === "" ? "" : String(p[field])}
                              onChange={e => setParams(prev => prev.map((r, j) =>
                                j === i ? { ...r, [field]: e.target.value === "" ? "" : Number(e.target.value) } : r))}
                              placeholder="—"
                              className={`px-1.5 py-1 text-xs rounded border focus:outline-none focus:ring-1 w-full
                                ${field === "criticalLow" || field === "criticalHigh"
                                  ? "border-red-200 bg-red-50 focus:ring-red-300 text-red-700 placeholder:text-red-300"
                                  : "border-slate-200 bg-white focus:ring-purple-400"}`}
                            />
                          ))}
                          <button type="button"
                            onClick={() => setParams(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setParams(prev => [...prev, emptyParam()])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed
                  border-purple-300 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Parameter Row
              </button>
              {params.length > 0 && (
                <button type="button" onClick={() => setParams([])}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Clear all
                </button>
              )}
              {params.length > 0 && (
                <span className="text-xs text-slate-400 ml-auto">
                  {params.length} parameter{params.length !== 1 ? "s" : ""} defined
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Advanced ── */}
        {activeTab === "advanced" && (
          <div className="space-y-4">
            <SH>Methodology</SH>
            <FormField label="Test Method">
              <Input value={form.testMethod}
                onChange={e => setF({ testMethod: e.target.value })}
                placeholder="e.g. Colorimetric, Immunoassay, ELISA, RT-PCR" />
            </FormField>
            <SH>Instructions</SH>
            <FormField label="Special Instructions (for lab staff)">
              <textarea value={form.specialInstructions}
                onChange={e => setF({ specialInstructions: e.target.value })}
                rows={3}
                placeholder="e.g. Keep specimen on ice. Process within 30 minutes of collection."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
            </FormField>
            <SH>Notes</SH>
            <FormField label="Notes / Remarks (internal — not printed on report)">
              <textarea value={form.notes}
                onChange={e => setF({ notes: e.target.value })}
                rows={3}
                placeholder="Internal notes for lab staff…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Result type badge ────────────────────────────────────────────────────────

function ResultTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    NUMERIC:              { label: "Numeric",    cls: "bg-sky-50 text-sky-700 border-sky-200" },
    TEXT:                 { label: "Text",        cls: "bg-slate-50 text-slate-600 border-slate-200" },
    POSITIVE_NEGATIVE:    { label: "+/−",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    DROPDOWN:             { label: "Dropdown",    cls: "bg-purple-50 text-purple-700 border-purple-200" },
    CULTURE_SENSITIVITY:  { label: "C&S",         cls: "bg-orange-50 text-orange-700 border-orange-200" },
    PDF:                  { label: "PDF",         cls: "bg-violet-50 text-violet-700 border-violet-200" },
  };
  const cfg = map[type] ?? { label: type, cls: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-slate-200 rounded w-48" />
        <div className="h-9 bg-slate-200 rounded w-36" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-16">
            <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
            <div className="h-3 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-200 rounded w-36" />
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
            <div className="h-3 bg-slate-200 rounded w-12" />
            <div className="h-5 bg-slate-200 rounded-full w-14 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
