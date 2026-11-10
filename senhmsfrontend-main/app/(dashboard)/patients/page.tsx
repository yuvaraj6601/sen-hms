"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "../../_lib/auth";
import { printHtml } from "../../_lib/print";
import type { IPCondition, LabPriority } from "../../_lib/types";
import Badge from "../../_components/Badge";
import PageHeader from "../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../_components/Modal";
import TestSearchSelect from "../../_components/TestSearchSelect";
import CollectCashModal, { type CollectCashPatient } from "../../_components/CollectCashModal";
import ReceiptsPanel from "../../_components/ReceiptsPanel";
import HScrollArea from "../../_components/HScrollArea";

// --- Backend response shapes --------------------------------------------------

interface PatientResponse {
  id: number;
  uhid: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string | null;
  maritalStatus: string | null;
  religion: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  district: string | null;
  illness: string | null;
  referredBy: string | null;
  referrerId: number | null;
  doctorName: string | null;
  doctorId: number | null;
  department: string | null;
  patientType: "OP" | "IP" | "BOTH";
  insuranceCompany: string | null;
  insuranceCompanyId: number | null;
  policyNo: string | null;
  tpaName: string | null;
  attendantName: string | null;
  attendantRelation: string | null;
  attendantPhone: string | null;
  idProofType: string | null;
  idProofNo: string | null;
  notes: string | null;
  active: boolean;
  freePatient: boolean;
  // True once the one-time post-admission demographic correction has been used.
  postAdmitEdited?: boolean;
  createdAt: string | null;
  // Present on list (summary) responses: where the patient is / latest activity.
  currentEpisode: CurrentEpisode | null;
}

// Current-episode summary returned by the patient list endpoint.
// kind "IP" → backed by an active admission (ward/bed/admission no).
// kind "OP" → backed by the latest OP visit (visit no / token).
interface CurrentEpisode {
  kind: "IP" | "OP";
  admissionId: number | null;
  episodeNo: string | null;
  tokenNo: string | null;
  episodeDate: string | null;
  wardName: string | null;
  bedNumber: string | null;
  status: string | null;
  isInsurance?: boolean;
  insuranceStatus?: string | null;
}

interface DoctorOption { id: number; name: string; department: string | null; }
interface InsuranceCompanyOption { id: number; name: string; tpaName: string | null; tpaNames: string[]; }
interface DeptOption { id: number; name: string; }
interface WardOption { id: number; name: string; status: string; }
interface BedOption { id: number; number: string; status: string; wardId: number; }
interface ReferrerOption { id: number; name: string; specialization: string | null; }

