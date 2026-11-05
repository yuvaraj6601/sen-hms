"use client";

import { use, Suspense, useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { getSession } from "../../../../_lib/auth";
import BillWorkspace from "../../../../_components/billing/BillWorkspace";
import CollectCashModal, {
  type CollectCashPatient,
} from "../../../../_components/CollectCashModal";
// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientResponse {
  id: number;
  uhid: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
}

interface AdmissionResponse {
  id: number;
  admissionNo: string;
  admissionDate: string;
  admissionTime: string | null;
  dischargeDate: string | null;
  status: string;
  admittingDoctorName: string;
  wardName: string;
  bedNumber: string;
  paymentMode: string;
  isInsurance?: boolean;
  insuranceCompany: string | null;
  department: string;
}

interface PaymentRecord {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  receiptType?: string | null;
  receiptNo?: string | null;
  receivedBy?: string | null;
  transactionGroupId?: string | null;
}

interface LabTest {
  id: number;
  labId: string;
  investigationName: string;
  category: string;
  price: number;
  status: string;
  orderedDate: string;
  orderedTime: string;
  orderedBy: string;
  result: string | null;
  isAbnormal: boolean;
  completedDate?: string | null;
  completedBy?: string | null;
  orderGroupId?: string | null;
  admissionId?: number | null;
}

