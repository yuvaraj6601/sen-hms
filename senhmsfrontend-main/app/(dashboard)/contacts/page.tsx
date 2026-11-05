"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { getSession } from "../../_lib/auth";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend types ────────────────────────────────────────────────────────────
type ContactTypeB = "DOCTOR" | "VENDOR" | "STAFF" | "INSURANCE" | "OTHER";
type ContactTypeF = "Doctor" | "Vendor" | "Staff" | "Insurance" | "Other";

interface ContactResponse {
  id: number;
  name: string;
  type: ContactTypeB;
  phone: string;
  email: string | null;
  organization: string | null;
  address: string | null;
  area: string | null;
  district: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

interface Contact {
  _id: number;
  id: string;
  name: string;
  type: ContactTypeF;
  phone: string;
  email: string;
  organization: string;
  address: string;
  notes: string;
}

const TYPE_FWD: Record<ContactTypeB, ContactTypeF> = {
  DOCTOR: "Doctor", VENDOR: "Vendor", STAFF: "Staff",
  INSURANCE: "Insurance", OTHER: "Other",
};
const TYPE_REV: Record<ContactTypeF, ContactTypeB> = {
  Doctor: "DOCTOR", Vendor: "VENDOR", Staff: "STAFF",
  Insurance: "INSURANCE", Other: "OTHER",
};

function toFrontend(c: ContactResponse): Contact {
  return {
    _id: c.id, id: String(c.id),
    name: c.name,
    type: TYPE_FWD[c.type] ?? "Other",
    phone: c.phone,
    email: c.email ?? "",
    organization: c.organization ?? "",
    address: c.address ?? "",
    notes: c.notes ?? "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTACT_TYPES: ContactTypeF[] = ["Doctor", "Vendor", "Staff", "Insurance", "Other"];

const TYPE_COLORS: Record<ContactTypeF, "sky" | "green" | "purple" | "red" | "gray"> = {
  Doctor: "sky", Vendor: "green", Staff: "purple", Insurance: "red", Other: "gray",
};

const TYPE_DOT: Record<ContactTypeF, string> = {
  Doctor: "bg-sky-500", Vendor: "bg-emerald-500", Staff: "bg-purple-500",
  Insurance: "bg-rose-500", Other: "bg-slate-400",
};

function emptyForm() {
  return { name: "", type: "Other" as ContactTypeF, customType: "", phone: "", organization: "", address: "", notes: "" };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const session  = getSession();
  const role     = session?.role ?? "Receptionist";
  const canEdit  = ["Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);

  const [contacts,     setContacts]     = useState<Contact[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchErr,     setFetchErr]     = useState("");
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Contact | null>(null);
  const [form,         setForm]         = useState(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [apiError,     setApiError]     = useState("");
  const [deleteConfirm,setDeleteConfirm]= useState<Contact | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchErr("");
    const qs = new URLSearchParams({ page: "0", size: "500" });
    if (search) qs.set("search", search);
    if (typeFilter) qs.set("type", TYPE_REV[typeFilter as ContactTypeF]);
    const { ok, data, error } = await apiFetch(`/api/contacts?${qs}`);
    if (!ok) { setFetchErr(error); setLoading(false); return; }
    const raw: ContactResponse[] = data?.content ?? data ?? [];
    setContacts(raw.map(toFrontend));
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search && !typeFilter) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c => {
      const ms = !q || c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) || c.organization.toLowerCase().includes(q);
      const mt = !typeFilter || c.type === typeFilter;
      return ms && mt;
    });
  }, [contacts, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    contacts.forEach(c => { m[c.type] = (m[c.type] ?? 0) + 1; });
    return m;
  }, [contacts]);

  function openAdd() {
    setForm(emptyForm()); setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(c: Contact) {
    setForm({
      name: c.name, type: c.type,
      customType: c.type === "Other" ? c.organization : "",
      phone: c.phone, organization: c.type !== "Other" ? c.organization : "",
      address: c.address, notes: c.notes,
    });
    setErrors({}); setApiError(""); setEditing(c); setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Name is required";
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (form.type === "Other" && !form.customType.trim()) e.customType = "Please specify the type";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:         form.name,
      type:         TYPE_REV[form.type],
      phone:        form.phone,
      organization: form.type === "Other" && form.customType ? form.customType : form.organization || undefined,
      address:      form.address || undefined,
      notes:        form.notes || undefined,
    };
    const { ok, error } = editing
      ? await apiFetch(`/api/contacts/${editing._id}`, { method: "PUT", body: JSON.stringify(body) })
      : await apiFetch("/api/contacts", { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (!ok) { setApiError(error); return; }
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await apiFetch(`/api/contacts/${deleteConfirm._id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteConfirm(null);
    load();
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={load} />}
      <PageHeader
        title="Contacts"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Contacts" }]}
        action={canEdit ? { label: "Add Contact", onClick: openAdd } : undefined}
      />

      {/* Type summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CONTACT_TYPES.map(t => (
          <div key={t} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${TYPE_DOT[t]}`} />
            <span className="font-medium text-slate-600">{t}</span>
            <span className="text-slate-400">{typeCounts[t] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, organization…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Types ({contacts.length})</option>
            {CONTACT_TYPES.map(t => (
              <option key={t} value={t}>{t} ({typeCounts[t] ?? 0})</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {(search || typeFilter) && (
          <button onClick={() => { setSearch(""); setTypeFilter(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center">{filtered.length} results</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Type", "Phone", "Organization / Role", "Address", "Notes",
                  ...(canEdit ? ["Actions"] : [])
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      No contacts found
                    </div>
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                        ${c.type === "Doctor" ? "bg-sky-100 text-sky-700" :
                          c.type === "Vendor" ? "bg-emerald-100 text-emerald-700" :
                          c.type === "Staff" ? "bg-purple-100 text-purple-700" :
                          c.type === "Insurance" ? "bg-rose-100 text-rose-700" :
                          "bg-slate-100 text-slate-600"}`}>
                        {c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800 whitespace-nowrap">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={c.type} variant={TYPE_COLORS[c.type]} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.organization || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px]">
                    <p className="truncate" title={c.address}>{c.address || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px]">
                    <p className="truncate" title={c.notes}>{c.notes || "—"}</p>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirm(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
          {filtered.length} of {contacts.length} contacts
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Contact — ${editing.name}` : "Add New Contact"} size="sm"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Contact"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>}
          <FormField label="Name" required error={errors.name}>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus/>
          </FormField>
          <FormField label="Type" required>
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ContactTypeF, customType: "" })}>
              {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
          {form.type === "Other" && (
            <FormField label="Specify Type" required error={errors.customType}>
              <Input value={form.customType} onChange={e => setForm({ ...form, customType: e.target.value })} placeholder="e.g. Ambulance, NGO…"/>
            </FormField>
          )}
          <FormField label="Phone" required error={errors.phone}>
            <Input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile number"/>
          </FormField>
          {form.type !== "Other" && (
            <FormField label="Organization / Role">
              <Input value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} placeholder="e.g. Cardiology – Sen Hospital"/>
            </FormField>
          )}
          <FormField label="Address">
            <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" rows={2}/>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional info" rows={2}/>
          </FormField>
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Contact" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-lg">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-semibold">{deleteConfirm?.name}</span>?
        </p>
      </Modal>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-slate-200 rounded w-32" />
        <div className="h-9 bg-slate-200 rounded w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-white border border-slate-200 rounded-lg w-28" />
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
            <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0" />
            <div className="h-3 bg-slate-200 rounded w-32" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-3 bg-slate-200 rounded w-16 ml-auto" />
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
