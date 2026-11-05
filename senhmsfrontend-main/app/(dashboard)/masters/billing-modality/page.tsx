"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shape ───────────────────────────────────────────────────
interface ModalityResponse {
  id: number;
  modalityCode: string;
  name: string;
  shortName: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface BillingModality {
  _id: number;
  id: string;
  modalityCode: string;
  name: string;
  shortName: string;
  description: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

function toFrontend(m: ModalityResponse): BillingModality {
  return {
    _id:          m.id,
    id:           String(m.id),
    modalityCode: m.modalityCode,
    name:         m.name,
    shortName:    m.shortName,
    description:  m.description ?? "",
    status:       m.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:    m.createdBy ?? "system",
    createdDate:  m.createdAt ? m.createdAt.slice(0, 10) : "",
  };
}

function emptyForm() {
  return { name: "", shortName: "", description: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BillingModalityPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/billing-modality");

  const { data: raw, loading, error: fetchErr, reload } =
    useMaster<ModalityResponse>("/api/masters/billing-modalities");
  const modalities = useMemo(() => raw.map(toFrontend), [raw]);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<BillingModality | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  const filtered = useMemo(() => {
    return modalities.filter((m) => {
      const q = search.toLowerCase();
      const ms = !q ||
        m.name.toLowerCase().includes(q) ||
        m.shortName.toLowerCase().includes(q) ||
        m.modalityCode.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q);
      const mst = !statusFilter || m.status === statusFilter;
      return ms && mst;
    });
  }, [modalities, search, statusFilter]);

  const totalActive = modalities.filter((m) => m.status === "Active").length;

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(m: BillingModality) {
    setForm({ name: m.name, shortName: m.shortName, description: m.description,
      status: m.status === "Active" ? "ACTIVE" : "INACTIVE" });
    setErrors({}); setApiError(""); setEditing(m); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())      e.name      = "Modality name is required";
    if (!form.shortName.trim()) e.shortName = "Short name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:        form.name,
      shortName:   form.shortName.toUpperCase(),
      description: form.description || undefined,
      status:      form.status,
    };
    const result = editing
      ? await masterUpdate("/api/masters/billing-modalities", editing._id, body)
      : await masterCreate("/api/masters/billing-modalities", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  async function handleToggle(m: BillingModality) {
    await masterToggle("/api/masters/billing-modalities", m._id);
    reload();
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Billing Modality"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Masters" },
          { label: "Billing Modality" },
        ]}
        action={canEdit ? { label: "Add Modality", onClick: openAdd } : undefined}
      />

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Total Modalities</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{modalities.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Inactive</p>
          <p className="text-2xl font-bold text-slate-400 mt-0.5">{modalities.length - totalActive}</p>
        </div>
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, short name, code…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            <option value="Active">Active ({totalActive})</option>
            <option value="Inactive">Inactive ({modalities.length - totalActive})</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(""); setStatusFilter(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center whitespace-nowrap">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "#", "Modality Code", "Modality Name", "Short Name",
                  "Description", "Created By", "Created Date", "Status",
                  ...(canEdit ? ["Actions"] : []),
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
                      </svg>
                      No modalities found
                    </div>
                  </td>
                </tr>
              ) : filtered.map((m, idx) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs w-10">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                      {m.modalityCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 whitespace-nowrap">{m.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {m.shortName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs">
                    <p className="truncate" title={m.description}>
                      {m.description || <span className="text-slate-300">—</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{m.createdBy}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{m.createdDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={m.status} variant={m.status === "Active" ? "green" : "gray"} dot />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleToggle(m)}
                          className={`p-1.5 rounded-lg transition-colors ${m.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={m.status === "Active" ? "Deactivate" : "Activate"}>
                          {m.status === "Active" ? (
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
          {filtered.length} of {modalities.length} modalities
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Modality — ${editing.modalityCode}` : "Add Billing Modality"}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Modality"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Modality Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Consultation" autoFocus/>
            </FormField>
            <FormField label="Short Name" required error={errors.shortName}>
              <Input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value.toUpperCase() })} placeholder="e.g. CONS" maxLength={8}/>
              <p className="text-xs text-slate-400 mt-1">Uppercase abbreviation used in bills.</p>
            </FormField>
          </div>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this billing group…" rows={2}/>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FormField>
        </div>
      </Modal>
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
            <div className="h-3 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-200 rounded w-36" />
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
