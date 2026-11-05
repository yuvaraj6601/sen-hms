"use client";

import { useState, useEffect, useMemo } from "react";
import { getSession } from "../../_lib/auth";
import type { CollectionPaymentMode } from "../../_lib/types";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Textarea } from "../../_components/Modal";

// ─── helpers ─────────────────────────────────────────────────────────────────
function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }
function today() { return new Date().toISOString().slice(0, 10); }

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManualEntryResponse {
  id: number; sno: number;
  patientName: string; age: number; sex: string; visitType: string;
  consultantName: string; diagnosis: string;
  paymentMode: string; amount: number;
  paymentSplitsJson: string | null;
  notes: string | null;
  createdAt: string;
}

interface BillSummaryRow {
  billNo: string;
  patientName: string;
  uhid: string;
  patientType: string;
  doctorName: string | null;
  totalAmount: number;
  paidAmount: number;
  paymentMode: string;
  status: string;
}

interface DailySummaryResponse {
  date: string;
  status: string;
  submittedBy: string | null;
  submittedAt: string | null;
  totalIncome: number;
  totalExpense: number;
  netCollection: number;
  manualEntries: ManualEntryResponse[];
  manualTotal: number; manualCash: number; manualUpi: number; manualCard: number; manualCheque: number;
  bills: BillSummaryRow[];
  totalBillAmount: number; totalBillPaid: number;
  billCash: number; billCard: number; billUpi: number; billCheque: number; billInsurance: number;
  claims: unknown[];
  totalClaimsSubmitted: number; totalClaimsSettled: number;
  expenses: unknown[];
  totalExpenses: number;
  expenseCash: number; expenseUpi: number; expenseCheque: number; expenseBankTransfer: number;
  opVisitCount: number; admittedCount: number; dischargedCount: number; appointmentCount: number;
}

const PAYMENT_MODES: CollectionPaymentMode[] = ["Cash", "UPI", "Card", "Cheque"];
const VISIT_TYPES = ["OP", "IP", "ICU", "HDU"];

const MODE_ICON: Record<CollectionPaymentMode, string> = {
  Cash: "💵", UPI: "📱", Card: "💳", Cheque: "🧾",
};
const MODE_COLOR: Record<CollectionPaymentMode, string> = {
  Cash:   "bg-green-50 text-green-700",
  UPI:    "bg-sky-50 text-sky-700",
  Card:   "bg-violet-50 text-violet-700",
  Cheque: "bg-amber-50 text-amber-700",
};

type PaymentSplit = { mode: CollectionPaymentMode; amount: number };

interface EntryRow {
  sno: number;
  patientName: string; age: number; sex: string; visitType: string;
  consultantName: string; diagnosis: string;
  paymentMode: CollectionPaymentMode; amount: number;
  isSplit: boolean;
  paymentSplits: PaymentSplit[];
  notes: string;
}

type EntryError = { patientName?: string; consultantName?: string; diagnosis?: string; amount?: string; splits?: string };

function emptyEntry(sno: number): EntryRow {
  return {
    sno, patientName: "", age: 0, sex: "M", visitType: "OP",
    consultantName: "", diagnosis: "",
    paymentMode: "Cash", amount: 0,
    paymentSplits: [],
    isSplit: false,
    notes: "",
  };
}

function splitTotal(splits: PaymentSplit[]): number {
  return splits.reduce((s, sp) => s + (sp.amount || 0), 0);
}

function resolveEntry(e: EntryRow): EntryRow {
  if (!e.isSplit || !e.paymentSplits?.length) return e;
  const total = splitTotal(e.paymentSplits);
  const dominant = [...e.paymentSplits].sort((a, b) => b.amount - a.amount)[0];
  return { ...e, amount: total, paymentMode: dominant?.mode ?? "Cash" };
}

