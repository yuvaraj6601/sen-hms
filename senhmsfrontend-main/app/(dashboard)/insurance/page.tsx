"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getSession } from "../../_lib/auth";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import HScrollArea from "../../_components/HScrollArea";
import CreatableSearchSelect from "../../_components/CreatableSearchSelect";
import { buildCreditBillHtml } from "../../_lib/print-credit-bill";

// ─── local types ─────────────────────────────────────────────────────────────
interface BillItemDetail {
  id: number; serviceCode: string | null; modalityName: string | null;
  description: string; quantity: number; unitPrice: number; discount: number; total: number;
}

interface BillDetails {
  id: number; billNo: string; date: string;
  patientName: string; uhid: string; patientType: string;
  age: number | null; gender: string | null; phone: string | null;
  doctorName: string | null; department: string | null;
  ward: string | null; bedNumber: string | null; admittedDate: string | null;
  towards: string | null;
  items: BillItemDetail[];
  subtotal: number; totalDiscount: number; totalAmount: number;
  paidAmount: number; dueAmount: number;
  insurancePaidAmount: number | null;
  createdBy: string | null;
}

interface InsuranceClaimResponse {
  id: number; claimNo: string;
  billId: number | null; billNo: string | null;
  patientId: number; patientName: string; uhid: string; patientType: string | null;
  admissionId: number | null; admissionNo: string | null;
  admissionDate: string | null; dischargeDate: string | null;
  diagnosis: string | null;
  insuranceCompany: string; insuranceCompanyId: number | null;
  policyNo: string | null; tpaName: string | null; preAuthNumber: string | null;
  billAmount: number | null; claimedAmount: number;
  approvedAmount: number | null; settledAmount: number | null;
  authorizedAmount: number | null; coPayAmount: number | null;
  rejectionReason: string | null;
  status: string; // SCREAMING_SNAKE_CASE
  submittedDate: string; settledDate: string | null;
  remarks: string | null;
  createdBy: string; createdAt: string; updatedAt: string;
  billDetails?: BillDetails | null;
}

interface InsuranceCompanyOption { id: number; name: string; tpaName: string; tpaNames?: string[] | null; status: string; }

interface BillOption {
  id: number; billNo: string; patientId: number; patientName: string; uhid: string;
  patientType: string; totalAmount: number; dueAmount: number; status: string;
  insuranceCompany: string | null; insuranceCompanyId: number | null;
  policyNo: string | null; admittedDate: string | null;
}

interface ClaimForm {
  billId: number | null; billNo: string;
  patientId: number | null; patientName: string; uhid: string; patientType: string;
  insuranceCompany: string; insuranceCompanyId: number | null;
  policyNo: string; tpaName: string; preAuthNumber: string;
  admissionDate: string; dischargeDate: string;
  diagnosis: string;
  claimedAmount: number;
  approvedAmount: number | null;
  settledAmount: number | null;
  authorizedAmount: number | null;
  coPayAmount: number | null;
  submittedDate: string;
  status: string; // SCREAMING_SNAKE_CASE
  remarks: string;
  rejectionReason: string;
  settledDate: string;
}

// ─── constants ───────────────────────────────────────────────────────────────
// 5-stage insurance workflow (claim = single source of truth; admission mirrors it).
const STATUS_DISPLAY: Record<string, string> = {
  DETAILS_INCOMPLETE: "Insurance Details Incomplete",
  SENT_FOR_APPROVAL:  "Insurance Sent for Approval",
  APPROVED:           "Insurance Approved",
  CLAIMED:            "Insurance Claimed",
  SETTLED:            "Insurance Settled",
  DECLINED:           "Insurance Declined",
};

const STATUS_COLORS: Record<string, "sky" | "yellow" | "green" | "gray" | "red" | "purple"> = {
  DETAILS_INCOMPLETE: "gray",
  SENT_FOR_APPROVAL:  "yellow",
  APPROVED:           "sky",
  CLAIMED:            "purple",
  SETTLED:            "green",
  DECLINED:           "red",
};

const CLAIM_STATUSES = [
  { value: "DETAILS_INCOMPLETE", label: "Insurance Details Incomplete" },
  { value: "SENT_FOR_APPROVAL",  label: "Insurance Sent for Approval"  },
  { value: "APPROVED",           label: "Insurance Approved"           },
  { value: "CLAIMED",            label: "Insurance Claimed"            },
  { value: "SETTLED",            label: "Insurance Settled"            },
  { value: "DECLINED",           label: "Insurance Declined"           },
];

const TABS = ["All", "DETAILS_INCOMPLETE", "SENT_FOR_APPROVAL", "APPROVED", "CLAIMED", "SETTLED", "DECLINED"];

function inr(n: number) { return "\u20B9" + (n || 0).toLocaleString("en-IN"); }
function today() { return new Date().toISOString().slice(0, 10); }

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── (buildCreditBillHtml lives in ../../_lib/print-credit-bill) ──────────────