interface LabOrderGroup {
  key: string;
  orderedDate: string;
  orderedTime: string;
  groupStatus: string;
  tests: LabTest[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string) {
  const res = await fetch(path, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  return {
    ok: res.ok && json.success,
    data: json.data,
    error: json.error ?? "Request failed",
  };
}

function inr(n: number) {
  const abs = Math.abs(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (n < 0 ? "-₹" : "₹") + abs;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  UPI: "UPI",
  CHEQUE: "Cheque",
  INSURANCE: "Insurance",
  MIXED: "Mixed",
};
const RCPT_TYPE_LABEL: Record<string, string> = {
  ADVANCE: "Advance",
  SETTLEMENT: "Settlement",
  LAB: "Lab",
  REFUND: "Refund",
};
const LAB_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-700",
  PAID: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const LAB_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function rollupStatus(tests: LabTest[]): string {
  const active = [
    ...new Set(
      tests.filter((t) => t.status !== "CANCELLED").map((t) => t.status)
    ),
  ];
  if (active.length === 0) return "CANCELLED";
  if (active.length === 1) return active[0];
  for (const s of [
    "PENDING",
    "AWAITING_PAYMENT",
    "PAID",
    "IN_PROGRESS",
    "COMPLETED",
  ]) {
    if (active.includes(s)) return s;
  }
  return active[0];
}

function groupLabTests(labs: LabTest[]): LabOrderGroup[] {
  const map = new Map<string, LabTest[]>();
  for (const l of labs) {
    const key = l.orderGroupId ?? `lab-${l.id}`;
    const arr = map.get(key);
    if (arr) arr.push(l);
    else map.set(key, [l]);
  }
  return [...map.entries()].map(([key, tests]) => ({
    key,
    orderedDate: tests[0].orderedDate,
    orderedTime: tests[0].orderedTime,
    groupStatus: rollupStatus(tests),
    tests,
  }));
}

type PageTab = "main-bill" | "receipts" | "lab-orders";

const TABS: { id: PageTab; label: string; icon: string }[] = [
  { id: "main-bill", label: "Main Bill", icon: "💰" },
  { id: "receipts", label: "Receipts", icon: "🧾" },
  { id: "lab-orders", label: "Lab Orders", icon: "🔬" },
];

// ─── Receipts panel ───────────────────────────────────────────────────────────

function ReceiptsTab({
  patientId,
  admissionId,
  refreshKey,
}: {
  patientId: number;
  admissionId: number | null;
  refreshKey: number;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [receipts, setReceipts] = useState<PaymentRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    // Prefer admission-scoped fetch; fall back to patient
    const path =
      admissionId != null
        ? `/api/bills/admission/${admissionId}`
        : `/api/bills/patient/${patientId}`;
    const { ok, data, error } = await apiFetch(path);
    if (!ok) {
      setErr(error);
      setLoading(false);
      return;
    }
    const bills = (Array.isArray(data) ? data : []) as Array<{
      id: number;
      status: string;
      consolidated?: boolean;
      admissionId: number | null;
      payments?: PaymentRecord[];
    }>;
    // Pick all real (non-consolidated, non-cancelled) bills for this admission
    const real = bills.filter(
      (b) =>
        !b.consolidated &&
        b.status !== "CANCELLED" &&
        b.status !== "CONSOLIDATED"
    );
    const all = real
      .flatMap((b) => b.payments ?? [])
      .sort((a, b) => a.id - b.id);
    setReceipts(all);
    setLoading(false);
  }, [patientId, admissionId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const total = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  if (loading)
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Loading receipts…
      </div>
    );
  if (err)
    return (
      <div className="py-16 text-center text-red-500 text-sm">{err}</div>
    );
  if (receipts.length === 0)
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        No receipts collected for this admission yet.
      </div>
    );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Receipt No</th>
              <th className="px-4 py-2.5 text-left">Type</th>
              <th className="px-4 py-2.5 text-left">Mode</th>
              <th className="px-4 py-2.5 text-left">Received By</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                  {fmt(r.date)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                  {r.receiptNo ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full
                    ${
                      r.receiptType === "ADVANCE"
                        ? "bg-sky-100 text-sky-700"
                        : r.receiptType === "SETTLEMENT"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.receiptType === "REFUND"
                        ? "bg-red-100 text-red-700"
                        : r.receiptType === "LAB"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {RCPT_TYPE_LABEL[r.receiptType ?? ""] ?? r.receiptType ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                  {MODE_LABEL[r.paymentMode] ?? r.paymentMode}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {r.receivedBy ?? "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap
                  ${r.amount < 0 ? "text-red-600" : "text-slate-800"}`}
                >
                  {inr(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td
                colSpan={5}
                className="px-4 py-3 text-right font-bold text-slate-700"
              >
                Total Received
              </td>
              <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                {inr(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Lab Orders panel ─────────────────────────────────────────────────────────

function LabOrdersTab({
  patientId,
  admission,
  refreshKey,
}: {
  patientId: number;
  admission: AdmissionResponse | null;
  refreshKey: number;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [groups, setGroups] = useState<LabOrderGroup[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    // Always fetch by patient so OP-lab orders (no admissionId) are included
    const { ok, data, error } = await apiFetch(
      `/api/lab/investigations/patient/${patientId}`
    );
    if (!ok) {
      setErr(error);
      setLoading(false);
      return;
    }
    const raw: LabTest[] = Array.isArray(data)
      ? data
      : (data as { content?: LabTest[] })?.content ?? [];

    // Scope to selected admission (same logic as case-sheet scopeLabsToAdmission)
    let scoped = raw;
    if (admission) {
      const admId = admission.id;
      const from = admission.admissionDate ?? null;
      const to =
        admission.dischargeDate ?? new Date().toISOString().slice(0, 10);
      scoped = raw.filter((l) => {
        if (l.admissionId != null) return l.admissionId === admId;
        if (!from || !l.orderedDate) return true;
        return l.orderedDate >= from && l.orderedDate <= to;
      });
    }

    setGroups(
      groupLabTests(scoped).sort((a, b) =>
        b.orderedDate.localeCompare(a.orderedDate)
      )
    );
    setLoading(false);
  }, [patientId, admission]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading)
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Loading lab orders…
      </div>
    );
  if (err)
    return (
      <div className="py-16 text-center text-red-500 text-sm">{err}</div>
    );
  if (groups.length === 0)
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        No lab orders found for this admission.
      </div>
    );

  const totalAmt = groups.reduce(
    (s, g) => s + g.tests.reduce((ts, t) => ts + (t.price || 0), 0),
    0
  );

  return (
    <div className="space-y-3">
      {/* Summary totals bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Order Groups
          </p>
          <p className="font-bold text-slate-900">{groups.length}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Tests
          </p>
          <p className="font-bold text-slate-900">
            {groups.reduce((s, g) => s + g.tests.length, 0)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Estimated Total
          </p>
          <p className="font-bold text-indigo-700">{inr(totalAmt)}</p>
        </div>
      </div>

      {/* Order groups */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
              <th className="px-3 py-2.5 text-left w-8"></th>
              <th className="px-3 py-2.5 text-left">Order Group</th>
              <th className="px-3 py-2.5 text-left">Date / Time</th>
              <th className="px-3 py-2.5 text-left">Tests</th>
              <th className="px-3 py-2.5 text-left">Ordered By</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = expandedKey === g.key;
              const groupTotal = g.tests.reduce(
                (s, t) => s + (t.price || 0),
                0
              );
              const orderedBy =
                [...new Set(g.tests.map((t) => t.orderedBy).filter(Boolean))].join(", ") || "—";
              return (
                <Fragment key={g.key}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedKey((prev) =>
                            prev === g.key ? null : g.key
                          )
                        }
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all
                          ${
                            isOpen
                              ? "bg-purple-100 text-purple-600 rotate-90"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          }`}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {g.key.startsWith("lab-")
                          ? g.tests[0]?.labId ?? g.key
                          : g.key.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {fmt(g.orderedDate)}{" "}
                      {g.orderedTime
                        ? g.orderedTime.slice(0, 5)
                        : ""}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 font-medium">
                      {g.tests.length}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[140px] truncate">
                      {orderedBy}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full
                        ${LAB_STATUS_COLOR[g.groupStatus] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {LAB_STATUS_LABEL[g.groupStatus] ?? g.groupStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {inr(groupTotal)}
                    </td>
                  </tr>

                  {/* Expanded test detail */}
                  {isOpen && (
                    <tr className="bg-slate-50/80">
                      <td></td>
                      <td colSpan={6} className="px-3 py-2">
                        <table className="w-full text-[11px] border border-slate-200 rounded overflow-hidden">
                          <thead>
                            <tr className="bg-slate-100 text-slate-500 uppercase tracking-wide">
                              <th className="px-2 py-1.5 text-left">Lab ID</th>
                              <th className="px-2 py-1.5 text-left">
                                Investigation
                              </th>
                              <th className="px-2 py-1.5 text-left">
                                Category
                              </th>
                              <th className="px-2 py-1.5 text-left">Status</th>
                              <th className="px-2 py-1.5 text-left">Result</th>
                              <th className="px-2 py-1.5 text-left">
                                Completed
                              </th>
                              <th className="px-2 py-1.5 text-right">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.tests.map((t) => (
                              <tr
                                key={t.id}
                                className="border-t border-slate-100"
                              >
                                <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                                  {t.labId}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 font-medium">
                                  {t.investigationName}
                                  {t.isAbnormal && (
                                    <span
                                      className="ml-1 text-red-500 font-bold"
                                      title="Abnormal result"
                                    >
                                      ⚠
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">
                                  {t.category || "—"}
                                </td>
                                <td className="px-2 py-1.5">
                                  <span
                                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                    ${LAB_STATUS_COLOR[t.status] ?? "bg-slate-100 text-slate-600"}`}
                                  >
                                    {LAB_STATUS_LABEL[t.status] ?? t.status}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-slate-600 max-w-[120px] truncate">
                                  {t.result || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                                  {t.completedDate
                                    ? `${fmt(t.completedDate)}${t.completedBy ? ` · ${t.completedBy}` : ""}`
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-medium text-slate-800">
                                  {inr(t.price || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-300 bg-slate-50">
                              <td
                                colSpan={6}
                                className="px-2 py-1.5 text-right font-bold text-slate-600"
                              >
                                Group Total
                              </td>
                              <td className="px-2 py-1.5 text-right font-bold text-indigo-700">
                                {inr(
                                  g.tests.reduce(
                                    (s, t) => s + (t.price || 0),
                                    0
                                  )
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td
                colSpan={6}
                className="px-3 py-3 text-right font-bold text-slate-700"
              >
                Total Estimated
              </td>
              <td className="px-3 py-3 text-right font-bold text-indigo-700 whitespace-nowrap">
                {inr(totalAmt)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers for isFinancialBill (mirrors BillWorkspace) ─────────────────────
function isFinancialBill(b: { status: string; consolidated?: boolean }): boolean {
  return b.status !== "CONSOLIDATED" && b.consolidated !== true && b.status !== "CANCELLED";
}

const CLAIM_PRIORITY: Record<string, number> = {
  SETTLED: 0, CLAIMED: 1, APPROVED: 2, SENT_FOR_APPROVAL: 3, DETAILS_INCOMPLETE: 4, DECLINED: 5,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function PatientBillsPageInner({ patientId }: { patientId: number }) {
  const session = getSession();
  const canCraft =
    session?.role === "Admin" ||
    session?.role === "Receptionist" ||
    session?.role === "Managing Director" ||
    session?.role === "Lab/Ins/Reception";

  const [tab, setTab] = useState<PageTab>("main-bill");
  const [refreshKey, setRefreshKey] = useState(0);

  // Patient + admissions
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionResponse[]>([]);
  const [selectedAdmId, setSelectedAdmId] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageErr, setPageErr] = useState("");

  // Summary card — bill totals + insurance claim status
  const [summaryTotalAmt, setSummaryTotalAmt] = useState(0);
  const [summaryDue, setSummaryDue] = useState(0);
  const [summaryIsIns, setSummaryIsIns] = useState(false);
  const [summaryInsurer, setSummaryInsurer] = useState("");
  const [summaryClaimStatus, setSummaryClaimStatus] = useState<string | null>(null);

  // Print-on-letterhead toggle — single source of truth, passed down to BillWorkspace as a prop
  const [letterheadMode, setLetterheadMode] = useState<boolean>(() => {
    try { return localStorage.getItem("billLetterheadMode") === "1"; } catch { return false; }
  });
  function toggleLetterhead(on: boolean) {
    setLetterheadMode(on);
    try { localStorage.setItem("billLetterheadMode", on ? "1" : "0"); } catch { /* ignore */ }
  }

  // Collect Cash modal
  const [collectPatient, setCollectPatient] = useState<CollectCashPatient | null>(null);

  // ── Load patient + admissions ──────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    setPageLoading(true);
    setPageErr("");
    const [patRes, admRes] = await Promise.all([
      apiFetch(`/api/patients/${patientId}`),
      apiFetch(`/api/admissions/patient/${patientId}`),
    ]);
    if (!patRes.ok) {
      setPageErr(patRes.error);
      setPageLoading(false);
      return;
    }
    setPatient(patRes.data as PatientResponse);
    if (admRes.ok) {
      const list = (admRes.data as AdmissionResponse[]) ?? [];
      setAdmissions(list);
      const active = list.find((a) => a.status !== "DISCHARGED") ?? list[0] ?? null;
      setSelectedAdmId(active?.id ?? null);
    }
    setPageLoading(false);
  }, [patientId]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ── Load summary card data (bills + claim status) ──────────────────────────
  const loadSummary = useCallback(async () => {
    const { ok, data } = await apiFetch(`/api/bills/patient/${patientId}`);
    if (!ok) return;
    const bills = (Array.isArray(data) ? data : (data?.content ?? [])) as Array<{
      status: string; consolidated?: boolean; insurance: boolean;
      insuranceCompany: string | null; admissionId: number | null;
      totalAmount: number; dueAmount: number;
    }>;
    const financial = bills.filter(isFinancialBill);
    const total = financial.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
    const due   = financial.reduce((s, b) => s + (b.dueAmount   ?? 0), 0);
    setSummaryTotalAmt(total);
    setSummaryDue(due);

    const insBill = financial.find((b) => b.insurance);
    setSummaryIsIns(!!insBill);
    setSummaryInsurer(insBill?.insuranceCompany ?? "");

    // Fetch claim status for the insurance admission
    if (insBill) {
      const admId = bills
        .filter((b) => b.admissionId != null)
        .sort((a, b) => (b.admissionId ?? 0) - (a.admissionId ?? 0))[0]?.admissionId ?? null;
      if (admId != null) {
        const { ok: clOk, data: clData } = await apiFetch(`/api/insurance/claims?page=0&size=100`);
        if (clOk) {
          const claims = (Array.isArray(clData) ? clData : (clData?.content ?? [])) as Array<{
            admissionId: number | null; billId: number | null; status: string;
          }>;
          const linked = claims
            .filter((c) => c.admissionId === admId)
            .sort((a, b) => (CLAIM_PRIORITY[a.status] ?? 9) - (CLAIM_PRIORITY[b.status] ?? 9))[0];
          setSummaryClaimStatus(linked?.status ?? null);
        }
      }
    } else {
      setSummaryClaimStatus(null);
    }
  }, [patientId]);

  useEffect(() => {
    if (!pageLoading) loadSummary();
  }, [pageLoading, loadSummary, refreshKey]);

  const selectedAdm = admissions.find((a) => a.id === selectedAdmId) ?? null;

  // ── Collect Cash opener ────────────────────────────────────────────────────
  function openCollect() {
    if (!patient) return;
    setCollectPatient({
      id: patient.id,
      uhid: patient.uhid,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      doctorName: selectedAdm?.admittingDoctorName ?? null,
      admissionId: selectedAdm?.id ?? null,
      wardName: selectedAdm?.wardName ?? null,
      bedNumber: selectedAdm?.bedNumber ?? null,
    });
  }

  // ── Admission label ────────────────────────────────────────────────────────
  function admLabel(a: AdmissionResponse) {
    const date = fmt(a.admissionDate);
    const status =
      a.status === "DISCHARGED"
        ? `Discharged ${a.dischargeDate ? fmt(a.dischargeDate) : ""}`.trim()
        : "Active";
    return `${a.admissionNo} · ${date} · ${status}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="bills-page animate-pulse">
        {/* Card skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 mb-4">
          {/* breadcrumb row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-10 bg-slate-200 rounded" />
              <div className="h-3 w-2 bg-slate-100 rounded" />
              <div className="h-3 w-10 bg-slate-200 rounded" />
              <div className="h-3 w-2 bg-slate-100 rounded" />
              <div className="h-3 w-24 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
          {/* admission pill */}
          <div className="mb-3">
            <div className="h-7 w-56 bg-slate-200 rounded-full" />
            <div className="mt-2 flex gap-4">
              <div className="h-3 w-36 bg-slate-100 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="border-t border-slate-100 mb-3" />
          {/* patient + bill summary row */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="h-5 w-32 bg-slate-200 rounded mb-1.5" />
              <div className="h-3 w-40 bg-slate-100 rounded" />
            </div>
            <div>
              <div className="h-3 w-20 bg-slate-100 rounded mb-1.5" />
              <div className="h-5 w-28 bg-slate-200 rounded-full" />
            </div>
            <div className="ml-auto flex items-center gap-5">
              <div>
                <div className="h-3 w-8 bg-slate-100 rounded mb-1.5" />
                <div className="h-5 w-20 bg-slate-200 rounded" />
              </div>
              <div>
                <div className="h-3 w-12 bg-slate-100 rounded mb-1.5" />
                <div className="h-5 w-20 bg-slate-200 rounded" />
              </div>
              <div className="h-9 w-28 bg-slate-200 rounded-lg" />
              <div className="h-9 w-36 bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-1 mb-4 border-b border-slate-200 pb-0">
          {[80, 72, 88].map((w) => (
            <div key={w} className="h-10 rounded-t-lg bg-slate-200" style={{ width: w }} />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="h-9 bg-slate-50 border-b border-slate-200" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-8 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <div className="h-5 w-16 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (pageErr) {
    return (
      <div className="py-20 text-center text-red-500 text-sm">{pageErr}</div>
    );
  }

  const patName = patient?.name ?? "Patient";
  const uhid = patient?.uhid ?? "";

  return (
    <div className="bills-page">
      {/* Hide number-input spinners inside this page */}
      <style>{`
        .bills-page input[type="number"]::-webkit-inner-spin-button,
        .bills-page input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        .bills-page input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
      `}</style>

      {/* ── Unified patient / admission card ─────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 mb-4">

        {/* Row 1: breadcrumb + Back to Bills */}
        <div className="flex items-center justify-between mb-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
            <span>/</span>
            <Link href="/bills" className="hover:text-slate-600">Bills</Link>
            <span>/</span>
            <span className="text-slate-600 font-medium truncate max-w-[180px]">{patName}</span>
          </nav>
          <Link href="/bills"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500
              hover:text-slate-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Bills
          </Link>
        </div>

        {/* Row 2: Admission selector pills */}
        {admissions.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {admissions.length > 1 && (
                <button
                  onClick={() => setSelectedAdmId(null)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                    border transition-colors whitespace-nowrap
                    ${selectedAdmId === null
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
                >
                  All admissions
                </button>
              )}
              {admissions.map((a) => {
                const isActive = a.status !== "DISCHARGED";
                const selected = selectedAdmId === a.id;
                return (
                  <button key={a.id} onClick={() => setSelectedAdmId(a.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                      border transition-colors whitespace-nowrap
                      ${selected
                        ? isActive
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    {admLabel(a)}
                  </button>
                );
              })}
            </div>

            {/* Admission detail strip (no Dept) */}
            {selectedAdm && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                <span>
                  <span className="text-slate-400">Ward/Bed:</span>{" "}
                  <span className="font-medium text-slate-700">
                    {selectedAdm.wardName || "—"}{selectedAdm.bedNumber ? ` · ${selectedAdm.bedNumber}` : ""}
                  </span>
                </span>
                <span>
                  <span className="text-slate-400">Doctor:</span>{" "}
                  <span className="font-medium text-slate-700">{selectedAdm.admittingDoctorName || "—"}</span>
                </span>
                <span>
                  <span className="text-slate-400">Payment:</span>{" "}
                  <span className={`font-semibold ${selectedAdm.isInsurance ? "text-indigo-600" : "text-emerald-600"}`}>
                    {selectedAdm.isInsurance ? selectedAdm.insuranceCompany || "Insurance" : "Cash"}
                  </span>
                </span>
                <span>
                  <span className="text-slate-400">Status:</span>{" "}
                  <span className={`font-semibold ${selectedAdm.status === "DISCHARGED" ? "text-slate-500" : "text-emerald-600"}`}>
                    {selectedAdm.status === "DISCHARGED"
                      ? `Discharged ${fmt(selectedAdm.dischargeDate)}`
                      : "Active"}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: divider */}
        <div className="border-t border-slate-100 mb-3" />

        {/* Row 4: patient name + bill summary + actions */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {/* Patient identity */}
          <div>
            <p className="text-lg font-bold text-slate-800">{patName}</p>
            <p className="font-mono text-xs text-slate-500">{uhid}</p>
          </div>

          {/* Payment Type */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Payment Type</p>
            {summaryIsIns ? (
              <span className="inline-flex items-center text-xs font-semibold
                text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                {summaryInsurer || "Insurance"}
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-semibold
                text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Cash
              </span>
            )}
          </div>

          {/* Insurance Status */}
          {summaryIsIns && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Insurance Status</p>
              {summaryClaimStatus ? (
                <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full
                  ${summaryClaimStatus === "SETTLED"           ? "bg-emerald-100 text-emerald-700"
                  : summaryClaimStatus === "CLAIMED"           ? "bg-purple-100 text-purple-700"
                  : summaryClaimStatus === "APPROVED"          ? "bg-sky-100 text-sky-700"
                  : summaryClaimStatus === "DECLINED"          ? "bg-red-100 text-red-700"
                  : summaryClaimStatus === "SENT_FOR_APPROVAL" ? "bg-amber-100 text-amber-700"
                  :                                              "bg-slate-100 text-slate-600"}`}>
                  {summaryClaimStatus.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold
                  text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Insurance Details Incomplete
                </span>
              )}
            </div>
          )}

          {/* Totals + actions pushed right */}
          <div className="ml-auto flex items-center gap-5 flex-wrap justify-end">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total</p>
              <p className="font-bold text-slate-900">{inr(summaryTotalAmt)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Balance</p>
              {summaryDue > 0
                ? <p className="font-bold text-amber-700">{inr(summaryDue)}</p>
                : <p className="font-bold text-emerald-600">Nil</p>}
            </div>
            {canCraft && patient && (
              <button onClick={openCollect}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
                  bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Collect Cash
              </button>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
              text-slate-700 text-sm font-medium cursor-pointer select-none hover:border-sky-300"
              title="Hide the printed header and leave 5.5 cm blank at the top for pre-printed letterhead paper">
              <input type="checkbox" className="accent-sky-600"
                checked={letterheadMode}
                onChange={(e) => toggleLetterhead(e.target.checked)} />
              Print on letterhead
            </label>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold
              whitespace-nowrap border-b-2 transition-colors -mb-px
              ${
                tab === t.id
                  ? "border-sky-500 text-sky-700 bg-sky-50/60"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}

      {/* Main Bill — BillWorkspace handles all the billing logic */}
      {tab === "main-bill" && (
        <Suspense fallback={null}>
          <BillWorkspace scopePatientId={patientId} showCraft={false} letterheadMode={letterheadMode} onLetterheadChange={toggleLetterhead} onDataChange={() => setRefreshKey((k) => k + 1)} refreshSignal={refreshKey} />
        </Suspense>
      )}

      {/* Receipts */}
      {tab === "receipts" && (
        <ReceiptsTab
          patientId={patientId}
          admissionId={selectedAdmId}
          refreshKey={refreshKey}
        />
      )}

      {/* Lab Orders */}
      {tab === "lab-orders" && (
        <LabOrdersTab
          patientId={patientId}
          admission={selectedAdm}
          refreshKey={refreshKey}
        />
      )}

      {/* ── Collect Cash modal ─────────────────────────────────────────────── */}
      <CollectCashModal
        open={collectPatient !== null}
        patient={collectPatient}
        onClose={() => setCollectPatient(null)}
        onSaved={() => {
          setCollectPatient(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default function PatientBillsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const pid = Number(patientId);
  return (
    <Suspense fallback={null}>
      <PatientBillsPageInner patientId={pid} />
    </Suspense>
  );
}
