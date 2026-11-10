"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { getSession } from "../../_lib/auth";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend types ────────────────────────────────────────────────────────────
type ExpenseStatusB  = "PENDING" | "APPROVED" | "PAID" | "REJECTED";
type ExpenseStatusF  = "Pending" | "Approved" | "Paid" | "Rejected";
type PaymentModeB    = "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE";
type PaymentModeF    = "Cash" | "Bank Transfer" | "UPI" | "Cheque";

interface ExpenseResponse {
  id: number;
  expenseNo: string;
  date: string;          // "YYYY-MM-DD"
  category: string;
  towards: string;
  amount: number;
  paymentMode: PaymentModeB;
  referenceNo: string | null;
  description: string;
  preparedBy: string;
  approvedBy: string | null;
  status: ExpenseStatusB;
  rejectionReason: string | null;
  createdAt: string;
}

interface Expense {
  _id: number;
  id: string;
  expenseNo: string;
  date: string;
  category: string;
  towards: string;
  amount: number;
  paymentMode: PaymentModeF;
  referenceNo: string;
  description: string;
  preparedBy: string;
  approvedBy: string;
  status: ExpenseStatusF;
  rejectionReason: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────
const STATUS_FWD: Record<ExpenseStatusB, ExpenseStatusF> = {
  PENDING: "Pending", APPROVED: "Approved", PAID: "Paid", REJECTED: "Rejected",
};
const STATUS_REV: Record<ExpenseStatusF, ExpenseStatusB> = {
  Pending: "PENDING", Approved: "APPROVED", Paid: "PAID", Rejected: "REJECTED",
};
const MODE_FWD: Record<PaymentModeB, PaymentModeF> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", UPI: "UPI", CHEQUE: "Cheque",
};
const MODE_REV: Record<PaymentModeF, PaymentModeB> = {
  Cash: "CASH", "Bank Transfer": "BANK_TRANSFER", UPI: "UPI", Cheque: "CHEQUE",
};

