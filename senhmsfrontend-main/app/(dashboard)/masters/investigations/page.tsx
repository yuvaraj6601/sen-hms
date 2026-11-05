"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shape ───────────────────────────────────────────────────
interface InvestigationResponse {
  id: number;
  testCode: string;
  name: string;
  category: string;
  price: number;
  turnaroundTime: string | null;
  normalRange: string | null;
  unit: string | null;
  sampleType: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface Investigation {
  _id: number;
  id: string;
  testCode: string;
  name: string;
  category: string;
  price: number;
  turnaroundTime: string;
  normalRange: string;
  unit: string;
  sampleType: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

function toFrontend(i: InvestigationResponse): Investigation {
  return {
    _id:            i.id,
    id:             String(i.id),
    testCode:       i.testCode,
    name:           i.name,
    category:       i.category,
    price:          i.price,
    turnaroundTime: i.turnaroundTime ?? "",
    normalRange:    i.normalRange ?? "",
    unit:           i.unit ?? "",
    sampleType:     i.sampleType ?? "",
    status:         i.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:      i.createdBy ?? "system",
    createdDate:    i.createdAt ? i.createdAt.slice(0, 10) : "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Haematology", "Biochemistry", "Endocrinology", "Cardiology",
  "Microbiology", "Serology", "Molecular", "Urine", "Stool",
  "Histopathology", "Cytology", "Radiology", "Others",
];

const SAMPLE_TYPES = ["Blood", "Urine", "Stool", "Swab", "Sputum", "CSF", "Tissue", "Other"];

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function emptyForm() {
  return {
    name: "", category: "", price: 0,
    turnaroundTime: "", normalRange: "", unit: "",
    sampleType: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvestigationMastersPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/investigations");

  const { data: raw, loading, error: fetchErr, reload } = useMaster<InvestigationResponse>("/api/masters/investigations");
  const tests = useMemo(() => raw.map(toFrontend), [raw]);

  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("");
  const [sampleFilter, setSampleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Investigation | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  const filtered = useMemo(() => tests.filter((t) => {
    const q = search.toLowerCase();
    const ms = !q ||
      t.name.toLowerCase().includes(q) ||
      t.testCode.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.sampleType.toLowerCase().includes(q);
    const mc  = !catFilter    || t.category   === catFilter;
    const msp = !sampleFilter || t.sampleType === sampleFilter;
    const mst = !statusFilter || t.status     === statusFilter;
    return ms && mc && msp && mst;
  }), [tests, search, catFilter, sampleFilter, statusFilter]);

  const totalActive = tests.filter(t => t.status === "Active").length;
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tests.forEach(t => { m[t.category] = (m[t.category] ?? 0) + 1; });
    return m;
  }, [tests]);

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(t: Investigation) {
    setForm({
      name: t.name, category: t.category, price: t.price,
      turnaroundTime: t.turnaroundTime,
      normalRange:    t.normalRange,
      unit:           t.unit,
      sampleType:     t.sampleType,
      status: t.status === "Active" ? "ACTIVE" : "INACTIVE",
    });
    setErrors({}); setApiError(""); setEditing(t); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())     e.name     = "Test name is required";
    if (!form.category)        e.category = "Category is required";
    if (!form.price || form.price <= 0) e.price = "Enter a valid price";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:           form.name,
      category:       form.category,
      price:          form.price,
      turnaroundTime: form.turnaroundTime || undefined,
      normalRange:    form.normalRange || undefined,
      unit:           form.unit || undefined,
      sampleType:     form.sampleType || undefined,
      status:         form.status,
    };
    const result = editing
      ? await masterUpdate("/api/masters/investigations", editing._id, body)
      : await masterCreate("/api/masters/investigations", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  function clearFilters() { setSearch(""); setCatFilter(""); setSampleFilter(""); setStatusFilter(""); }
  const anyFilter = !!(search || catFilter || sampleFilter || statusFilter);

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Investigation Masters"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Investigations" }]}
        action={canEdit ? { label: "Add Investigation", onClick: openAdd } : undefined}
      />

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SC label="Total Tests" value={String(tests.length)}  color="text-slate-900" />
        <SC label="Active"      value={String(totalActive)}   color="text-emerald-600" />
        <SC label="Inactive"    value={String(tests.length - totalActive)} color="text-slate-400" />
        <SC label="Categories"  value={String(Object.keys(catCounts).length)} color="text-sky-600" />
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
            placeholder="Search test name, code, category…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <DF value={catFilter} onChange={setCatFilter}
          options={[
            { value: "", label: "All Categories" },
            ...CATEGORIES.filter(c => catCounts[c]).map(c => ({ value: c, label: `${c} (${catCounts[c]})` })),
          ]}/>
        <DF value={sampleFilter} onChange={setSampleFilter}
          options={[{ value: "", label: "All Samples" }, ...SAMPLE_TYPES.map(s => ({ value: s, label: s }))]}/>
        <DF value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: "",         label: "All Status" },
            { value: "Active",   label: `Active (${totalActive})` },
            { value: "Inactive", label: `Inactive (${tests.length - totalActive})` },
          ]}/>
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
        <p className="text-xs text-slate-400 self-center">{filtered.length} tests</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Test Code", "Test Name", "Category", "Price", "TAT",
                  "Normal Range", "Unit", "Sample Type", "Created By", "Status",
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
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                          M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    No investigations found
                  </div>
                </td></tr>
              ) : filtered.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">{t.testCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 whitespace-nowrap">{t.name}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={t.category} variant="purple" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{inr(t.price)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {t.turnaroundTime || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px]">
                    <p className="truncate" title={t.normalRange}>{t.normalRange || <span className="text-slate-300">—</span>}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {t.unit || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.sampleType ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        🧪 {t.sampleType}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{t.createdBy}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={t.status} variant={t.status === "Active" ? "green" : "gray"} dot/>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={async () => { await masterToggle("/api/masters/investigations", t._id); reload(); }}
                          className={`p-1.5 rounded-lg transition-colors ${t.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={t.status === "Active" ? "Deactivate" : "Activate"}>
                          {t.status === "Active" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
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
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {tests.length} investigations
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Investigation — ${editing.testCode}` : "Add Investigation"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Investigation"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <SH>Required</SH>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Test Name" required error={errors.name}>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. CBC, Blood Sugar Fasting" autoFocus/>
            </FormField>
            <FormField label="Category" required error={errors.category}>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Price (₹)" required error={errors.price}>
              <Input type="number" min={0} value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="e.g. 250"/>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>
          <SH>Optional Details</SH>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="TAT (Turnaround Time)">
              <Input value={form.turnaroundTime} onChange={e => setForm(f => ({ ...f, turnaroundTime: e.target.value }))} placeholder="e.g. 2 hours, 48 hours"/>
            </FormField>
            <FormField label="Sample Type">
              <Select value={form.sampleType} onChange={e => setForm(f => ({ ...f, sampleType: e.target.value }))}>
                <option value="">Select sample…</option>
                {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Normal Range">
              <Input value={form.normalRange} onChange={e => setForm(f => ({ ...f, normalRange: e.target.value }))} placeholder="e.g. 70–110 mg/dL"/>
            </FormField>
            <FormField label="Unit">
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. mg/dL, K/µL, %"/>
            </FormField>
          </div>
        </div>
      </Modal>
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

function DF({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-red-600 font-medium">{msg}</p>
      <button onClick={onRetry} className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">Retry</button>
    </div>
  );
}
