"use client";

import { useState, useEffect, useMemo } from "react";
import { getSession } from "../../../_lib/auth";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Textarea } from "../../../_components/Modal";

// ─── helpers ─────────────────────────────────────────────────────────────────
function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function deriveFinancialYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const year = new Date(dateStr).getFullYear();
  const month = new Date(dateStr).getMonth() + 1; // 1-12
  const fy = month >= 4 ? year : year - 1;
  return `${fy}-${fy + 1}`;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Backend insurance claim shape ───────────────────────────────────────────
interface InsuranceClaimResponse {
  id: number;
  claimNo: string;
  patientName: string;
  dischargeDate: string | null;
  settledDate: string | null;
  preAuthNumber: string | null;
  claimedAmount: number;
  settledAmount: number | null;
  tpaName: string;
  submittedDate: string | null;
  status: string;
  approvedAmount: number | null;
  rejectionReason: string | null;
  remarks: string | null;
  insuranceCompany: string | null;
}

// ─── Displayed / editable claim row ──────────────────────────────────────────
interface DisplayClaim {
  id: number;
  claimNo: string;
  dod: string;
  patientName: string;
  chequeDate: string;
  chequeNo: string;
  amountClaimed: number;
  amountDeducted: number;
  tpaName: string;
  itDeduction: number;
  amountSettled: number;
  financialYear: string;
  notes: string;
  // raw status/approved for update
  status: string;
  approvedAmount: number | null;
  rejectionReason: string | null;
  remarks: string | null;
}

function mapToDisplay(c: InsuranceClaimResponse): DisplayClaim {
  const settled = c.settledAmount ?? 0;
  const claimed = c.claimedAmount ?? 0;
  return {
    id:             c.id,
    claimNo:        c.claimNo ?? "—",
    dod:            c.dischargeDate ?? "",
    patientName:    c.patientName ?? "",
    chequeDate:     c.settledDate ?? "",
    chequeNo:       c.preAuthNumber ?? "",
    amountClaimed:  claimed,
    amountDeducted: Math.max(0, claimed - settled),
    tpaName:        c.tpaName ?? "",
    itDeduction:    0,
    amountSettled:  settled,
    financialYear:  deriveFinancialYear(c.submittedDate),
    notes:          c.remarks ?? "",
    status:         c.status ?? "",
    approvedAmount: c.approvedAmount ?? null,
    rejectionReason: c.rejectionReason ?? null,
    remarks:        c.remarks ?? null,
  };
}

type EditForm = {
  status: string;
  approvedAmount: number;
  settledAmount: number;
  rejectionReason: string;
  remarks: string;
};

function emptyEditForm(c?: DisplayClaim): EditForm {
  return {
    status:          c?.status ?? "",
    approvedAmount:  c?.approvedAmount ?? 0,
    settledAmount:   c?.amountSettled ?? 0,
    rejectionReason: c?.rejectionReason ?? "",
    remarks:         c?.notes ?? "",
  };
}

// ─── Add Claim form (for POST /api/insurance/claims) ─────────────────────────
interface AddClaimForm {
  patientName: string;
  tpaName: string;
  insuranceCompany: string;
  claimedAmount: number;
  dischargeDate: string;
  submittedDate: string;
  preAuthNumber: string;
  notes: string;
}

