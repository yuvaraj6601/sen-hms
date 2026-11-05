"use client";

import { useState, useMemo } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";
import TariffManager from "./TariffManager";

// ─── Backend response shape ───────────────────────────────────────────────────
interface InsuranceCompanyResponse {
  id: number;
  companyCode: string;
  name: string;
  tpaName: string;
  tpaNames: string[] | null;
  contactPerson: string;
  phone: string;
  email: string | null;
  address: string | null;
  tariffEffectiveFrom: string | null;
  tariffEffectiveTo: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface InsuranceCompany {
  _id: number;
  id: string;
  companyCode: string;
  name: string;
  tpaName: string;
  tpaNames: string[];
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  tariffEffectiveFrom: string;
  tariffEffectiveTo: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

function toFrontend(c: InsuranceCompanyResponse): InsuranceCompany {
  return {
    _id:           c.id,
    id:            String(c.id),
    companyCode:   c.companyCode,
    name:          c.name,
    tpaName:       c.tpaName,
    tpaNames:      (c.tpaNames && c.tpaNames.length > 0) ? c.tpaNames : (c.tpaName ? [c.tpaName] : []),
    contactPerson: c.contactPerson,
    phone:         c.phone,
    email:         c.email ?? "",
    address:       c.address ?? "",
    tariffEffectiveFrom: c.tariffEffectiveFrom ?? "",
    tariffEffectiveTo:   c.tariffEffectiveTo ?? "",
    status:        c.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:     c.createdBy ?? "system",
    createdDate:   c.createdAt ? c.createdAt.slice(0, 10) : "",
  };
}

function emptyForm() {
  return {
    name: "", tpaNames: [] as string[], contactPerson: "",
    phone: "", email: "", address: "",
    tariffEffectiveFrom: "", tariffEffectiveTo: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  };
}

// ─── Multi-value TPA name input (tag/chip style) ──────────────────────────────
// One insurance company can be empanelled with many TPAs, so this captures a
// list. Type a name and press Enter / comma to add; click × to remove.
function TpaTagInput({ values, onChange }: { values: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const name = raw.trim().replace(/,+$/, "").trim();
    if (!name) return;
    // Case-insensitive de-dupe.
    if (values.some(v => v.toLowerCase() === name.toLowerCase())) { setDraft(""); return; }
    onChange([...values, name]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-sky-500">
      <div className="flex flex-wrap gap-1.5">
        {values.map((t, i) => (
          <span key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700
              text-xs font-medium px-2 py-0.5">
            {t}
            <button type="button" onClick={() => remove(i)}
              className="text-sky-400 hover:text-sky-700 leading-none" aria-label={`Remove ${t}`}>×</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && values.length > 0) { remove(values.length - 1); }
          }}
          onBlur={() => add(draft)}
          placeholder={values.length === 0 ? "e.g. Medi Assist, Paramount — Enter to add" : "Add TPA…"}
          className="flex-1 min-w-[120px] text-sm px-1 py-0.5 outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsuranceCompanyPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/insurance-companies");

  const { data: raw, loading, error: fetchErr, reload } =
    useMaster<InsuranceCompanyResponse>("/api/masters/insurance-companies");
  const companies = useMemo(() => raw.map(toFrontend), [raw]);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<InsuranceCompany | null>(null);
  const [form,         setForm]         = useState(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [apiError,     setApiError]     = useState("");
  const [tariffFor,    setTariffFor]    = useState<InsuranceCompany | null>(null);

  const filtered = useMemo(() => companies.filter((c) => {
  const q = search.toLowerCase();
  const ms = !q ||
    (c.name ?? '').toLowerCase().includes(q) ||
    (c.tpaName ?? '').toLowerCase().includes(q) ||
    (c.tpaNames ?? []).some(t => t.toLowerCase().includes(q)) ||
    (c.companyCode ?? '').toLowerCase().includes(q) ||
    (c.contactPerson ?? '').toLowerCase().includes(q);
  return ms && (!statusFilter || c.status === statusFilter);
}), [companies, search, statusFilter]);

  const totalActive = companies.filter(c => c.status === "Active").length;

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(c: InsuranceCompany) {
    setForm({ name: c.name, tpaNames: c.tpaNames ?? [], contactPerson: c.contactPerson,
      phone: c.phone, email: c.email, address: c.address,
      tariffEffectiveFrom: c.tariffEffectiveFrom, tariffEffectiveTo: c.tariffEffectiveTo,
      status: c.status === "Active" ? "ACTIVE" : "INACTIVE" });
    setErrors({}); setApiError(""); setEditing(c); setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())          e.name    = "Company name is required";
    // TPA name is optional — a company may be dealt with directly (no TPA).
    if (!form.contactPerson.trim()) e.contact = "Contact person is required";
    if (!form.phone.trim())         e.phone   = "Phone is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:          form.name,
      tpaName:       form.tpaNames[0] ?? null,
      tpaNames:      form.tpaNames,
      contactPerson: form.contactPerson,
      phone:         form.phone,
      email:         form.email || undefined,
      address:       form.address || undefined,
      tariffEffectiveFrom: form.tariffEffectiveFrom || null,
      tariffEffectiveTo:   form.tariffEffectiveTo || null,
      status:        form.status,
    };
    const result = editing
      ? await masterUpdate("/api/masters/insurance-companies", editing._id, body)
      : await masterCreate("/api/masters/insurance-companies", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  async function handleToggle(c: InsuranceCompany) {
    await masterToggle("/api/masters/insurance-companies", c._id);
    reload();
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="Insurance Companies"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Insurance Company" }]}
        action={canEdit ? { label: "Add Company", onClick: openAdd } : undefined}
      />

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Companies", value: companies.length,              color: "text-slate-900" },
          { label: "Active",          value: totalActive,                   color: "text-emerald-600" },
          { label: "Inactive",        value: companies.length - totalActive, color: "text-slate-400" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, TPA, code, contact…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            <option value="Active">Active ({totalActive})</option>
            <option value="Inactive">Inactive ({companies.length - totalActive})</option>
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
        <p className="text-xs text-slate-400 self-center">{filtered.length} results</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Code", "Company Name", "TPA Name", "Contact Person", "Phone", "Email", "Created By", "Status",
                  ...(canEdit ? ["Actions"] : [])
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 10 : 9} className="px-4 py-12 text-center text-slate-400">
                  No companies found
                </td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">{c.companyCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 whitespace-nowrap">{c.name}</p>
                    {c.address && <p className="text-xs text-slate-400 truncate max-w-[180px]">{c.address}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {(c.tpaNames.length > 0 ? c.tpaNames : (c.tpaName ? [c.tpaName] : [])).map((t, i) => (
                        <span key={`${t}-${i}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          🛡 {t}
                        </span>
                      ))}
                      {c.tpaNames.length === 0 && !c.tpaName && <span className="text-slate-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.contactPerson}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{c.createdBy}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={c.status} variant={c.status === "Active" ? "green" : "gray"} dot />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setTariffFor(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                            text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors" title="Manage tariff rates">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
                          </svg>
                          Tariff
                        </button>
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleToggle(c)}
                          className={`p-1.5 rounded-lg transition-colors ${c.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={c.status === "Active" ? "Deactivate" : "Activate"}>
                          {c.status === "Active" ? (
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
          {filtered.length} of {companies.length} companies
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit — ${editing.companyCode}` : "Add Insurance Company"}
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
              {editing ? "Save Changes" : "Add Company"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Company Name" required error={errors.name}>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Star Health Insurance" autoFocus/>
            </FormField>
            <FormField label="TPA Names" error={errors.tpaName}>
              <TpaTagInput
                values={form.tpaNames}
                onChange={next => setForm(f => ({ ...f, tpaNames: next }))}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Contact Person" required error={errors.contact}>
              <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Nodal officer name"/>
            </FormField>
            <FormField label="Phone" required error={errors.phone}>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="044-XXXXXXXX"/>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Email">
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="claims@company.com"/>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Tariff Contract From">
              <Input type="date" value={form.tariffEffectiveFrom}
                onChange={e => setForm(f => ({ ...f, tariffEffectiveFrom: e.target.value }))}/>
            </FormField>
            <FormField label="Tariff Contract To">
              <Input type="date" value={form.tariffEffectiveTo}
                onChange={e => setForm(f => ({ ...f, tariffEffectiveTo: e.target.value }))}/>
            </FormField>
          </div>
          <FormField label="Address">
            <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Office address" rows={2}/>
          </FormField>
        </div>
      </Modal>

      {/* Tariff Rates Manager */}
      {tariffFor && (
        <TariffManager
          companyId={tariffFor._id}
          companyName={tariffFor.name}
          effectiveFrom={tariffFor.tariffEffectiveFrom || null}
          effectiveTo={tariffFor.tariffEffectiveTo || null}
          open={!!tariffFor}
          onClose={() => setTariffFor(null)}
          canEdit={canEdit}
          onDatesSaved={() => reload()}
        />
      )}
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