function calcTotals(entries: EntryRow[]) {
  const t = { Cash: 0, UPI: 0, Card: 0, Cheque: 0, total: 0 };
  entries.forEach(e => {
    const resolved = resolveEntry(e);
    if (resolved.isSplit && resolved.paymentSplits?.length) {
      resolved.paymentSplits.forEach(sp => { t[sp.mode] += sp.amount || 0; t.total += sp.amount || 0; });
    } else {
      t[resolved.paymentMode] += resolved.amount || 0;
      t.total                 += resolved.amount || 0;
    }
  });
  return t;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DailySummaryPage() {
  const session  = getSession();
  const userName = session?.name ?? "Admin";

  const [selectedDate, setSelectedDate] = useState(today());
  const [summary, setSummary]           = useState<DailySummaryResponse | null>(null);
  const [manualEntries, setManualEntries] = useState<ManualEntryResponse[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState<string | null>(null);

  // filters
  const [search,     setSearch]     = useState("");
  const [statusFilt, setStatusFilt] = useState("");

  // modals
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<ManualEntryResponse | null>(null);
  const [viewTarget,   setViewTarget]   = useState<ManualEntryResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualEntryResponse | null>(null);

  // form
  const [entries,   setEntries]   = useState<EntryRow[]>([emptyEntry(1)]);
  const [entryErrs, setEntryErrs] = useState<EntryError[]>([{}]);
  const [formErrs,  setFormErrs]  = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);

  // ── data loading ──
  async function loadSummary(date: string) {
    setLoading(true);
    setError(null);
    try {
      const { ok, data, error: err } = await apiFetch(`/api/daily-summary?date=${date}`);
      if (ok) {
        setSummary(data as DailySummaryResponse);
        setManualEntries((data as DailySummaryResponse).manualEntries ?? []);
      } else {
        setError(err);
      }
    } catch (e) {
      setError("Failed to load daily summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSummary(selectedDate); }, [selectedDate]);

  // ── Unified row type ──
  type UnifiedRow =
    | { kind: "bill";   bill: BillSummaryRow }
    | { kind: "manual"; entry: ManualEntryResponse };

  // ── derived ──
  const allRows = useMemo<UnifiedRow[]>(() => {
    const bills: UnifiedRow[] = (summary?.bills ?? []).map(b => ({ kind: "bill", bill: b }));
    const manual: UnifiedRow[] = manualEntries.map(e => ({ kind: "manual", entry: e }));
    return [...bills, ...manual];
  }, [summary, manualEntries]);

  const filtered = useMemo<UnifiedRow[]>(() => {
    const q = search.toLowerCase();
    return allRows.filter(row => {
      if (row.kind === "bill") {
        const b = row.bill;
        const ms = !q || b.patientName.toLowerCase().includes(q) ||
          (b.billNo ?? "").toLowerCase().includes(q) ||
          (b.doctorName ?? "").toLowerCase().includes(q);
        const mst = !statusFilt || b.status.toUpperCase() === statusFilt.toUpperCase();
        return ms && mst;
      } else {
        const e = row.entry;
        const ms = !q || e.patientName.toLowerCase().includes(q) ||
          e.consultantName.toLowerCase().includes(q) || e.diagnosis.toLowerCase().includes(q);
        const mst = !statusFilt || (summary?.status ?? "DRAFT").toUpperCase() === statusFilt.toUpperCase();
        return ms && mst;
      }
    });
  }, [allRows, search, statusFilt, summary]);

  // ── recompute summary from entries ──
  function recompute(ents: EntryRow[]) {
    // just for live display in modal; actual totals come from backend
    void ents;
  }

  function handleEntryChange(idx: number, field: keyof EntryRow, raw: string) {
    const isNum = field === "amount";
    const val = field === "age"
      ? (raw === "" ? 0 : Number(raw))
      : isNum
        ? (Number(raw) || 0)
        : raw;
    const newEntries = entries.map((e, i) => i === idx ? { ...e, [field]: val } : e);
    setEntries(newEntries);
    recompute(newEntries);
  }

  function addEntryRow() {
    setEntries(prev => [...prev, emptyEntry(prev.length + 1)]);
    setEntryErrs(prev => [...prev, {}]);
  }

  function removeEntryRow(idx: number) {
    const newEntries = entries.filter((_, i) => i !== idx).map((e, i) => ({ ...e, sno: i + 1 }));
    setEntries(newEntries);
    setEntryErrs(prev => prev.filter((_, i) => i !== idx));
  }

  function validate(): boolean {
    const fe: Record<string, string> = {};
    const eerrs: EntryError[] = entries.map(e => {
      const ee: EntryError = {};
      if (!e.patientName.trim())    ee.patientName    = "Required";
      if (!e.consultantName.trim()) ee.consultantName = "Required";
      if (!e.diagnosis.trim())      ee.diagnosis      = "Required";
      if (e.isSplit) {
        const tot = splitTotal(e.paymentSplits ?? []);
        if (!e.paymentSplits?.length || tot <= 0) ee.splits = "Add at least one split amount";
      } else {
        if (!e.amount || e.amount <= 0) ee.amount = "Required";
      }
      return ee;
    });
    setFormErrs(fe);
    setEntryErrs(eerrs);
    return Object.keys(fe).length === 0 && !eerrs.some(ee => Object.keys(ee).length > 0);
  }

  function openAdd() {
    setEntries([emptyEntry(1)]);
    setEntryErrs([{}]);
    setFormErrs({});
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(me: ManualEntryResponse) {
    if (summary?.status === "SUBMITTED") return;
    // Reconstruct EntryRow from ManualEntryResponse
    let splits: PaymentSplit[] = [];
    let isSplit = false;
    if (me.paymentSplitsJson) {
      try {
        splits = JSON.parse(me.paymentSplitsJson);
        isSplit = splits.length > 1;
      } catch {
        splits = [];
      }
    }
    setEntries([{
      sno: me.sno, patientName: me.patientName, age: me.age, sex: me.sex,
      visitType: me.visitType, consultantName: me.consultantName, diagnosis: me.diagnosis,
      paymentMode: me.paymentMode as CollectionPaymentMode, amount: me.amount,
      isSplit, paymentSplits: splits, notes: me.notes ?? "",
    }]);
    setEntryErrs([{}]);
    setFormErrs({});
    setEditing(me);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      // Save each entry row (for new, each row is one entry; for edit, only one row)
      const rowsToSave = editing ? [entries[0]] : entries;
      for (const e of rowsToSave) {
        const resolved = resolveEntry(e);
        const body = {
          entryDate: selectedDate,
          patientName: resolved.patientName,
          age: resolved.age,
          sex: resolved.sex,
          visitType: resolved.visitType,
          consultantName: resolved.consultantName,
          diagnosis: resolved.diagnosis,
          paymentMode: resolved.paymentMode,
          amount: resolved.amount,
          paymentSplitsJson: resolved.isSplit && resolved.paymentSplits?.length
            ? JSON.stringify(resolved.paymentSplits)
            : null,
          notes: resolved.notes || null,
        };

        let result;
        if (editing) {
          result = await apiFetch(`/api/daily-summary/entries/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        } else {
          result = await apiFetch("/api/daily-summary/entries", {
            method: "POST",
            body: JSON.stringify(body),
          });
        }
        if (!result.ok) {
          setFormErrs({ save: result.error });
          setSaving(false);
          return;
        }
      }
      await loadSummary(selectedDate);
      setModalOpen(false);
    } catch {
      setFormErrs({ save: "Failed to save entry" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { ok, error: err } = await apiFetch(`/api/daily-summary/entries/${deleteTarget.id}`, { method: "DELETE" });
    if (ok) {
      await loadSummary(selectedDate);
    } else {
      alert(err);
    }
    setDeleteTarget(null);
  }

  async function handleSubmit() {
    const { ok, error: err } = await apiFetch(
      `/api/daily-summary/${selectedDate}/submit?submittedBy=${encodeURIComponent(userName)}`,
      { method: "PATCH" }
    );
    if (ok) {
      await loadSummary(selectedDate);
    } else {
      alert(err);
    }
  }

  function clearFilters() { setSearch(""); setStatusFilt(""); }
  const anyFilter = !!(search || statusFilt);

  const liveTotals = calcTotals(entries);
  const isSubmitted = summary?.status === "SUBMITTED";

  return (
    <div>
      <PageHeader
        title="Daily Cash Collection"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Daily Summary" }, { label: "Cash Collection" }]}
        action={{ label: "New Day Entry", onClick: openAdd }}
      />

      {/* ── Date Selector ── */}
      <div className="flex flex-wrap items-end gap-4 mb-5 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Select Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"/>
        </div>
        {summary && (
          <div className="flex items-center gap-3 ml-auto">
            <Badge
              label={summary.status === "SUBMITTED" ? "Submitted" : "Draft"}
              variant={summary.status === "SUBMITTED" ? "green" : "yellow"}
              dot
            />
            {!isSubmitted && (
              <button onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                Submit Day
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SCard label="Bills"           value={String(summary?.bills?.length ?? 0)}   color="text-slate-800" />
        <SCard label="Total Income"    value={inr(summary?.totalIncome ?? 0)}        color="text-violet-600" />
        <SCard label="Total Expense"   value={inr(summary?.totalExpense ?? 0)}       color="text-red-500" />
        <SCard label="Net Collection"  value={inr(summary?.netCollection ?? 0)}      color="text-emerald-600" />
      </div>

      {/* ── Bills breakdown strip (summary only) ── */}
      {summary && (summary.billCash > 0 || summary.billCard > 0 || summary.billUpi > 0 || summary.billCheque > 0 || summary.billInsurance > 0) && (
        <div className="mb-4 flex flex-wrap gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <span className="font-semibold text-slate-500 self-center">Bill Breakdown:</span>
          {summary.billCash > 0      && <span className="flex items-center gap-1">Cash: <strong className="text-slate-800">{inr(summary.billCash)}</strong></span>}
          {summary.billCard > 0      && <span className="flex items-center gap-1">Card: <strong className="text-slate-800">{inr(summary.billCard)}</strong></span>}
          {summary.billUpi > 0       && <span className="flex items-center gap-1">UPI: <strong className="text-slate-800">{inr(summary.billUpi)}</strong></span>}
          {summary.billCheque > 0    && <span className="flex items-center gap-1">Cheque: <strong className="text-slate-800">{inr(summary.billCheque)}</strong></span>}
          {summary.billInsurance > 0 && <span className="flex items-center gap-1">Insurance: <strong className="text-slate-800">{inr(summary.billInsurance)}</strong></span>}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, bill no, consultant, diagnosis…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
        </div>
        <div className="relative">
          <select value={statusFilt} onChange={e => setStatusFilt(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer">
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partial</option>
            <option value="PENDING">Pending</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        {anyFilter && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center whitespace-nowrap">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded w-24" />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-5 bg-slate-200 rounded-full w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}
      {error && !loading && (
        <div className="py-6 text-center text-red-500 text-sm">{error}</div>
      )}

      {/* ── Unified Table ── */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["S.No","Source","Patient Name","Details","Type","Payment Mode","Amount","Status","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                        No entries found for {selectedDate}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((row, idx) => {
                  if (row.kind === "bill") {
                    const b = row.bill;
                    return (
                      <tr key={`bill-${b.billNo}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">Bill</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 whitespace-nowrap">{b.patientName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{b.billNo} · {b.uhid}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{b.doctorName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge label={b.patientType} variant={b.patientType === "IP" ? "sky" : "gray"} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            b.paymentMode === "CASH"      ? "bg-green-50 text-green-700"  :
                            b.paymentMode === "UPI"       ? "bg-sky-50 text-sky-700"      :
                            b.paymentMode === "CARD"      ? "bg-violet-50 text-violet-700":
                            b.paymentMode === "CHEQUE"    ? "bg-amber-50 text-amber-700"  :
                            b.paymentMode === "INSURANCE" ? "bg-blue-50 text-blue-700"    :
                            "bg-slate-50 text-slate-700"
                          }`}>
                            {b.paymentMode}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{inr(b.paidAmount)}</p>
                          {b.totalAmount !== b.paidAmount && <p className="text-[10px] text-slate-400">of {inr(b.totalAmount)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={b.status} variant={b.status === "PAID" ? "green" : b.status === "PARTIALLY_PAID" ? "yellow" : b.status === "PENDING" ? "red" : "gray"} />
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">—</td>
                      </tr>
                    );
                  } else {
                    const me = row.entry;
                    let splits: PaymentSplit[] = [];
                    if (me.paymentSplitsJson) {
                      try { splits = JSON.parse(me.paymentSplitsJson); } catch { splits = []; }
                    }
                    return (
                      <tr key={`manual-${me.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">Manual</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 whitespace-nowrap">{me.patientName}</p>
                          <p className="text-[10px] text-slate-400">{me.age}y · {me.sex} · {me.diagnosis}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{me.consultantName}</td>
                        <td className="px-4 py-3">
                          <Badge label={me.visitType} variant={me.visitType === "ICU" ? "red" : me.visitType === "HDU" ? "yellow" : me.visitType === "IP" ? "sky" : "gray"} />
                        </td>
                        <td className="px-4 py-3">
                          {splits.length > 1 ? (
                            <div className="flex flex-wrap gap-1">
                              {splits.map((sp, si) => (
                                <span key={si} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${MODE_COLOR[sp.mode as CollectionPaymentMode] ?? "bg-slate-50 text-slate-700"}`}>
                                  {MODE_ICON[sp.mode as CollectionPaymentMode]} {inr(sp.amount)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${MODE_COLOR[me.paymentMode as CollectionPaymentMode] ?? "bg-slate-50 text-slate-700"}`}>
                              {MODE_ICON[me.paymentMode as CollectionPaymentMode]} {me.paymentMode}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">{inr(me.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge label={summary?.status === "SUBMITTED" ? "Submitted" : "Draft"} variant={summary?.status === "SUBMITTED" ? "green" : "yellow"} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewTarget(me)} title="View"
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.504 0C6.967 8.516 9.28 6.5 12 6.5s5.033 2.016 6.504 5.5C16.033 15.484 13.72 17.5 11 17.5S5.967 15.484 4.496 12z"/></svg>
                            </button>
                            {!isSubmitted && (
                              <>
                                <button onClick={() => openEdit(me)} title="Edit"
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                                <button onClick={() => setDeleteTarget(me)} title="Delete"
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{filtered.length} of {allRows.length} entries</span>
            <span className="font-semibold text-slate-600">
              Total (filtered): {inr(filtered.reduce((s, row) =>
                s + (row.kind === "bill" ? row.bill.paidAmount : row.entry.amount), 0))}
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Add / Edit Modal
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Entry — ${editing.patientName}` : "New Daily Collection Entry"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save Changes" : "Save Entry"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* header strip */}
          <div className="flex flex-wrap gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <AField label="Date"       value={selectedDate} />
            <AField label="Created By" value={userName} />
          </div>

          {formErrs.save && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formErrs.save}</p>
          )}

          {/* ── Entry rows ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">
                Collection Entries
                {formErrs.entries && <span className="ml-2 text-xs text-red-500 font-normal">{formErrs.entries}</span>}
              </p>
              {!editing && (
                <button onClick={addEntryRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  Add Row
                </button>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-sm">
                No entries yet — click "Add Row" to start.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["#","Patient Name *","Age","Sex","Type","Consultant *","Diagnosis *","Payment Mode / Split","Amount (₹) *",""].map(h => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {entries.map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-slate-400 w-6">{idx + 1}</td>

                          {/* Patient Name */}
                          <td className="px-2 py-1.5 min-w-[120px]">
                            <input value={e.patientName} onChange={ev => handleEntryChange(idx, "patientName", ev.target.value)}
                              placeholder="Patient name"
                              className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 ${entryErrs[idx]?.patientName ? "border-red-300" : "border-slate-200"}`}/>
                            {entryErrs[idx]?.patientName && <p className="text-red-500 text-[10px] mt-0.5">{entryErrs[idx].patientName}</p>}
                          </td>

                          {/* Age */}
                          <td className="px-2 py-1.5 w-14">
                            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
                              value={e.age === 0 ? "" : String(e.age)}
                              onChange={ev => {
                                const v = ev.target.value.replace(/\D/g, "");
                                handleEntryChange(idx, "age", v === "" ? "0" : v);
                              }}
                              placeholder="Age"
                              className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 text-center"/>
                          </td>

                          {/* Sex */}
                          <td className="px-2 py-1.5 w-14">
                            <select value={e.sex} onChange={ev => handleEntryChange(idx, "sex", ev.target.value)}
                              className="w-full px-1 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer">
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </select>
                          </td>

                          {/* Visit Type */}
                          <td className="px-2 py-1.5 w-16">
                            <select value={e.visitType} onChange={ev => handleEntryChange(idx, "visitType", ev.target.value)}
                              className="w-full px-1 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer">
                              {VISIT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </td>

                          {/* Consultant */}
                          <td className="px-2 py-1.5 min-w-[110px]">
                            <input value={e.consultantName} onChange={ev => handleEntryChange(idx, "consultantName", ev.target.value)}
                              placeholder="Dr. name"
                              className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 ${entryErrs[idx]?.consultantName ? "border-red-300" : "border-slate-200"}`}/>
                            {entryErrs[idx]?.consultantName && <p className="text-red-500 text-[10px] mt-0.5">{entryErrs[idx].consultantName}</p>}
                          </td>

                          {/* Diagnosis */}
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <input value={e.diagnosis} onChange={ev => handleEntryChange(idx, "diagnosis", ev.target.value)}
                              placeholder="Diagnosis"
                              className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 ${entryErrs[idx]?.diagnosis ? "border-red-300" : "border-slate-200"}`}/>
                            {entryErrs[idx]?.diagnosis && <p className="text-red-500 text-[10px] mt-0.5">{entryErrs[idx].diagnosis}</p>}
                          </td>

                          {/* Payment Mode / Split Payment */}
                          <td className="px-2 py-1.5 min-w-[200px]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <button type="button"
                                onClick={() => {
                                  const next = !e.isSplit;
                                  const newEntries = entries.map((row, i) => {
                                    if (i !== idx) return row;
                                    if (next) {
                                      return { ...row, isSplit: true, paymentSplits: [{ mode: row.paymentMode, amount: row.amount }] };
                                    } else {
                                      const dom = [...(row.paymentSplits ?? [])].sort((a, b) => b.amount - a.amount)[0];
                                      return { ...row, isSplit: false, paymentMode: dom?.mode ?? "Cash", amount: dom?.amount ?? 0, paymentSplits: [] };
                                    }
                                  });
                                  setEntries(newEntries);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                  e.isSplit
                                    ? "bg-violet-100 text-violet-700 border-violet-300"
                                    : "bg-slate-50 text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600"
                                }`}
                              >
                                {e.isSplit ? "✓ Split" : "+ Split"}
                              </button>
                              {e.isSplit && <span className="text-[10px] text-slate-400">multi-mode</span>}
                            </div>

                            {e.isSplit ? (
                              <div className="space-y-1">
                                {(e.paymentSplits ?? []).map((sp, si) => (
                                  <div key={si} className="flex items-center gap-1">
                                    <select value={sp.mode}
                                      onChange={ev => {
                                        const splits = (e.paymentSplits ?? []).map((s, xi) =>
                                          xi === si ? { ...s, mode: ev.target.value as CollectionPaymentMode } : s
                                        );
                                        const newEntries = entries.map((row, i) => i === idx ? { ...row, paymentSplits: splits } : row);
                                        setEntries(newEntries);
                                      }}
                                      className="px-1 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer w-20">
                                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{MODE_ICON[m]} {m}</option>)}
                                    </select>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                                      value={sp.amount === 0 ? "" : String(sp.amount)}
                                      onChange={ev => {
                                        const v = Number(ev.target.value.replace(/\D/g, "") || 0);
                                        const splits = (e.paymentSplits ?? []).map((s, xi) =>
                                          xi === si ? { ...s, amount: v } : s
                                        );
                                        const newEntries = entries.map((row, i) => i === idx ? { ...row, paymentSplits: splits } : row);
                                        setEntries(newEntries);
                                      }}
                                      placeholder="₹"
                                      className="w-16 px-1.5 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 text-right"
                                    />
                                    {si > 0 && (
                                      <button type="button"
                                        onClick={() => {
                                          const splits = (e.paymentSplits ?? []).filter((_, xi) => xi !== si);
                                          const newEntries = entries.map((row, i) => i === idx ? { ...row, paymentSplits: splits } : row);
                                          setEntries(newEntries);
                                        }}
                                        className="text-slate-300 hover:text-red-400 p-0.5">✕</button>
                                    )}
                                  </div>
                                ))}
                                {(e.paymentSplits?.length ?? 0) < 4 && (
                                  <button type="button"
                                    onClick={() => {
                                      const used = new Set((e.paymentSplits ?? []).map(s => s.mode));
                                      const next = PAYMENT_MODES.find(m => !used.has(m)) ?? "Cash";
                                      const splits = [...(e.paymentSplits ?? []), { mode: next, amount: 0 }];
                                      const newEntries = entries.map((row, i) => i === idx ? { ...row, paymentSplits: splits } : row);
                                      setEntries(newEntries);
                                    }}
                                    className="text-[10px] text-violet-500 hover:text-violet-700 font-medium">+ add mode</button>
                                )}
                                <div className="text-[10px] font-bold text-violet-700 text-right pr-1">
                                  Total: {inr(splitTotal(e.paymentSplits ?? []))}
                                </div>
                                {entryErrs[idx]?.splits && <p className="text-red-500 text-[10px]">{entryErrs[idx].splits}</p>}
                              </div>
                            ) : (
                              <select value={e.paymentMode} onChange={ev => handleEntryChange(idx, "paymentMode", ev.target.value)}
                                className="w-full px-1 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer">
                                {PAYMENT_MODES.map(m => <option key={m} value={m}>{MODE_ICON[m]} {m}</option>)}
                              </select>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="px-2 py-1.5 w-24">
                            {e.isSplit ? (
                              <span className="text-xs font-bold text-violet-700">{inr(splitTotal(e.paymentSplits ?? []))}</span>
                            ) : (
                              <>
                                <input type="text" inputMode="numeric" pattern="[0-9]*"
                                  value={e.amount === 0 ? "" : String(e.amount)}
                                  onChange={ev => {
                                    const v = ev.target.value.replace(/\D/g, "");
                                    handleEntryChange(idx, "amount", v === "" ? "0" : v);
                                  }}
                                  placeholder="0"
                                  className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 text-right ${entryErrs[idx]?.amount ? "border-red-300" : "border-slate-200"}`}/>
                                {entryErrs[idx]?.amount && <p className="text-red-500 text-[10px] mt-0.5">{entryErrs[idx].amount}</p>}
                              </>
                            )}
                          </td>

                          {/* Remove */}
                          {!editing && (
                            <td className="px-2 py-1.5 w-8">
                              <button onClick={() => removeEntryRow(idx)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {entries.length > 0 && !editing && (
                      <tfoot>
                        <tr className="bg-violet-50 border-t-2 border-violet-200">
                          <td colSpan={7} className="px-2 py-2 text-xs font-bold text-violet-700 text-right">Breakdown →</td>
                          <td colSpan={2} className="px-2 py-2 text-xs text-violet-700">
                            <div className="flex flex-wrap gap-1">
                              {(["Cash","UPI","Card","Cheque"] as CollectionPaymentMode[])
                                .filter(m => liveTotals[m] > 0)
                                .map(m => (
                                  <span key={m} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${MODE_COLOR[m]}`}>
                                    {MODE_ICON[m]} {m}: {inr(liveTotals[m])}
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-sm font-bold text-violet-900 text-right">{inr(liveTotals.total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Notes (single entry edit) */}
          {editing && (
            <FormField label="Notes">
              <Textarea
                value={entries[0]?.notes ?? ""}
                onChange={e => setEntries(prev => [{ ...prev[0], notes: e.target.value }])}
                placeholder="Any remarks for this entry…" rows={2}/>
            </FormField>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          View Modal
      ══════════════════════════════════════════════════════════════════ */}
      {viewTarget && (
        <Modal open={!!viewTarget} onClose={() => setViewTarget(null)}
          title={`Entry — ${viewTarget.patientName}`} size="xl"
          footer={<button onClick={() => setViewTarget(null)} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg">Close</button>}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm">
              <div><p className="text-slate-400 text-xs">Patient</p><p className="font-semibold">{viewTarget.patientName}</p></div>
              <div><p className="text-slate-400 text-xs">Age / Sex</p><p className="font-semibold">{viewTarget.age} / {viewTarget.sex}</p></div>
              <div><p className="text-slate-400 text-xs">Visit Type</p><p className="font-semibold">{viewTarget.visitType}</p></div>
              <div><p className="text-slate-400 text-xs">Consultant</p><p className="font-semibold">{viewTarget.consultantName}</p></div>
              <div><p className="text-slate-400 text-xs">Diagnosis</p><p className="font-semibold">{viewTarget.diagnosis}</p></div>
              <div><p className="text-slate-400 text-xs">Amount</p><p className="font-bold text-violet-700">{inr(viewTarget.amount)}</p></div>
            </div>
            {viewTarget.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Notes: </span>{viewTarget.notes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Entry" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg">Delete</button>
          </>
        }>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Delete entry for <span className="font-semibold">{deleteTarget?.patientName}</span>?</p>
          <p className="text-xs text-red-500 font-medium">⚠ This action cannot be undone.</p>
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
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
