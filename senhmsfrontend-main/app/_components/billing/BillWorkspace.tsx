"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "../../_lib/auth";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import { buildOPBillHtml, type OPBillData } from "../../_lib/op-bill";
import { buildCreditBillHtml } from "../../_lib/print-credit-bill";
import { buildPaymentReceiptHtml } from "../../_lib/print-payment-receipt";
import { printHtml, printHtmlDocs } from "../../_lib/print";
import CollectCashModal, { type CollectCashPatient } from "../../_components/CollectCashModal";
import HScrollArea from "../../_components/HScrollArea";
import CreatableSearchSelect from "../../_components/CreatableSearchSelect";
import SearchMultiSelect, { type MultiSelectOption } from "../../_components/SearchMultiSelect";

// ─── Backend types ────────────────────────────────────────────────────────────
type BillStatusB     = "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "CANCELLED" | "CONSOLIDATED";
type PaymentModeB    = "CASH" | "CARD" | "CREDIT_CARD" | "DEBIT_CARD" | "UPI" | "CHEQUE" | "INSURANCE";
type InsStatusB      = "PENDING" | "PARTIAL" | "SETTLED" | "REJECTED";

interface BillItemResponse {
  id: number;
  serviceDate?: string | null;
  serviceCode:  string | null;
  modalityName: string | null;
  description:  string;
  quantity:     number;
  unitPrice:    number;
  discount:     number;
  total:        number;
}

interface PaymentRecord {
  id:                   number;
  date:                 string;
  amount:               number;
  paymentMode:          string;
  referenceNo:          string | null;
  receivedBy:           string | null;
  createdAt:            string | null;
  /** UUID shared by all records in the same split-payment session. Null for single-mode payments. */
  transactionGroupId:   string | null;
  /** ADVANCE / SETTLEMENT / REFUND — classifies the receipt on the split-up ledger. */
  receiptType?:         string | null;
  /** Receipt number, e.g. RCPT-YYYYMMDD-XXXX. */
  receiptNo?:           string | null;
}

/** A group of PaymentRecords that belong to the same split-payment transaction. */
interface PaymentGroup {
  /** Unique key for React rendering (id of first record in group). */
  key:        string;
  date:       string;
  records:    PaymentRecord[];
  /** Sum of all amounts in the group. */
  total:      number;
  receivedBy: string | null;
}

/**
 * Groups PaymentRecords by transactionGroupId (set on all records in a split
 * payment session). Records with no transactionGroupId are their own group.
 * Within each named group the original insertion order is preserved.
 */
function groupPayments(payments: PaymentRecord[]): PaymentGroup[] {
  if (payments.length === 0) return [];
  // Sort by id (insertion order) so older payments come first
  const sorted = [...payments].sort((a, b) => a.id - b.id);
  const groups: PaymentGroup[] = [];
  const seen = new Map<string, PaymentRecord[]>();
  const order: string[] = []; // preserves first-seen order of group keys

  for (const p of sorted) {
    if (p.transactionGroupId) {
      if (!seen.has(p.transactionGroupId)) {
        seen.set(p.transactionGroupId, []);
        order.push(p.transactionGroupId);
      }
      seen.get(p.transactionGroupId)!.push(p);
    } else {
      // Single-mode payment — its own unique key
      const k = `solo_${p.id}`;
      seen.set(k, [p]);
      order.push(k);
    }
  }

  for (const k of order) {
    groups.push(makeGroup(seen.get(k)!));
  }
  return groups;
}

function makeGroup(records: PaymentRecord[]): PaymentGroup {
  return {
    key:        String(records[0].transactionGroupId ?? records[0].id),
    date:       records[0].date,
    records,
    total:      records.reduce((s, r) => s + r.amount, 0),
    receivedBy: records[0].receivedBy ?? null,
  };
}

interface BillResponse {
  id:                  number;
  billNo:              string;
  date:                string;
  patientId:           number;
  patientName:         string;
  uhid:                string;
  patientType:         string;
  age:                 number | null;
  gender:              string | null;
  phone:               string | null;
  address?:            string | null;
  doctorName:          string | null;
  department:          string | null;
  ward:                string | null;
  bedNumber:           string | null;
  admittedDate:        string | null;
  admittedTime:        string | null;
  towards:             string | null;
  admissionId:         number | null;
  visitId:             number | null;
  items:               BillItemResponse[];
  subtotal:            number;
  totalDiscount:       number;
  totalAmount:         number;
  paidAmount:          number;
  dueAmount:           number;
  paymentMode:         PaymentModeB | null;
  referenceNo:         string | null;
  payments:            PaymentRecord[];
  status:              BillStatusB;
  cancellationReason:  string | null;
  insurance:           boolean;
  insuranceCompany:    string | null;
  insuranceCompanyId:  number | null;
  policyNo:            string | null;
  insuredPersonName:   string | null;
  cardNumber:          string | null;
  claimedAmount:       number | null;
  insurancePaidAmount: number | null;
  insuranceStatus:     InsStatusB | null;
  insuranceRemarks:    string | null;
  insuranceWriteOff:   number | null;
  insuranceLocked:     boolean;
  patientShareClosed?: boolean;
  consolidated?:       boolean;
  billFormat?:         string | null;
  consolidatesBillIds?: string | null;
  supersededByBillId?: number | null;
  dischargeDate?:      string | null;
  createdBy:           string | null;
  createdAt:           string | null;
}

interface ServiceOption {
  id: number;
  serviceCode:     string;
  serviceName:     string;
  modalityName:    string;
  price:           number;
  discountAllowed: boolean;
}

interface ModalityOption {
  id:   number;
  name: string;
}

interface InsuranceCompanyOption {
  id:      number;
  name:    string;
  tpaName: string;
  tariffEffectiveFrom: string | null;
  tariffEffectiveTo:   string | null;
}

interface PatientOption {
  id:          number;
  uhid:        string;
  name:        string;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  doctorName:  string | null;
  department:  string | null;
  patientType: string;
  insuranceCompany: string | null;
  policyNo:    string | null;
}

// ─── Display maps ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<BillStatusB, string> = {
  DRAFT: "Draft", PENDING: "Pending", PARTIAL: "Partial", PAID: "Paid", CANCELLED: "Cancelled",
  CONSOLIDATED: "Consolidated",
};
const STATUS_COLORS: Record<BillStatusB, "gray"|"yellow"|"sky"|"green"|"red"> = {
  DRAFT: "gray", PENDING: "yellow", PARTIAL: "sky", PAID: "green", CANCELLED: "red",
  CONSOLIDATED: "gray",
};
const INS_STATUS_LABEL: Record<InsStatusB, string> = {
  PENDING: "Pending", PARTIAL: "Partial", SETTLED: "Settled", REJECTED: "Rejected",
};
const INS_STATUS_COLORS: Record<InsStatusB, "yellow"|"sky"|"green"|"red"> = {
  PENDING: "yellow", PARTIAL: "sky", SETTLED: "green", REJECTED: "red",
};
const PAY_MODES: { value: PaymentModeB; label: string }[] = [
  { value: "CASH",        label: "Cash"        },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card"  },
  { value: "UPI",         label: "UPI"         },
  { value: "CHEQUE",      label: "Cheque"      },
  { value: "INSURANCE",   label: "Insurance"   },
];

// Payment mode incl. "MIXED" for split payments (MIXED is a UI-only value;
// each split is persisted as its own PaymentRecord with a real PaymentModeB).
type PayModeUI = PaymentModeB | "MIXED";
const PAY_MODES_UI: { value: PayModeUI; label: string }[] = [
  ...PAY_MODES,
  { value: "MIXED", label: "Mixed (Split)" },
];
const SPLIT_MODES: PaymentModeB[] = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI", "CHEQUE", "INSURANCE"];

