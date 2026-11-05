"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import type { Department } from "../../../_lib/types";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shape ───────────────────────────────────────────────────
interface DeptResponse {
  id: number;
  deptCode: string;
  name: string;
  shortName: string;
  type: string;
  hasWards: boolean;
  totalBeds?: number;
  occupiedBeds?: number;
  floor?: string;
  headName?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: string;
  createdAt?: string;
}

function toFrontend(d: DeptResponse): Department & { _id: number } {
  return {
    _id:          d.id,
    id:           String(d.id),
    deptCode:     d.deptCode,
    name:         d.name,
    shortName:    d.shortName,
    type:         capitalize(d.type) as Department["type"],
    hasWards:     d.hasWards,
    totalBeds:    d.totalBeds,
    floor:        d.floor,
    status:       d.status === "ACTIVE" ? "Active" : "Inactive",
    head:         d.headName ?? "—",
    occupiedBeds: d.occupiedBeds ?? 0,
    phone:        d.phone ?? "",
    createdBy:    d.createdBy ?? "system",
    createdDate:  d.createdAt ? d.createdAt.slice(0, 10) : "",
  };
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPT_TYPES: Department["type"][] = [
  "Clinical", "Surgical", "Diagnostic", "Administrative", "Support",
];

const TYPE_COLORS: Record<Department["type"], "sky" | "red" | "purple" | "yellow" | "gray"> = {
  Clinical: "sky", Surgical: "red", Diagnostic: "purple",
  Administrative: "yellow", Support: "gray",
};

const TYPE_ICONS: Record<Department["type"], string> = {
  Clinical: "🩺", Surgical: "🔪", Diagnostic: "🔬",
  Administrative: "🏢", Support: "🛠️",
};

const FLOORS = [
  "Basement", "Ground Floor", "1st Floor", "2nd Floor",
  "3rd Floor", "4th Floor", "5th Floor",
];

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    name: "", shortName: "", type: "Clinical" as Department["type"],
    hasWards: false, totalBeds: undefined as number | undefined,
    floor: "", headName: "", phone: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/departments");

  const { data: raw, loading, error: fetchErr, reload } = useMaster<DeptResponse>("/api/masters/departments");
  const departments = useMemo(() => raw.map(toFrontend), [raw]);

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wardsFilter,  setWardsFilter]  = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<(Department & { _id: number }) | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");
  const [viewDept,  setViewDept]  = useState<(Department & { _id: number }) | null>(null);

  const filtered = useMemo(() => {
    return departments.filter((d) => {
      const q = search.toLowerCase();
      const ms = !q || d.name.toLowerCase().includes(q) ||
        d.shortName.toLowerCase().includes(q) || d.deptCode.toLowerCase().includes(q) ||
        (d.floor ?? "").toLowerCase().includes(q);
      const mt = !typeFilter   || d.type   === typeFilter;
      const ms2 = !statusFilter || d.status === statusFilter;
      const mw = !wardsFilter || (wardsFilter === "yes" ? d.hasWards : !d.hasWards);
      return ms && mt && ms2 && mw;
    });
  }, [departments, search, typeFilter, statusFilter, wardsFilter]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    departments.forEach((d) => { m[d.type] = (m[d.type] ?? 0) + 1; });
    return m;
  }, [departments]);

  const totalBeds   = departments.reduce((s, d) => s + (d.totalBeds ?? 0), 0);
  const totalActive = departments.filter((d) => d.status === "Active").length;
  const withWards   = departments.filter((d) => d.hasWards).length;

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(d: Department & { _id: number }) {
    setForm({
      name: d.name, shortName: d.shortName,
      type: d.type, hasWards: d.hasWards, totalBeds: d.totalBeds,
      floor: d.floor ?? "", headName: d.head !== "—" ? d.head : "",
      phone: d.phone,
      status: d.status === "Active" ? "ACTIVE" : "INACTIVE",
    });
    setErrors({}); setApiError(""); setEditing(d); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())      e.name      = "Department name is required";
    if (!form.shortName.trim()) e.shortName = "Short name is required";
    if (!form.type)             e.type      = "Type is required";
    if (form.hasWards && (!form.totalBeds || form.totalBeds < 1))
      e.totalBeds = "Enter total beds (≥ 1) when wards are enabled";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:      form.name,
      shortName: form.shortName.toUpperCase(),
      type:      form.type.toUpperCase(),
      hasWards:  form.hasWards,
      totalBeds: form.hasWards ? form.totalBeds : undefined,
      floor:     form.floor || undefined,
      headName:  form.headName || undefined,
      phone:     form.phone || undefined,
      status:    form.status,
    };
    const result = editing
      ? await masterUpdate(          "/api/masters/departments", editing._id, body)
      : await masterCreate("/api/masters/departments", body);

    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  async function handleToggle(d: Department & { _id: number }) {
    await masterToggle("/api/masters/departments", d._id);
    reload();
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Hospital Departments"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Masters" },
          { label: "Departments" },
        ]}
        action={canEdit ? { label: "Add Department", onClick: openAdd } : undefined}
      />

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Departments" value={departments.length} color="text-slate-900" />
        <StatCard label="Active"            value={totalActive}        color="text-emerald-600" />
        <StatCard label="With Wards"        value={withWards}          color="text-sky-600" />
        <StatCard label="Total Beds"        value={totalBeds}          color="text-indigo-600" />
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, short name, code, floor…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <DropFilter value={typeFilter} onChange={setTypeFilter} label="All Types">
          {DEPT_TYPES.map((t) => (
            <option key={t} value={t}>{t} ({typeCounts[t] ?? 0})</option>
          ))}
        </DropFilter>
        <DropFilter value={statusFilter} onChange={setStatusFilter} label="All Status">
          <option value="Active">Active ({totalActive})</option>
          <option value="Inactive">Inactive ({departments.length - totalActive})</option>
        </DropFilter>
        <DropFilter value={wardsFilter} onChange={setWardsFilter} label="Has Wards (All)">
          <option value="yes">With Wards ({withWards})</option>
          <option value="no">Without Wards ({departments.length - withWards})</option>
        </DropFilter>
        {(search || typeFilter || statusFilter || wardsFilter) && (
          <button onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setWardsFilter(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Dept Code", "Department", "Short Name", "Type", "Has Wards",
                  "Total Beds", "Floor / Location", "Created By", "Created Date", "Status",
                  ...(canEdit ? ["Actions"] : [])
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 11 : 10}
                  className="px-4 py-12 text-center text-slate-400">
                  No departments found
                </td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                      {d.deptCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewDept(d)}
                      className="flex items-center gap-2.5 text-left group">
                      <span className="text-lg">{TYPE_ICONS[d.type]}</span>
                      <div>
                        <p className="font-semibold text-slate-800 group-hover:text-sky-600
                          transition-colors whitespace-nowrap">{d.name}</p>
                        {d.head && d.head !== "—" && (
                          <p className="text-xs text-slate-400">{d.head}</p>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {d.shortName}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={d.type} variant={TYPE_COLORS[d.type]} />
                  </td>
                  <td className="px-4 py-3">
                    {d.hasWards ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.totalBeds !== undefined ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-50 text-sky-700 text-xs font-bold">
                        {d.totalBeds}
                      </span>
                    ) : <span className="text-slate-300 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {d.floor || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{d.createdBy}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{d.createdDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={d.status} variant={d.status === "Active" ? "green" : "gray"} dot />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(d as Department & { _id: number })}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleToggle(d as Department & { _id: number })}
                          className={`p-1.5 rounded-lg transition-colors ${d.status === "Active"
                            ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                            : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={d.status === "Active" ? "Deactivate" : "Activate"}>
                          {d.status === "Active" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          {filtered.length} of {departments.length} departments
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Department — ${editing.deptCode}` : "Add New Department"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Department"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {apiError}
            </div>
          )}

          <SH>Department Details</SH>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. General Medicine" autoFocus />
            </FormField>
            <FormField label="Short Name" required error={errors.shortName}>
              <Input value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value.toUpperCase() })}
                placeholder="e.g. GM, ICU, SURG" maxLength={10} />
              <p className="text-xs text-slate-400 mt-1">Uppercase abbreviation used in reports.</p>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department Type" required error={errors.type}>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Department["type"] })}>
                {DEPT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>

          <SH>Wards & Beds</SH>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setForm({ ...form, hasWards: !form.hasWards, totalBeds: form.hasWards ? undefined : form.totalBeds })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.hasWards ? "bg-sky-500" : "bg-slate-200"}`}
              role="switch" aria-checked={form.hasWards}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.hasWards ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700">Has Wards</p>
              <p className="text-xs text-slate-400">
                {form.hasWards ? "This department has ward beds for admitted patients." : "OPD / diagnostic — no inpatient wards."}
              </p>
            </div>
          </div>
          {form.hasWards && (
            <FormField label="Total Beds" required error={errors.totalBeds}>
              <Input type="number" min={1} value={form.totalBeds ?? ""}
                onChange={(e) => setForm({ ...form, totalBeds: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="e.g. 20" className="max-w-[140px]" />
            </FormField>
          )}

          <SH>Location & Contact</SH>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Floor / Location">
              <Select value={form.floor ?? ""}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}>
                <option value="">Not specified</option>
                {FLOORS.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </FormField>
            <FormField label="Head of Department">
              <Input value={form.headName}
                onChange={(e) => setForm({ ...form, headName: e.target.value })}
                placeholder="Dr. Name" />
            </FormField>
          </div>
          <FormField label="Phone">
            <Input value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Ext. number" className="max-w-[200px]" />
          </FormField>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal open={!!viewDept} onClose={() => setViewDept(null)} title="Department Details" size="md">
        {viewDept && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl flex-shrink-0">
                {TYPE_ICONS[viewDept.type]}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">{viewDept.deptCode}</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{viewDept.shortName}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{viewDept.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge label={viewDept.type} variant={TYPE_COLORS[viewDept.type]} />
                  <Badge label={viewDept.status} variant={viewDept.status === "Active" ? "green" : "gray"} dot />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Has Wards"    value={viewDept.hasWards ? "Yes" : "No"} />
              <InfoRow label="Total Beds"   value={viewDept.totalBeds !== undefined ? String(viewDept.totalBeds) : "—"} />
              <InfoRow label="Floor"        value={viewDept.floor || "—"} />
              <InfoRow label="Head"         value={viewDept.head || "—"} />
              <InfoRow label="Created By"   value={viewDept.createdBy} />
              <InfoRow label="Created Date" value={viewDept.createdDate} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function DropFilter({ value, onChange, label, children }: {
  value: string; onChange: (v: string) => void; label: string; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
        <option value="">{label}</option>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
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
      <button onClick={onRetry}
        className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">
        Retry
      </button>
    </div>
  );
}
