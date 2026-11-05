"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "../../_lib/auth";
import { buildOPBillHtml, type OPBillData } from "../../_lib/op-bill";
import { buildOPRegistrationSlipHtml } from "../../_lib/op-slip";
import { printHtml } from "../../_lib/print";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import SearchMultiSelect, { type MultiSelectOption } from "../../_components/SearchMultiSelect";
import HScrollArea from "../../_components/HScrollArea";

// ─── Backend types ────────────────────────────────────────────────────────────
type OPVisitStatusB = "WAITING" | "IN_CONSULTATION" | "CONSULTATION_DONE" | "BILLED" | "PAID";
type OPVisitTypeB   = "NEW" | "REVIEW" | "FOLLOW_UP";
type PaymentModeB   = "CASH" | "CARD" | "CREDIT_CARD" | "DEBIT_CARD" | "UPI" | "CHEQUE" | "INSURANCE";
type RegTypeB       = "CONSULTATION" | "XRAY" | "SCAN" | "REVIEW" | "PHYSIOTHERAPY" | "OTHERS";

// Reg Type options + the token prefix each one produces (matches backend RegType enum)
const REG_TYPE_OPTS: { value: RegTypeB; label: string; prefix: string }[] = [
  { value: "CONSULTATION",  label: "Consultation",  prefix: "CON" },
  { value: "XRAY",          label: "X-Ray",         prefix: "XRA" },
  { value: "SCAN",          label: "Scan",          prefix: "SCA" },
  { value: "REVIEW",        label: "Review",        prefix: "REV" },
  { value: "PHYSIOTHERAPY", label: "Physiotherapy", prefix: "PHY" },
  { value: "OTHERS",        label: "Others",        prefix: "OTH" },
];

interface ServiceOption {
  id:              number;
  serviceCode:     string;
  serviceName:     string;
  modalityName:    string;
  price:           number;
  discountAllowed: boolean;
}

interface BillLineItem {
  key:             string;
  serviceCode:     string;
  modalityName:    string;
  description:     string;
  quantity:        number;
  qtyRaw?:         string;   // raw string for the qty input (allows empty mid-edit)
  unitPrice:       number;
  discount:        number;
  discountAllowed: boolean;
  total:           number;
  isConsult?:      boolean;  // true → this is the OP Consultation Charges line
  consultType?:    string;   // "Chief Doctor Consultation" | "Duty Doctor Consultation"
}

// OP consultation line display text + the two consultation-type options the
// receptionist can pick from the Description dropdown.
const OP_CONSULT_LABEL = "OP Consultation Charges";
const OP_CONSULT_TYPES = ["Chief Doctor Consultation", "Duty Doctor Consultation"];

/** Final description printed on the bill for a consultation line. */
function consultDescription(consultType?: string): string {
  return consultType ? `${OP_CONSULT_LABEL} — ${consultType}` : OP_CONSULT_LABEL;
}

function newBillLine(): BillLineItem {
  return {
    key: `line_${Date.now()}_${Math.random()}`,
    serviceCode: "", modalityName: "", description: "",
    quantity: 1, qtyRaw: "1", unitPrice: 0, discount: 0, discountAllowed: true, total: 0,
  };
}

/**
 * Split a single bill-level (overall) discount across the given line gross
 * amounts, proportionally to each line's share of the gross subtotal. The last
 * non-zero line absorbs any rounding remainder so the parts sum back to the
 * overall discount exactly. Returns the per-line discount amount in input order.
 */
function distributeDiscount(grossPerLine: number[], overall: number): number[] {
  const subtotal = grossPerLine.reduce((s, g) => s + g, 0);
  const capped   = Math.max(0, Math.min(overall, subtotal));
  if (capped <= 0 || subtotal <= 0) return grossPerLine.map(() => 0);

  const parts = grossPerLine.map(g => Math.round((g / subtotal) * capped));
  // Fix rounding drift on the last line that carries a gross amount.
  const drift = capped - parts.reduce((s, p) => s + p, 0);
  for (let i = grossPerLine.length - 1; i >= 0 && drift !== 0; i--) {
    if (grossPerLine[i] > 0) { parts[i] += drift; break; }
  }
  return parts;
}

function calcLineTotal(qty: number, price: number, disc: number) {
  return Math.max(0, qty * price - disc);
}

/** Human-readable payment mode label (CREDIT_CARD → "Credit Card"). */
function payModeLabel_(mode?: string): string {
  const map: Record<string, string> = {
    CASH: "Cash", CARD: "Card", CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
    UPI: "UPI", CHEQUE: "Cheque", INSURANCE: "Insurance",
  };
  if (!mode) return "";
  return map[mode] ?? mode;
}

// Find the "consultation" billing service to auto-select on the OP bill.
// The upfront OP charge is always a consultation fee, so we prioritise the
// actual Consultation-charge service over any other service that merely sits in
// the OPD/Consultation modality (e.g. "General Hospital Registration").
function findConsultationService(services: ServiceOption[]): ServiceOption | null {
  const name = (s: ServiceOption) => (s.serviceName ?? "").toLowerCase();
  const modality = (s: ServiceOption) => (s.modalityName ?? "").toLowerCase();

  // 1) Strongest: the service NAME says it is a consultation / consultant charge.
  //    (e.g. "OP Doctor Charges", "Chief Doctor Charges", "Consultant Charges")
  const byName =
    services.find(s => /consultation|consultant/.test(name(s))) ??
    services.find(s => /\b(doctor|consult)\b.*charge/.test(name(s))) ??
    services.find(s => /\bconsult/.test(name(s)));
  if (byName) return byName;

  // 2) Next: a service whose MODALITY is the Consultation modality, but skip
  //    non-consultation entries like registration fees.
  const consultModality = services.filter(s => /consult/.test(modality(s)));
  const byModality =
    consultModality.find(s => /doctor|consult|opd?\b/.test(name(s))) ??
    consultModality.find(s => !/regist/.test(name(s))) ??
    consultModality[0];
  if (byModality) return byModality;

  return null;
}

interface OPVisitResponse {
  id: number;
  visitNo: string;
  tokenNo: string;
  patientId: string | null;
  uhid: string;
  patientName: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  doctorId: string;
  doctorName: string;
  department: string | null;
  visitDate: string;   // "YYYY-MM-DD"
  visitTime: string | null;
  type: OPVisitTypeB;
  regType: RegTypeB | null;
  status: OPVisitStatusB;
  chiefComplaint: string;
  billId: string | null;
  free?: boolean;
  consultationAmount?: number | null;
  discountAmount?: number | null;
  paidAmount?: number | null;
  paymentSplitsJson?: string | null;
  referredBy: string | null;
  registrationSource: "ML" | "VS" | null;
  address1: string | null;
  address2: string | null;
  area: string | null;
  district: string | null;
  pincode: string | null;
  state: string | null;
  maritalStatus: string | null;
  religion: string | null;
  bloodGroup: string | null;
  email: string | null;
  aadhaarNo: string | null;
  paymentType: string | null;
  companyTpa: string | null;
  createdAt: string | null;
}

interface QueueStatsResponse {
  total: number;
  waiting: number;
  inConsultation: number;
  consultationDone: number;
  billed: number;
  paid: number;
}

interface DoctorOption {
  id: number;
  name: string;
  department: string | null;
  qualification: string | null;   // e.g. "MBBS, MD" — shown in the picker
  opdFee: number | null;          // doctor's OPD consulting fee (auto-filled on billing)
}

interface PatientOption {
  id: number;
  uhid: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  /** True when the patient has an active (non-discharged) admission — derived
   *  from the list endpoint's currentEpisode (kind === "IP"), i.e. the same
   *  active-admission source the backend guard uses. */
  admitted: boolean;
}

interface ReferrerOption {
  id: number;
  name: string;
  specialization: string | null;
}

// ─── Status / type display maps ───────────────────────────────────────────────
const STATUS_LABEL: Record<OPVisitStatusB, string> = {
  WAITING:           "Waiting",
  IN_CONSULTATION:   "In Consultation",
  CONSULTATION_DONE: "Consultation Done",
  BILLED:            "Billed",
  PAID:              "Paid",
};

const STATUS_COLORS: Record<OPVisitStatusB, string> = {
  WAITING:           "bg-amber-100 text-amber-700",
  IN_CONSULTATION:   "bg-sky-100 text-sky-700",
  CONSULTATION_DONE: "bg-emerald-100 text-emerald-700",
  BILLED:            "bg-indigo-100 text-indigo-700",
  PAID:              "bg-green-100 text-green-700",
};

const STATUS_NEXT: Record<OPVisitStatusB, OPVisitStatusB | null> = {
  // Per Sen Hospital: the "In Consultation" step is skipped — a waiting patient
  // moves straight to "Consultation Done", then to billing. IN_CONSULTATION is
  // kept as a valid status for any legacy rows but is no longer a target step.
  WAITING:           "CONSULTATION_DONE",
  IN_CONSULTATION:   "CONSULTATION_DONE",
  CONSULTATION_DONE: "BILLED",
  BILLED:            "PAID",
  PAID:              null,
};

const TYPE_LABEL: Record<OPVisitTypeB, string> = {
  NEW:       "New",
  REVIEW:    "Review",
  FOLLOW_UP: "Follow-up",
};

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Today's date ─────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

// ─── Patient-master enum ⇄ display-string mapping ──────────────────────────────
// The patient record stores bloodGroup / maritalStatus as enums (A_POSITIVE,
// SINGLE…) while the OP form uses display strings (A+, Single). These convert
// between the two so pre-filled values match the form's option lists.
const BLOOD_ENUM_TO_DISPLAY: Record<string, string> = {
  A_POSITIVE: "A+", A_NEGATIVE: "A-", B_POSITIVE: "B+", B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+", AB_NEGATIVE: "AB-", O_POSITIVE: "O+", O_NEGATIVE: "O-",
};
const MARITAL_ENUM_TO_DISPLAY: Record<string, string> = {
  SINGLE: "Single", MARRIED: "Married", WIDOWED: "Widowed", DIVORCED: "Divorced",
};
function bloodEnumToDisplay(v?: string | null): string {
  return v ? (BLOOD_ENUM_TO_DISPLAY[v] ?? "") : "";
}
function maritalEnumToDisplay(v?: string | null): string {
  return v ? (MARITAL_ENUM_TO_DISPLAY[v] ?? "") : "";
}

// Demographic keys that live on the patient master and therefore get locked
// (read-only) when already present on the record.
type LockableDemoKey =
  | "address1" | "area" | "district" | "pincode" | "state"
  | "maritalStatus" | "religion" | "bloodGroup" | "email";