/** Human-readable label for a payment mode enum value (e.g. CREDIT_CARD → "Credit Card"). */
function payModeLabel(mode: string): string {
  const found = PAY_MODES.find(p => p.value === mode);
  if (found) return found.label;
  // Fallback for legacy/unknown values like "CARD": Title-case the words.
  return mode
    .toLowerCase()
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface PaySplit { mode: PaymentModeB; amount: number; ref: string; }
function splitSum(s: PaySplit[]) { return s.reduce((a, x) => a + (x.amount || 0), 0); }

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

function inr(n: number) { return "\u20B9" + n.toLocaleString("en-IN"); }
function today() { return new Date().toISOString().slice(0, 10); }
/**
 * Returns a human name suitable for "Prepared By / Verified By".
 * Older bills stored the login email in createdBy; if the value looks like an
 * email (contains "@"), treat it as unusable so the caller can fall back to the
 * current session user's name.
 */
function displayName(v: string | null | undefined): string {
  if (!v) return "";
  return v.includes("@") ? "" : v;
}

/**
 * Status label for the bills list. View-only consolidated/summary documents all
 * carry status CONSOLIDATED; distinguish them by billFormat so the list clearly
 * shows "Summary" vs "Consolidated" (both are view-only, non-financial rows).
 */
/**
 * View-only consolidated/summary documents are NOT financial bills — they are
 * reports. Exclude them from counts and money totals in the grouped view so an
 * admission's "bills" count and totals reflect only the real charges.
 */
function isFinancialBill(b: Pick<BillResponse, "status" | "consolidated">): boolean {
  return b.status !== "CONSOLIDATED" && b.consolidated !== true && b.status !== "CANCELLED";
}

function statusLabelFor(b: Pick<BillResponse, "status" | "billFormat" | "consolidated">): string {
  if (b.status === "CONSOLIDATED" || b.consolidated === true) {
    return b.billFormat === "SUMMARY" ? "Summary" : "Consolidated";
  }
  return STATUS_LABEL[b.status];
}

// ─── line-item row type used in form ─────────────────────────────────────────
interface LineItem {
  key:             string;
  serviceCode:     string;
  modalityName:    string;
  description:     string;
  /** Service date (per-line) — editable in the Services table, used on split-up bills */
  serviceDate:     string;
  quantity:        number;
  qtyRaw?:         string;
  unitPrice:       number;
  discount:        number;
  discountAllowed: boolean;
  total:           number;
  /** Hospital's standard rate — set when insurer tariff overrides the price */
  hospitalRate?:   number;
  /** True when the insurer does not cover this service (unitPrice forced to 0) */
  excluded?:       boolean;
}

function calcLineTotal(qty: number, price: number, disc: number) {
  return Math.max(0, qty * price - disc);
}

function newLine(): LineItem {
  return {
    key: `row_${Date.now()}_${Math.random()}`,
    serviceCode: "", modalityName: "", description: "", serviceDate: today(),
    quantity: 1, qtyRaw: "1", unitPrice: 0, discount: 0, discountAllowed: true, total: 0,
  };
}

// ─── Insurance tariff entry (per insurer, keyed by service code) ──────────────
interface TariffEntry {
  tariffPrice: number;
  excluded:    boolean;
  notes:       string | null;
}

// ─── bill form state ──────────────────────────────────────────────────────────
interface BillForm {
  patientId:        number | null;
  patientName:      string;
  uhid:             string;
  patientType:      string;
  age:              number;
  gender:           string;
  phone:            string;
  doctorName:       string;
  department:       string;
  ward:             string;
  bedNumber:        string;
  admittedDate:     string;
  admittedTime:     string;
  dischargeDate:    string;
  date:             string;
  towards:          string;
  lines:            LineItem[];
  /** Overall (bill-level) discount — replaces per-line discounts */
  overallDiscount:  number;
  paymentMode:      PayModeUI;
  referenceNo:      string;
  amountPaid:       number;
  paymentSplits:    PaySplit[];
  isInsurance:      boolean;
  insuranceCompany: string;
  tpaName:          string;
  policyNo:         string;
  insuredPersonName: string;
  cardNumber:       string;
  claimedAmount:    number;
}

function emptyForm(): BillForm {
  return {
    patientId: null, patientName: "", uhid: "",
    patientType: "OP", age: 0, gender: "", phone: "",
    doctorName: "", department: "",
    ward: "", bedNumber: "", admittedDate: "", admittedTime: "", dischargeDate: "",
    date: today(), towards: "",
    lines: [newLine()],
    overallDiscount: 0,
    paymentMode: "CASH", referenceNo: "", amountPaid: 0, paymentSplits: [],
    isInsurance: false, insuranceCompany: "", tpaName: "", policyNo: "", insuredPersonName: "", cardNumber: "", claimedAmount: 0,
  };
}

// ─── Shared Bill Workspace ──────────────────────────────────────────────────
// Owns the entire bill list + the Craft/Edit modal and all satellite modals
// (record-payment, cancel, insurance-update, view/print, close-confirm) plus
// the Collect Cash flow. Used by two routes:
//   • /bills                       → full list, Craft Bill enabled (showCraft)
//   • /bills/patient/[patientId]   → scoped to one patient (scopePatientId),
//                                    per-patient breakdown, no Craft button,
//                                    but the full Edit modal + everything in it.
interface BillWorkspaceProps {
  /** When set, the workspace loads and shows ONLY this patient's bills and
   *  renders the per-patient admission breakdown instead of the global list. */
  scopePatientId?: number;
  /** Show the "Craft Bill" header action (main bills page only). */
  showCraft?: boolean;
  /**
   * When provided, the parent owns the letterhead toggle and this value is
   * used directly — the internal localStorage state is ignored.
   */
  letterheadMode?: boolean;
  /** Called when the internal letterhead toggle changes (only used when
   *  letterheadMode prop is NOT provided). */
  onLetterheadChange?: (on: boolean) => void;

  /** Called after this workspace mutates bills (save / payment / collect /
   *  close / cancel). Lets a parent (e.g. the scoped patient page that owns the
   *  TOTAL/BALANCE header summary) refetch its own copy so it never goes stale.
   *  Without this the header lagged behind the bill rows until a hard refresh. */
  onDataChange?: () => void;

  /** Bump this from the parent to force a bill-list reload — e.g. when the
   *  parent's own Collect Cash records a receipt, so the bill rows here refresh
   *  in lock-step with the parent's header summary (both directions covered). */
  refreshSignal?: number;
}

export default function BillWorkspace({ scopePatientId, showCraft = true, letterheadMode: letterheadProp, onLetterheadChange, onDataChange, refreshSignal }: BillWorkspaceProps = {}) {
  const scoped = scopePatientId != null;
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const userName = session?.name ?? "System";
  const canCraft = ["Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);

  // ── data ──
  const [bills,      setBills]      = useState<BillResponse[]>([]);
  const [services,        setServices]        = useState<ServiceOption[]>([]);
  const [modalities,      setModalities]      = useState<ModalityOption[]>([]);
  const [insuranceCoList, setInsuranceCoList] = useState<InsuranceCompanyOption[]>([]);
  // Standalone TPA names (Masters → Dropdowns → TPA Names). The TPA is chosen
  // independently of the insurance company, so this is the picker source.
  const [tpaMaster,       setTpaMaster]       = useState<string[]>([]);

  // ── Insurance tariff: price map for the currently selected insurer ──
  const [tariffMap,       setTariffMap]       = useState<Map<string, TariffEntry>>(new Map());
  const [tariffLoadedFor, setTariffLoadedFor] = useState<number | null>(null);
  const [tariffLoading,   setTariffLoading]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [fetchErr,   setFetchErr]   = useState("");
  const [saving,     setSaving]     = useState(false);

  // ── filters ──
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatusB | "">("");
  const [typeFilter,   setTypeFilter]   = useState<"OP"|"IP"|"">("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [insFilter,    setInsFilter]    = useState<""|"yes"|"no">("");


  // ── craft/edit modal ──
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editBill,     setEditBill]     = useState<BillResponse | null>(null);
  const [confirmMode,  setConfirmMode]  = useState(false); // true = read-only confirm view
  const [form,      setForm]      = useState<BillForm>(emptyForm());
  const [formErr,   setFormErr]   = useState<Record<string, string>>({});
  const [saveErr,   setSaveErr]   = useState("");

  // linked claim for the bill being edited (populated on openEdit when bill.insurance=true)
  const [linkedClaimId,     setLinkedClaimId]     = useState<number | null>(null);
  const [linkedClaimStatus, setLinkedClaimStatus] = useState<string | null>(null);
  // Persisted approval figures from the linked insurance claim (entered in the
  // Insurance module). Used so the printed approval table reflects what the
  // coordinator entered, not derived values. Null until the claim is loaded.
  const [linkedClaimAmounts, setLinkedClaimAmounts] = useState<{
    authorizedAmount: number | null; coPayAmount: number | null;
    approvedAmount: number | null; settledAmount: number | null;
  } | null>(null);
  const [insToggleErr,      setInsToggleErr]      = useState("");

  // ── Receipts + lab-paid ledger for the bill being edited (IP/BOTH) ──
  // `ledgerReceipts` = this bill's own PaymentRecords (advance/settlement/refund).
  // `ledgerExternal` = payments on the admission's OTHER bills (lab/pharmacy paid
  //    at the counter) shown as date+amount rows so they count toward Paid.
  const [ledgerReceipts, setLedgerReceipts] = useState<PaymentRecord[]>([]);
  const [ledgerExternal, setLedgerExternal] = useState<
    { key: string; date: string; source: string; mode: string; amount: number }[]
  >([]);
  const [genErr, setGenErr] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  // ── Final-bill generate checkboxes (craft modal, IP cash flow) ──
  //   splitup    — dated Final Detailed Split-up Bill (receipt ledger, no discount)
  //   cumulative — merged itemised Cumulative Bill (discount applied, no dates/ledger)
  //   summary    — merged modality-totals-only Summary Bill (discount applied)
  // GenFmt is the set of final-bill print FORMATS (not separate bill rows).
  // Format selection + generation now lives on the Patient Bills (scoped) page;
  // the state for it is declared further down (scopedGenFmts).
  type GenFmt = "splitup" | "cumulative" | "summary";

  // patient search inside modal
  const [ptQuery,    setPtQuery]    = useState("");
  const [ptDropOpen, setPtDropOpen] = useState(false);
  const [ptOptions,  setPtOptions]  = useState<PatientOption[]>([]);
  const [ptSearching, setPtSearching] = useState(false);
  const ptRef      = useRef<HTMLDivElement>(null);
  const ptInputRef = useRef<HTMLInputElement>(null);
  const [ptDropPos, setPtDropPos]   = useState<{ top: number; left: number; width: number } | null>(null);

  // ── payment modal ──
  // ── cancel modal ──
  const [cancelBill_,  setCancelBill_]  = useState<BillResponse | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr,    setCancelErr]    = useState("");

  // ── prefill (auto-fill from admission) ──
  const [prefilling,       setPrefilling]     = useState(false);
  const [prefillErr,        setPrefillErr]     = useState("");
  const [prevBilledLabs,    setPrevBilledLabs] = useState<{labId:number;labIdCode:string;investigationName:string;price:number;billedInBillNo:string}[]>([]);
  const [admissionIdForBill,setAdmissionIdForBill] = useState<number|null>(null);
  // The linked admission's current payment type. The Edit Bill insurance toggle
  // (Step 2) follows the ADMISSION, not the bill: show it only when the admission
  // is an insurance case; hide it for a cash admission. Null until resolved for
  // an IP/BOTH edit (treated as "not insurance" for the guard).
  const [admissionIsInsurance, setAdmissionIsInsurance] = useState<boolean | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);

  // ── letterhead print mode ──
  // When on, IP/Insurance bills are printed with the code-drawn header hidden
  // and a blank 5.5cm reserved at the top for pre-printed letterhead paper.
  // Persisted so staff don't have to re-toggle every session.
  // If a letterheadProp is passed from the parent, it is the source of truth.
  const [letterheadInternal, setLetterheadInternal] = useState<boolean>(() => {
    try {
      return localStorage.getItem("billLetterheadMode") === "1";
    } catch {
      return false;
    }
  });
  // Use prop if parent controls it, otherwise use internal state
  const letterheadMode = letterheadProp !== undefined ? letterheadProp : letterheadInternal;
  function toggleLetterhead(on: boolean) {
    setLetterheadInternal(on);
    try { localStorage.setItem("billLetterheadMode", on ? "1" : "0"); } catch { /* ignore */ }
    onLetterheadChange?.(on);
  }

  // ── view modal ──
  const [viewBill, setViewBill] = useState<BillResponse | null>(null);

  // ── Group-by-patient/admission view (lab-list style) ──
  // Flat table by default (fast daily scanning). When ON, each row is a PATIENT
  // showing their admission/bill totals plus Collect Cash + Bills actions. The
  // full per-admission bill breakdown now lives on /bills/patient/[patientId].
  // Grouped view is always the default (per spec). Users can still toggle it off.
  const [groupBy, setGroupBy] = useState(true);
  // Collect Cash (advance / settlement / refund receipt) modal — opened from the
  // grouped "Collect Cash" button. Records a receipt against the admission's single
  // bill (many receipts under one bill), reusing the patient-list component.
  const [collectPatient, setCollectPatient] = useState<CollectCashPatient | null>(null);
  // Receipt type to pre-select when the Collect modal opens (e.g. "LAB" when
  // paying a lab order sub-row). Null = modal default (Advance).
  const [collectReceiptType, setCollectReceiptType] = useState<"ADVANCE" | "SETTLEMENT" | "LAB" | "REFUND" | null>(null);

  // ── Scoped view: per-bill item expander + unbilled IP lab orders ──
  // (Only used on the per-patient page.) `expandedBillId` toggles a bill's
  // line-item detail; `labOrdersByAdm` holds the admission's unbilled lab
  // orders (IP labs raise no separate bill — shown as virtual rows with Pay).
  type LabOrderGroup = {
    orderGroupId: string;
    orderedDate: string | null;
    estimatedTotal: number | null;
    testCount: number;
    tests: { id: number; labId: string; investigationName: string; price: number | null }[];
  };
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  const [expandedLabOrder, setExpandedLabOrder] = useState<string | null>(null);
  // Scoped view: which admission's receipts ledger row is expanded (by adm.key).
  const [expandedReceipts, setExpandedReceipts] = useState<string | null>(null);
  // Scoped view: the insurance CLAIM status for the patient's active insurance
  // admission (DETAILS_INCOMPLETE / SENT_FOR_APPROVAL / APPROVED / CLAIMED /
  // SETTLED, or the terminal DECLINED). Shown next to the Payment Type. Null
  // when not insurance or no claim yet.
  const [scopedClaimStatus, setScopedClaimStatus] = useState<string | null>(null);
  const [labOrdersByAdm, setLabOrdersByAdm] = useState<Record<number, LabOrderGroup[]>>({});
  const loadUnbilledLabOrders = useCallback(async (admissionId: number) => {
    const { ok, data } = await apiFetch(`/api/lab/investigations/admission/${admissionId}/unbilled-orders`);
    if (!ok) return;
    const groups = (Array.isArray(data) ? data : []) as LabOrderGroup[];
    setLabOrdersByAdm(prev => ({ ...prev, [admissionId]: groups }));
  }, []);

  // Open the Collect Cash receipt modal for a patient from a grouped bill row.
  function openCollectForPatient(pg: PatientGroup) {
    const sample = pg.bills[0];
    setCollectReceiptType(null);
    setCollectPatient({
      id:          pg.patientId,
      uhid:        pg.uhid,
      name:        pg.patientName,
      age:         sample?.age ?? null,
      gender:      sample?.gender ?? null,
      doctorName:  sample?.doctorName ?? null,
      admissionId: pg.activeAdmissionId ?? sample?.admissionId ?? null,
      wardName:    sample?.ward ?? null,
      bedNumber:   sample?.bedNumber ?? null,
    });
  }

  function openView(b: BillResponse) {
    setViewBill(b);
  }

  // ── Scoped (per-patient page) helpers ──
  // The scoped page shows ONE patient; derive their display fields + a Collect
  // Cash opener from the loaded bills (first bill is the sample context).
  const scopedSample = scoped ? (bills[0] ?? null) : null;
  const scopedPatientName = scopedSample?.patientName ?? "";
  const scopedUhid = scopedSample?.uhid ?? "";
  // Payment type for the scoped patient: Insurance (insurer name when known)
  // if any real bill is an insurance bill; otherwise Cash.
  const scopedInsBill = scoped ? bills.filter(isFinancialBill).find(x => x.insurance) : undefined;
  const scopedPayType = scopedInsBill ? (scopedInsBill.insuranceCompany || "Insurance") : "Cash";
  const scopedActiveAdmissionId = scoped
    ? (bills.some(x => x.patientType === "IP" || x.patientType === "BOTH")
        ? (bills.filter(b => b.admissionId != null)
            .sort((a, b) => (b.admissionId ?? 0) - (a.admissionId ?? 0))[0]?.admissionId ?? null)
        : null)
    : null;
  function openCollectForScopedPatient() {
    if (!scopedSample || scopePatientId == null) return;
    setCollectReceiptType(null);
    setCollectPatient({
      id:          scopePatientId,
      uhid:        scopedUhid,
      name:        scopedPatientName,
      age:         scopedSample.age ?? null,
      gender:      scopedSample.gender ?? null,
      doctorName:  scopedSample.doctorName ?? null,
      admissionId: scopedActiveAdmissionId ?? scopedSample.admissionId ?? null,
      wardName:    scopedSample.ward ?? null,
      bedNumber:   scopedSample.bedNumber ?? null,
    });
  }

  // ── deep-link intent (from case sheet) ──
  // ?newForPatient=<id> → open New Bill modal prefilled for the patient
  const searchParams   = useSearchParams();
  const newForPatient  = searchParams.get("newForPatient");
  // ?editBillId=<id>    → open the Edit/craft modal for that bill
  const editBillIdParam = searchParams.get("editBillId");
  // ?patientId=<id> → filter the list to that patient's bills (View Bill)
  const viewPatientId  = searchParams.get("patientId");
  const deepLinkDone   = useRef(false);

  // ── Load bills ──
  const loadBills = useCallback(async () => {
    setLoading(true);
    setFetchErr("");
    // Scoped (per-patient page): load just this patient's bills.
    if (scopePatientId != null) {
      const { ok, data, error } = await apiFetch(`/api/bills/patient/${scopePatientId}`);
      if (!ok) { setFetchErr(error); setLoading(false); return; }
      const list = (Array.isArray(data) ? data : (data?.content ?? [])) as BillResponse[];
      setBills(list);
      setLoading(false);
      return;
    }
    const qs = new URLSearchParams({ page: "0", size: "200" });
    if (debouncedSearch) qs.set("search",      debouncedSearch);
    if (statusFilter)    qs.set("status",      statusFilter);
    if (typeFilter)      qs.set("patientType", typeFilter);
    if (dateFrom)        qs.set("dateFrom",    dateFrom);
    if (dateTo)          qs.set("dateTo",      dateTo);
    if (insFilter === "yes") qs.set("insurance", "true");
    if (insFilter === "no")  qs.set("insurance", "false");
    const { ok, data, error } = await apiFetch(`/api/bills?${qs}`);
    if (!ok) { setFetchErr(error); setLoading(false); return; }
    setBills(data?.content ?? data ?? []);
    setLoading(false);
  }, [scopePatientId, debouncedSearch, statusFilter, typeFilter, dateFrom, dateTo, insFilter]);

  // Reload this workspace's bills AND notify the parent so any externally-owned
  // summary (the scoped page's TOTAL/BALANCE header) refetches too. Use this
  // after every mutation (save / payment / collect / close / cancel) so the
  // header and the bill rows never drift apart (previously needed a hard
  // refresh). Plain loadBills() is still fine for filter/search-only reloads.
  const reloadAfterMutation = useCallback(() => {
    loadBills();
    onDataChange?.();
  }, [loadBills, onDataChange]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadBills(); }, [loadBills]);

  // Parent-driven refresh: when the parent page records a receipt via its own
  // Collect Cash (it owns the header summary), it bumps refreshSignal so the
  // bill rows here reload in step. Skip the initial mount (loadBills already
  // ran above) to avoid a duplicate fetch.
  const refreshSignalMounted = useRef(false);
  useEffect(() => {
    if (!refreshSignalMounted.current) { refreshSignalMounted.current = true; return; }
    loadBills();
  }, [refreshSignal, loadBills]);

  // ── Handle deep-link intent from the case sheet ──
  // Runs once. For newForPatient we fetch the patient and open the New Bill modal
  // prefilled. For editBillId we wait until bills have loaded, then open the
  // Edit modal for that bill.
  useEffect(() => {
    if (deepLinkDone.current) return;

    if (newForPatient) {
      deepLinkDone.current = true;
      (async () => {
        const { ok, data } = await apiFetch(`/api/patients/${newForPatient}`);
        if (ok && data) {
          const p = data as {
            id: number; uhid: string; name: string; age: number | null; gender: string | null;
            phone: string | null; doctorName: string | null; department: string | null;
            patientType: string; insuranceCompany: string | null; policyNo: string | null;
          };
          openAdd();
          selectPatient({
            id: p.id, uhid: p.uhid, name: p.name, age: p.age, gender: p.gender,
            phone: p.phone, doctorName: p.doctorName, department: p.department,
            patientType: p.patientType, insuranceCompany: p.insuranceCompany, policyNo: p.policyNo,
          });
        }
      })();
      return;
    }

    if (viewPatientId) {
      deepLinkDone.current = true;
      // Resolve the patient and seed the search box with their UHID so the
      // backend list filter returns just this patient's bills.
      (async () => {
        const { ok, data } = await apiFetch(`/api/patients/${viewPatientId}`);
        if (ok && data) {
          const p = data as { uhid: string; name: string };
          setSearch(p.uhid || p.name || "");
        }
      })();
      return;
    }

    if (editBillIdParam && bills.length > 0) {
      const target = bills.find(b => String(b.id) === editBillIdParam);
      if (target) {
        deepLinkDone.current = true;
        openEdit(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newForPatient, editBillIdParam, viewPatientId, bills]);

  // ── Load masters ──
  useEffect(() => {
    apiFetch("/api/masters/billing-masters?page=0&size=500").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ id: number; serviceCode: string; serviceName: string; modalityName: string; price: number; discountAllowed: boolean; status: string }> =
        data?.content ?? data ?? [];
      setServices(raw.filter(s => s.status !== "INACTIVE").map(s => ({
        id: s.id, serviceCode: s.serviceCode, serviceName: s.serviceName,
        modalityName: s.modalityName, price: s.price, discountAllowed: s.discountAllowed,
      })));
    });
    apiFetch("/api/masters/billing-modalities?page=0&size=200").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ id: number; name: string; status: string }> = data?.content ?? data ?? [];
      setModalities(raw.filter(m => m.status !== "INACTIVE").map(m => ({ id: m.id, name: m.name })));
    });
    apiFetch("/api/masters/insurance-companies?page=0&size=200").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ id: number; name: string; tpaName: string; status: string; tariffEffectiveFrom: string | null; tariffEffectiveTo: string | null }> = data?.content ?? data ?? [];
      setInsuranceCoList(raw.filter(c => c.status === "ACTIVE").map(c => ({
        id: c.id, name: c.name, tpaName: c.tpaName,
        tariffEffectiveFrom: c.tariffEffectiveFrom ?? null,
        tariffEffectiveTo:   c.tariffEffectiveTo ?? null,
      })));
    });
    apiFetch("/api/masters/dropdowns?category=TPA&status=ACTIVE&size=1000").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ label: string }> = data?.content ?? data ?? [];
      setTpaMaster(raw.map(o => o.label).filter(Boolean));
    });
  }, []);

  // Persist a newly-typed TPA to the shared Dropdowns master (idempotent) and
  // reflect it locally so it's immediately selectable.
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

  // TPA picker options: standalone master, keeping the current form value
  // selectable even if it was later removed from the master.
  const tpaOptions = useMemo(() => {
    const list = [...tpaMaster].sort((a, b) => a.localeCompare(b));
    if (form.tpaName && !list.includes(form.tpaName)) return [form.tpaName, ...list];
    return list;
  }, [tpaMaster, form.tpaName]);

  // ── Patient live search ──
  useEffect(() => {
    if (!ptQuery || ptQuery.trim().length < 2) { setPtOptions([]); return; }
    const timer = setTimeout(async () => {
      setPtSearching(true);
      const qs = new URLSearchParams({ search: ptQuery.trim(), page: "0", size: "15" });
      const { ok, data } = await apiFetch(`/api/patients?${qs}`);
      if (ok) {
        const raw: Array<{ id: number; uhid: string; name: string; age: number | null; gender: string | null; phone: string | null; doctorName: string | null; department: string | null; patientType: string; insuranceCompany: string | null; policyNo: string | null }> =
          data?.content ?? data ?? [];
        setPtOptions(raw.map(p => ({
          id: p.id, uhid: p.uhid, name: p.name, age: p.age, gender: p.gender,
          phone: p.phone, doctorName: p.doctorName, department: p.department,
          patientType: p.patientType, insuranceCompany: p.insuranceCompany, policyNo: p.policyNo,
        })));
      }
      setPtSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [ptQuery]);

  // ── filtered bills (latest entry first) ──
  const filtered = useMemo(() => {
    return bills.filter(b => {
      const q = debouncedSearch.toLowerCase();
      const ms = !q || b.billNo.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        b.uhid.toLowerCase().includes(q);
      const mst  = !statusFilter || b.status      === statusFilter;
      const mtyp = !typeFilter   || b.patientType === typeFilter;
      const mdf  = !dateFrom     || b.date >= dateFrom;
      const mdt  = !dateTo       || b.date <= dateTo;
      const mins = !insFilter    || (insFilter === "yes" ? b.insurance : !b.insurance);
      return ms && mst && mtyp && mdf && mdt && mins;
    })
    // Newest bill first. Sort by id desc (creation order) — this is the most
    // reliable "latest entry" ordering since two bills can share a date.
    .sort((a, b) => b.id - a.id);
  }, [bills, debouncedSearch, statusFilter, typeFilter, dateFrom, dateTo, insFilter]);

  // ── Grouped view: Patient → Admission ───────────────────────────────────────
  // Built from the already-filtered + sorted `filtered` list so search/status/
  // date filters apply identically in both views. Structure:
  //   patient
  //     admissions[]   (one per distinct admissionId; null → "OP / No admission")
  //       bills[]
  // Within a patient: active/most-recent admissions first, OP/no-admission last.
  type AdmGroup = { admissionId: number | null; key: string; bills: BillResponse[] };
  type PatientGroup = { patientId: number; patientName: string; uhid: string; admissions: AdmGroup[]; bills: BillResponse[]; activeAdmissionId: number | null };
  const grouped = useMemo<PatientGroup[]>(() => {
    const byPatient = new Map<number, PatientGroup>();
    for (const b of filtered) {
      let pg = byPatient.get(b.patientId);
      if (!pg) {
        pg = { patientId: b.patientId, patientName: b.patientName, uhid: b.uhid, admissions: [], bills: [], activeAdmissionId: null };
        byPatient.set(b.patientId, pg);
      }
      pg.bills.push(b);
      const admId = b.admissionId ?? null;
      let ag = pg.admissions.find(a => a.admissionId === admId);
      if (!ag) {
        ag = { admissionId: admId, key: `${b.patientId}:${admId ?? "op"}`, bills: [] };
        pg.admissions.push(ag);
      }
      ag.bills.push(b);
    }
    const patients = Array.from(byPatient.values());
    // Sort admissions inside each patient: real admissions by id desc, OP last.
    for (const pg of patients) {
      pg.admissions.sort((a, b) => {
        if (a.admissionId == null) return 1;
        if (b.admissionId == null) return -1;
        return b.admissionId - a.admissionId;
      });
      // Active admission = newest admission (highest id) for a patient who is
      // currently admitted (has at least one IP/BOTH bill). The bill list does
      // not carry per-admission discharge status, so we treat the most recent
      // admission of a currently-IP patient as the active one.
      const isCurrentlyIP = pg.bills.some(x => x.patientType === "IP" || x.patientType === "BOTH");
      const newestAdm = pg.admissions.find(a => a.admissionId != null)?.admissionId ?? null;
      pg.activeAdmissionId = isCurrentlyIP ? newestAdm : null;
    }
    // Patients ordered by their most-recent bill (filtered is already id-desc,
    // so the first bill seen per patient is the newest).
    return patients;
  }, [filtered]);

  // Scoped (per-patient page): load the admission's unbilled lab orders so they
  // show as virtual rows under each admission.
  useEffect(() => {
    if (!scoped) return;
    const admIds = new Set<number>();
    for (const pg of grouped) {
      for (const adm of pg.admissions) {
        if (adm.admissionId != null) admIds.add(adm.admissionId);
      }
    }
    admIds.forEach(id => loadUnbilledLabOrders(id));
  }, [scoped, grouped, loadUnbilledLabOrders]);

  // Scoped (per-patient page): load the insurance CLAIM 5-stage status for the
  // active insurance admission so the summary card can show it next to the
  // Payment Type (e.g. "SENT FOR APPROVAL"). Matched by admissionId; picks the
  // most-advanced claim stage. Cleared when the patient is not insurance.
  useEffect(() => {
    if (!scoped) { setScopedClaimStatus(null); return; }
    const insBill = bills.filter(isFinancialBill).find(b => b.insurance);
    const admId = bills.filter(b => b.admissionId != null)
      .sort((a, b) => (b.admissionId ?? 0) - (a.admissionId ?? 0))[0]?.admissionId ?? null;
    if (!insBill || admId == null) { setScopedClaimStatus(null); return; }
    let cancelled = false;
    (async () => {
      const { ok, data } = await apiFetch(`/api/insurance/claims?page=0&size=100`);
      if (!ok || cancelled) return;
      const all = (Array.isArray(data) ? data : (data?.content ?? [])) as Array<{
        billId: number | null; admissionId: number | null; status: string;
      }>;
      const PRI: Record<string, number> = {
        SETTLED: 0, CLAIMED: 1, APPROVED: 2, SENT_FOR_APPROVAL: 3, DETAILS_INCOMPLETE: 4, DECLINED: 5,
      };
      const linked = all
        .filter(c => c.admissionId === admId || c.billId === insBill.id)
        .sort((a, b) => (PRI[a.status] ?? 9) - (PRI[b.status] ?? 9))[0];
      setScopedClaimStatus(linked?.status ?? null);
    })();
    return () => { cancelled = true; };
  }, [scoped, bills]);

  // status tab counts
  const counts = useMemo(() => {
    const m: Record<string, number> = { All: bills.length };
    bills.forEach(b => { m[b.status] = (m[b.status] ?? 0) + 1; });
    return m;
  }, [bills]);

  // summary totals from filtered
  const totalAmt  = filtered.reduce((s, b) => s + b.totalAmount, 0);
  const totalPaid = filtered.reduce((s, b) => s + b.paidAmount,  0);
  const totalDue  = filtered.reduce((s, b) => s + b.dueAmount,   0);

  // ── patient search suggestions ──
  const ptSuggestions = ptOptions;   // live from API via useEffect

  function selectPatient(p: PatientOption) {
    setForm(f => ({
      ...f,
      patientId:        p.id,
      patientName:      p.name,
      uhid:             p.uhid,
      patientType:      p.patientType === "BOTH" ? "IP" : (p.patientType as "OP" | "IP"),
      age:              p.age    ?? 0,
      gender:           p.gender ?? "",
      phone:            p.phone  ?? "",
      doctorName:       p.doctorName  ?? "",
      department:       p.department  ?? "",
      towards:          (p.patientType === "IP" || p.patientType === "BOTH") ? "IPD" : "OPD",
      ward:             "",
      bedNumber:        "",
      admittedDate:     "",
      isInsurance:      !!(p.insuranceCompany),
      insuranceCompany: p.insuranceCompany ?? "",
      tpaName:          insuranceCoList.find(c => c.name === p.insuranceCompany)?.tpaName ?? "",
      policyNo:         p.policyNo ?? "",
      insuredPersonName: "",
      cardNumber:       "",
      lines:            [newLine()],
    }));
    setPtQuery(p.name);
    setPtDropOpen(false);

    // If this patient has insurance, preload the insurer tariff so services
    // added to the bill are priced at insurer rates automatically.
    if (p.insuranceCompany) {
      loadTariffForCompany(p.insuranceCompany);
    } else {
      setTariffMap(new Map());
      setTariffLoadedFor(null);
    }

    // For IP/BOTH patients, fetch the active admission — it is the SOURCE OF
    // TRUTH for the payment type (Cash / Insurance), not the patient master
    // record. A patient admitted (or edited) to Insurance on the Admission tab
    // must craft as an insurance bill even when the patient record itself has
    // no insurer. So we seed the form's insurance fields from the admission.
    setAdmissionIdForBill(null); setPrevBilledLabs([]); setPrefillErr('');
    if (p.patientType === 'IP' || p.patientType === 'BOTH') {
      apiFetch(`/api/admissions/patient/${p.id}`).then(({ ok, data }) => {
        if (!ok) return;
        const list = data as Array<{
          id: number; status: string;
          isInsurance?: boolean; insuranceCompany?: string | null;
          policyNo?: string | null; tpaName?: string | null;
          insuredPersonName?: string | null; cardNumber?: string | null;
          insuranceClaimType?: string | null;
        }>;
        const active = list.find(a => a.status !== 'DISCHARGED') ?? list[0];
        if (!active) return;
        setAdmissionIdForBill(active.id);
        if (active.isInsurance) {
          setForm(f => ({
            ...f,
            isInsurance:       true,
            insuranceCompany:  active.insuranceCompany ?? f.insuranceCompany,
            policyNo:          active.policyNo ?? f.policyNo,
            insuredPersonName: active.insuredPersonName ?? f.insuredPersonName,
            cardNumber:        active.cardNumber ?? f.cardNumber,
            tpaName:           active.tpaName
                                 ?? insuranceCoList.find(c => c.name === active.insuranceCompany)?.tpaName
                                 ?? f.tpaName,
          }));
          if (active.insuranceCompany) loadTariffForCompany(active.insuranceCompany);
        }
      });
    }
    setPtOptions([]);
  }

  // ── line item helpers ──
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, newLine()] }));
  }

  function removeLine(key: string) {
    setForm(f => ({ ...f, lines: f.lines.filter(l => l.key !== key) }));
  }

  function updateLine(key: string, field: Partial<LineItem>) {
    setForm(f => ({
      ...f,
      lines: f.lines.map(l => {
        if (l.key !== key) return l;
        const updated = { ...l, ...field };
        updated.total = calcLineTotal(updated.quantity, updated.unitPrice, updated.discount);
        return updated;
      }),
    }));
  }

  /**
   * Price a service for the current bill, applying the insurer tariff when the
   * patient is on insurance and the insurer's contract window covers the bill
   * date. Shared by the per-line picker and the search multi-select.
   */
  function priceForService(svc: ServiceOption): {
    unitPrice: number; hospitalRate?: number; excluded: boolean;
  } {
    const co        = insuranceCoList.find(c => c.name === form.insuranceCompany);
    const inWindow  = !!co
      && (!co.tariffEffectiveFrom || form.date >= co.tariffEffectiveFrom)
      && (!co.tariffEffectiveTo   || form.date <= co.tariffEffectiveTo);
    const tariff = form.isInsurance && inWindow ? tariffMap.get(svc.serviceCode) : undefined;
    const unitPrice = tariff ? (tariff.excluded ? 0 : tariff.tariffPrice) : svc.price;
    return {
      unitPrice,
      hospitalRate: tariff ? svc.price : undefined,
      excluded:     tariff ? tariff.excluded : false,
    };
  }

  function selectService(key: string, svcId: string) {
    const svc = services.find(s => s.serviceCode === svcId);
    if (!svc) return;

    const { unitPrice, hospitalRate, excluded } = priceForService(svc);
    updateLine(key, {
      serviceCode:     svc.serviceCode,
      modalityName:    svc.modalityName,
      description:     svc.serviceName,
      unitPrice,
      discountAllowed: svc.discountAllowed,
      discount:        0,
      total:           unitPrice,
      hospitalRate,
      excluded,
    });
  }

  /** Build a fully-priced LineItem from a service catalogue entry. */
  function lineFromService(svc: ServiceOption): LineItem {
    const { unitPrice, hospitalRate, excluded } = priceForService(svc);
    return {
      ...newLine(),
      serviceCode:     svc.serviceCode,
      modalityName:    svc.modalityName,
      description:     svc.serviceName,
      serviceDate:     form.date,
      unitPrice,
      discountAllowed: svc.discountAllowed,
      total:           unitPrice,
      hospitalRate,
      excluded,
    };
  }

  // Reconcile the bill lines with the services ticked in the search multi-select.
  // Keeps any manual/blank lines and prefilled ward/lab lines whose code isn't in
  // the catalogue; adds a line for each newly-ticked service and drops lines for
  // unticked catalogue services.
  function syncServicesWithSelection(nextCodes: string[]) {
    setForm(f => {
      const nextSet = new Set(nextCodes);
      const catalogueCodes = new Set(services.map(s => s.serviceCode));
      // Preserve: blank lines, non-catalogue lines (ward/lab auto-fill), and
      // catalogue lines that are still ticked.
      const kept = f.lines.filter(l =>
        !l.serviceCode ||
        !catalogueCodes.has(l.serviceCode) ||
        nextSet.has(l.serviceCode)
      );
      const existingCodes = new Set(kept.map(l => l.serviceCode).filter(Boolean));
      const additions = nextCodes
        .filter(code => !existingCodes.has(code))
        .map(code => services.find(s => s.serviceCode === code))
        .filter((s): s is ServiceOption => Boolean(s))
        .map(lineFromService);
      const merged = [...kept, ...additions];
      return { ...f, lines: merged.length > 0 ? merged : [newLine()] };
    });
  }

  /**
   * Load the tariff price map for an insurer and re-price any line items
   * already on the bill.  Called when the insurance company changes.
   */
  async function loadTariffForCompany(companyName: string) {
    const co = insuranceCoList.find(c => c.name === companyName);
    if (!co) {
      setTariffMap(new Map());
      setTariffLoadedFor(null);
      return;
    }
    setTariffLoading(true);
    try {
      const { ok, data } = await apiFetch(`/api/masters/insurance-tariffs?insuranceCompanyId=${co.id}`);
      const list: Array<{ serviceCode: string; tariffPrice: number; excluded: boolean; notes: string | null }> =
        ok && Array.isArray(data) ? data : [];
      const map = new Map<string, TariffEntry>();
      list.forEach(t => {
        // Only store rows that have an actual saved tariff price OR are explicitly excluded.
        // The catalogue endpoint returns ALL services (unpriced ones have tariffPrice: null).
        // Storing null-priced rows causes the tariff branch to win with a null price,
        // overriding the hospital-rate fallback.
        if (t.excluded || (t.tariffPrice != null && t.tariffPrice > 0)) {
          map.set(t.serviceCode, {
            tariffPrice: t.tariffPrice ?? 0, excluded: t.excluded, notes: t.notes,
          });
        }
      });
      setTariffMap(map);
      setTariffLoadedFor(co.id);

      // Re-price existing lines that match a service in the tariff.
      setForm(f => ({
        ...f,
        lines: f.lines.map(l => {
          if (!l.serviceCode) return l;
          const t = map.get(l.serviceCode);
          if (!t) return l;
          const hosp = services.find(s => s.serviceCode === l.serviceCode)?.price ?? l.unitPrice;
          const price = t.excluded ? 0 : t.tariffPrice;
          return {
            ...l,
            unitPrice:    price,
            hospitalRate: hosp,
            excluded:     t.excluded,
            total:        calcLineTotal(l.quantity, price, l.discount),
          };
        }),
      }));
    } finally {
      setTariffLoading(false);
    }
  }

  /**
   * Whether the selected insurer's tariff contract covers the bill date.
   * Option A: one contract window per insurer. If the bill date falls outside
   * [from, to], tariff prices are NOT applied (fall back to hospital rates).
   * Null bounds mean "no limit" on that side.
   */
  const tariffInEffect = (() => {
    if (!form.isInsurance || !form.insuranceCompany) return false;
    const co = insuranceCoList.find(c => c.name === form.insuranceCompany);
    if (!co) return false;
    const billDate = form.date;
    if (co.tariffEffectiveFrom && billDate < co.tariffEffectiveFrom) return false;
    if (co.tariffEffectiveTo   && billDate > co.tariffEffectiveTo)   return false;
    return true;
  })();

  /** How many line items were priced at insurer tariff (drives the summary banner) */
  const tariffAppliedCount = form.isInsurance && tariffInEffect
    ? form.lines.filter(l => l.serviceCode && tariffMap.has(l.serviceCode)).length
    : 0;

  /** Total hospital-rate value of tariff-priced lines — for showing the difference */
  const hospitalRateTotal = form.isInsurance && tariffInEffect
    ? form.lines.reduce((s, l) => {
        if (l.serviceCode && tariffMap.has(l.serviceCode) && l.hospitalRate != null) {
          return s + l.quantity * l.hospitalRate;
        }
        return s + l.quantity * l.unitPrice;
      }, 0)
    : 0;

  // computed totals from form lines.
  // Discount is now bill-level (form.overallDiscount), not per-line.
  const formSubtotal = form.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const formDiscount = Math.min(Math.max(0, form.overallDiscount || 0), formSubtotal);
  const formTotal    = Math.max(0, formSubtotal - formDiscount);

  // Receipts ledger totals (IP/BOTH): this bill's receipts + other admission bills' payments.
  const ledgerReceiptsTotal = ledgerReceipts.reduce((s, r) => s + (r.amount || 0), 0);
  const ledgerExternalTotal = ledgerExternal.reduce((s, r) => s + (r.amount || 0), 0);
  const ledgerPaidTotal     = ledgerReceiptsTotal + ledgerExternalTotal;
  // Patient-only paid: excludes the insurer's INSURANCE-mode settlement receipt
  // (recorded by InsuranceClaimService when the claim is SETTLED). The insurer
  // share is already accounted for via `closeApproved`, so counting the
  // settlement receipt here too would double-subtract it (bill − approved −
  // (patient + insurer) → phantom refund). Refund/advance/co-pay receipts stay
  // in — refunds are negative CASH/UPI rows, advances/co-pay are CASH/CARD/UPI.
  const ledgerPatientPaidTotal =
    ledgerReceipts
      .filter(r => r.paymentMode !== "INSURANCE")
      .reduce((s, r) => s + (r.amount || 0), 0)
    + ledgerExternalTotal;
  // Signed balance: >0 patient still owes; <0 patient overpaid (refund due).
  // Do NOT clamp to 0 — clamping hid overpayments and made the "Outstanding"
  // row read ₹0 when a refund was actually owed.
  const ledgerBalance       = formTotal - ledgerPaidTotal;
  const ledgerOutstanding   = Math.max(0, ledgerBalance);
  const ledgerRefundDue     = Math.max(0, -ledgerBalance);
  const showLedger = (form.patientType === "IP" || form.patientType === "BOTH");

  // ── Insurance-aware close math ──────────────────────────────────────────────
  // For an insurance bill the insurer's approved share is a receivable that may
  // arrive ~45 days later. Patient balance = bill − approved − patient paid.
  //   > 0  → patient still owes (collect before close)
  //   < 0  → patient overpaid (refund before close)
  //   = 0  → patient settled; the bill may still carry the insurer receivable,
  //          so closing is only allowed once the claim is SETTLED.
  const closeIsInsurance   = !!editBill && !!form.isInsurance;
  // Only credit the insurer's approved amount when the claim is in a state where
  // that money is genuinely expected. A DECLINED claim pays nothing, so it must
  // NOT reduce the patient's balance — otherwise the hospital silently writes
  // off the difference. The backend already zeroes approvedAmount on DECLINE;
  // this is a defense-in-depth guard in case a stale figure lingers client-side.
  const closeApproved      = linkedClaimStatus === "DECLINED"
    ? 0
    : (linkedClaimAmounts?.approvedAmount ?? 0);
  // Use patient-only paid so the insurer's approved share is subtracted exactly
  // once (via closeApproved), never twice (approved + the INSURANCE settlement
  // receipt). >0 patient owes · <0 patient overpaid (refund) · =0 settled.
  const closePatientNet    = formTotal - closeApproved - ledgerPatientPaidTotal; // signed
  // Signed cash net for a non-insurance bill: >0 patient owes, <0 overpaid (refund).
  const closeCashNet       = formTotal - ledgerPaidTotal;
  // Whether the Close action is blocked, and the reason to show.
  // INSURANCE: block only until the PATIENT's share nets to zero
  //   (bill − insurer approved − patient paid == 0). The insurer-approved
  //   amount stays as a receivable; the claim need NOT be SETTLED to close —
  //   settlement later books the revenue on the settlement day.
  // CASH: block until the full balance is cleared.
  const closeBlocked = closeIsInsurance
    ? (closePatientNet !== 0)
    : (closeCashNet !== 0);
  // Any IP / BOTH bill (new or edit). IP money is ALWAYS collected via Collect
  // Cash receipts, never inline on the bill — so Step 4 (Payment) is hidden for
  // IP/BOTH in both create and edit.
  const isIp = (form.patientType === "IP" || form.patientType === "BOTH");
  // Editing an existing IP / BOTH bill: the final bills are generated from the
  // Generate section, not here.
  const isIpEdit = !!editBill && isIp;
  // Whether to HIDE the editable Insurance (Step 2) section on an IP/BOTH edit.
  // The toggle follows the ADMISSION's payment type, not the bill:
  //   • Cash admission            → hide the toggle (patient is cash).
  //   • Insurance admission       → show the toggle (convert / auto-fill tariff).
  // Switching the admission Cash<->Insurance (while the bill carries no services)
  // flips this on the next edit. An IP/BOTH bill that is already on insurance
  // keeps the read-only approval panel below.
  // `admissionIsInsurance` is null until resolved → treat as cash (hide).
  const hideInsuranceStep = isIpEdit && (
    !!editBill?.insurance            // already an insurance bill → read-only panel
    || admissionIsInsurance !== true // cash admission (or not yet resolved) → hide toggle
  );

  // ── open craft modal ──

  // ── Auto-fill bill from admission ──────────────────────────────────────────
  async function handlePrefill() {
    if (!admissionIdForBill) { setPrefillErr('No admission linked to this patient'); return; }
    setPrefilling(true); setPrefillErr('');
    const { ok, data, error } = await apiFetch(`/api/bills/prefill?admissionId=${admissionIdForBill}`);
    setPrefilling(false);
    if (!ok) { setPrefillErr(error ?? 'Failed to load admission data'); return; }
    const p = data as {
      admissionNo:string; patientId:number; patientName:string; uhid:string;
      patientType:string; age:number; gender:string; phone:string;
      doctorName:string; department:string; ward:string; bedNumber:string;
      admittedDate:string; admittedTime:string|null;
      insuranceCompany:string|null; insuranceCompanyId:number|null; policyNo:string|null;
      tpaName:string|null; preAuthNumber:string|null; insuranceClaimType:string|null;
      insuredPersonName:string|null; cardNumber:string|null;
      items:{serviceCode:string|null;modalityName:string;description:string;serviceDate?:string|null;quantity:number;unitPrice:number;discount:number;total:number}[];
      previouslyBilledLabs:{labId:number;labIdCode:string;investigationName:string;price:number;billedInBillNo:string}[];
    };
    // Apply the same insurer-tariff rule the manual service picker uses, so
    // prefilled ward/lab lines price correctly regardless of whether the
    // insurance company was selected before or after auto-fill.
    const co        = insuranceCoList.find(c => c.name === form.insuranceCompany);
    const inWindow  = !!co
      && (!co.tariffEffectiveFrom || form.date >= co.tariffEffectiveFrom)
      && (!co.tariffEffectiveTo   || form.date <= co.tariffEffectiveTo);
    const applyTariff = form.isInsurance && inWindow;

    const prefillLines = p.items.map(it => {
      const serviceCode  = it.serviceCode ?? '';
      const tariff       = applyTariff && serviceCode ? tariffMap.get(serviceCode) : undefined;
      const unitPrice    = tariff ? (tariff.excluded ? 0 : tariff.tariffPrice) : it.unitPrice;
      return {
        key: `prefill_${Date.now()}_${Math.random()}`,
        serviceCode,
        modalityName:    it.modalityName === "Ward Charges" ? "IPD Charges" : it.modalityName === "Laboratory" ? "Laboratory Tests" : it.modalityName,
        description:     it.description,
        serviceDate:     it.serviceDate ?? form.date,
        quantity:        it.quantity,
        unitPrice,
        discount:        it.discount,
        discountAllowed: true,
        total:           calcLineTotal(it.quantity, unitPrice, it.discount),
        hospitalRate:    tariff ? it.unitPrice : undefined,
        excluded:        tariff ? tariff.excluded : false,
      };
    });
    setForm(f => {
      // Keep the user's existing real lines (drop prior auto-fill rows + blanks).
      const kept = f.lines.filter(
        l => !l.key.startsWith("prefill_") && (l.description.trim() || l.unitPrice > 0)
      );

      // Build an identity set for what's ALREADY on the bill so auto-fill only
      // ADDS charges not present yet — it must never duplicate an item the bill
      // already carries (this is what caused 3 → 6 → 9 growth in Edit mode,
      // where saved items share the same service/description the prefill
      // returns).
      //
      // Identity rules:
      //  • Lab tests → keyed by the UNIQUE lab order code in the description
      //    "CBC (LAB-20260930-00005)". Each order has its own code, so a repeat
      //    CBC on a later day is a DIFFERENT line and must NOT be deduped away.
      //  • Everything else → keyed by serviceCode when present, else the
      //    normalized description.
      const identity = (serviceCode: string, description: string) => {
        const labMatch = description.match(/\(LAB-\d{8}-\d+\)/i);
        if (labMatch) return `lab:${labMatch[0].toLowerCase()}`;
        return (serviceCode && serviceCode.trim())
          ? `svc:${serviceCode.trim().toLowerCase()}`
          : `desc:${description.trim().toLowerCase()}`;
      };

      const existing = new Set(kept.map(l => identity(l.serviceCode, l.description)));

      // Only append prefill lines whose identity isn't already on the bill.
      const newLines = prefillLines.filter(l => {
        const id = identity(l.serviceCode, l.description);
        if (existing.has(id)) return false;
        existing.add(id); // guard against duplicates within the prefill batch too
        return true;
      });

      // Auto-load insurance from the admission for CASHLESS patients (hospital
      // bills the insurer). For REIMBURSEMENT the patient pays and claims later,
      // so the bill stays a normal self-pay bill and we don't force insurance on.
      const cashless = p.insuranceClaimType === "CASHLESS" && !!p.insuranceCompany;
      const insFromAdmission = cashless
        ? {
            isInsurance:      true,
            insuranceCompany: p.insuranceCompany ?? f.insuranceCompany,
            policyNo:         p.policyNo ?? f.policyNo,
            insuredPersonName: p.insuredPersonName ?? f.insuredPersonName,
            cardNumber:       p.cardNumber ?? f.cardNumber,
            tpaName:          p.tpaName
                                ?? insuranceCoList.find(c => c.name === p.insuranceCompany)?.tpaName
                                ?? f.tpaName,
          }
        : {};

      return {
        ...f,
        ward:         p.ward         ?? f.ward,
        bedNumber:    p.bedNumber    ?? f.bedNumber,
        admittedDate: p.admittedDate ?? f.admittedDate,
        admittedTime: p.admittedTime ?? f.admittedTime,
        towards:      'IPD',
        lines:        [...kept, ...newLines],
        ...insFromAdmission,
      };
    });

    // If we auto-enabled insurance from a cashless admission, load the insurer
    // tariff so the prefilled + future lines price at insurer rates.
    if (p.insuranceClaimType === "CASHLESS" && p.insuranceCompany) {
      loadTariffForCompany(p.insuranceCompany);
    }
    setPrevBilledLabs(p.previouslyBilledLabs ?? []);
  }

  function openAdd() {
    setForm(emptyForm());
    setFormErr({});
    setSaveErr("");
    setEditBill(null);
    setConfirmMode(false);
    setLinkedClaimId(null);
    setLinkedClaimStatus(null);
    setLinkedClaimAmounts(null);
    setInsToggleErr("");
    setPtQuery("");
    setPtOptions([]);
    setLedgerReceipts([]);
    setLedgerExternal([]);
    setGenErr("");
    setModalOpen(true);
  }

  /**
   * Loads the receipts ledger for an IP/BOTH bill being edited:
   *   - this bill's own PaymentRecords (advance / settlement / refund), and
   *   - payments made on the admission's OTHER bills (lab / pharmacy paid at the
   *     counter), shown as date+amount rows so they count toward "Paid".
   * OP bills clear the ledger.
   */
  async function loadBillLedger(b: BillResponse) {
    // This bill's own receipts
    setLedgerReceipts((b.payments ?? []).slice().sort((a, c) => a.id - c.id));
    setLedgerExternal([]);
    if (!b.admissionId || (b.patientType !== "IP" && b.patientType !== "BOTH")) return;

    const { ok, data } = await apiFetch(`/api/bills/admission/${b.admissionId}`);
    if (!ok) return;
    const otherBills = (Array.isArray(data) ? data : []) as BillResponse[];
    const rows: { key: string; date: string; source: string; mode: string; amount: number }[] = [];
    for (const ob of otherBills) {
      if (ob.id === b.id) continue;          // skip this bill (shown separately)
      if (ob.consolidated) continue;         // skip view-only consolidated/summary docs
      for (const pay of ob.payments ?? []) {
        rows.push({
          key:    `ext_${pay.id}`,
          date:   pay.date,
          source: `${ob.towards ?? "Bill"} · ${ob.billNo}`,
          mode:   pay.paymentMode,
          amount: pay.amount,
        });
      }
    }
    rows.sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : 0));
    setLedgerExternal(rows);
  }

  async function openEdit(b: BillResponse, asConfirm = false) {
    if (!asConfirm && (b.status === "PAID" || b.status === "CANCELLED" || b.patientShareClosed === true)) return;

    // For IP/BOTH bills, fetch a fresh copy so the receipts ledger has the
    // bill's PaymentRecords; the list payload may be summary-only.
    if ((b.patientType === "IP" || b.patientType === "BOTH") && !b.consolidated) {
      const { ok, data } = await apiFetch(`/api/bills/${b.id}`);
      if (ok && data) b = data as BillResponse;
    }

    const billDate = b.date;
    const lines: LineItem[] = b.items.map(it => ({
      key:             String(it.id),
      serviceCode:     it.serviceCode  ?? "",
      modalityName:    it.modalityName ?? "",
      description:     it.description,
      serviceDate:     it.serviceDate ?? billDate,
      quantity:        it.quantity,
      qtyRaw:          String(it.quantity),
      unitPrice:       it.unitPrice,
      discount:        it.discount,
      // Restore discountAllowed from the services master; default true so the field is editable
      discountAllowed: services.find(s => s.serviceCode === it.serviceCode)?.discountAllowed ?? true,
      total:           it.total,
    }));
    setForm({
      patientId:        b.patientId,
      patientName:      b.patientName,
      uhid:             b.uhid,
      patientType:      b.patientType,
      age:              b.age      ?? 0,
      gender:           b.gender   ?? "",
      phone:            b.phone    ?? "",
      doctorName:       b.doctorName   ?? "",
      department:       b.department   ?? "",
      ward:             b.ward         ?? "",
      bedNumber:        b.bedNumber    ?? "",
      admittedDate:     b.admittedDate ?? "",
      admittedTime:     b.admittedTime ?? "",
      dischargeDate:    b.dischargeDate ?? "",
      date:             b.date,
      towards:          b.towards ?? "OPD",
      lines,
      overallDiscount:  b.totalDiscount ?? 0,
      paymentMode:      b.paymentMode ?? "CASH",
      referenceNo:      b.referenceNo ?? "",
      amountPaid:       0,
      paymentSplits:    [],
      isInsurance:      b.insurance,
      insuranceCompany: b.insuranceCompany ?? "",
      tpaName:          insuranceCoList.find(c => c.name === (b.insuranceCompany ?? ""))?.tpaName ?? "",
      policyNo:         b.policyNo         ?? "",
      insuredPersonName: b.insuredPersonName ?? "",
      cardNumber:       b.cardNumber       ?? "",
      claimedAmount:    (b.claimedAmount ?? 0) > 0
                          ? (b.claimedAmount ?? 0)
                          // for partial bills turning to insurance, default claimed = due balance
                          : b.dueAmount > 0 ? b.dueAmount : 0,
    });
    // Load the receipts + lab-paid ledger for this admission (IP/BOTH only).
    loadBillLedger(b);
    setFormErr({});
    setSaveErr("");
    setGenErr("");
    setLinkedClaimId(null);
    setLinkedClaimStatus(null);
    setLinkedClaimAmounts(null);
    setInsToggleErr("");
    setConfirmMode(asConfirm);
    setEditBill(b);
    setPtQuery(b.patientName);
    setPtOptions([]);
    setModalOpen(true);

    // Seed the admission link so the Auto-fill button shows in Edit mode too.
    // `selectPatient` only runs in the Add flow, so without this the button was
    // hidden when editing an existing IP bill. Prefer the bill's own
    // admissionId; if missing (older bills), look up the patient's active
    // admission like the Add flow does.
    setPrefillErr('');
    setPrevBilledLabs([]);
    setAdmissionIsInsurance(null);
    if (b.patientType === 'IP' || b.patientType === 'BOTH') {
      // Resolve the admission to (a) seed the Auto-fill link and (b) read the
      // admission's current payment type, which drives whether the Insurance
      // toggle (Step 2) is shown. The toggle follows the ADMISSION: a cash
      // admission hides it; switching the admission to insurance shows it.
      apiFetch(`/api/admissions/patient/${b.patientId}`).then(({ ok, data }) => {
        if (!ok) return;
        const list = data as Array<{
          id: number; status: string; isInsurance?: boolean;
          insuranceCompany?: string | null; policyNo?: string | null; tpaName?: string | null;
          insuredPersonName?: string | null; cardNumber?: string | null;
        }>;
        // Prefer the bill's own admission; else the active (non-discharged) one.
        const active = (b.admissionId ? list.find(a => a.id === b.admissionId) : null)
          ?? list.find(a => a.status !== 'DISCHARGED') ?? list[0];
        if (active) {
          setAdmissionIdForBill(active.id);
          setAdmissionIsInsurance(!!active.isInsurance);
          // Admission is insurance but the bill isn't flagged yet (cash bill on an
          // insurance admission): FORCE the toggle on and seed the insurer details
          // from the admission, then load the tariff so lines price at insurer
          // rates. The toggle is locked in the UI — no manual on/off that could
          // load the wrong rate card.
          if (active.isInsurance && !b.insurance) {
            setForm(f => ({
              ...f,
              isInsurance:       true,
              insuranceCompany:  active.insuranceCompany ?? f.insuranceCompany,
              policyNo:          active.policyNo ?? f.policyNo,
              insuredPersonName: active.insuredPersonName ?? f.insuredPersonName,
              cardNumber:        active.cardNumber ?? f.cardNumber,
              tpaName:           active.tpaName
                                   ?? insuranceCoList.find(c => c.name === active.insuranceCompany)?.tpaName
                                   ?? f.tpaName,
            }));
            if (active.insuranceCompany) loadTariffForCompany(active.insuranceCompany);
          }
        } else if (b.admissionId) {
          setAdmissionIdForBill(b.admissionId);
        }
      });
      // Fall back to the bill's admissionId immediately so the Auto-fill button
      // isn't blank while the fetch resolves.
      if (b.admissionId) setAdmissionIdForBill(b.admissionId);
    } else {
      setAdmissionIdForBill(null);
    }

    // if this is an insurance bill, fetch the linked claim in the background
    if (b.insurance) {
      apiFetch(`/api/insurance/claims?page=0&size=100`).then(({ ok, data }) => {
        if (!ok) return;
        const allClaims: Array<{
          id: number; billId: number | null; admissionId: number | null; status: string;
          authorizedAmount?: number | null; coPayAmount?: number | null;
          approvedAmount?: number | null; settledAmount?: number | null;
        }> = Array.isArray(data) ? data : (data?.content ?? []);
        // multiple claims can exist for the same bill — pick the most advanced
        // stage: SETTLED > CLAIMED > APPROVED > SENT_FOR_APPROVAL >
        // DETAILS_INCOMPLETE. DECLINED is a terminal off-ramp (lowest priority).
        const STATUS_PRIORITY: Record<string, number> = {
          SETTLED: 0, CLAIMED: 1, APPROVED: 2, SENT_FOR_APPROVAL: 3, DETAILS_INCOMPLETE: 4, DECLINED: 5,
        };
        // Match the claim by ADMISSION first (one claim per admission is the
        // backend invariant) — the approved / co-pay figures are entered against
        // the admission's claim, and generating a Cumulative bill creates a NEW
        // bill id, so matching only by billId would miss it and show 0.00.
        // Fall back to billId for OP / legacy claims with no admission link.
        const admId = b.admissionId;
        const matched = allClaims.filter(c =>
          (admId != null && c.admissionId === admId) || c.billId === b.id
        );
        const linked = matched.sort(
          (a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
        )[0];
        if (linked) {
          setLinkedClaimId(linked.id);
          setLinkedClaimStatus(linked.status);
          setLinkedClaimAmounts({
            authorizedAmount: linked.authorizedAmount ?? null,
            coPayAmount:      linked.coPayAmount ?? null,
            approvedAmount:   linked.approvedAmount ?? null,
            settledAmount:    linked.settledAmount ?? null,
          });
        }
      });
    }

    // Insurance bill opened for edit (e.g. a cash admission later switched to
    // insurance): load the insurer tariff so existing + new service lines price
    // at insurer rates, not hospital rates.
    if (b.insurance && b.insuranceCompany) {
      loadTariffForCompany(b.insuranceCompany);
    }
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.patientId)                           e.patient   = "Select a patient";
    if (!form.date)                                e.date      = "Date required";
    if (!form.towards)                             e.towards   = "Select a towards type";
    if (form.lines.every(l => !l.description && !l.unitPrice))  e.lines     = "Add at least one service";
    if (form.isInsurance && !form.insuranceCompany) e.insCompany = "Insurance company required";
    setFormErr(e);
    return Object.keys(e).length === 0;
  }

  /** Build the PUT/POST payload from the current form. Shared by the full save
   *  and the one-click Close (which persists the discharge date before closing
   *  so the user doesn't have to click Update and reopen the modal). */
  function buildBillReqBody(asDraft: boolean) {
    return {
      patientId:    form.patientId,
      uhid:         form.uhid,
      patientName:  form.patientName,
      patientType:  form.patientType || undefined,
      age:          form.age         || undefined,
      gender:       form.gender      || undefined,
      phone:        form.phone       || undefined,
      doctorName:   form.doctorName  || undefined,
      department:   form.department  || undefined,
      ward:         form.ward        || undefined,
      bedNumber:    form.bedNumber   || undefined,
      admittedDate: form.admittedDate || undefined,
      admittedTime: form.admittedTime || undefined,
      dischargeDate: form.dischargeDate || undefined,
      towards:      form.towards     || undefined,
      admissionId:  admissionIdForBill ?? undefined,
      date:         form.date,
      discount:     formDiscount || 0,
      items: form.lines.filter(l => l.description || l.unitPrice > 0).map(l => ({
        serviceCode:  l.serviceCode  || undefined,
        modalityName: l.modalityName || undefined,
        description:  l.description || l.modalityName || "Ad-hoc service",
        serviceDate:  l.serviceDate || form.date,
        quantity:     l.quantity,
        unitPrice:    l.unitPrice,
        discount:     0,
        hospitalRate: l.hospitalRate,
        excluded:     l.excluded ?? false,
      })),
      paymentMode:  asDraft || form.paymentMode === "MIXED" ? undefined : form.paymentMode,
      referenceNo:  form.paymentMode === "MIXED" ? undefined : (form.referenceNo || undefined),
      amountPaid:   asDraft || form.paymentMode === "MIXED" ? 0 : form.amountPaid,
      draft:        asDraft,
      createdBy:    userName || undefined,
      insurance:    form.isInsurance,
      insuranceCompany: form.isInsurance ? form.insuranceCompany : undefined,
      policyNo:     form.isInsurance ? form.policyNo : undefined,
      insuredPersonName: form.isInsurance ? (form.insuredPersonName || undefined) : undefined,
      cardNumber:   form.isInsurance ? (form.cardNumber || undefined) : undefined,
      claimedAmount: form.isInsurance ? form.claimedAmount : undefined,
      insuranceTariffApplied: form.isInsurance && tariffAppliedCount > 0,
    };
  }

  /** Persist the current form to the existing (edit) bill WITHOUT closing the
   *  modal — used by the one-click Close so the discharge date (and any other
   *  edit) is saved first. Returns the refreshed bill, or null on failure. */
  async function persistEditBillForClose(): Promise<BillResponse | null> {
    if (!editBill) return null;
    const { ok, data, error } = await apiFetch(`/api/bills/${editBill.id}`, {
      method: "PUT",
      body: JSON.stringify(buildBillReqBody(false)),
    });
    if (!ok) { setGenErr(error || "Could not save the bill before closing."); return null; }
    const saved = data as BillResponse;
    setEditBill(saved);
    return saved;
  }

  async function handleSaveBill(asDraft: boolean) {
    if (!validateForm()) return;
    setSaving(true);
    setSaveErr("");

    const reqBody = {
      patientId:    form.patientId,
      uhid:         form.uhid,
      patientName:  form.patientName,
      patientType:  form.patientType || undefined,
      age:          form.age         || undefined,
      gender:       form.gender      || undefined,
      phone:        form.phone       || undefined,
      doctorName:   form.doctorName  || undefined,
      department:   form.department  || undefined,
      ward:         form.ward        || undefined,
      bedNumber:    form.bedNumber   || undefined,
      admittedDate: form.admittedDate || undefined,
      admittedTime: form.admittedTime || undefined,
      dischargeDate: form.dischargeDate || undefined,
      towards:      form.towards     || undefined,
      admissionId:  admissionIdForBill ?? undefined,
      date:         form.date,
      // Bill-level overall discount (replaces per-line discounts)
      discount:     formDiscount || 0,
      items: form.lines.filter(l => l.description || l.unitPrice > 0).map(l => ({
        serviceCode:  l.serviceCode  || undefined,
        modalityName: l.modalityName || undefined,
        description:  l.description || l.modalityName || "Ad-hoc service",
        serviceDate:  l.serviceDate || form.date,
        quantity:     l.quantity,
        unitPrice:    l.unitPrice,
        discount:     0,
        hospitalRate: l.hospitalRate,
        excluded:     l.excluded ?? false,
      })),
      // For MIXED, the initial paid amount is applied afterwards as split
      // payment records, so the bill is created with 0 paid + no single mode.
      paymentMode:  asDraft || form.paymentMode === "MIXED" ? undefined : form.paymentMode,
      referenceNo:  form.paymentMode === "MIXED" ? undefined : (form.referenceNo || undefined),
      amountPaid:   asDraft || form.paymentMode === "MIXED" ? 0 : form.amountPaid,
      draft:        asDraft,
      createdBy:    userName || undefined,
      insurance:    form.isInsurance,
      insuranceCompany: form.isInsurance ? form.insuranceCompany : undefined,
      policyNo:     form.isInsurance ? form.policyNo : undefined,
      insuredPersonName: form.isInsurance ? (form.insuredPersonName || undefined) : undefined,
      cardNumber:   form.isInsurance ? (form.cardNumber || undefined) : undefined,
      claimedAmount: form.isInsurance ? form.claimedAmount : undefined,
      insuranceTariffApplied: form.isInsurance && tariffAppliedCount > 0,
    };

    const { ok, data: savedBill, error } = editBill
      ? await apiFetch(`/api/bills/${editBill.id}`, { method: "PUT",  body: JSON.stringify(reqBody) })
      : await apiFetch("/api/bills",                { method: "POST", body: JSON.stringify(reqBody) });

    setSaving(false);
    if (!ok) {
      // One-bill-per-admission: the backend refuses a second open bill for an
      // admission and returns "OPEN_IPD_BILL:<billNo>" or
      // "ONE_BILL_PER_ADMISSION:<billNo>". Either way, redirect the user to EDIT
      // that existing admission bill instead of showing a dead-end error.
      const m = /(?:OPEN_IPD_BILL|ONE_BILL_PER_ADMISSION):([^\s]+)/.exec(error || "");
      if (m) {
        const openBillNo = m[1];
        let existing = bills.find(b => b.billNo === openBillNo);
        // Fallback: not on the current list page — fetch this patient's bills.
        if (!existing && form.patientId) {
          const res = await apiFetch(`/api/bills/patient/${form.patientId}`);
          if (res.ok && Array.isArray(res.data)) {
            existing = (res.data as BillResponse[]).find(b => b.billNo === openBillNo);
          }
        }
        if (existing) {
          setSaveErr("");
          await openEdit(existing);
          return;
        }
        setSaveErr(`This admission already has an open bill (${openBillNo}). Open it from the list and click Edit to add services.`);
        return;
      }
      setSaveErr(error);
      return;
    }

    // ── MIXED (split) advance payment on a newly created bill ────────────────
    // The bill was created with 0 paid; now record each split as its own
    // PaymentRecord so the balance and receipt reflect the mix (Cash + UPI…).
    if (!asDraft && !editBill && form.paymentMode === "MIXED") {
      const newBillId = savedBill?.id;
      const valid = form.paymentSplits.filter(s => s.amount > 0);
      if (newBillId && valid.length > 0) {
        const txnGroupId = crypto.randomUUID();
        for (const s of valid) {
          await apiFetch(`/api/bills/${newBillId}/payment`, {
            method: "PATCH",
            body: JSON.stringify({ amount: s.amount, paymentMode: s.mode, date: form.date, referenceNo: s.ref || undefined, receivedBy: userName, transactionGroupId: txnGroupId }),
          });
        }
      }
    }

    // ── claim lifecycle management ──────────────────────────────────────────
    const wasInsurance = editBill?.insurance ?? false;
    const isInsurance  = form.isInsurance;
    const billId       = savedBill?.id ?? editBill?.id;

    if (!wasInsurance && isInsurance && billId) {
      // Scenario A: insurance just turned ON → create claim
      const insCoId    = insuranceCoList.find(c => c.name === form.insuranceCompany)?.id ?? null;
      const isPartial  = editBill?.status === "PARTIAL";
      const dueBalance = editBill?.dueAmount ?? formTotal;
      // for partial bills, claim covers only the unpaid balance
      const claimAmt   = form.claimedAmount || (isPartial ? dueBalance : formTotal);
      await apiFetch("/api/insurance/claims", {
        method: "POST",
        body: JSON.stringify({
          billId,
          // Link the claim to the admission so the backend mirrors the claim
          // status (SENT_FOR_APPROVAL) onto the admission (syncAdmissionStatus),
          // keeping the patient-list insurance highlight in sync. Without this
          // the claim is created with admissionId=null and the admission is
          // never updated.
          admissionId:        editBill?.admissionId ?? admissionIdForBill ?? null,
          billNo:             savedBill?.billNo ?? editBill?.billNo ?? "",
          patientId:          form.patientId,
          patientName:        form.patientName,
          uhid:               form.uhid,
          patientType:        form.patientType || "OP",
          admissionDate:      form.admittedDate || null,
          dischargeDate:      null,
          diagnosis:          null,
          insuranceCompany:   form.insuranceCompany,
          insuranceCompanyId: insCoId,
          policyNo:           form.policyNo  || null,
          tpaName:            form.tpaName   || null,
          preAuthNumber:      null,
          billAmount:         formTotal,
          claimedAmount:      claimAmt,
          submittedDate:      form.date,
          remarks:            isPartial
            ? `Partial payment of ${inr(editBill?.paidAmount ?? 0)} already collected in cash. Insurance claimed for balance ${inr(dueBalance)}.`
            : null,
        }),
      });

    } else if (wasInsurance && !isInsurance && linkedClaimId) {
      // Scenario B: insurance turned OFF → mark linked claim as DECLINED.
      // (Rare: only possible before any bill locks the payment type.) DECLINED
      // clears the claim's approved amount server-side, so the self-pay bill
      // charges the patient the full balance.
      await apiFetch(`/api/insurance/claims/${linkedClaimId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status:           "DECLINED",
          rejectionReason:  "Converted to self-pay bill",
          remarks:          `Insurance removed from bill on ${form.date}`,
        }),
      });
    }
    // Scenario C: insurance was ON, still ON — no claim action needed
    // (company/amount changes on the bill are already saved; claim details
    //  can be updated directly from the Insurance module if needed)

    setModalOpen(false);
    reloadAfterMutation();

    // ── Auto-print payment receipt for an "Amount Paid Now" collection ────────
    // Only for a freshly crafted (non-draft) bill that actually took money.
    // MIXED records N split payments; single-mode records 1. Drafts and edits
    // don't collect here, so skip.
    if (!asDraft && !editBill && billId) {
      const splitCount = form.paymentSplits.filter(s => s.amount > 0).length;
      const receiptCount = form.paymentMode === "MIXED"
        ? splitCount
        : (form.amountPaid > 0 ? 1 : 0);
      if (receiptCount > 0) {
        await printReceiptForLatest(billId, receiptCount);
      }
    }
  }

  /**
   * Fetch the admission's insurance claim figures (authorized / co-pay /
   * approved / settled) so the approval table on a printed bill shows the real
   * numbers entered in the Insurance module. Matches by admissionId first (one
   * claim per admission), falling back to billId. Returns null for non-insurance
   * or when no claim exists.
   */
  async function fetchClaimAmountsForBill(bill: BillResponse): Promise<{
    authorizedAmount: number | null; coPayAmount: number | null;
    approvedAmount: number | null; settledAmount: number | null;
  } | null> {
    if (!bill.insurance) return null;
    const { ok, data } = await apiFetch(`/api/insurance/claims?page=0&size=100`);
    if (!ok) return linkedClaimAmounts;
    const all = (Array.isArray(data) ? data : (data?.content ?? [])) as Array<{
      billId: number | null; admissionId: number | null; status: string;
      authorizedAmount?: number | null; coPayAmount?: number | null;
      approvedAmount?: number | null; settledAmount?: number | null;
    }>;
    const PRI: Record<string, number> = {
      SETTLED: 0, CLAIMED: 1, APPROVED: 2, SENT_FOR_APPROVAL: 3, DETAILS_INCOMPLETE: 4, DECLINED: 5,
    };
    const admId = bill.admissionId;
    const linked = all
      .filter(c => (admId != null && c.admissionId === admId) || c.billId === bill.id)
      .sort((a, b) => (PRI[a.status] ?? 9) - (PRI[b.status] ?? 9))[0];
    if (!linked) return linkedClaimAmounts;
    return {
      authorizedAmount: linked.authorizedAmount ?? null,
      coPayAmount:      linked.coPayAmount ?? null,
      approvedAmount:   linked.approvedAmount ?? null,
      settledAmount:    linked.settledAmount ?? null,
    };
  }

  /**
   * Render the chosen final-bill formats for a bill and open them for print.
   * ALL formats are pure PRINT VIEWS of the ONE admission bill — the bill
   * already carries its latest items, overall discount (totalDiscount) and
   * discharge date, so nothing new is created on the backend.
   *   • Split-up   → DATED (DATE column) + receipt ledger, no discount footer.
   *   • Cumulative → undated, itemised, Gross → Discount → Bill footer.
   *   • Summary    → modality totals only, discount footer.
   * `fmts` is the set of formats to produce; `fresh` whether to refetch the bill.
   */
  async function renderFinalBills(
    bill: BillResponse,
    fmts: Set<GenFmt>,
    opts: { refetch?: boolean } = {},
  ): Promise<string[]> {
    let b = bill;
    if (opts.refetch !== false) {
      const { ok, data } = await apiFetch(`/api/bills/${bill.id}`);
      if (ok && data) b = data as BillResponse;
    }
    const claimAmounts = await fetchClaimAmountsForBill(b);
    const docs: string[] = [];
    if (fmts.has("splitup")) {
      const html = await buildBillHtmlFor(b, true, {
        showDischargeDate: true, showDateColumn: true, skipRefetch: true, claimAmounts,
      });
      if (html) docs.push(html);
    }
    if (fmts.has("cumulative")) {
      const html = await buildBillHtmlFor(b, false, {
        cumulative: true, showDischargeDate: true, skipRefetch: true, claimAmounts,
      });
      if (html) docs.push(html);
    }
    if (fmts.has("summary")) {
      const html = await buildBillHtmlFor(b, false, {
        summaryMode: true, showDischargeDate: true, skipRefetch: true, claimAmounts,
      });
      if (html) docs.push(html);
    }
    return docs;
  }

  /**
   * Preview the dated Split-up bill for the modal's current edit. Saves pending
   * edits first so the preview reflects them.
   */
  async function handlePreview() {
    setGenErr("");
    if (!editBill) { setGenErr("Save the bill first."); return; }
    await handleSaveBill(false);
    const docs = await renderFinalBills(editBill, new Set<GenFmt>(["splitup"]));
    if (docs.length > 0) printHtml(docs[0]);
  }

  // ── Scoped (Patient Bills page) generate state + handlers ──
  // The scoped Generate panel operates directly on the admission's main IP bill
  // (no modal, no form) — the bill already persists discount + discharge date.
  const [scopedGenFmts, setScopedGenFmts] = useState<Set<GenFmt>>(new Set<GenFmt>());
  const [scopedGenBillId, setScopedGenBillId] = useState<number | null>(null);
  const [scopedGenerating, setScopedGenerating] = useState(false);
  const [scopedGenErr, setScopedGenErr] = useState("");
  function toggleScopedGenFmt(f: GenFmt) {
    setScopedGenErr("");
    setScopedGenFmts(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  /** Generate the ticked formats for a specific admission bill (scoped page). */
  async function generateFinalBillsFor(bill: BillResponse) {
    setScopedGenErr("");
    if (scopedGenFmts.size === 0) { setScopedGenErr("Tick at least one bill to generate."); return; }
    if (!bill.dischargeDate) {
      setScopedGenErr("Set the Discharge Date in the Edit bill first, then generate.");
      return;
    }
    setScopedGenerating(true);
    try {
      const docs = await renderFinalBills(bill, scopedGenFmts);
      if (docs.length > 0) {
        printHtmlDocs(docs);
        setScopedGenFmts(new Set());
      }
    } finally {
      setScopedGenerating(false);
    }
  }

  /**
   * Preview the ticked final-bill format(s) for a specific admission bill
   * (scoped page). Previews exactly what's checked — Split-up, Cumulative and/or
   * Summary — so each format can be reviewed before printing. Falls back to the
   * dated Split-up when nothing is ticked.
   */
  async function previewFinalBillFor(bill: BillResponse) {
    setScopedGenErr("");
    const active = scopedGenBillId === bill.id && scopedGenFmts.size > 0;
    const fmts = active ? scopedGenFmts : new Set<GenFmt>(["splitup"]);
    const docs = await renderFinalBills(bill, fmts);
    if (docs.length > 0) printHtmlDocs(docs);
  }

  /** Close (finalise) an IP bill — marks it PAID; cannot be undone. */
  async function handleCloseBill() {
    if (!editBill) return;
    // Safety net: Discharge Date is mandatory to close (cash or insurance).
    // The confirm trigger already blocks this, but guard here too in case the
    // confirm modal is reached by another path.
    if (!editBill.dischargeDate) {
      setGenErr("Discharge Date is required to close the bill. Set it and click Update Bill first.");
      setCloseConfirmOpen(false);
      return;
    }
    const { ok, error } = await apiFetch(`/api/bills/${editBill.id}/close`, { method: "PATCH" });
    if (!ok) { setGenErr(error || "Could not close the bill."); return; }
    setCloseConfirmOpen(false);
    setModalOpen(false);
    reloadAfterMutation();
  }

  /**
   * Fetch the freshest copy of a bill and print a receipt for its most-recent
   * payment(s). Called right after recording a payment so the running balance
   * on the slip is accurate. `count` = how many of the latest payments to print
   * (1 for single-mode, N for a split payment recorded as N records).
   */
  async function printReceiptForLatest(billId: number, count: number) {
    const { ok, data } = await apiFetch(`/api/bills/${billId}`);
    if (!ok || !data) return;
    const bill = data as BillResponse;
    const pays = bill.payments ?? [];
    if (pays.length === 0) return;
    // The last `count` records are the ones just added.
    const latest = pays.slice(-count);
    // All payments BEFORE this batch = everything except the last `count` records.
    // For splits all `count` records share the same transactionGroupId, so prior
    // payments are simply everything before them.
    const priorPayments = pays.slice(0, pays.length - count).map(r => ({
      date: r.date, amount: r.amount, paymentMode: r.paymentMode,
      referenceNo: r.referenceNo, transactionGroupId: r.transactionGroupId,
    }));
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Print each on its own page (stacked into one document for a split payment).
    const html = latest
      .map(p => buildPaymentReceiptHtml(
        {
          id: p.id, date: p.date, amount: p.amount,
          paymentMode: p.paymentMode, referenceNo: p.referenceNo, receivedBy: p.receivedBy,
        },
        {
          billNo: bill.billNo, patientName: bill.patientName, uhid: bill.uhid,
          patientType: bill.patientType, age: bill.age, gender: bill.gender,
          phone: bill.phone, ward: bill.ward, bedNumber: bill.bedNumber,
          admissionNo: null, doctorName: bill.doctorName,
          totalAmount: bill.totalAmount, paidAmount: bill.paidAmount, dueAmount: bill.dueAmount,
          priorPayments,
        },
        origin,
      ))
      .join('<div style="page-break-before:always"></div>');
    printHtml(html);
  }

  /** Print a receipt for one specific past payment (reprint from history). */
  function printOneReceipt(bill: BillResponse, p: PaymentRecord) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // For a reprint, exclude the current payment and its split siblings from
    // priorPayments so the "Previously Paid" section only shows older sessions.
    const priorPayments = (bill.payments ?? [])
      .filter(r => r.id !== p.id && r.transactionGroupId !== p.transactionGroupId)
      .map(r => ({
        date: r.date, amount: r.amount, paymentMode: r.paymentMode,
        referenceNo: r.referenceNo, transactionGroupId: r.transactionGroupId,
      }));
    const html = buildPaymentReceiptHtml(
      {
        id: p.id, date: p.date, amount: p.amount,
        paymentMode: p.paymentMode, referenceNo: p.referenceNo, receivedBy: p.receivedBy,
      },
      {
        billNo: bill.billNo, patientName: bill.patientName, uhid: bill.uhid,
        patientType: bill.patientType, age: bill.age, gender: bill.gender,
        phone: bill.phone, ward: bill.ward, bedNumber: bill.bedNumber,
        admissionNo: null, doctorName: bill.doctorName,
        totalAmount: bill.totalAmount, paidAmount: bill.paidAmount, dueAmount: bill.dueAmount,
        priorPayments,
      },
      origin,
    );
    printHtml(html);
  }

  // split editor helpers (craft modal advance)
  function addFormSplit() {
    setForm(f => {
      const used = new Set(f.paymentSplits.map(s => s.mode));
      const next = SPLIT_MODES.find(m => !used.has(m)) ?? "CASH";
      const splits = [...f.paymentSplits, { mode: next, amount: 0, ref: "" } as PaySplit];
      return { ...f, paymentSplits: splits, amountPaid: splitSum(splits) };
    });
  }
  function removeFormSplit(i: number) {
    setForm(f => {
      const splits = f.paymentSplits.filter((_, x) => x !== i);
      return { ...f, paymentSplits: splits, amountPaid: splitSum(splits) };
    });
  }
  function updateFormSplit(i: number, field: keyof PaySplit, val: unknown) {
    setForm(f => {
      const splits = f.paymentSplits.map((s, x) => x === i ? { ...s, [field]: val } : s);
      return { ...f, paymentSplits: splits, amountPaid: splitSum(splits) };
    });
  }

  // ── cancel ──
  function openCancel(b: BillResponse) {
    setCancelBill_(b);
    setCancelReason("");
    setCancelErr("");
  }

  async function handleCancel() {
    if (!cancelBill_) return;
    if (!cancelReason.trim()) { setCancelErr("Reason is required"); return; }
    setCancelSaving(true);
    const { ok, error } = await apiFetch(`/api/bills/${cancelBill_.id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason: cancelReason }),
    });
    setCancelSaving(false);
    if (!ok) { setCancelErr(error); return; }
    setCancelBill_(null);
    reloadAfterMutation();
  }

  // ── print ──
  // `withPaymentHistory` → include the Payment Details table on the IP credit
  // bill. The View modal's print passes true; the bill-list action print passes
  // false (that is the final/main bill, which must not show the ledger).
  /**
   * Build the printable HTML for ONE bill (fetching the freshest copy first)
   * and return it as a string. Shared by the single-bill print action and the
   * admission bulk-print flow so both use identical layout logic.
   * Returns null if the bill could not be built.
   */
  async function buildBillHtmlFor(
    b: BillResponse,
    withPaymentHistory = false,
    opts: {
      summaryMode?: boolean; showDischargeDate?: boolean; skipRefetch?: boolean; showDateColumn?: boolean;
      /** Render the undated itemised layout titled "Cumulative Bill" from a RAW
       *  bill (formats are now pure print views of the one admission bill, so we
       *  no longer rely on bill.consolidated to pick this title). */
      cumulative?: boolean;
      /** Explicit claim approval figures — overrides the async `linkedClaimAmounts`
       *  state so generated docs don't print 0.00 due to a stale/unloaded state. */
      claimAmounts?: {
        authorizedAmount: number | null; coPayAmount: number | null;
        approvedAmount: number | null; settledAmount: number | null;
      } | null;
    } = {},
  ): Promise<string | null> {
    // always fetch fresh bill data so payments/insurance status are up-to-date,
    // unless the caller already holds the freshest copy (e.g. just-created
    // consolidated bill returned straight from the consolidate endpoint).
    let bill = b;
    if (!opts.skipRefetch) {
      const { ok, data: fresh } = await apiFetch(`/api/bills/${b.id}`);
      bill = (ok && fresh) ? (fresh as BillResponse) : b;
    }

    // OP bills use the outpatient receipt format
    if (bill.patientType === "OP") {
      // Fetch the linked OP visit to get visitNo, tokenNo and referredBy
      let visitNo = "—";
      let tokenNo = "—";
      let referredBy: string | undefined;
      let regType: string | undefined;
      if (bill.visitId) {
        const { ok: vok, data: vdata } = await apiFetch(`/api/op-visits/${bill.visitId}`);
        if (vok && vdata) {
          const v = vdata as { visitNo?: string; tokenNo?: string; referredBy?: string; regType?: string };
          visitNo    = v.visitNo    ?? "—";
          tokenNo    = v.tokenNo    ?? "—";
          referredBy = v.referredBy ?? undefined;
          regType    = v.regType    ?? undefined;
        }
      }
      const payMode = bill.payments?.length
        ? bill.payments.map(p => `${p.paymentMode} : ₹${p.amount.toLocaleString("en-IN")}`).join(" + ")
        : bill.paymentMode ?? "CASH";
      // Date is date-only (LocalDate); the clock time comes from createdAt.
      const opBillDateObj = new Date(bill.date);
      const opBillCreatedAt = bill.createdAt ? new Date(bill.createdAt) : null;
      return buildOPBillHtml({
        billNo:      bill.billNo,
        billDate:    isNaN(opBillDateObj.getTime())
          ? bill.date
          : opBillDateObj.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" }),
        billTime:    opBillCreatedAt && !isNaN(opBillCreatedAt.getTime())
          ? opBillCreatedAt.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true })
          : undefined,
        visitNo,
        tokenNo,
        uhid:        bill.uhid,
        patientName: bill.patientName,
        age:         bill.age,
        gender:      bill.gender,
        phone:       bill.phone,
        doctorName:  bill.doctorName ?? "—",
        department:  bill.department,
        address:     bill.address ?? undefined,
        items:       bill.items.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          discount:    it.discount,
          total:       it.total,
        })),
        totalAmount: bill.totalAmount,
        paidAmount:  bill.paidAmount,
        payMode,
        preparedBy:  userName,
        referredBy,
        regType,
      });
    }

    // IP / Insurance bills — use the unified credit-bill layout
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isInsurance = bill.insurance === true;

    // Bill title by print format. Formats are pure VIEWS of the one admission
    // bill, so the title is driven by the opts (summary / dated split-up /
    // cumulative), NOT by a separate consolidated row.
    const billTitle = opts.summaryMode ? "Summary Bill"
      : opts.showDateColumn ? "Final Detailed Split-up Bill"
      : (opts.cumulative || bill.consolidated) ? "Cumulative Bill"
      : "Split-up Bill";

    // Combine admission date + time so the IP / credit bill can show both.
    // fmtDate(..., true) parses an ISO-ish "YYYY-MM-DDTHH:mm" and renders date + time.
    const admissionDateTime = bill.admittedDate
      ? (bill.admittedTime ? `${bill.admittedDate}T${bill.admittedTime}` : bill.admittedDate)
      : null;

    return buildCreditBillHtml(
      {
        claimNo:          bill.billNo,
        billNo:           bill.billNo,
        uhid:             bill.uhid,
        patientName:      bill.patientName,
        patientType:      bill.patientType,
        admissionDate:    admissionDateTime,
        admissionNo:      bill.admissionId ? `IP/ADM/${bill.admissionId}` : undefined,
        dischargeDate:    bill.date,
        insuranceCompany: bill.insuranceCompany ?? "",
        tpaName:          bill.insuranceRemarks && bill.insuranceRemarks !== "CONFIRMED"
                            ? bill.insuranceRemarks : undefined,
        policyNo:         bill.policyNo,
        preAuthNumber:    undefined,
        insuredPersonName: bill.insuredPersonName ?? undefined,
        cardNumber:       bill.cardNumber ?? undefined,
        claimedAmount:    bill.claimedAmount ?? bill.totalAmount,
        // Approval figures come from the linked INSURANCE CLAIM (entered in the
        // Insurance module), not the bill. Prefer an explicit override (passed by
        // the generate flow, fetched fresh for the admission) so a just-created
        // Cumulative bill shows the real figures instead of 0.00; else fall back
        // to the loaded state, then the bill's insurance-paid for legacy bills.
        authorizedAmount: (opts.claimAmounts ?? linkedClaimAmounts)?.authorizedAmount ?? undefined,
        coPayAmount:      (opts.claimAmounts ?? linkedClaimAmounts)?.coPayAmount ?? undefined,
        approvedAmount:   (opts.claimAmounts ?? linkedClaimAmounts)?.approvedAmount ?? bill.insurancePaidAmount ?? undefined,
        settledAmount:    (opts.claimAmounts ?? linkedClaimAmounts)?.settledAmount ?? undefined,
        submittedDate:    bill.date ?? "",
        settledDate:      bill.date,
        createdBy:        bill.createdBy,
        // Prepared/Verified By should show the staff NAME, not an email.
        // Prefer the bill's stored creator when it's a real name; if it looks
        // like an email (older records stored the login email), fall back to
        // the current session user's name.
        preparedBy:       displayName(bill.createdBy) || userName,
        // Payment ledger — only included when printing from the View modal
        // (withPaymentHistory). The main/final bill from the table action omits
        // it. Builder renders the "Payment Details" table only when payments
        // are present.
        payments:         withPaymentHistory
          ? (bill.payments ?? []).map(p => ({
              date:               p.date,
              amount:             p.amount,
              paymentMode:        p.paymentMode,
              referenceNo:        p.referenceNo,
              transactionGroupId: p.transactionGroupId,
              receiptType:        p.receiptType,
              receiptNo:          p.receiptNo,
            }))
          : undefined,
        paidAmount:       withPaymentHistory ? bill.paidAmount : undefined,
        dueAmount:        withPaymentHistory ? bill.dueAmount  : undefined,
        billDetails: {
          billNo:        bill.billNo,
          date:          bill.date,
          ward:          bill.ward,
          bedNumber:     bill.bedNumber,
          doctorName:    bill.doctorName,
          age:           bill.age,
          gender:        bill.gender,
          phone:         bill.phone,
          admittedDate:  admissionDateTime,
          address:       bill.address ?? null,
          items:         bill.items.map(it => ({
            id:           it.id ?? 0,
            description:  it.description,
            modalityName: it.modalityName ?? undefined,
            quantity:     it.quantity,
            unitPrice:    it.unitPrice,
            total:        it.total,
            serviceDate:  it.serviceDate ?? undefined,
          })),
          subtotal:      bill.subtotal,
          totalDiscount: bill.totalDiscount,
          totalAmount:   bill.totalAmount,
          createdBy:     bill.createdBy,
        },
      },
      origin,
      isInsurance
        ? { title: billTitle,
            showInsurance: true,  showApproval: !opts.showDateColumn,  letterheadMode,
            summaryMode: opts.summaryMode, showDischargeDate: opts.showDischargeDate,
            showDateColumn: opts.showDateColumn }
        : { title: billTitle,
            showInsurance: false, showApproval: false, letterheadMode,
            summaryMode: opts.summaryMode, showDischargeDate: opts.showDischargeDate,
            showDateColumn: opts.showDateColumn },
    );
  }

  // `withPaymentHistory` → include the Payment Details table on the IP credit
  // bill. The View modal's print passes true; the bill-list action print passes
  // false (that is the final/main bill, which must not show the ledger).
  async function handlePrint(b: BillResponse, withPaymentHistory = false) {
    // Consolidated / Summary are view-only documents. Reprint them in their
    // stored layout: SUMMARY → modality totals only, NO payment ledger (a ledger
    // would make it look like a payment-history bill); both show the discharge date.
    const isSummary = b.consolidated && b.billFormat === "SUMMARY";
    const opts = b.consolidated
      ? { summaryMode: isSummary, showDischargeDate: true }
      : undefined;
    const effHistory = isSummary ? false : withPaymentHistory;
    const html = await buildBillHtmlFor(b, effHistory, opts);
    if (!html) return;

    // OP bills print straight to the hidden-iframe (no preview tab needed).
    if (b.patientType === "OP") {
      printHtml(html);
      loadBills();
      return;
    }

    // IP / Insurance bills — open in a new tab so screen CSS renders first for
    // preview, then the user clicks the in-page "Print / Save PDF" button.
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank", "width=900,height=750");
    if (!win) {
      // Popup blocked — fall back to iframe print
      printHtml(html);
      return;
    }
    win.addEventListener("load", () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    loadBills();
  }

  // Render one bill row for the flat list.
  function renderBillRow(b: BillResponse) {
    const isPaid      = b.status === "PAID";
    const isCancelled = b.status === "CANCELLED";
    // View-only consolidated/summary docs are never editable or payable.
    const isViewOnly  = b.status === "CONSOLIDATED" || b.consolidated === true;
    const locked      = isPaid || isCancelled || isViewOnly || b.patientShareClosed === true;
    return (
      <tr key={b.id}
        className={`hover:bg-slate-50 transition-colors
          ${isCancelled ? "opacity-50" : ""}`}>
        <td className="px-4 py-3">
          <button onClick={() => openView(b)}
            className="font-mono text-xs font-semibold text-sky-600
              hover:text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
            {b.billNo}
          </button>
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{b.date}</td>
        <td className="px-4 py-3 max-w-[180px]">
          <p className="font-medium text-slate-800 truncate" title={b.patientName}>{b.patientName}</p>
          <p className="text-xs text-slate-400">{b.age}y · {b.gender}</p>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.uhid}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {b.admissionId ? (
            <span className="font-mono text-xs font-semibold text-indigo-700
              bg-indigo-50 px-2 py-0.5 rounded">
              IP/ADM/{b.admissionId}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${b.patientType === "IP"
              ? "bg-indigo-50 text-indigo-700"
              : "bg-sky-50 text-sky-700"}`}>
            {b.patientType}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px]">
          <p className="truncate" title={b.doctorName ?? ""}>{b.doctorName}</p>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="inline-flex items-center justify-center w-6 h-6
            rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
            {b.items.length}
          </span>
        </td>
        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{inr(b.totalAmount)}</td>
        <td className="px-4 py-3 text-emerald-700 font-semibold whitespace-nowrap">{inr(b.paidAmount)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {b.dueAmount > 0
            ? <span className="font-semibold text-amber-700">{inr(b.dueAmount)}</span>
            : <span className="text-emerald-600 font-semibold">Nil</span>
          }
        </td>
        <td className="px-4 py-3 max-w-[180px]">
          {b.insurance ? (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-700 truncate" title={b.insuranceCompany ?? ""}>
                {b.insuranceCompany}
              </p>
              {b.insuranceStatus && (
                <Badge label={INS_STATUS_LABEL[b.insuranceStatus] ?? b.insuranceStatus}
                  variant={INS_STATUS_COLORS[b.insuranceStatus] ?? "gray"} dot />
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">Self-pay</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <Badge label={statusLabelFor(b)} variant={STATUS_COLORS[b.status]} dot />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1">
            {/* Edit — locked if Paid or Cancelled */}
            {canCraft && !locked && (
              <button onClick={() => openEdit(b)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50
                  hover:text-amber-600 transition-colors" title="Edit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0
                      002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828
                      15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            )}

            {/* Confirm Bill — fully paid via insurance → open craft modal in confirm/print mode */}
            {canCraft && b.insurance && !isCancelled && !isViewOnly
              && b.insuranceStatus === "SETTLED" && b.status === "PAID"
              && b.insuranceRemarks !== "CONFIRMED" && (
              <button onClick={() => openEdit(b, true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                  text-xs font-semibold bg-emerald-50 text-emerald-700
                  hover:bg-emerald-100 transition-colors whitespace-nowrap
                  ring-1 ring-emerald-300 animate-pulse hover:animate-none"
                title="Insurance settled — confirm and print receipt">
                ✓ Confirm Bill
              </button>
            )}

            {/* Cancel — only Draft/Pending/Partial */}
            {canCraft && ["Draft","Pending","Partial"].includes(b.status) && (
              <button onClick={() => openCancel(b)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50
                  hover:text-red-500 transition-colors" title="Cancel bill">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}

            {/* Print */}
            <button onClick={() => handlePrint(b)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100
                hover:text-slate-700 transition-colors" title="Print">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0
                    002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2
                    2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function clearFilters() {
    setSearch(""); setStatusFilter(""); setTypeFilter(""); setDateFrom(""); setDateTo(""); setInsFilter("");
  }
  const anyFilter = !!(search || statusFilter || typeFilter || dateFrom || dateTo || insFilter);

  const STATUS_TABS: (BillStatusB | "All")[] = ["All", "DRAFT", "PENDING", "PARTIAL", "PAID", "CANCELLED"];

  return (
    <div className="bills-page">
      {/* Scope: hide number-input spinners only within this page */}
      <style>{`
        .bills-page input[type="number"]::-webkit-inner-spin-button,
        .bills-page input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .bills-page input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      {scoped ? (
        null /* header, breadcrumb, Back to Bills and Collect Cash are all owned by the page wrapper */
      ) : (
        <PageHeader
          title="Bill List"
          breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Bills" }]}
          action={canCraft && showCraft ? { label: "Craft Bill", onClick: openAdd } : undefined}
        />
      )}

      {/* ── Print all bills of an admission ── */}
      {!scoped && (
      <div className="flex justify-end items-center gap-3 mb-4">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
          bg-white text-slate-700 text-sm font-medium cursor-pointer select-none hover:border-sky-300"
          title="Group the list by patient and admission, with checkboxes to bulk-download a patient's bills across admissions">
          <input type="checkbox" className="accent-sky-600"
            checked={groupBy}
            onChange={e => setGroupBy(e.target.checked)} />
          Group by patient / admission
        </label>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
          bg-white text-slate-700 text-sm font-medium cursor-pointer select-none hover:border-sky-300"
          title="Hide the printed header and leave 5.5 cm blank at the top for pre-printed letterhead paper">
          <input type="checkbox" className="accent-sky-600"
            checked={letterheadMode}
            onChange={e => toggleLetterhead(e.target.checked)} />
          Print on letterhead
        </label>
      </div>
      )}

      {/* ── stat cards ── */}
      {!scoped && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SCard label="Total Bills"    value={String(filtered.length)} color="text-slate-900" />
        <SCard label="Total Amount"   value={inr(totalAmt)}           color="text-indigo-600" />
        <SCard label="Collected"      value={inr(totalPaid)}          color="text-emerald-600" />
        <SCard label="Outstanding"    value={inr(totalDue)}           color="text-amber-600" />
      </div>
      )}

      {/* ── status tabs ── */}
      {!scoped && (
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => {
          const active = t === "All" ? statusFilter === "" : statusFilter === t;
          return (
            <button key={t}
              onClick={() => setStatusFilter(t === "All" ? "" : t as BillStatusB)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-medium whitespace-nowrap transition-colors border
                ${active
                  ? "bg-sky-500 text-white border-sky-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
                }`}>
              {t}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t === "All" ? counts["All"] : (counts[t] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* ── filter bar ── */}
      {!scoped && (
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bill no, patient name, UHID…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        <DropFilter value={typeFilter} onChange={v => setTypeFilter(v as any)}
          label="Patient Type" options={[
            { value: "", label: "All Types" },
            { value: "OP", label: "OP" },
            { value: "IP", label: "IP" },
          ]}/>

        <DropFilter value={insFilter} onChange={v => setInsFilter(v as any)}
          label="Insurance" options={[
            { value: "",    label: "All" },
            { value: "yes", label: "Insurance" },
            { value: "no",  label: "Self-Pay" },
          ]}/>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
              text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
              text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 w-36"/>
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
        <p className="text-xs text-slate-400 self-center">{filtered.length} bills</p>
      </div>
      )}

      {/* ── table ── */}
      {/* Bulk-select + bill-format generation removed. Final IP bills (Split-up /
          Cumulative / Summary) are now generated from inside the Craft Bill modal
          (open a bill → Generate final bill). */}

      {!scoped && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <HScrollArea>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {(groupBy
                  ? ["Patient","UHID","AdmissionId","Payment","Admissions","Bills","Total","Balance","Actions"]
                  : ["Bill No","Date","Patient","UHID","AdmissionId","Type","Doctor","Items",
                     "Total","Paid","Balance","Insurance","Status","Actions"]
                ).map((h, i) => (
                  <th key={h || `col-${i}`} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={groupBy ? 9 : 14} className="px-4 py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0
                            00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
                      </svg>
                      No bills found
                    </div>
                  </td>
                </tr>
              ) : groupBy ? (
                // ── Grouped view: one row per PATIENT (lab-list style) ──
                grouped.map(pg => {
                  // Count + total only REAL bills (exclude view-only consolidated/summary reports).
                  const patFinancial = pg.bills.filter(isFinancialBill);
                  const patTotal = patFinancial.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
                  const patDue   = patFinancial.reduce((s, x) => s + (x.dueAmount ?? 0), 0);
                  const patBillCount = patFinancial.length;
                  // Payment type for the patient: Insurance if any bill is an
                  // insurance bill (show the insurer name when available), else Cash.
                  const insBill  = patFinancial.find(x => x.insurance);
                  const payType  = insBill ? (insBill.insuranceCompany || "Insurance") : "Cash";
                  return (
                    <Fragment key={pg.patientId}>
                      {/* ── patient header row ── */}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="font-semibold text-slate-800 truncate" title={pg.patientName}>{pg.patientName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{pg.uhid}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pg.activeAdmissionId != null ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold
                              text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                              title="Active admission">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              IP/ADM/{pg.activeAdmissionId}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {insBill ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold
                              text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full max-w-[160px]" title={payType}>
                              <span className="flex-shrink-0">🛡</span>
                              <span className="truncate">{payType}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold
                              text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              💵 Cash
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold
                            text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {pg.admissions.length} adm
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold
                            text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                            {patBillCount} bill{patBillCount === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{inr(patTotal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {patDue > 0
                            ? <span className="font-semibold text-amber-700">{inr(patDue)}</span>
                            : <span className="text-emerald-600 font-semibold">Nil</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {canCraft && (
                              <button onClick={() => openCollectForPatient(pg)}
                                title={`Collect cash for ${pg.patientName}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                  bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                                </svg>
                                Collect Cash
                              </button>
                            )}
                            <Link href={`/bills/patient/${pg.patientId}`}
                              title={`View all bills for ${pg.patientName}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                              Bills
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              ) : filtered.map(b => renderBillRow(b))}
            </tbody>
          </table>
        </HScrollArea>
        <div className="px-4 py-2 border-t border-slate-100 flex justify-between
          text-xs text-slate-400">
          <span>{filtered.length} of {bills.length} bills</span>
          <span className="font-semibold text-slate-600">
            Collected: {inr(totalPaid)} · Due: {inr(totalDue)}
          </span>
        </div>
      </div>
      )}

      {/* ── Scoped (per-patient) breakdown: original Patient Bills layout ── */}
      {scoped && (
        loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center text-slate-400">
            Loading bills…
          </div>
        ) : (grouped[0]?.admissions ?? []).length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center text-slate-400">
            No bills found for this patient.
          </div>
        ) : (
          <div className="space-y-4">
            {(grouped[0]?.admissions ?? []).map(adm => {
              const admFinancial = adm.bills.filter(isFinancialBill);
              const admTotal = admFinancial.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
              const admBillCount = admFinancial.length;
              const labOrders = adm.admissionId != null ? (labOrdersByAdm[adm.admissionId] ?? []) : [];
              // The admission's main IP bill — the one real financial bill the
              // final formats print from. Prefer an IPD/IP_FINAL bill; else the
              // most recent non-cancelled financial bill of the admission.
              const genBill =
                admFinancial.find(b => {
                  const t = (b.towards ?? "").toUpperCase();
                  return t === "IPD" || t === "IP_FINAL";
                })
                ?? admFinancial.slice().sort((a, b) => b.id - a.id)[0]
                ?? null;
              const genActive = scopedGenBillId === (genBill?.id ?? -1);
              return (
                <div key={adm.key} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                  {/* admission sub-header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-100/70">
                    <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded
                      ${adm.admissionId != null ? "text-indigo-700 bg-indigo-50" : "text-sky-700 bg-sky-50"}`}>
                      {adm.admissionId != null ? `IP/ADM/${adm.admissionId}` : "OP / No admission"}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {admBillCount} bill{admBillCount === 1 ? "" : "s"} · {inr(admTotal)}
                    </span>
                  </div>

                  {/* bills sub-table */}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left w-8"></th>
                        {["Bill No", "Date", "Items", "Total", "Paid", "Balance", "Status", "Actions"].map(h => (
                          <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adm.bills.map(b => {
                        const cancelled = b.status === "CANCELLED";
                        const isBillOpen = expandedBillId === b.id;
                        const locked = ["PAID", "CANCELLED", "CONSOLIDATED"].includes(b.status) || b.consolidated || b.patientShareClosed === true;
                        return (
                          <Fragment key={b.id}>
                            <tr className={`border-t border-slate-100 hover:bg-slate-50/60 ${cancelled ? "opacity-50" : ""}`}>
                              <td className="px-3 py-2 text-center">
                                <button type="button" onClick={() => setExpandedBillId(prev => (prev === b.id ? null : b.id))}
                                  title={isBillOpen ? "Hide items" : "View items"}
                                  className={`w-5 h-5 rounded flex items-center justify-center transition-all
                                    ${isBillOpen ? "bg-sky-100 text-sky-600 rotate-90" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => openView(b)}
                                  className="font-mono font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                                  {b.billNo}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{b.date}</td>
                              <td className="px-3 py-2 text-slate-600">{b.items.length}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{inr(b.totalAmount)}</td>
                              <td className="px-3 py-2 text-emerald-700 font-semibold whitespace-nowrap">{inr(b.paidAmount)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {b.dueAmount > 0
                                  ? <span className="font-semibold text-amber-700">{inr(b.dueAmount)}</span>
                                  : <span className="text-emerald-600 font-semibold">Nil</span>}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <Badge label={statusLabelFor(b)} variant={STATUS_COLORS[b.status]} dot />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  {/* Edit — opens the real Edit modal inline on this page */}
                                  {canCraft && !locked && (
                                    <button onClick={() => openEdit(b)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                      title="Edit bill">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  )}
                                  {/* Cancel */}
                                  {canCraft && ["Draft", "Pending", "Partial"].includes(statusLabelFor(b)) && (
                                    <button onClick={() => openCancel(b)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                      title="Cancel bill">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* View-only line-item detail */}
                            {isBillOpen && (
                              <tr className="bg-slate-50/80">
                                <td></td>
                                <td colSpan={8} className="px-3 py-2">
                                  {b.items.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-1">No items on this bill.</p>
                                  ) : (
                                    <table className="w-full text-[11px] border border-slate-200 rounded">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-500 uppercase tracking-wide">
                                          <th className="px-2 py-1 text-left">Date</th>
                                          <th className="px-2 py-1 text-left">Particulars</th>
                                          <th className="px-2 py-1 text-right">Qty</th>
                                          <th className="px-2 py-1 text-right">Rate</th>
                                          <th className="px-2 py-1 text-right">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {b.items.map((it, idx) => (
                                          <tr key={it.id ?? idx} className="border-t border-slate-100">
                                            <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{it.serviceDate ?? "—"}</td>
                                            <td className="px-2 py-1 text-slate-700">{it.description}</td>
                                            <td className="px-2 py-1 text-right text-slate-600">{it.quantity}</td>
                                            <td className="px-2 py-1 text-right text-slate-600">{inr(it.unitPrice)}</td>
                                            <td className="px-2 py-1 text-right font-medium text-slate-800">{inr(it.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}

                    </tbody>
                  </table>

                  {/* ── Generate final bill (print formats of this ONE bill) ── */}
                  {canCraft && adm.admissionId != null && genBill && (
                    <div className="border-t border-slate-200 px-3 py-3 bg-slate-50/40">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Generate final bill
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {genBill.dischargeDate
                            ? `Discharge: ${genBill.dischargeDate}`
                            : "Set discharge date in Edit bill"}
                        </span>
                      </div>
                      {genActive && scopedGenErr && (
                        <p className="text-xs text-red-500 mb-2">{scopedGenErr}</p>
                      )}
                      <div className="space-y-1.5 mb-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 accent-sky-600"
                            checked={genActive && scopedGenFmts.has("splitup")}
                            onChange={() => { setScopedGenBillId(genBill.id); toggleScopedGenFmt("splitup"); }} />
                          <span className="text-sm">
                            <span className="font-medium text-slate-700">Split-up Bill</span>
                            <span className="block text-[11px] text-slate-400">
                              Dated, itemised, with the receipt ledger. (No discount — the raw bill for the doctor.)
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 accent-indigo-600"
                            checked={genActive && scopedGenFmts.has("cumulative")}
                            onChange={() => { setScopedGenBillId(genBill.id); toggleScopedGenFmt("cumulative"); }} />
                          <span className="text-sm">
                            <span className="font-medium text-slate-700">Cumulative Bill</span>
                            <span className="block text-[11px] text-slate-400">
                              Itemised, no dates/ledger, discount applied (Gross → Discount → Bill). Set discount in Edit bill.
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 accent-purple-600"
                            checked={genActive && scopedGenFmts.has("summary")}
                            onChange={() => { setScopedGenBillId(genBill.id); toggleScopedGenFmt("summary"); }} />
                          <span className="text-sm">
                            <span className="font-medium text-slate-700">Summary Bill</span>
                            <span className="block text-[11px] text-slate-400">
                              Category totals only, discount applied.
                            </span>
                          </span>
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => previewFinalBillFor(genBill)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">
                          Preview
                        </button>
                        <button type="button"
                          onClick={() => { setScopedGenBillId(genBill.id); generateFinalBillsFor(genBill); }}
                          disabled={scopedGenerating || !genActive || scopedGenFmts.size === 0}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
                          {scopedGenerating && genActive
                            ? "Generating…"
                            : `Generate Selected${genActive && scopedGenFmts.size ? ` (${scopedGenFmts.size})` : ""}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── CRAFT / EDIT MODAL ── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setConfirmMode(false); }}
        title={confirmMode ? `Confirm Bill — ${editBill?.billNo ?? ""}` : editBill ? `Edit Bill — ${editBill.billNo}` : "Craft Bill"}
        size="xl"
        footer={
          confirmMode ? (
            // ── Confirm mode: only Print Receipt ──
            <>
              <button onClick={() => { setModalOpen(false); setConfirmMode(false); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
              {editBill && (
                <button onClick={async () => {
                  // mark bill as confirmed in DB, then print
                  if (editBill) {
                    await apiFetch(`/api/bills/${editBill.id}/insurance`, {
                      method: "PATCH",
                      body: JSON.stringify({ insuranceRemarks: "CONFIRMED" }),
                    });
                    handlePrint(editBill);
                    setModalOpen(false);
                    setConfirmMode(false);
                    reloadAfterMutation();
                  }
                }}
                  className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600
                    text-white font-medium rounded-lg inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0
                        002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2
                        2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                  </svg>
                  Print Receipt
                </button>
              )}
            </>
          ) : (
            // ── Normal craft/edit mode ──
            <>
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              {!editBill && (
                <button onClick={() => handleSaveBill(true)}
                  className="px-4 py-2 text-sm border border-slate-300 text-slate-700
                    hover:bg-slate-50 font-medium rounded-lg">
                  Save as Draft
                </button>
              )}
              {/* Preview — any saved bill. Saves pending edits, then opens the bill in a new tab. */}
              {editBill && (
                <button onClick={handlePreview}
                  className="px-4 py-2 text-sm border border-slate-300 text-slate-700
                    hover:bg-slate-50 font-medium rounded-lg inline-flex items-center gap-1.5">
                  ▶ Preview
                </button>
              )}
              <button onClick={() => handleSaveBill(false)}
                className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600
                  text-white font-medium rounded-lg">
                {editBill ? "Update Bill" : "Confirm Bill"}
              </button>
              {/* Close Bill — IP/BOTH, saved + not yet closed. Marks PAID (final). */}
              {editBill && (form.patientType === "IP" || form.patientType === "BOTH")
                && !["PAID","CANCELLED","CONSOLIDATED"].includes(editBill.status)
                && editBill.patientShareClosed !== true && (
                <button onClick={async () => {
                    setGenErr("");
                    // Discharge Date is mandatory to close an IP/BOTH bill.
                    if (!form.dischargeDate) {
                      setFormErr(e => ({ ...e, dischargeDate: "Discharge Date is required to close the bill" }));
                      setGenErr("Set the Discharge Date (Step: Bill Date row) before closing the bill.");
                      return;
                    }
                    // If the discharge date isn't persisted yet, save it in the
                    // SAME click (no separate Update + reopen), then open the
                    // confirm. The close API acts on the saved bill.
                    if (form.dischargeDate !== (editBill.dischargeDate ?? "")) {
                      setSaving(true);
                      const saved = await persistEditBillForClose();
                      setSaving(false);
                      if (!saved) return; // save failed — error already shown
                    }
                    setCloseConfirmOpen(true);
                  }}
                  className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 border border-red-200
                    text-red-700 font-semibold rounded-lg inline-flex items-center gap-1.5">
                  Close Bill <span className="opacity-70 font-normal text-xs">— cannot be undone</span>
                </button>
              )}
            </>
          )
        }>
        <div className={`space-y-5 ${confirmMode ? "pointer-events-none select-none opacity-80" : ""}`}>
          {confirmMode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3
              flex items-center gap-2 text-sm text-emerald-800">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span><strong>Insurance Settled</strong> — review the bill details and click <strong>Print Receipt</strong> to hand over to the patient.</span>
            </div>
          )}

          {/* ─ Step 1: Patient Search ─ */}
          <SH>Step 1 — Patient</SH>
          <div className="relative" ref={ptRef}>
            <FormField label="Search Patient" required error={formErr.patient}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                  text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input value={ptQuery}
                  ref={ptInputRef}
                  onChange={e => {
                    setPtQuery(e.target.value);
                    setPtDropOpen(true);
                    if (!e.target.value) setForm(f => ({ ...f, patientId: null }));
                    if (ptInputRef.current) {
                      const r = ptInputRef.current.getBoundingClientRect();
                      // r.bottom is already in viewport coords (no scrollY needed for fixed positioning)
                      setPtDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
                    }
                  }}
                  onFocus={() => {
                    setPtDropOpen(true);
                    if (ptInputRef.current) {
                      const r = ptInputRef.current.getBoundingClientRect();
                      setPtDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
                    }
                  }}
                  placeholder="Type patient name, UHID or phone…"
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200
                    bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
              </div>
            </FormField>

            {/* dropdown — rendered via portal to escape modal overflow-y-auto clipping */}
            {ptDropOpen && ptDropPos && typeof document !== "undefined" && createPortal(
              <>
                {ptSearching && (
                  <div style={{ position: "fixed", top: ptDropPos.top, left: ptDropPos.left, width: ptDropPos.width, zIndex: 9999 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Searching…
                  </div>
                )}
                {!ptSearching && ptSuggestions.length > 0 && (
                  <ul style={{ position: "fixed", top: ptDropPos.top, left: ptDropPos.left, width: ptDropPos.width, zIndex: 9999 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto text-sm">
                    {ptSuggestions.map(p => (
                      <li key={p.id}>
                        <button type="button"
                          onMouseDown={() => selectPatient(p)}
                          className="w-full flex items-start gap-3 px-4 py-2.5
                            hover:bg-sky-50 text-left transition-colors">
                          <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center
                            justify-center text-xs font-bold mt-0.5
                            ${p.patientType === "IP" || p.patientType === "BOTH" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>
                            {p.patientType === "BOTH" ? "IP" : p.patientType}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">
                              {p.uhid} · {p.age != null ? `${p.age}y` : ""} · {p.gender ?? ""} · {p.phone ?? ""}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!ptSearching && ptQuery.trim().length >= 2 && ptSuggestions.length === 0 && (
                  <div style={{ position: "fixed", top: ptDropPos.top, left: ptDropPos.left, width: ptDropPos.width, zIndex: 9999 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs text-slate-400">
                    No patients found for &quot;{ptQuery}&quot;
                  </div>
                )}
              </>,
              document.body
            )}
          </div>

          {/* Patient info card after selection */}
          {form.patientId && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
              grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <InfoPair label="UHID"       value={form.uhid} />
              <InfoPair label="Age/Gender" value={`${form.age}y · ${form.gender}`} />
              <InfoPair label="Phone"      value={form.phone} />
              <InfoPair label="Doctor"     value={form.doctorName} />
              <InfoPair label="Dept"       value={form.department} />
              <InfoPair label="Type"       value={form.patientType} />
              {form.patientType === "IP" && (
                <>
                  <InfoPair label="Ward"     value={form.ward || "—"} />
                  <InfoPair label="Bed"      value={form.bedNumber || "—"} />
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Bill Date" required error={formErr.date}>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
            </FormField>
            <FormField label="Towards" required error={formErr.towards}>
              <Select value={form.towards}
                onChange={e => setForm(f => ({ ...f, towards: e.target.value }))}>
                <option value="">— Select —</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="Lab">Lab</option>
                <option value="Pharmacy">Pharmacy</option>
              </Select>
            </FormField>
            {(form.patientType === "IP" || form.patientType === "BOTH") && (
              <FormField label="Discharge Date" required error={formErr.dischargeDate}>
                <Input type="date" value={form.dischargeDate}
                  onChange={e => setForm(f => {
                    // Clear the close-blocking error as soon as a date is picked.
                    if (e.target.value) setFormErr(fe => { const { dischargeDate, ...rest } = fe; return rest; });
                    return { ...f, dischargeDate: e.target.value };
                  })}/>
                <p className="text-xs text-slate-400 mt-1">
                  Required to generate the final Split-up / Cumulative / Summary bill. Editable.
                </p>
              </FormField>
            )}
          </div>

          {/* ─ Step 2: Insurance ─ (hidden only for an IP/BOTH bill already on
               insurance; a cash IP bill still shows this so it can be switched
               to insurance at discharge, auto-filling from the insurer tariff) */}
          {!hideInsuranceStep && (<>
          <SH>Step 2 — Insurance</SH>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              {/* The toggle is LOCKED when the linked admission is an insurance
                  case: it is forced ON and cannot be switched off here. A manual
                  on/off is only allowed for a non-IP (OP) bill, where there is no
                  admission driving the payment type. This prevents loading the
                  wrong rate card by toggling mid-edit. */}
              <button type="button"
                disabled={admissionIsInsurance === true}
                onClick={() => {
                  if (admissionIsInsurance === true) return; // locked — follows the admission
                  // Payment-type lock: once the (saved) bill carries real service
                  // charges, Cash/Insurance can't be flipped. An empty ₹0 draft
                  // holding only advance receipts is still switchable (receipts
                  // sit in paidAmount, not totalAmount). Mirrors the backend
                  // guard in BillingService.update so the user sees it up front.
                  if (editBill && (editBill.totalAmount ?? 0) > 0) {
                    setInsToggleErr(
                      "Payment type (Cash / Insurance) cannot be changed — this bill already " +
                      "has service charges. Clear the items first, or manage it from the Admission screen."
                    );
                    return;
                  }
                  // block turning OFF if claim is already settled or past approval
                  if (form.isInsurance && linkedClaimId &&
                      (linkedClaimStatus === "SETTLED" || linkedClaimStatus === "CLAIMED"
                       || linkedClaimStatus === "APPROVED")) {
                    setInsToggleErr(
                      `Cannot remove insurance — claim is already ${linkedClaimStatus.toLowerCase()}. ` +
                      `Update it from the Insurance module instead.`
                    );
                    return;
                  }
                  setInsToggleErr("");
                  setForm(f => ({ ...f, isInsurance: !f.isInsurance }));
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full
                  transition-colors ${form.isInsurance ? "bg-sky-500" : "bg-slate-200"}
                  ${admissionIsInsurance === true ? "opacity-70 cursor-not-allowed" : ""}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white
                  shadow transition-transform ${form.isInsurance ? "translate-x-6" : "translate-x-1"}`}/>
              </button>
              <p className="text-sm font-medium text-slate-700">Insurance Bill</p>
              {admissionIsInsurance === true && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                  Locked — insurance admission
                </span>
              )}
              {/* show existing claim status badge if editing an insurance bill */}
              {editBill?.insurance && linkedClaimStatus && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${linkedClaimStatus === "SETTLED"           ? "bg-emerald-100 text-emerald-700" :
                    linkedClaimStatus === "CLAIMED"           ? "bg-purple-100 text-purple-700"   :
                    linkedClaimStatus === "APPROVED"          ? "bg-sky-100 text-sky-700"         :
                    linkedClaimStatus === "DECLINED"          ? "bg-red-100 text-red-700"         :
                    linkedClaimStatus === "SENT_FOR_APPROVAL" ? "bg-yellow-100 text-yellow-700"   :
                                                                "bg-slate-100 text-slate-700"}`}>
                  Claim: {linkedClaimStatus.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {insToggleErr && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠ {insToggleErr}
              </p>
            )}
            {/* warn user: turning insurance OFF will decline the linked claim */}
            {!form.isInsurance && editBill?.insurance && linkedClaimId &&
              linkedClaimStatus !== "DECLINED" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ Turning off insurance will close the linked claim as <strong>Declined</strong> (converted to self-pay).
              </p>
            )}
            {form.isInsurance && (
              <p className="text-xs text-slate-500">
                Select the insurance company first — service prices will load at the insurer&apos;s tariff rates.
              </p>
            )}
          </div>

          {form.isInsurance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50
              border border-indigo-200 rounded-xl p-4">

              {/* partial payment info banner */}
              {editBill?.status === "PARTIAL" && !editBill.insurance && (
                <div className="col-span-full bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5
                  flex items-start gap-2 text-xs text-amber-800">
                  <span className="text-base leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="font-semibold">Partial payment already collected</p>
                    <p className="mt-0.5">
                      Cash collected: <strong>{inr(editBill.paidAmount)}</strong> ·
                      Balance for insurance: <strong>{inr(editBill.dueAmount)}</strong>
                    </p>
                    <p className="mt-0.5 text-amber-700">
                      Insurance will be claimed for the due balance.
                    </p>
                  </div>
                </div>
              )}

              {/* Insurance Company — dropdown from master */}
              <FormField label="Insurance Company" required error={formErr.insCompany}>
                <Select value={form.insuranceCompany}
                  onChange={e => {
                    // TPA is selected independently of the company — no auto-fill.
                    setForm(f => ({
                      ...f,
                      insuranceCompany: e.target.value,
                    }));
                    loadTariffForCompany(e.target.value);
                  }}>
                  <option value="">— Select company —</option>
                  {insuranceCoList.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </Select>
              </FormField>

              {/* Tariff status banner — shows whether insurer rates were applied */}
              <div className="col-span-full">
                {tariffLoading ? (
                  <div className="text-xs text-indigo-600">Loading insurer tariff rates…</div>
                ) : form.insuranceCompany && tariffLoadedFor != null && (
                  tariffMap.size === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      No tariff rates configured for <b>{form.insuranceCompany}</b>. Services will use
                      hospital rates. Set rates under Masters → Insurance Companies → Tariff.
                    </div>
                  ) : !tariffInEffect ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      ⚠ <b>{form.insuranceCompany}</b> tariff contract does not cover the bill date ({form.date}).
                      Services will use hospital rates. Check the contract dates under
                      Masters → Insurance Companies.
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                      Insurer tariff active for <b>{form.insuranceCompany}</b>. Each service auto-fills at the
                      insurer rate where available, otherwise the hospital rate. See the note under each service.
                      {tariffAppliedCount > 0 && hospitalRateTotal !== formTotal && (
                        <> Hospital value {inr(hospitalRateTotal)} → Insurer value <b>{inr(formTotal)}</b>.</>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* TPA — standalone searchable picker (independent of company) */}
              <FormField label="TPA Name">
                <CreatableSearchSelect
                  value={form.tpaName}
                  options={tpaOptions.map(t => ({ value: t, label: t }))}
                  onChange={v => setForm(f => ({ ...f, tpaName: v }))}
                  onAdd={v => { addTpaOption(v); setForm(f => ({ ...f, tpaName: v })); }}
                  placeholder="Select TPA…"
                  searchPlaceholder="Search or type new TPA…"
                  addLabel={q => `+ Add "${q}" as new TPA`}
                  allowClear
                />
              </FormField>

              <FormField label="Policy No">
                <Input value={form.policyNo}
                  onChange={e => setForm(f => ({ ...f, policyNo: e.target.value }))}
                  placeholder="Policy / member number"/>
              </FormField>

              <FormField label="Insured Person Name">
                <Input value={form.insuredPersonName}
                  onChange={e => setForm(f => ({ ...f, insuredPersonName: e.target.value }))}
                  placeholder="Name on the policy card"/>
              </FormField>

              <FormField label="Card No">
                <Input value={form.cardNumber}
                  onChange={e => setForm(f => ({ ...f, cardNumber: e.target.value }))}
                  placeholder="Insurance card number"/>
              </FormField>
              {/* Claimed Amount input removed — the claim amount is derived
                  automatically (bill total, or the due balance for a partial
                  bill) when the claim is created. form.claimedAmount defaults
                  to 0 and the claim-creation fallback handles it. */}
            </div>
          )}
          </>)}

          {/* ─ Read-only Insurance Details (IP/BOTH edit of an insurance bill) ─
               Step 2 is hidden once an IP bill is on insurance; show the saved
               insurance details and, once the linked claim has them, the approval
               figures — all read-only (edited in the Insurance module). Only for
               a bill that is actually on insurance — a cash admission edit hides
               Step 2 entirely and shows nothing here. */}
          {hideInsuranceStep && editBill?.insurance && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Insurance Details</p>
                {linkedClaimStatus && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${linkedClaimStatus === "SETTLED"           ? "bg-emerald-100 text-emerald-700" :
                      linkedClaimStatus === "CLAIMED"           ? "bg-purple-100 text-purple-700"   :
                      linkedClaimStatus === "APPROVED"          ? "bg-sky-100 text-sky-700"         :
                      linkedClaimStatus === "DECLINED"          ? "bg-red-100 text-red-700"         :
                      linkedClaimStatus === "SENT_FOR_APPROVAL" ? "bg-yellow-100 text-yellow-700"   :
                                                                  "bg-slate-100 text-slate-700"}`}>
                    Claim: {linkedClaimStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                <div><p className="text-slate-400">Company</p><p className="font-medium text-slate-800">{form.insuranceCompany || "—"}</p></div>
                <div><p className="text-slate-400">TPA</p><p className="font-medium text-slate-800">{form.tpaName || "—"}</p></div>
                <div><p className="text-slate-400">Policy No</p><p className="font-medium text-slate-800">{form.policyNo || "—"}</p></div>
                <div><p className="text-slate-400">Insured Person</p><p className="font-medium text-slate-800">{form.insuredPersonName || "—"}</p></div>
                <div><p className="text-slate-400">Card No</p><p className="font-medium text-slate-800">{form.cardNumber || "—"}</p></div>
              </div>
              {/* Approval figures — shown once entered on the claim (Insurance module). */}
              {linkedClaimAmounts && (
                linkedClaimAmounts.authorizedAmount != null
                || linkedClaimAmounts.coPayAmount != null
                || linkedClaimAmounts.approvedAmount != null
              ) && (
                <div className="border-t border-indigo-200 pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="text-left font-semibold py-1">Authorized Amount</th>
                        <th className="text-left font-semibold py-1">Co-Payment Amount</th>
                        <th className="text-left font-semibold py-1">Claim Approved Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-800 font-medium">
                        <td className="py-1">{inr(linkedClaimAmounts.authorizedAmount ?? 0)}</td>
                        <td className="py-1">{inr(linkedClaimAmounts.coPayAmount ?? 0)}</td>
                        <td className="py-1">{inr(linkedClaimAmounts.approvedAmount ?? 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-1 text-[10px] text-slate-400">Entered in the Insurance module — read only here.</p>
                </div>
              )}
            </div>
          )}

          {/* ─ Step 3: Services ─ */}
          <SH>Step 3 — Services</SH>
          {formErr.lines && <p className="text-xs text-red-500">{formErr.lines}</p>}

          {/* Search + multi-select: type to find services and tick several to add
              them as bill lines at once (same control as the OP Token Queue modal).
              Per-line editing stays available in the table below. */}
          <div className="mb-2">
            <SearchMultiSelect
              placeholder="Search services to add…"
              emptyText="No matching service"
              options={services.map<MultiSelectOption>(s => ({
                value: s.serviceCode,
                label: s.serviceName,
                hint: inr(s.price),
                searchText: `${s.serviceName} ${s.modalityName}`.toLowerCase(),
              }))}
              selected={Array.from(new Set(form.lines
                .filter(l => l.serviceCode && services.some(s => s.serviceCode === l.serviceCode))
                .map(l => l.serviceCode)))}
              onChange={syncServicesWithSelection}
            />
          </div>

          {/* scrollable table wrapper — sits inside modal overflow-y-auto */}
          <div className="-mx-4 sm:-mx-6 overflow-x-auto">
            <div className="min-w-[700px] px-4 sm:px-6 space-y-1.5">
              {/* header */}
              <div className="grid grid-cols-[120px_130px_150px_1fr_56px_88px_80px_28px]
                gap-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <span>Date</span>
                <span>Modality</span>
                <span>Service</span>
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Total</span>
                <span/>
              </div>

              {form.lines.map(line => {
                const modSvcs = modalities.length
                  ? services.filter(s =>
                      !line.modalityName || s.modalityName === line.modalityName
                    )
                  : services;
                const insuranceRateActive =
                  form.isInsurance && tariffInEffect && !!line.serviceCode && tariffMap.has(line.serviceCode);
                const hospitalFallback =
                  form.isInsurance && tariffInEffect && !!line.serviceCode && !tariffMap.has(line.serviceCode);
                return (
                  <div key={line.key} className="space-y-0.5">
                  <div
                    className="grid grid-cols-[120px_130px_150px_1fr_56px_88px_80px_28px]
                      gap-2 items-center bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">

                    {/* service date */}
                    <input type="date" value={line.serviceDate}
                      onChange={e => updateLine(line.key, { serviceDate: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"/>

                    {/* modality */}
                    <select value={line.modalityName}
                      onChange={e => updateLine(line.key, { modalityName: e.target.value, serviceCode: "", description: "", unitPrice: 0, total: 0 })}
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs focus:outline-none focus:ring-2 focus:ring-sky-500">
                      <option value="">All Modalities</option>
                      {modalities.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                      {/* Auto-filled modality (e.g. IPD Charges / Laboratory Tests) that isn't a master option */}
                      {line.modalityName && !modalities.some(m => m.name === line.modalityName) && (
                        <option value={line.modalityName}>{line.modalityName}</option>
                      )}
                    </select>

                    {/* service */}
                    <select value={line.serviceCode}
                      onChange={e => selectService(line.key, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs focus:outline-none focus:ring-2 focus:ring-sky-500">
                      <option value="">Pick service…</option>
                      {modSvcs.map(s => (
                        <option key={s.id} value={s.serviceCode}>
                          {s.serviceName} — {inr(s.price)}
                        </option>
                      ))}
                      {/* Auto-filled ward/lab code (WARD-…/LAB###) not present in the billing-masters catalog */}
                      {line.serviceCode && !services.some(s => s.serviceCode === line.serviceCode) && (
                        <option value={line.serviceCode}>{line.serviceCode}</option>
                      )}
                    </select>

                    {/* description */}
                    <input value={line.description}
                      onChange={e => updateLine(line.key, { description: e.target.value })}
                      placeholder="Description / notes"
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"/>

                    {/* qty */}
                    <input type="text" inputMode="numeric" value={line.qtyRaw ?? String(line.quantity)}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const qty = raw === "" ? line.quantity : parseInt(raw, 10);
                        updateLine(line.key, { qtyRaw: raw, quantity: qty || 1 });
                      }}
                      onBlur={e => {
                        const qty = Math.max(1, parseInt(e.target.value) || 1);
                        updateLine(line.key, { qtyRaw: String(qty), quantity: qty });
                      }}
                      onFocus={e => e.target.select()}
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs text-center focus:outline-none focus:ring-2 focus:ring-sky-500
                        [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>

                    {/* unit price */}
                    <input type="number" min={0} value={line.unitPrice || ""}
                      onChange={e => updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                        text-xs text-right focus:outline-none focus:ring-2 focus:ring-sky-500"/>

                    {/* total */}
                    <div className="text-xs font-semibold text-slate-800 text-right tabular-nums">
                      {inr(line.total)}
                    </div>

                    {/* remove */}
                    <button type="button" onClick={() => removeLine(line.key)}
                      disabled={form.lines.length === 1}
                      className="flex items-center justify-center p-0.5 rounded text-slate-300
                        hover:text-red-500 disabled:opacity-30 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5
                            7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>

                    {/* per-line rate source note (insurance only) */}
                    {insuranceRateActive && (
                      <p className="pl-[424px] text-[11px] text-emerald-600 font-medium">
                        {line.excluded
                          ? "⚠ Not covered by insurer — patient pays"
                          : `Insurance rate (${form.insuranceCompany})`}
                      </p>
                    )}
                    {hospitalFallback && (
                      <p className="pl-[424px] text-[11px] text-amber-600 font-medium">
                        Hospital rate — no insurer tariff for this service
                      </p>
                    )}
                  </div>
                );
              })}

            <button type="button" onClick={addLine}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600
                hover:text-sky-800 transition-colors mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add another service
            </button>

            {/* Auto-fill from admission — IP patients only */}
            {(form.patientType === 'IP' || form.patientType === 'BOTH') && admissionIdForBill && (
              <div className="flex flex-col gap-1 mt-2">
                <button type="button" onClick={handlePrefill} disabled={prefilling}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-40 transition-colors">
                  {prefilling ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  )}
                  {prefilling ? 'Loading admission charges…' : 'Auto-fill from admission (ward charges + labs)'}
                </button>
                {prefillErr && <p className="text-xs text-red-500 mt-0.5">{prefillErr}</p>}
              </div>
            )}

            {/* Previously billed labs — read-only reference */}
            {prevBilledLabs.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Previously Billed (not included)</p>
                <div className="space-y-1">
                  {prevBilledLabs.map((lab, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                        {lab.investigationName} <span className="text-slate-400">({lab.labIdCode})</span>
                      </span>
                      <span className="font-medium">₹{lab.price.toLocaleString('en-IN')} — {lab.billedInBillNo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>{/* end min-w inner */}
          </div>{/* end overflow-x-auto */}

          {/* totals summary */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-1.5 items-end text-sm">
              <TotalRow label="Subtotal" value={inr(formSubtotal)} />
              {/* Overall (bill-level) discount — editable */}
              <div className="flex items-center justify-between gap-3 w-full max-w-xs">
                <span className="text-slate-500">Discount (overall)</span>
                <input type="number" min={0} max={formSubtotal} value={form.overallDiscount || ""}
                  onChange={e => setForm(f => ({ ...f, overallDiscount: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-28 px-2 py-1 rounded-md border border-slate-200 bg-white
                    text-xs text-right focus:outline-none focus:ring-2 focus:ring-sky-500"/>
              </div>
              <TotalRow label="Net Total" value={inr(formTotal)} bold />
            </div>
          </div>

          {/* ─ Receipts & Payments ledger + Generate (IP / BOTH) ─ */}
          {showLedger && editBill && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Receipts &amp; Payments collected
                </p>
              </div>
              {ledgerReceipts.length === 0 && ledgerExternal.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No receipts or payments collected yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 text-slate-400">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Date</th>
                      <th className="text-left font-semibold px-3 py-2">Receipt No / Source</th>
                      <th className="text-left font-semibold px-3 py-2">Type</th>
                      <th className="text-left font-semibold px-3 py-2">Mode</th>
                      <th className="text-right font-semibold px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerReceipts.map(r => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{r.receiptNo ?? "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.receiptType ?? "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.paymentMode}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${r.amount < 0 ? "text-red-600" : "text-slate-700"}`}>
                          {inr(r.amount)}
                        </td>
                      </tr>
                    ))}
                    {ledgerExternal.map(r => (
                      <tr key={r.key} className="border-b border-slate-50 bg-amber-50/40">
                        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.source}</td>
                        <td className="px-3 py-1.5 text-slate-500">Bill Payment</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.mode}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700">{inr(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Paid / Outstanding summary */}
              <div className="border-t border-slate-200 px-4 py-3 flex flex-col items-end gap-1 text-sm">
                {form.isInsurance && linkedClaimStatus !== "SETTLED" && closeApproved > 0 ? (
                  // ── Insurance, NOT yet settled ──────────────────────────────
                  // Show the waterfall so the patient's share is explicit and
                  // the final figure matches the close dialog. The insurer's
                  // approved amount is a pending deduction (receivable), not yet
                  // collected. patient share = bill − approved;
                  // patient net = share − patient-only paid.
                  <>
                    <TotalRow label="Net Bill" value={inr(formTotal)} />
                    <TotalRow label="Less: Insurance Approved" value={`- ${inr(closeApproved)}`} />
                    <TotalRow label="Patient Share" value={inr(Math.max(0, formTotal - closeApproved))} />
                    <TotalRow label="Patient Paid" value={`- ${inr(ledgerPatientPaidTotal)}`} />
                    {closePatientNet < 0 ? (
                      <TotalRow label="Refund Due to Patient" value={inr(Math.abs(closePatientNet))} bold red />
                    ) : closePatientNet > 0 ? (
                      <TotalRow label="Patient Balance Due" value={inr(closePatientNet)} bold red />
                    ) : (
                      <TotalRow label="Patient Share Settled" value={inr(0)} bold />
                    )}
                  </>
                ) : form.isInsurance && linkedClaimStatus === "SETTLED" ? (
                  // ── Insurance, SETTLED ──────────────────────────────────────
                  // The insurer money is now a real receipt in the ledger, so
                  // show it as collected (patient + insurer), not as a pending
                  // deduction. ledgerPaidTotal already includes the settlement.
                  <>
                    <TotalRow label="Net Bill" value={inr(formTotal)} />
                    <TotalRow label="Paid (patient + insurer)" value={inr(ledgerPaidTotal)} />
                    {ledgerRefundDue > 0 ? (
                      <TotalRow label="Refund due" value={inr(ledgerRefundDue)} bold red />
                    ) : (
                      <TotalRow label="Outstanding" value={inr(ledgerOutstanding)} bold red={ledgerOutstanding > 0} />
                    )}
                  </>
                ) : (
                  // ── Cash bill (unchanged) ───────────────────────────────────
                  <>
                    <TotalRow label="Net Bill" value={inr(formTotal)} />
                    <TotalRow label="Paid (receipts + bills)" value={inr(ledgerPaidTotal)} />
                    {ledgerRefundDue > 0 ? (
                      <TotalRow label="Refund due" value={inr(ledgerRefundDue)} bold red />
                    ) : (
                      <TotalRow label="Outstanding" value={inr(ledgerOutstanding)} bold red={ledgerOutstanding > 0} />
                    )}
                  </>
                )}
              </div>
              {/* Generate — tick the documents, then Generate Selected */}
              <div className="border-t border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-400">
                  The final <strong>Split-up</strong>, <strong>Cumulative</strong> and{" "}
                  <strong>Summary</strong> bills are generated from the{" "}
                  <strong>Patient Bills</strong> page (they are print views of this bill —
                  the discount and discharge date set here drive them).
                </p>
              </div>
            </div>
          )}

          {/* ─ Step 4: Payment ─ (hidden for IP/BOTH — collected via Collect Cash) */}
          {!isIp && (<>
          <SH>Step 4 — Payment</SH>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Payment Mode">
              <Select value={form.paymentMode}
                onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value as PayModeUI }))}>
                {(editBill ? PAY_MODES.map(m => ({ value: m.value as PayModeUI, label: m.label })) : PAY_MODES_UI)
                  .map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
            {form.paymentMode !== "CASH" && form.paymentMode !== "MIXED" && (
              <FormField label="Cheque / UTR / Ref No">
                <Input value={form.referenceNo}
                  onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))}
                  placeholder="Reference number"/>
              </FormField>
            )}
            {!editBill && form.paymentMode !== "MIXED" && (
              <FormField label="Amount Paid Now (₹)">
                <Input type="number" min={0} value={form.amountPaid || ""}
                  onChange={e => setForm(f => ({ ...f, amountPaid: Math.min(Number(e.target.value), formTotal) }))}
                  placeholder={`0 – ${formTotal}`}/>
                <p className="text-xs text-slate-400 mt-1">
                  Leave 0 to save as Pending · Enter full amount for Paid
                </p>
              </FormField>
            )}
            {editBill && (
              <div className="sm:col-span-2 flex items-start gap-2 bg-amber-50 border border-amber-200
                rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>
                  To collect payment, close this dialog and use the{" "}
                  <strong>Pay</strong> button on the bill row.
                  Payment amount entered here is not applied on edits.
                </span>
              </div>
            )}
          </div>

          {/* Split payment editor — new bill + Mixed mode */}
          {!editBill && form.paymentMode === "MIXED" && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Split Payment</p>
                <button type="button" onClick={addFormSplit} className="text-xs text-sky-600 hover:text-sky-800 font-medium">+ Add split</button>
              </div>
              {form.paymentSplits.map((sp, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select value={sp.mode} onChange={e => updateFormSplit(i, "mode", e.target.value as PaymentModeB)} className="w-28 flex-shrink-0">
                    {SPLIT_MODES.map(m => <option key={m} value={m}>{payModeLabel(m)}</option>)}
                  </Select>
                  <Input type="number" min={0} value={sp.amount || ""} placeholder="Amount (₹)" className="w-28 flex-shrink-0"
                    onChange={e => updateFormSplit(i, "amount", parseFloat(e.target.value) || 0)} />
                  {sp.mode !== "CASH" && (
                    <Input value={sp.ref} placeholder="Reference no (optional)" className="flex-1 min-w-[120px]"
                      onChange={e => updateFormSplit(i, "ref", e.target.value)} />
                  )}
                  <button type="button" onClick={() => removeFormSplit(i)}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 ml-auto">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <p className="text-xs text-right text-slate-600">
                Split total: <span className="font-semibold text-slate-800">{inr(splitSum(form.paymentSplits))}</span>
                {splitSum(form.paymentSplits) > formTotal && <span className="text-red-500 ml-2">exceeds bill total</span>}
              </p>
            </div>
          )}
          </>)}

        </div>
      </Modal>

      {/* ── COLLECT CASH (advance / settlement / refund receipt) ── */}
      <CollectCashModal
        open={!!collectPatient}
        onClose={() => setCollectPatient(null)}
        patient={collectPatient}
        receivedBy={userName}
        initialReceiptType={collectReceiptType}
        onSaved={() => {
          reloadAfterMutation();
        }}
      />

      {/* ── CLOSE BILL CONFIRM ── */}
      <Modal open={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)}
        title="Close Bill" size="sm"
        footer={
          <>
            <button onClick={() => setCloseConfirmOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleCloseBill} disabled={closeBlocked}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg
                disabled:opacity-50 disabled:cursor-not-allowed">
              Close Bill
            </button>
          </>
        }>
        <div className="space-y-3 text-sm text-slate-600">
          {closeIsInsurance ? (
            // ── Insurance bill: patient-share + insurer-receivable aware ──
            closePatientNet > 0 ? (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
                Patient balance of <strong>{inr(closePatientNet)}</strong> is still due
                (Bill {inr(formTotal)} − Insurance approved {inr(closeApproved)} − Patient paid {inr(ledgerPatientPaidTotal)}).
                Collect it via <strong>Collect Cash</strong> before closing.
              </p>
            ) : closePatientNet < 0 ? (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
                A refund of <strong>{inr(Math.abs(closePatientNet))}</strong> is due to the patient
                (advance exceeds the patient&apos;s share after insurance approval).
                Record it via <strong>Collect Cash → Refund</strong> before closing.
              </p>
            ) : closeApproved > 0 ? (
              <>
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                  Patient&apos;s share is settled. The insurer&apos;s approved <strong>{inr(closeApproved)}</strong> stays
                  as an <strong>outstanding receivable</strong> on this bill until the insurer pays — it is booked as
                  revenue on the <strong>settlement day</strong> (claim → <strong>Settled</strong>), not now.
                </p>
                <p>Closing finalises the patient&apos;s share and lets the patient be discharged. The bill stays
                  <strong> Partial</strong> until the insurer settlement is recorded. This <strong>cannot be undone</strong>.</p>
              </>
            ) : (
              <>
                <p>Closing this bill marks it <strong>Paid</strong> and finalises it. This <strong>cannot be undone</strong>.</p>
                <p>After closing, the patient&apos;s Discharge Summary becomes available in the case sheet. Discharge is not triggered automatically.</p>
              </>
            )
          ) : closeCashNet > 0 ? (
            // ── Cash bill: full balance must be cleared ──
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
              This bill still has an outstanding balance of <strong>{inr(closeCashNet)}</strong>.
              Collect the balance using <strong>Collect Cash</strong> first — a bill can only be closed
              once it is fully paid.
            </p>
          ) : closeCashNet < 0 ? (
            // ── Cash bill: patient overpaid → refund the excess before closing ──
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
              A refund of <strong>{inr(Math.abs(closeCashNet))}</strong> is due to the patient
              (collected {inr(ledgerPaidTotal)} against a bill of {inr(formTotal)}).
              Record it via <strong>Collect Cash → Refund</strong> before closing.
            </p>
          ) : (
            <>
              <p>Closing this bill marks it <strong>Paid</strong> and finalises it. This <strong>cannot be undone</strong>.</p>
              <p>After closing, the patient&apos;s Discharge Summary becomes available in the case sheet. Discharge is not triggered automatically.</p>
            </>
          )}
          {genErr && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">{genErr}</p>
          )}
        </div>
      </Modal>

      {/* ── CANCEL MODAL ── */}
      <Modal open={!!cancelBill_} onClose={() => setCancelBill_(null)}
        title={`Cancel Bill — ${cancelBill_?.billNo ?? ""}`} size="sm"
        footer={
          <>
            <button onClick={() => setCancelBill_(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Back</button>
            <button onClick={handleCancel}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600
                text-white font-medium rounded-lg">Cancel Bill</button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Cancelling <span className="font-semibold">{cancelBill_?.billNo}</span> for{" "}
            <span className="font-semibold">{cancelBill_?.patientName}</span>. This cannot be undone.
          </p>
          {(cancelBill_?.paidAmount ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠ ₹{(cancelBill_?.paidAmount ?? 0).toLocaleString("en-IN")} already collected.
              Refund must be processed separately.
            </div>
          )}
          {cancelErr && <p className="text-xs text-red-500">{cancelErr}</p>}
          <FormField label="Cancellation Reason" required>
            <Textarea value={cancelReason}
              onChange={e => { setCancelReason(e.target.value); setCancelErr(""); }}
              placeholder="Reason for cancellation…" rows={3}/>
          </FormField>
        </div>
      </Modal>

      {/* ── VIEW / PRINT MODAL ── */}
      <Modal open={!!viewBill} onClose={() => setViewBill(null)}
        title={`Bill — ${viewBill?.billNo ?? ""}`} size="xl"
        footer={
          <>
            <button onClick={() => setViewBill(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Close</button>
            {viewBill && viewBill.insurance && viewBill.insuranceStatus === "SETTLED"
              && viewBill.status === "PAID" && (
              // Confirm & Print — highlighted CTA for insurance-settled bills awaiting receptionist confirmation
              <button onClick={() => { handlePrint(viewBill, true); setViewBill(null); }}
                className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium
                  rounded-lg inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Confirm &amp; Print Receipt
              </button>
            )}
            {viewBill && (
              <button onClick={() => handlePrint(viewBill, true)}
                className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg
                  inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0
                      002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0
                      002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                Print Bill
              </button>
            )}
          </>
        }>
        {viewBill && (
          <div className="print-bill space-y-5 text-sm">
            {/* hospital header */}
            <div className="flex items-center justify-between border-b pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/sen-logo.png" alt="Sen Hospital" className="h-14 w-auto object-contain" />
              <div className="text-center flex-1 px-3">
                <h1 className="text-lg font-bold text-[#242445]" style={{fontFamily:"Georgia, serif"}}>SEN HOSPITAL</h1>
                <p className="text-xs font-semibold text-[#242445]">MULTI - SPECIALITY CENTRE</p>
                <p className="text-xs text-slate-500 mt-0.5">New No.51, Old No. 18, Bunder Garden Street, Perambur, Chennai - 11.</p>
                <p className="text-xs text-slate-500">Tel: 25586896, 42769724 · Cell: 9600899382, 7200207833</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/nabh-seal.png" alt="NABH" className="h-14 w-auto object-contain" />
            </div>

            {/* bill meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Patient</p>
                <p className="font-bold text-slate-900">{viewBill.patientName}</p>
                <p className="text-xs text-slate-500">{viewBill.uhid} · {viewBill.age}y · {viewBill.gender}</p>
                <p className="text-xs text-slate-500">{viewBill.phone}</p>
                {viewBill.patientType === "IP" && (
                  <p className="text-xs text-slate-500">
                    Ward: {viewBill.ward} / Bed: {viewBill.bedNumber}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Bill Info</p>
                <p className="font-bold text-sky-600 text-lg">{viewBill.billNo}</p>
                <p className="text-xs text-slate-500">Date: {viewBill.date}</p>
                {viewBill.admissionId && (
                  <p className="text-xs text-slate-500">Admission: IP/ADM/{viewBill.admissionId}</p>
                )}
                <p className="text-xs text-slate-500">Doctor: {viewBill.doctorName}</p>
                <p className="text-xs text-slate-500">Dept: {viewBill.department}</p>
                <Badge label={viewBill.status} variant={STATUS_COLORS[viewBill.status]} dot />
              </div>
            </div>

            {/* line items table */}
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  {["#","Modality","Service / Description","Qty","Unit Price","Disc","Total"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold
                      text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewBill.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{it.modalityName ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{it.description}</td>
                    <td className="px-3 py-2 text-center">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">{inr(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right text-red-500">
                      {it.discount > 0 ? `- ${inr(it.discount)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <TotalRow label="Subtotal"         value={inr(viewBill.subtotal)} />
                {viewBill.totalDiscount > 0 &&
                  <TotalRow label="Total Discount" value={`- ${inr(viewBill.totalDiscount)}`} red />}
                <TotalRow label="Net Total"        value={inr(viewBill.totalAmount)} bold />
                <div className="border-t border-slate-200 pt-1">
                  <TotalRow label="Amount Paid"   value={inr(viewBill.paidAmount)} />
                  <TotalRow label="Balance Due"   value={inr(viewBill.dueAmount)} red={viewBill.dueAmount > 0} />
                </div>
              </div>
            </div>

            {/* insurance info */}
            {viewBill.insurance && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-indigo-800 mb-1">🛡 Insurance Details</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <InfoPair label="Company"  value={viewBill.insuranceCompany ?? "—"} />
                  <InfoPair label="Policy"   value={viewBill.policyNo ?? "—"} />
                  <InfoPair label="Claimed"  value={inr(viewBill.claimedAmount ?? 0)} />
                  <InfoPair label="Ins.Paid" value={inr(viewBill.insurancePaidAmount ?? 0)} />
                </div>
                {viewBill.insuranceRemarks && (
                  <p className="text-xs text-indigo-600 mt-1">{viewBill.insuranceRemarks}</p>
                )}
              </div>
            )}

            {/* payment history */}
            {viewBill.payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Payment History</p>
                <div className="space-y-1">
                  {groupPayments(viewBill.payments).map(g => (
                    <div key={g.key} className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                      {g.records.length === 1 ? (
                        /* Single-mode payment */
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">
                            {g.date} · {g.records[0].paymentMode}
                            {g.records[0].referenceNo && ` · ${g.records[0].referenceNo}`}
                            {g.receivedBy && ` · Recv: ${g.receivedBy}`}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-700">{inr(g.total)}</span>
                            <button onClick={() => printOneReceipt(viewBill, g.records[0])}
                              title="Print payment receipt"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                text-[11px] font-semibold text-sky-600 bg-sky-50
                                hover:bg-sky-100 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                              </svg>
                              Receipt
                            </button>
                          </span>
                        </div>
                      ) : (
                        /* Split payment — header with total + breakdown rows */
                        <>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-slate-700 font-medium">
                              {g.date} · Split Payment
                              {g.receivedBy && ` · Recv: ${g.receivedBy}`}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-emerald-700">{inr(g.total)}</span>
                              <button
                                onClick={() => {
                                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                                  const priorPayments = (viewBill.payments ?? [])
                                    .filter(r => r.transactionGroupId !== g.records[0].transactionGroupId)
                                    .map(r => ({ date: r.date, amount: r.amount, paymentMode: r.paymentMode, referenceNo: r.referenceNo, transactionGroupId: r.transactionGroupId }));
                                  const html = g.records
                                    .map(r => buildPaymentReceiptHtml(
                                      { id: r.id, date: r.date, amount: r.amount, paymentMode: r.paymentMode, referenceNo: r.referenceNo, receivedBy: r.receivedBy },
                                      { billNo: viewBill.billNo, patientName: viewBill.patientName, uhid: viewBill.uhid, patientType: viewBill.patientType, age: viewBill.age, gender: viewBill.gender, phone: viewBill.phone, ward: viewBill.ward, bedNumber: viewBill.bedNumber, admissionNo: null, doctorName: viewBill.doctorName, totalAmount: viewBill.totalAmount, paidAmount: viewBill.paidAmount, dueAmount: viewBill.dueAmount, priorPayments },
                                      origin,
                                    ))
                                    .join('<div style="page-break-before:always"></div>');
                                  printHtml(html);
                                }}
                                title="Print all split receipts"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                  text-[11px] font-semibold text-sky-600 bg-sky-50
                                  hover:bg-sky-100 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                </svg>
                                Receipt
                              </button>
                            </span>
                          </div>
                          <div className="pl-3 space-y-0.5 border-l-2 border-emerald-100">
                            {g.records.map(r => (
                              <div key={r.id} className="flex justify-between text-slate-500 text-[11px]">
                                <span>{r.paymentMode}{r.referenceNo ? ` · ${r.referenceNo}` : ""}</span>
                                <span>{inr(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* footer */}
            <div className="text-center text-xs text-slate-400 border-t pt-3">
              Thank you for choosing MediCare HMS · This is a computer-generated bill
            </div>
          </div>
        )}
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

function DropFilter({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void;
  label: string; options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-slate-700 focus:outline-none focus:ring-2
          focus:ring-sky-500 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
        w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
      </svg>
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

function TotalRow({ label, value, bold, red }: {
  label: string; value: string; bold?: boolean; red?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-bold text-slate-900" : "font-medium"} ${red ? "text-red-600" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
