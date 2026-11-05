"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shapes ──────────────────────────────────────────────────
interface BillingMasterResponse {
  id: number;
  serviceCode: string;
  serviceName: string;
  modalityId: number;
  modalityName: string;
  modalityCode: string;
  price: number;
  discountAllowed: boolean;
  showInOp: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
}

interface ModalityResponse {
  id: number;
  modalityCode: string;
  name: string;
  shortName: string;
  status: "ACTIVE" | "INACTIVE";
}

// PagedResponse<T> as returned by the backend search endpoint.
interface PagedShape<T> { content?: T[]; totalElements?: number; totalPages?: number; last?: boolean; }

// ─── Frontend types ───────────────────────────────────────────────────────────
interface BillingMaster {
  _id: number;
  id: string;
  serviceCode: string;
  serviceName: string;
  modalityId: number;
  modalityName: string;
  modalityCode: string;
  price: number;
  discountAllowed: boolean;
  showInOp: boolean;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

interface Modality {
  _id: number;
  id: string;
  modalityCode: string;
  name: string;
  shortName: string;
}

// Page size for server-side paging of the billing-masters list.
const PAGE_SIZE = 100;

function toFrontend(s: BillingMasterResponse): BillingMaster {
  return {
    _id:             s.id,
    id:              String(s.id),
    serviceCode:     s.serviceCode,
    serviceName:     s.serviceName,
    modalityId:      s.modalityId,
    modalityName:    s.modalityName,
    modalityCode:    s.modalityCode,
    price:           s.price,
    discountAllowed: s.discountAllowed,
    showInOp:        s.showInOp ?? true,
    status:          s.status === "ACTIVE" ? "Active" : "Inactive",
    createdBy:       s.createdBy ?? "system",
    createdDate:     s.createdAt ? s.createdAt.slice(0, 10) : "",
  };
}

function toModality(m: ModalityResponse): Modality {
  return { _id: m.id, id: String(m.id), modalityCode: m.modalityCode, name: m.name, shortName: m.shortName };
}

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function emptyForm() {
  return { serviceName: "", modalityId: 0, price: 0, discountAllowed: false, showInOp: true, status: "ACTIVE" as "ACTIVE" | "INACTIVE" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BillingMastersPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/billing-masters");

  // Modalities load once (drive the filter dropdown + Add/Edit modal).
  const { data: rawModalities, loading: modLoading, error: modError } =
    useMaster<ModalityResponse>("/api/masters/billing-modalities");
  const modalities = useMemo(() => rawModalities.filter(m => m.status === "ACTIVE").map(toModality), [rawModalities]);

  // ── Server-side search / filter / paging state ──────────────────────────────
  const [search,         setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modFilter,      setModFilter]      = useState("");
  const [statusFilter,   setStatusFilter]   = useState("");
  // `page` is 0-indexed (matches the backend).
  const [page,           setPage]           = useState(0);
  const [totalPages,     setTotalPages]     = useState(0);
  const [totalElements,  setTotalElements]  = useState(0);

  // Current page's rows (server-paged at PAGE_SIZE).
  const [services,  setServices]  = useState<BillingMaster[]>([]);
  const [svcLoading, setSvcLoading] = useState(true);
  const [svcError,  setSvcError]   = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<BillingMaster | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  // Load one page of services from the server, applying search + filters there.
  // `signal` lets a superseded request bail out quietly (avoids setting state
  // from a stale fetch when filters/page change in quick succession).
  const loadServices = useCallback(async (signal?: AbortSignal) => {
    // Yield once before touching state so this never runs setState synchronously
    // in the effect body (keeps the render cheap / lint-clean).
    await Promise.resolve();
    if (signal?.aborted) return;
    setSvcLoading(true);
    setSvcError(null);
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    const s = debouncedSearch.trim();
    if (s)            qs.set("search", s);
    if (modFilter)    qs.set("modalityId", modFilter);
    if (statusFilter) qs.set("status", statusFilter === "Active" ? "ACTIVE" : "INACTIVE");
    try {
      const res  = await fetch(`/api/masters/billing-masters?${qs}`, { signal });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSvcError(json.error ?? "Failed to load data");
        setServices([]); setTotalElements(0); setTotalPages(0);
      } else {
        const pr = json.data as PagedShape<BillingMasterResponse>;
        setServices((pr?.content ?? []).map(toFrontend));
        setTotalElements(pr?.totalElements ?? 0);
        setTotalPages(pr?.totalPages ?? 0);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // superseded — ignore
      setSvcError("Network error. Please try again.");
      setServices([]); setTotalElements(0); setTotalPages(0);
    } finally {
      if (!signal?.aborted) setSvcLoading(false);
    }
  }, [page, debouncedSearch, modFilter, statusFilter]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  // On commit we also drop back to page 0 so the first page of results shows.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch whenever the debounced search / filters / page change. The
  // AbortController cancels an in-flight request if the inputs change again
  // before it resolves, so only the latest result updates the list.
  useEffect(() => {
    const ctrl = new AbortController();
    // loadServices is async and sets state only after awaiting; the rule's
    // static check can't see past the await, so it's disabled here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadServices(ctrl.signal);
    return () => ctrl.abort();
  }, [loadServices]);

  // Group the current page's rows by modality for the sectioned table.
  const grouped = useMemo(() => {
    const map = new Map<string, BillingMaster[]>();
    services.forEach((s) => {
      const key = s.modalityName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [services]);

  const pageActive = services.filter((s) => s.status === "Active").length;
  const pagePrice  = services.reduce((sum, s) => sum + s.price, 0);

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(s: BillingMaster) {
    setForm({ serviceName: s.serviceName, modalityId: s.modalityId, price: s.price,
      discountAllowed: s.discountAllowed, showInOp: s.showInOp, status: s.status === "Active" ? "ACTIVE" : "INACTIVE" });
    setErrors({}); setApiError(""); setEditing(s); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.serviceName.trim()) e.serviceName = "Service name is required";
    if (!form.modalityId)         e.modalityId  = "Modality is required";
    if (!form.price || form.price <= 0) e.price = "Enter a valid price";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      serviceName:     form.serviceName,
      modalityId:      form.modalityId,
      price:           form.price,
      discountAllowed: form.discountAllowed,
      showInOp:        form.showInOp,
      status:          form.status,
    };
    const result = editing
      ? await masterUpdate("/api/masters/billing-masters", editing._id, body)
      : await masterCreate("/api/masters/billing-masters", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await loadServices();
    setModalOpen(false);
  }

  async function handleToggle(s: BillingMaster) {
    await masterToggle("/api/masters/billing-masters", s._id);
    loadServices();
  }

  function clearFilters() { setSearch(""); setModFilter(""); setStatusFilter(""); setPage(0); }
  const anyFilter = !!(search || modFilter || statusFilter);

  const loading  = svcLoading && services.length === 0 && modLoading;
  const fetchErr = svcError || modError;

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={loadServices} />}
      <PageHeader
        title="Billing Masters"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Billing Masters" }]}
        action={canEdit ? { label: "Add Service", onClick: openAdd } : undefined}
      />

      {/* stat cards (reflect the current page / result set) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Services"   value={totalElements.toLocaleString()} color="text-slate-900" />
        <StatCard label="Active (page)"    value={String(pageActive)}             color="text-emerald-600" />
        <StatCard label="Modalities (page)" value={String(grouped.size)}          color="text-sky-600" />
        <StatCard label="Discount (page)"  value={String(services.filter(s => s.discountAllowed).length)} color="text-amber-600" />
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
            placeholder="Search by service name or code…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={modFilter} onChange={(e) => { setModFilter(e.target.value); setPage(0); }}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Modalities</option>
            {modalities.map((m) => (
              <option key={m._id} value={String(m._id)}>{m.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
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
        <p className="text-xs text-slate-400 self-center whitespace-nowrap">
          {totalElements.toLocaleString()} service{totalElements !== 1 ? "s" : ""}
        </p>
      </div>

      {/* grouped table */}
      <div className="space-y-4">
        {svcLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-14 text-center text-slate-400">
            Loading…
          </div>
        ) : grouped.size === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-14 text-center text-slate-400">
            No services found
          </div>
        ) : Array.from(grouped.entries()).map(([modName, rows]) => {
          const mod = modalities.find((m) => m.name === modName);
          return (
            <div key={modName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    {mod?.modalityCode ?? rows[0]?.modalityCode ?? "—"}
                  </span>
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {mod?.shortName ?? ""}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{modName}</span>
                  <span className="text-xs text-slate-400">{rows.length} service{rows.length !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Price range: {inr(Math.min(...rows.map(r => r.price)))}
                  {rows.length > 1 && ` – ${inr(Math.max(...rows.map(r => r.price)))}`}
                </span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    {["#", "Service Code", "Service Name", "Price", "Discount Allowed", "Show in OP", "Created By", "Created Date", "Status", ...(canEdit ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs w-8">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{s.serviceCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 whitespace-nowrap">{s.serviceName}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{inr(s.price)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.discountAllowed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.showInOp ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{s.createdBy}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{s.createdDate}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge label={s.status} variant={s.status === "Active" ? "green" : "gray"} dot />
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button onClick={() => handleToggle(s)}
                              className={`p-1.5 rounded-lg transition-colors ${s.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                              title={s.status === "Active" ? "Deactivate" : "Activate"}>
                              {s.status === "Active" ? (
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
              <div className="px-4 py-2 border-t border-slate-50 text-xs text-slate-400 flex justify-between">
                <span>{rows.length} service{rows.length !== 1 ? "s" : ""} in this modality</span>
                <span className="font-medium text-slate-600">{rows.filter(r => r.discountAllowed).length} discount-eligible</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* pagination footer */}
      <div className="mt-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-500 whitespace-nowrap">
          {totalElements > 0
            ? `Showing ${(page * PAGE_SIZE) + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${totalElements.toLocaleString()} services`
            : "No services"}
          {services.length > 0 && <span className="ml-2 text-slate-400">· Page total {inr(pagePrice)}</span>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Previous
          </button>
          <span className="text-sm text-slate-500 whitespace-nowrap">
            Page {page + 1} of {Math.max(1, totalPages)}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Service — ${editing.serviceCode}` : "Add Billing Service"}
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
              {editing ? "Save Changes" : "Add Service"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <FormField label="Service Name" required error={errors.serviceName}>
            <Input value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder="e.g. OPD Consultation" autoFocus/>
          </FormField>
          <FormField label="Modality" required error={errors.modalityId}>
            <Select value={form.modalityId ? String(form.modalityId) : ""} onChange={(e) => setForm({ ...form, modalityId: Number(e.target.value) })}>
              <option value="">Select modality…</option>
              {modalities.map((m) => (
                <option key={m._id} value={String(m._id)}>{m.modalityCode} — {m.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Price (₹)" required error={errors.price}>
            <Input type="number" min={0} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} placeholder="e.g. 500"/>
          </FormField>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setForm({ ...form, discountAllowed: !form.discountAllowed })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.discountAllowed ? "bg-sky-500" : "bg-slate-200"}`}
              role="switch" aria-checked={form.discountAllowed}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.discountAllowed ? "translate-x-6" : "translate-x-1"}`}/>
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700">Discount Allowed</p>
              <p className="text-xs text-slate-400">
                {form.discountAllowed ? "Receptionist can apply discount on billing." : "Fixed price — no discount permitted."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setForm({ ...form, showInOp: !form.showInOp })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.showInOp ? "bg-sky-500" : "bg-slate-200"}`}
              role="switch" aria-checked={form.showInOp}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.showInOp ? "translate-x-6" : "translate-x-1"}`}/>
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700">Show in OP</p>
              <p className="text-xs text-slate-400">
                {form.showInOp ? "Appears in the OP bill service dropdown." : "Hidden from the OP bill (IP/other only)."}
              </p>
            </div>
          </div>
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
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