function emptyAddForm(): AddClaimForm {
  return {
    patientName: "", tpaName: "", insuranceCompany: "",
    claimedAmount: 0, dischargeDate: "", submittedDate: "",
    preAuthNumber: "", notes: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsuranceClaimsReceivedPage() {
  const session = getSession();
  void session; // auth handled by layout

  const [claims,   setClaims]   = useState<DisplayClaim[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // filters
  const [search,   setSearch]   = useState("");
  const [tpaFilt,  setTpaFilt]  = useState("");
  const [yearFilt, setYearFilt] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // modals
  const [modalOpen,    setModalOpen]    = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editing,      setEditing]      = useState<DisplayClaim | null>(null);
  // Delete is not supported by the backend — button hidden per spec

  // edit form (status / settled update)
  const [editForm,   setEditForm]   = useState<EditForm>(emptyEditForm());
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);

  // add form
  const [addForm,   setAddForm]   = useState<AddClaimForm>(emptyAddForm());
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // ── data loading ──
  async function loadClaims() {
    setLoading(true);
    setError(null);
    try {
      const { ok, data, error: err } = await apiFetch("/api/insurance/claims?page=0&size=500");
      if (ok) {
        const raw = (data as { content?: InsuranceClaimResponse[] })?.content ?? (data as InsuranceClaimResponse[]);
        setClaims((Array.isArray(raw) ? raw : []).map(mapToDisplay));
      } else {
        setError(err);
      }
    } catch {
      setError("Failed to load insurance claims");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClaims(); }, []);

  // ── derived ──
  const tpaOptions  = useMemo(() => [...new Set(claims.map(c => c.tpaName).filter(Boolean))].sort(), [claims]);
  const yearOptions = useMemo(() => [...new Set(claims.map(c => c.financialYear))].sort().reverse(), [claims]);

  const filtered = useMemo(() => {
    return claims.filter(c => {
      const q = search.toLowerCase();
      const ms = !q || c.claimNo.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.tpaName.toLowerCase().includes(q) ||
        c.chequeNo?.toLowerCase().includes(q);
      const mt  = !tpaFilt  || c.tpaName === tpaFilt;
      const my  = !yearFilt || c.financialYear === yearFilt;
      const mdf = !dateFrom || c.dod >= dateFrom;
      const mdt = !dateTo   || c.dod <= dateTo;
      return ms && mt && my && mdf && mdt;
    });
  }, [claims, search, tpaFilt, yearFilt, dateFrom, dateTo]);

  const totalClaimed  = filtered.reduce((s, c) => s + c.amountClaimed,  0);
  const totalDeducted = filtered.reduce((s, c) => s + c.amountDeducted, 0);
  const totalIT       = filtered.reduce((s, c) => s + c.itDeduction,    0);
  const totalSettled  = filtered.reduce((s, c) => s + c.amountSettled,  0);

  // ── edit modal ──
  function openEdit(c: DisplayClaim) {
    setEditing(c);
    setEditForm(emptyEditForm(c));
    setEditErrors({});
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {
        status:          editForm.status || undefined,
        approvedAmount:  editForm.approvedAmount || undefined,
        settledAmount:   editForm.settledAmount  || undefined,
        rejectionReason: editForm.rejectionReason || undefined,
        remarks:         editForm.remarks || undefined,
      };
      const { ok, error: err } = await apiFetch(
        `/api/insurance/claims/${editing.id}/status`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      if (ok) {
        await loadClaims();
        setModalOpen(false);
      } else {
        setEditErrors({ save: err });
      }
    } catch {
      setEditErrors({ save: "Failed to update claim" });
    } finally {
      setSaving(false);
    }
  }

  // ── add modal ──
  function openAdd() {
    setAddForm(emptyAddForm());
    setAddErrors({});
    setAddModalOpen(true);
  }

  function validateAdd(): boolean {
    const er: Record<string, string> = {};
    if (!addForm.patientName.trim())    er.patientName   = "Patient name is required";
    if (!addForm.tpaName.trim())        er.tpaName       = "TPA / Company is required";
    if (!addForm.claimedAmount || addForm.claimedAmount <= 0) er.claimedAmount = "Enter a valid amount";
    setAddErrors(er);
    return Object.keys(er).length === 0;
  }

  async function handleAddSave() {
    if (!validateAdd()) return;
    setSaving(true);
    try {
      const body = {
        patientName:      addForm.patientName,
        tpaName:          addForm.tpaName,
        insuranceCompany: addForm.insuranceCompany || undefined,
        claimedAmount:    addForm.claimedAmount,
        dischargeDate:    addForm.dischargeDate || undefined,
        submittedDate:    addForm.submittedDate || undefined,
        preAuthNumber:    addForm.preAuthNumber || undefined,
        remarks:          addForm.notes || undefined,
      };
      const { ok, error: err } = await apiFetch("/api/insurance/claims", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (ok) {
        await loadClaims();
        setAddModalOpen(false);
      } else {
        setAddErrors({ save: err });
      }
    } catch {
      setAddErrors({ save: "Failed to add claim" });
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch(""); setTpaFilt(""); setYearFilt(""); setDateFrom(""); setDateTo("");
  }
  const anyFilter = !!(search || tpaFilt || yearFilt || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Insurance Claims Received"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Daily Summary" }, { label: "Insurance Claims Received" }]}
        action={{ label: "Add Claim", onClick: openAdd }}
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SCard label="Total Claims"     value={String(filtered.length)}      color="text-slate-800" />
        <SCard label="Total Claimed"    value={inr(totalClaimed)}            color="text-sky-600" />
        <SCard label="IT + Deductions"  value={inr(totalDeducted + totalIT)} color="text-red-500" />
        <SCard label="Total Settled"    value={inr(totalSettled)}            color="text-emerald-600" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, TPA, cheque no…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
        </div>

        {/* TPA filter */}
        {tpaOptions.length > 0 && (
          <div className="relative">
            <select value={tpaFilt} onChange={e => setTpaFilt(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
                bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
              <option value="">All TPA</option>
              {tpaOptions.map(t => <option key={t}>{t}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        )}

        {/* Financial Year */}
        <div className="relative">
          <select value={yearFilt} onChange={e => setYearFilt(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
            <option value="">All Years</option>
            {yearOptions.map(y => <option key={y}>{y}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">DOD From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-teal-500 w-36"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-teal-500 w-36"/>
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
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded w-20" />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-28" />
              <div className="h-5 bg-slate-200 rounded-full w-20" />
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-12" />
              <div className="h-5 bg-slate-200 rounded-full w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}
      {error && !loading && <div className="py-6 text-center text-red-500 text-sm">{error}</div>}

      {/* ── Table ── */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["No", "Claim No", "DOD", "Patient Name", "Cheque Date", "Cheque No",
                    "Amount Claimed", "Amount Deducted", "TPA Name", "IT Deduction",
                    "Amount Settled", "FY", "Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500
                      uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        No insurance claims found
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {c.claimNo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {c.dod
                        ? new Date(c.dod).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{c.patientName}</td>
                    <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {c.chequeDate
                        ? new Date(c.chequeDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                      {c.chequeNo || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {inr(c.amountClaimed)}
                    </td>
                    <td className="px-3 py-3 text-right text-red-600 text-xs font-medium whitespace-nowrap">
                      {c.amountDeducted > 0 ? inr(c.amountDeducted) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-medium">
                        {c.tpaName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-orange-600 text-xs font-medium whitespace-nowrap">
                      {c.itDeduction > 0 ? inr(c.itDeduction) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-emerald-700">{inr(c.amountSettled)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{c.financialYear}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        {/* Delete not supported by backend — button intentionally omitted */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-teal-50 border-t-2 border-teal-200">
                    <td colSpan={6} className="px-3 py-3 text-xs font-bold text-teal-700 text-right uppercase tracking-wide">
                      Totals ({filtered.length} claims)
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-teal-800">{inr(totalClaimed)}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-600">{inr(totalDeducted)}</td>
                    <td />
                    <td className="px-3 py-3 text-right font-bold text-orange-600">{inr(totalIT)}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700">{inr(totalSettled)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Edit Modal (status / settled amount update)
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Claim — ${editing.claimNo}` : "Edit Claim"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg disabled:opacity-60">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {editErrors.save && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editErrors.save}</p>
          )}

          {editing && (
            <div className="flex flex-wrap gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
              <AField label="Claim No"    value={editing.claimNo} />
              <AField label="Patient"     value={editing.patientName} />
              <AField label="Amount Claimed" value={inr(editing.amountClaimed)} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Status">
              <select value={editForm.status}
                onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— keep current —</option>
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="SETTLED">Settled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </FormField>
            <FormField label="Approved Amount (₹)">
              <Input type="number" min={0} value={editForm.approvedAmount || ""}
                onChange={e => setEditForm(prev => ({ ...prev, approvedAmount: Number(e.target.value) }))}
                placeholder="0" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Settled Amount (₹)">
              <Input type="number" min={0} value={editForm.settledAmount || ""}
                onChange={e => setEditForm(prev => ({ ...prev, settledAmount: Number(e.target.value) }))}
                placeholder="0" />
            </FormField>
            <FormField label="Rejection Reason">
              <Input value={editForm.rejectionReason}
                onChange={e => setEditForm(prev => ({ ...prev, rejectionReason: e.target.value }))}
                placeholder="If rejected, reason here" />
            </FormField>
          </div>

          <FormField label="Remarks">
            <Textarea value={editForm.remarks}
              onChange={e => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Any remarks about this claim…"
              rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          Add Claim Modal
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={addModalOpen} onClose={() => setAddModalOpen(false)}
        title="Add Insurance Claim"
        size="xl"
        footer={
          <>
            <button onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleAddSave} disabled={saving}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg disabled:opacity-60">
              {saving ? "Saving…" : "Add Claim"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {addErrors.save && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addErrors.save}</p>
          )}

          {/* Row 1: DOD + Patient Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date of Discharge (DOD)" error={addErrors.dischargeDate}>
              <Input type="date" value={addForm.dischargeDate}
                onChange={e => setAddForm(prev => ({ ...prev, dischargeDate: e.target.value }))} />
            </FormField>
            <FormField label="Patient Name" required error={addErrors.patientName}>
              <Input value={addForm.patientName}
                onChange={e => setAddForm(prev => ({ ...prev, patientName: e.target.value }))}
                placeholder="Full patient name" />
            </FormField>
          </div>

          {/* Row 2: TPA + Insurance Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="TPA / Insurance Company" required error={addErrors.tpaName}>
              <Input value={addForm.tpaName}
                onChange={e => setAddForm(prev => ({ ...prev, tpaName: e.target.value }))}
                placeholder="e.g. Star Health, Medi Assist" />
            </FormField>
            <FormField label="Insurance Company">
              <Input value={addForm.insuranceCompany}
                onChange={e => setAddForm(prev => ({ ...prev, insuranceCompany: e.target.value }))}
                placeholder="Insurance company name" />
            </FormField>
          </div>

          {/* Row 3: Amount + Pre-Auth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Amount Claimed (₹)" required error={addErrors.claimedAmount}>
              <Input type="number" min={0} value={addForm.claimedAmount || ""}
                onChange={e => setAddForm(prev => ({ ...prev, claimedAmount: Number(e.target.value) }))}
                placeholder="0" />
            </FormField>
            <FormField label="Pre-Auth / Cheque No">
              <Input value={addForm.preAuthNumber}
                onChange={e => setAddForm(prev => ({ ...prev, preAuthNumber: e.target.value }))}
                placeholder="e.g. PO 6431" />
            </FormField>
          </div>

          {/* Row 4: Submitted Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Submitted Date">
              <Input type="date" value={addForm.submittedDate}
                onChange={e => setAddForm(prev => ({ ...prev, submittedDate: e.target.value }))} />
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Remarks">
            <Textarea value={addForm.notes}
              onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any remarks about this claim…"
              rows={2} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function SCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function AField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-teal-700">{value}</p>
    </div>
  );
}
