"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  receiptType?: string | null;
  receiptNo?: string | null;
}

interface BillLite {
  id: number;
  billNo: string;
  patientType: string;
  status: string;
  consolidated?: boolean;
  admissionId: number | null;
  payments?: PaymentRecord[];
}

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
  UPI: "UPI", CHEQUE: "Cheque", INSURANCE: "Insurance", MIXED: "Mixed",
};
const TYPE_LABEL: Record<string, string> = {
  ADVANCE: "Advance", SETTLEMENT: "Settlement", REFUND: "Refund",
};

function inr(n: number) {
  const v = Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-\u20B9" : "\u20B9") + v;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, "0")}-${String(dt.getMonth() + 1).padStart(2, "0")}-${dt.getFullYear()}`;
}

async function apiFetch(path: string) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// Bill statuses that count as "open" (still live for the current admission).
// A closed/paid bill from a prior discharged admission is never picked.
const OPEN_STATUSES = new Set(["DRAFT", "PENDING", "PARTIAL", "PARTIALLY_PAID"]);

/**
 * Picks the admission's single live bill from a list of bills — the IP,
 * non-consolidated, non-cancelled bill that holds the receipts.
 *
 * When the list is already scoped to one admission (fetched via
 * /api/bills/admission/{id}) this just finds the right bill within it.
 * When it's the whole patient (fallback), it prefers an OPEN bill so a
 * closed bill from an older, discharged admission is never chosen.
 */
function pickAdmissionBill(bills: BillLite[]): BillLite | null {
  const candidates = bills
    .filter(b => !b.consolidated && b.status !== "CANCELLED" && b.status !== "CONSOLIDATED")
    .filter(b => b.patientType === "IP" || b.admissionId != null);
  if (candidates.length === 0) return null;
  // Prefer open (live) bills over closed ones.
  const open = candidates.filter(b => OPEN_STATUSES.has(b.status));
  const pool = open.length > 0 ? open : candidates;
  // Within the pool, prefer one that actually has receipts; else most recent (highest id).
  const withReceipts = pool.filter(b => (b.payments?.length ?? 0) > 0);
  const finalPool = withReceipts.length > 0 ? withReceipts : pool;
  return finalPool.reduce((a, b) => (a && a.id > b.id ? a : b));
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Expandable ledger of advance/settlement/refund receipts for a patient's
 * admission bill. Shows Total Received and a "Generate Final Split-up Bill"
 * action that opens the prefilled bill-craft form.
 *
 * `refreshKey` — bump it (e.g. after Collect Cash) to re-fetch the ledger.
 */
export default function ReceiptsPanel({
  patientId, admissionId = null, refreshKey = 0, onCollectCash,
}: {
  patientId: number;
  /** Active admission id — when set, receipts are scoped to this admission only. */
  admissionId?: number | null;
  refreshKey?: number;
  /** When provided, the panel header shows a "Collect Cash" button that calls this. */
  onCollectCash?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [receipts, setReceipts] = useState<PaymentRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    // Scope to the active admission when known; otherwise fall back to the
    // whole patient (pickAdmissionBill then prefers an open bill).
    const path = admissionId != null
      ? `/api/bills/admission/${admissionId}`
      : `/api/bills/patient/${patientId}`;
    const { ok, data, error } = await apiFetch(path);
    if (!ok) { setErr(error); setLoading(false); return; }
    const bills = (Array.isArray(data) ? data : []) as BillLite[];
    const bill = pickAdmissionBill(bills);
    const list = (bill?.payments ?? []).slice().sort((a, b) => a.id - b.id);
    setReceipts(list);
    setLoading(false);
  }, [patientId, admissionId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const total = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Receipts — this admission</p>
        {onCollectCash && (
          <button
            type="button"
            onClick={onCollectCash}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Collect Cash
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-2">Loading receipts…</p>
      ) : err ? (
        <p className="text-xs text-red-500 py-2">{err}</p>
      ) : receipts.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No receipts collected yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-200">
                <th className="text-left font-semibold py-1 pr-3">Date</th>
                <th className="text-left font-semibold py-1 pr-3">Receipt No</th>
                <th className="text-left font-semibold py-1 pr-3">Type</th>
                <th className="text-left font-semibold py-1 pr-3">Mode</th>
                <th className="text-right font-semibold py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-3 text-slate-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="py-1 pr-3 font-mono text-slate-500">{r.receiptNo ?? "—"}</td>
                  <td className="py-1 pr-3 text-slate-600">{TYPE_LABEL[r.receiptType ?? ""] ?? "—"}</td>
                  <td className="py-1 pr-3 text-slate-600">{MODE_LABEL[r.paymentMode] ?? r.paymentMode}</td>
                  <td className={`py-1 text-right font-medium ${r.amount < 0 ? "text-red-600" : "text-slate-800"}`}>
                    {inr(r.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-300">
                <td colSpan={4} className="py-1.5 text-right font-bold text-slate-700">Total Received :</td>
                <td className="py-1.5 text-right font-bold text-emerald-700">{inr(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