function emptyForm(): ClaimForm {
  return {
    billId: null, billNo: "",
    patientId: null, patientName: "", uhid: "", patientType: "",
    insuranceCompany: "", insuranceCompanyId: null,
    policyNo: "", tpaName: "", preAuthNumber: "",
    admissionDate: today(), dischargeDate: "",
    diagnosis: "",
    claimedAmount: 0,
    approvedAmount: null,
    settledAmount: null,
    authorizedAmount: null,
    coPayAmount: null,
    submittedDate: today(),
    status: "SENT_FOR_APPROVAL",
    remarks: "",
    rejectionReason: "",
    settledDate: "",
  };
}

// ─── Portal tooltip for rejection reason ─────────────────────────────────────
function RejectionTooltip({ reason, remarks }: { reason: string | null; remarks: string | null }) {
  const [pos, setPos]       = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const show = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: r.right, y: r.bottom + 6 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  const tooltip = pos && mounted ? createPortal(
    <div
      style={{ position: "fixed", top: pos.y, right: window.innerWidth - pos.x, zIndex: 9999 }}
      className="w-52 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-2xl
        pointer-events-none whitespace-normal">
      <div className="absolute bottom-full right-3 border-4 border-transparent border-b-slate-900"/>
      {reason && <p className="font-semibold text-red-300 mb-1">{reason}</p>}
      {remarks && <p className="text-slate-300 leading-snug">{remarks}</p>}
    </div>,
    document.body
  ) : null;

  if (!reason && !remarks) return null;

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="cursor-help text-red-400 text-xs ml-1 select-none"
        title="">ⓘ</span>
      {tooltip}
    </>
  );
}

