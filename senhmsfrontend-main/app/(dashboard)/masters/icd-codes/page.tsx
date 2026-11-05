"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type CodeType = "ICD_10_CM" | "ICD_10_PCS";

interface IcdCodeResponse {
  id: number;
  complaint: string;
  icdCode: string;
  description: string;
  codeType: CodeType;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface IcdCodeRow {
  _id: number;
  complaint: string;
  icdCode: string;
  description: string;
  codeType: CodeType;
  codeTypeLabel: string;
  status: "Active" | "Inactive";
}

function toRow(r: IcdCodeResponse): IcdCodeRow {
  return {
    _id:           r.id,
    complaint:     r.complaint ?? "",
    icdCode:       r.icdCode ?? "",
    description:   r.description ?? "",
    codeType:      r.codeType ?? "ICD_10_CM",
    codeTypeLabel: r.codeType === "ICD_10_PCS" ? "ICD-10-PCS" : "ICD-10-CM",
    status:        (r.status ?? "ACTIVE") === "ACTIVE" ? "Active" : "Inactive",
  };
}

function emptyForm() {
  return { complaint: "", icdCode: "", description: "", codeType: "ICD_10_CM" as CodeType };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IcdCodesPage() {
  const session = getSession();
  const role    = session?.role ?? "Admin";
  const canEdit = checkEdit(role, "masters/icd-codes");

  const { data: raw, loading, error, reload } =
    useMaster<IcdCodeResponse>("/api/masters/icd-codes");

  const rows = useMemo(() => raw.map(toRow), [raw]);

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<IcdCodeRow | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter((r) => {
    const q  = search.toLowerCase();
    const mq = !q || r.complaint.toLowerCase().includes(q)
                  || r.icdCode.toLowerCase().includes(q)
                  || r.description.toLowerCase().includes(q);
    const mt = !typeFilter   || r.codeType === typeFilter;
    const ms = !statusFilter || r.status   === statusFilter;
    return mq && mt && ms;
  }), [rows, search, typeFilter, statusFilter]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setApiError("");
    setModalOpen(true);
  }

  function openEdit(row: IcdCodeRow) {
    setEditing(row);
    setForm({
      complaint:   row.complaint,
      icdCode:     row.icdCode,
      description: row.description,
      codeType:    row.codeType,
    });
    setErrors({});
    setApiError("");
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.complaint.trim())   e.complaint   = "Complaint is required";
    if (!form.icdCode.trim())     e.icdCode     = "ICD code is required";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const payload = {
        complaint:   form.complaint.trim(),
        icdCode:     form.icdCode.trim().toUpperCase(),
        description: form.description.trim(),
        codeType:    form.codeType,
      };
      let result: { error?: string };
      if (editing) {
        result = await masterUpdate("/api/masters/icd-codes", editing._id, payload);
      } else {
        result = await masterCreate("/api/masters/icd-codes", payload);
      }
      if (result.error) { setApiError(result.error); return; }
      setModalOpen(false);
      reload();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(row: IcdCodeRow) {
    await masterToggle("/api/masters/icd-codes", row._id);
    reload();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCM  = rows.filter(r => r.codeType === "ICD_10_CM"  && r.status === "Active").length;
  const activePCS = rows.filter(r => r.codeType === "ICD_10_PCS" && r.status === "Active").length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-7 bg-slate-200 rounded w-40" />
          <div className="h-9 bg-slate-200 rounded-lg w-28" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-7 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 h-9 bg-slate-100 rounded-lg" />
            <div className="h-9 w-44 bg-slate-100 rounded-lg" />
            <div className="h-9 w-32 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-24 mt-3" />
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-6">
            {[10, 16, 28, 14, 12, 10].map((w, i) => (
              <div key={i} className={`h-3 bg-slate-200 rounded w-${w}`} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-6 border-b border-slate-100 last:border-0">
              <div className="h-5 bg-slate-100 rounded w-20 flex-shrink-0" />
              <div className="h-3 bg-slate-200 rounded w-40 flex-shrink-0" />
              <div className="h-3 bg-slate-100 rounded flex-1" />
              <div className="h-5 bg-slate-100 rounded-full w-24 flex-shrink-0" />
              <div className="h-5 bg-slate-100 rounded-full w-16 flex-shrink-0" />
              <div className="flex gap-2 flex-shrink-0">
                <div className="h-4 bg-slate-100 rounded w-8" />
                <div className="h-4 bg-slate-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ICD / PCS Codes"
        action={canEdit ? { label: "Add Code", onClick: openCreate } : undefined}
      />

      {error && <ErrorBanner msg={error} />}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Codes", value: rows.length,                                      color: "text-slate-700" },
          { label: "Active",      value: rows.filter(r => r.status === "Active").length,   color: "text-emerald-600" },
          { label: "ICD-10-CM",   value: activeCM,                                         color: "text-sky-600" },
          { label: "ICD-10-PCS",  value: activePCS,                                        color: "text-violet-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search complaint, code or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Types</option>
            <option value="ICD_10_CM">ICD-10-CM (Diagnosis)</option>
            <option value="ICD_10_PCS">ICD-10-PCS (Procedure)</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          {(search || typeFilter || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} of {rows.length} codes</p>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">ICD Code</th>
                <th className="px-4 py-3 text-left font-semibold">Complaint</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                {canEdit && <th className="px-4 py-3 text-left font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5}
                    className="px-4 py-12 text-center text-slate-400 text-sm">
                    {rows.length === 0
                      ? 'No ICD codes added yet. Click "Add Code" to get started.'
                      : "No codes match the current filters."}
                  </td>
                </tr>
              ) : filtered.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-xs">
                      {row.icdCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-48 truncate"
                    title={row.complaint}>{row.complaint}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-72 truncate"
                    title={row.description}>{row.description}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      row.codeType === "ICD_10_CM"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-violet-100 text-violet-700"
                    }`}>
                      {row.codeTypeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge label={row.status} /></td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(row)}
                          className="text-xs text-sky-600 hover:text-sky-800 font-medium">
                          Edit
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => handleToggle(row)}
                          className={`text-xs font-medium ${
                            row.status === "Active"
                              ? "text-red-500 hover:text-red-700"
                              : "text-emerald-600 hover:text-emerald-800"
                          }`}>
                          {row.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit ICD Code" : "Add ICD / PCS Code"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600
                disabled:bg-sky-300 rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {saving ? "Saving…" : editing ? "Update" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {apiError && <ErrorBanner msg={apiError} />}

          <FormField label="Complaint" required error={errors.complaint}>
            <Input
              type="text"
              value={form.complaint}
              onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))}
              placeholder="e.g. Acute Chest Pain"
              className={errors.complaint ? "border-red-400 focus:ring-red-400" : ""}
            />
          </FormField>

          <FormField label="ICD-10-CM / PCS Code" required error={errors.icdCode}>
            <Input
              type="text"
              value={form.icdCode}
              onChange={e => setForm(f => ({ ...f, icdCode: e.target.value.toUpperCase() }))}
              placeholder="e.g. R07.9"
              className={errors.icdCode ? "border-red-400 focus:ring-red-400" : ""}
            />
          </FormField>

          <FormField label="Description" required error={errors.description}>
            <Input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Chest pain, unspecified"
              className={errors.description ? "border-red-400 focus:ring-red-400" : ""}
            />
          </FormField>

          <FormField label="Code Type" required>
            <Select
              value={form.codeType}
              onChange={e => setForm(f => ({ ...f, codeType: e.target.value as CodeType }))}
            >
              <option value="ICD_10_CM">ICD-10-CM (Diagnosis)</option>
              <option value="ICD_10_PCS">ICD-10-PCS (Procedure)</option>
            </Select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