// ─── Age from DOB ─────────────────────────────────────────────────────────────
function calcAgeFromDob(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

// ─── Searchable single-select dropdown ────────────────────────────────────────
interface SearchSelectOption { value: string; label: string; sublabel?: string }

function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No matches",
}: {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [query, options]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && boxRef.current) {
              const rect = boxRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              // Estimated dropdown height (search box + list). Flip up when
              // there isn't enough room below but there is more room above.
              const estHeight = 300;
              setDropUp(spaceBelow < estHeight && spaceAbove > spaceBelow);
            }
            return next;
          });
          setQuery("");
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <span className={selected ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden
          ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">{emptyText}</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors
                    ${o.value === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}
                >
                  {o.label}
                  {o.sublabel && <span className="block text-xs text-slate-400">{o.sublabel}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Creatable searchable dropdown ────────────────────────────────────────────
// Like SearchSelect but with an "Add new" row when the query doesn't match any
// existing option. Calls onAdd(trimmedQuery) so the parent can persist the new
// value and add it to the list.
function CreatableSearchSelect({
  value,
  options,
  onChange,
  onAdd,
  placeholder = "Select or type to add…",
  searchPlaceholder = "Type to search or add…",
  addLabel = (q: string) => `+ Add "${q}"`,
}: {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  onAdd: (newValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  addLabel?: (q: string) => string;
}) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const trimmedQuery   = query.trim();
  const exactMatch     = trimmedQuery !== "" &&
    options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());
  const showAddRow     = trimmedQuery !== "" && !exactMatch;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && boxRef.current) {
              const rect = boxRef.current.getBoundingClientRect();
              setDropUp(window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom);
            }
            return next;
          });
          setQuery("");
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <span className={selected ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {selected ? selected.label : (value || placeholder)}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden
          ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !showAddRow && (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors
                    ${o.value === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {showAddRow && (
              <li>
                <button
                  type="button"
                  onClick={() => { onAdd(trimmedQuery); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 text-sm text-sky-600 font-medium hover:bg-sky-50 transition-colors border-t border-slate-100"
                >
                  {addLabel(trimmedQuery)}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyRefForm() {
  return {
    name:           "",
    type:           "DOCTOR" as "DOCTOR" | "HOSPITAL" | "CLINIC" | "INDIVIDUAL" | "OTHER",
    specialization: "",
    organization:   "",
    phone:          "",
    alternatePhone: "",
    address:        "",
    notes:          "",
  };
}

// Default appointment time: current time + 15 minutes, rounded UP to the next
// quarter hour (00/15/30/45). e.g. 9:23 → 9:38 → 9:45; 9:28 → 9:43 → 9:45.
// The receptionist can still increase it manually in the form.
function defaultAppointmentTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  const rounded = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(rounded, 0, 0); // handles roll-over past 60 into the next hour
  return d.toTimeString().slice(0, 5);
}

function emptyVisitForm() {
  const now = defaultAppointmentTime();
  return {
    uhid:          "",
    patientName:   "",
    dob:           "",
    age:           0,
    gender:        "Male",
    phone:         "",
    doctorId:      "",
    doctorName:    "",
    department:    "",
    type:          "NEW" as OPVisitTypeB,
    regType:       "CONSULTATION" as RegTypeB,
    chiefComplaint: "",
    visitTime:     now,
    isNewPatient:  true,
    freePatient:   false,
    referredBy:    "",
    // ── Extended demographics (right column of the OP registration screen) ──
    address1:      "",
    address2:      "",
    area:          "",
    district:      "",
    pincode:       "",
    state:         "TAMILNADU",
    maritalStatus: "",
    religion:      "",
    bloodGroup:    "",
    email:         "",
    aadhaarNo:     "",
    companyTpa:    "",
    // ── Token-time payment ──
    amountToPay:   0,            // auto-filled from the doctor's OPD fee; editable
    useSplit:      false,        // true → collect across multiple modes
    tokenSplits:   [{ key: "tpay_0", mode: "CASH" as PaymentModeB, amount: 0, ref: "" }],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OPVisitsPage() {
  const session = getSession();
  const role    = session?.role ?? "Receptionist";
  const router  = useRouter();

  const [visits,      setVisits]      = useState<OPVisitResponse[]>([]);
  const [stats,       setStats]       = useState<QueueStatsResponse | null>(null);
  const [doctors,     setDoctors]     = useState<DoctorOption[]>([]);
  const [referrers,   setReferrers]   = useState<ReferrerOption[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchErr,    setFetchErr]    = useState("");

  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRegType, setFilterRegType] = useState("");
  const [filterSource,  setFilterSource]  = useState(""); // "", "VS" (self), "ML" (staff)
  const [date,         setDate]         = useState(TODAY);

  // Add visit modal
  const [modalOpen,     setModalOpen]     = useState(false);
  const [form,          setForm]          = useState(emptyVisitForm());
  const [uhidSearch,    setUhidSearch]    = useState("");
  const [patientOpts,   setPatientOpts]   = useState<PatientOption[]>([]);
  const [foundPatient,  setFoundPatient]  = useState<PatientOption | null>(null);
  // Which demographic fields are already filled on the selected existing
  // patient's record. These render read-only; empty ones stay editable so the
  // receptionist can fill gaps (which then back-fill the patient master).
  const [lockedDemoFields, setLockedDemoFields] = useState<Set<LockableDemoKey>>(new Set());
  const [uhidNotFound,  setUhidNotFound]  = useState(false);
  const [patSearching,  setPatSearching]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saveErr,       setSaveErr]       = useState("");
  const [advancingId,   setAdvancingId]   = useState<number | null>(null);

  // Area / district suggestions seeded from the database (distinct values already recorded)
  const [customAreas,     setCustomAreas]     = useState<string[]>([]);
  const [customDistricts, setCustomDistricts] = useState<string[]>([]);

  // Inline "Add Referrer" mini-modal (opened from within the OP token modal)
  const [refModalOpen,  setRefModalOpen]  = useState(false);
  const [refForm,       setRefForm]       = useState(emptyRefForm());
  const [refSaving,     setRefSaving]     = useState(false);
  const [refErr,        setRefErr]        = useState("");

  // Bill modal (craft bill inline from CONSULTATION_DONE)
  const [billVisit,      setBillVisit]      = useState<OPVisitResponse | null>(null);
  const [services,       setServices]       = useState<ServiceOption[]>([]);
  const [billLines,      setBillLines]      = useState<BillLineItem[]>([newBillLine()]);
  // Overall (bill-level) discount applied to the whole OP bill, in ₹.
  const [overallDiscount, setOverallDiscount] = useState(0);
  // Split payments — each row is { mode, amount, ref }
  const [splitPayments,  setSplitPayments]  = useState<{ key: string; mode: PaymentModeB; amount: number; ref: string }[]>(
    [{ key: "pay_0", mode: "CASH", amount: 0, ref: "" }]
  );
  const [billSaving,     setBillSaving]     = useState(false);
  const [billErr,        setBillErr]        = useState("");

  // ── Derived bill math (shared by the modal body + the Save button footer) ──
  // Net = gross subtotal − overall discount; what the patient actually pays.
  const billNet = useMemo(() => {
    const subTotal = billLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const disc     = Math.max(0, Math.min(overallDiscount, subTotal));
    return Math.max(0, subTotal - disc);
  }, [billLines, overallDiscount]);
  // Amount entered across the payment rows (token advance + any fresh cash).
  const billPaidNow = useMemo(
    () => splitPayments.reduce((s, p) => s + p.amount, 0),
    [splitPayments],
  );
  // Outstanding balance after what's been collected. OP bills are pay-at-counter,
  // so a positive balance blocks saving.
  const billBalanceDue = Math.max(0, billNet - billPaidNow);
  // Amount already collected from the patient at OP token time. The first payment
  // row (the token advance) can be increased but never reduced below this, so a
  // receptionist can't accidentally zero out money that was physically received.
  const [tokenCollected, setTokenCollected] = useState(0);

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load queue ────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setFetchErr("");
    const qs = new URLSearchParams({ date });
    if (debouncedSearch) qs.set("search",   debouncedSearch);
    if (filterDoctor)    qs.set("doctorId", filterDoctor);
    if (filterStatus)    qs.set("status",   filterStatus);
    const { ok, data, error } = await apiFetch(`/api/op-visits/queue?${qs}`);
    if (!ok) { setFetchErr(error); setLoading(false); return; }
    setVisits(data ?? []);
    setLoading(false);
  }, [date, debouncedSearch, filterDoctor, filterStatus]);

  // ── Load stats ────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    const { ok, data } = await apiFetch(`/api/op-visits/queue/stats?date=${date}`);
    if (ok) setStats(data);
  }, [date]);

  // ── Load doctors for dropdown ─────────────────────────────────────────────
  const loadDoctors = useCallback(async () => {
    const { ok, data } = await apiFetch("/api/masters/doctors?page=0&size=200");
    if (ok) {
      setDoctors(
        (data?.content ?? data ?? []).map((d: { id: number; name: string; department: string | null; qualifications?: string[] | null; opdFee?: number | null }) => ({
          id: d.id,
          name: d.name,
          department: d.department,
          qualification: Array.isArray(d.qualifications) && d.qualifications.length
            ? d.qualifications.join(", ")
            : null,
          opdFee: d.opdFee ?? null,
        }))
      );
    }
  }, []);

  useEffect(() => { loadQueue(); loadStats(); }, [loadQueue, loadStats]);
  useEffect(() => { loadDoctors(); }, [loadDoctors]);
  useEffect(() => {
    // Area options: managed "Dropdowns" master (active) merged with distinct values
    // already stored on past visits, so historical free-text entries aren't lost.
    const mergeSorted = (a: string[], b: string[]) =>
      Array.from(new Set([...a, ...b].map((s) => s.trim()).filter(Boolean)))
        .sort((x, y) => x.localeCompare(y));

    Promise.all([
      apiFetch("/api/masters/dropdowns?category=AREA&status=ACTIVE&size=1000"),
      apiFetch("/api/op-visits/distinct-areas"),
    ]).then(([master, distinct]) => {
      const masterLabels: string[] = master.ok
        ? ((master.data?.content ?? master.data ?? []) as Array<{ label: string }>).map((o) => o.label)
        : [];
      const distinctVals: string[] = distinct.ok && Array.isArray(distinct.data) ? (distinct.data as string[]) : [];
      setCustomAreas(mergeSorted(masterLabels, distinctVals));
    });

    Promise.all([
      apiFetch("/api/masters/dropdowns?category=DISTRICT&status=ACTIVE&size=1000"),
      apiFetch("/api/op-visits/distinct-districts"),
    ]).then(([master, distinct]) => {
      const masterLabels: string[] = master.ok
        ? ((master.data?.content ?? master.data ?? []) as Array<{ label: string }>).map((o) => o.label)
        : [];
      const distinctVals: string[] = distinct.ok && Array.isArray(distinct.data) ? (distinct.data as string[]) : [];
      setCustomDistricts(mergeSorted(masterLabels, distinctVals));
    });

    // Only services flagged "Show in OP" appear in the OP bill service dropdown.
    apiFetch("/api/masters/billing-masters?page=0&size=500&showInOp=true").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ id: number; serviceCode: string; serviceName: string; modalityName: string; price: number; discountAllowed: boolean; status: string }> =
        data?.content ?? data ?? [];
      setServices(raw.filter(s => s.status !== "INACTIVE").map(s => ({
        id: s.id, serviceCode: s.serviceCode, serviceName: s.serviceName,
        modalityName: s.modalityName, price: s.price, discountAllowed: s.discountAllowed,
      })));
    });
    apiFetch("/api/masters/referrers?page=0&size=200&status=ACTIVE").then(({ ok, data }) => {
      if (!ok) return;
      const raw: Array<{ id: number; name: string; specialization: string | null }> =
        data?.content ?? data ?? [];
      setReferrers(raw.map(r => ({ id: r.id, name: r.name, specialization: r.specialization ?? null })));
    });
  }, []);

  // Persist a newly-typed Area / District to the shared Dropdowns master so it
  // becomes permanent and shows up in every form (and the Dropdowns admin).
  // Optimistically updates the local list; a duplicate on the server is harmless.
  const addDropdownOption = useCallback(async (category: "AREA" | "DISTRICT", rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;
    const bump = (prev: string[]) =>
      prev.includes(value) ? prev : [...prev, value].sort((a, b) => a.localeCompare(b));
    if (category === "AREA") setCustomAreas(bump);
    else setCustomDistricts(bump);
    await apiFetch("/api/masters/dropdowns?idempotent=true", {
      method: "POST",
      body: JSON.stringify({ category, label: value }),
    });
  }, []);

  // ── Patient live search ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uhidSearch || uhidSearch.trim().length < 2 || form.isNewPatient || foundPatient) {
      setPatientOpts([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPatSearching(true);
      const qs = new URLSearchParams({ search: uhidSearch.trim(), page: "0", size: "15" });
      const { ok, data } = await apiFetch(`/api/patients?${qs}`);
      if (ok) {
        const raw: Array<{ id: number; uhid: string; name: string; dateOfBirth: string | null; age: number | null; gender: string | null; phone: string | null; currentEpisode: { kind: string | null } | null }> =
          data?.content ?? data ?? [];
        setPatientOpts(raw.map((p) => ({
          id: p.id, uhid: p.uhid, name: p.name, dateOfBirth: p.dateOfBirth ?? null,
          age: p.age, gender: p.gender, phone: p.phone,
          // "IP" currentEpisode == an active admission exists for this patient.
          admitted: p.currentEpisode?.kind === "IP",
        })));
      }
      setPatSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [uhidSearch, form.isNewPatient, foundPatient]);

  // ── Select patient from suggestion ───────────────────────────────────────
  function selectExistingPatient(p: PatientOption) {
    // Block OP tokens for currently-admitted patients. "admitted" comes from the
    // list endpoint's active-admission episode (currentEpisode.kind === "IP"),
    // the same admissions-table truth the backend guard uses. An in-patient is
    // under the ward team; an OP consultation token would double-count them and
    // raise a stray charge. (The backend enforces the same rule as a safety net.)
    if (p.admitted) {
      setPatientOpts([]);
      setUhidSearch("");
      setSaveErr(`${p.name} (${p.uhid}) is currently admitted. An OP token cannot be issued for an in-patient.`);
      return;
    }
    setFoundPatient(p);
    setUhidNotFound(false);
    setPatientOpts([]);
    setUhidSearch(`${p.name} — ${p.uhid}`);
    // Calculate current age from stored DOB if available; fall back to stored age
    const currentAge = p.dateOfBirth ? calcAgeFromDob(p.dateOfBirth) : (p.age ?? 0);
    setForm((prev) => ({
      ...prev,
      uhid:        p.uhid,
      patientName: p.name,
      age:         currentAge,
      gender:      p.gender ?? "Male",
      phone:       p.phone  ?? "",
      isNewPatient: false,
      type:        "REVIEW",
    }));
    // Reset locks until the full record loads; the search result has no address.
    setLockedDemoFields(new Set());
    // Fetch the full patient record so stored demographics can pre-fill the form.
    // Fields already on file are auto-filled and locked (read-only); blank ones
    // stay editable so staff can fill gaps that back-fill the patient master.
    void fetchAndPrefillPatient(p.id);
  }

  // Pull the full patient record and merge its demographics into the form.
  async function fetchAndPrefillPatient(patientId: number) {
    const { ok, data } = await apiFetch(`/api/patients/${patientId}`);
    if (!ok || !data) return;
    const d = data as {
      address?: string | null; area?: string | null; district?: string | null;
      pinCode?: string | null; state?: string | null; email?: string | null;
      religion?: string | null; bloodGroup?: string | null; maritalStatus?: string | null;
    };
    const vals: Record<LockableDemoKey, string> = {
      address1:      d.address  ?? "",
      area:          d.area     ?? "",
      district:      d.district ?? "",
      pincode:       d.pinCode  ?? "",
      state:         d.state    ?? "",
      email:         d.email    ?? "",
      religion:      d.religion ?? "",
      bloodGroup:    bloodEnumToDisplay(d.bloodGroup),
      maritalStatus: maritalEnumToDisplay(d.maritalStatus),
    };
    // Lock any field that already has a value on the patient record.
    const locked = new Set<LockableDemoKey>(
      (Object.keys(vals) as LockableDemoKey[]).filter((k) => vals[k].trim() !== "")
    );
    setLockedDemoFields(locked);
    setForm((prev) => ({
      ...prev,
      // Only overwrite with stored values; keep anything already typed for blanks.
      address1:      vals.address1      || prev.address1,
      area:          vals.area          || prev.area,
      district:      vals.district      || prev.district,
      pincode:       vals.pincode       || prev.pincode,
      state:         vals.state         || prev.state,
      email:         vals.email         || prev.email,
      religion:      vals.religion      || prev.religion,
      bloodGroup:    vals.bloodGroup    || prev.bloodGroup,
      maritalStatus: vals.maritalStatus || prev.maritalStatus,
    }));
  }

  // ── Status advance ────────────────────────────────────────────────────────
  async function advanceStatus(visit: OPVisitResponse) {
    const next = STATUS_NEXT[visit.status];
    if (!next) return;
    // CONSULTATION_DONE → BILLED: open inline bill modal instead of direct advance
    if (visit.status === "CONSULTATION_DONE" && next === "BILLED") {
      openBillModal(visit);
      return;
    }
    setAdvancingId(visit.id);
    const { ok, error } = await apiFetch(`/api/op-visits/${visit.id}/status`, {
      method:  "PATCH",
      body:    JSON.stringify({ status: next }),
    });
    setAdvancingId(null);
    if (!ok) { alert(`Failed to advance status: ${error}`); return; }
    loadQueue();
    loadStats();
  }

  // Build the bill's split-payment prefill from the amount already collected at
  // token time (Flow A: single source of truth). Falls back to a single row of
  // the given fallback amount when the token recorded no payment.
  function tokenSplitPrefill(visit: OPVisitResponse, fallback: number): typeof splitPayments {
    if (visit.paymentSplitsJson) {
      try {
        const splits: Array<{ mode: string; amount: number }> = JSON.parse(visit.paymentSplitsJson);
        const rows = splits
          .filter(s => s.amount > 0)
          .map((s, i) => ({ key: `pay_${i}`, mode: s.mode as PaymentModeB, amount: s.amount, ref: "" }));
        if (rows.length > 0) return rows;
      } catch { /* fall through */ }
    }
    const amount = visit.paidAmount != null ? visit.paidAmount : fallback;
    const mode = (visit.paymentType as PaymentModeB) || "CASH";
    return [{ key: "pay_0", mode, amount, ref: "" }];
  }

  // ── Bill modal helpers ────────────────────────────────────────────────────
  function openBillModal(visit: OPVisitResponse) {
    setBillVisit(visit);
    // Baseline = money the patient already paid upfront at the OP token. This is
    // the floor for the first payment row so it can't be accidentally zeroed.
    setTokenCollected(Math.max(0, visit.paidAmount ?? 0));

    // Try to match a "consultation" service from billing masters so the
    // Service dropdown shows a selected value (the dropdown is keyed on serviceCode).
    const consultSvc = findConsultationService(services);

    // Consultation rate priority (source of truth for the auto-filled line):
    //   1) The amount the receptionist entered at the OP token (consultationAmount).
    //      This is what the patient was actually told/charged on the slip, so it
    //      wins whenever it is > 0.
    //   2) Otherwise the doctor's own OPD fee (opdFee), if configured.
    //   3) Otherwise the billing-master list price of the consultation service.
    // If none are > 0 the line is left at 0 (e.g. a free/waived visit).
    const tokenAmount = visit.consultationAmount ?? null;
    const doc         = doctors.find(d => String(d.id) === String(visit.doctorId));
    const doctorFee   = doc?.opdFee ?? null;
    const masterPrice = consultSvc?.price ?? null;

    const fee =
      (tokenAmount  != null && tokenAmount  > 0) ? tokenAmount  :
      (doctorFee    != null && doctorFee    > 0) ? doctorFee    :
      (masterPrice  != null && masterPrice  > 0) ? masterPrice  : 0;

    if (consultSvc || fee > 0) {
      const line = newBillLine();
      if (consultSvc) {
        // Select the consultation service in the dropdown, but keep the resolved
        // fee as the unit price (overrides the service's list price when the
        // token/doctor fee is higher priority).
        line.serviceCode  = consultSvc.serviceCode;
        line.modalityName = consultSvc.modalityName;
      }
      // The consultation fee is the hospital's own charge, so a discount is
      // always allowed here — this is how a doctor-waived (free) consultation
      // gets zeroed on the bill, regardless of the service's discountAllowed flag.
      line.discountAllowed = true;
      // OP consultation line: fixed "OP Consultation Charges" text + Chief/Duty type.
      line.isConsult   = true;
      line.consultType = OP_CONSULT_TYPES[0];
      line.description = consultDescription(line.consultType);
      line.unitPrice   = fee;
      line.quantity    = 1;
      line.qtyRaw      = "1";
      line.total       = calcLineTotal(1, fee, 0);
      setBillLines([line]);
      // Prefill payment from what was collected at token time (Flow A).
      setSplitPayments(tokenSplitPrefill(visit, fee));
    } else {
      setBillLines([newBillLine()]);
      setSplitPayments(tokenSplitPrefill(visit, 0));
    }
    setOverallDiscount(0);
    setBillErr("");
  }

  function closeBillModal() {
    setBillVisit(null);
    setBillLines([newBillLine()]);
    setOverallDiscount(0);
    setTokenCollected(0);
    setSplitPayments([{ key: "pay_0", mode: "CASH", amount: 0, ref: "" }]);
    setBillErr("");
  }

  function updateBillLine(key: string, field: Partial<BillLineItem>) {
    setBillLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const updated = { ...l, ...field };
      updated.total = calcLineTotal(updated.quantity, updated.unitPrice, updated.discount);
      return updated;
    }));
  }

  function selectBillService(key: string, serviceCode: string) {
    const svc = services.find(s => s.serviceCode === serviceCode);
    if (!svc) return;
    // Picking a concrete service turns the line into a normal (non-consultation)
    // line so the free-text description shows the service name.
    updateBillLine(key, {
      serviceCode:     svc.serviceCode,
      modalityName:    svc.modalityName,
      description:     svc.serviceName,
      unitPrice:       svc.price,
      discountAllowed: svc.discountAllowed,
      discount:        0,
      total:           svc.price,
      isConsult:       false,
      consultType:     undefined,
    });
  }

  // Build a fresh bill line from a billing-master service.
  function billLineFromService(svc: ServiceOption): BillLineItem {
    return {
      ...newBillLine(),
      serviceCode:     svc.serviceCode,
      modalityName:    svc.modalityName,
      description:     svc.serviceName,
      unitPrice:       svc.price,
      discountAllowed: svc.discountAllowed,
      discount:        0,
      total:           svc.price,
      isConsult:       false,
    };
  }

  // Reconcile the bill lines with the services ticked in the search multi-select.
  // Keeps consultation lines, blank ad-hoc lines, and any manually-added lines;
  // adds a line for each newly-ticked service and drops lines for unticked ones.
  function syncBillServices(nextCodes: string[]) {
    setBillLines(prev => {
      const nextSet = new Set(nextCodes);
      // Lines not driven by the multi-select (consultation, ad-hoc/no serviceCode)
      // are preserved as-is.
      const kept = prev.filter(l => l.isConsult || !l.serviceCode || nextSet.has(l.serviceCode));
      const existingCodes = new Set(kept.map(l => l.serviceCode).filter(Boolean));
      const additions = nextCodes
        .filter(code => !existingCodes.has(code))
        .map(code => services.find(s => s.serviceCode === code))
        .filter((s): s is ServiceOption => Boolean(s))
        .map(billLineFromService);
      const merged = [...kept, ...additions];
      return merged.length > 0 ? merged : [newBillLine()];
    });
  }

  async function handleSaveBill() {
    if (!billVisit) return;
    const validLines = billLines.filter(l => l.description || l.unitPrice > 0);
    if (validLines.length === 0) { setBillErr("Add at least one service."); return; }

    // OP bills are settled at the counter — a positive balance cannot be saved.
    // The receptionist must collect the full net amount or apply a discount.
    if (billBalanceDue > 0) {
      setBillErr(`Balance due of ₹${billBalanceDue.toLocaleString("en-IN")} must be collected (or discounted) before saving. OP bills can't be left partially paid.`);
      return;
    }

    // Gross per line (qty × price) and the overall bill-level discount split
    // proportionally across lines so the stored per-item discounts (backend/print
    // model) still add up to the overall discount the receptionist entered.
    const grossPerLine = validLines.map(l => l.quantity * l.unitPrice);
    const subTotal     = grossPerLine.reduce((s, g) => s + g, 0);
    const lineDiscounts = distributeDiscount(grossPerLine, overallDiscount);
    const discountTotal = lineDiscounts.reduce((s, d) => s + d, 0);
    const billTotal     = Math.max(0, subTotal - discountTotal);
    // Money already collected from the patient at OP token time (and shown in the
    // split rows, prefilled from the visit). When the bill is discounted below
    // what was collected (e.g. a waived consultation), the excess is refunded at
    // the counter rather than being an error.
    const collected = splitPayments.reduce((s, p) => s + p.amount, 0);
    // What the bill actually keeps as paid (capped at the net total) and what is
    // handed back to the patient.
    const appliedToBill = Math.min(collected, billTotal);
    const refund        = Math.max(0, collected - billTotal);
    // Fresh cash the patient still owes (scenario where other services exceed the
    // token advance). Not an error — it's just collected now.
    // (collected already includes any amount the receptionist typed in.)

    setBillSaving(true);
    setBillErr("");

    // The bill's recorded payment = amount applied to the bill (token advance +
    // any fresh cash, capped at the net total). The split rows drive the mode.
    // We post the full appliedToBill as the primary payment to avoid over/under
    // posting when a refund trims the collected total.
    const primaryPay = splitPayments[0];
    const userSession = getSession();
    const reqBody = {
      patientId:   billVisit.patientId ? Number(billVisit.patientId) : undefined,
      uhid:        billVisit.uhid,
      patientName: billVisit.patientName,
      patientType: "OP",
      age:         billVisit.age     ?? undefined,
      gender:      billVisit.gender  ?? undefined,
      phone:       billVisit.phone   ?? undefined,
      doctorName:  billVisit.doctorName,
      department:  billVisit.department ?? undefined,
      towards:     "OPD",
      date:        billVisit.visitDate,
      items: validLines.map((l, i) => ({
        serviceCode:  l.serviceCode  || undefined,
        modalityName: l.modalityName || undefined,
        description:  l.description || l.modalityName || "Ad-hoc service",
        quantity:     l.quantity,
        unitPrice:    l.unitPrice,
        discount:     lineDiscounts[i] || 0,
      })),
      paymentMode:      primaryPay.mode,
      referenceNo:      primaryPay.ref || undefined,
      amountPaid:       appliedToBill,
      // Traceability: how much came from the OP token advance, and how much was
      // handed back when the bill nets below the advance.
      initialCollected: appliedToBill,
      refundAmount:     refund,
      draft:            false,
      createdBy:        userSession?.name ?? undefined,
    };

    const { ok, data: savedBill, error } = await apiFetch("/api/bills", {
      method: "POST",
      body:   JSON.stringify(reqBody),
    });

    if (!ok) { setBillErr(error); setBillSaving(false); return; }

    // Advance visit status to BILLED with the new bill's ID
    const { ok: statusOk, error: statusErr } = await apiFetch(
      `/api/op-visits/${billVisit.id}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "BILLED", billId: String(savedBill.id) }) }
    );

    setBillSaving(false);
    if (!statusOk) { setBillErr(`Bill created but status update failed: ${statusErr}`); return; }

    // Print the OP bill receipt
    const payModeLabel = splitPayments
      .filter(p => p.amount > 0)
      .map(p => `${payModeLabel_(p.mode)}${p.amount ? " : ₹" + p.amount.toLocaleString("en-IN") : ""}`)
      .join(" + ") || payModeLabel_(splitPayments[0]?.mode) || "Cash";

    printOPBill({
      billNo:      savedBill.billNo ?? "",
      // Bill is being generated now — show today's date; billTime defaults to now.
      billDate:    new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" }),
      visitNo:     billVisit.visitNo ?? "",
      tokenNo:     billVisit.tokenNo,
      uhid:        billVisit.uhid,
      patientName: billVisit.patientName,
      age:         billVisit.age,
      gender:      billVisit.gender,
      phone:       billVisit.phone,
      doctorName:  billVisit.doctorName,
      department:  billVisit.department,
      address:     [billVisit.address1, billVisit.address2, billVisit.area, billVisit.district]
                     .filter(Boolean).join(", ") || undefined,
      items:       validLines.map((l, i) => ({
        description: l.description || l.modalityName || "Service",
        quantity:    l.quantity,
        unitPrice:   l.unitPrice,
        discount:    lineDiscounts[i] || 0,
        total:       Math.max(0, l.quantity * l.unitPrice - (lineDiscounts[i] || 0)),
      })),
      totalAmount: billTotal,
      paidAmount:  appliedToBill,
      payMode:     payModeLabel,
      preparedBy:  userSession?.name ?? "—",
      referredBy:  billVisit.referredBy ?? undefined,
      regType:     billVisit.regType ?? undefined,
    });

    closeBillModal();
    loadQueue();
    loadStats();
  }

  // ── Print (bill once billed, else the OP token slip) ────────────────────────
  async function handlePrint(visit: OPVisitResponse) {
    // Once the visit is billed, the print button reprints the OP bill receipt
    // (not the token slip). Falls back to the token slip if the bill can't be
    // fetched for any reason.
    if ((visit.status === "BILLED" || visit.status === "PAID") && visit.billId) {
      const printed = await printOPBillForVisit(visit);
      if (printed) return;
    }

    // Pull the patient's address (not stored on the OP visit) for the slip.
    let address = "";
    try {
      const { ok, data } = await apiFetch(
        `/api/patients?search=${encodeURIComponent(visit.uhid)}&page=0&size=5`
      );
      if (ok) {
        const raw: Array<{ uhid: string; address?: string | null; area?: string | null; district?: string | null }> =
          data?.content ?? data ?? [];
        const match = raw.find(p => p.uhid === visit.uhid) ?? raw[0];
        if (match) {
          address = [match.address, match.area, match.district]
            .filter(Boolean)
            .join(", ");
        }
      }
    } catch { /* address is optional — slip still prints without it */ }

    const html = await buildTokenHtml(visit, address, session?.name ?? "");
    printHtml(html);
  }

  // Fetch the OP bill linked to a billed visit and print the outpatient receipt.
  // Returns true on success, false if the bill couldn't be loaded (caller then
  // falls back to the token slip).
  async function printOPBillForVisit(visit: OPVisitResponse): Promise<boolean> {
    if (!visit.billId) return false;
    const { ok, data } = await apiFetch(`/api/bills/${visit.billId}`);
    if (!ok || !data) return false;

    const bill = data as {
      billNo?: string; date?: string; createdAt?: string; uhid?: string; patientName?: string;
      age?: number | null; gender?: string | null; phone?: string | null;
      doctorName?: string | null; department?: string | null;
      totalAmount?: number; paidAmount?: number;
      paymentMode?: string | null;
      payments?: { paymentMode: string; amount: number }[];
      items?: { description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
    };

    const payMode = bill.payments?.length
      ? bill.payments.map(p => `${payModeLabel_(p.paymentMode)} : ₹${p.amount.toLocaleString("en-IN")}`).join(" + ")
      : bill.paymentMode ?? "Cash";

    // Patient's postal address isn't stored on the bill/visit — look it up so the
    // bill can print a real address instead of leaving it blank.
    let address = "";
    try {
      const uhid = bill.uhid ?? visit.uhid;
      const { ok: pok, data: pdata } = await apiFetch(
        `/api/patients?search=${encodeURIComponent(uhid)}&page=0&size=5`
      );
      if (pok) {
        const raw: Array<{ uhid: string; address?: string | null; area?: string | null; district?: string | null }> =
          pdata?.content ?? pdata ?? [];
        const match = raw.find(p => p.uhid === uhid) ?? raw[0];
        if (match) address = [match.address, match.area, match.district].filter(Boolean).join(", ");
      }
    } catch { /* address optional */ }

    // Reprint: date comes from the bill's date (date-only), and the time from
    // its createdAt timestamp. bill.date alone has no time, so never derive the
    // clock from it (that would wrongly print midnight / 05:30 IST).
    const billDateObj = new Date(bill.date ?? visit.visitDate);
    const billCreatedAt = bill.createdAt ? new Date(bill.createdAt) : null;
    printOPBill({
      billNo:      bill.billNo ?? "",
      billDate:    billDateObj.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" }),
      billTime:    billCreatedAt && !isNaN(billCreatedAt.getTime())
        ? billCreatedAt.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true })
        : undefined,
      visitNo:     visit.visitNo ?? "",
      tokenNo:     visit.tokenNo,
      uhid:        bill.uhid ?? visit.uhid,
      patientName: bill.patientName ?? visit.patientName,
      age:         bill.age ?? visit.age,
      gender:      bill.gender ?? visit.gender,
      phone:       bill.phone ?? visit.phone,
      doctorName:  bill.doctorName ?? visit.doctorName,
      department:  bill.department ?? visit.department,
      address:     address || undefined,
      items:       (bill.items ?? []).map(it => ({
        description: it.description,
        quantity:    it.quantity,
        unitPrice:   it.unitPrice,
        discount:    it.discount,
        total:       it.total,
      })),
      totalAmount: bill.totalAmount ?? 0,
      paidAmount:  bill.paidAmount ?? 0,
      payMode,
      preparedBy:  session?.name ?? "—",
      referredBy:  visit.referredBy ?? undefined,
      regType:     visit.regType ?? undefined,
    });
    return true;
  }

  // ── Add visit ─────────────────────────────────────────────────────────────
  async function handleAddVisit() {
    if (!form.patientName || !form.doctorId) return;
    if (form.isNewPatient && !/^\d{10}$/.test(form.phone ?? "")) {
      setSaveErr("Mobile number is required and must be 10 digits.");
      return;
    }
    // OP tokens can only be created for the current date.
    const visitDate = TODAY;
    setSaving(true);
    setSaveErr("");

    const body: Record<string, unknown> = {
      uhid:          form.uhid || `WALK-${Date.now()}`,
      patientName:   form.patientName,
      dob:           form.dob   || undefined,
      age:           form.age   || undefined,
      gender:        form.gender || undefined,
      phone:         form.phone  || undefined,
      doctorId:      form.doctorId,
      doctorName:    form.doctorName,
      department:    form.department || undefined,
      visitDate:     visitDate,
      visitTime:     form.visitTime  || undefined,
      type:          form.type,
      regType:       form.regType,
      chiefComplaint: form.chiefComplaint,
      registrationSource: "ML",
      referredBy:    form.referredBy || undefined,
      // Extended demographics
      address1:      form.address1      || undefined,
      address2:      form.address2      || undefined,
      area:          form.area          || undefined,
      district:      form.district      || undefined,
      pincode:       form.pincode       || undefined,
      state:         form.state         || undefined,
      maritalStatus: form.maritalStatus || undefined,
      religion:      form.religion      || undefined,
      bloodGroup:    form.bloodGroup    || undefined,
      email:         form.email         || undefined,
      aadhaarNo:     form.aadhaarNo     || undefined,
      // Payment mode now comes from the token-payment block (single-mode row or
      // the first split row), not a separate "Payment Type" demographics field.
      paymentType:   (form.tokenSplits[0]?.mode as string) || "CASH",
      companyTpa:    form.companyTpa    || undefined,
      // Per-visit free flag — applies to this visit only (returning patients included).
      free: form.freePatient,
    };

    // ── Token-time payment (Flow A: this is the OP consultation payment) ──
    if (!form.freePatient) {
      const singleMode = (form.tokenSplits[0]?.mode as PaymentModeB) || "CASH";
      const splits = form.useSplit
        ? form.tokenSplits.filter(p => p.amount > 0)
        : [{ mode: singleMode, amount: form.amountToPay, ref: "" }];
      const paid = splits.reduce((s, p) => s + p.amount, 0);
      body.consultationAmount = form.amountToPay;
      body.discountAmount     = 0;
      body.paidAmount         = paid;
      body.paymentSplitsJson  = form.useSplit
        ? JSON.stringify(splits.map(p => ({ mode: p.mode, amount: p.amount })))
        : undefined;
    } else {
      body.consultationAmount = form.amountToPay; // may be 0
      body.discountAmount     = form.amountToPay; // full waiver → free
      body.paidAmount         = 0;
    }

    if (foundPatient) body.patientId = String(foundPatient.id);

    const { ok, data, error } = await apiFetch("/api/op-visits", {
      method: "POST",
      body:   JSON.stringify(body),
    });
    setSaving(false);
    if (!ok) {
      // ── Duplicate patient detected ─────────────────────────────────────────
      // The backend returns a message like: "PATIENT_EXISTS:Ravi Kumar (UHID-...)"
      // Surface the patient name prominently so the receptionist knows who to look up.
      if (error?.startsWith("PATIENT_EXISTS:")) {
        const patientInfo = error.slice("PATIENT_EXISTS:".length);
        setSaveErr(`⚠ Already registered: ${patientInfo} — use "Existing Patient" to search and add the visit.`);
      } else {
        setSaveErr(error);
      }
      return;
    }

    closeModal();
    loadQueue();
    loadStats();
    if (data) void handlePrint(data as OPVisitResponse);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyVisitForm());
    setUhidSearch("");
    setFoundPatient(null);
    setLockedDemoFields(new Set());
    setUhidNotFound(false);
    setPatientOpts([]);
    setSaveErr("");
  }

  // ── Inline add-referrer ───────────────────────────────────────────────────
  async function handleSaveReferrer() {
    if (!refForm.name.trim()) { setRefErr("Name is required"); return; }
    // Phone is optional, but if provided it must be a valid 10-digit number.
    if (refForm.phone.trim() && !/^\d{10}$/.test(refForm.phone.trim())) {
      setRefErr("Enter a valid 10-digit phone number"); return;
    }
    setRefSaving(true); setRefErr("");
    const { ok, data, error } = await apiFetch("/api/masters/referrers", {
      method: "POST",
      body: JSON.stringify({
        name:           refForm.name.trim(),
        type:           refForm.type,
        specialization: refForm.specialization || undefined,
        organization:   refForm.organization   || undefined,
        phone:          refForm.phone.trim() || undefined,
        alternatePhone: refForm.alternatePhone  || undefined,
        address:        refForm.address         || undefined,
        notes:          refForm.notes           || undefined,
        status:         "ACTIVE",
      }),
    });
    setRefSaving(false);
    if (!ok) { setRefErr(error ?? "Failed to save referrer"); return; }
    // Add to the in-memory list and auto-select the new referrer
    const newRef: ReferrerOption = {
      id:             (data as { id: number }).id,
      name:           refForm.name.trim(),
      specialization: refForm.specialization || null,
    };
    setReferrers((prev) => [...prev, newRef].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({ ...prev, referredBy: newRef.name }));
    setRefModalOpen(false);
    setRefForm(emptyRefForm());
  }

  // ── Derived stats row ─────────────────────────────────────────────────────
  const statsRow = useMemo(() => {
    const done = (stats?.consultationDone ?? 0) + (stats?.billed ?? 0) + (stats?.paid ?? 0);
    return [
      { label: "Total",           value: stats?.total         ?? visits.length,                           color: "bg-slate-100 text-slate-700"   },
      { label: "Waiting",         value: stats?.waiting       ?? visits.filter(v => v.status === "WAITING").length,          color: "bg-amber-100 text-amber-700"   },
      { label: "In Consultation", value: stats?.inConsultation ?? visits.filter(v => v.status === "IN_CONSULTATION").length, color: "bg-sky-100 text-sky-700"       },
      { label: "Completed",       value: done || visits.filter(v => ["CONSULTATION_DONE","BILLED","PAID"].includes(v.status)).length, color: "bg-emerald-100 text-emerald-700" },
    ];
  }, [stats, visits]);

  // ── Reg-type filter (applied client-side on the loaded day queue) ──
  const displayVisits = useMemo(() => {
    return visits.filter((v) =>
      (!filterRegType || v.regType === filterRegType) &&
      (!filterSource  || v.registrationSource === filterSource)
    );
  }, [visits, filterRegType, filterSource]);

  // ── Token preview (per-regType daily sequence, e.g. CON290926001) ──
  const tokenPreview = useMemo(() => {
    // Tokens are always created for the current date.
    const opt = REG_TYPE_OPTS.find((o) => o.value === form.regType) ?? REG_TYPE_OPTS[0];
    const [y, m, d] = TODAY.split("-");
    const datePart = `${d}${m}${y.slice(2)}`;            // ddMMyy
    const prefix = `${opt.prefix}${datePart}`;            // e.g. CON290926
    // Next sequence = count of existing same-regType tokens for today + 1
    const seq = visits.filter(
      (v) => v.visitDate === TODAY && (v.tokenNo ?? "").startsWith(opt.prefix),
    ).length + 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
  }, [visits, form.regType]);

  const queueAhead = useMemo(() => {
    if (!form.doctorId) return 0;
    return visits.filter((v) => v.visitDate === date && v.status === "WAITING").length;
  }, [visits, form.doctorId, date]);

  const canAdd     = ["Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);
  const canAdvance = ["Admin", "Receptionist", "Doctor", "Lab/Ins/Reception"].includes(role);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="OP Token Queue"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "OP Token Queue" }]}
        action={canAdd ? { label: "Add to Queue", onClick: () => { setDate(TODAY); setModalOpen(true); } } : undefined}
      />

      {/* Error banner */}
      {fetchErr && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {fetchErr}
          <button onClick={() => { loadQueue(); loadStats(); }}
            className="ml-auto text-xs font-semibold underline">Retry</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {statsRow.map((s) => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color} flex items-center justify-between`}>
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-2xl font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          type="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <div className="relative w-full sm:w-56">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, UHID, token…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={filterRegType} onChange={(e) => setFilterRegType(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white
              text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Reg Types</option>
            {REG_TYPE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white
              text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Sources</option>
            <option value="VS">Self (QR)</option>
            <option value="ML">Staff (Counter)</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white
              text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white
              text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            {(Object.keys(STATUS_LABEL) as OPVisitStatusB[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Token Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Loading queue…
          </div>
        )}

        {!loading && (
          <>
            {/* ── Mobile card list ── */}
            <div className="sm:hidden divide-y divide-slate-100">
              {displayVisits.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    No visits found for {date}
                  </div>
                </div>
              ) : displayVisits.map((v) => {
                const next = STATUS_NEXT[v.status];
                const advancing = advancingId === v.id;
                return (
                  <div key={v.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded text-sm">
                        {v.tokenNo}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                        rounded-full whitespace-nowrap ${STATUS_COLORS[v.status]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {STATUS_LABEL[v.status]}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800 text-sm">{v.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {v.age != null ? `${v.age}y` : ""}
                      {v.gender ? `/${v.gender.charAt(0)}` : ""}
                      {v.phone ? ` · ${v.phone}` : ""}
                    </p>
                    <p className="text-xs text-slate-600 font-medium">
                      {v.doctorName}
                      <span className="text-slate-400 font-normal">
                        {v.department ? ` · ${v.department}` : ""}
                        {v.visitTime  ? ` · ${v.visitTime}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 italic truncate">{v.chiefComplaint}</p>
                    <div className="flex items-center gap-1.5">
                      {v.registrationSource === "VS" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 4h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          QR Self-reg
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Manual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {canAdvance && next && (
                        <button
                          onClick={() => advanceStatus(v)}
                          disabled={advancing}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5
                            rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700
                            transition-colors disabled:opacity-50">
                          {advancing ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : v.status === "CONSULTATION_DONE" ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          )}
                          {v.status === "CONSULTATION_DONE" ? "Bill Patient" : STATUS_LABEL[next]}
                        </button>
                      )}
                      {/* Admit — launches the admit flow on the Patients page, pre-filled */}
                      {v.patientId && (
                        <button onClick={() => router.push(`/patients?admitPatientId=${v.patientId}`)}
                          title="Admit this patient as In-Patient"
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5
                            rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Admit
                        </button>
                      )}
                      <button onClick={() => handlePrint(v)}
                        title={v.status === "BILLED" || v.status === "PAID" ? "Print bill" : "Print token slip"}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ── */}
            <HScrollArea className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {(["Token", "UHID", "Patient", "Age/Sex", "Phone",
                       "Doctor", "Type", "Time", "Status",
                       ...(canAdvance ? ["Action"] : []), ""] as string[]).map((h, i) => (
                      <th key={i}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500
                          uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayVisits.length === 0 ? (
                    <tr>
                      <td colSpan={canAdvance ? 11 : 10}
                        className="px-4 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                          </svg>
                          No visits found for {date}
                        </div>
                      </td>
                    </tr>
                  ) : displayVisits.map((v) => {
                    const next     = STATUS_NEXT[v.status];
                    const advancing = advancingId === v.id;
                    return (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded text-sm">
                            {v.tokenNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{v.uhid}</td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="font-medium text-slate-800 truncate" title={v.patientName}>{v.patientName}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {v.age != null ? `${v.age}y` : "—"}
                          {v.gender ? `/${v.gender.charAt(0)}` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px]">
                          <p className="truncate" title={v.doctorName ?? ""}>{v.doctorName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={TYPE_LABEL[v.type]} />
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{v.visitTime ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                            rounded-full whitespace-nowrap ${STATUS_COLORS[v.status]}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {STATUS_LABEL[v.status]}
                          </span>
                        </td>
                        {canAdvance && (
                          <td className="px-4 py-3">
                            {next ? (
                              <button
                                onClick={() => advanceStatus(v)}
                                disabled={advancing}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5
                                  rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700
                                  transition-colors whitespace-nowrap disabled:opacity-50"
                                title={v.status === "CONSULTATION_DONE" ? "Create bill for this patient" : `Move to: ${STATUS_LABEL[next]}`}
                              >
                                {advancing ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                  </svg>
                                ) : v.status === "CONSULTATION_DONE" ? (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                )}
                                {v.status === "CONSULTATION_DONE" ? "Bill Patient" : STATUS_LABEL[next]}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                </svg>
                                Completed
                              </span>
                            )}
                          </td>
                        )}
                        {/* Print token + Admit */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Admit — launches the admit flow on the Patients page, pre-filled */}
                            {v.patientId && (
                              <button
                                onClick={() => router.push(`/patients?admitPatientId=${v.patientId}`)}
                                title="Admit this patient as In-Patient"
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1.5
                                  rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Admit
                              </button>
                            )}
                            <button
                              onClick={() => handlePrint(v)}
                              title={v.status === "BILLED" || v.status === "PAID" ? "Print bill" : "Print token slip"}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </HScrollArea>

            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
              {displayVisits.length} entries for {date}
            </div>
          </>
        )}
      </div>

      {/* ── Add to Queue Modal ── */}
      {/* ── Craft Bill Modal (CONSULTATION_DONE → BILLED) ── */}
      <Modal
        open={!!billVisit}
        onClose={closeBillModal}
        title={billVisit ? `Create Bill — ${billVisit.patientName}` : "Create Bill"}
        size="xl"
        footer={
          <>
            <button onClick={closeBillModal}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSaveBill}
              disabled={billSaving || billBalanceDue > 0}
              title={billBalanceDue > 0
                ? `Collect the balance of ₹${billBalanceDue.toLocaleString("en-IN")} before saving`
                : undefined}
              className="px-5 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40
                disabled:cursor-not-allowed text-white font-medium rounded-lg inline-flex items-center gap-2">
              {billSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Save Bill &amp; Mark Billed
                </>
              )}
            </button>
          </>
        }
      >
        {billVisit && (() => {
          const subTotal    = billLines.reduce((s, l) => s + l.total, 0);
          const discountNow = Math.max(0, Math.min(overallDiscount, subTotal));
          const billTotal   = Math.max(0, subTotal - discountNow);
          const totalPaidNow = splitPayments.reduce((s, p) => s + p.amount, 0);
          const balanceDue  = Math.max(0, billTotal - totalPaidNow);
          return (
            <div className="space-y-5">
              {/* Patient summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                {[
                  ["Patient",   billVisit.patientName],
                  ["UHID",      billVisit.uhid],
                  ["Token",     billVisit.tokenNo],
                  ["Age / Sex", `${billVisit.age != null ? billVisit.age + "y" : "—"}${billVisit.gender ? "/" + billVisit.gender.charAt(0) : ""}`],
                  ["Doctor",    billVisit.doctorName],
                  ["Complaint", billVisit.chiefComplaint],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                    <p className="text-slate-800 font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Services */}
              <div>
                <SH>Services</SH>
                {/* Search + multi-select: tick several services to add them as
                    bill lines at once. Per-line editing stays available below. */}
                <div className="mt-2">
                  <SearchMultiSelect
                    placeholder="Search services to add…"
                    emptyText="No matching service"
                    options={services.map<MultiSelectOption>(s => ({
                      value: s.serviceCode,
                      label: s.serviceName,
                      hint: `₹${Number(s.price).toLocaleString("en-IN")}`,
                      searchText: `${s.serviceName} ${s.modalityName}`.toLowerCase(),
                    }))}
                    selected={Array.from(new Set(billLines
                      .filter(l => !l.isConsult && l.serviceCode)
                      .map(l => l.serviceCode)))}
                    onChange={syncBillServices}
                  />
                </div>
                {/* scrollable table */}
                <div className="-mx-4 sm:-mx-6 overflow-x-auto mt-3">
                  <div className="min-w-[680px] px-4 sm:px-6 space-y-1.5">
                    {/* header */}
                    <div className="grid grid-cols-[160px_1fr_48px_88px_80px_28px]
                      gap-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      <span>Service</span>
                      <span>Description</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Rate (₹)</span>
                      <span className="text-right">Total</span>
                      <span/>
                    </div>
                    {billLines.map(line => (
                      <div key={line.key}
                        className="grid grid-cols-[160px_1fr_48px_88px_80px_28px]
                          gap-2 items-center bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                        {/* service dropdown */}
                        <select
                          value={line.serviceCode}
                          onChange={e => selectBillService(line.key, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                            text-xs focus:outline-none focus:ring-2 focus:ring-sky-500">
                          <option value="">Pick service…</option>
                          {services.map(s => (
                            <option key={s.serviceCode} value={s.serviceCode}>
                              {s.serviceName}
                            </option>
                          ))}
                        </select>
                        {/* description — consultation line shows the fixed text
                            "OP Consultation Charges" with a Chief/Duty picker */}
                        {line.isConsult ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                              {OP_CONSULT_LABEL}
                            </span>
                            <select
                              value={line.consultType ?? OP_CONSULT_TYPES[0]}
                              onChange={e => {
                                const consultType = e.target.value;
                                updateBillLine(line.key, {
                                  consultType,
                                  description: consultDescription(consultType),
                                });
                              }}
                              className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-slate-200 bg-white
                                text-xs focus:outline-none focus:ring-2 focus:ring-sky-500">
                              {OP_CONSULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        ) : (
                          <input
                            value={line.description}
                            onChange={e => updateBillLine(line.key, { description: e.target.value })}
                            placeholder="Description / ad-hoc"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                              text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                        )}
                        {/* qty */}
                        <input type="text" inputMode="numeric" value={line.qtyRaw ?? String(line.quantity)}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const qty = raw === "" ? line.quantity : parseInt(raw, 10);
                            updateBillLine(line.key, { qtyRaw: raw, quantity: qty || 1 });
                          }}
                          onBlur={e => {
                            const qty = Math.max(1, parseInt(e.target.value) || 1);
                            updateBillLine(line.key, { qtyRaw: String(qty), quantity: qty });
                          }}
                          onFocus={e => e.target.select()}
                          className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                            text-xs text-center focus:outline-none focus:ring-2 focus:ring-sky-500
                            [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
                        {/* unit price */}
                        <input type="number" min={0} value={line.unitPrice || ""}
                          onChange={e => updateBillLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white
                            text-xs text-right focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                        {/* total */}
                        <div className="text-xs font-semibold text-slate-800 text-right tabular-nums">
                          ₹{line.total.toLocaleString("en-IN")}
                        </div>
                        {/* remove */}
                        <button type="button"
                          onClick={() => setBillLines(prev => prev.filter(l => l.key !== line.key))}
                          disabled={billLines.length === 1}
                          className="flex items-center justify-center p-0.5 rounded text-slate-300
                            hover:text-red-500 disabled:opacity-30 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5
                                7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setBillLines(l => [...l, newBillLine()])}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600
                        hover:text-sky-800 transition-colors mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      Add another service
                    </button>
                  </div>
                </div>
                {/* Totals */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 mt-3">
                  <div className="flex flex-col gap-2 items-end text-sm">
                    <div className="flex items-center justify-between gap-4 w-full max-w-xs">
                      <span className="text-slate-400 text-xs">Subtotal</span>
                      <span className="text-slate-600 text-sm tabular-nums">
                        ₹{subTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    {/* Overall (bill-level) discount */}
                    <div className="flex items-center justify-between gap-4 w-full max-w-xs">
                      <label className="text-slate-500 text-xs font-medium">Overall Discount (₹)</label>
                      <input type="number" min={0} max={subTotal} value={overallDiscount || ""}
                        onChange={e => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-28 px-2 py-1.5 rounded-md border border-slate-200 bg-white
                          text-xs text-right focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                    </div>
                    {discountNow > 0 && (
                      <div className="flex items-center justify-between gap-4 w-full max-w-xs">
                        <span className="text-emerald-600 text-xs">Discount</span>
                        <span className="text-emerald-600 text-xs tabular-nums">
                          −₹{discountNow.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 w-full max-w-xs border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-800 text-base">Net Total</span>
                      <span className="font-bold text-slate-800 text-base tabular-nums">
                        ₹{billTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Split Payment */}
              <div>
                <div className="flex items-center justify-between">
                  <SH>Payment</SH>
                  <button
                    type="button"
                    onClick={() => setSplitPayments(p => [...p, { key: `pay_${Date.now()}`, mode: "CASH", amount: 0, ref: "" }])}
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Split
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[140px_1fr_1fr_28px] gap-2 px-1
                    text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <span>Mode</span><span>Amount (₹)</span><span>Ref / Txn No.</span><span/>
                  </div>
                  {splitPayments.map((pay, idx) => (
                    <div key={pay.key}
                      className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_28px] gap-2 items-center">
                      <select
                        value={pay.mode}
                        onChange={e => setSplitPayments(prev => prev.map(p =>
                          p.key === pay.key ? { ...p, mode: e.target.value as PaymentModeB } : p
                        ))}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-sky-500">
                        {[
                          { value: "CASH",        label: "Cash"        },
                          { value: "CREDIT_CARD", label: "Credit Card" },
                          { value: "DEBIT_CARD",  label: "Debit Card"  },
                          { value: "UPI",         label: "UPI"         },
                          { value: "CHEQUE",      label: "Cheque"      },
                        ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <input
                        type="number" min={idx === 0 ? tokenCollected : 0} step={0.01}
                        value={pay.amount || ""}
                        onChange={e => {
                          // Store exactly what's typed while editing — the token-advance
                          // floor on the first row is enforced on blur, not per keystroke,
                          // so the receptionist can freely type a larger amount.
                          const amt = parseFloat(e.target.value) || 0;
                          setSplitPayments(prev => prev.map(p =>
                            p.key === pay.key ? { ...p, amount: amt } : p
                          ));
                        }}
                        onBlur={() => {
                          // The first row holds the locked token advance — it can be
                          // raised (extra services collected now) but never dropped
                          // below what was already collected upfront.
                          if (idx === 0 && pay.amount < tokenCollected) {
                            setSplitPayments(prev => prev.map((p, i) =>
                              i === 0 ? { ...p, amount: tokenCollected } : p
                            ));
                          }
                        }}
                        placeholder="0"
                        title={idx === 0 && tokenCollected > 0
                          ? `Upfront paid at token: ₹${tokenCollected.toLocaleString("en-IN")} (locked minimum)`
                          : undefined}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                      <input
                        value={pay.ref}
                        onChange={e => setSplitPayments(prev => prev.map(p =>
                          p.key === pay.key ? { ...p, ref: e.target.value } : p
                        ))}
                        placeholder={pay.mode === "CASH" ? "—" : "UPI ref, cheque no…"}
                        disabled={pay.mode === "CASH"}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-sky-500
                          disabled:bg-slate-50 disabled:text-slate-400"/>
                      <button
                        type="button"
                        onClick={() => setSplitPayments(prev => prev.filter(p => p.key !== pay.key))}
                        disabled={splitPayments.length === 1}
                        className="flex items-center justify-center p-0.5 rounded text-slate-300
                          hover:text-red-500 disabled:opacity-0 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5
                              7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                      {/* locked upfront advance hint on the first row */}
                      {idx === 0 && tokenCollected > 0 && (
                        <p className="sm:col-start-2 text-xs text-slate-400 -mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                          </svg>
                          Upfront paid at token: ₹{tokenCollected.toLocaleString("en-IN")} (locked minimum)
                        </p>
                      )}
                      {/* auto-fill balance hint on first row when multiple rows */}
                      {idx === 0 && splitPayments.length > 1 && billTotal > 0 && pay.amount === 0 && (
                        <p className="sm:col-start-2 text-xs text-slate-400 -mt-1">
                          Enter partial amount; remainder will be taken from next row
                        </p>
                      )}
                    </div>
                  ))}
                  {/* Payment summary */}
                  <div className="flex flex-col items-end gap-0.5 pt-2 border-t border-slate-100 text-sm">
                    {splitPayments.length > 1 && (
                      <span className="text-slate-500 text-xs">
                        Collected: ₹{totalPaidNow.toLocaleString("en-IN")}
                      </span>
                    )}
                    {balanceDue > 0 ? (
                      <span className="text-amber-600 font-semibold">
                        Balance due: ₹{balanceDue.toLocaleString("en-IN")}
                        <span className="text-xs text-slate-400 font-normal ml-1">(collect before saving)</span>
                      </span>
                    ) : totalPaidNow > billTotal && billTotal > 0 ? (
                      <span className="text-sky-600 font-semibold">
                        Refund: ₹{(totalPaidNow - billTotal).toLocaleString("en-IN")}
                        <span className="text-xs text-slate-400 font-normal ml-1">(return to patient)</span>
                      </span>
                    ) : totalPaidNow > 0 && totalPaidNow === billTotal ? (
                      <span className="text-emerald-600 font-semibold">✓ Fully Paid</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {billErr && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200
                  px-3 py-2 text-sm text-red-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {billErr}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Add Patient to OP Queue"
        size="xl"
        footer={
          <>
            <button onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleAddVisit}
              disabled={saving || !form.patientName || !form.doctorId}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40
                text-white font-medium rounded-lg inline-flex items-center gap-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              Assign Token &amp; Add
            </button>
          </>
        }
      >
        <div className="space-y-5">

          {saveErr && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm
              ${saveErr.startsWith("⚠ Already registered:")
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-red-50 border-red-200 text-red-700"}`}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{saveErr}</span>
            </div>
          )}

          {/* ── Step 1: New or Existing? ── */}
          <SH>Step 1 — Patient</SH>
          <div className="flex gap-2">
            {(["existing", "new"] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => {
                  setForm({ ...emptyVisitForm(), isNewPatient: t === "new" });
                  setFoundPatient(null);
                  setLockedDemoFields(new Set());
                  setUhidSearch("");
                  setPatientOpts([]);
                  setUhidNotFound(false);
                }}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors
                  ${(t === "new") === form.isNewPatient
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                  }`}>
                {t === "new" ? "🆕 New Patient" : "🔍 Existing Patient"}
              </button>
            ))}
          </div>

          {!form.isNewPatient && (
            <div>
              <FormField label="Search by UHID or Name">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  <input
                    value={uhidSearch}
                    onChange={(e) => {
                      setUhidSearch(e.target.value);
                      setUhidNotFound(false);
                      if (!e.target.value) { setFoundPatient(null); setLockedDemoFields(new Set()); }
                    }}
                    placeholder="Type UHID, name or phone…"
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                  {patSearching && (
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400"
                      fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  )}
                  {/* Live search dropdown */}
                  {patientOpts.length > 0 && !foundPatient && (
                    <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200
                      rounded-xl shadow-lg max-h-56 overflow-y-auto text-sm">
                      {patientOpts.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onMouseDown={() => selectExistingPatient(p)}
                            className="w-full text-left px-4 py-2.5 hover:bg-sky-50 transition-colors
                              flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{p.name}</p>
                              <p className="text-xs text-slate-400">
                                {p.uhid}
                                {p.age    != null ? ` · ${p.age}y`           : ""}
                                {p.gender         ? ` · ${p.gender}`          : ""}
                                {p.phone          ? ` · ${p.phone}`           : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </FormField>
              {uhidNotFound && (
                <p className="text-xs text-red-500 mt-1">Patient not found. Try new patient registration.</p>
              )}
              {foundPatient && (
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-emerald-800 text-sm">{foundPatient.name}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {foundPatient.uhid}
                        {foundPatient.age    != null ? ` · ${foundPatient.age}y`    : ""}
                        {foundPatient.gender         ? ` · ${foundPatient.gender}`   : ""}
                        {foundPatient.phone          ? ` · ${foundPatient.phone}`    : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setFoundPatient(null); setLockedDemoFields(new Set()); setUhidSearch(""); setPatientOpts([]); }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {form.isNewPatient && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Patient Name" required>
                <Input
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                  placeholder="Full name"
                />
              </FormField>
              <FormField label="Phone" required>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder="10-digit mobile number"
                />
              </FormField>
              <FormField label="Date of Birth">
                <Input
                  type="date"
                  value={form.dob}
                  max={TODAY}
                  onChange={(e) => {
                    const dob = e.target.value;
                    setForm({ ...form, dob, age: calcAgeFromDob(dob) });
                  }}
                />
                {form.dob && (
                  <p className="text-xs text-slate-500 mt-1">
                    Age: <span className="font-semibold text-slate-700">{form.age} yr{form.age !== 1 ? "s" : ""}</span>
                  </p>
                )}
              </FormField>
              <FormField label="Gender">
                <Select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  {["Male", "Female", "Other"].map((g) => <option key={g}>{g}</option>)}
                </Select>
              </FormField>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField label="Reg Type" required>
              <Select
                value={form.regType}
                onChange={(e) => setForm({ ...form, regType: e.target.value as RegTypeB })}>
                {REG_TYPE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Visit Type">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as OPVisitTypeB })}>
                <option value="NEW">New</option>
                <option value="REVIEW">Review</option>
                <option value="FOLLOW_UP">Follow-up</option>
              </Select>
            </FormField>
            <FormField label="Queue Date">
              {/* Tokens can only be added for the current date. */}
              <Input type="date" value={TODAY} min={TODAY} max={TODAY} disabled readOnly />
              <p className="text-xs text-slate-400 mt-1">Tokens can only be added for today</p>
            </FormField>
            <FormField label="Appointment Time">
              <Input
                type="time"
                value={form.visitTime}
                onChange={(e) => setForm({ ...form, visitTime: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">Defaults to ~15 min from now (rounded up). Increase if needed.</p>
            </FormField>
          </div>

          {/* ── Extended demographics (right column of OP registration screen) ── */}
          <SH>Demographics &amp; Address</SH>
          {!form.isNewPatient && lockedDemoFields.size > 0 && (
            <p className="text-xs text-slate-500 -mt-1">
              Fields already on the patient record are locked. Only empty fields can be filled —
              corrections are made on the patient edit screen.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField label="Address">
              <Input value={form.address1} disabled={lockedDemoFields.has("address1")}
                onChange={(e) => setForm({ ...form, address1: e.target.value })}
                placeholder="Door no, street, locality" />
            </FormField>
            <FormField label="Area">
              {lockedDemoFields.has("area") ? (
                <Input value={form.area} disabled />
              ) : (
                <CreatableSearchSelect
                  value={form.area}
                  options={customAreas.map((a) => ({ value: a, label: a }))}
                  onChange={(v) => setForm({ ...form, area: v })}
                  onAdd={(v) => { addDropdownOption("AREA", v); setForm((prev) => ({ ...prev, area: v })); }}
                  placeholder="Select area…"
                  searchPlaceholder="Search or type new area…"
                  addLabel={(q) => `+ Add "${q}" as new area`}
                />
              )}
            </FormField>
            <FormField label="District">
              {lockedDemoFields.has("district") ? (
                <Input value={form.district} disabled />
              ) : (
                <CreatableSearchSelect
                  value={form.district}
                  // Districts come from the Dropdowns master (merged with any distinct
                  // values already stored on past visits) — no hardcoded list.
                  options={customDistricts.map((d) => ({ value: d, label: d }))}
                  onChange={(v) => setForm({ ...form, district: v })}
                  onAdd={(v) => { addDropdownOption("DISTRICT", v); setForm((prev) => ({ ...prev, district: v })); }}
                  placeholder="Select district…"
                  searchPlaceholder="Search or type new district…"
                  addLabel={(q) => `+ Add "${q}" as new district`}
                />
              )}
            </FormField>
            <FormField label="Pincode">
              <Input value={form.pincode} inputMode="numeric" maxLength={6} disabled={lockedDemoFields.has("pincode")}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })}
                placeholder="6-digit" />
            </FormField>
            <FormField label="State">
              <Input value={form.state} disabled={lockedDemoFields.has("state")}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="State" />
            </FormField>
            <FormField label="Marital Status">
              <Select value={form.maritalStatus} disabled={lockedDemoFields.has("maritalStatus")}
                onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
                <option value="">— Select —</option>
                {["Single", "Married", "Widowed", "Divorced"].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Blood Group">
              <Select value={form.bloodGroup} disabled={lockedDemoFields.has("bloodGroup")}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                <option value="">— Select —</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
            <FormField label="Email">
              <Input type="email" value={form.email} disabled={lockedDemoFields.has("email")}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com" />
            </FormField>
            <FormField label="Aadhaar No">
              <Input value={form.aadhaarNo} inputMode="numeric" maxLength={12}
                onChange={(e) => setForm({ ...form, aadhaarNo: e.target.value.replace(/\D/g, "") })}
                placeholder="12-digit" />
            </FormField>
          </div>

          {/* ── Step 2: Doctor ── */}
          <SH>Step 2 — Doctor</SH>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Referrer picker */}
            <FormField label="Referred By">
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchSelect
                    value={form.referredBy}
                    placeholder="— None / Self —"
                    searchPlaceholder="Search referrer…"
                    emptyText="No referrers found"
                    options={[
                      { value: "", label: "— None / Self —" },
                      ...referrers.map((r) => ({
                        value: r.name,
                        label: r.name,
                        sublabel: r.specialization ?? undefined,
                      })),
                    ]}
                    onChange={(v) => setForm({ ...form, referredBy: v })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setRefForm(emptyRefForm()); setRefErr(""); setRefModalOpen(true); }}
                  title="Add new referrer"
                  className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200
                    bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </FormField>

            {/* ── Inline Add Referrer mini-modal ── */}
            {refModalOpen && (
              <div className="col-span-full">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Add New Referrer</p>
                    <button
                      type="button"
                      onClick={() => { setRefModalOpen(false); setRefErr(""); }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {refErr && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{refErr}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <FormField label="Name" required>
                      <Input
                        value={refForm.name}
                        onChange={(e) => setRefForm({ ...refForm, name: e.target.value })}
                        placeholder="Full name"
                        autoFocus
                      />
                    </FormField>
                    <FormField label="Type">
                      <Select
                        value={refForm.type}
                        onChange={(e) => setRefForm({ ...refForm, type: e.target.value as typeof refForm.type })}
                      >
                        {(["DOCTOR","HOSPITAL","CLINIC","INDIVIDUAL","OTHER"] as const).map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0) + t.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Specialization">
                      <Input
                        value={refForm.specialization}
                        onChange={(e) => setRefForm({ ...refForm, specialization: e.target.value })}
                        placeholder="e.g. Cardiologist"
                      />
                    </FormField>
                    <FormField label="Phone">
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={refForm.phone}
                        onChange={(e) => setRefForm({ ...refForm, phone: e.target.value.replace(/\D/g, "") })}
                        placeholder="10-digit mobile (optional)"
                      />
                    </FormField>
                    <FormField label="Organization">
                      <Input
                        value={refForm.organization}
                        onChange={(e) => setRefForm({ ...refForm, organization: e.target.value })}
                        placeholder="Hospital / clinic name"
                      />
                    </FormField>
                    <FormField label="Address">
                      <Input
                        value={refForm.address}
                        onChange={(e) => setRefForm({ ...refForm, address: e.target.value })}
                        placeholder="Address"
                      />
                    </FormField>
                    <FormField label="Notes">
                      <Input
                        value={refForm.notes}
                        onChange={(e) => setRefForm({ ...refForm, notes: e.target.value })}
                        placeholder="Optional notes"
                      />
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setRefModalOpen(false); setRefErr(""); }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveReferrer}
                      disabled={refSaving}
                      className="px-3 py-1.5 text-xs bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300
                        text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      {refSaving && (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                      )}
                      Save &amp; Select
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor picker */}
            <FormField label="Select Doctor" required>
              <SearchSelect
                value={form.doctorId}
                placeholder="Select a doctor…"
                searchPlaceholder="Search doctor…"
                emptyText="No doctors found"
                options={doctors.map((d) => ({
                  value: String(d.id),
                  label: `${d.name}${d.qualification ? ` ${d.qualification}` : ""}`,
                  sublabel: d.department ?? undefined,
                }))}
                onChange={(v) => {
                  const d = doctors.find((doc) => String(doc.id) === v);
                  if (d) {
                    // Auto-fill the amount to pay with the doctor's OPD fee (editable).
                    const fee = d.opdFee ?? 0;
                    setForm({
                      ...form,
                      doctorId: String(d.id), doctorName: d.name, department: d.department ?? "",
                      amountToPay: fee,
                      tokenSplits: [{ key: "tpay_0", mode: form.tokenSplits[0]?.mode ?? "CASH", amount: fee, ref: "" }],
                    });
                  } else {
                    setForm({ ...form, doctorId: "", doctorName: "", department: "" });
                  }
                }}
              />
            </FormField>
          </div>

          {/* ── Payment collected at token time ── */}
          {(
            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {!form.freePatient && (
                <FormField label="Amount to Pay (₹)">
                  <Input
                    type="number" min={0} step={0.01}
                    value={form.amountToPay || ""}
                    onChange={(e) => {
                      const amt = parseFloat(e.target.value) || 0;
                      setForm({
                        ...form,
                        amountToPay: amt,
                        // Keep a single split row in sync when not splitting
                        tokenSplits: form.useSplit
                          ? form.tokenSplits
                          : [{ key: "tpay_0", mode: form.tokenSplits[0]?.mode ?? "CASH", amount: amt, ref: "" }],
                      });
                    }}
                    placeholder="Auto-filled from doctor fee"
                  />
                </FormField>
                )}
                {/* Single-mode payment selector — the one place to choose how the
                    token payment is collected (replaces the old "Payment Type"). */}
                {!form.freePatient && !form.useSplit && (
                  <FormField label="Pay Mode">
                    <Select
                      value={form.tokenSplits[0]?.mode ?? "CASH"}
                      onChange={(e) => {
                        const mode = e.target.value as PaymentModeB;
                        setForm({
                          ...form,
                          tokenSplits: [{ key: "tpay_0", mode, amount: form.amountToPay, ref: "" }],
                        });
                      }}>
                      {[
                        { value: "CASH",        label: "Cash"        },
                        { value: "CREDIT_CARD", label: "Credit Card" },
                        { value: "DEBIT_CARD",  label: "Debit Card"  },
                        { value: "UPI",         label: "UPI"         },
                      ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                  </FormField>
                )}
                {!form.freePatient && (
                <FormField label="Collect As">
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={form.useSplit}
                      onChange={(e) => {
                        const useSplit = e.target.checked;
                        const mode = form.tokenSplits[0]?.mode ?? "CASH";
                        setForm({
                          ...form,
                          useSplit,
                          // Preserve the chosen mode when toggling split on/off.
                          tokenSplits: [{ key: "tpay_0", mode, amount: form.amountToPay, ref: "" }],
                        });
                      }}
                      className="w-4 h-4 accent-slate-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">Split across modes</span>
                  </label>
                </FormField>
                )}
                {/* Free visit — applies to this OP visit only (new or returning patient) */}
                <FormField label="Free Visit">
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={form.freePatient}
                      onChange={e => setForm({
                        ...form,
                        freePatient: e.target.checked,
                        // Free visit → nothing to collect
                        amountToPay: e.target.checked ? 0 : form.amountToPay,
                      })}
                      className="w-4 h-4 accent-slate-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">No charge</span>
                  </label>
                </FormField>
              </div>

              {!form.freePatient && form.useSplit && (
                <div className="space-y-2">
                  {form.tokenSplits.map((pay) => (
                    <div key={pay.key} className="grid grid-cols-[130px_1fr_28px] gap-2 items-center">
                      <select
                        value={pay.mode}
                        onChange={(e) => setForm({
                          ...form,
                          tokenSplits: form.tokenSplits.map(p =>
                            p.key === pay.key ? { ...p, mode: e.target.value as PaymentModeB } : p),
                        })}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-sky-500">
                        {[
                          { value: "CASH",        label: "Cash"        },
                          { value: "CREDIT_CARD", label: "Credit Card" },
                          { value: "DEBIT_CARD",  label: "Debit Card"  },
                          { value: "UPI",         label: "UPI"         },
                        ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <input
                        type="number" min={0} step={0.01}
                        value={pay.amount || ""}
                        onChange={(e) => setForm({
                          ...form,
                          tokenSplits: form.tokenSplits.map(p =>
                            p.key === pay.key ? { ...p, amount: parseFloat(e.target.value) || 0 } : p),
                        })}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                      <button
                        type="button"
                        onClick={() => setForm({
                          ...form,
                          tokenSplits: form.tokenSplits.filter(p => p.key !== pay.key),
                        })}
                        disabled={form.tokenSplits.length === 1}
                        className="flex items-center justify-center p-0.5 rounded text-slate-300
                          hover:text-red-500 disabled:opacity-0 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        tokenSplits: [...form.tokenSplits,
                          { key: `tpay_${Date.now()}`, mode: "CASH" as PaymentModeB, amount: 0, ref: "" }],
                      })}
                      className="text-xs text-sky-600 hover:text-sky-800 font-semibold">+ Add mode</button>
                    <span className={`text-xs font-medium ${
                      form.tokenSplits.reduce((s, p) => s + p.amount, 0) === form.amountToPay
                        ? "text-emerald-600" : "text-amber-600"}`}>
                      Split total: ₹{form.tokenSplits.reduce((s, p) => s + p.amount, 0).toLocaleString("en-IN")}
                      {" / ₹"}{form.amountToPay.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Token preview */}
          {form.doctorId && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="min-w-[112px] px-2 py-1.5 rounded-xl bg-sky-500 text-white flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wide">Token</span>
                <span className="font-mono font-bold text-sm leading-tight">
                  {tokenPreview}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{form.doctorName}</p>
                <p className="text-xs text-slate-500">{form.department}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {queueAhead} ahead in queue
                  {form.visitTime && <> · <span className="font-medium text-slate-600">{form.visitTime}</span></>}
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}



function printOPBill(data: OPBillData) {
  printHtml(buildOPBillHtml(data));
}

// ─── Token HTML builder ────────────────────────────────────────────────────────
function buildTokenHtml(visit: OPVisitResponse, address = "", preparedBy = ""): Promise<string> {
  return buildOPRegistrationSlipHtml({
    tokenNo:     visit.tokenNo,
    uhid:        visit.uhid,
    patientName: visit.patientName,
    age:         visit.age,
    gender:      visit.gender,
    phone:       visit.phone,
    address,
    visitDate:   visit.visitDate,
    visitTime:   visit.visitTime,
    doctorName:  visit.doctorName,
    referredBy:  visit.referredBy,
    regType:     visit.regType,
    reason:      visit.chiefComplaint,
    preparedBy,
    paidAmount:  visit.paidAmount ?? 0,
    payModeLabel: buildTokenPayModeLabel(visit),
    free:        visit.free,
  });
}

/**
 * Builds the human-readable pay-mode label for the OP slip from the visit's
 * split JSON (e.g. "Cash : ₹500 + Credit Card : ₹500") or, when single-mode,
 * from the paymentType ("Cash").
 */
function buildTokenPayModeLabel(visit: OPVisitResponse): string {
  if (visit.paymentSplitsJson) {
    try {
      const splits: Array<{ mode: string; amount: number }> = JSON.parse(visit.paymentSplitsJson);
      const parts = splits
        .filter(s => s.amount > 0)
        .map(s => `${payModeLabel_(s.mode)} : ₹${Number(s.amount).toLocaleString("en-IN")}`);
      if (parts.length > 0) return parts.join(" + ");
    } catch { /* fall through to single-mode */ }
  }
  return payModeLabel_(visit.paymentType ?? "") || "";
}



// ─── Section heading helper ────────────────────────────────────────────────────
function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
        {children}
      </h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}