export default function InsurancePage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const isAdmin  = role === "Admin" || role === "Managing Director";
  const isCoord  = role === "Insurance Coordinator" || role === "Lab/Ins/Reception";
  const canAct   = isAdmin || isCoord;

  const [claims,    setClaims]    = useState<InsuranceClaimResponse[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompanyOption[]>([]);
  const [bills,     setBills]     = useState<BillOption[]>([]);
  // Standalone TPA master list (Masters → Dropdowns → TPA Names). The hospital
  // selects a TPA independently of the insurance company, so this is the
  // authoritative source for the claim form's TPA picker.
  const [tpaMaster, setTpaMaster] = useState<string[]>([]);

  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  // filters
  const [activeTab,    setActiveTab]    = useState("All");
  const [search,       setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [compFilter,   setCompFilter]   = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // add/update modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<InsuranceClaimResponse | null>(null);
  const [form,      setForm]      = useState<ClaimForm>(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saveErr,   setSaveErr]   = useState<string | null>(null);
  // Read-only insured-person / card details pulled from the linked BILL
  // (these are properties of the bill, not the claim — shown for reference in
  // the Update Claim modal). dischargeDate is also sourced here to prefill the
  // claim's discharge date when it was never entered on the claim itself.
  const [billExtras, setBillExtras] = useState<{
    insuredPersonName: string; cardNumber: string; dischargeDate: string;
  } | null>(null);

  // bill picker inside add modal
  const [billSearch,   setBillSearch]   = useState("");
  const [billDropOpen, setBillDropOpen] = useState(false);

  async function loadClaims() {
    const qs = new URLSearchParams({ page: "0", size: "500" });
    if (debouncedSearch) qs.set("search",  debouncedSearch);
    if (compFilter)      qs.set("company", compFilter);
    if (dateFrom)        qs.set("dateFrom", dateFrom);
    if (dateTo)          qs.set("dateTo",   dateTo);
    const r = await apiFetch(`/api/insurance/claims?${qs}`);
    if (r.ok) {
      const items: InsuranceClaimResponse[] = Array.isArray(r.data)
        ? r.data
        : (r.data?.content ?? []);
      // Latest record first — sort by id descending (ids increase with creation).
      const sorted = [...items].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      setClaims(sorted);
    } else {
      throw new Error(r.error);
    }
  }

  async function loadCompanies() {
    const r = await apiFetch("/api/masters/insurance-companies?page=0&size=200&active=true");
    if (r.ok) {
      const items: InsuranceCompanyOption[] = Array.isArray(r.data)
        ? r.data
        : (r.data?.content ?? []);
      setCompanies(items);
    }
  }

  async function loadBills() {
    const r = await apiFetch("/api/bills?page=0&size=500");
    if (r.ok) {
      const items: BillOption[] = Array.isArray(r.data)
        ? r.data
        : (r.data?.content ?? []);
      setBills(items);
    }
  }

  async function loadTpaMaster() {
    const r = await apiFetch("/api/masters/dropdowns?category=TPA&status=ACTIVE&size=1000");
    if (r.ok) {
      const items: Array<{ label: string }> = r.data?.content ?? r.data ?? [];
      setTpaMaster(items.map(o => o.label).filter(Boolean));
    }
  }

  // Persist a newly-typed TPA to the shared Dropdowns master so it becomes
  // permanent and selectable everywhere. Optimistic; a server-side duplicate is
  // harmless thanks to the idempotent flag.
  const addTpaOption = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;
    setTpaMaster(prev =>
      prev.some(t => t.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value].sort((a, b) => a.localeCompare(b)));
    await apiFetch("/api/masters/dropdowns?idempotent=true", {
      method: "POST",
      body: JSON.stringify({ category: "TPA", label: value }),
    });
  }, []);

  async function loadAll() {
    setLoading(true);
    setLoadErr(null);
    try {
      await Promise.all([loadClaims(), loadCompanies(), loadBills(), loadTpaMaster()]);
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Initial load (companies + bills only need to load once)
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Re-fetch claims whenever filters or debounced search change
  useEffect(() => {
    loadClaims().catch(() => {});
  }, [debouncedSearch, compFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── filtered ──
  // Backend now handles search/company/date filters; only tab (status) is client-side.
  const filtered = useMemo(() => {
    return claims.filter(c => {
      const matchTab = activeTab === "All" || c.status === activeTab;
      return matchTab;
    });
  }, [claims, activeTab]);

  // tab counts
  const tabCounts = useMemo(() => {
    const m: Record<string, number> = { All: claims.length };
    claims.forEach(c => { m[c.status] = (m[c.status] ?? 0) + 1; });
    return m;
  }, [claims]);

  // summary
  const totalClaimed  = filtered.reduce((s, c) => s + c.claimedAmount, 0);
  const totalSettled  = filtered.reduce((s, c) => s + (c.settledAmount ?? 0), 0);
  const totalPending  = filtered
    // DECLINED is terminal (insurer pays nothing) → not pending.
    .filter(c => ["SENT_FOR_APPROVAL", "APPROVED", "CLAIMED"].includes(c.status))
    .reduce((s, c) => s + (c.claimedAmount - (c.settledAmount ?? 0)), 0);

  // bill suggestions for picker
  const billSuggestions = useMemo(() => {
    if (billSearch.length < 1) return [];
    const q = billSearch.toLowerCase();
    return bills
      .filter(b => b.status !== "CANCELLED" && b.status !== "Cancelled")
      .filter(b =>
        b.billNo.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        b.uhid.toLowerCase().includes(q) ||
        (b.insuranceCompany ?? "").toLowerCase().includes(q)
      ).slice(0, 8);
  }, [bills, billSearch]);

  // TPA names come from the standalone TPA master (Masters → Dropdowns → TPA
  // Names), merged with any TPAs still configured on company records so legacy
  // values aren't lost. The hospital selects a TPA independently of the company.
  const allTpaNames = useMemo(() => {
    const set = new Set<string>();
    tpaMaster.forEach(t => { if (t) set.add(t); });
    companies.forEach(c => {
      const list = (c.tpaNames && c.tpaNames.length > 0) ? c.tpaNames : (c.tpaName ? [c.tpaName] : []);
      list.forEach(t => { if (t) set.add(t); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tpaMaster, companies]);

  // TPA options for the claim form: the full standalone list, keeping the saved
  // value selectable even if it was later removed from the master.
  const claimTpaOptions = useMemo(() => {
    if (form.tpaName && !allTpaNames.includes(form.tpaName)) return [form.tpaName, ...allTpaNames];
    return allTpaNames;
  }, [allTpaNames, form.tpaName]);

  function selectBill(b: BillOption) {
    // No TPA auto-fill — the coordinator selects the TPA explicitly from the list.
    setForm(f => ({
      ...f,
      billId: b.id, billNo: b.billNo,
      patientId: b.patientId, patientName: b.patientName, uhid: b.uhid,
      patientType: b.patientType,
      insuranceCompany: b.insuranceCompany ?? "",
      insuranceCompanyId: b.insuranceCompanyId ?? null,
      policyNo: b.policyNo ?? "",
      admissionDate: b.admittedDate ?? today(),
      claimedAmount: b.totalAmount,
    }));
    setBillSearch(b.billNo + " — " + b.patientName);
    setBillDropOpen(false);
  }

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setSaveErr(null); setEditing(null);
    setBillSearch(""); setBillDropOpen(false);
    setBillExtras(null);
    setModalOpen(true);
  }

  function openEdit(c: InsuranceClaimResponse) {
    setForm({
      billId: c.billId ?? null,
      billNo: c.billNo ?? "",
      patientId: c.patientId,
      patientName: c.patientName,
      uhid: c.uhid,
      patientType: c.patientType ?? "",
      insuranceCompany: c.insuranceCompany,
      insuranceCompanyId: c.insuranceCompanyId ?? null,
      policyNo: c.policyNo ?? "",
      tpaName: c.tpaName ?? "",
      preAuthNumber: c.preAuthNumber ?? "",
      admissionDate: c.admissionDate ?? "",
      dischargeDate: c.dischargeDate ?? "",
      diagnosis: c.diagnosis ?? "",
      claimedAmount: c.claimedAmount,
      approvedAmount: c.approvedAmount ?? null,
      settledAmount: c.settledAmount ?? null,
      authorizedAmount: c.authorizedAmount ?? null,
      coPayAmount: c.coPayAmount ?? null,
      submittedDate: c.submittedDate,
      status: c.status,
      remarks: c.remarks ?? "",
      rejectionReason: c.rejectionReason ?? "",
      settledDate: c.settledDate ?? "",
    });
    setErrors({}); setSaveErr(null); setEditing(c);
    setBillSearch(c.billNo ? `${c.billNo} — ${c.patientName}` : "");
    setBillExtras(null);
    setModalOpen(true);

    // Option A: insured-person / card are bill properties, not claim fields.
    // Fetch the linked bill to show them read-only, and prefill the claim's
    // discharge date from the bill when the claim itself has none.
    if (c.billId != null) {
      apiFetch(`/api/bills/${c.billId}`).then(({ ok, data }) => {
        if (!ok || !data) return;
        const b = data as {
          insuredPersonName?: string | null; cardNumber?: string | null;
          dischargeDate?: string | null;
        };
        setBillExtras({
          insuredPersonName: b.insuredPersonName ?? "",
          cardNumber:        b.cardNumber ?? "",
          dischargeDate:     b.dischargeDate ?? "",
        });
        // Prefill discharge date from the bill only if the claim has none yet.
        if (!c.dischargeDate && b.dischargeDate) {
          setForm(f => ({ ...f, dischargeDate: b.dischargeDate as string }));
        }
      });
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.patientName) e.patient          = "Select a bill / patient";
    if (!form.insuranceCompany) e.company     = "Insurance company required";
    // diagnosis required only when creating — on update it's already recorded
    if (!editing && !form.diagnosis.trim()) e.diagnosis = "Diagnosis required";
    if (!form.claimedAmount)    e.claimAmount = "Claim amount required";
    // Approved amount is required once the insurer has APPROVED (and beyond:
    // CLAIMED / SETTLED). It is NOT required for DECLINED — a declined claim
    // pays nothing, so the approved amount is cleared to 0 server-side.
    // Settled amount is required only at SETTLED.
    const needsApproved = editing &&
      (form.status === "APPROVED" || form.status === "CLAIMED" || form.status === "SETTLED");
    if (needsApproved && (!form.approvedAmount || form.approvedAmount <= 0))
      e.approvedAmount = "Approved amount required";
    if (editing && form.status === "SETTLED" && (!form.settledAmount || form.settledAmount <= 0))
      e.settledAmount  = "Settled / paid amount required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveErr(null);
    try {
      let result;
      if (!editing) {
        result = await apiFetch("/api/insurance/claims", {
          method: "POST",
          body: JSON.stringify({
            billId: form.billId,
            billNo: form.billNo,
            patientId: form.patientId,
            patientName: form.patientName,
            uhid: form.uhid,
            patientType: form.patientType || "OP",
            admissionDate: form.admissionDate || null,
            dischargeDate: form.dischargeDate || null,
            diagnosis: form.diagnosis,
            insuranceCompany: form.insuranceCompany,
            insuranceCompanyId: form.insuranceCompanyId ?? null,
            policyNo: form.policyNo || null,
            tpaName: form.tpaName || null,
            preAuthNumber: form.preAuthNumber || null,
            billAmount: form.claimedAmount,
            claimedAmount: form.claimedAmount,
            submittedDate: form.submittedDate,
            remarks: form.remarks || null,
          }),
        });
      } else {
        result = await apiFetch(`/api/insurance/claims/${editing.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: form.status,
            approvedAmount: form.approvedAmount ?? undefined,
            settledAmount: form.settledAmount ?? undefined,
            authorizedAmount: form.authorizedAmount ?? undefined,
            coPayAmount: form.coPayAmount ?? undefined,
            settledDate: form.settledDate || null,
            rejectionReason: form.rejectionReason || null,
            remarks: form.remarks || null,
          }),
        });
      }
      if (!result.ok) {
        setSaveErr(result.error);
        return;
      }

      // ── Settled = claim status ONLY. Do NOT auto-close or auto-pay the bill. ──
      // The insurer's money arrives later (cheque / bank, ~45 days). Recording it
      // as income is a SEPARATE, explicitly-dated action on the bill (a receipt
      // dated the settlement day), so the insurance income lands in the correct
      // period. Marking the claim SETTLED must not touch the bill's paid/due or
      // force it to PAID — the coordinator settles the bill manually once the
      // money is actually received. (Admission insuranceStatus mirrors the claim
      // via the backend sync; no bill payment is created here.)

      await loadClaims();
      setModalOpen(false);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save claim");
    } finally {
      setSaving(false);
    }
  }

  // ── letterhead print mode ──
  // Shared with Bills via localStorage so the toggle is consistent across pages.
  const [letterheadMode, setLetterheadMode] = useState(false);
  useEffect(() => {
    try {
      setLetterheadMode(localStorage.getItem("billLetterheadMode") === "1");
    } catch { /* ignore */ }
  }, []);
  function toggleLetterhead(on: boolean) {
    setLetterheadMode(on);
    try { localStorage.setItem("billLetterheadMode", on ? "1" : "0"); } catch { /* ignore */ }
  }

  // ── view modal ──────────────────────────────────────────────────────────────
  const [viewClaim, setViewClaim] = useState<InsuranceClaimResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  async function openView(c: InsuranceClaimResponse) {
    setViewClaim(c);          // show modal immediately with what we have
    setViewLoading(true);
    try {
      const r = await apiFetch(`/api/insurance/claims/${c.id}`);
      if (r.ok) setViewClaim(r.data as InsuranceClaimResponse);
    } finally {
      setViewLoading(false);
    }
  }

  async function handlePrintClaim(c: InsuranceClaimResponse) {
    // Always fetch the full claim so billDetails (items, ward, bed, etc.) is populated
    let full = c;
    if (!c.billDetails) {
      const r = await apiFetch(`/api/insurance/claims/${c.id}`);
      if (r.ok && r.data) full = r.data as InsuranceClaimResponse;
    }
    const html = buildCreditBillHtml(full, window.location.origin, { letterheadMode });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank", "width=900,height=750");
    if (!win) { URL.revokeObjectURL(url); alert("Allow pop-ups to view the bill."); return; }
    win.addEventListener("load", () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  function clearFilters() {
    setSearch(""); setCompFilter(""); setDateFrom(""); setDateTo("");
  }
  const anyFilter = !!(search || compFilter || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Insurance Claims"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Insurance" }]}
        action={canAct ? { label: "New Claim", onClick: openAdd } : undefined}
      />

      {/* letterhead print toggle */}
      <div className="flex justify-end mb-4">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
          bg-white text-slate-700 text-sm font-medium cursor-pointer select-none hover:border-sky-300"
          title="Hide the printed header and leave 5.5 cm blank at the top for pre-printed letterhead paper">
          <input type="checkbox" className="accent-sky-600"
            checked={letterheadMode}
            onChange={e => toggleLetterhead(e.target.checked)} />
          Print on letterhead
        </label>
      </div>

      {/* error banner */}
      {loadErr && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50
          border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="flex-1">{loadErr}</span>
          <button onClick={loadAll}
            className="text-xs font-semibold underline underline-offset-2 hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SC label="Total Claims"    value={String(filtered.length)} color="text-slate-900"/>
        <SC label="Total Claimed"   value={inr(totalClaimed)}       color="text-indigo-600"/>
        <SC label="Total Settled"   value={inr(totalSettled)}       color="text-emerald-600"/>
        <SC label="Pending Amount"  value={inr(totalPending)}       color="text-amber-600"/>
      </div>

      {/* status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => {
          const active = activeTab === t;
          return (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-medium whitespace-nowrap transition-colors border
                ${active
                  ? "bg-sky-500 text-white border-sky-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
              {STATUS_DISPLAY[t] ?? t}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {tabCounts[t] ?? 0}
              </span>
            </button>
          );
        })}
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
            placeholder="Search claim no, patient, UHID, bill no…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        {/* company dropdown */}
        <div className="relative">
          <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
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
        <p className="text-xs text-slate-400 self-center">{filtered.length} claims</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <HScrollArea>
          <table className="min-w-full w-max text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Claim No","Bill No","Patient","UHID","Insurance Co.","TPA","Policy No",
                  "Admission","Claimed","Approved","Settled","Submitted","Status",
                  "Actions"
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={14}
                  className="px-4 py-14 text-center text-slate-400">
                  Loading claims…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={14}
                  className="px-4 py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955
                          0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                          5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    No claims found
                  </div>
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700
                      bg-sky-50 px-2 py-0.5 rounded">{c.claimNo}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {c.billNo ?? "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="font-medium text-slate-800 truncate" title={c.patientName}>{c.patientName}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.uhid}</td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs font-semibold text-indigo-700 truncate" title={c.insuranceCompany}>
                      {c.insuranceCompany}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{c.tpaName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.policyNo}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{c.admissionDate}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {inr(c.claimedAmount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.approvedAmount != null
                      ? <span className="text-purple-700 font-semibold">{inr(c.approvedAmount)}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.settledAmount != null
                      ? <span className="text-emerald-700 font-semibold">{inr(c.settledAmount)}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{c.submittedDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Badge label={STATUS_DISPLAY[c.status] ?? c.status} variant={STATUS_COLORS[c.status] ?? "gray"} dot/>
                      {c.status === "DECLINED" && (
                        <RejectionTooltip reason={c.rejectionReason} remarks={c.remarks}/>
                      )}
                    </div>
                    {c.preAuthNumber && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{c.preAuthNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {/* View — all roles */}
                      <button onClick={() => openView(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                          text-xs font-semibold bg-sky-50 text-sky-700
                          hover:bg-sky-100 transition-colors whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
                              -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        View
                      </button>
                      {/* Print — all roles */}
                      <button onClick={() => handlePrintClaim(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                          text-xs font-semibold bg-slate-50 text-slate-600
                          hover:bg-slate-100 transition-colors whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2
                              m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5
                              a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                        </svg>
                        Print
                      </button>
                      {/* Update — canAct, not settled/rejected */}
                      {canAct && c.status !== "SETTLED" && c.status !== "REJECTED" && (
                        <button onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                            text-xs font-semibold bg-amber-50 text-amber-700
                            hover:bg-amber-100 transition-colors whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                                m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                          Update
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HScrollArea>
        <div className="px-4 py-2 border-t border-slate-100 flex justify-between
          text-xs text-slate-400">
          <span>{filtered.length} of {claims.length} claims</span>
          <span className="font-semibold text-slate-600">
            Claimed: {inr(totalClaimed)} · Settled: {inr(totalSettled)}
          </span>
        </div>
      </div>


      {/* ── Add / Update Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Update Claim — ${editing.claimNo}` : "New Insurance Claim"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600
                text-white font-medium rounded-lg disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? "Saving…" : editing ? "Update Claim" : "Submit Claim"}
            </button>
          </>
        }>
        <div className="space-y-5">

          {/* save error */}
          {saveErr && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50
              border border-red-200 text-red-700 text-xs">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {saveErr}
            </div>
          )}

          {/* ─ Step 1: Link Bill ─ */}
          {!editing && (
            <>
              <SH>Step 1 — Link Bill</SH>
              <FormField label="Search Insurance Bill" required error={errors.patient}>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                    text-slate-400 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                  </svg>
                  <input value={billSearch}
                    onChange={e => { setBillSearch(e.target.value); setBillDropOpen(true); }}
                    onFocus={() => setBillDropOpen(true)}
                    placeholder="Type bill no, patient name or UHID…"
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200
                      bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                </div>
                {billDropOpen && billSuggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200
                    rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
                    {billSuggestions.map(b => (
                      <li key={b.id}>
                        <button type="button" onMouseDown={() => selectBill(b)}
                          className="w-full flex items-start gap-3 px-4 py-2.5
                            hover:bg-indigo-50 text-left transition-colors">
                          <span className="font-mono text-xs font-bold text-sky-600
                            bg-sky-50 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">
                            {b.billNo}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800">{b.patientName}</p>
                            <p className="text-xs text-slate-400">
                              {b.uhid} · {b.insuranceCompany} · {b.policyNo}
                            </p>
                            <p className="text-xs text-slate-400">
                              Total: {inr(b.totalAmount)} · Due: {inr(b.dueAmount)}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5
                            ${b.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {b.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </FormField>

              {/* selected bill card */}
              {form.patientName && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3
                  grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <IP label="Patient"    value={form.patientName} />
                  <IP label="UHID"       value={form.uhid} />
                  <IP label="Bill No"    value={form.billNo ?? "—"} />
                  <IP label="Policy No"  value={form.policyNo} />
                </div>
              )}
            </>
          )}

          {/* ─ Step 2: Claim Details ─ */}
          <SH>{editing ? "Claim Details" : "Step 2 — Claim Details"}</SH>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Insurance Company" required error={errors.company}>
              <Select value={form.insuranceCompany}
                onChange={e => {
                  const comp = companies.find(c => c.name === e.target.value);
                  // No TPA auto-fill — TPA is chosen explicitly from the dropdown.
                  setForm(f => ({
                    ...f,
                    insuranceCompany: e.target.value,
                    insuranceCompanyId: comp?.id ?? null,
                  }));
                }}>
                <option value="">Select company…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="TPA Name">
              <CreatableSearchSelect
                value={form.tpaName ?? ""}
                options={claimTpaOptions.map(t => ({ value: t, label: t }))}
                onChange={v => setForm(f => ({ ...f, tpaName: v }))}
                onAdd={v => { addTpaOption(v); setForm(f => ({ ...f, tpaName: v })); }}
                placeholder="Select TPA…"
                searchPlaceholder="Search or type new TPA…"
                addLabel={q => `+ Add "${q}" as new TPA`}
                allowClear
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Policy No">
              <Input value={form.policyNo}
                onChange={e => setForm(f => ({ ...f, policyNo: e.target.value }))}
                placeholder="Policy / member ID"/>
            </FormField>
            <FormField label="Submitted Date">
              <Input type="date" value={form.submittedDate}
                onChange={e => setForm(f => ({ ...f, submittedDate: e.target.value }))}/>
            </FormField>
          </div>

          {/* Insured Person & Card No — read-only, sourced from the linked bill
              (Option A: these are bill properties, edited on the bill, shown
              here for reference). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Insured Person Name">
              <Input value={billExtras?.insuredPersonName ?? ""} readOnly disabled
                placeholder="— from bill —"/>
            </FormField>
            <FormField label="Card No">
              <Input value={billExtras?.cardNumber ?? ""} readOnly disabled
                placeholder="— from bill —"/>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Admission Date">
              <Input type="date" value={form.admissionDate}
                onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))}/>
            </FormField>
            <FormField label="Discharge Date">
              <Input type="date" value={form.dischargeDate ?? ""}
                onChange={e => setForm(f => ({ ...f, dischargeDate: e.target.value }))}/>
            </FormField>
          </div>

          <FormField label="Diagnosis / Reason" required={!editing} error={errors.diagnosis}>
            <Textarea value={form.diagnosis}
              onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
              placeholder="e.g. Acute Myocardial Infarction, Fracture — Left Femur"
              rows={2}/>
          </FormField>

          {/* ─ Step 3: Amounts & Status ─ */}
          <SH>{editing ? "Status & Settlement" : "Step 3 — Amounts & Status"}</SH>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Claim Amount (₹)" required error={errors.claimAmount}>
              <Input type="number" min={0} value={form.claimedAmount || ""}
                onChange={e => setForm(f => ({ ...f, claimedAmount: Number(e.target.value) }))}/>
            </FormField>
            <FormField label="Authorized Amount (₹)" error={errors.authorizedAmount}>
              <Input type="number" min={0} value={form.authorizedAmount ?? ""}
                onChange={e => {
                  const authorized = e.target.value === "" ? null : Number(e.target.value);
                  setForm(f => ({
                    ...f,
                    authorizedAmount: authorized,
                    // Approved = Authorized − Co-Payment (auto-derived, clamped ≥ 0).
                    approvedAmount: Math.max(0, (authorized ?? 0) - (f.coPayAmount ?? 0)),
                  }));
                }}
                placeholder="From insurer's reply"/>
            </FormField>
            <FormField label="Co-Payment Amount (₹)" error={errors.coPayAmount}>
              <Input type="number" min={0} value={form.coPayAmount ?? ""}
                onChange={e => {
                  const coPay = e.target.value === "" ? null : Number(e.target.value);
                  setForm(f => ({
                    ...f,
                    coPayAmount: coPay,
                    // Approved = Authorized − Co-Payment (auto-derived, clamped ≥ 0).
                    approvedAmount: Math.max(0, (f.authorizedAmount ?? 0) - (coPay ?? 0)),
                  }));
                }}
                placeholder="Patient co-pay deduction"/>
            </FormField>
            <FormField label="Claim Approved Amount (₹)" required={!!editing} error={errors.approvedAmount}>
              <Input type="number" min={0} value={form.approvedAmount ?? ""}
                onChange={e => setForm(f => ({ ...f, approvedAmount: Number(e.target.value) }))}
                placeholder="Authorized − Co-Payment"/>
            </FormField>
            <FormField label="Settled / Paid Amount (₹)" error={errors.settledAmount}>
              <Input type="number" min={0} value={form.settledAmount ?? ""}
                onChange={e => setForm(f => ({ ...f, settledAmount: Number(e.target.value) }))}
                placeholder="Amount actually received"/>
            </FormField>
          </div>

          <FormField label="Claim Status">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CLAIM_STATUSES.map(s => (
                <button key={s.value} type="button"
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold
                    transition-colors text-center
                    ${form.status === s.value
                      ? "bg-sky-500 text-white border-sky-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </FormField>

          {/* Settled Date */}
          {form.status === "SETTLED" && (
            <FormField label="Settled Date">
              <Input type="date" value={form.settledDate ?? ""}
                onChange={e => setForm(f => ({ ...f, settledDate: e.target.value }))}/>
            </FormField>
          )}

          {/* Rejection Reason */}
          {form.status === "DECLINED" && (
            <FormField label="Decline Reason">
              <Input value={form.rejectionReason ?? ""}
                onChange={e => setForm(f => ({ ...f, rejectionReason: e.target.value }))}
                placeholder="Reason the insurer declined the claim"/>
            </FormField>
          )}

          {/* Settled helper */}
          {form.status === "SETTLED" && form.settledAmount && form.settledAmount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3
              flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-emerald-700">
                Marking as <strong>Settled</strong> will auto-record a payment of{" "}
                <strong>{inr(form.settledAmount)}</strong> on the linked bill
                and update bill status accordingly.
              </p>
            </div>
          )}

          <FormField label="Remarks">
            <Textarea value={form.remarks ?? ""}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="TPA notes, rejection reason, approval code…"
              rows={2}/>
          </FormField>
        </div>
      </Modal>

      {/* ── View / Print Modal ── */}
      {viewClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Credit Bill — <span className="text-sky-600 font-mono">{viewClaim.claimNo}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{viewClaim.patientName} · {viewClaim.uhid}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (viewClaim) handlePrintClaim(viewClaim);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs
                    font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2
                        m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5
                        a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                  </svg>
                  Print / PDF
                </button>
                <button onClick={() => setViewClaim(null)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6">
              {viewLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Loading details…</div>
              ) : (
                <div className="space-y-4 text-sm">

                  {/* ── Patient & Admission Info ── */}
                  <div className="grid grid-cols-2 gap-3 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="space-y-0">
                      {[
                        ["Bill Number",    viewClaim.billNo ?? "—"],
                        ["UHID",           viewClaim.uhid],
                        ["Admission Date", viewClaim.admissionDate ?? "—"],
                        ["Ward",           viewClaim.billDetails?.ward ?? "—"],
                        ["Consultant",     viewClaim.billDetails?.doctorName ?? "—"],
                      ].map(([label, val]) => (
                        <div key={label} className="flex border-b border-slate-100 last:border-0">
                          <span className="w-32 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-r border-slate-100">{label}</span>
                          <span className="px-3 py-2 text-xs text-slate-800 flex-1">{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-0">
                      {[
                        ["Bill Date",      viewClaim.billDetails?.date ?? "—"],
                        ["IP Number",      viewClaim.admissionNo ?? "—"],
                        ["Discharge Date", viewClaim.dischargeDate ?? "—"],
                        ["Bed No",         viewClaim.billDetails?.bedNumber ?? "—"],
                        ["Patient Type",   viewClaim.patientType ?? "—"],
                      ].map(([label, val]) => (
                        <div key={label} className="flex border-b border-slate-100 last:border-0">
                          <span className="w-32 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-r border-slate-100">{label}</span>
                          <span className="px-3 py-2 text-xs text-slate-800 flex-1">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Patient Name */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex border-b border-slate-100">
                      <span className="w-32 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-r border-slate-100">Patient</span>
                      <span className="px-3 py-2 text-xs font-bold text-slate-800">
                        {viewClaim.patientName.toUpperCase()}
                        {viewClaim.billDetails?.age ? `, ${viewClaim.billDetails.age}` : ""}
                        {viewClaim.billDetails?.gender ? ` / ${viewClaim.billDetails.gender.toUpperCase()}` : ""}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-32 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-r border-slate-100">Contact</span>
                      <span className="px-3 py-2 text-xs text-slate-800">{viewClaim.billDetails?.phone ?? "—"}</span>
                    </div>
                  </div>

                  {/* ── Insurance Details ── */}
                  <div>
                    <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-t-xl">
                      Insurance Details
                    </div>
                    <div className="grid grid-cols-3 border border-slate-200 border-t-0 rounded-b-xl overflow-hidden">
                      {[
                        ["Company / TPA", `${viewClaim.insuranceCompany}${viewClaim.tpaName ? " / " + viewClaim.tpaName : ""}`],
                        ["Policy No",     viewClaim.policyNo ?? "—"],
                        ["Claim No",      viewClaim.claimNo],
                        ["Insured Person",viewClaim.patientName.toUpperCase()],
                        ["Pre-Auth No",   viewClaim.preAuthNumber ?? "—"],
                        ["Diagnosis",     viewClaim.diagnosis ?? "—"],
                      ].map(([label, val]) => (
                        <div key={label} className="border-r border-b border-slate-100 last:border-r-0 px-3 py-2">
                          <p className="text-[10px] text-slate-400 font-semibold mb-0.5">{label}</p>
                          <p className="text-xs text-slate-800 font-medium">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Bill Items ── */}
                  <div>
                    <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-t-xl
                      flex justify-between">
                      <span>Particulars</span>
                      <span>Total</span>
                    </div>
                    <div className="border border-slate-200 border-t-0 rounded-b-xl overflow-hidden">
                      {(viewClaim.billDetails?.items ?? []).length === 0 ? (
                        <p className="px-4 py-4 text-xs text-slate-400 text-center">No bill items attached</p>
                      ) : (
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-slate-100">
                            {(viewClaim.billDetails?.items ?? []).map(it => (
                              <tr key={it.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-700">{it.description}</td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                                  {inr(it.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* ── Amount Summary ── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {[
                      ["Gross Amount",    inr(viewClaim.billDetails?.subtotal ?? viewClaim.billAmount ?? viewClaim.claimedAmount), "text-slate-700"],
                      ["Discount",        inr(viewClaim.billDetails?.totalDiscount ?? 0), "text-slate-700"],
                      ["Bill Amount",     inr(viewClaim.billDetails?.totalAmount ?? viewClaim.billAmount ?? viewClaim.claimedAmount), "font-bold text-slate-900"],
                    ].map(([label, val, cls]) => (
                      <div key={label} className="flex justify-end border-b border-slate-100 last:border-0">
                        <span className="px-4 py-2 text-xs text-slate-500">{label}</span>
                        <span className={`px-4 py-2 text-xs w-28 text-right ${cls}`}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Settlement Summary ── */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 grid grid-cols-4 text-[10px] font-bold text-slate-500 border-b border-slate-200">
                      {["Date", "Authorized Amount", "Co Payment Amount", "Claim Approved Amount"].map(h => (
                        <div key={h} className="px-3 py-2 border-r border-slate-200 last:border-0">{h}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 text-xs">
                      {[
                        viewClaim.settledDate ?? viewClaim.submittedDate,
                        inr(viewClaim.approvedAmount ?? 0),
                        inr(Math.max(0, (viewClaim.billDetails?.totalAmount ?? viewClaim.billAmount ?? viewClaim.claimedAmount) - (viewClaim.approvedAmount ?? 0))),
                        inr(viewClaim.approvedAmount ?? viewClaim.claimedAmount),
                      ].map((val, i) => (
                        <div key={i} className="px-3 py-2 border-r border-slate-100 last:border-0 font-medium text-slate-800">{val}</div>
                      ))}
                    </div>
                  </div>

                  {/* status + remarks */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge label={STATUS_DISPLAY[viewClaim.status] ?? viewClaim.status} variant={STATUS_COLORS[viewClaim.status] ?? "gray"} dot/>
                    {viewClaim.remarks && (
                      <p className="text-xs text-slate-500 italic">"{viewClaim.remarks}"</p>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function SC({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
        {children}
      </h3>
      <div className="flex-1 h-px bg-slate-100"/>
    </div>
  );
}

function IP({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-indigo-500">{label}</p>
      <p className="text-sm font-semibold text-indigo-900">{value}</p>
    </div>
  );
}