function toFrontend(e: ExpenseResponse): Expense {
  return {
    _id:             e.id,
    id:              String(e.id),
    expenseNo:       e.expenseNo,
    date:            e.date,
    category:        e.category,
    towards:         e.towards,
    amount:          Number(e.amount),
    paymentMode:     MODE_FWD[e.paymentMode] ?? "Cash",
    referenceNo:     e.referenceNo ?? "",
    description:     e.description,
    preparedBy:      e.preparedBy,
    approvedBy:      e.approvedBy ?? "",
    status:          STATUS_FWD[e.status] ?? "Pending",
    rejectionReason: e.rejectionReason ?? "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_MODES: PaymentModeF[] = ["Cash", "Bank Transfer", "UPI", "Cheque"];
const ALL_STATUSES: ExpenseStatusF[] = ["Pending", "Approved", "Paid", "Rejected"];

const STATUS_COLORS: Record<ExpenseStatusF, "yellow" | "green" | "sky" | "red"> = {
  Pending: "yellow", Approved: "green", Paid: "sky", Rejected: "red",
};

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function roleType(r: string): "admin" | "receptionist" | "other" {
  if (r === "Admin" || r === "Managing Director") return "admin";
  // All non-admin roles (Receptionist, Lab/Ins/Reception, Doctor, etc.) submit
  // expense requests that require Admin/MD approval.
  return "other";
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const userName = session?.name ?? "System";
  const rType    = roleType(role);

  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [categories,   setCategories]   = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchErr,     setFetchErr]     = useState("");

  // filters
  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Expense | null>(null);
  const [form,      setForm]      = useState(emptyForm(userName));
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  // reject modal
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectErr,    setRejectErr]    = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  // delete modal
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true); setFetchErr("");
    const qs = new URLSearchParams({ page: "0", size: "500", sort: "date,desc" });
    if (search) qs.set("search", search);
    if (catFilter) qs.set("category", catFilter);
    if (statusFilter) qs.set("status", STATUS_REV[statusFilter as ExpenseStatusF]);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo)   qs.set("dateTo",   dateTo);

    const { ok, data, error } = await apiFetch(`/api/expenses?${qs}`);
    if (!ok) { setFetchErr(error); setLoading(false); return; }
    const raw: ExpenseResponse[] = data?.content ?? data ?? [];
    setExpenses(raw.map(toFrontend));
    setLoading(false);
  }, [search, catFilter, statusFilter, dateFrom, dateTo, setLoading, setFetchErr, setExpenses]);

  // ── Load expense categories from masters ──
  useEffect(() => {
    apiFetch("/api/masters/expense-categories?page=0&size=200").then(({ ok, data }) => {
      if (!ok) return;
      const raw = data?.content ?? data ?? [];
      setCategories(raw.filter((c: { status: string }) => c.status === "ACTIVE").map((c: { name: string }) => c.name));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered (client-side for non-admin: own entries only) ──
  const base = useMemo(() =>
    rType === "other" ? expenses.filter(e => e.preparedBy === userName) : expenses,
    [expenses, rType, userName]);

  const filtered = base; // filtering is done server-side via query params

  // ── Summary ──
  const totalAmt   = filtered.reduce((s, e) => s + e.amount, 0);
  const pendingCt  = filtered.filter(e => e.status === "Pending").length;
  const rejectedCt = filtered.filter(e => e.status === "Rejected").length;

  const sCounts = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(e => { m[e.status] = (m[e.status] ?? 0) + 1; });
    return m;
  }, [filtered]);

  // ── Handlers ──
  function openAdd() {
    setForm(emptyForm(userName)); setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setForm({
      date: e.date, category: e.category, towards: e.towards,
      amount: e.amount, paymentMode: e.paymentMode,
      referenceNo: e.referenceNo, description: e.description,
      preparedBy: e.preparedBy,
    });
    setErrors({}); setApiError(""); setEditing(e); setModalOpen(true);
  }

  function validate(): boolean {
    const er: Record<string, string> = {};
    if (!form.date)                  er.date        = "Date is required";
    if (!form.category)              er.category    = "Category is required";
    if (!form.towards.trim())        er.towards     = "Towards is required";
    if (!form.amount || form.amount <= 0) er.amount = "Enter a valid amount";
    if (!form.description.trim())    er.description = "Description is required";
    setErrors(er);
    return Object.keys(er).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      date:              form.date,
      category:          form.category,
      towards:           form.towards,
      amount:            form.amount,
      paymentMode:       MODE_REV[form.paymentMode],
      referenceNo:       form.referenceNo || undefined,
      description:       form.description,
      preparedBy:        form.preparedBy || userName,
      submittedByRole:   role,   // backend uses this to auto-approve Admin/MD
    };
    const { ok, error } = editing
      ? await apiFetch(`/api/expenses/${editing._id}`, { method: "PUT", body: JSON.stringify(body) })
      : await apiFetch("/api/expenses", { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (!ok) { setApiError(error); return; }
    setModalOpen(false);
    load();
  }

  async function handleApprove(e: Expense) {
    await apiFetch(`/api/expenses/${e._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED", approvedBy: userName }),
    });
    load();
  }

  async function handleMarkPaid(e: Expense) {
    await apiFetch(`/api/expenses/${e._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "PAID", approvedBy: userName }),
    });
    load();
  }

  function openReject(e: Expense) {
    setRejectTarget(e); setRejectReason(""); setRejectErr("");
  }

  async function handleReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { setRejectErr("Reason is required"); return; }
    setRejectSaving(true);
    await apiFetch(`/api/expenses/${rejectTarget._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "REJECTED", approvedBy: userName, rejectionReason: rejectReason }),
    });
    setRejectSaving(false);
    setRejectTarget(null);
    load();
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await apiFetch(`/api/expenses/${deleteConfirm._id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteConfirm(null);
    load();
  }

  function clearFilters() {
    setSearch(""); setCatFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo("");
  }

  const anyFilter = !!(search || catFilter || statusFilter || dateFrom || dateTo);

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={load} />}
      <PageHeader
        title="Expense List"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Expenses" }]}
        action={{ label: rType !== "other" ? "Add Expense" : "Add Expense Request", onClick: openAdd }}
      />

      {rType === "other" && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200
          text-amber-800 text-xs font-medium px-4 py-3 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p className="font-semibold">Expenses require Admin approval</p>
            <p className="mt-0.5 font-normal text-amber-700">
              Your expense requests will be saved as <strong>Pending</strong> and must be approved by an Admin before processing.
              You can track the status below.
            </p>
          </div>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Expenses" value={String(filtered.length)} color="text-slate-900" />
        <StatCard label="Total Amount"   value={inr(totalAmt)}           color="text-indigo-600" />
        <StatCard label="Pending"        value={String(pendingCt)}        color="text-amber-600" />
        <StatCard label="Rejected"       value={String(rejectedCt)}       color="text-red-500" />
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search expense no, towards, description…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        <div className="relative">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s} ({sCounts[s] ?? 0})</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"/>
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

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["S.No","Expense No","Date","Category","Towards","Amount",
                  "Payment Mode","Ref No","Description","Prepared By","Approved By","Status","Actions"
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13}
                    className="px-4 py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
                      </svg>
                      No expenses found
                    </div>
                  </td>
                </tr>
              ) : filtered.map((e, idx) => (
                <tr key={e.id} className={`hover:bg-slate-50 transition-colors ${e.status === "Rejected" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 text-slate-400 text-xs w-10">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      {e.expenseNo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{e.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={e.category} variant="gray" />
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-sm font-medium">{e.towards}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{inr(e.amount)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">
                    <span className="inline-flex items-center gap-1">
                      {e.paymentMode === "Cash" && "💵"}
                      {e.paymentMode === "Bank Transfer" && "🏦"}
                      {e.paymentMode === "UPI" && "📱"}
                      {e.paymentMode === "Cheque" && "🧾"}
                      {e.paymentMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {e.referenceNo ? <span className="font-mono">{e.referenceNo}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs text-slate-600 truncate" title={e.description}>{e.description}</p>
                    {e.status === "Rejected" && e.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5 truncate" title={e.rejectionReason}>
                        ✕ {e.rejectionReason}
                      </p>
                    )}
                    {rType === "other" && e.status === "Pending" && (
                      <p className="text-xs text-amber-600 mt-0.5 font-medium">⏳ Awaiting Admin approval</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{e.preparedBy}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {e.approvedBy || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={e.status} variant={STATUS_COLORS[e.status]} dot />
                  </td>

                  {/* Actions column — admin: full controls; others: can delete own pending/rejected */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {rType === "admin" && e.status === "Pending" && (
                        <>
                          <button onClick={() => handleApprove(e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                              text-xs font-semibold bg-emerald-50 text-emerald-700
                              hover:bg-emerald-100 transition-colors whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                            Approve
                          </button>
                          <button onClick={() => openReject(e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                              text-xs font-semibold bg-red-50 text-red-600
                              hover:bg-red-100 transition-colors whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                            Reject
                          </button>
                        </>
                      )}
                      {rType === "admin" && e.status === "Approved" && (
                        <button onClick={() => handleMarkPaid(e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                            text-xs font-semibold bg-sky-50 text-sky-700
                            hover:bg-sky-100 transition-colors whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                          </svg>
                          Mark Paid
                        </button>
                      )}
                      {rType === "admin" && e.status !== "Paid" && (
                        <button onClick={() => openEdit(e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      )}
                      {/* Both admin and submitting user can delete Pending/Rejected */}
                      {(e.status === "Pending" || e.status === "Rejected") &&
                        (rType === "admin" || e.preparedBy === userName) && (
                        <button onClick={() => setDeleteConfirm(e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      )}
                      {/* Non-admin: can edit their own pending request */}
                      {rType === "other" && e.status === "Pending" && e.preparedBy === userName && (
                        <button onClick={() => openEdit(e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit request">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>{filtered.length} of {expenses.length} expenses</span>
          <span className="font-semibold text-slate-600">Total: {inr(totalAmt)}</span>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Expense — ${editing.expenseNo}` : "Add Expense"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Expense"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>}

          {!editing && (
            <div className="flex flex-wrap gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <AField label="Expense No"  value="Auto-generated" />
              <AField label="Prepared By" value={userName} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Expense Date" required error={errors.date}>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </FormField>
            <FormField label="Category" required error={errors.category}>
              <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Towards (Staff / Dept / Vendor)" required error={errors.towards}>
              <Input value={form.towards} onChange={e => setForm({ ...form, towards: e.target.value })}
                placeholder="e.g. MediSupply Co., TNEB, Priya Menon" />
            </FormField>
            <FormField label="Amount (₹)" required error={errors.amount}>
              <Input type="number" min={1} value={form.amount || ""}
                onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Payment Mode">
              <Select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value as PaymentModeF, referenceNo: "" })}>
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </Select>
            </FormField>
            {form.paymentMode !== "Cash" && (
              <FormField label="Cheque No / UTR No">
                <Input value={form.referenceNo}
                  onChange={e => setForm({ ...form, referenceNo: e.target.value })}
                  placeholder={form.paymentMode === "Cheque" ? "CHQ012345" : "UTR / Txn Ref"} />
              </FormField>
            )}
          </div>

          <FormField label="Description / Notes" required error={errors.description}>
            <Textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What was purchased or reason for expense…" rows={3} />
          </FormField>
        </div>
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)}
        title={`Reject Expense — ${rejectTarget?.expenseNo ?? ""}`} size="sm"
        footer={
          <>
            <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleReject} disabled={rejectSaving}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-lg flex items-center gap-2">
              {rejectSaving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              Reject
            </button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Provide a reason for rejecting <span className="font-semibold">{rejectTarget?.expenseNo}</span>.
          </p>
          <FormField label="Rejection Reason" required error={rejectErr}>
            <Textarea value={rejectReason}
              onChange={e => { setRejectReason(e.target.value); setRejectErr(""); }}
              placeholder="e.g. Budget not allocated, duplicate entry…" rows={3} autoFocus/>
          </FormField>
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Expense" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-lg">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold">{deleteConfirm?.expenseNo}</span>?
          </p>
          <p className="text-xs text-red-500 font-medium">⚠ This action cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyForm(preparedBy: string) {
  return {
    date:        new Date().toISOString().slice(0, 10),
    category:    "",
    towards:     "",
    amount:      0,
    paymentMode: "Cash" as PaymentModeF,
    referenceNo: "",
    description: "",
    preparedBy,
  };
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function AField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}:</span>
      <span className="text-xs text-slate-700 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded">{value}</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-16">
            <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-3 bg-slate-200 rounded w-28" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
            <div className="h-3 bg-slate-200 rounded w-24" />
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
