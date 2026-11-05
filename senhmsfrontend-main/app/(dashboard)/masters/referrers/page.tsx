"use client";

import { useState, useMemo } from "react";
import { getSession } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shape ───────────────────────────────────────────────────
interface ReferrerResponse {
  id: number;
  name: string;
  type: "DOCTOR" | "HOSPITAL" | "CLINIC" | "INDIVIDUAL" | "OTHER";
  specialization: string | null;
  organization: string | null;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

// ─── Frontend types ───────────────────────────────────────────────────────────
type ReferrerType = "Doctor" | "Hospital" | "Clinic" | "Individual" | "Other";
type ReferrerStatus = "Active" | "Inactive";

interface Referrer {
  _id: number;
  id: string;
  name: string;
  type: ReferrerType;
  specialization: string;
  organization: string;
  phone: string;
  alternatePhone: string;
  address: string;
  notes: string;
  status: ReferrerStatus;
  createdBy: string;
  createdDate: string;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────
const TYPE_MAP: Record<ReferrerResponse["type"], ReferrerType> = {
  DOCTOR:     "Doctor",
  HOSPITAL:   "Hospital",
  CLINIC:     "Clinic",
  INDIVIDUAL: "Individual",
  OTHER:      "Other",
};

const TYPE_MAP_REVERSE: Record<ReferrerType, ReferrerResponse["type"]> = {
  Doctor:     "DOCTOR",
  Hospital:   "HOSPITAL",
  Clinic:     "CLINIC",
  Individual: "INDIVIDUAL",
  Other:      "OTHER",
};

function toFrontend(r: ReferrerResponse): Referrer {
  return {
    _id:            r.id,
    id:             String(r.id),
    name:           r.name,
    type:           TYPE_MAP[r.type] ?? "Other",
    specialization: r.specialization ?? "",
    organization:   r.organization ?? "",
    phone:          r.phone,
    alternatePhone: r.alternatePhone ?? "",
    address:        r.address ?? "",
    notes:          r.notes ?? "",
    status:         r.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:      r.createdBy ?? "system",
    createdDate:    r.createdAt ? r.createdAt.slice(0, 10) : "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REFERRER_TYPES: ReferrerType[] = ["Doctor", "Hospital", "Clinic", "Individual", "Other"];

const TYPE_COLORS: Record<ReferrerType, "sky" | "indigo" | "green" | "yellow" | "gray"> = {
  Doctor:     "sky",
  Hospital:   "indigo",
  Clinic:     "green",
  Individual: "yellow",
  Other:      "gray",
};

const TYPE_ICONS: Record<ReferrerType, string> = {
  Doctor:     "👨‍⚕️",
  Hospital:   "🏥",
  Clinic:     "🏪",
  Individual: "👤",
  Other:      "📋",
};

function emptyForm() {
  return {
    name: "", type: "Doctor" as ReferrerType,
    specialization: "", organization: "",
    phone: "", alternatePhone: "", address: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    notes: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReferrersPage() {
  const session = getSession();
  const role    = session?.role ?? "Receptionist";
  const canEdit = ["Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);

  const { data: raw, loading, error: fetchErr, reload } = useMaster<ReferrerResponse>("/api/masters/referrers");
  const referrers = useMemo(() => raw.map(toFrontend), [raw]);

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Referrer | null>(null);
  const [form,         setForm]         = useState(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [apiError,     setApiError]     = useState("");
  const [viewReferrer, setViewReferrer] = useState<Referrer | null>(null);

  const filtered = useMemo(() => {
    return referrers.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.organization.toLowerCase().includes(q) ||
        r.specialization.toLowerCase().includes(q);
      const matchType   = !typeFilter   || r.type   === typeFilter;
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [referrers, search, typeFilter, statusFilter]);

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    referrers.forEach((r) => { map[r.type] = (map[r.type] ?? 0) + 1; });
    return map;
  }, [referrers]);

  const totalActive = referrers.filter((r) => r.status === "Active").length;

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(r: Referrer) {
    setForm({
      name: r.name, type: r.type,
      specialization: r.specialization,
      organization:   r.organization,
      phone: r.phone, alternatePhone: r.alternatePhone,
      address: r.address,
      status: r.status === "Active" ? "ACTIVE" : "INACTIVE",
      notes: r.notes,
    });
    setErrors({}); setApiError(""); setEditing(r); setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Name is required";
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:           form.name,
      type:           TYPE_MAP_REVERSE[form.type],
      specialization: form.specialization || undefined,
      organization:   form.organization || undefined,
      phone:          form.phone,
      alternatePhone: form.alternatePhone || undefined,
      address:        form.address || undefined,
      notes:          form.notes || undefined,
      status:         form.status,
    };
    const result = editing
      ? await masterUpdate("/api/masters/referrers", editing._id, body)
      : await masterCreate("/api/masters/referrers", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  async function handleToggleStatus(r: Referrer) {
    await masterToggle("/api/masters/referrers", r._id);
    reload();
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Referrer List"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Referrers" }]}
        action={canEdit ? { label: "Add Referrer", onClick: openAdd } : undefined}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Total Referrers</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{referrers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Types</p>
          <p className="text-2xl font-bold text-sky-600 mt-0.5">{Object.keys(typeCounts).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Inactive</p>
          <p className="text-2xl font-bold text-slate-400 mt-0.5">{referrers.length - totalActive}</p>
        </div>
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {REFERRER_TYPES.map((t) => (
          <button key={t}
            onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
              ${typeFilter === t
                ? "bg-sky-500 text-white border-sky-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
              }`}>
            <span>{TYPE_ICONS[t]}</span>
            {t}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
              ${typeFilter === t ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
              {typeCounts[t] ?? 0}
            </span>
          </button>
        ))}
        {typeFilter && (
          <button onClick={() => setTypeFilter("")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, organization…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-xs text-slate-400 self-center">{filtered.length} results</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Referrer", "Type", "Specialization / Organization", "Phone", "Alternate Phone", "Address", "Status", ...(canEdit ? ["Actions"] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      No referrers found
                    </div>
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${r.status === "Inactive" ? "opacity-50" : ""}`}>
                        <span>{TYPE_ICONS[r.type]}</span>
                      </div>
                      <div>
                        <button onClick={() => setViewReferrer(r)}
                          className="font-semibold text-slate-800 hover:text-sky-600 whitespace-nowrap text-left transition-colors">
                          {r.name}
                        </button>
                        {r.notes && <p className="text-xs text-slate-400 max-w-[140px] truncate">{r.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={r.type} variant={TYPE_COLORS[r.type]} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 whitespace-nowrap">
                      {r.specialization && <p className="font-medium">{r.specialization}</p>}
                      {r.organization && <p className="text-xs text-slate-400">{r.organization}</p>}
                      {!r.specialization && !r.organization && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.phone}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.alternatePhone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px]">
                    <p className="truncate" title={r.address}>{r.address || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={r.status} variant={r.status === "Active" ? "green" : "gray"} dot />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleToggleStatus(r)}
                          className={`p-1.5 rounded-lg transition-colors ${r.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={r.status === "Active" ? "Deactivate" : "Activate"}>
                          {r.status === "Active" ? (
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
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {referrers.length} referrers
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Referrer — ${editing.name}` : "Add New Referrer"}
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
              {editing ? "Save Changes" : "Add Referrer"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus/>
            </FormField>
            <FormField label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ReferrerType, specialization: "", organization: "" })}>
                {REFERRER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </FormField>
          </div>

          {form.type === "Doctor" && (
            <FormField label="Specialization">
              <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. General Physician, Cardiologist" />
            </FormField>
          )}

          {(form.type === "Hospital" || form.type === "Clinic" || form.type === "Doctor" || form.type === "Other") && (
            <FormField label={form.type === "Doctor" ? "Clinic / Hospital Name" : "Organization Name"}>
              <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="Organization or clinic name" />
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone" required error={errors.phone}>
              <Input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile number" />
            </FormField>
            <FormField label="Alternate Phone">
              <Input type="tel" inputMode="numeric" maxLength={10} value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value.replace(/\D/g, "") })} placeholder="Optional" />
            </FormField>
          </div>

          <FormField label="Address">
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Clinic / hospital address" rows={2} />
          </FormField>

          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FormField>

          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal open={!!viewReferrer} onClose={() => setViewReferrer(null)} title="Referrer Details" size="sm">
        {viewReferrer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl flex-shrink-0">
                {TYPE_ICONS[viewReferrer.type]}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{viewReferrer.name}</h3>
                <Badge label={viewReferrer.type} variant={TYPE_COLORS[viewReferrer.type]} />
                <span className="ml-2">
                  <Badge label={viewReferrer.status} variant={viewReferrer.status === "Active" ? "green" : "gray"} dot />
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {viewReferrer.specialization && <InfoRow label="Specialization" value={viewReferrer.specialization} />}
              {viewReferrer.organization && <InfoRow label="Organization" value={viewReferrer.organization} />}
              <InfoRow label="Phone" value={viewReferrer.phone} />
              {viewReferrer.alternatePhone && <InfoRow label="Alt. Phone" value={viewReferrer.alternatePhone} />}
              <InfoRow label="Created" value={viewReferrer.createdDate} />
            </div>
            {viewReferrer.address && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Address</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{viewReferrer.address}</p>
              </div>
            )}
            {viewReferrer.notes && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600 italic">{viewReferrer.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
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
