"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = "AREA" | "DISTRICT" | "UNIT" | "TPA";

interface DropdownOptionResponse {
  id: number;
  category: Category;
  label: string;
  displayOrder: number | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface Row {
  _id: number;
  label: string;
  displayOrder: number | null;
  status: "Active" | "Inactive";
}

function toRow(r: DropdownOptionResponse): Row {
  return {
    _id:          r.id,
    label:        r.label ?? "",
    displayOrder: r.displayOrder ?? null,
    status:       (r.status ?? "ACTIVE") === "ACTIVE" ? "Active" : "Inactive",
  };
}

// Per-category UI labels so the page reads naturally for each list.
const CATEGORIES: { key: Category; tab: string; singular: string; placeholder: string }[] = [
  { key: "AREA",     tab: "Areas",     singular: "Area",     placeholder: "e.g. Anna Nagar" },
  { key: "DISTRICT", tab: "Districts", singular: "District", placeholder: "e.g. Chennai" },
  { key: "UNIT",     tab: "Units",     singular: "Unit",     placeholder: "e.g. mg/dL" },
  { key: "TPA",      tab: "TPA Names", singular: "TPA",      placeholder: "e.g. Medi Assist" },
];

const API = "/api/masters/dropdowns";

function emptyForm() {
  return { label: "", displayOrder: "" as number | "" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DropdownsPage() {
  const session = getSession();
  const role    = session?.role ?? "Admin";
  const canEdit = checkEdit(role, "masters/dropdowns");

  const [category, setCategory] = useState<Category>("AREA");
  const meta = CATEGORIES.find((c) => c.key === category)!;

  // Re-fetches whenever the category changes (params feed into the query string).
  const { data: raw, loading, error, reload } = useMaster<DropdownOptionResponse>(API, {
    params: { category },
  });

  const rows = useMemo(() => raw.map(toRow), [raw]);

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Row | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  const filtered = useMemo(() => rows.filter((r) => {
    const q  = search.trim().toLowerCase();
    const mq = !q || r.label.toLowerCase().includes(q);
    const ms = !statusFilter || r.status === statusFilter;
    return mq && ms;
  }), [rows, search, statusFilter]);

  function switchCategory(c: Category) {
    setCategory(c);
    setSearch("");
    setStatusFilter("");
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setApiError("");
    setModalOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setForm({ label: row.label, displayOrder: row.displayOrder ?? "" });
    setErrors({});
    setApiError("");
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.label.trim()) e.label = `${meta.singular} value is required`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const payload = {
        category,
        label: form.label.trim(),
        displayOrder: form.displayOrder === "" ? null : Number(form.displayOrder),
      };
      const result = editing
        ? await masterUpdate(API, editing._id, payload)
        : await masterCreate(API, payload);
      if (result.error) { setApiError(result.error); return; }
      setModalOpen(false);
      reload();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(row: Row) {
    await masterToggle(API, row._id);
    reload();
  }

  const activeCount = rows.filter((r) => r.status === "Active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dropdowns"
        action={canEdit ? { label: `Add ${meta.singular}`, onClick: openCreate } : undefined}
      />

      {error && <ErrorBanner msg={error} />}

      {/* ── Category tabs ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => switchCategory(c.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              category === c.key
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {c.tab}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: `Total ${meta.tab}`, value: rows.length,                color: "text-slate-700" },
          { label: "Active",            value: activeCount,                color: "text-emerald-600" },
          { label: "Inactive",          value: rows.length - activeCount,  color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${meta.tab.toLowerCase()}…`}
            className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        </div>
        <p className="text-xs text-slate-400 mt-3">{filtered.length} {meta.tab.toLowerCase()}</p>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{meta.singular}</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              {canEdit && <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                No {meta.tab.toLowerCase()} found
              </td></tr>
            ) : filtered.map((row, idx) => (
              <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                <td className="px-4 py-3 text-slate-500">{row.displayOrder ?? "—"}</td>
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

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${meta.singular}` : `Add ${meta.singular}`}
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

          <FormField label={`${meta.singular} Value`} required error={errors.label}>
            <Input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={meta.placeholder}
              className={errors.label ? "border-red-400 focus:ring-red-400" : ""}
            />
          </FormField>

          <FormField label="Display Order">
            <Input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayOrder: e.target.value === "" ? "" : Number(e.target.value) }))
              }
              placeholder="Lower shows first (optional)"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