// --- SearchSelect (searchable single-select dropdown) ------------------------
interface SearchSelectOption { value: string; label: string; sublabel?: string }
function SearchSelect({
  value, options, onChange,
  placeholder = "Select…", searchPlaceholder = "Type to search…", emptyText = "No matches",
}: {
  value: string; options: SearchSelectOption[]; onChange: (v: string) => void;
  placeholder?: string; searchPlaceholder?: string; emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false));
  }, [query, options]);
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
      <button type="button" onClick={() => {
        setOpen((o) => {
          const next = !o;
          if (next && boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setDropUp(window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom);
          }
          return next;
        });
        setQuery("");
      }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500">
        <span className={selected ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{emptyText}</li>}
            {filtered.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors ${o.value === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}>
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

// --- CreatableSelect (searchable single-select that can add a new option) ----
// Mirrors SearchSelect but surfaces a "+ Add …" row when the typed value is new.
// onAdd(value) lets the parent persist the new option to the Dropdowns master.
function CreatableSelect({
  value, options, onChange, onAdd,
  placeholder = "Select…", searchPlaceholder = "Search or type to add…",
  addLabel = (q: string) => `+ Add "${q}"`,
}: {
  value: string; options: SearchSelectOption[];
  onChange: (v: string) => void; onAdd: (v: string) => void;
  placeholder?: string; searchPlaceholder?: string; addLabel?: (q: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);
  const trimmed = query.trim();
  const exactMatch = trimmed !== "" && options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const showAddRow = trimmed !== "" && !exactMatch;
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
      <button type="button" onClick={() => {
        setOpen((o) => {
          const next = !o;
          if (next && boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setDropUp(window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom);
          }
          return next;
        });
        setQuery("");
      }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500">
        <span className={selected || value ? "text-slate-700 truncate" : "text-slate-400 truncate"}>
          {selected ? selected.label : (value || placeholder)}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && !showAddRow && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
            {filtered.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 transition-colors ${o.value === value ? "bg-sky-50 text-sky-700 font-medium" : "text-slate-700"}`}>
                  {o.label}
                </button>
              </li>
            ))}
            {showAddRow && (
              <li>
                <button type="button"
                  onClick={() => { onAdd(trimmed); setOpen(false); setQuery(""); }}
                  className="w-full text-left px-3 py-2 text-sm text-sky-600 font-medium hover:bg-sky-50 transition-colors border-t border-slate-100">
                  {addLabel(trimmed)}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function emptyRefForm() {
  return {
    name: "", type: "DOCTOR" as "DOCTOR" | "HOSPITAL" | "CLINIC" | "INDIVIDUAL" | "OTHER",
    specialization: "", organization: "", phone: "", notes: "",
  };
}

interface TransferLogResponse {
  id: number;
  transferNo: string;
  admissionId: number;
  admissionNo: string;
  transferType: string;
  fromValue: string;
  toValue: string;
  toId: number | null;
  transferDate: string;
  transferTime: string | null;
  reason: string;
  orderedBy: string | null;
  doneBy: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

interface AdmissionResponse {
  id: number;
  admissionNo: string;
  patientId: number;
  wardId: number | null;
  wardName: string | null;
  bedId: number | null;
  bedNumber: string | null;
  admittingDoctorId: number | null;
  admittingDoctorName: string | null;
  department: string | null;
  admissionDate: string | null;
  admissionTime: string | null;
  conditionOnAdmission: string | null;
  provisionalDiagnosis: string | null;
  admissionType: string | null;
  patientName: string | null;
  attendantName: string | null;
  attendantRelation: string | null;
  attendantPhone: string | null;
  paymentMode: string | null;
  isInsurance: boolean;
  insuranceStatus: string | null;
  insuranceCompany: string | null;
  insuranceCompanyId: number | null;
  policyNo: string | null;
  tpaName: string | null;
  claimNo: string | null;
  preAuthNumber: string | null;
  insuranceClaimType: string | null;
  mlc: boolean;
  mlcNumber: string | null;
  notes: string | null;
  planOfCare: string | null;
  expectedCost: string | null;
  expectedOutcome: string | null;
  free: boolean;
  surgical: boolean;
  status: string;
  transfers: TransferLogResponse[];
  daysAdmitted: number | null;
  // Discharge fields
  dischargeNo: string | null;
  dischargeType: string | null;
  dischargeDate: string | null;
  dischargeTime: string | null;
  dischargingDoctorName: string | null;
  finalDiagnosis: string | null;
  conditionOnDischarge: string | null;
  totalDaysStayed: number | null;
  dischargeNotes: string | null;
}

interface OPVisitResponse {
  id: number;
  visitNo: string;
  uhid: string;
  patientName: string;
  doctorId: string | null;
  doctorName: string;
  department: string | null;
  tokenNo: string;
  visitDate: string;
  visitTime: string | null;
  type: string;
  status: string;
  chiefComplaint: string;
}


// --- Enum display helpers -----------------------------------------------------

const GENDER_DISPLAY: Record<string, string> = {
  MALE: "Male", FEMALE: "Female", OTHER: "Other",
};
const BLOOD_GROUPS: Record<string, string> = {
  A_POSITIVE: "A+", A_NEGATIVE: "A-", B_POSITIVE: "B+", B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+", AB_NEGATIVE: "AB-", O_POSITIVE: "O+", O_NEGATIVE: "O-", UNKNOWN: "Unknown",
};
const BLOOD_GROUP_KEYS = Object.keys(BLOOD_GROUPS);

// --- API fetch helper ---------------------------------------------------------

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  let error = json.error ?? "Request failed";
  if (!json.success && json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
    const fieldErrors = Object.entries(json.data as Record<string, string>)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(" — ");
    if (fieldErrors) error = fieldErrors;
  }
  return { ok: res.ok && json.success, data: json.data, error };
}

// --- Filter type --------------------------------------------------------------
type FilterView = "All" | "Out Patients" | "In Patients" | "In Patients — In Bed" | "In Patients — Discharged";

const FILTER_TABS: FilterView[] = [
  "All",
  "Out Patients",
  "In Patients",
  "In Patients — In Bed",
  "In Patients — Discharged",
];

// Page size for server-side paging of the patient list.
const PAGE_SIZE = 50;

// Map a filter-tab selection to the patientType values the backend should match.
// "In Patients" is IP OR BOTH, so it returns both. "All" returns [] (no filter).
function filterToPatientTypes(filter: FilterView): ("OP" | "IP" | "BOTH")[] {
  switch (filter) {
    case "Out Patients":              return ["OP"];
    case "In Patients":                return ["IP", "BOTH"];
    case "In Patients — In Bed":       return ["IP"];
    case "In Patients — Discharged":   return ["BOTH"];
    default:                           return []; // All
  }
}

// Shape of the per-type counts returned by GET /patients/counts.
interface PatientCounts { all: number; op: number; ip: number; both: number; }
// PagedResponse<T> as returned by the backend search endpoint.
interface PagedShape<T> { content?: T[]; totalElements?: number; totalPages?: number; last?: boolean; }

// --- Helpers ------------------------------------------------------------------
function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const CONDITIONS: IPCondition[] = ["Stable", "Critical", "Serious", "Under Observation", "Improving"];

const CONDITION_TO_STATUS: Record<string, string> = {
  "Stable": "STABLE",
  "Critical": "CRITICAL",
  "Serious": "SERIOUS",
  "Under Observation": "UNDER_OBSERVATION",
  "Improving": "STABLE",
};

// Backend enum → display helpers (used to hydrate the editable Admission tab).
const ADMISSION_TYPE_DISPLAY: Record<string, "Planned Treatment" | "Emergency" | "Maternity" | "Daycare"> = {
  PLANNED_TREATMENT: "Planned Treatment", EMERGENCY: "Emergency", MATERNITY: "Maternity", DAYCARE: "Daycare",
  // Legacy value tolerance — any pre-existing ELECTIVE rows map to the new label.
  ELECTIVE: "Planned Treatment",
};
const ADMISSION_TYPE_TO_ENUM: Record<string, string> = {
  "Planned Treatment": "PLANNED_TREATMENT", Emergency: "EMERGENCY", Maternity: "MATERNITY", Daycare: "DAYCARE",
};

// Plan of Care dropdown options (hospital-requested).
const PLAN_OF_CARE_OPTIONS = ["Medical Treatment", "Surgery", "Others"] as const;

// Insurance workflow status (on the admission). Display + colour for the
// patient-list Insurance column and the status dropdown.
const INSURANCE_STATUS_OPTIONS = [
  { value: "DETAILS_INCOMPLETE", label: "Insurance Details Incomplete" },
  { value: "SENT_FOR_APPROVAL",  label: "Insurance Sent for Approval" },
  { value: "APPROVED",           label: "Insurance Approved" },
  { value: "CLAIMED",            label: "Insurance Claimed" },
  { value: "SETTLED",            label: "Insurance Settled" },
  { value: "DECLINED",           label: "Insurance Declined" },
] as const;
const INSURANCE_STATUS_DISPLAY: Record<string, string> = Object.fromEntries(
  INSURANCE_STATUS_OPTIONS.map(o => [o.value, o.label])
);
// Short labels for the compact Payment-column badge. The column is already
// about insurance, so the redundant "Insurance" prefix is dropped to keep the
// badge narrow and avoid forcing the table wider.
const INSURANCE_STATUS_BADGE: Record<string, string> = {
  DETAILS_INCOMPLETE: "Insurance Details Incomplete",
  SENT_FOR_APPROVAL:  "Insurance Sent for Approval",
  APPROVED:           "Insurance Approved",
  CLAIMED:            "Insurance Claimed",
  SETTLED:            "Insurance Settled",
  DECLINED:           "Insurance Declined",
};
const INSURANCE_STATUS_COLOR: Record<string, "gray" | "yellow" | "sky" | "purple" | "green" | "red"> = {
  DETAILS_INCOMPLETE: "red",
  SENT_FOR_APPROVAL:  "yellow",
  APPROVED:           "sky",
  CLAIMED:            "purple",
  SETTLED:            "green",
  DECLINED:           "red",
};
const CONDITION_DISPLAY: Record<string, IPCondition> = {
  STABLE: "Stable", CRITICAL: "Critical", SERIOUS: "Serious",
  UNDER_OBSERVATION: "Under Observation", IMPROVING: "Improving",
};

// Local calendar date (YYYY-MM-DD). Must NOT use toISOString() (UTC): between
// 00:00–05:30 IST that returns the previous day, so an admissionDate paired
// with a local admissionTime would disagree and corrupt length-of-stay / ward
// day counts. Built from local getFullYear/Month/Date to stay on one clock.
function localDate() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// --- Empty form state ---------------------------------------------------------
function emptyForm() {
  return {
    name: "", dob: "", gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    bloodGroup: "",
    maritalStatus: "",
    phone: "", alternatePhone: "", email: "",
    address: "", area: "", district: "",
    illness: "", referredBy: "",
    doctorName: "", doctorId: null as number | null, department: "",
    planOfCare: "", expectedCost: "", expectedOutcome: "",
    type: "IP" as "OP" | "IP",
    admissionType: "Planned Treatment" as "Planned Treatment" | "Emergency" | "Maternity" | "Daycare",
    wardId: null as number | null, bedId: null as number | null,
    paymentMode: "CASH" as "CASH" | "INSURANCE",
    isInsurance: false,
    insuranceCompany: "", insuranceCompanyId: null as number | null,
    tpaName: "", policyNo: "",
    insuranceClaimType: "" as "" | "REIMBURSEMENT" | "CASHLESS",
    attendantName: "", attendantRelation: "", attendantPhone: "",
    idProofType: "", idProofNo: "",
    notes: "",
    // Admission-level flags (relayed to the admission record on IP registration; NOT stored on Patient)
    freePatient: false,
    surgical: false,
    mlc: false,
    mlcNumber: "",
  };
}

// --- Section heading helper ---------------------------------------------------
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1 mb-1">
      {children}
    </h3>
  );
}

// --- Admission Order Slip print helper ----------------------------------------
interface AdmissionSlipData {
  patientName: string;
  uhid: string;
  age: number | null;
  gender: string;
  admissionDate: string;
  admissionTime: string;
  doctorName: string;
  provisionalDiagnosis: string;
  planOfCare?: string;
  expectedCost?: string;
  expectedOutcome?: string;
  wardName?: string;
  bedNumber?: string;
  admissionNo?: string;
}

function buildAdmissionSlipHtml(d: AdmissionSlipData): string {
  const escA = (v: unknown) => String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}/images/sen-logo.png`;
  const dateTime = `${d.admissionDate}${d.admissionTime ? " " + d.admissionTime : ""}`;
  const ageSex = `${d.age != null ? d.age + " Yrs" : "—"} / ${d.gender.charAt(0).toUpperCase()}`;
  const ward = d.wardName ? `${d.wardName}${d.bedNumber ? " — Bed " + d.bedNumber : ""}` : "";
  const pid = `${d.uhid}${d.admissionNo ? "  |  Adm No: " + d.admissionNo : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admission Order Slip — ${escA(d.patientName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Times New Roman", Georgia, serif; background: #e2e8f0; display: flex; align-items: flex-start; justify-content: center; min-height: 100vh; padding: 20px; color: #000; }
        .slip { background: #fff; width: 800px; padding: 24px 32px 20px; border: 1px solid #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); display: flex; flex-direction: column; min-height: 1050px; }
        /* ── Letterhead Header ── */
        .head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 4px; }
        .head .logo { width: 160px; flex: 0 0 160px; text-align: left; }
        .head .logo img { max-width: 155px; max-height: 65px; object-fit: contain; }
        .head .center { flex: 1 1 auto; text-align: center; padding: 0 10px; }
        .head .spacer { width: 160px; flex: 0 0 160px; }
        .hosp-name { font-family: "Times New Roman", Georgia, serif; font-size: 27px; font-weight: 800; letter-spacing: 0.5px; line-height: 1.1; color: #000; }
        .regd { font-family: "Times New Roman", Georgia, serif; font-size: 13px; font-weight: 700; margin-top: 1px; }
        .tagline { font-size: 22px; font-style: italic; font-family: "Brush Script MT", "Segoe Script", "Dancing Script", cursive; margin-top: 1px; color: #111; }
        .contact { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 600; margin-top: 3px; line-height: 1.35; }
        .hr { border: 0; border-top: 1px solid #71717a; margin: 4px 0; }
        /* ── Title ── */
        .title { text-align: center; font-weight: 800; font-size: 20px; font-family: Arial, Helvetica, sans-serif; letter-spacing: 1px; margin: 24px 0 28px 0; text-transform: uppercase; }
        /* ── Form Fields Grid ── */
        .form-grid { display: flex; flex-direction: column; gap: 22px; flex: 1 0 auto; }
        .field-row { display: flex; align-items: flex-end; font-size: 16px; font-family: Arial, Helvetica, sans-serif; }
        .field-label { width: 170px; flex: 0 0 170px; font-weight: 600; color: #1e1b4b; }
        .colon { width: 25px; flex: 0 0 25px; font-weight: 600; }
        .dotted-line-container { flex: 1 1 auto; border-bottom: 1.5px dotted #334155; min-height: 24px; font-size: 16px; font-weight: 600; color: #000; padding-left: 8px; padding-bottom: 2px; }
        .dotted-line-standalone { width: 100%; border-bottom: 1.5px dotted #334155; min-height: 24px; margin-top: 14px; padding-left: 8px; font-size: 16px; font-weight: 600; color: #000; }
        .standalone-container { padding-left: 195px; }
        .outcome-row .dotted-line-container { flex: 0 0 55%; }
        /* ── Footer ── */
        .footer-section { margin-top: 40px; }
        .signature-row { display: flex; justify-content: flex-end; margin-bottom: 40px; }
        .signature-text { font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-style: italic; font-weight: 600; color: #1e1b4b; }
        .disclaimer-text { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 600; color: #1e1b4b; }
        /* Print styles */
        @media print {
            body { background: #fff; padding: 0; }
            .slip { border: none; box-shadow: none; width: 100%; padding: 8mm 12mm; min-height: 100vh; }
            @page { size: A4 portrait; margin: 6mm; }
        }
    </style>
</head>
<body>
    <div class="slip">
        <!-- Letterhead Header -->
        <div class="head">
            <div class="logo">
                <img src="${logoUrl}" alt="SEN HOSPITAL" onerror="this.style.display='none'" />
            </div>
            <div class="center">
                <div class="hosp-name">SEN HOSPITAL</div>
                <div class="regd">(Regd. No. : CHENALL20210030927)</div>
                <div class="tagline">Multi Speciality Centre</div>
                <div class="contact">
                    Tel : 25586896, 42769724, Cell : 9600899382, 72002 07833<br />
                    Email : senhospital2@gmail.com &nbsp;&nbsp; Web : www.senhospital.in
                </div>
            </div>
            <div class="spacer"></div>
        </div>

        <hr class="hr" />

        <!-- Title -->
        <div class="title">ADMISSION ORDER SLIP</div>

        <!-- Form Fields Grid -->
        <div class="form-grid">
            <div class="field-row">
                <div class="field-label">Date &amp; Time</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(dateTime)}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Patient Name</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(d.patientName)}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Age/Sex</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(ageSex)}</div>
            </div>
            <div class="field-row">
                <div class="field-label">PID No</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(pid)}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Ward / Bed</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(ward)}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Consultant</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(d.doctorName || "")}</div>
            </div>
            <!-- Diagnosis (Multi-line) -->
            <div>
                <div class="field-row">
                    <div class="field-label">Diagnosis</div>
                    <div class="colon">:</div>
                    <div class="dotted-line-container">${escA(d.provisionalDiagnosis || "")}</div>
                </div>
                <div class="standalone-container">
                    <div class="dotted-line-standalone"></div>
                </div>
            </div>
            <!-- Plan of care (Multi-line) -->
            <div>
                <div class="field-row">
                    <div class="field-label">Plan of care</div>
                    <div class="colon">:</div>
                    <div class="dotted-line-container">${escA(d.planOfCare || "")}</div>
                </div>
                <div class="standalone-container">
                    <div class="dotted-line-standalone"></div>
                    <div class="dotted-line-standalone"></div>
                </div>
            </div>
            <!-- Expected Cost -->
            <div class="field-row">
                <div class="field-label">*Expected Cost</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${d.expectedCost ? "₹ " + escA(d.expectedCost) : ""}</div>
            </div>
            <!-- Expected Outcome -->
            <div class="field-row outcome-row">
                <div class="field-label">*Expected Outcome</div>
                <div class="colon">:</div>
                <div class="dotted-line-container">${escA(d.expectedOutcome || "")}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer-section">
            <div class="signature-row">
                <div class="signature-text">Signature of the Consultant</div>
            </div>
            <div class="disclaimer-text">*Subject to change during the course of disease</div>
        </div>
    </div>
</body>
</html>`;
}

function printAdmissionSlip(data: AdmissionSlipData) {
  printHtml(buildAdmissionSlipHtml(data));
}

// --- Current-episode cell renderer --------------------------------------------
// Type-aware "Location / Episode" cell: for an active IP it shows ward · bed and
// the admission no; for OP it shows "OPD" plus the latest visit / token no. Falls
// back to "—" when the patient has no recorded episode.
function renderEpisodeLocation(p: PatientResponse): React.ReactNode {
  const ep = p.currentEpisode;
  if (!ep) return <span className="text-slate-400">—</span>;

  if (ep.kind === "IP") {
    const ward = ep.wardName ?? "—";
    const bed = ep.bedNumber ? ` · Bed ${ep.bedNumber}` : "";
    return (
      <div className="min-w-0">
        <span className="font-medium text-slate-700 block truncate max-w-[160px]" title={`${ward}${bed}`}>{ward}{bed}</span>
        {ep.episodeNo && <span className="block text-slate-400 truncate max-w-[160px]">{ep.episodeNo}</span>}
      </div>
    );
  }

  // OP episode
  const ref = ep.episodeNo ?? ep.tokenNo;
  return (
    <div>
      <span className="font-medium text-slate-700">OPD</span>
      {ref && <span className="block text-slate-400">{ref}</span>}
    </div>
  );
}

// Build the editable PatientDetailFields object from a full patient record.
// Used to pre-fill the patient-correction section inside the Admit modals.
function patientToDetailFields(p: PatientResponse): PatientDetailFields {
  return {
    name: p.name ?? "",
    dob: p.dateOfBirth ?? "",
    gender: p.gender,
    maritalStatus: p.maritalStatus ?? "",
    bloodGroup: p.bloodGroup ?? "",
    phone: p.phone ?? "",
    alternatePhone: p.alternatePhone ?? "",
    email: p.email ?? "",
    area: p.area ?? "",
    district: p.district ?? "",
    address: p.address ?? "",
    referredBy: p.referredBy ?? "",
    department: p.department ?? "",
    doctorName: p.doctorName ?? "",
    doctorId: p.doctorId ?? null,
    idProofType: p.idProofType ?? "",
    idProofNo: p.idProofNo ?? "",
  };
}

// Build the PUT /api/patients/{id} body from the editable detail fields.
// Note: the backend ignores a phone change unless the caller is Admin/MD, and
// age is derived from the date of birth.
function detailFieldsToPatientBody(f: PatientDetailFields) {
  return {
    name: f.name,
    dateOfBirth: f.dob || null,
    age: f.dob ? calcAge(f.dob) : null,
    gender: f.gender,
    bloodGroup: f.bloodGroup || null,
    maritalStatus: f.maritalStatus || null,
    phone: f.phone,
    alternatePhone: f.alternatePhone || null,
    email: f.email || null,
    address: f.address || null,
    area: f.area || null,
    district: f.district || null,
    referredBy: f.referredBy || null,
    doctorName: f.doctorName || null,
    doctorId: f.doctorId || null,
    department: f.department || null,
    idProofType: f.idProofType || null,
    idProofNo: f.idProofNo || null,
  };
}

// --- Shared Patient Details fields -------------------------------------------
// The patient-entity fields shown both on the Edit Patient tab and inside the
// Admit modals. Kept as one component so the field set never drifts.
export interface PatientDetailFields {
  name: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  maritalStatus: string;
  bloodGroup: string;
  phone: string;
  alternatePhone: string;
  email: string;
  area: string;
  district: string;
  address: string;
  referredBy: string;
  department: string;
  doctorName: string;
  doctorId: number | null;
  idProofType: string;
  idProofNo: string;
}

interface PatientDetailsFieldsProps {
  value: PatientDetailFields;
  onChange: (patch: Partial<PatientDetailFields>) => void;
  errors?: { name?: string; dob?: string; gender?: string; phone?: string };
  // Primary mobile is admin-only (identity/de-dup/SMS key).
  phoneEditable: boolean;
  // Supporting master lists (passed from the page).
  areaOptions: string[];
  districtOptions: string[];
  referrers: ReferrerOption[];
  departments: DeptOption[];
  doctors: DoctorOption[];
  onAddArea: (v: string) => void;
  onAddDistrict: (v: string) => void;
  onAddReferrer: () => void;
}

function PatientDetailsFields({
  value: f, onChange, errors = {}, phoneEditable,
  areaOptions, districtOptions, referrers, departments, doctors,
  onAddArea, onAddDistrict, onAddReferrer,
}: PatientDetailsFieldsProps) {
  return (
    <>
      <SectionHeading>Basic Details</SectionHeading>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <FormField label="Full Name" required error={errors.name}>
          <Input value={f.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Patient full name" />
        </FormField>
        <FormField label="Date of Birth" error={errors.dob}>
          <Input type="date" value={f.dob} onChange={(e) => onChange({ dob: e.target.value })} />
        </FormField>
        <FormField label="Age (auto)">
          <Input value={f.dob ? calcAge(f.dob) + " years" : "—"} disabled />
        </FormField>
        <FormField label="Gender" required error={errors.gender}>
          <Select value={f.gender} onChange={(e) => onChange({ gender: e.target.value as "MALE" | "FEMALE" | "OTHER" })}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormField>
        <FormField label="Marital Status">
          <Select value={f.maritalStatus} onChange={(e) => onChange({ maritalStatus: e.target.value })}>
            <option value="">Select…</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
            <option value="WIDOWED">Widowed</option>
            <option value="DIVORCED">Divorced</option>
          </Select>
        </FormField>
        <FormField label="Blood Group">
          <Select value={f.bloodGroup} onChange={(e) => onChange({ bloodGroup: e.target.value })}>
            <option value="">Select…</option>
            {BLOOD_GROUP_KEYS.map((k) => <option key={k} value={k}>{BLOOD_GROUPS[k]}</option>)}
          </Select>
        </FormField>
        <FormField label="Phone" required error={errors.phone}>
          <Input type="tel" inputMode="numeric" maxLength={10}
            disabled={!phoneEditable}
            value={f.phone}
            onChange={(e) => onChange({ phone: e.target.value.replace(/\D/g, "") })}
            placeholder="10-digit mobile number" />
          {!phoneEditable && (
            <p className="text-xs text-slate-400 mt-1">Only an Admin can change the mobile number.</p>
          )}
        </FormField>
        <FormField label="Alternate Phone">
          <Input type="tel" inputMode="numeric" maxLength={10} value={f.alternatePhone} onChange={(e) => onChange({ alternatePhone: e.target.value.replace(/\D/g, "") })} placeholder="Optional" />
        </FormField>
        <FormField label="Email">
          <Input type="email" value={f.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="Optional" />
        </FormField>
        <FormField label="Area">
          <CreatableSelect
            value={f.area}
            options={areaOptions.map((a) => ({ value: a, label: a }))}
            onChange={(v) => onChange({ area: v })}
            onAdd={(v) => { onAddArea(v); onChange({ area: v }); }}
            placeholder="Select area…"
            searchPlaceholder="Search or type new area…"
            addLabel={(q) => `+ Add "${q}" as new area`}
          />
        </FormField>
        <FormField label="District">
          <CreatableSelect
            value={f.district}
            options={districtOptions.map((d) => ({ value: d, label: d }))}
            onChange={(v) => onChange({ district: v })}
            onAdd={(v) => { onAddDistrict(v); onChange({ district: v }); }}
            placeholder="Select district…"
            searchPlaceholder="Search or type new district…"
            addLabel={(q) => `+ Add "${q}" as new district`}
          />
        </FormField>
      </div>
      <FormField label="Address">
        <Textarea value={f.address} onChange={(e) => onChange({ address: e.target.value })} placeholder="Full address" rows={1} />
      </FormField>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <FormField label="Referred By">
          <div className="flex gap-1.5">
            <div className="flex-1">
              <SearchSelect
                value={f.referredBy}
                placeholder="— None / Self —"
                searchPlaceholder="Search referrer…"
                emptyText="No referrers found"
                options={[
                  { value: "", label: "— None / Self —" },
                  ...referrers.map((r) => ({
                    value: r.name, label: r.name,
                    sublabel: r.specialization ?? undefined,
                  })),
                ]}
                onChange={(v) => onChange({ referredBy: v })}
              />
            </div>
            <button type="button"
              onClick={onAddReferrer}
              title="Add new referrer"
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </FormField>
        <FormField label="Department">
          <Select value={f.department} onChange={(e) => onChange({ department: e.target.value, doctorName: "", doctorId: null })}>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id}>{d.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Doctor">
          <Select value={f.doctorName} onChange={(e) => {
            const doc = doctors.find(d => d.name === e.target.value);
            onChange({ doctorName: e.target.value, doctorId: doc?.id ?? null });
          }}>
            <option value="">Select doctor</option>
            {doctors.filter((d) => !f.department || d.department === f.department).map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <SectionHeading>ID Proof</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="ID Proof Type">
          <Select value={f.idProofType} onChange={(e) => onChange({ idProofType: e.target.value })}>
            <option value="">Select</option>
            <option value="Aadhaar">Aadhaar</option>
            <option value="PAN">PAN</option>
            <option value="Voter ID">Voter ID</option>
            <option value="Passport">Passport</option>
            <option value="Driving License">Driving License</option>
            <option value="Other">Other</option>
          </Select>
        </FormField>
        {f.idProofType && (
          <FormField label="ID Proof Number">
            <Input value={f.idProofNo} onChange={(e) => onChange({ idProofNo: e.target.value })} placeholder="Enter ID number" />
          </FormField>
        )}
      </div>
    </>
  );
}

// --- Component ----------------------------------------------------------------
export default function PatientsPage() {
  const session = getSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Guards the one-shot ?admitPatientId deep-link (from the OP queue Admit button).
  const admitDeepLinkDone = useRef(false);
  const role = session?.role ?? "Receptionist";
  const canManagePatients = role === "Admin" || role === "Managing Director" || role === "Receptionist" || role === "Lab/Ins/Reception";
  // Only Admin / Managing Director may change a patient's primary mobile number
  // (it's the identity / de-dup / SMS key). Enforced server-side too.
  const isAdmin = role === "Admin" || role === "Managing Director";
  const userName = session?.name ?? "";

  // -- Data from backend --
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  // Collect Cash (advance receipt) modal — patient-list entry point.
  const [collectPatient, setCollectPatient] = useState<CollectCashPatient | null>(null);
  // Receipts ledger expander — which patient row is open, + a counter to force
  // the open panel to re-fetch after a new receipt is collected.
  const [expandedReceiptsPatient, setExpandedReceiptsPatient] = useState<number | null>(null);
  const [receiptsRefresh, setReceiptsRefresh] = useState(0);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [insuranceCoList, setInsuranceCoList] = useState<InsuranceCompanyOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [allBeds, setAllBeds] = useState<BedOption[]>([]);
  const [referrers, setReferrers] = useState<ReferrerOption[]>([]);
  // Area / District options sourced from the shared Dropdowns master.
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterView>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Server-side paging state. `page` is 0-indexed (matches the backend).
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  // Per-tab patient counts (from GET /patients/counts) for the filter dropdown.
  const [counts, setCounts] = useState<PatientCounts>({ all: 0, op: 0, ip: 0, both: 0 });

  // -- Modals --
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<PatientResponse | null>(null);
  // Active admission loaded alongside Edit Patient (editable in the "Admission Details" tab)
  const [editActiveAdmission, setEditActiveAdmission] = useState<AdmissionResponse | null>(null);
  // Which tab is active inside the Edit modal: patient (read-only) or admission (editable)
  const [editTab, setEditTab] = useState<"patient" | "admission">("patient");
  // Editable admission form (separate from the patient `form`; saved via PUT /api/admissions/{id})
  const [admEditForm, setAdmEditForm] = useState<{
    patientName: string;
    admissionType: "Planned Treatment" | "Emergency" | "Maternity" | "Daycare";
    admissionDate: string;
    admissionTime: string;
    provisionalDiagnosis: string;
    condition: IPCondition;
    admittingDoctorName: string; admittingDoctorId: number | null;
    department: string;
    attendantName: string; attendantRelation: string; attendantPhone: string;
    paymentMode: string;
    isInsurance: boolean; insuranceStatus: string;
    insuranceCompany: string; insuranceCompanyId: number | null;
    policyNo: string; tpaName: string; claimNo: string; preAuthNumber: string;
    insuranceClaimType: "" | "REIMBURSEMENT" | "CASHLESS";
    free: boolean; surgical: boolean; mlc: boolean; mlcNumber: string;
    planOfCare: string; expectedCost: string; expectedOutcome: string;
    notes: string;
  } | null>(null);
  const [admEditSaving, setAdmEditSaving] = useState(false);
  const [admEditError, setAdmEditError] = useState<string | null>(null);

  // -- Register modal tab: "new" | "existing" --
  const [registerTab, setRegisterTab] = useState<"new" | "existing">("new");
  const [existingSearch, setExistingSearch] = useState("");
  const [existingOpts, setExistingOpts] = useState<PatientResponse[]>([]);
  const [existingSearching, setExistingSearching] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<PatientResponse | null>(null);
  const [existingBillBlock, setExistingBillBlock] = useState<{ dueAmount: number } | null>(null);
  const [existingAdmitForm, setExistingAdmitForm] = useState<typeof admitForm | null>(null);
  const [existingSaving, setExistingSaving] = useState(false);
  const [existingApiErr, setExistingApiErr] = useState("");
  const [statusPatient, setStatusPatient] = useState<PatientResponse | null>(null);
  const [historyPatient, setHistoryPatient] = useState<PatientResponse | null>(null);
  const [historyAdmissions, setHistoryAdmissions] = useState<AdmissionResponse[]>([]);
  const [opVisits, setOpVisits] = useState<OPVisitResponse[]>([]);
  const [admitPatient, setAdmitPatient] = useState<PatientResponse | null>(null);

  // -- Register / Edit form --
  const [form, setForm] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // -- Patient-detail corrections captured inside the Admit modals --
  // These mirror the Edit Patient fields and are saved via PUT /api/patients/{id}
  // BEFORE the admission is created, so the correction lands on the patient master
  // (and the admission's snapshot picks up the corrected values).
  const [admitPatientForm, setAdmitPatientForm] = useState<PatientDetailFields | null>(null);
  const [existingPatientForm, setExistingPatientForm] = useState<PatientDetailFields | null>(null);

  // -- Admit form --
  const [admitForm, setAdmitForm] = useState<{
    admissionType: "Planned Treatment" | "Emergency" | "Maternity" | "Daycare";
    wardId: number | null; bedId: number | null;
    admittedDate: string; admittedTime: string;
    provisionalDiagnosis: string;
    condition: IPCondition;
    mlc: boolean; mlcNumber: string;
    free: boolean;
    surgical: boolean;
    // Insurance at admit time is just a flag — details are captured later via
    // the Insurance workflow. No company/policy/TPA entry on the admit form.
    isInsurance: boolean;
    emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string;
    planOfCare: string; expectedCost: string; expectedOutcome: string;
    notes: string;
  }>({
    admissionType: "Planned Treatment",
    wardId: null, bedId: null,
    admittedDate: localDate(),
    admittedTime: new Date().toTimeString().slice(0, 5),
    provisionalDiagnosis: "",
    condition: "Stable",
    mlc: false, mlcNumber: "",
    free: false,
    surgical: false,
    isInsurance: false,
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    planOfCare: "", expectedCost: "", expectedOutcome: "",
    notes: "",
  });
  const [admitErrors, setAdmitErrors] = useState<Record<string, string>>({});

  // -- Inline "Add Referrer" mini-modal (registration form) --
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [refForm, setRefForm] = useState(emptyRefForm());
  const [refSaving, setRefSaving] = useState(false);
  const [refErr, setRefErr] = useState("");

  // -- IP Status update --
  const [statusForm, setStatusForm] = useState({
    field: "condition" as string,
    to: "",
    wardId: null as number | null,
    bedId: null as number | null,
    newDoctor: "",
    notes: "",
    finalDiagnosis: "",
    referredTo: "",
  });
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusApiError, setStatusApiError] = useState<string | null>(null);
  const [activeAdmission, setActiveAdmission] = useState<AdmissionResponse | null>(null);

  // -- Bill check state for discharge --
  const [billCheckWarning, setBillCheckWarning] = useState<{
    patientId: number;
    admissionId: number;
    dueAmount: number;
    draftSaved: boolean;
  } | null>(null);
  const [admissionLoading, setAdmissionLoading] = useState(false);

  // -- Lab order --
  const [labTests, setLabTests] = useState<{
    id: number; testCode: string; name: string; category: string; price: number;
    normalRange?: string; unit?: string; sampleType?: string; turnaroundTime?: string;
    priority: LabPriority;
  }[]>([]);
  const [labMasterList, setLabMasterList] = useState<{
    id: number; testCode: string; name: string; category: string; price: number;
    normalRange?: string; unit?: string; sampleType?: string; turnaroundTime?: string;
  }[]>([]);

  // -- Load patients (server-side paging + whole-DB search) --
  // Search runs on the backend so a query matches patients anywhere in the DB,
  // not just the current page. Filter tab → patientType(s), From/To → createdAt
  // range. After each fetch we also refresh the per-tab counts so the dropdown
  // totals stay accurate (the loaded page alone can no longer compute them).
  const loadPatients = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    const s = debouncedSearch.trim();
    if (s) qs.set("search", s);
    filterToPatientTypes(filter).forEach((t) => qs.append("patientType", t));
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    const { ok, data, error } = await apiFetch(`/api/patients?${qs}`);
    if (!ok) { setFetchErr(error); setPatients([]); setTotalElements(0); setTotalPages(0); setLoading(false); return; }
    const pr = data as PagedShape<PatientResponse>;
    setPatients(pr?.content ?? []);
    setTotalElements(pr?.totalElements ?? 0);
    setTotalPages(pr?.totalPages ?? 0);
    setLoading(false);
    // Refresh tab counts (single grouped query — cheap, keeps them fresh after
    // any list reload including post-mutation refetches).
    apiFetch("/api/patients/counts").then(({ ok: cOk, data: cData }) => {
      if (cOk) setCounts((cData as PatientCounts) ?? { all: 0, op: 0, ip: 0, both: 0 });
    });
  }, [page, debouncedSearch, filter, dateFrom, dateTo]);

  // Reload just the beds (called after any admission / transfer to keep availability fresh)
  const reloadBeds = useCallback(async (wardList?: WardOption[]) => {
    const list = wardList ?? wards;
    if (list.length === 0) return;
    const results = await Promise.all(
      list.map((w) =>
        apiFetch(`/api/masters/wards/${w.id}/beds`).then(({ ok: bOk, data: bData }) =>
          bOk ? ((bData as BedOption[] | null) ?? []).map((b) => ({ ...b, wardId: w.id })) : []
        )
      )
    );
    setAllBeds(results.flat());
  }, [wards]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supporting masters — load ONCE on mount. (Previously this shared an effect
  // with loadPatients; once the list moved to server-side paging the two had to
  // split so the masters wouldn't refetch on every page/filter change.)
  useEffect(() => {
    apiFetch("/api/masters/doctors?page=0&size=200&active=true").then(({ ok, data }) => {
      if (ok) setDoctors((data?.content ?? data ?? []).map((d: { id: number; name: string; department: string | null }) => ({ id: d.id, name: d.name, department: d.department })));
    });
    apiFetch("/api/masters/departments?page=0&size=200").then(({ ok, data }) => {
      if (ok) setDepartments((data?.content ?? data ?? []).map((d: { id: number; name: string }) => ({ id: d.id, name: d.name })));
    });
    apiFetch("/api/masters/wards?page=0&size=200").then(({ ok, data }) => {
      if (ok) {
        const wardList: WardOption[] = (data?.content ?? data ?? []).map((w: { id: number; name: string; status: string }) => ({ id: w.id, name: w.name, status: w.status }));
        setWards(wardList);
        Promise.all(wardList.map((w) =>
          apiFetch(`/api/masters/wards/${w.id}/beds`).then(({ ok: bOk, data: bData }) =>
            bOk ? ((bData as BedOption[] | null) ?? []).map((b) => ({ ...b, wardId: w.id })) : []
          )
        )).then((results) => setAllBeds(results.flat()));
      }
    });
    apiFetch("/api/masters/lab-masters?page=0&size=500").then(({ ok, data }) => {
      if (ok) {
        const raw = (data as { content?: unknown[] })?.content ?? data ?? [];
        setLabMasterList((Array.isArray(raw) ? raw : []).filter((l: { status?: string }) => l.status === "ACTIVE") as typeof labMasterList);
      }
    });
    apiFetch("/api/masters/insurance-companies?page=0&size=200").then(({ ok, data }) => {
      if (ok) {
        const raw: Array<{ id: number; name: string; tpaName: string | null; tpaNames?: string[] | null; status: string }> = data?.content ?? data ?? [];
        setInsuranceCoList(raw.filter(c => c.status === "ACTIVE").map(c => ({
          id: c.id, name: c.name, tpaName: c.tpaName,
          tpaNames: (c.tpaNames && c.tpaNames.length > 0) ? c.tpaNames : (c.tpaName ? [c.tpaName] : []),
        })));
      }
    });
    apiFetch("/api/masters/referrers?page=0&size=200&status=ACTIVE").then(({ ok, data }) => {
      if (ok) {
        const raw: Array<{ id: number; name: string; specialization: string | null }> = data?.content ?? data ?? [];
        setReferrers(raw.map(r => ({ id: r.id, name: r.name, specialization: r.specialization ?? null })));
      }
    });
    // Area / District lists from the shared Dropdowns master (active only).
    apiFetch("/api/masters/dropdowns?category=AREA&status=ACTIVE&size=1000").then(({ ok, data }) => {
      if (ok) setAreaOptions(((data?.content ?? data ?? []) as Array<{ label: string }>).map((o) => o.label));
    });
    apiFetch("/api/masters/dropdowns?category=DISTRICT&status=ACTIVE&size=1000").then(({ ok, data }) => {
      if (ok) setDistrictOptions(((data?.content ?? data ?? []) as Array<{ label: string }>).map((o) => o.label));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  // On commit we also drop back to page 0 so the first page of fresh results shows.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch the list whenever the debounced search / filter / date range / page
  // changes. loadPatients is a useCallback keyed on exactly those values, so its
  // identity change is what triggers this effect.
  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Persist a newly-typed Area / District to the shared Dropdowns master so it
  // becomes permanent and appears everywhere (OP modal + Dropdowns admin too).
  const addDropdownOption = useCallback(async (category: "AREA" | "DISTRICT", rawValue: string) => {
    const val = rawValue.trim();
    if (!val) return;
    const bump = (prev: string[]) =>
      prev.includes(val) ? prev : [...prev, val].sort((a, b) => a.localeCompare(b));
    if (category === "AREA") setAreaOptions(bump);
    else setDistrictOptions(bump);
    await apiFetch("/api/masters/dropdowns?idempotent=true", {
      method: "POST",
      body: JSON.stringify({ category, label: val }),
    });
  }, []);

  // ── Deep-link: ?admitPatientId=<id> (from the OP queue "Admit" button) ──
  // Fetch the patient and open the Admit modal pre-filled — no re-search.
  // Runs once; the URL param is cleared afterwards so a refresh won't re-trigger.
  useEffect(() => {
    if (admitDeepLinkDone.current) return;
    const admitId = searchParams.get("admitPatientId");
    if (!admitId) return;
    admitDeepLinkDone.current = true;
    (async () => {
      const { ok, data } = await apiFetch(`/api/patients/${admitId}`);
      if (ok && data) openAdmit(data as PatientResponse);
      // Strip the param so a manual refresh doesn't reopen the modal.
      router.replace("/patients");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // -- List / counts now come from the server --
  // `patients` holds the current page's rows (server-paged at PAGE_SIZE).
  // `counts` (state, from GET /patients/counts) drives the filter-dropdown
  // totals. Filtering, search and date range are all applied server-side, so the
  // rows here are already the final, filtered, sorted result for this page.
  const tabCounts = {
    All: counts.all,
    "Out Patients": counts.op,
    "In Patients": counts.ip + counts.both,
    "In Patients — In Bed": counts.ip,
    "In Patients — Discharged": counts.both,
  };

  const availableBeds = useMemo(() =>
    form.wardId ? allBeds.filter((b) => b.wardId === form.wardId && b.status === "AVAILABLE") : [],
    [allBeds, form.wardId]
  );
  const availableAdmitBeds = useMemo(() =>
    admitForm.wardId ? allBeds.filter((b) => b.wardId === admitForm.wardId && b.status === "AVAILABLE") : [],
    [allBeds, admitForm.wardId]
  );

  // -- Register / Edit handlers --
  function openRegister() {
    setForm(emptyForm()); setFormErrors({}); setApiError(null);
    setRegisterTab("new");
    setExistingSearch(""); setExistingOpts([]); setSelectedExisting(null);
    setExistingBillBlock(null); setExistingApiErr(""); setExistingAdmitForm(null); setExistingPatientForm(null);
    setRefModalOpen(false); setRefForm(emptyRefForm()); setRefErr("");
    setRegisterOpen(true);
  }

  // -- Inline add-referrer (registration modal) --
  async function handleSaveReferrer() {
    if (!refForm.name.trim()) { setRefErr("Name is required"); return; }
    if (refForm.phone?.trim() && !/^\d{10}$/.test(refForm.phone.trim())) {
      setRefErr("Enter a valid 10-digit phone number"); return;
    }
    setRefSaving(true); setRefErr("");
    const { ok, data, error } = await apiFetch("/api/masters/referrers", {
      method: "POST",
      body: JSON.stringify({
        name: refForm.name.trim(),
        type: refForm.type,
        specialization: refForm.specialization || null,
        organization: refForm.organization || null,
        phone: refForm.phone || null,
        notes: refForm.notes || null,
        status: "ACTIVE",
      }),
    });
    setRefSaving(false);
    if (!ok) { setRefErr(error ?? "Failed to save referrer"); return; }
    const newRef: ReferrerOption = {
      id: (data as { id: number }).id,
      name: refForm.name.trim(),
      specialization: refForm.specialization || null,
    };
    setReferrers((prev) => [...prev, newRef].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({ ...prev, referredBy: newRef.name }));
    setRefModalOpen(false);
    setRefForm(emptyRefForm());
  }
  // -- Existing patient live search (debounced) --
  useEffect(() => {
    if (!existingSearch.trim() || existingSearch.length < 2 || selectedExisting) {
      setExistingOpts([]); return;
    }
    const t = setTimeout(async () => {
      setExistingSearching(true);
      const { ok, data } = await apiFetch(`/api/patients?search=${encodeURIComponent(existingSearch.trim())}&page=0&size=15`);
      if (ok) setExistingOpts((data?.content ?? data ?? []) as PatientResponse[]);
      setExistingSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [existingSearch, selectedExisting]);

  function selectExistingPatient(p: PatientResponse) {
    setSelectedExisting(p);
    setExistingSearch(`${p.name} — ${p.uhid}`);
    setExistingOpts([]);
    setExistingBillBlock(null);
    setExistingApiErr("");
    // Guard: already-admitted patient (type IP) has an active admission — block
    // re-admit. Don't build the admit form so there's nothing to submit.
    if (p.patientType === "IP") {
      setExistingAdmitForm(null);
      setExistingPatientForm(null);
      setExistingApiErr(`${p.name} already has an active admission. Discharge the current admission before re-admitting.`);
      return;
    }
    // Pre-fill the editable patient-detail section + upgrade to the full record.
    setExistingPatientForm(patientToDetailFields(p));
    (async () => {
      const { ok, data } = await apiFetch(`/api/patients/${p.id}`);
      if (ok && data) setExistingPatientForm(patientToDetailFields(data as PatientResponse));
    })();
    // Pre-fill admission form from patient data
    setExistingAdmitForm({
      admissionType: "Planned Treatment", wardId: null, bedId: null,
      admittedDate: localDate(),
      admittedTime: new Date().toTimeString().slice(0, 5),
      provisionalDiagnosis: p.illness ?? "", condition: "Stable",
      mlc: false, mlcNumber: "",
      free: false,
      surgical: false,
      isInsurance: !!(p.insuranceCompany || p.policyNo),
      emergencyContactName: p.attendantName ?? "",
      emergencyContactPhone: p.attendantPhone ?? "",
      emergencyContactRelation: p.attendantRelation ?? "",
      planOfCare: "", expectedCost: "", expectedOutcome: "",
      notes: "",
    });
  }

  async function handleExistingAdmit() {
    if (!selectedExisting || !existingAdmitForm) return;
    const p = selectedExisting;
    const f = existingAdmitForm;

    // Safety net: block re-admit if the patient is currently admitted.
    if (p.patientType === "IP") {
      setExistingApiErr(`${p.name} already has an active admission. Discharge it before re-admitting.`);
      return;
    }

    if (!f.wardId || !f.bedId) {
      setExistingApiErr("Ward and Bed are required.");
      return;
    }

    setExistingSaving(true); setExistingApiErr(""); setExistingBillBlock(null);

    // -- Bill check ---------------------------------------------------------
    const billRes = await apiFetch(`/api/bills/patient/${p.id}`);
    if (billRes.ok) {
      const bills: { status: string; dueAmount: number }[] =
        Array.isArray(billRes.data) ? billRes.data : (billRes.data?.content ?? []);
      const totalDue = bills
        .filter(b => b.status === "PENDING" || b.status === "PARTIAL")
        .reduce((s, b) => s + (b.dueAmount ?? 0), 0);
      if (totalDue > 0) {
        setExistingBillBlock({ dueAmount: totalDue });
        setExistingSaving(false);
        return;
      }
    }

    // -- Save patient-detail corrections FIRST (pre-admission edit) ----------
    if (existingPatientForm) {
      const { ok: pOk, error: pErr } = await apiFetch(`/api/patients/${p.id}`, {
        method: "PUT", body: JSON.stringify(detailFieldsToPatientBody(existingPatientForm)),
      });
      if (!pOk) { setExistingApiErr(pErr); setExistingSaving(false); return; }
    }

    // -- Submit admission ----------------------------------------------------
    const admissionBody = {
      patientId: p.id,
      admissionType: ADMISSION_TYPE_MAP[f.admissionType] ?? "PLANNED_TREATMENT",
      admissionDate: f.admittedDate,
      admissionTime: f.admittedTime || null,
      provisionalDiagnosis: f.provisionalDiagnosis || null,
      conditionOnAdmission: CONDITION_ON_ADMISSION_MAP[f.condition] ?? "STABLE",
      admittingDoctorId: existingPatientForm?.doctorId ?? p.doctorId ?? null,
      admittingDoctorName: existingPatientForm?.doctorName || p.doctorName || userName || "Doctor",
      department: existingPatientForm?.department || p.department || null,
      wardId: f.wardId,
      bedId: f.bedId,
      referredBy: existingPatientForm?.referredBy || p.referredBy || null,
      attendantName: f.emergencyContactName || p.attendantName || null,
      attendantRelation: f.emergencyContactRelation || p.attendantRelation || null,
      attendantPhone: f.emergencyContactPhone || p.attendantPhone || null,
      paymentMode: f.isInsurance ? "INSURANCE" : "CASH",
      isInsurance: f.isInsurance,
      insuranceStatus: f.isInsurance ? "DETAILS_INCOMPLETE" : null,
      mlc: f.mlc,
      mlcNumber: f.mlc ? f.mlcNumber : null,
      free: f.free,
      surgical: f.surgical,
      planOfCare: f.planOfCare || null,
      expectedCost: f.expectedCost || null,
      expectedOutcome: f.expectedOutcome || null,
      notes: f.notes || null,
    };

    const { ok, error, data: admData } = await apiFetch("/api/admissions", {
      method: "POST", body: JSON.stringify(admissionBody),
    });
    setExistingSaving(false);

    if (!ok) { setExistingApiErr(error); return; }

    const pf = existingPatientForm;
    await loadPatients(); await reloadBeds();
    setRegisterOpen(false);

    const ward = wards.find(w => w.id === f.wardId);
    const bed = allBeds.find(b => b.id === f.bedId);
    const slipAge = pf?.dob ? calcAge(pf.dob) : (pf ? null : p.age);
    printAdmissionSlip({
      patientName: pf?.name || p.name,
      uhid: p.uhid,
      age: slipAge ?? p.age,
      gender: pf?.gender ?? p.gender,
      admissionDate: f.admittedDate,
      admissionTime: f.admittedTime,
      doctorName: pf?.doctorName || p.doctorName || userName || "",
      provisionalDiagnosis: f.provisionalDiagnosis || p.illness || "",
      planOfCare: f.planOfCare || undefined,
      expectedCost: f.expectedCost || undefined,
      expectedOutcome: f.expectedOutcome || undefined,
      wardName: ward?.name,
      bedNumber: bed?.number,
      admissionNo: (admData as { admissionNo?: string })?.admissionNo,
    });
  }

  // Open the Collect Cash (advance receipt) modal for an IP / BOTH patient.
  // The current IP episode supplies ward/bed/admission-no context; the backend
  // resolves the active admission id from the patient when not supplied here.
  function openCollectCash(p: PatientResponse) {
    const ep = p.currentEpisode?.kind === "IP" ? p.currentEpisode : null;
    setCollectPatient({
      id:          p.id,
      uhid:        p.uhid,
      name:        p.name,
      age:         p.age,
      gender:      p.gender,
      doctorName:  p.doctorName,
      admissionId: ep?.admissionId ?? null, // active admission id (falls back to server-side resolution if null)
      admissionNo: ep?.episodeNo ?? null,
      wardName:    ep?.wardName ?? null,
      bedNumber:   ep?.bedNumber ?? null,
    });
  }

  async function openEdit(summary: PatientResponse) {
    // The patient list returns a lightweight summary (name, dob, age, gender,
    // phone, doctor, department only) — NOT the full record. Fetch the complete
    // patient so the edit form pre-fills every field (address, religion, blood
    // group, insurance, attendant, ID proof, notes…). Fall back to the summary
    // row if the fetch fails so the modal still opens with the basics.
    let p = summary;
    const { ok, data } = await apiFetch(`/api/patients/${summary.id}`);
    if (ok && data) p = data as PatientResponse;

    setForm({
      name: p.name, dob: p.dateOfBirth ?? "", gender: p.gender,
      bloodGroup: p.bloodGroup ?? "",
      maritalStatus: p.maritalStatus ?? "",
      phone: p.phone, alternatePhone: p.alternatePhone ?? "",
      email: p.email ?? "", address: p.address ?? "",
      area: p.area ?? "", district: p.district ?? "",
      illness: p.illness ?? "", referredBy: p.referredBy ?? "Self",
      doctorName: p.doctorName ?? "", doctorId: p.doctorId ?? null,
      department: p.department ?? "",
      planOfCare: "", expectedCost: "", expectedOutcome: "",
      type: p.patientType === "BOTH" ? "IP" : (p.patientType as "OP" | "IP"),
      admissionType: "Planned Treatment" as "Planned Treatment" | "Emergency" | "Maternity" | "Daycare",
      wardId: null, bedId: null,
      paymentMode: (p.insuranceCompany ? "INSURANCE" : "CASH") as "CASH" | "INSURANCE",
      isInsurance: !!p.insuranceCompany,
      insuranceCompany: p.insuranceCompany ?? "", insuranceCompanyId: p.insuranceCompanyId ?? null,
      tpaName: p.tpaName ?? "", policyNo: p.policyNo ?? "",
      insuranceClaimType: "" as "" | "REIMBURSEMENT" | "CASHLESS",
      attendantName: p.attendantName ?? "", attendantRelation: p.attendantRelation ?? "",
      attendantPhone: p.attendantPhone ?? "",
      idProofType: p.idProofType ?? "", idProofNo: p.idProofNo ?? "",
      notes: p.notes ?? "",
      freePatient: false,
      surgical: false,
      mlc: false,
      mlcNumber: "",
    });
    setFormErrors({}); setApiError(null);
    setEditActiveAdmission(null);
    setAdmEditForm(null);
    setAdmEditError(null);
    setEditTab("patient");
    setEditPatient(p);

    // For actively-admitted (IP) patients, load the active admission so the
    // "Admission Details" tab can show + edit it via its own API (PUT /api/admissions/{id}).
    if ((p.patientType === "IP" || p.patientType === "BOTH")) {
      const { ok, data } = await apiFetch(`/api/admissions/patient/${p.id}`);
      if (ok) {
        const list = data as AdmissionResponse[];
        const active = list.find(a => a.status !== "DISCHARGED") ?? null;
        if (active) {
          setEditActiveAdmission(active);
          setAdmEditForm({
            patientName: active.patientName ?? p.name,
            admissionType: ADMISSION_TYPE_DISPLAY[String(active.admissionType)] ?? "Planned Treatment",
            admissionDate: active.admissionDate ?? localDate(),
            admissionTime: active.admissionTime ?? "",
            provisionalDiagnosis: active.provisionalDiagnosis ?? "",
            condition: CONDITION_DISPLAY[String(active.conditionOnAdmission)] ?? "Stable",
            admittingDoctorName: active.admittingDoctorName ?? "",
            admittingDoctorId: active.admittingDoctorId ?? null,
            department: active.department ?? "",
            attendantName: active.attendantName ?? "",
            attendantRelation: active.attendantRelation ?? "",
            attendantPhone: active.attendantPhone ?? "",
            paymentMode: active.paymentMode ?? "",
            isInsurance: active.isInsurance ?? !!(active.insuranceCompany || active.policyNo),
            insuranceStatus: active.insuranceStatus ?? "",
            insuranceCompany: active.insuranceCompany ?? "",
            // Prefer the stored id; fall back to resolving by name against the
            // master so legacy records (name only) still pre-select the dropdown.
            insuranceCompanyId: active.insuranceCompanyId
              ?? insuranceCoList.find(c => c.name === active.insuranceCompany)?.id
              ?? null,
            policyNo: active.policyNo ?? "",
            tpaName: active.tpaName ?? "",
            claimNo: active.claimNo ?? "",
            preAuthNumber: active.preAuthNumber ?? "",
            insuranceClaimType: (active.insuranceClaimType as "REIMBURSEMENT" | "CASHLESS" | undefined) ?? "",
            free: active.free ?? false,
            surgical: active.surgical ?? false,
            mlc: active.mlc ?? false,
            mlcNumber: active.mlcNumber ?? "",
            planOfCare: active.planOfCare ?? "",
            expectedCost: active.expectedCost ?? "",
            expectedOutcome: active.expectedOutcome ?? "",
            notes: active.notes ?? "",
          });
        }
      }
    }
  }

  // Save the editable Admission tab via its own dedicated API.
  async function handleSaveAdmissionEdit() {
    if (!editActiveAdmission || !admEditForm) return;
    setAdmEditSaving(true); setAdmEditError(null);
    const body = {
      patientName: admEditForm.patientName?.trim() || null,
      admissionType: ADMISSION_TYPE_TO_ENUM[admEditForm.admissionType] ?? "PLANNED_TREATMENT",
      admissionDate: admEditForm.admissionDate || null,
      admissionTime: admEditForm.admissionTime || null,
      provisionalDiagnosis: admEditForm.provisionalDiagnosis || null,
      conditionOnAdmission: CONDITION_TO_STATUS[admEditForm.condition] ?? "STABLE",
      admittingDoctorName: admEditForm.admittingDoctorName || null,
      admittingDoctorId: admEditForm.admittingDoctorId || null,
      department: admEditForm.department || null,
      attendantName: admEditForm.attendantName || null,
      attendantRelation: admEditForm.attendantRelation || null,
      attendantPhone: admEditForm.attendantPhone || null,
      paymentMode: admEditForm.paymentMode || null,
      isInsurance: admEditForm.isInsurance,
      insuranceStatus: admEditForm.isInsurance ? (admEditForm.insuranceStatus || "DETAILS_INCOMPLETE") : null,
      insuranceCompany: admEditForm.insuranceCompany || null,
      insuranceCompanyId: admEditForm.insuranceCompanyId || null,
      policyNo: admEditForm.policyNo || null,
      tpaName: admEditForm.tpaName || null,
      claimNo: admEditForm.claimNo || null,
      preAuthNumber: admEditForm.preAuthNumber || null,
      insuranceClaimType: admEditForm.insuranceClaimType || null,
      mlc: admEditForm.mlc,
      mlcNumber: admEditForm.mlc ? admEditForm.mlcNumber : null,
      free: admEditForm.free,
      surgical: admEditForm.surgical,
      planOfCare: admEditForm.planOfCare || null,
      expectedCost: admEditForm.expectedCost || null,
      expectedOutcome: admEditForm.expectedOutcome || null,
      notes: admEditForm.notes || null,
    };
    const { ok, error } = await apiFetch(`/api/admissions/${editActiveAdmission.id}`, {
      method: "PUT", body: JSON.stringify(body),
    });
    setAdmEditSaving(false);
    if (!ok) { setAdmEditError(error); return; }
    setEditPatient(null); setEditActiveAdmission(null); setAdmEditForm(null);
    loadPatients();
  }
  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (!form.gender) e.gender = "Gender is required";
    // IP registration admits the patient in one step, so ward + bed are
    // mandatory (they are admission facts). Without this the form silently
    // downgraded to a patient-only record (no admission) — the asterisks were
    // cosmetic. Enforce them so an IP registration always creates the admission.
    if (form.type === "IP") {
      if (!form.wardId) e.wardId = "Ward is required";
      if (!form.bedId)  e.bedId  = "Bed is required";
    }
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }
  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError(null);
    const body = {
      name: form.name, dateOfBirth: form.dob || null,
      age: form.dob ? calcAge(form.dob) : null,
      gender: form.gender, bloodGroup: form.bloodGroup || null,
      maritalStatus: form.maritalStatus || null,
      phone: form.phone, alternatePhone: form.alternatePhone || null,
      email: form.email || null, address: form.address || null,
      area: form.area || null, district: form.district || null,
      illness: form.illness || null, referredBy: form.referredBy || null,
      doctorName: form.doctorName || null, doctorId: form.doctorId || null,
      department: form.department || null, patientType: form.type,
      insuranceCompany: form.insuranceCompany || null, policyNo: form.policyNo || null,
      attendantName: form.attendantName || null, attendantRelation: form.attendantRelation || null,
      attendantPhone: form.attendantPhone || null, notes: form.notes || null,
      idProofType: form.idProofType || null, idProofNo: form.idProofNo || null,
    };
    if (editPatient) {
      // Correct the patient master. Unlimited while not admitted; exactly ONCE
      // after admission (backend consumes the one-time allowance and locks it).
      // The mobile number is admin-only (editable here only when isAdmin; the
      // backend also rejects a phone change from non-admins). Admission-level
      // facts (name snapshot, free/surgical/mlc, insurance) are edited on the
      // Admission tab via its own API (handleSaveAdmissionEdit → PUT /api/admissions/{id}).
      // Correcting the master here fixes the patient list and all future visits;
      // the already-created current OP visit keeps its snapshot by design.
      const { ok, error } = await apiFetch(`/api/patients/${editPatient.id}`, { method: "PUT", body: JSON.stringify(body) });
      setSaving(false);
      if (!ok) { setApiError(error); return; }
      setEditPatient(null);
      setEditActiveAdmission(null);
      loadPatients();
    } else {
      const ADMISSION_TYPE_MAP_REG: Record<string, string> = {
        "Planned Treatment": "PLANNED_TREATMENT", Emergency: "EMERGENCY", Maternity: "MATERNITY", Daycare: "DAYCARE",
      };
      const admDate = localDate();
      const admTime = new Date().toTimeString().slice(0, 5);
      const isIpRegistration = form.type === "IP" && !!form.wardId && !!form.bedId;

      // ── Duplicate-patient error helper (shared by both paths) ──────────────
      const showError = (error?: string) => {
        if (error?.startsWith("PATIENT_EXISTS:")) {
          const patientInfo = error.slice("PATIENT_EXISTS:".length);
          setApiError(`⚠ Already registered: ${patientInfo} — use "Existing Patient" to search and admit.`);
        } else {
          setApiError(error ?? "Request failed");
        }
      };

      if (isIpRegistration) {
        // ── Atomic register + admit (ONE transactional endpoint) ─────────────
        // Patient and admission are created together or not at all — no more
        // orphaned "patient with no admission" if the admission step fails.
        const admissionBody = {
          // patientId is set server-side after the patient is created.
          admissionType: ADMISSION_TYPE_MAP_REG[form.admissionType ?? "Planned Treatment"] ?? "PLANNED_TREATMENT",
          admissionDate: admDate,
          admissionTime: admTime,
          provisionalDiagnosis: form.illness || null,
          conditionOnAdmission: "STABLE",
          admittingDoctorId: form.doctorId ?? null,
          admittingDoctorName: form.doctorName || userName || "Doctor",
          department: form.department || null,
          wardId: form.wardId,
          bedId: form.bedId,
          referredBy: form.referredBy || null,
          paymentMode: form.paymentMode,
          // The admission's insurance flag MUST be sent explicitly — the backend
          // defaults isInsurance to false, so omitting it made an insurance
          // registration save as Cash. Derive it from the selected payment mode.
          isInsurance: form.paymentMode === "INSURANCE",
          insuranceStatus: form.paymentMode === "INSURANCE" ? "DETAILS_INCOMPLETE" : null,
          insuranceCompany: form.paymentMode === "INSURANCE" ? (form.insuranceCompany || null) : null,
          insuranceCompanyId: form.paymentMode === "INSURANCE" ? (form.insuranceCompanyId || null) : null,
          policyNo: form.paymentMode === "INSURANCE" ? (form.policyNo || null) : null,
          tpaName: form.paymentMode === "INSURANCE" ? (form.tpaName || null) : null,
          insuranceClaimType: form.paymentMode === "INSURANCE" ? (form.insuranceClaimType || null) : null,
          attendantName: form.attendantName || null,
          attendantRelation: form.attendantRelation || null,
          attendantPhone: form.attendantPhone || null,
          mlc: form.mlc,
          mlcNumber: form.mlc ? form.mlcNumber : null,
          free: form.freePatient,
          surgical: form.surgical,
          planOfCare: form.planOfCare || null,
          expectedCost: form.expectedCost || null,
          expectedOutcome: form.expectedOutcome || null,
          notes: form.notes || null,
        };
        const { ok, error, data } = await apiFetch("/api/patients/register-admit", {
          method: "POST",
          body: JSON.stringify({ patient: body, admission: admissionBody }),
        });
        setSaving(false);
        if (!ok) { showError(error); return; }

        const result = data as { patient?: { uhid?: string }; admission?: { admissionNo?: string } };
        await reloadBeds();

        // Print the Admission Order Slip for direct IP registration
        const ward = wards.find(w => w.id === form.wardId);
        const bed = allBeds.find(b => b.id === form.bedId);
        printAdmissionSlip({
          patientName: form.name.trim(),
          uhid: result.patient?.uhid ?? "",
          age: form.dob ? calcAge(form.dob) : null,
          gender: form.gender,
          admissionDate: admDate,
          admissionTime: admTime,
          doctorName: form.doctorName || userName || "",
          provisionalDiagnosis: form.illness || "",
          planOfCare: form.planOfCare || undefined,
          expectedCost: form.expectedCost || undefined,
          expectedOutcome: form.expectedOutcome || undefined,
          wardName: ward?.name,
          bedNumber: bed?.number,
          admissionNo: result.admission?.admissionNo,
        });
      } else {
        // ── OP registration (or IP without ward/bed) — patient only, no admission ──
        const { ok, error } = await apiFetch("/api/patients", { method: "POST", body: JSON.stringify(body) });
        setSaving(false);
        if (!ok) { showError(error); return; }
      }

      setRegisterOpen(false);
    }
    await loadPatients();
  }

  // -- Admit handlers --
  function openAdmit(p: PatientResponse) {
    // Guard: a patient who is currently admitted (type IP) already has an active
    // admission — block opening the Admit modal. The backend enforces this too
    // (AdmissionService.admit throws), this is the friendly front-stop.
    if (p.patientType === "IP") {
      alert(`${p.name} already has an active admission. Discharge the current admission before admitting again.`);
      return;
    }
    setAdmitForm({
      admissionType: "Planned Treatment", wardId: null, bedId: null,
      admittedDate: localDate(),
      admittedTime: new Date().toTimeString().slice(0, 5),
      provisionalDiagnosis: p.illness ?? "", condition: "Stable",
      mlc: false, mlcNumber: "",
      free: false,
      surgical: false,
      isInsurance: !!(p.insuranceCompany || p.policyNo),
      emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
      planOfCare: "", expectedCost: "", expectedOutcome: "",
      notes: "",
    });
    setAdmitErrors({}); setAdmitPatient(p);
    // Pre-fill the editable patient-detail section from the summary row first,
    // then upgrade to the full record (address / ID proof aren't on the summary).
    setAdmitPatientForm(patientToDetailFields(p));
    (async () => {
      const { ok, data } = await apiFetch(`/api/patients/${p.id}`);
      if (ok && data) setAdmitPatientForm(patientToDetailFields(data as PatientResponse));
    })();
  }
  function validateAdmit(): boolean {
    const e: Record<string, string> = {};
    if (!admitForm.wardId) e.wardId = "Ward is required";
    if (!admitForm.bedId) e.bedId = "Bed is required";
    if (!admitForm.condition) e.condition = "Condition is required";
    if (admitForm.mlc && !admitForm.mlcNumber) e.mlcNumber = "MLC number is required";
    // Insurance at admit time is just a flag — no company/policy required here.
    setAdmitErrors(e);
    return Object.keys(e).length === 0;
  }
  // Map display ? backend enum values
  const ADMISSION_TYPE_MAP: Record<string, string> = {
    "Planned Treatment": "PLANNED_TREATMENT", Emergency: "EMERGENCY", Maternity: "MATERNITY", Daycare: "DAYCARE",
  };
  const CONDITION_ON_ADMISSION_MAP: Record<string, string> = {
    Stable: "STABLE", Critical: "CRITICAL", Serious: "SERIOUS",
    "Under Observation": "UNDER_OBSERVATION", Improving: "STABLE",
  };

  async function handleAdmit() {
    if (!admitPatient || !validateAdmit()) return;
    const p = admitPatient;

    // -- Dues guard: block admission if the patient has unpaid OP/other bills --
    // (unless THIS admission is marked free). Runs BEFORE any patient edit so we
    // don't touch the record for a patient who can't be admitted. The backend
    // enforces the same rule; this gives a clear, friendly message up front.
    if (!admitForm.free) {
      const billRes = await apiFetch(`/api/bills/patient/${p.id}`);
      if (billRes.ok) {
        const bills: { status: string; dueAmount: number }[] =
          Array.isArray(billRes.data) ? billRes.data : (billRes.data?.content ?? []);
        const totalDue = bills
          .filter(b => b.status === "PENDING" || b.status === "PARTIAL")
          .reduce((s, b) => s + (b.dueAmount ?? 0), 0);
        if (totalDue > 0) {
          setAdmitErrors({ _api: `Cannot admit — outstanding balance of ₹${totalDue.toLocaleString("en-IN")}. Please collect the pending OP / other bills before admitting.` });
          const modalContent = document.querySelector('[role="dialog"] .overflow-y-auto');
          if (modalContent) modalContent.scrollTop = 0;
          return;
        }
      }
    }

    // Save any patient-detail corrections FIRST (before the admission exists, so
    // it's a normal pre-admission edit). The admission snapshot then picks up the
    // corrected name/details. If this fails, stop and show the error.
    if (admitPatientForm) {
      const { ok: pOk, error: pErr } = await apiFetch(`/api/patients/${p.id}`, {
        method: "PUT", body: JSON.stringify(detailFieldsToPatientBody(admitPatientForm)),
      });
      if (!pOk) {
        setAdmitErrors({ _api: pErr });
        const modalContent = document.querySelector('[role="dialog"] .overflow-y-auto');
        if (modalContent) modalContent.scrollTop = 0;
        return;
      }
    }

    // Build the AdmissionRequest body exactly as the backend expects. Doctor /
    // department / referral are taken from the (possibly corrected) patient form.
    const admissionBody = {
      patientId: p.id,
      admissionType: ADMISSION_TYPE_MAP[admitForm.admissionType] ?? "PLANNED_TREATMENT",
      admissionDate: admitForm.admittedDate,
      admissionTime: admitForm.admittedTime || null,
      provisionalDiagnosis: admitForm.provisionalDiagnosis || null,
      conditionOnAdmission: CONDITION_ON_ADMISSION_MAP[admitForm.condition] ?? "STABLE",
      admittingDoctorId: admitPatientForm?.doctorId ?? p.doctorId ?? null,
      admittingDoctorName: admitPatientForm?.doctorName || p.doctorName || userName || "Doctor",
      department: admitPatientForm?.department || p.department || null,
      wardId: admitForm.wardId,
      bedId: admitForm.bedId,
      referredBy: admitPatientForm?.referredBy || p.referredBy || null,
      attendantName: admitForm.emergencyContactName || p.attendantName || null,
      attendantRelation: admitForm.emergencyContactRelation || p.attendantRelation || null,
      attendantPhone: admitForm.emergencyContactPhone || p.attendantPhone || null,
      paymentMode: admitForm.isInsurance ? "INSURANCE" : "CASH",
      isInsurance: admitForm.isInsurance,
      insuranceStatus: admitForm.isInsurance ? "DETAILS_INCOMPLETE" : null,
      mlc: admitForm.mlc,
      mlcNumber: admitForm.mlc ? admitForm.mlcNumber : null,
      free: admitForm.free,
      surgical: admitForm.surgical,
      planOfCare: admitForm.planOfCare || null,
      expectedCost: admitForm.expectedCost || null,
      expectedOutcome: admitForm.expectedOutcome || null,
      notes: admitForm.notes || null,
    };

    const { ok, error, data: admData } = await apiFetch("/api/admissions", {
      method: "POST",
      body: JSON.stringify(admissionBody),
    });

    if (!ok) {
      setAdmitErrors({ _api: error });
      // Also show an alert as fallback so errors are never silent
      alert(`Admission failed: ${error}`);
      // Scroll the modal to top so the error banner is visible
      const modalContent = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (modalContent) modalContent.scrollTop = 0;
      return;
    }

    // Backend already updates patientType to IP — just refresh and close.
    // Capture the corrected patient-detail form before clearing it, so the
    // printed slip below reflects the edits made in the admit modal.
    const pf = admitPatientForm;
    await loadPatients();
    await reloadBeds();
    setAdmitPatient(null);
    setAdmitPatientForm(null);

    // Print the Admission Order Slip — use the corrected patient-detail values
    // entered in the admit modal (fall back to the original record).
    const ward = wards.find(w => w.id === admitForm.wardId);
    const bed = allBeds.find(b => b.id === admitForm.bedId);
    const slipAge = pf?.dob ? calcAge(pf.dob) : (pf ? null : p.age);
    printAdmissionSlip({
      patientName: pf?.name || p.name,
      uhid: p.uhid,
      age: slipAge ?? p.age,
      gender: pf?.gender ?? p.gender,
      admissionDate: admitForm.admittedDate,
      admissionTime: admitForm.admittedTime,
      doctorName: pf?.doctorName || p.doctorName || userName || "",
      provisionalDiagnosis: admitForm.provisionalDiagnosis || p.illness || "",
      planOfCare: admitForm.planOfCare || undefined,
      expectedCost: admitForm.expectedCost || undefined,
      expectedOutcome: admitForm.expectedOutcome || undefined,
      wardName: ward?.name,
      bedNumber: bed?.number,
      admissionNo: (admData as { admissionNo?: string })?.admissionNo,
    });
  }

  // -- IP Status Update --
  async function openStatusUpdate(p: PatientResponse) {
    setStatusPatient(p);
    setStatusForm({ field: "condition", to: "", wardId: null, bedId: null, newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "" });
    setStatusApiError(null);
    setLabTests([]);
    setActiveAdmission(null);
    setAdmissionLoading(true);
    const { ok, data } = await apiFetch(`/api/admissions/patient/${p.id}`);
    if (ok) {
      const list = data as AdmissionResponse[];
      setActiveAdmission(list.find(a => a.status !== "DISCHARGED") ?? list[0] ?? null);
    }
    setAdmissionLoading(false);
  }

  // -- Status History --
  async function openHistory(p: PatientResponse) {
    setHistoryPatient(p);
    setActiveAdmission(null);
    setHistoryAdmissions([]);
    setOpVisits([]);
    setAdmissionLoading(true);
    const [admRes, opRes] = await Promise.all([
      apiFetch(`/api/admissions/patient/${p.id}`),
      apiFetch(`/api/op-visits?uhid=${encodeURIComponent(p.uhid)}&size=50`),
    ]);
    if (admRes.ok) {
      const list = (admRes.data as AdmissionResponse[]) ?? [];
      // Sort newest first
      const sorted = [...list].sort((a, b) =>
        (b.admissionDate ?? "").localeCompare(a.admissionDate ?? "")
      );
      setHistoryAdmissions(sorted);
      setActiveAdmission(sorted.find(a => a.status !== "DISCHARGED") ?? sorted[0] ?? null);
    }
    if (opRes.ok) {
      const raw = opRes.data?.content ?? opRes.data ?? [];
      setOpVisits(Array.isArray(raw) ? raw as OPVisitResponse[] : []);
    }
    setAdmissionLoading(false);
  }

  function canUpdateStatus(): boolean {
    return ["Managing Director", "Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);
  }
  function getUpdateableFields(): string[] {
    switch (role) {
      case "Admin": return ["condition", "ward", "doctor", "lab", "discharge"];
      case "Doctor": return ["condition", "lab", "discharge"];
      case "Nurse": return ["condition", "ward"];
      case "Receptionist": return ["ward", "lab"];
      case "Lab/Ins/Reception": return ["ward", "lab"];
      default: return [];
    }
  }

  async function handleStatusUpdate() {
    if (!statusPatient || !activeAdmission) return;
    setStatusSaving(true); setStatusApiError(null);
    const admId = activeAdmission.id;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);

    try {
      if (statusForm.field === "condition") {
        const backendStatus = CONDITION_TO_STATUS[statusForm.to] ?? "STABLE";
        const { ok, error } = await apiFetch(`/api/admissions/${admId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: backendStatus, notes: statusForm.notes || undefined }),
        });
        if (!ok) { setStatusApiError(error); return; }

      } else if (statusForm.field === "ward") {
        const ward = wards.find(w => w.id === statusForm.wardId);
        const bed = allBeds.find(b => b.id === statusForm.bedId);
        const { ok, error } = await apiFetch(`/api/admissions/${admId}/transfers`, {
          method: "POST",
          body: JSON.stringify({
            transferType: bed ? "BED" : "WARD",
            fromValue: `${activeAdmission.bedNumber ?? "—"} (${activeAdmission.wardName ?? "—"})`,
            toValue: bed ? `${bed.number} (${ward?.name ?? ""})` : (ward?.name ?? ""),
            toId: bed?.id ?? statusForm.wardId,
            transferDate: today, transferTime: time,
            reason: statusForm.notes || "Ward / bed transfer",
            orderedBy: userName, doneBy: userName,
            notes: statusForm.notes || undefined,
          }),
        });
        if (!ok) { setStatusApiError(error); return; }
        // Refresh bed availability so new admissions see accurate data
        await reloadBeds();

      } else if (statusForm.field === "doctor") {
        const doc = doctors.find(d => d.name === statusForm.newDoctor);
        const { ok, error } = await apiFetch(`/api/admissions/${admId}/transfers`, {
          method: "POST",
          body: JSON.stringify({
            transferType: "DOCTOR",
            fromValue: activeAdmission.admittingDoctorName ?? "—",
            toValue: statusForm.newDoctor,
            toId: doc?.id ?? null,
            transferDate: today, transferTime: time,
            reason: statusForm.notes || "Doctor transfer",
            orderedBy: userName, doneBy: userName,
            notes: statusForm.notes || undefined,
          }),
        });
        if (!ok) { setStatusApiError(error); return; }

      } else if (statusForm.field === "lab") {
        if (labTests.length === 0) return;
        const { ok, error } = await apiFetch("/api/lab/investigations", {
          method: "POST",
          body: JSON.stringify({
            patientId: statusPatient.id,
            uhid: statusPatient.uhid,
            patientName: statusPatient.name,
            patientType: statusPatient.patientType,
            admissionId: admId,
            doctorName: userName,
            orderedDate: today,
            orderedTime: time,
            orderedBy: userName,
            tests: labTests.map(t => ({
              testCode: t.testCode,
              investigationName: t.name,
              category: t.category,
              sampleType: t.sampleType || undefined,
              normalRange: t.normalRange || undefined,
              unit: t.unit || undefined,
              turnaroundTime: t.turnaroundTime || undefined,
              price: t.price,
              priority: t.priority === "STAT" ? "STAT" : t.priority === "Urgent" ? "URGENT" : "ROUTINE",
            })),
          }),
        });
        if (!ok) { setStatusApiError(error); return; }

      } else if (statusForm.field === "discharge") {
        // -- Bill check — free admissions bypass this entirely ---------------
        // Bypass is driven ONLY by the per-admission free flag (admission.free).
        const isFreeDischarge = activeAdmission?.free ?? false;
        if (!isFreeDischarge) {
          const billRes = await apiFetch(`/api/bills/patient/${statusPatient.id}`);
          const allBills: {
            status: string; dueAmount: number; totalAmount?: number;
            paidAmount?: number; admissionId?: number | null; consolidated?: boolean;
          }[] = billRes.ok
            ? (Array.isArray(billRes.data) ? billRes.data : (billRes.data?.content ?? []))
            : [];
          const activeBills = allBills.filter(b => b.status !== "CANCELLED");
          const noBill      = activeBills.length === 0;

          const isInsurance = activeAdmission?.isInsurance ?? false;
          if (!isInsurance) {
            // ── CASH: full balance must be cleared ──
            const totalDue = activeBills.reduce((s, b) => s + (b.dueAmount ?? 0), 0);
            if (noBill || totalDue > 0) {
              setStatusApiError("Please settle the bill to discharge the patient.");
              return;
            }
          } else {
            // ── INSURANCE: the insurer's approved share may still be pending
            // (paid ~45 days later). Gate discharge on the PATIENT'S share only:
            //   patientBalance = billAmount − approvedAmount − patientPaid
            // Require the claim to be APPROVED or SETTLED, and the patient
            // balance collected. The insurer's pending amount does not block.
            if (noBill) {
              setStatusApiError("No bill found. Generate the bill before discharge.");
              return;
            }
            // Admission's real (non view-only) bills carry the money.
            const admBills = activeBills.filter(
              b => !b.consolidated && (activeAdmission?.id == null || b.admissionId === activeAdmission?.id)
            );
            const billAmount  = admBills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
            const patientPaid = admBills.reduce((s, b) => s + (b.paidAmount ?? 0), 0);

            // Fetch the admission's claim to read the approved amount + status.
            let approvedAmount = 0;
            let claimStatus = activeAdmission?.insuranceStatus ?? "";
            const clRes = await apiFetch(`/api/insurance/claims?page=0&size=200`);
            if (clRes.ok) {
              const claims: Array<{
                admissionId: number | null; approvedAmount: number | null; status: string;
              }> = Array.isArray(clRes.data) ? clRes.data : (clRes.data?.content ?? []);
              const claim = claims.find(c => c.admissionId === activeAdmission?.id);
              if (claim) {
                approvedAmount = claim.approvedAmount ?? 0;
                claimStatus = claim.status;
              }
            }

            // Discharge is gated on the PATIENT's share only — the insurer's
            // approved amount is a receivable that arrives days later, so the
            // bill legitimately stays OPEN after discharge. As long as the money
            // tallies with no patient refund or shortfall
            //   billAmount = approvedAmount + patientPaid  (patientBalance === 0)
            // discharge is allowed even if the claim is not yet SETTLED.
            //
            // We still require approval figures to EXIST before tallying: if no
            // approved amount has been entered yet (approvedAmount === 0 and the
            // claim hasn't been approved), tallying would wrongly demand the
            // patient pay the entire bill. In that case, prompt to approve first.
            const patientBalance = billAmount - approvedAmount - patientPaid;
            // Approval figures "exist" once the insurer has responded: APPROVED
            // (approved amount entered), SETTLED, or DECLINED. A DECLINED claim
            // has approvedAmount = 0, so patientBalance correctly becomes the
            // full remaining balance — the patient owes everything, and the
            // balance check below collects it (no "not approved yet" prompt).
            const approvalEntered = approvedAmount > 0
              || claimStatus === "APPROVED" || claimStatus === "SETTLED"
              || claimStatus === "DECLINED";
            if (!approvalEntered && patientBalance !== 0) {
              setStatusApiError(
                "Insurance claim is not approved yet. Enter the insurer's approved amount " +
                "(Insurance module) before discharge.");
              return;
            }
            if (patientBalance > 0) {
              setStatusApiError(
                `Collect the patient balance of ₹${patientBalance.toLocaleString("en-IN")} ` +
                `(Bill ₹${billAmount.toLocaleString("en-IN")} − Insurance approved ₹${approvedAmount.toLocaleString("en-IN")} − Paid ₹${patientPaid.toLocaleString("en-IN")}) before discharge.`);
              return;
            }
            if (patientBalance < 0) {
              setStatusApiError(
                `Refund ₹${Math.abs(patientBalance).toLocaleString("en-IN")} to the patient before discharge ` +
                `(advance exceeds the patient's share after insurance approval). Record it via Collect Cash → Refund.`);
              return;
            }
            // patientBalance === 0 → patient's share settled, insurer pending — allow discharge.
          }
        }

        // Bills clear (or free patient) — navigate to discharge summary tab
        const patId = statusPatient.id;
        setStatusPatient(null);
        setStatusForm({ field: "condition", to: "", wardId: null, bedId: null, newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "" });
        router.push(`/patients/${patId}/case-sheet?tab=discharge`);
        return;
      }

      // Refresh admission for history display
      const { ok: rOk, data: rData } = await apiFetch(`/api/admissions/patient/${statusPatient.id}`);
      if (rOk) {
        const list = rData as AdmissionResponse[];
        setActiveAdmission(list.find(a => a.status !== "DISCHARGED") ?? list[0] ?? null);
      }

      setStatusPatient(null);
      setLabTests([]);
      setStatusForm({ field: "condition", to: "", wardId: null, bedId: null, newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "" });
    } finally {
      setStatusSaving(false);
    }
  }

  // --- Render ----------------------------------------------------------------
  return (
    <div>
      <PageHeader
        title="Patients"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Patients" }]}
        action={
          canManagePatients
            ? { label: "Register Patient", onClick: openRegister }
            : undefined
        }
      />

      {/* -- Filter / Search bar -- */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full sm:w-auto">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as FilterView); setPage(0); }}
            className="appearance-none w-full sm:w-56 pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-2
              focus:ring-sky-500 focus:border-transparent cursor-pointer"
          >
            {FILTER_TABS.map((tab) => (
              <option key={tab} value={tab}>{tab} ({tabCounts[tab]})</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="relative flex-1 min-w-[160px] order-first sm:order-none w-full sm:w-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, UHID, phone, doctor—"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap font-medium">From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="pl-3 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer w-36" />
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap font-medium">To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="pl-3 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
              focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer w-36" />
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {[
            { label: "Today", fn: () => { const t = new Date().toISOString().slice(0, 10); setDateFrom(t); setDateTo(t); setPage(0); } },
            {
              label: "This Week", fn: () => {
                const now = new Date(); const day = now.getDay();
                const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                setDateFrom(mon.toISOString().slice(0, 10)); setDateTo(sun.toISOString().slice(0, 10)); setPage(0);
              }
            },
            {
              label: "This Month", fn: () => {
                const now = new Date();
                setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
                setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)); setPage(0);
              }
            },
          ].map((p) => (
            <button key={p.label} onClick={p.fn}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200
                bg-white text-slate-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700
                transition-colors whitespace-nowrap">
              {p.label}
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200
                bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 self-center whitespace-nowrap">
          {totalElements.toLocaleString()} result{totalElements !== 1 ? "s" : ""}
          {(dateFrom || dateTo) && (
            <span className="ml-1 text-sky-500 font-medium">
              {dateFrom && dateTo ? `(${dateFrom} — ${dateTo})` : dateFrom ? `(from ${dateFrom})` : `(to ${dateTo})`}
            </span>
          )}
        </p>
      </div>

      {/* -- Table -- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-400">Loading—</div>
          ) : fetchErr ? (
            <div className="px-4 py-8 text-center text-red-500 text-sm">{fetchErr}</div>
          ) : patients.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                No patients found
              </div>
            </div>
          ) : patients.map((p) => (
            <div key={p.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">{p.uhid}</span>
                  <p className="font-medium text-slate-900 text-sm mt-1">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.age}y / {p.gender.charAt(0)} — {p.phone}</p>
                </div>
                {p.patientType === "IP"
                  ? <Badge label="Admitted" variant="green" dot />
                  : p.patientType === "BOTH"
                    ? <Badge label="Discharged" variant="gray" dot />
                    : <Badge label={p.active ? "Active" : "Inactive"} dot />
                }
                {p.freePatient && <Badge label="Free" variant="green" />}
              </div>
              <p className="text-xs text-slate-600">{p.doctorName ?? "—"} <span className="text-slate-400">— {p.department ?? "—"}</span></p>
              {/* Location / Episode + date — ward·bed + adm no (IP) or OPD + visit (OP) */}
              {p.currentEpisode && (
                <p className="text-xs text-slate-500">
                  {p.currentEpisode.kind === "IP"
                    ? `${p.currentEpisode.wardName ?? "—"}${p.currentEpisode.bedNumber ? ` · Bed ${p.currentEpisode.bedNumber}` : ""}`
                    : "OPD"}
                  {(p.currentEpisode.episodeNo || p.currentEpisode.tokenNo) && (
                    <span className="text-slate-400"> — {p.currentEpisode.episodeNo ?? p.currentEpisode.tokenNo}</span>
                  )}
                  {p.currentEpisode.episodeDate && (
                    <span className="text-slate-400"> · {p.currentEpisode.episodeDate}</span>
                  )}
                </p>
              )}
              <div className="flex items-center gap-1 pt-1 flex-wrap">
                {(p.patientType === "IP" || p.patientType === "BOTH") && (
                  <Link href={`/patients/${p.id}/case-sheet`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">
                    Case Sheet
                  </Link>
                )}
                {p.patientType === "OP" && p.active && canManagePatients && (
                  <button onClick={() => openAdmit(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700">
                    Admit
                  </button>
                )}
                {/* Edit — hidden for discharged (BOTH) patients */}
                {p.patientType !== "BOTH" && canManagePatients && (
                  <button onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                    Edit
                  </button>
                )}
                {/* Discharge Summary — only for discharged (BOTH) patients */}
                {p.patientType === "BOTH" && (
                  <Link href={`/patients/${p.id}/discharge-summary`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700">
                    Discharge Summary
                  </Link>
                )}
                {/* Expand toggle — for IP/BOTH shows receipts + more actions */}
                {(p.patientType === "IP" || p.patientType === "BOTH") && (
                  <button
                    onClick={() => setExpandedReceiptsPatient(prev => (prev === p.id ? null : p.id))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">
                    {expandedReceiptsPatient === p.id ? "▲ Less" : "▼ More"}
                  </button>
                )}
              </div>
              {/* Expand panel — Collect Cash, Update Status, History, Receipts ledger */}
              {(p.patientType === "IP" || p.patientType === "BOTH") && expandedReceiptsPatient === p.id && (
                <div className="pt-2 space-y-2">
                  {/* Secondary actions inside the panel */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {canManagePatients && (
                      <button onClick={() => openCollectCash(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">
                        Collect Cash
                      </button>
                    )}
                    {p.patientType === "IP" && p.active && canUpdateStatus() && (
                      <button onClick={() => openStatusUpdate(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700">
                        Update Status
                      </button>
                    )}
                    <button onClick={() => openHistory(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700">
                      History
                    </button>
                  </div>
                  {/* Receipts ledger */}
                  <ReceiptsPanel patientId={p.id} admissionId={p.currentEpisode?.kind === "IP" ? p.currentEpisode.admissionId : null} refreshKey={receiptsRefresh} onCollectCash={canManagePatients ? () => openCollectCash(p) : undefined} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <HScrollArea className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["UHID", "Name", "Age/Gender", "Phone", "Type", "Doctor", "Ward / Bed", "Date", "Payment", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">Loading—</td></tr>
              ) : fetchErr ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-red-500 text-sm">{fetchErr}</td></tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      No patients found
                    </div>
                  </td>
                </tr>
              ) : patients.map((p) => (
                <Fragment key={p.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">{p.uhid}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Expand-toggle chevron for IP/BOTH — reveals receipts panel */}
                      {(p.patientType === "IP" || p.patientType === "BOTH") ? (
                        <button
                          onClick={() => setExpandedReceiptsPatient(prev => (prev === p.id ? null : p.id))}
                          className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                            expandedReceiptsPatient === p.id
                              ? "bg-sky-100 text-sky-600 rotate-90"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          }`}
                          title={expandedReceiptsPatient === p.id ? "Collapse" : "Expand receipts"}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                          </svg>
                        </button>
                      ) : (
                        <span className="w-6 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate max-w-[180px]" title={p.name}>{p.name}</div>
                        <div className="text-xs text-slate-400">{(p.createdAt ?? "").slice(0, 10)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {p.age}y / {GENDER_DISPLAY[p.gender]?.charAt(0) ?? p.gender.charAt(0)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={p.patientType} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{p.doctorName ?? "—"}</td>
                  {/* Location / Episode — ward·bed + admission no for IP, OPD + visit/token for OP */}
                  <td className="px-4 py-3 text-xs">{renderEpisodeLocation(p)}</td>
                  {/* Date — admission date (IP) or latest visit date (OP) */}
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {p.currentEpisode?.episodeDate ?? "—"}
                  </td>
                  {/* Payment — Cash, or (for insurance) the claim workflow status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.currentEpisode?.isInsurance ? (
                      <Badge
                        label={INSURANCE_STATUS_BADGE[p.currentEpisode.insuranceStatus ?? "DETAILS_INCOMPLETE"] ?? "Insurance"}
                        variant={INSURANCE_STATUS_COLOR[p.currentEpisode.insuranceStatus ?? "DETAILS_INCOMPLETE"] ?? "gray"}
                        dot
                      />
                    ) : (
                      <span className="text-sm text-slate-700">Cash</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.patientType === "IP" ? (
                      <Badge label="Admitted" variant="green" dot />
                    ) : p.patientType === "BOTH" ? (
                      <Badge label="Discharged" variant="gray" dot />
                    ) : (
                      <Badge label={p.active ? "Active" : "Inactive"} dot />
                    )}
                    {p.freePatient && <Badge label="Free" variant="green" />}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {/* View Case Sheet — IP / BOTH */}
                      {(p.patientType === "IP" || p.patientType === "BOTH") && (
                        <Link href={`/patients/${p.id}/case-sheet`}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          title="View Case Sheet">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      )}
                      {/* Admit — OP only */}
                      {p.patientType === "OP" && p.active && canManagePatients && (
                        <button onClick={() => openAdmit(p)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs
                            font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                          title="Admit as In-Patient">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Admit
                        </button>
                      )}
                      {/* Edit — hidden for discharged (BOTH) patients */}
                      {p.patientType !== "BOTH" && canManagePatients && (
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          title="Edit patient">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {/* IP Status Update — only when actively admitted (IP), not discharged (BOTH) */}
                      {p.patientType === "IP" && p.active && canUpdateStatus() && (
                        <button onClick={() => openStatusUpdate(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Update status">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      {/* History */}
                      {(p.patientType === "IP" || p.patientType === "BOTH") && (
                        <button onClick={() => openHistory(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                          title="Status history">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      {/* Discharge Summary — only for discharged (BOTH) patients */}
                      {p.patientType === "BOTH" && (
                        <Link href={`/patients/${p.id}/discharge-summary`}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          title="Discharge Summary">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Receipts ledger — expandable row directly under this patient */}
                {expandedReceiptsPatient === p.id && (
                  <tr className="bg-slate-50/40">
                    <td colSpan={11} className="px-4 pb-3 pt-2">
                      {/* Collect Cash + Receipts ledger — all in the expand row */}
                      {canManagePatients && (
                        <div className="mb-2">
                          <button onClick={() => openCollectCash(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Collect Cash
                          </button>
                        </div>
                      )}
                      <ReceiptsPanel patientId={p.id} admissionId={p.currentEpisode?.kind === "IP" ? p.currentEpisode.admissionId : null} refreshKey={receiptsRefresh} onCollectCash={canManagePatients ? () => openCollectCash(p) : undefined} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </HScrollArea>
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-500 whitespace-nowrap">
            {totalElements > 0
              ? `Showing ${(page * PAGE_SIZE) + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${totalElements.toLocaleString()} patients`
              : "No patients"}
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
      </div>

      {/* ----------------------------------------------------------------------
          Register / Edit Modal
      ---------------------------------------------------------------------- */}
      <Modal
        open={registerOpen || !!editPatient}
        onClose={() => { setRegisterOpen(false); setEditPatient(null); setEditActiveAdmission(null); setAdmEditForm(null); setEditTab("patient"); setRegisterTab("new"); }}
        title={editPatient ? `Edit Patient — ${editPatient.uhid}` : "Register Patient"}
        size="xl"
        footer={
          <>
            <button onClick={() => { setRegisterOpen(false); setEditPatient(null); setEditActiveAdmission(null); setAdmEditForm(null); setEditTab("patient"); setRegisterTab("new"); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              {editPatient ? "Close" : "Cancel"}
            </button>
            {/* Footer button swaps based on mode / active tab */}
            {editPatient ? (
              // Edit mode: the Patient tab is editable for not-yet-admitted
              // out-patients (unlimited), and for admitted patients exactly ONCE
              // (postAdmitEdited gate). The Admission tab saves via its own API.
              editTab === "admission" && editActiveAdmission && admEditForm ? (
                <button onClick={handleSaveAdmissionEdit} disabled={admEditSaving}
                  className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-medium rounded-lg transition-colors">
                  {admEditSaving ? "Saving…" : "Save Admission Details"}
                </button>
              ) : editTab === "patient" && (editPatient.patientType === "OP" || !editPatient.postAdmitEdited) ? (
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-medium rounded-lg transition-colors">
                  {saving ? "Saving…" : "Save Patient Details"}
                </button>
              ) : null
            ) : registerTab === "existing" ? (
              <button onClick={handleExistingAdmit} disabled={existingSaving || !selectedExisting}
                className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium rounded-lg transition-colors">
                {existingSaving ? "Admitting—" : "Admit & Print Form"}
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-medium rounded-lg transition-colors">
                {saving ? "Saving—" : "Register"}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-5">

          {/* -- Edit-mode tab switcher: Patient Details (read-only) | Admission Details (editable) -- */}
          {editPatient && (
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setEditTab("patient")}
                className={`flex-1 py-2 text-sm font-semibold transition-colors
                  ${editTab === "patient" ? "bg-sky-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                🧾 Patient Details
              </button>
              <button
                onClick={() => setEditTab("admission")}
                disabled={!editActiveAdmission}
                title={editActiveAdmission ? "" : "No active admission for this patient"}
                className={`flex-1 py-2 text-sm font-semibold transition-colors border-l border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed
                  ${editTab === "admission" ? "bg-indigo-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                🛏️ Admission Details
              </button>
            </div>
          )}

          {/* -- Tab switcher (only for new registration, not edit) -- */}
          {!editPatient && (
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => { setRegisterTab("new"); setSelectedExisting(null); setExistingSearch(""); setExistingBillBlock(null); setExistingApiErr(""); }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors
                  ${registerTab === "new" ? "bg-sky-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                🆕 New Patient
              </button>
              <button
                onClick={() => { setRegisterTab("existing"); }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors border-l border-slate-200
                  ${registerTab === "existing" ? "bg-indigo-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                🔍 Existing Patient — Re-Admit
              </button>
            </div>
          )}

          {/* ----------------------------------------------------
              EXISTING PATIENT TAB
          ---------------------------------------------------- */}
          {!editPatient && registerTab === "existing" && (
            <div className="space-y-5">
              {/* Search box */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Search by Name, UHID or Phone
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  <input
                    value={existingSearch}
                    onChange={e => { setExistingSearch(e.target.value); setSelectedExisting(null); setExistingBillBlock(null); setExistingApiErr(""); }}
                    placeholder="Type name, UHID or phone—"
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {existingSearching && (
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400"
                      fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                </div>
                {/* Dropdown results */}
                {existingOpts.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {existingOpts.map(p => (
                      <button key={p.id} onClick={() => selectExistingPatient(p)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0
                          ${p.gender === "FEMALE" ? "bg-pink-500" : "bg-indigo-600"}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.uhid} — {p.age}y/{p.gender?.charAt(0)} — {p.phone}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
                          ${p.patientType === "IP" ? "bg-emerald-100 text-emerald-700" :
                            p.patientType === "BOTH" ? "bg-amber-100 text-amber-700" :
                              "bg-sky-100 text-sky-700"}`}>
                          {p.patientType === "IP" ? "Admitted" : p.patientType === "BOTH" ? "Discharged" : "OP"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bill block warning */}
              {existingBillBlock && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-red-700">
                    <p className="font-semibold">Cannot admit — outstanding balance</p>
                    <p className="mt-0.5">
                      This patient has unpaid bills totalling{" "}
                      <span className="font-bold">₹{existingBillBlock.dueAmount.toLocaleString("en-IN")}</span>.
                      Please clear all dues before re-admitting.
                    </p>
                    <a href={`/bills?patientId=${selectedExisting?.id}`}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-red-700 underline underline-offset-2">
                      View Bills →
                    </a>
                  </div>
                </div>
              )}

              {/* API error */}
              {existingApiErr && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {existingApiErr}
                </div>
              )}

              {/* Selected patient card + admission form */}
              {selectedExisting && existingAdmitForm && !existingBillBlock && (
                <div className="space-y-5">
                  {/* Patient summary card */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs">
                    <p className="text-slate-400">UHID</p>
                    <p className="font-mono font-semibold text-slate-800">{selectedExisting.uhid}</p>
                  </div>

                  {/* Patient Details (editable; saved to the patient master before admit) */}
                  {existingPatientForm && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Details</p>
                      <PatientDetailsFields
                        value={existingPatientForm}
                        onChange={(patch) => setExistingPatientForm(prev => prev ? { ...prev, ...patch } : prev)}
                        phoneEditable={isAdmin}
                        areaOptions={areaOptions}
                        districtOptions={districtOptions}
                        referrers={referrers}
                        departments={departments}
                        doctors={doctors}
                        onAddArea={(v) => addDropdownOption("AREA", v)}
                        onAddDistrict={(v) => addDropdownOption("DISTRICT", v)}
                        onAddReferrer={() => { setRefForm(emptyRefForm()); setRefErr(""); setRefModalOpen(true); }}
                      />
                    </div>
                  )}

                  {/* Admission fields */}
                  <SectionHeading>A — Admission Details</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Admission Type">
                      <Select value={existingAdmitForm.admissionType}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, admissionType: e.target.value as typeof existingAdmitForm.admissionType })}>
                        <option value="Planned Treatment">Planned Treatment</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Maternity">Maternity</option>
                        <option value="Daycare">Daycare</option>
                      </Select>
                    </FormField>
                    <FormField label="Condition" required>
                      <Select value={existingAdmitForm.condition}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, condition: e.target.value as typeof existingAdmitForm.condition })}>
                        {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Date" required>
                      <input type="date" value={existingAdmitForm.admittedDate}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, admittedDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </FormField>
                    <FormField label="Time">
                      <input type="time" value={existingAdmitForm.admittedTime}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, admittedTime: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </FormField>
                    <FormField label="Ward" required>
                      <Select value={existingAdmitForm.wardId ?? ""}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, wardId: Number(e.target.value) || null, bedId: null })}>
                        <option value="">Select ward</option>
                        {wards.filter(w => w.status === "ACTIVE").map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Bed" required>
                      {existingAdmitForm.wardId && allBeds.filter(b => b.wardId === existingAdmitForm.wardId && b.status === "AVAILABLE").length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                          All beds occupied in this ward
                        </div>
                      ) : (
                        <Select value={existingAdmitForm.bedId ?? ""} disabled={!existingAdmitForm.wardId}
                          onChange={e => setExistingAdmitForm({ ...existingAdmitForm, bedId: Number(e.target.value) || null })}>
                          <option value="">{existingAdmitForm.wardId ? "Select bed" : "Select ward first"}</option>
                          {allBeds.filter(b => b.wardId === existingAdmitForm.wardId && b.status === "AVAILABLE").map(b => <option key={b.id} value={b.id}>{b.number}</option>)}
                        </Select>
                      )}
                    </FormField>
                  </div>
                  <FormField label="Provisional Diagnosis">
                    <Textarea value={existingAdmitForm.provisionalDiagnosis} rows={2}
                      onChange={e => setExistingAdmitForm({ ...existingAdmitForm, provisionalDiagnosis: e.target.value })}
                      placeholder="Diagnosis / reason for admission" />
                  </FormField>

                  <SectionHeading>B — Emergency Contact</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Contact Name">
                      <input value={existingAdmitForm.emergencyContactName}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, emergencyContactName: e.target.value })}
                        placeholder="Attendant name"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </FormField>
                    <FormField label="Phone">
                      <input value={existingAdmitForm.emergencyContactPhone}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, emergencyContactPhone: e.target.value.replace(/\D/g, "") })}
                        maxLength={10} placeholder="10-digit mobile"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </FormField>
                    <FormField label="Relation">
                      <input value={existingAdmitForm.emergencyContactRelation}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, emergencyContactRelation: e.target.value })}
                        placeholder="e.g. Spouse, Parent"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </FormField>
                  </div>

                  <SectionHeading>C — Payment / Insurance</SectionHeading>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={existingAdmitForm.isInsurance}
                        onChange={e => setExistingAdmitForm({ ...existingAdmitForm, isInsurance: e.target.checked })}
                        className="w-4 h-4 accent-sky-600 cursor-pointer" />
                      <span className="text-sm text-slate-700">Insurance patient</span>
                    </label>
                    {existingAdmitForm.isInsurance && (
                      <p className="text-xs text-slate-400 ml-6">
                        Marked as insurance. Insurance company, policy, TPA and claim details
                        are captured later from the Insurance workflow.
                      </p>
                    )}
                  </div>

                  <SectionHeading>D — Notes</SectionHeading>
                  <FormField label="Admitting Notes">
                    <Textarea value={existingAdmitForm.notes} rows={2}
                      onChange={e => setExistingAdmitForm({ ...existingAdmitForm, notes: e.target.value })}
                      placeholder="Any additional notes" />
                  </FormField>

                  {/* Free admission — applies to this admission only */}
                  <label className="flex items-center gap-3 mt-1 cursor-pointer">
                    <input type="checkbox" checked={existingAdmitForm.free}
                      onChange={e => setExistingAdmitForm({ ...existingAdmitForm, free: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Free Admission (no charge — bill check bypassed at discharge)
                    </span>
                  </label>

                  {/* Surgical case — per-admission fact */}
                  <label className="flex items-center gap-3 mt-1 cursor-pointer">
                    <input type="checkbox" checked={existingAdmitForm.surgical}
                      onChange={e => setExistingAdmitForm({ ...existingAdmitForm, surgical: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">Surgical Case</span>
                  </label>

                  {/* Free patient indicator */}
                  {selectedExisting.freePatient && (
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                      <span className="text-lg">🎗️</span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Free / Charity Patient</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prompt when nothing selected yet */}
              {!selectedExisting && !existingSearching && (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400 text-sm">
                  <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Search for a patient above to re-admit them
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              NEW PATIENT TAB (or Edit mode — existing content below)
          ---------------------------------------------------- */}
          {((editPatient && editTab === "patient") || (!editPatient && registerTab === "new")) && (
            <fieldset disabled={!!editPatient && editPatient.patientType !== "OP" && !!editPatient.postAdmitEdited} className="space-y-5 disabled:opacity-100 min-w-0 border-0 m-0 p-0">
              {editPatient && editPatient.patientType === "OP" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-700">
                  You can correct this out-patient&apos;s details before admission. The <span className="font-semibold">mobile number</span> can only be changed by an Admin. Changes update the patient record and apply to future visits.
                </div>
              )}
              {editPatient && editPatient.patientType !== "OP" && !editPatient.postAdmitEdited && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
                  This patient is admitted. You may correct their details <span className="font-semibold">once</span> — after saving, the patient record is locked for this admission. For bill / insurance name on the current admission, use the <span className="font-semibold text-indigo-600">Admission Details</span> tab.
                </div>
              )}
              {editPatient && editPatient.patientType !== "OP" && editPatient.postAdmitEdited && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
                  Patient details are read-only — the one-time post-admission correction has already been used. To correct the name used on bills / insurance for the current admission, use the <span className="font-semibold text-indigo-600">Admission Details</span> tab.
                </div>
              )}
              {apiError && (
                <div className={`rounded-lg border px-4 py-3 text-sm
                  ${apiError.startsWith("⚠ Already registered:")
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-700"}`}>
                  {apiError.startsWith("⚠ Already registered:")
                    ? apiError
                    : <><span className="font-semibold">Error: </span>{apiError}</>}
                </div>
              )}

              <SectionHeading>Basic Details</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField label="Full Name" required error={formErrors.name}>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Patient full name" />
                </FormField>
                <FormField label="Date of Birth" error={formErrors.dob}>
                  <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </FormField>
                <FormField label="Age (auto)">
                  <Input value={form.dob ? calcAge(form.dob) + " years" : "—"} disabled />
                </FormField>
                <FormField label="Gender" required error={formErrors.gender}>
                  <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "MALE" | "FEMALE" | "OTHER" })}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </FormField>
                <FormField label="Marital Status">
                  <Select value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="WIDOWED">Widowed</option>
                    <option value="DIVORCED">Divorced</option>
                  </Select>
                </FormField>
                <FormField label="Blood Group">
                  <Select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                    <option value="">Select…</option>
                    {BLOOD_GROUP_KEYS.map((k) => <option key={k} value={k}>{BLOOD_GROUPS[k]}</option>)}
                  </Select>
                </FormField>
                <FormField label="Phone" required error={formErrors.phone}>
                  <Input type="tel" inputMode="numeric" maxLength={10}
                    disabled={!!editPatient && !isAdmin}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                    placeholder="10-digit mobile number" />
                  {editPatient && !isAdmin && (
                    <p className="text-xs text-slate-400 mt-1">Only an Admin can change the mobile number.</p>
                  )}
                </FormField>
                <FormField label="Alternate Phone">
                  <Input type="tel" inputMode="numeric" maxLength={10} value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value.replace(/\D/g, "") })} placeholder="Optional" />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
                </FormField>
                <FormField label="Area">
                  <CreatableSelect
                    value={form.area}
                    options={areaOptions.map((a) => ({ value: a, label: a }))}
                    onChange={(v) => setForm({ ...form, area: v })}
                    onAdd={(v) => { addDropdownOption("AREA", v); setForm((prev) => ({ ...prev, area: v })); }}
                    placeholder="Select area…"
                    searchPlaceholder="Search or type new area…"
                    addLabel={(q) => `+ Add "${q}" as new area`}
                  />
                </FormField>
                <FormField label="District">
                  <CreatableSelect
                    value={form.district}
                    options={districtOptions.map((d) => ({ value: d, label: d }))}
                    onChange={(v) => setForm({ ...form, district: v })}
                    onAdd={(v) => { addDropdownOption("DISTRICT", v); setForm((prev) => ({ ...prev, district: v })); }}
                    placeholder="Select district…"
                    searchPlaceholder="Search or type new district…"
                    addLabel={(q) => `+ Add "${q}" as new district`}
                  />
                </FormField>
              </div>
              <FormField label="Address">
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" rows={1} />
              </FormField>

              {/* Illness, Plan of Care, Notes — compact side-by-side on registration */}
              {!editPatient && (
                <>
                  <SectionHeading>Clinical Details</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Illness / Chief Complaint">
                      <Textarea value={form.illness} onChange={(e) => setForm({ ...form, illness: e.target.value })} placeholder="Reason for visit" rows={1} />
                    </FormField>
                    <FormField label="Plan of Care">
                      <Select value={form.planOfCare} onChange={(e) => setForm({ ...form, planOfCare: e.target.value })}>
                        <option value="">Select</option>
                        {PLAN_OF_CARE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Notes">
                      <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes" rows={1} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <FormField label="Expected Cost">
                      <Input value={form.expectedCost} onChange={(e) => setForm({ ...form, expectedCost: e.target.value })} placeholder="e.g. 25000" />
                    </FormField>
                    <FormField label="Expected Outcome">
                      <Input value={form.expectedOutcome} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} placeholder="e.g. Full recovery" />
                    </FormField>
                  </div>
                  <p className="text-xs text-slate-400 -mt-2">* Subject to change during the course of disease</p>
                </>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField label="Referred By">
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <SearchSelect
                        value={form.referredBy}
                        placeholder="— None / Self —"
                        searchPlaceholder="Search referrer…"
                        emptyText="No referrers found"
                        options={[
                          { value: "", label: "— None / Self —" },
                          ...referrers.map((r) => ({
                            value: r.name, label: r.name,
                            sublabel: r.specialization ?? undefined,
                          })),
                        ]}
                        onChange={(v) => setForm({ ...form, referredBy: v })}
                      />
                    </div>
                    <button type="button"
                      onClick={() => { setRefForm(emptyRefForm()); setRefErr(""); setRefModalOpen(true); }}
                      title="Add new referrer"
                      className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </FormField>
                <FormField label="Department">
                  <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, doctorName: "", doctorId: null })}>
                    <option value="">Select department</option>
                    {departments.map((d) => <option key={d.id}>{d.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="Doctor">
                  <Select value={form.doctorName} onChange={(e) => {
                    const doc = doctors.find(d => d.name === e.target.value);
                    setForm({ ...form, doctorName: e.target.value, doctorId: doc?.id ?? null });
                  }}>
                    <option value="">Select doctor</option>
                    {doctors.filter((d) => !form.department || d.department === form.department).map((d) => (
                      <option key={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Inline Add Referrer mini-panel */}
              {refModalOpen && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-sky-700 uppercase tracking-wider">Add New Referrer</p>
                    <button type="button" onClick={() => { setRefModalOpen(false); setRefErr(""); }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {refErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{refErr}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <FormField label="Name" required>
                      <Input value={refForm.name} onChange={(e) => setRefForm({ ...refForm, name: e.target.value })} placeholder="Full name" />
                    </FormField>
                    <FormField label="Type">
                      <Select value={refForm.type} onChange={(e) => setRefForm({ ...refForm, type: e.target.value as typeof refForm.type })}>
                        {(["DOCTOR","HOSPITAL","CLINIC","INDIVIDUAL","OTHER"] as const).map((t) => (
                          <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Specialization">
                      <Input value={refForm.specialization} onChange={(e) => setRefForm({ ...refForm, specialization: e.target.value })} placeholder="e.g. Cardiologist" />
                    </FormField>
                    <FormField label="Phone">
                      <Input type="tel" inputMode="numeric" maxLength={10} value={refForm.phone}
                        onChange={(e) => setRefForm({ ...refForm, phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit (optional)" />
                    </FormField>
                    <FormField label="Organization">
                      <Input value={refForm.organization} onChange={(e) => setRefForm({ ...refForm, organization: e.target.value })} placeholder="Hospital / clinic name" />
                    </FormField>
                    <FormField label="Notes">
                      <Input value={refForm.notes} onChange={(e) => setRefForm({ ...refForm, notes: e.target.value })} placeholder="Optional notes" />
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => { setRefModalOpen(false); setRefErr(""); }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                    <button type="button" onClick={handleSaveReferrer} disabled={refSaving}
                      className="px-3 py-1.5 text-xs bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white rounded-lg transition-colors font-semibold">
                      {refSaving ? "Saving…" : "Save Referrer"}
                    </button>
                  </div>
                </div>
              )}

              {/* ID Proof — a patient-identity fact, stays on the Patient tab. */}
              <SectionHeading>ID Proof</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="ID Proof Type">
                  <Select value={form.idProofType} onChange={(e) => setForm({ ...form, idProofType: e.target.value })}>
                    <option value="">Select</option>
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="PAN">PAN</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Other">Other</option>
                  </Select>
                </FormField>
                {form.idProofType && (
                  <FormField label="ID Proof Number">
                    <Input value={form.idProofNo} onChange={(e) => setForm({ ...form, idProofNo: e.target.value })} placeholder="Enter ID number" />
                  </FormField>
                )}
              </div>

              {/* Visit Type + all admission facts (ward/bed/type, attendant, insurance)
                  are shown ONLY for new registration. In edit mode they live on the
                  Admission Details tab, owned by the admission API. */}
              {!editPatient && (
                <>
                  <SectionHeading>Visit Type</SectionHeading>
                  <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <span className="text-indigo-700 font-semibold text-sm">🛏️ Registering as In-Patient (IP)</span>
                    <span className="text-xs text-indigo-500 ml-auto">Use OP Token Queue for out-patients</span>
                  </div>

                  <SectionHeading>Inpatient Details</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Ward" required error={formErrors.wardId}>
                      <Select value={form.wardId ?? ""} onChange={(e) => setForm({ ...form, wardId: Number(e.target.value) || null, bedId: null })}>
                        <option value="">Select ward</option>
                        {wards.filter(w => w.status === "ACTIVE").map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Bed" required error={formErrors.bedId}>
                      {form.wardId && availableBeds.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          All beds in this ward are occupied
                        </div>
                      ) : (
                        <Select value={form.bedId ?? ""} onChange={(e) => setForm({ ...form, bedId: Number(e.target.value) || null })} disabled={!form.wardId}>
                          <option value="">{form.wardId ? "Select bed" : "Select ward first"}</option>
                          {availableBeds.map((b) => <option key={b.id} value={b.id}>{b.number}</option>)}
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Admission Type">
                      <Select value={form.admissionType ?? "Planned Treatment"} onChange={(e) => setForm({ ...form, admissionType: e.target.value as typeof form.admissionType })}>
                        <option value="Planned Treatment">Planned Treatment</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Maternity">Maternity</option>
                        <option value="Daycare">Daycare</option>
                      </Select>
                    </FormField>
                  </div>
                  <SectionHeading>Attendant / Emergency Contact</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Attendant Name">
                      <Input value={form.attendantName} onChange={(e) => setForm({ ...form, attendantName: e.target.value })} placeholder="Name of attendant" />
                    </FormField>
                    <FormField label="Relation to Patient">
                      <Input value={form.attendantRelation} onChange={(e) => setForm({ ...form, attendantRelation: e.target.value })} placeholder="e.g. Spouse, Parent" />
                    </FormField>
                    <FormField label="Attendant Phone">
                      <Input type="tel" inputMode="numeric" maxLength={10} value={form.attendantPhone} onChange={(e) => setForm({ ...form, attendantPhone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile" />
                    </FormField>
                  </div>
                  <SectionHeading>Payment / Insurance</SectionHeading>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <FormField label="Payment Mode" required>
                      <Select value={form.paymentMode}
                        onChange={(e) => {
                          const mode = e.target.value as "CASH" | "INSURANCE";
                          setForm(prev => mode !== "INSURANCE"
                            ? { ...prev, paymentMode: mode, isInsurance: false, insuranceCompany: "", insuranceCompanyId: null, tpaName: "", policyNo: "", insuranceClaimType: "" }
                            : { ...prev, paymentMode: mode, isInsurance: true });
                        }}>
                        <option value="CASH">Cash</option>
                        <option value="INSURANCE">Insurance</option>
                      </Select>
                    </FormField>
                    {form.paymentMode === "INSURANCE" && (
                      <p className="col-span-full text-xs text-slate-500">
                        Insurance patient — company, TPA, policy and claim details are captured later in the Insurance workflow.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Admission flags — only for NEW IP registration. In edit mode these
                  live on the Admission Details tab (owned by the admission API). */}
              {!editPatient && form.type === "IP" && (
                <>
                  <SectionHeading>Admission Flags</SectionHeading>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.freePatient}
                        onChange={e => setForm({ ...form, freePatient: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                      <span className="text-sm text-slate-700">Free Admission (bill check bypassed at discharge)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.surgical}
                        onChange={e => setForm({ ...form, surgical: e.target.checked })}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                      <span className="text-sm text-slate-700">Surgical Case</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.mlc}
                        onChange={e => setForm({ ...form, mlc: e.target.checked, mlcNumber: e.target.checked ? form.mlcNumber : "" })}
                        className="w-4 h-4 accent-red-500 cursor-pointer" />
                      <span className="text-sm text-slate-700">MLC (Medico-Legal Case)</span>
                    </label>
                  </div>
                  {form.mlc && (
                    <FormField label="MLC Number">
                      <Input value={form.mlcNumber} onChange={e => setForm({ ...form, mlcNumber: e.target.value })}
                        placeholder="MLC reference number" className="max-w-xs" />
                    </FormField>
                  )}
                </>
              )}
            </fieldset>
          )}

          {/* ----------------------------------------------------
              EDIT MODE — ADMISSION DETAILS TAB (editable, own API)
          ---------------------------------------------------- */}
          {editPatient && editTab === "admission" && (
            editActiveAdmission && admEditForm ? (
              <div className="space-y-5">
                {admEditError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <span className="font-semibold">Error: </span>{admEditError}
                  </div>
                )}

                {/* Context strip — admission no + current ward/bed (ward/bed change via Transfer, not here) */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-slate-400">Admission No</p><p className="font-mono font-semibold text-slate-800">{editActiveAdmission.admissionNo}</p></div>
                  <div><p className="text-slate-400">UHID</p><p className="font-mono font-semibold text-slate-800">{editPatient.uhid}</p></div>
                  <div><p className="text-slate-400">Ward / Bed</p><p className="font-semibold text-slate-800">{editActiveAdmission.wardName ?? "—"}{editActiveAdmission.bedNumber ? ` — ${editActiveAdmission.bedNumber}` : ""}</p></div>
                  <div><p className="text-slate-400">Status</p><p className="font-semibold text-slate-800">{editActiveAdmission.status}</p></div>
                </div>

                <SectionHeading>Admission Details</SectionHeading>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <FormField label="Patient Name (on bills / insurance)">
                      <Input value={admEditForm.patientName}
                        onChange={e => setAdmEditForm({ ...admEditForm, patientName: e.target.value })}
                        placeholder="Full name as it should appear on bills / claims" />
                    </FormField>
                  </div>
                  <FormField label="Age (years)">
                    <Input type="number" min={0} max={130}
                      value={editPatient.age ?? ""}
                      onChange={async e => {
                        const age = Number(e.target.value);
                        // Optimistic UI update on the patient row; persisted via PUT patient
                        await apiFetch(`/api/patients/${editPatient.id}`, {
                          method: "PUT",
                          body: JSON.stringify({ age: age || null }),
                        });
                        setEditPatient({ ...editPatient, age: age || null });
                        loadPatients();
                      }}
                      placeholder="Age" />
                  </FormField>
                  <FormField label="Admission Type">
                    <Select value={admEditForm.admissionType}
                      onChange={e => setAdmEditForm({ ...admEditForm, admissionType: e.target.value as typeof admEditForm.admissionType })}>
                      <option value="Planned Treatment">Planned Treatment</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Maternity">Maternity</option>
                      <option value="Daycare">Daycare</option>
                    </Select>
                  </FormField>
                  <FormField label="Condition">
                    <Select value={admEditForm.condition}
                      onChange={e => setAdmEditForm({ ...admEditForm, condition: e.target.value as IPCondition })}>
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Admission Date">
                    <Input type="date" value={admEditForm.admissionDate}
                      onChange={e => setAdmEditForm({ ...admEditForm, admissionDate: e.target.value })} />
                  </FormField>
                  <FormField label="Admission Time">
                    <Input type="time" value={admEditForm.admissionTime}
                      onChange={e => setAdmEditForm({ ...admEditForm, admissionTime: e.target.value })} />
                  </FormField>
                  <FormField label="Department">
                    <Select value={admEditForm.department}
                      onChange={e => setAdmEditForm({ ...admEditForm, department: e.target.value, admittingDoctorName: "", admittingDoctorId: null })}>
                      <option value="">Select department</option>
                      {departments.map(d => <option key={d.id}>{d.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Admitting Doctor">
                    <Select value={admEditForm.admittingDoctorName}
                      onChange={e => {
                        const doc = doctors.find(d => d.name === e.target.value);
                        setAdmEditForm({ ...admEditForm, admittingDoctorName: e.target.value, admittingDoctorId: doc?.id ?? null });
                      }}>
                      <option value="">Select doctor</option>
                      {doctors.filter(d => !admEditForm.department || d.department === admEditForm.department).map(d => (
                        <option key={d.id}>{d.name}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 sm:col-span-4">
                    <FormField label="Provisional Diagnosis / Chief Complaint">
                      <Textarea value={admEditForm.provisionalDiagnosis} rows={2}
                        onChange={e => setAdmEditForm({ ...admEditForm, provisionalDiagnosis: e.target.value })}
                        placeholder="Diagnosis / chief complaint / reason for admission" />
                    </FormField>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <FormField label="Plan of Care">
                      <Select value={admEditForm.planOfCare}
                        onChange={e => setAdmEditForm({ ...admEditForm, planOfCare: e.target.value })}>
                        <option value="">Select</option>
                        {PLAN_OF_CARE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </FormField>
                  </div>
                  <FormField label="Expected Cost">
                    <Input value={admEditForm.expectedCost}
                      onChange={e => setAdmEditForm({ ...admEditForm, expectedCost: e.target.value })}
                      placeholder="e.g. 25000" />
                  </FormField>
                  <FormField label="Expected Outcome">
                    <Input value={admEditForm.expectedOutcome}
                      onChange={e => setAdmEditForm({ ...admEditForm, expectedOutcome: e.target.value })}
                      placeholder="e.g. Full recovery" />
                  </FormField>
                </div>
                <p className="text-xs text-slate-400 -mt-2">* Subject to change during the course of disease</p>

                <SectionHeading>Attendant / Emergency Contact</SectionHeading>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Attendant Name">
                    <Input value={admEditForm.attendantName}
                      onChange={e => setAdmEditForm({ ...admEditForm, attendantName: e.target.value })} placeholder="Name of attendant" />
                  </FormField>
                  <FormField label="Relation to Patient">
                    <Input value={admEditForm.attendantRelation}
                      onChange={e => setAdmEditForm({ ...admEditForm, attendantRelation: e.target.value })} placeholder="e.g. Spouse, Parent" />
                  </FormField>
                  <FormField label="Attendant Phone">
                    <Input type="tel" inputMode="numeric" maxLength={10} value={admEditForm.attendantPhone}
                      onChange={e => setAdmEditForm({ ...admEditForm, attendantPhone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile" />
                  </FormField>
                </div>

                <SectionHeading>Payment / Insurance</SectionHeading>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
                  <FormField label="Payment Mode" required>
                    <Select value={admEditForm.isInsurance ? "INSURANCE" : "CASH"}
                      onChange={e => {
                        const on = e.target.value === "INSURANCE";
                        setAdmEditForm(prev => prev && (on
                          ? { ...prev, isInsurance: true, paymentMode: "INSURANCE", insuranceStatus: prev.insuranceStatus || "DETAILS_INCOMPLETE" }
                          : { ...prev, isInsurance: false, paymentMode: "CASH", insuranceStatus: "", insuranceCompany: "", insuranceCompanyId: null, tpaName: "", claimNo: "", policyNo: "", preAuthNumber: "", insuranceClaimType: "" }));
                      }}>
                      <option value="CASH">Cash</option>
                      <option value="INSURANCE">Insurance</option>
                    </Select>
                  </FormField>
                </div>
                {admEditForm.isInsurance && (
                  <p className="text-xs text-slate-500 -mt-1 mb-1">
                    Insurance patient — company, TPA, policy and claim details are captured later in the Insurance workflow.
                  </p>
                )}

                <SectionHeading>Admission Flags</SectionHeading>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={admEditForm.free}
                      onChange={e => setAdmEditForm({ ...admEditForm, free: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                    <span className="text-sm text-slate-700">Free Admission (bill check bypassed at discharge)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={admEditForm.surgical}
                      onChange={e => setAdmEditForm({ ...admEditForm, surgical: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    <span className="text-sm text-slate-700">Surgical Case</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={admEditForm.mlc}
                      onChange={e => setAdmEditForm({ ...admEditForm, mlc: e.target.checked, mlcNumber: e.target.checked ? admEditForm.mlcNumber : "" })}
                      className="w-4 h-4 accent-red-500 cursor-pointer" />
                    <span className="text-sm text-slate-700">MLC (Medico-Legal Case)</span>
                  </label>
                </div>
                {admEditForm.mlc && (
                  <FormField label="MLC Number">
                    <Input value={admEditForm.mlcNumber}
                      onChange={e => setAdmEditForm({ ...admEditForm, mlcNumber: e.target.value })}
                      placeholder="MLC reference number" className="max-w-xs" />
                  </FormField>
                )}

                <SectionHeading>Notes</SectionHeading>
                <FormField label="Notes">
                  <Textarea value={admEditForm.notes} rows={2}
                    onChange={e => setAdmEditForm({ ...admEditForm, notes: e.target.value })}
                    placeholder="Any additional admission notes" />
                </FormField>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-6 text-sm text-slate-500 text-center">
                No active admission found for this patient. Admission details can only be edited while the patient is admitted.
              </div>
            )
          )}

        </div>

      </Modal>


      {/* ----------------------------------------------------------------------
          Admit Patient Modal (OP ? IP)
      ---------------------------------------------------------------------- */}
      <Modal
        open={!!admitPatient}
        onClose={() => { setAdmitPatient(null); setAdmitPatientForm(null); }}
        title={`Admit Patient — ${admitPatient?.name ?? ""}`}
        size="xl"
        footer={
          <>
            <button onClick={() => { setAdmitPatient(null); setAdmitPatientForm(null); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleAdmit}
              className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors">
              Admit &amp; Print Form
            </button>
          </>
        }
      >
        {admitPatient && (
          <div className="space-y-5">
            {admitErrors._api && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {admitErrors._api}
              </div>
            )}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs">
              <p className="text-slate-400">UHID</p>
              <p className="font-mono font-semibold text-slate-800">{admitPatient.uhid}</p>
            </div>

            {/* ── Patient Details (editable; saved to the patient master before admit) ── */}
            {admitPatientForm && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Details</p>
                  <span className="text-xs text-slate-400">Correct here if details differ for this admission</span>
                </div>
                <PatientDetailsFields
                  value={admitPatientForm}
                  onChange={(patch) => setAdmitPatientForm(prev => prev ? { ...prev, ...patch } : prev)}
                  phoneEditable={isAdmin}
                  areaOptions={areaOptions}
                  districtOptions={districtOptions}
                  referrers={referrers}
                  departments={departments}
                  doctors={doctors}
                  onAddArea={(v) => addDropdownOption("AREA", v)}
                  onAddDistrict={(v) => addDropdownOption("DISTRICT", v)}
                  onAddReferrer={() => { setRefForm(emptyRefForm()); setRefErr(""); setRefModalOpen(true); }}
                />
              </div>
            )}

            {/* ── Clinical Details ── */}
            <SectionHeading>Clinical Details</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Provisional Diagnosis">
                <Textarea value={admitForm.provisionalDiagnosis} onChange={(e) => setAdmitForm({ ...admitForm, provisionalDiagnosis: e.target.value })} placeholder="Diagnosis / reason" rows={1} />
              </FormField>
              <FormField label="Plan of Care">
                <Select value={admitForm.planOfCare} onChange={(e) => setAdmitForm({ ...admitForm, planOfCare: e.target.value })}>
                  <option value="">Select</option>
                  {PLAN_OF_CARE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </FormField>
              <FormField label="Notes">
                <Textarea value={admitForm.notes} onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })} placeholder="Any additional notes" rows={1} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Expected Cost">
                <Input value={admitForm.expectedCost} onChange={(e) => setAdmitForm({ ...admitForm, expectedCost: e.target.value })} placeholder="e.g. 25000" />
              </FormField>
              <FormField label="Expected Outcome">
                <Input value={admitForm.expectedOutcome} onChange={(e) => setAdmitForm({ ...admitForm, expectedOutcome: e.target.value })} placeholder="e.g. Full recovery" />
              </FormField>
            </div>
            <p className="text-xs text-slate-400 -mt-2">* Subject to change during the course of disease</p>

            {/* ── Admission Details ── */}
            <SectionHeading>Admission Details</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Admission Type">
                <Select value={admitForm.admissionType} onChange={(e) => setAdmitForm({ ...admitForm, admissionType: e.target.value as typeof admitForm.admissionType })}>
                  <option value="Planned Treatment">Planned Treatment</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Maternity">Maternity</option>
                  <option value="Daycare">Daycare</option>
                </Select>
              </FormField>
              <FormField label="Condition" required error={admitErrors.condition}>
                <Select value={admitForm.condition} onChange={(e) => setAdmitForm({ ...admitForm, condition: e.target.value as IPCondition })}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="Ward" required error={admitErrors.wardId}>
                <Select value={admitForm.wardId ?? ""} onChange={(e) => setAdmitForm({ ...admitForm, wardId: Number(e.target.value) || null, bedId: null })}>
                  <option value="">Select ward</option>
                  {wards.filter(w => w.status === "ACTIVE").map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Bed" required error={admitErrors.bedId}>
                {admitForm.wardId && availableAdmitBeds.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                    All beds occupied
                  </div>
                ) : (
                  <Select value={admitForm.bedId ?? ""} onChange={(e) => setAdmitForm({ ...admitForm, bedId: Number(e.target.value) || null })} disabled={!admitForm.wardId}>
                    <option value="">{admitForm.wardId ? "Select bed" : "Select ward first"}</option>
                    {availableAdmitBeds.map((b) => <option key={b.id} value={b.id}>{b.number}</option>)}
                  </Select>
                )}
              </FormField>
              <FormField label="Admitted Date">
                <Input type="date" value={admitForm.admittedDate} onChange={(e) => setAdmitForm({ ...admitForm, admittedDate: e.target.value })} />
              </FormField>
              <FormField label="Admitted Time">
                <Input type="time" value={admitForm.admittedTime} onChange={(e) => setAdmitForm({ ...admitForm, admittedTime: e.target.value })} />
              </FormField>
            </div>

            {/* ── Emergency Contact ── */}
            <SectionHeading>Attendant / Emergency Contact</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Contact Name">
                <Input value={admitForm.emergencyContactName} onChange={(e) => setAdmitForm({ ...admitForm, emergencyContactName: e.target.value })} placeholder="Full name" />
              </FormField>
              <FormField label="Contact Phone">
                <Input type="tel" inputMode="numeric" maxLength={10} value={admitForm.emergencyContactPhone} onChange={(e) => setAdmitForm({ ...admitForm, emergencyContactPhone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile" />
              </FormField>
              <FormField label="Relation to Patient">
                <Input value={admitForm.emergencyContactRelation} onChange={(e) => setAdmitForm({ ...admitForm, emergencyContactRelation: e.target.value })} placeholder="e.g. Spouse, Son" />
              </FormField>
            </div>

            {/* ── Payment / Insurance ── */}
            <SectionHeading>Payment / Insurance</SectionHeading>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={admitForm.isInsurance}
                  onChange={(e) => setAdmitForm({ ...admitForm, isInsurance: e.target.checked })}
                  className="w-4 h-4 accent-sky-600 cursor-pointer" />
                <span className="text-sm text-slate-700">Insurance patient</span>
              </label>
              {admitForm.isInsurance && (
                <p className="text-xs text-slate-400 ml-6">
                  Marked as insurance. Enter the insurance company, policy, TPA and claim
                  details later from the Insurance workflow — not required at admission.
                </p>
              )}
            </div>

            {/* ── Admission Flags ── */}
            <SectionHeading>Admission Flags</SectionHeading>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={admitForm.free}
                  onChange={(e) => setAdmitForm({ ...admitForm, free: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                <span className="text-sm text-slate-700">Free Admission</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={admitForm.surgical}
                  onChange={(e) => setAdmitForm({ ...admitForm, surgical: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                <span className="text-sm text-slate-700">Surgical Case</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={admitForm.mlc}
                  onChange={(e) => setAdmitForm({ ...admitForm, mlc: e.target.checked, mlcNumber: e.target.checked ? admitForm.mlcNumber : "" })}
                  className="w-4 h-4 accent-red-500 cursor-pointer" />
                <span className="text-sm text-slate-700">MLC (Medico-Legal Case)</span>
              </label>
            </div>
            {admitForm.mlc && (
              <FormField label="MLC Number" required error={admitErrors.mlcNumber}>
                <Input value={admitForm.mlcNumber} onChange={(e) => setAdmitForm({ ...admitForm, mlcNumber: e.target.value })}
                  placeholder="MLC reference number" className="max-w-xs" />
              </FormField>
            )}
          </div>
        )}
      </Modal>

      {/* ----------------------------------------------------------------------
          IP Status Update Modal
      ---------------------------------------------------------------------- */}
      <Modal
        open={!!statusPatient}
        onClose={() => {
          setStatusPatient(null); setLabTests([]); setStatusApiError(null);
          setStatusForm({ field: "condition", to: "", wardId: null, bedId: null, newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "" });
        }}
        title={`Update Status — ${statusPatient?.name}`}
        size="md"
        footer={
          <>
            <button onClick={() => {
              setStatusPatient(null); setLabTests([]); setStatusApiError(null);
              setStatusForm({ field: "condition", to: "", wardId: null, bedId: null, newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "" });
            }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              disabled={
                statusSaving || !activeAdmission ||
                (statusForm.field === "lab" ? labTests.length === 0
                  : statusForm.field === "ward" ? !statusForm.wardId
                    : statusForm.field === "doctor" ? !statusForm.newDoctor
                      : !statusForm.to)
              }
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-40
                disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors">
              {statusSaving ? "Saving—"
                : statusForm.field === "discharge" ? "Confirm Discharge"
                  : statusForm.field === "lab" ? "Order Tests"
                    : "Update"}
            </button>
          </>
        }
      >
        {statusPatient && (
          <div className="space-y-4">
            {/* Admission info card */}
            {admissionLoading ? (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 animate-pulse h-16" />
            ) : activeAdmission ? (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-slate-400">Ward / Bed</p><p className="font-semibold text-slate-800">{activeAdmission.wardName ?? "—"} / {activeAdmission.bedNumber ?? "—"}</p></div>
                <div>
                  <p className="text-slate-400">Admitted</p>
                  <p className="font-semibold text-slate-800">
                    {activeAdmission.admissionDate ? new Date(activeAdmission.admissionDate).toLocaleDateString("en-IN") : "—"}
                    {activeAdmission.daysAdmitted != null && ` (${activeAdmission.daysAdmitted}d)`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                No active admission found.
              </div>
            )}

            {statusApiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                {statusApiError}
              </div>
            )}

            <div className="bg-sky-50 rounded-lg px-3 py-2 text-xs text-sky-700">
              Updating as <span className="font-semibold">{userName}</span> — Role: {role}
            </div>

            <FormField label="What to update">
              <Select value={statusForm.field} onChange={(e) => setStatusForm({
                field: e.target.value, to: "", wardId: null, bedId: null,
                newDoctor: "", notes: "", finalDiagnosis: "", referredTo: "",
              })}>
                {getUpdateableFields().map((f) => (
                  <option key={f} value={f}>
                    {f === "condition" ? "🩺 Condition"
                      : f === "ward" ? "🛏️ Transfer Ward / Bed"
                        : f === "doctor" ? "👨‍⚕️ Transfer Doctor"
                          : f === "lab" ? "🧪 Order Lab Tests"
                            : "🚪 Discharge Patient"}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Condition */}
            {statusForm.field === "condition" && (
              <FormField label="New Condition">
                <Select value={statusForm.to} onChange={(e) => setStatusForm({ ...statusForm, to: e.target.value })}>
                  <option value="">Select condition</option>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </FormField>
            )}

            {/* Ward Transfer */}
            {statusForm.field === "ward" && (
              <div className="space-y-3">
                <FormField label="New Ward">
                  <Select value={statusForm.wardId ?? ""} onChange={(e) => setStatusForm({ ...statusForm, wardId: Number(e.target.value) || null, bedId: null })}>
                    <option value="">Select ward</option>
                    {wards.filter(w => w.status === "ACTIVE").map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="New Bed">
                  {statusForm.wardId && allBeds.filter(b => b.wardId === statusForm.wardId && b.status === "AVAILABLE").length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      All beds in this ward are occupied
                    </div>
                  ) : (
                    <Select value={statusForm.bedId ?? ""} onChange={(e) => setStatusForm({ ...statusForm, bedId: Number(e.target.value) || null })} disabled={!statusForm.wardId}>
                      <option value="">{statusForm.wardId ? "Select bed (optional)" : "Select ward first"}</option>
                      {allBeds.filter(b => b.wardId === statusForm.wardId && b.status === "AVAILABLE").map((b) => <option key={b.id} value={b.id}>{b.number}</option>)}
                    </Select>
                  )}
                </FormField>
              </div>
            )}

            {/* Doctor Transfer */}
            {statusForm.field === "doctor" && (
              <FormField label="New Doctor">
                <Select value={statusForm.newDoctor} onChange={(e) => setStatusForm({ ...statusForm, newDoctor: e.target.value, to: e.target.value })}>
                  <option value="">Select doctor</option>
                  {doctors.map((d) => <option key={d.id}>{d.name}</option>)}
                </Select>
              </FormField>
            )}

            {/* Lab Tests */}
            {statusForm.field === "lab" && (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs text-purple-700">
                    Select tests from the lab master. Each test will be sent to the lab module.<br />
                    Patient: <span className="font-semibold">{statusPatient.name}</span> — {statusPatient.uhid}
                  </p>
                </div>

                <FormField label="Add Test">
                  <TestSearchSelect
                    options={labMasterList}
                    excludeIds={new Set(labTests.map(lt => lt.id))}
                    accent="sky"
                    onAdd={t => setLabTests(prev => [...prev, { ...t, priority: "Routine" as LabPriority }])}
                  />
                </FormField>

                {labTests.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Ordered Tests ({labTests.length})
                    </p>
                    {labTests.map((t, idx) => (
                      <div key={t.testCode} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p>
                          <p className="text-xs text-slate-400">
                            {t.category} — ₹{t.price}
                            {t.turnaroundTime && ` — TAT: ${t.turnaroundTime}`}
                          </p>
                        </div>
                        <select
                          value={t.priority}
                          onChange={e => setLabTests(prev => prev.map((x, i) =>
                            i === idx ? { ...x, priority: e.target.value as LabPriority } : x
                          ))}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none
                            ${t.priority === "STAT" ? "bg-red-50 text-red-700 border-red-200"
                              : t.priority === "Urgent" ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          <option value="Routine">Routine</option>
                          <option value="Urgent">Urgent</option>
                          <option value="STAT">STAT</option>
                        </select>
                        <button type="button"
                          onClick={() => setLabTests(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs text-slate-500 px-1">
                      <span>{labTests.length} test{labTests.length !== 1 ? "s" : ""} selected</span>
                      <span className="font-semibold text-slate-700">
                        Total: ₹{labTests.reduce((s, t) => s + t.price, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
                {labTests.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No tests added yet</p>
                )}
              </div>
            )}

            {/* Discharge */}
            {statusForm.field === "discharge" && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-amber-700">Ensure all bills are settled before discharge.</p>
                </div>
                <FormField label="Discharge Type" required>
                  <Select value={statusForm.to} onChange={(e) => setStatusForm({ ...statusForm, to: e.target.value })}>
                    <option value="">Select type</option>
                    <option value="NORMAL">Normal — Recovered</option>
                    <option value="LAMA">LAMA — Left Against Medical Advice</option>
                    <option value="REFERRED">Referred — Transferred to another hospital</option>
                    <option value="EXPIRED">Expired — Patient deceased</option>
                  </Select>
                </FormField>
                {statusForm.to === "LAMA" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <p className="font-bold">LAMA Discharge</p>
                    <p className="mt-0.5">Patient is leaving against medical advice. Ensure the LAMA consent form is signed.</p>
                  </div>
                )}
                {statusForm.to === "EXPIRED" && (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
                    Marking as Expired. Bed will be released automatically.
                  </div>
                )}
                {statusForm.to === "REFERRED" && (
                  <FormField label="Referred To (Hospital / Facility)">
                    <Input
                      value={statusForm.referredTo}
                      onChange={(e) => setStatusForm({ ...statusForm, referredTo: e.target.value })}
                      placeholder="e.g. Apollo Hospital, Chennai"
                    />
                  </FormField>
                )}
                <FormField label="Final Diagnosis">
                  <Textarea
                    value={statusForm.finalDiagnosis}
                    onChange={(e) => setStatusForm({ ...statusForm, finalDiagnosis: e.target.value })}
                    placeholder={`e.g. ${statusPatient.illness ?? ""}`}
                    rows={2}
                  />
                  {statusPatient.illness && (
                    <p className="text-xs text-slate-400 mt-1">Leave blank to use chief complaint: &quot;{statusPatient.illness}&quot;</p>
                  )}
                </FormField>
              </div>
            )}

            {/* Notes — always shown */}
            <FormField label={statusForm.field === "discharge" ? "Doctor's Instructions / Notes" : "Notes / Reason"}>
              <Textarea
                value={statusForm.notes}
                onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                placeholder={statusForm.field === "discharge" ? "Follow-up instructions, rest advice—" : "Optional notes"}
                rows={2}
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Transfer History / Timeline Modal */}
      <Modal
        open={!!historyPatient}
        onClose={() => { setHistoryPatient(null); setActiveAdmission(null); setOpVisits([]); }}
        title={"Patient Timeline" + (historyPatient ? " \u2014 " + historyPatient.name : "")}
        size="lg"
      >
        {historyPatient && (
          <div className="space-y-4">
            {admissionLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg" />)}
              </div>
            ) : (() => {
              const opFiltered = opVisits
                .filter(v => v.uhid === historyPatient.uhid)
                .sort((a, b) => (b.visitDate + (b.visitTime ?? "")).localeCompare(a.visitDate + (a.visitTime ?? "")));
              const hasData = historyAdmissions.length > 0 || opFiltered.length > 0;
              if (!hasData) return <p className="text-sm text-slate-400 text-center py-8">No history found.</p>;
              return (
                <div className="space-y-4">

                  {/* -- All admissions, newest first -- */}
                  {historyAdmissions.map(adm => {
                    const isDischarged = adm.status === "DISCHARGED";
                    const admTransfers = [...adm.transfers].sort((a, b) =>
                      (a.transferDate + (a.transferTime ?? "")).localeCompare(b.transferDate + (b.transferTime ?? ""))
                    );
                    return (
                      <div key={adm.id}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          {adm.admissionNo} {isDischarged ? "— Discharged" : "— Active"}
                        </p>
                        <div className="space-y-2">
                          {/* Admission event */}
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">Admitted</span>
                                <span className="text-xs text-slate-400">{adm.admissionNo}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDischarged ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{adm.status}</span>
                              </div>
                              <p className="text-sm text-slate-700 mt-0.5">{(adm.wardName ?? "—") + (adm.bedNumber ? " — Bed " + adm.bedNumber : "")}</p>
                              {adm.admittingDoctorName && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{adm.admittingDoctorName}</span></p>}
                              {adm.provisionalDiagnosis && <p className="text-xs text-slate-400 italic mt-0.5">{adm.provisionalDiagnosis}</p>}
                              <p className="text-xs text-slate-400 mt-0.5">{(adm.admissionDate ?? "—")}{adm.admissionTime ? ", " + adm.admissionTime : ""}{adm.daysAdmitted != null ? " (" + adm.daysAdmitted + "d)" : ""}</p>
                            </div>
                          </div>

                          {/* Transfer events */}
                          {admTransfers.map((h, i) => (
                            <div key={"tr-" + i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" /></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800 capitalize">{h.transferType.charAt(0) + h.transferType.slice(1).toLowerCase().replace(/_/g, " ")}</span>
                                  <span className="text-sm"><span className="text-red-500">{h.fromValue}</span>{" ? "}<span className="text-emerald-600 font-medium">{h.toValue}</span></span>
                                </div>
                                {h.orderedBy && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{h.orderedBy}</span></p>}
                                {h.reason && <p className="text-xs text-slate-400 italic mt-0.5">{h.reason}</p>}
                                <p className="text-xs text-slate-400 mt-0.5">{h.transferDate}{h.transferTime ? ", " + h.transferTime : ""}</p>
                              </div>
                            </div>
                          ))}

                          {/* Discharge event */}
                          {isDischarged && adm.dischargeDate && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800">Discharged</span>
                                  {adm.dischargeType && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{adm.dischargeType}</span>}
                                </div>
                                {adm.dischargingDoctorName && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{adm.dischargingDoctorName}</span></p>}
                                {adm.finalDiagnosis && <p className="text-xs text-slate-400 italic mt-0.5">{adm.finalDiagnosis}</p>}
                                <p className="text-xs text-slate-400 mt-0.5">{adm.dischargeDate}{adm.dischargeTime ? ", " + adm.dischargeTime : ""}{adm.totalDaysStayed != null ? " (" + adm.totalDaysStayed + "d total)" : ""}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* -- OP visits -- */}
                  {opFiltered.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">OP Visits</p>
                      <div className="space-y-2">
                        {opFiltered.map((v, i) => (
                          <div key={"op-" + i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">OP Visit</span>
                                <span className="text-xs text-slate-400">{v.visitNo}</span>
                                <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">{v.type}</span>
                              </div>
                              <p className="text-sm text-slate-700 mt-0.5">{v.chiefComplaint}</p>
                              <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{v.doctorName}</span></p>
                              <p className="text-xs text-slate-400 mt-0.5">{v.visitDate}{v.visitTime ? ", " + v.visitTime : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* -- Bill Settlement Warning Modal -- */}
      {billCheckWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Icon + title */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Pending Bills — Cannot Discharge</h2>
                <p className="text-xs text-slate-500 mt-1">
                  This patient has unsettled bills totalling{" "}
                  <span className="font-bold text-red-600">
                    ?{billCheckWarning.dueAmount.toLocaleString("en-IN")}
                  </span>. Full discharge requires all bills to be paid.
                </p>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
              <p>— The discharge summary has been saved as a <strong>draft</strong>.</p>
              <p>— Please collect the pending payment, then complete the discharge.</p>
              <p>— You can still open and edit the discharge summary now.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setBillCheckWarning(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <Link
                href={`/bills?patientId=${billCheckWarning.patientId}`}
                onClick={() => setBillCheckWarning(null)}
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Go to Bills
              </Link>
              <Link
                href={`/patients/${billCheckWarning.patientId}/discharge-summary`}
                onClick={() => setBillCheckWarning(null)}
                className="px-4 py-2 text-sm bg-[#00059f] text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
              >
                Open Discharge Summary
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* -- Collect Cash (advance receipt) Modal -- */}
      <CollectCashModal
        open={!!collectPatient}
        onClose={() => setCollectPatient(null)}
        patient={collectPatient}
        receivedBy={userName}
        onSaved={() => setReceiptsRefresh(n => n + 1)}
      />
    </div>
  );
}
