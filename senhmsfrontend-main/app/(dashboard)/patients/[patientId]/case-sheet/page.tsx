"use client";

import { useState, useEffect, useCallback, use, useRef, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSession } from "../../../../_lib/auth";
import { printHtml } from "../../../../_lib/print";
import { buildLabReportHtml, type LabReportData, type LabReportTest } from "../../../../_lib/lab-report";
import Badge from "../../../../_components/Badge";
import Modal, { FormField, Input, Select, Textarea } from "../../../../_components/Modal";
import TestSearchSelect from "../../../../_components/TestSearchSelect";
import HospitalHeader from "../../../../_components/hospital/HospitalHeader";
import { HOSPITAL } from "../../../../_lib/hospital-config";

// ─── Backend response types ───────────────────────────────────────────────────

interface PatientResponse {
  id: number;
  uhid: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup: string;
  dateOfBirth: string;
  maritalStatus: string;
  religion: string;
  nationality: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  area: string;
  district: string;
  state: string;
  pinCode: string;
  illness: string;
  referredBy: string;
  doctorName: string;
  department: string;
  patientType: string;
  insuranceCompany: string;
  policyNo: string;
  tpaName: string;
  attendantName: string;
  attendantRelation: string;
  attendantPhone: string;
  idProofType: string;
  idProofNo: string;
  notes: string;
  active: boolean;
  freePatient: boolean;
  createdBy: string;
  createdAt: string;
}

interface AdmissionResponse {
  id: number;
  admissionNo: string;
  patientId: number;
  uhid: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  admissionType: string;
  admissionDate: string;
  admissionTime: string;
  provisionalDiagnosis: string;
  conditionOnAdmission: string;
  admittingDoctorId: number;
  admittingDoctorName: string;
  department: string;
  wardId: number;
  wardName: string;
  bedId: number;
  bedNumber: string;
  referredBy: string;
  attendantName: string;
  attendantRelation: string;
  attendantPhone: string;
  paymentMode: string;
  isInsurance?: boolean;
  insuranceStatus?: string;
  insuranceCompany: string;
  policyNo: string;
  tpaName: string;
  preAuthNumber: string;
  mlc: boolean;
  mlcNumber: string;
  free: boolean;
  surgical: boolean;
  status: string;
  dischargeNo: string;
  dischargeType: string;
  dischargeDate: string;
  dischargeTime: string;
  dischargingDoctorName: string;
  finalDiagnosis: string;
  proceduresPerformed: string;
  conditionOnDischarge: string;
  followUpDate: string;
  referredTo: string;
  totalDaysStayed: number;
  dischargeNotes: string;
  daysAdmitted: number;
  notes: string;
  planOfCare: string;
  expectedCost: string;
  expectedOutcome: string;
  transfers: TransferLogResponse[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TransferLogResponse {
  id: number;
  transferType: string;
  fromValue: string;
  toValue: string;
  transferDate: string;
  transferTime: string | null;
  orderedBy: string | null;
  reason: string;
  notes: string | null;
  createdAt: string | null;
}

interface ObservationResponse {
  id: number;
  patientId: number;
  uhid: string;
  admissionId: number;
  visitId: number;
  date: string;
  time: string;
  doctorName: string;
  doctorId: number;
  type: string;  // ROUND | CONSULTATION | POST_OP | EMERGENCY | DISCHARGE_NOTE
  chiefComplaint: string;
  clinicalFindings: string;
  diagnosis: string;
  plan: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface MedicationResponse {
  id: number;
  patientId: number;
  uhid: string;
  admissionId: number;
  visitId: number;
  date: string;
  time: string;
  prescribedBy: string;
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;  // ORAL | IV | IM | SC | TOPICAL | INHALATION | SUBLINGUAL | RECTAL | NASAL | OTHER
  duration: string;
  instructions: string;
  status: string; // ACTIVE | COMPLETED | STOPPED
  stoppedOn: string;
  stoppedReason: string;
  stoppedBy: string;
  createdAt: string;
}

interface VitalSignResponse {
  id: number;
  patientId: number;
  uhid: string;
  admissionId: number;
  visitId: number;
  recordedAt: string;
  recordedBy: string;
  bloodPressure: string;
  pulse: number;
  temperature: number;
  spo2: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bloodGlucose: number;
  notes: string;
}

interface LabMasterResponse {
  id: number;
  testCode: string;
  name: string;
  category: string;
  sampleType: string;
  normalRange: string;
  unit: string;
  turnaroundTime: string;
  price: number;
  status: string;
}

interface LabInvestigationResponse {
  id: number;
  labId: string;
  orderGroupId: string | null;
  patientId: number;
  patientName: string;
  uhid: string;
  admissionId: number | null;
  investigationName: string;
  testCode: string;
  category: string;
  sampleType: string;
  priority: string;
  orderedDate: string;
  orderedTime: string;
  orderedBy: string;
  status: string;
  result: string;
  normalRange: string;
  unit: string;
  isAbnormal: boolean;
  price: number;
  doctorName?: string | null;
  completedDate?: string | null;
  completedTime?: string | null;
  completedBy?: string | null;
  /** Result type from the lab master: NUMERIC | TEXT | POSITIVE_NEGATIVE | DROPDOWN | CULTURE_SENSITIVITY | PDF */
  resultType?: string | null;
  /** Relative server path for uploaded PDF report (resultType=PDF only). */
  reportPdfPath?: string | null;
  /** JSON array of relative server paths for attached images. */
  reportImages?: string | null;
}

interface PaymentRecordResponse {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  receivedBy: string | null;
  createdAt: string | null;
}

interface BillItemResponse {
  id: number;
  serviceCode: string | null;
  modalityName: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface BillResponse {
  id: number;
  billNo: string;
  patientId: number;
  date: string;
  towards: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: string;
  status: string;
  items: BillItemResponse[];
  payments: PaymentRecordResponse[];
}

// ─── Tab type ─────────────────────────────────────────────────────────────────
type Tab = "overview" | "observations" | "labs" | "medications" | "vitals" | "bills" | "timeline" | "discharge";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",     label: "Admission",         icon: "🏥" },
  { id: "observations", label: "Observations",      icon: "🩺" },
  { id: "labs",         label: "Lab Orders",        icon: "🔬" },
  { id: "medications",  label: "Medications",       icon: "💊" },
  { id: "vitals",       label: "Vitals",            icon: "📊" },
  { id: "bills",        label: "Bills",             icon: "💰" },
  { id: "timeline",     label: "Timeline",          icon: "⏱" },
  { id: "discharge",    label: "Discharge Summary", icon: "📄" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function daysSince(dt?: string | null) {
  if (!dt) return 0;
  return Math.floor((Date.now() - new Date(dt).getTime()) / 86400000);
}

// Map backend enum values to display labels
const OBS_TYPE_DISPLAY: Record<string, string> = {
  ROUND: "Round", CONSULTATION: "Consultation", POST_OP: "Post-Op",
  EMERGENCY: "Emergency", DISCHARGE_NOTE: "Discharge Note",
};
const OBS_TYPE_COLOR: Record<string, string> = {
  ROUND: "bg-sky-100 text-sky-700",
  CONSULTATION: "bg-amber-100 text-amber-700",
  POST_OP: "bg-purple-100 text-purple-700",
  EMERGENCY: "bg-red-100 text-red-700",
  DISCHARGE_NOTE: "bg-emerald-100 text-emerald-700",
};
// Map display label → backend enum
const OBS_TYPE_ENUM: Record<string, string> = {
  Round: "ROUND", Consultation: "CONSULTATION", "Post-Op": "POST_OP",
  Emergency: "EMERGENCY", "Discharge Note": "DISCHARGE_NOTE",
};
const MED_ROUTE_ENUM: Record<string, string> = {
  Oral: "ORAL", IV: "IV", IM: "IM", SC: "SC",
  Topical: "TOPICAL", Inhaled: "INHALATION", Sublingual: "SUBLINGUAL",
};
const MED_ROUTE_DISPLAY: Record<string, string> = {
  ORAL: "Oral", IV: "IV", IM: "IM", SC: "SC",
  TOPICAL: "Topical", INHALATION: "Inhaled", SUBLINGUAL: "Sublingual",
  RECTAL: "Rectal", NASAL: "Nasal", OTHER: "Other",
};
const MED_STATUS_DISPLAY: Record<string, string> = {
  ACTIVE: "Active", COMPLETED: "Completed", STOPPED: "Stopped",
};
const LAB_STATUS_DISPLAY: Record<string, string> = {
  PENDING: "Pending Estimate",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Group lab tests by their orderGroupId. Tests ordered together form one group;
// a lone test (or a legacy row with no group id) renders on its own.
interface LabGroup {
  key: string;
  orderedDate: string;
  orderedTime: string;
  groupStatus: string;
  tests: LabInvestigationResponse[];
}
function groupLabs(labs: LabInvestigationResponse[]): LabGroup[] {
  const map = new Map<string, LabInvestigationResponse[]>();
  for (const l of labs) {
    const key = l.orderGroupId ?? `lab-${l.id}`;
    const arr = map.get(key);
    if (arr) arr.push(l); else map.set(key, [l]);
  }
  const rollup = (tests: LabInvestigationResponse[]): string => {
    const active = [...new Set(tests.filter(t => t.status !== "CANCELLED").map(t => t.status))];
    if (active.length === 0) return "CANCELLED";
    if (active.length === 1) return active[0];
    for (const s of ["PENDING", "AWAITING_PAYMENT", "PAID", "IN_PROGRESS", "COMPLETED"]) {
      if (active.includes(s)) return s;
    }
    return active[0];
  };
  return [...map.entries()].map(([key, tests]) => ({
    key,
    orderedDate: tests[0].orderedDate,
    orderedTime: tests[0].orderedTime,
    groupStatus: rollup(tests),
    tests,
  }));
}

function conditionClass(c?: string | null) {
  switch (c) {
    case "CRITICAL":           return "bg-red-100 text-red-700";
    case "SERIOUS":            return "bg-orange-100 text-orange-700";
    case "STABLE":             return "bg-emerald-100 text-emerald-700";
    case "UNDER_OBSERVATION":  return "bg-amber-100 text-amber-700";
    default:                   return "bg-slate-100 text-slate-600";
  }
}
function conditionLabel(c?: string | null) {
  const map: Record<string, string> = {
    STABLE: "Stable", CRITICAL: "Critical", SERIOUS: "Serious",
    UNDER_OBSERVATION: "Under Observation",
  };
  return c ? (map[c] ?? c) : "";
}

function vitalStatus(key: string, val?: number | null) {
  if (val === undefined || val === null) return null;
  const ranges: Record<string, [number, number]> = {
    pulse: [60, 100], temperature: [97, 99], spo2: [95, 100], respiratoryRate: [12, 20],
  };
  const r = ranges[key];
  if (!r) return null;
  return val < r[0] ? "low" : val > r[1] ? "high" : "normal";
}
function vitalClass(s: string | null) {
  if (s === "low" || s === "high") return "text-red-600 font-semibold";
  if (s === "normal") return "text-emerald-600";
  return "text-slate-700";
}

// ─── Generic API fetch ────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  // cache: "no-store" ensures GETs (lab list, vitals, bills, etc.) always fetch
  // fresh data. Without it the browser can serve a stale response — e.g. a lab
  // order placed from the Lab Investigations page would not appear here until a
  // mutation forced a revalidation.
  const res  = await fetch(path, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

/**
 * Scope a patient's full lab list to a single admission.
 *
 * Labs are fetched by patient (so orders placed from the Lab Investigations page
 * still surface here even when they were saved with admissionId = NULL). We then
 * keep only the rows relevant to the selected admission:
 *   - rows explicitly linked to this admission (admissionId === admission.id), or
 *   - unlinked rows (admissionId == null) ordered within the admission's stay
 *     window [admissionDate, dischargeDate ?? today].
 */
function scopeLabsToAdmission(
  all: LabInvestigationResponse[],
  admission: AdmissionResponse | null
): LabInvestigationResponse[] {
  if (!admission) return all;
  const admId = admission.id;
  const from  = admission.admissionDate ?? null;
  const to    = admission.dischargeDate ?? new Date().toISOString().slice(0, 10);
  return all.filter(l => {
    if (l.admissionId != null) return l.admissionId === admId;
    // Unlinked order: include if ordered within this admission's window.
    if (!from || !l.orderedDate) return true;
    return l.orderedDate >= from && l.orderedDate <= to;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CaseSheetPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const searchParams = useSearchParams();
  const session  = getSession();
  const role     = session?.role ?? "Receptionist";
  const isMD     = role === "Managing Director";
  const canBill  = role === "Admin" || role === "Managing Director" || role === "Receptionist" || role === "Lab/Ins/Reception";
  const userName = session?.name ?? "";

  const [patient,    setPatient]    = useState<PatientResponse | null>(null);
  const [allAdmissions, setAllAdmissions] = useState<AdmissionResponse[]>([]);
  const [admission,  setAdmission]  = useState<AdmissionResponse | null>(null);
  // Initialise tab from URL param if provided (e.g. ?tab=discharge)
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab") as Tab | null;
    return t && ["overview","observations","labs","medications","vitals","bills","timeline","discharge"].includes(t) ? t : "overview";
  });
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError,   setPageError]   = useState("");

  // Derived: is the currently selected admission active (not discharged)?
  const isActive = admission !== null && admission.status !== "DISCHARGED";

  // ── Discharge Summary state ───────────────────────────────────────────────
  const [dsForm, setDsForm] = useState<Record<string, string>>({});
  const [dsSaving,  setDsSaving]  = useState(false);
  const [dsSaveMsg, setDsSaveMsg] = useState("");
  const [dsSaveErr, setDsSaveErr] = useState("");
  const [dsIsDirty, setDsIsDirty] = useState(false);

  // Case sheet data
  const [observations, setObservations] = useState<ObservationResponse[]>([]);
  const [medications,  setMedications]  = useState<MedicationResponse[]>([]);
  const [vitals,       setVitals]       = useState<VitalSignResponse[]>([]);
  const [labs,         setLabs]         = useState<LabInvestigationResponse[]>([]);
  const [bills,        setBills]        = useState<BillResponse[]>([]);
  // Tracks which bill rows have their items expanded (keyed by bill id)
  const [expandedBills, setExpandedBills] = useState<Set<number>>(new Set());
  const [opVisits,     setOpVisits]     = useState<{id:number;visitNo:string;uhid:string;doctorName:string;department:string|null;tokenNo:string;visitDate:string;visitTime:string|null;type:string;status:string;chiefComplaint:string}[]>([]);

  // Lab master list (for ordering)
  const [labMasters, setLabMasters] = useState<LabMasterResponse[]>([]);
  const [orderTests, setOrderTests] = useState<(LabMasterResponse & { priority: string })[]>([]);
  const [labModalOpen, setLabModalOpen] = useState(false);

  // ── Case documents ──────────────────────────────────────────────────────────
  interface CaseDocumentResponse {
    id: number;
    admissionId: number | null;
    visitId: number | null;
    title: string;
    description: string | null;
    filePath: string;
    originalName: string | null;
    fileType: string | null;
    fileSize: number | null;
    uploadedBy: string | null;
    createdAt: string | null;
  }
  const [caseDocs,        setCaseDocs]        = useState<CaseDocumentResponse[]>([]);
  const [docPreview,      setDocPreview]      = useState<CaseDocumentResponse | null>(null);
  const [docUploadOpen,   setDocUploadOpen]   = useState(false);
  const [docTitle,        setDocTitle]        = useState("");
  const [docDescription,  setDocDescription]  = useState("");
  const [docFile,         setDocFile]         = useState<File | null>(null);
  const [docThumbUrl,     setDocThumbUrl]     = useState<string | null>(null);
  const [docUploading,    setDocUploading]    = useState(false);
  const [docErr,          setDocErr]          = useState("");
  const docFileRef = useRef<HTMLInputElement | null>(null);

  // Build an object-URL thumbnail for the selected image file (revoked on change/unmount)
  useEffect(() => {
    if (docFile && docFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(docFile);
      setDocThumbUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setDocThumbUrl(null);
  }, [docFile]);
  const [orderSaving,  setOrderSaving]  = useState(false);

  // Observation modal
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [obsSaving,    setObsSaving]    = useState(false);
  const [obsForm, setObsForm] = useState({
    type: "Round",
    chiefComplaint: "", clinicalFindings: "", diagnosis: "", plan: "", notes: "",
  });

  // Medication modal
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [medSaving,    setMedSaving]    = useState(false);
  const [medForm, setMedForm] = useState({
    drugName: "", dosage: "", frequency: "", route: "Oral",
    duration: "", instructions: "",
  });

  // Vitals modal
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsSaving,    setVitalsSaving]    = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "", pulse: "", temperature: "", spo2: "",
    respiratoryRate: "", weight: "", height: "", bloodGlucose: "", notes: "",
  });

  // Stop medication
  const [stopMedId,  setStopMedId]  = useState<number | null>(null);
  const [stopReason, setStopReason] = useState("");
  const [stopSaving, setStopSaving] = useState(false);

  // Admission selector dropdown
  const [admDropOpen, setAdmDropOpen] = useState(false);

  // Discharge confirm state (for the discharge tab)
  const [dischargeForm, setDischargeForm] = useState({
    dischargeType: "NORMAL",
    finalDiagnosis: "",
    referredTo: "",
    notes: "",
  });
  const [discharging,        setDischarging]        = useState(false);
  const [dischargeErr,       setDischargeErr]       = useState("");
  const [dischargeBillBlock, setDischargeBillBlock] = useState<{ dueAmount: number } | null>(null);

  // ── Initial data load ──────────────────────────────────────────────────────
  const loadPatientAndAdmission = useCallback(async () => {
    setPageLoading(true); setPageError("");
    try {
      const [patRes, admRes] = await Promise.all([
        apiFetch(`/api/patients/${patientId}`),
        apiFetch(`/api/admissions/patient/${patientId}`),
      ]);
      if (!patRes.ok) { setPageError(patRes.error); return; }
      setPatient(patRes.data as PatientResponse);
      if (admRes.ok) {
        const list = (admRes.data as AdmissionResponse[]) ?? [];
        setAllAdmissions(list);
        // Use the most recent non-discharged admission, or the most recent overall
        const active = list.find(a => a.status !== "DISCHARGED") ?? list[0];
        setAdmission(active ?? null);

        // Pre-fill discharge summary form from admission data
        if (active) {
          await prefillDs(active);
        }
      // Fetch OP visits for this patient's UHID
      const uhid = (patRes.data as PatientResponse)?.uhid;
      if (uhid) {
        const opRes = await apiFetch(`/api/op-visits?uhid=${encodeURIComponent(uhid)}&size=50`);
        if (opRes.ok) {
          const raw = opRes.data?.content ?? opRes.data ?? [];
          setOpVisits(Array.isArray(raw) ? raw : []);
        }
      }
      }
    } finally {
      setPageLoading(false);
    }
  }, [patientId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pre-fill discharge summary from an admission ───────────────────────────
  const prefillDs = useCallback(async (active: AdmissionResponse) => {
    const gender = active.gender
      ? active.gender.charAt(0).toUpperCase() + active.gender.slice(1).toLowerCase()
      : "";
    const basePrefill: Record<string, string> = {
      admissionId:     String(active.id),
      admissionNo:     active.admissionNo ?? "",
      patientId:       String(active.patientId),
      uhid:            active.uhid ?? "",
      patientName:     active.patientName ?? "",
      ageSex:          active.age ? `${active.age} Years / ${gender}` : "",
      ipNo:            active.admissionNo ?? "",
      roomNo:          active.bedNumber
                         ? `${active.wardName ?? ""} - ${active.bedNumber}`
                         : (active.wardName ?? ""),
      consultantName:  active.admittingDoctorName ?? "",
      insuranceName:   active.insuranceCompany ?? "",
      claimNo:         "",
      dateOfAdmission: active.admissionDate ?? "",
      timeOfAdmission: active.admissionTime ?? "",
      dateOfDischarge: active.dischargeDate ?? "",
      timeOfDischarge: active.dischargeTime ?? "",
      finalDiagnosis:  active.finalDiagnosis ?? active.provisionalDiagnosis ?? "",
      chiefComplaints: "", historyOfPresentIllness: "", pastHistory: "",
      clinicalExamination: "", investigations: "", pulmonaryFunctionTest: "",
      hospitalCourse: "", treatmentInHospital: "", conditionAtDischarge: "",
      dischargeMedication: "", dischargeAdvice: "", followUp: "",
      consultantDesignation: "",
    };
    const dsRes = await apiFetch(`/api/discharge-summary/by-admission/${active.id}`);
    if (dsRes.ok && dsRes.data) {
      const d = dsRes.data as Record<string, string>;
      setDsForm({ ...basePrefill, ...Object.fromEntries(
        Object.entries(d).map(([k, v]) => [k, v ?? ""])
      )});
    } else {
      setDsForm(basePrefill);
    }
    setDsIsDirty(false);
  }, []);

  // ── Switch admission (from selector strip) ─────────────────────────────────
  const switchAdmission = useCallback(async (target: AdmissionResponse) => {
    // Warn if discharge summary has unsaved changes
    if (dsIsDirty) {
      if (!window.confirm("You have unsaved changes in the Discharge Summary. Switch anyway and lose changes?")) {
        return;
      }
    }
    setAdmission(target);
    setTab("overview");
  }, [dsIsDirty]);

  // Load case sheet data scoped to selected admission
  const loadCaseSheet = useCallback(async () => {
    if (!admission?.id) return;
    const admId = admission.id;
    const patId = patient?.id;
    // Labs are fetched by patient (not admission) so that orders placed from the
    // Lab Investigations page — which are stored with admissionId = NULL — still
    // appear here. We then scope them to the selected admission client-side.
    const [obsRes, medRes, vitalRes, labRes, billRes, docRes] = await Promise.all([
      apiFetch(`/api/case-sheet/observations?admissionId=${admId}`),
      apiFetch(`/api/case-sheet/medications?admissionId=${admId}`),
      apiFetch(`/api/case-sheet/vitals?admissionId=${admId}`),
      patId != null
        ? apiFetch(`/api/lab/investigations/patient/${patId}`)
        : apiFetch(`/api/lab/investigations/admission/${admId}`),
      apiFetch(`/api/bills/admission/${admId}`),
      apiFetch(`/api/case-sheet/documents/admission/${admId}`),
    ]);
    if (obsRes.ok)   setObservations(obsRes.data as ObservationResponse[]);
    if (medRes.ok)   setMedications(medRes.data as MedicationResponse[]);
    if (vitalRes.ok) setVitals(vitalRes.data as VitalSignResponse[]);
    if (labRes.ok) {
      const raw = Array.isArray(labRes.data) ? labRes.data : ((labRes.data as { content?: LabInvestigationResponse[] })?.content ?? []);
      setLabs(scopeLabsToAdmission(raw, admission));
    }
    if (billRes.ok) {
      const raw = Array.isArray(billRes.data) ? billRes.data : ((billRes.data as { content?: BillResponse[] })?.content ?? []);
      setBills(raw);
    }
    if (docRes.ok) {
      setCaseDocs(Array.isArray(docRes.data) ? docRes.data : []);
    }
  }, [admission?.id, patient?.id]);

  // Load lab masters for the order modal
  useEffect(() => {
    apiFetch("/api/masters/lab-masters?page=0&size=500").then(({ ok, data }) => {
      if (!ok) return;
      const raw = (data as { content?: LabMasterResponse[] })?.content ?? data ?? [];
      setLabMasters((Array.isArray(raw) ? raw : []).filter((l: LabMasterResponse) => l.status === "ACTIVE"));
    });
  }, []);

  useEffect(() => { loadPatientAndAdmission(); }, [loadPatientAndAdmission]);

  // When selected admission changes (or the patient finishes loading): reload
  // case sheet data + discharge summary. patient?.id is a dependency because
  // loadCaseSheet fetches labs by patient — without it the first run can fire
  // before `patient` is set and fall back to the admission-only query, hiding
  // OP/unlinked lab orders until another action re-triggers the load.
  useEffect(() => {
    if (!pageLoading && !pageError && admission && patient?.id) {
      loadCaseSheet();
      prefillDs(admission);
    }
    // Depend on loadCaseSheet (memoised on admission.id + patient.id) rather than
    // the raw ids. This guarantees the effect runs with the *latest* loadCaseSheet
    // closure once both admission and patient are committed. Depending only on the
    // ids let the effect fire with a stale memoised loadCaseSheet whose closure
    // still had admission = null, so it early-returned (`if (!admission?.id)`) and
    // the labs/observations/etc. never loaded on first paint — they only appeared
    // after a mutation handler (e.g. Add Observation) called the fresh loadCaseSheet.
  }, [pageLoading, pageError, admission, patient?.id, loadCaseSheet, prefillDs]);

  // ── Discharge summary save ─────────────────────────────────────────────────
  async function handleSaveDs() {
    const admId = dsForm.admissionId;
    if (!admId) return;
    setDsSaving(true); setDsSaveMsg(""); setDsSaveErr("");
    const body = {
      ...dsForm,
      admissionId: Number(admId),
      patientId:   dsForm.patientId ? Number(dsForm.patientId) : undefined,
      dateOfAdmission: dsForm.dateOfAdmission || null,
      dateOfDischarge: dsForm.dateOfDischarge || null,
    };
    const { ok, error } = await apiFetch(
      `/api/discharge-summary/by-admission/${admId}`,
      { method: "PUT", body: JSON.stringify(body) }
    );
    setDsSaving(false);
    if (!ok) { setDsSaveErr(error); return; }
    setDsSaveMsg("Saved");
    setDsIsDirty(false);
    setTimeout(() => setDsSaveMsg(""), 3000);
  }

  // ── Confirm discharge (from discharge summary tab) ────────────────────────
  async function handleConfirmDischarge() {
    if (!admission || !patient) return;
    setDischarging(true); setDischargeErr(""); setDischargeBillBlock(null);

    // Free admissions skip bill check entirely.
    // Bypass is driven ONLY by the per-admission free flag (admission.free).
    const isFreeDischarge = admission.free;
    if (!isFreeDischarge) {
      const billRes = await apiFetch(`/api/bills/patient/${patient.id}`);
      const allBillsRaw: {
        status: string; dueAmount: number; totalAmount?: number; paidAmount?: number;
        admissionId?: number | null; consolidated?: boolean; insurance?: boolean;
        patientShareClosed?: boolean;
      }[] = billRes.ok
        ? (Array.isArray(billRes.data) ? billRes.data : (billRes.data?.content ?? []))
        : [];
      // Real (non view-only) bills for THIS admission carry the money.
      const admBills = allBillsRaw
        .filter(b => b.status !== "CANCELLED" && !b.consolidated)
        .filter(b => admission.id == null || b.admissionId === admission.id);
      const noBill = admBills.length === 0;

      if (noBill) {
        setDischargeBillBlock({ dueAmount: 0 });
        await handleSaveDs();
        setDischarging(false);
        return;
      }

      const isInsurance = admBills.some(b => b.insurance) || !!admission.isInsurance;

      if (!isInsurance) {
        // ── CASH: the full balance must be cleared. ──
        const totalDue = admBills.reduce((s, b) => s + (b.dueAmount ?? 0), 0);
        if (totalDue > 0) {
          setDischargeBillBlock({ dueAmount: totalDue });
          await handleSaveDs();
          setDischarging(false);
          return;
        }
      } else {
        // ── INSURANCE: gate on the PATIENT'S share only. The insurer-approved
        // amount is a receivable that arrives later, so a bill whose patient
        // share is already closed (patientShareClosed) is dischargeable even
        // though its dueAmount still carries the insurer receivable.
        //   patientBalance = billAmount − insurer approved − patient paid
        const allClosed = admBills.every(b => b.patientShareClosed || b.status === "PAID");
        if (!allClosed) {
          const billAmount  = admBills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
          const patientPaid = admBills.reduce((s, b) => s + (b.paidAmount ?? 0), 0);
          // Read the admission's claim approved amount.
          let approvedAmount = 0;
          let claimStatus = admission.insuranceStatus ?? "";
          const clRes = await apiFetch(`/api/insurance/claims?page=0&size=200`);
          if (clRes.ok) {
            const claims: Array<{ admissionId: number | null; approvedAmount: number | null; status: string }> =
              Array.isArray(clRes.data) ? clRes.data : (clRes.data?.content ?? []);
            const claim = claims.find(c => c.admissionId === admission.id);
            if (claim) { approvedAmount = claim.approvedAmount ?? 0; claimStatus = claim.status; }
          }
          const patientBalance = billAmount - approvedAmount - patientPaid;
          // Insurer has responded once APPROVED / SETTLED / DECLINED. DECLINED
          // has approvedAmount = 0 so patientBalance is the full remaining due.
          const approvalEntered = approvedAmount > 0
            || claimStatus === "APPROVED" || claimStatus === "SETTLED"
            || claimStatus === "DECLINED";
          if (!approvalEntered && patientBalance !== 0) {
            setDischargeErr(
              "Insurance claim is not approved yet. Enter the insurer's approved amount " +
              "(Insurance module), then close the bill before discharge.");
            await handleSaveDs();
            setDischarging(false);
            return;
          }
          if (patientBalance !== 0) {
            setDischargeBillBlock({ dueAmount: Math.abs(patientBalance) });
            await handleSaveDs();
            setDischarging(false);
            return;
          }
        }
      }
    }

    // Save DS first, then discharge
    await handleSaveDs();

    const now   = new Date();
    const today = now.toISOString().slice(0, 10);
    const time  = now.toTimeString().slice(0, 5);

    const { ok, error } = await apiFetch(`/api/admissions/${admission.id}/discharge`, {
      method: "POST",
      body: JSON.stringify({
        dischargeType:         dischargeForm.dischargeType,
        dischargeDate:         dsForm.dateOfDischarge || today,
        dischargeTime:         dsForm.timeOfDischarge || time,
        dischargingDoctorName: dsForm.consultantName || userName,
        finalDiagnosis:        dsForm.finalDiagnosis || dischargeForm.finalDiagnosis || patient.illness || undefined,
        conditionOnDischarge:  dsForm.conditionAtDischarge || undefined,
        referredTo:            dischargeForm.dischargeType === "REFERRED" ? dischargeForm.referredTo : undefined,
        dischargeNotes:        dischargeForm.notes || dsForm.dischargeAdvice || undefined,
      }),
    });

    setDischarging(false);
    if (!ok) { setDischargeErr(error ?? "Discharge failed"); return; }

    // Reload — patient is now DISCHARGED
    await loadPatientAndAdmission();
  }

  function handlePrintDs() {
    const f = dsForm;
    const fmt2 = (d?: string) => {
      if (!d) return "—";
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }; 
    const sec = (title: string, content: string) =>
      content?.trim()
        ? `<div class="section"><div class="sec-title">${title}</div><div class="sec-body">${content.replace(/\n/g, "<br/>")}</div></div>`
        : "";
    const hrow = (label: string, value: string) =>
      `<tr><td class="hl">${label}</td><td class="hc">:</td><td class="hv">${value || "—"}</td></tr>`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Discharge Summary — ${f.patientName || ""}</title>
<style>
@page{size:A4;margin:10mm 12mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff}
.hosp-header{border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.hosp-logo{font-size:18px;font-weight:900;border:2px solid #1a1a6e;padding:4px 8px;line-height:1.1;color:#1a1a6e}
.hosp-sub{font-size:8px;font-weight:bold;letter-spacing:1px;display:block}
.hosp-center{text-align:center;flex:1;padding:0 10px}
.hosp-name{font-size:20px;font-weight:900;letter-spacing:1px}
.hosp-tag{font-size:11px;font-weight:bold}
.hosp-addr{font-size:9px;margin-top:2px}
.hosp-seal{font-size:8px;font-weight:bold;border:1.5px solid #000;padding:4px 6px;text-align:center}
.doc-title{text-align:center;font-size:13px;font-weight:bold;border:1.5px solid #000;padding:3px 0;letter-spacing:2px;margin-bottom:8px}
.ins-row{font-weight:bold;font-size:12px;margin-bottom:4px}
.pat-table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}
.pat-table td{padding:2px 4px}.hl{font-weight:bold;width:130px;white-space:nowrap}.hc{width:10px}
hr.dv{border:none;border-top:1px dashed #000;margin:6px 0}
.section{margin-bottom:8px}.sec-title{font-weight:bold;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:3px;letter-spacing:.5px}
.sec-body{font-size:11px;line-height:1.5;white-space:pre-wrap}
.sig-block{text-align:right;margin-top:20px;font-size:11px}
.sig-line{display:inline-block;border-top:1px solid #000;width:160px;text-align:center;padding-top:2px;margin-top:30px}
.foot{font-size:8px;font-style:italic;margin-top:12px;border-top:1px dashed #000;padding-top:4px;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hosp-header">
<div class="hosp-logo">SEN<br/><span class="hosp-sub">HOSPITALS</span></div>
<div class="hosp-center">
<div class="hosp-name">${HOSPITAL.fullName.toUpperCase()}</div>
<div class="hosp-tag">${HOSPITAL.tagline}</div>
<div class="hosp-addr">${HOSPITAL.address}</div>
<div class="hosp-addr">Tel: ${HOSPITAL.phones.join(", ")} | Pharmacy: ${HOSPITAL.pharmacy}</div>
<div class="hosp-addr">Email: ${HOSPITAL.email} | ${HOSPITAL.website}</div>
</div>
<div class="hosp-seal">NABH<br/>PRE<br/>ACCREDITED</div>
</div>
<div class="doc-title">DISCHARGE SUMMARY</div>
${f.insuranceName ? `<div class="ins-row">INSURANCE NAME: ${f.insuranceName.toUpperCase()}${f.claimNo ? " &nbsp;&nbsp; CLAIM NO: " + f.claimNo : ""}</div>` : ""}
<table class="pat-table">
<tr><td colspan="3"><b>Patient Name</b>: ${f.patientName || "—"} &nbsp;&nbsp;&nbsp; <b>Age / Sex</b>: ${f.ageSex || "—"}</td></tr>
${hrow("IP No", f.ipNo || "")}${hrow("UHID", f.uhid || "")}${hrow("Room No", f.roomNo || "")}${hrow("Consultant", f.consultantName || "")}
${hrow("Date of Admission", fmt2(f.dateOfAdmission) + (f.timeOfAdmission ? " &nbsp;Time: " + f.timeOfAdmission : ""))}
${hrow("Date of Discharge", fmt2(f.dateOfDischarge) + (f.timeOfDischarge ? " &nbsp;Time: " + f.timeOfDischarge : ""))}
</table><hr class="dv"/>
${sec("FINAL DIAGNOSIS", f.finalDiagnosis || "")}
${sec("2. CHIEF COMPLAINTS", f.chiefComplaints || "")}
${sec("HISTORY OF PRESENT ILLNESS", f.historyOfPresentIllness || "")}
${sec("PAST HISTORY", f.pastHistory || "")}
${sec("CLINICAL EXAMINATION", f.clinicalExamination || "")}
${sec("INVESTIGATIONS", f.investigations || "")}
${f.pulmonaryFunctionTest ? sec("PULMONARY FUNCTION TEST", f.pulmonaryFunctionTest) : ""}
${sec("HOSPITAL COURSE", f.hospitalCourse || "")}
${sec("MEDICATIONS / TREATMENT GIVEN IN HOSPITAL", f.treatmentInHospital || "")}
${sec("CONDITION AT DISCHARGE", f.conditionAtDischarge || "")}
${sec("DISCHARGE MEDICATION", f.dischargeMedication || "")}
${sec("DISCHARGE ADVICE", f.dischargeAdvice || "")}
${sec("FOLLOW-UP", f.followUp || "")}
<div class="sig-block"><div class="sig-line">Consultant: ${f.consultantName || "_______________"}<br/>${f.consultantDesignation || ""}</div></div>
<div class="foot">* Contents of this report require clinical co-relation before any clinical action. | ${HOSPITAL.fullName} | ${HOSPITAL.address}</div>
</body></html>`;
    printHtml(html);
  }

  // ── Print a single completed lab result ────────────────────────────────────
  // Uses buildLabReportHtml so the case-sheet print matches the Lab Investigations
  // page print exactly — same ZN-style layout with SEN Hospital branding.
  function printLabResult(l: LabInvestigationResponse) {
    function fmtDT(date: string | null | undefined, time: string | null | undefined): string | null {
      if (!date) return null;
      const [y, m, dd] = date.split("-");
      const datePart = (dd && m && y) ? `${dd}-${m}-${y}` : date;
      if (!time) return datePart;
      const [hh, mm] = time.split(":").map(Number);
      if (Number.isNaN(hh)) return datePart;
      const ampm = hh >= 12 ? "PM" : "AM";
      return `${datePart} ${hh % 12 || 12}:${String(mm).padStart(2, "0")}${ampm}`;
    }

    const test: LabReportTest = {
      labId:             l.labId,
      investigationName: l.investigationName,
      category:          l.category,
      testName:          null,
      subGroup:          null,
      result:            l.result ?? null,
      unit:              l.unit   ?? null,
      normalRange:       l.normalRange ?? null,
      abnormal:          l.isAbnormal,
    };

    const data: LabReportData = {
      uhid:            l.uhid,
      patientName:     l.patientName,
      age:             null,
      gender:          null,
      doctorName:      l.doctorName ?? null,
      labTestId:       l.labId,
      ipNumber:        "—",
      sampleCollected: fmtDT(l.orderedDate, l.orderedTime),
      reportCompleted: fmtDT(l.completedDate, l.completedTime),
      tests:           [test],
      labTechnician:   l.completedBy ?? null,
    };

    printHtml(buildLabReportHtml(data));
  }

  // ── Save observation ───────────────────────────────────────────────────────
  async function handleSaveObs() {
    if (!patient || !obsForm.chiefComplaint.trim() || !obsForm.diagnosis.trim()) return;
    setObsSaving(true);
    const now = new Date();
    const body = {
      patientId:       patient.id,
      uhid:            patient.uhid,
      admissionId:     admission?.id ?? undefined,
      date:            now.toISOString().slice(0, 10),
      time:            now.toTimeString().slice(0, 5),
      doctorName:      userName,
      type:            OBS_TYPE_ENUM[obsForm.type] ?? "ROUND",
      chiefComplaint:  obsForm.chiefComplaint,
      clinicalFindings:obsForm.clinicalFindings || undefined,
      diagnosis:       obsForm.diagnosis,
      plan:            obsForm.plan || undefined,
      notes:           obsForm.notes || undefined,
    };
    const { ok, error } = await apiFetch("/api/case-sheet/observations", {
      method: "POST", body: JSON.stringify(body),
    });
    setObsSaving(false);
    if (!ok) { alert(error); return; }
    setObsForm({ type: "Round", chiefComplaint: "", clinicalFindings: "", diagnosis: "", plan: "", notes: "" });
    setObsModalOpen(false);
    loadCaseSheet();
  }

  // ── Prescribe medication ───────────────────────────────────────────────────
  async function handleSaveMed() {
    if (!patient || !medForm.drugName.trim() || !medForm.dosage.trim()) return;
    setMedSaving(true);
    const now = new Date();
    const body = {
      patientId:   patient.id,
      uhid:        patient.uhid,
      admissionId: admission?.id ?? undefined,
      date:        now.toISOString().slice(0, 10),
      time:        now.toTimeString().slice(0, 5),
      prescribedBy:userName,
      drugName:    medForm.drugName,
      dosage:      medForm.dosage,
      frequency:   medForm.frequency,
      route:       MED_ROUTE_ENUM[medForm.route] ?? "ORAL",
      duration:    medForm.duration || undefined,
      instructions:medForm.instructions || undefined,
    };
    const { ok, error } = await apiFetch("/api/case-sheet/medications", {
      method: "POST", body: JSON.stringify(body),
    });
    setMedSaving(false);
    if (!ok) { alert(error); return; }
    setMedForm({ drugName: "", dosage: "", frequency: "", route: "Oral", duration: "", instructions: "" });
    setMedModalOpen(false);
    loadCaseSheet();
  }

  // ── Record vitals ──────────────────────────────────────────────────────────
  async function handleSaveVitals() {
    if (!patient) return;
    setVitalsSaving(true);
    const body = {
      patientId:       patient.id,
      uhid:            patient.uhid,
      admissionId:     admission?.id ?? undefined,
      recordedAt:      new Date().toISOString(),
      recordedBy:      userName,
      bloodPressure:   vitalsForm.bloodPressure  || undefined,
      pulse:           vitalsForm.pulse           ? Number(vitalsForm.pulse)           : undefined,
      temperature:     vitalsForm.temperature     ? Number(vitalsForm.temperature)     : undefined,
      spo2:            vitalsForm.spo2             ? Number(vitalsForm.spo2)             : undefined,
      respiratoryRate: vitalsForm.respiratoryRate  ? Number(vitalsForm.respiratoryRate) : undefined,
      weight:          vitalsForm.weight           ? Number(vitalsForm.weight)           : undefined,
      height:          vitalsForm.height           ? Number(vitalsForm.height)           : undefined,
      bloodGlucose:    vitalsForm.bloodGlucose     ? Number(vitalsForm.bloodGlucose)     : undefined,
      notes:           vitalsForm.notes || undefined,
    };
    const { ok, error } = await apiFetch("/api/case-sheet/vitals", {
      method: "POST", body: JSON.stringify(body),
    });
    setVitalsSaving(false);
    if (!ok) { alert(error); return; }
    setVitalsForm({ bloodPressure: "", pulse: "", temperature: "", spo2: "", respiratoryRate: "", weight: "", height: "", bloodGlucose: "", notes: "" });
    setVitalsModalOpen(false);
    loadCaseSheet();
  }

  // ── Order lab tests ────────────────────────────────────────────────────────
  async function handleOrderLabs() {
    if (!patient || orderTests.length === 0) return;
    setOrderSaving(true);
    const now = new Date();
    const body = {
      patientId:   patient.id,
      uhid:        patient.uhid,
      patientName: patient.name,
      patientType: patient.patientType,
      admissionId: admission?.id ?? undefined,
      doctorName:  userName,
      orderedDate: now.toISOString().slice(0, 10),
      orderedTime: now.toTimeString().slice(0, 5),
      orderedBy:   userName,
      tests: orderTests.map(t => ({
        testCode:          t.testCode,
        investigationName: t.name,
        category:          t.category,
        sampleType:        t.sampleType || undefined,
        normalRange:       t.normalRange || undefined,
        unit:              t.unit || undefined,
        turnaroundTime:    t.turnaroundTime || undefined,
        price:             t.price,
        priority:          (t.priority === "STAT" ? "STAT" : t.priority === "Urgent" ? "URGENT" : "ROUTINE"),
      })),
    };
    const { ok, error } = await apiFetch("/api/lab/investigations", {
      method: "POST", body: JSON.stringify(body),
    });
    setOrderSaving(false);
    if (!ok) { alert(error); return; }
    setOrderTests([]); setLabModalOpen(false);
    loadCaseSheet();
  }

  // ── Case document upload ───────────────────────────────────────────────────
  function openDocUpload() {
    setDocTitle(""); setDocDescription(""); setDocFile(null); setDocErr("");
    setDocUploadOpen(true);
    setTimeout(() => { if (docFileRef.current) docFileRef.current.value = ""; }, 0);
  }

  async function handleDocUpload() {
    if (!docFile)          { setDocErr("Please select a file"); return; }
    if (!docTitle.trim())  { setDocErr("Title is required"); return; }
    if (!admission?.id)    { setDocErr("No admission linked"); return; }
    setDocUploading(true); setDocErr("");
    try {
      const fd = new FormData();
      fd.append("file",        docFile);
      fd.append("admissionId", String(admission.id));
      fd.append("title",       docTitle.trim());
      fd.append("description", docDescription.trim());
      fd.append("uploadedBy",  userName);
      const res  = await fetch("/api/case-sheet/documents/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) { setDocErr(json.error ?? "Upload failed"); return; }
      setDocUploadOpen(false);
      loadCaseSheet();
    } catch (e: unknown) {
      setDocErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setDocUploading(false);
    }
  }

  async function handleDocDelete(id: number) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const { ok, error } = await apiFetch(`/api/case-sheet/documents/${id}`, { method: "DELETE" });
    if (!ok) { alert(error); return; }
    loadCaseSheet();
  }

  function docFileUrl(filePath: string): string {
    const filename = filePath.split("/").pop() ?? filePath;
    return `/api/case-sheet/documents/files/${filename}`;
  }

  // ── Stop medication ────────────────────────────────────────────────────────
  async function handleStopMed() {
    if (!stopMedId) return;
    setStopSaving(true);
    const body = { reason: stopReason || "Stopped by clinician", stoppedBy: userName };
    const { ok, error } = await apiFetch(`/api/case-sheet/medications/${stopMedId}/stop`, {
      method: "PATCH", body: JSON.stringify(body),
    });
    setStopSaving(false);
    if (!ok) { alert(error); return; }
    setStopMedId(null); setStopReason("");
    loadCaseSheet();
  }

  // ── Render guards ──────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-32" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-28">
          <div className="flex gap-4"><div className="w-12 h-12 bg-slate-200 rounded-xl flex-shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 bg-slate-200 rounded w-1/3" /><div className="h-3 bg-slate-200 rounded w-1/2" /></div></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 h-12" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-64">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 mb-4"><div className="h-3 bg-slate-200 rounded w-24" /><div className="h-3 bg-slate-200 rounded w-40" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-600 font-medium">{pageError}</p>
        <button onClick={loadPatientAndAdmission} className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">Retry</button>
        <Link href="/patients" className="text-xs text-sky-600 underline">Back to patients</Link>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm gap-2">
        Patient not found.
        <Link href="/patients" className="text-sky-600 underline">Back to patients</Link>
      </div>
    );
  }

  const losdays = admission ? (admission.daysAdmitted ?? daysSince(admission.admissionDate)) : 0;
  const totalBill = bills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
  const totalDue  = bills.reduce((s, b) => s + (b.dueAmount ?? 0), 0);
  // Paid derived from actual payment records (sum across all bills) so partial
  // collections show the true amount taken, not a single aggregate figure.
  const totalPaid = bills.reduce((s, b) => s + (b.payments ?? []).reduce((ps, p) => ps + (p.amount ?? 0), 0), 0);
  // First non-cancelled bill that still has a balance — target for "Make Payment".
  const outstandingBill = bills.find(b => b.status !== "CANCELLED" && (b.dueAmount ?? 0) > 0);
  const cond = admission?.conditionOnAdmission ?? "";

  return (
    <div className="space-y-4">
      {/* ── Back ── */}
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#00059f] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Patients
      </Link>

      {/* ── Patient banner ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0
              ${patient.gender === "FEMALE" ? "bg-pink-500" : "bg-[#00059f]"}`}>
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{patient.name}</h1>
                {cond && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionClass(cond)}`}>
                    {conditionLabel(cond)}
                  </span>
                )}
                {admission && <Badge label={admission.status} dot />}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                <span className="font-mono font-semibold text-[#00059f]">{patient.uhid}</span>
                <span>{patient.age}y / {patient.gender?.charAt(0)}</span>
                <span>{patient.bloodGroup}</span>
                <span>{patient.phone}</span>
                {admission?.admissionNo && <span className="text-indigo-600 font-semibold">{admission.admissionNo}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            {admission && (
              <>
                <div className="text-center">
                  <p className="text-slate-400">Ward / Bed</p>
                  <p className="font-semibold text-indigo-700">{admission.bedNumber}</p>
                  <p className="text-slate-400">{admission.wardName}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400">Admitted</p>
                  <p className="font-semibold text-slate-700">{fmt(admission.admissionDate)}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400">LOS</p>
                  <p className="font-semibold text-slate-700">{losdays} day{losdays !== 1 ? "s" : ""}</p>
                </div>
              </>
            )}
            <div className="text-center">
              <p className="text-slate-400">Doctor</p>
              <p className="font-semibold text-slate-700 max-w-[120px] truncate">
                {admission?.admittingDoctorName ?? patient.doctorName}
              </p>
            </div>
            {totalDue > 0 && (
              <div className="text-center">
                <p className="text-slate-400">Due</p>
                <p className="font-semibold text-red-600">₹{totalDue.toLocaleString("en-IN")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Admission selector dropdown (only when patient has multiple admissions) ── */}
      {allAdmissions.length > 1 && (
        <div className="relative">
          {/* Trigger button */}
          <button
            onClick={() => setAdmDropOpen(o => !o)}
            className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors w-full sm:w-auto shadow-sm"
          >
            {/* status dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
            <span className="font-semibold text-slate-800">{admission?.admissionNo ?? "—"}</span>
            <span className="text-slate-400 text-xs">{fmt(admission?.admissionDate)}</span>
            <span className={`ml-1 text-xs font-medium px-1.5 py-0.5 rounded
              ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {isActive ? "Active" : "Discharged"}
            </span>
            <span className="ml-auto text-xs text-slate-400">{allAdmissions.length} admissions</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${admDropOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {/* Dropdown panel */}
          {admDropOpen && (
            <>
              {/* Click-away overlay */}
              <div className="fixed inset-0 z-10" onClick={() => setAdmDropOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[260px] overflow-hidden">
                {[...allAdmissions]
                  .sort((a, b) => new Date(b.admissionDate ?? 0).getTime() - new Date(a.admissionDate ?? 0).getTime())
                  .map((a, i) => {
                    const isSelected   = admission?.id === a.id;
                    const isDischarged = a.status === "DISCHARGED";
                    return (
                      <button
                        key={a.id}
                        onClick={() => { switchAdmission(a); setAdmDropOpen(false); }}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                          ${i > 0 ? "border-t border-slate-100" : ""}
                          ${isSelected ? "bg-slate-50" : "hover:bg-slate-50"}`}
                      >
                        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0
                          ${isDischarged ? "bg-slate-300" : "bg-emerald-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{a.admissionNo}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{fmt(a.admissionDate)}</p>
                          <span className={`inline-block mt-1 text-[11px] font-medium px-1.5 py-0.5 rounded
                            ${isDischarged ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                            {isDischarged ? "Discharged" : "Active"}
                          </span>
                        </div>
                        {isSelected && (
                          <svg className="w-4 h-4 text-[#00059f] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Read-only banner for past admissions ── */}
      {!isActive && admission && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <svg className="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span>
            <span className="font-semibold">Read-only</span> — Viewing past admission{" "}
            <span className="font-mono font-semibold">{admission.admissionNo}</span>
            {admission.dischargeDate && (
              <>, discharged {fmt(admission.dischargeDate)}</>
            )}.
            {allAdmissions.some(a => a.status !== "DISCHARGED") && (
              <button
                onClick={() => {
                  const active = allAdmissions.find(a => a.status !== "DISCHARGED");
                  if (active) switchAdmission(active);
                }}
                className="ml-2 underline underline-offset-2 font-semibold hover:text-amber-900">
                Switch to active admission →
              </button>
            )}
          </span>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 flex-shrink-0
                ${tab === t.id ? "border-[#00059f] text-[#00059f] bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ══ OVERVIEW ══ */}
          {tab === "overview" && (
            <div className="space-y-6">

              {/* ── Admission Details ── */}
              <Section title="Admission Details">
                <InfoGrid>
                  <InfoItem label="Admission No"       value={admission?.admissionNo} />
                  <InfoItem label="Admission Type"     value={admission?.admissionType} />
                  <InfoItem label="Admitted Date"      value={fmt(admission?.admissionDate)} />
                  <InfoItem label="Admitted Time"      value={admission?.admissionTime} />
                  <InfoItem label="Ward"               value={admission?.wardName} />
                  <InfoItem label="Bed Number"         value={admission?.bedNumber} />
                  <InfoItem label="Treating Doctor"    value={admission?.admittingDoctorName ?? patient.doctorName} />
                  <InfoItem label="Department"         value={admission?.department ?? patient.department} />
                  <InfoItem label="Referred By"        value={admission?.referredBy ?? patient.referredBy} />
                  <InfoItem label="Condition on Admit" value={conditionLabel(admission?.conditionOnAdmission)} />
                  <InfoItem label="Admitted By"        value={admission?.createdBy} />
                  <InfoItem label="MLC"                value={admission?.mlc ? (admission.mlcNumber ? `Yes — ${admission.mlcNumber}` : "Yes") : "No"} highlight={admission?.mlc} />
                </InfoGrid>
              </Section>

              {/* ── Clinical / Diagnosis ── */}
              <Section title="Clinical Details">
                <InfoGrid>
                  <InfoItem label="Chief Complaint / Illness" value={patient.illness}                       span2 />
                  <InfoItem label="Provisional Diagnosis"     value={admission?.provisionalDiagnosis}       span2 />
                  {admission?.finalDiagnosis && (
                    <InfoItem label="Final Diagnosis"         value={admission.finalDiagnosis}              span2 />
                  )}
                  {admission?.conditionOnDischarge && (
                    <InfoItem label="Condition on Discharge"  value={admission.conditionOnDischarge}        span2 />
                  )}
                </InfoGrid>
              </Section>

              {/* ── Plan of Care — always show ── */}
              <Section title="Plan of Care">
                <InfoGrid>
                  <InfoItem label="Plan of Care"     value={admission?.planOfCare}      span2 />
                  <InfoItem label="Expected Cost"    value={admission?.expectedCost ? `₹${admission.expectedCost}` : undefined} />
                  <InfoItem label="Expected Outcome" value={admission?.expectedOutcome} />
                  <InfoItem label="Admission Notes"  value={admission?.notes}           span2 />
                </InfoGrid>
              </Section>

              {/* ── Patient Information ── */}
              <Section title="Patient Information">
                <InfoGrid>
                  <InfoItem label="Date of Birth"  value={fmt(patient.dateOfBirth)} />
                  <InfoItem label="Age"            value={patient.age ? `${patient.age} years` : undefined} />
                  <InfoItem label="Gender"         value={patient.gender} />
                  <InfoItem label="Blood Group"    value={patient.bloodGroup} />
                  <InfoItem label="Marital Status" value={patient.maritalStatus} />
                  <InfoItem label="Religion"       value={patient.religion} />
                  <InfoItem label="Nationality"    value={patient.nationality} />
                  <InfoItem label="Phone"          value={patient.phone} />
                  <InfoItem label="Alt. Phone"     value={patient.alternatePhone} />
                  <InfoItem label="Email"          value={patient.email} span2 />
                  <InfoItem label="Address"        value={patient.address} span2 />
                  <InfoItem label="Area"           value={patient.area} />
                  <InfoItem label="District"       value={patient.district} />
                  {patient.state   && <InfoItem label="State"    value={patient.state} />}
                  {patient.pinCode && <InfoItem label="Pin Code" value={patient.pinCode} />}
                  {patient.idProofType && (
                    <InfoItem label="ID Proof" value={`${patient.idProofType}${patient.idProofNo ? " — " + patient.idProofNo : ""}`} />
                  )}
                </InfoGrid>
              </Section>

              {/* ── Payment / Insurance — always shown ── */}
              <Section title="Payment & Insurance">
                <InfoGrid>
                  <InfoItem label="Payment Mode"      value={admission?.paymentMode ?? "CASH"} />
                  <InfoItem label="Insurance Company" value={admission?.insuranceCompany ?? patient.insuranceCompany} />
                  <InfoItem label="Policy No"         value={admission?.policyNo ?? patient.policyNo} />
                  <InfoItem label="TPA Name"          value={admission?.tpaName ?? patient.tpaName} />
                  <InfoItem label="Pre-Auth No"       value={admission?.preAuthNumber} />
                </InfoGrid>
              </Section>

              {/* ── Attendant / Emergency Contact — always shown ── */}
              <Section title="Attendant / Emergency Contact">
                <InfoGrid>
                  <InfoItem label="Name"     value={admission?.attendantName ?? patient.attendantName} />
                  <InfoItem label="Phone"    value={admission?.attendantPhone ?? patient.attendantPhone} />
                  <InfoItem label="Relation" value={admission?.attendantRelation ?? patient.attendantRelation} />
                </InfoGrid>
              </Section>

              {/* ── Discharge summary (if discharged) ── */}
              {admission?.status === "DISCHARGED" && (
                <Section title="Discharge Details">
                  <InfoGrid>
                    <InfoItem label="Discharge No"    value={admission.dischargeNo} />
                    <InfoItem label="Discharge Type"  value={admission.dischargeType} />
                    <InfoItem label="Discharge Date"  value={fmt(admission.dischargeDate)} />
                    <InfoItem label="Discharge Time"  value={admission.dischargeTime} />
                    <InfoItem label="Discharging Dr"  value={admission.dischargingDoctorName} />
                    <InfoItem label="Total Days"      value={admission.totalDaysStayed ? `${admission.totalDaysStayed} day${admission.totalDaysStayed !== 1 ? "s" : ""}` : undefined} />
                    {admission.followUpDate && <InfoItem label="Follow-up Date" value={fmt(admission.followUpDate)} />}
                    {admission.referredTo   && <InfoItem label="Referred To"    value={admission.referredTo} />}
                    {admission.dischargeNotes && <InfoItem label="Discharge Notes" value={admission.dischargeNotes} span2 />}
                  </InfoGrid>
                </Section>
              )}

            </div>
          )}

          {/* ══ OBSERVATIONS ══ */}
          {tab === "observations" && (
            <div className="space-y-4">
              {isActive && (role === "Admin" || role === "Managing Director" || role === "Doctor") && (
                <div className="flex justify-end">
                  <button onClick={() => setObsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Observation
                  </button>
                </div>
              )}
              {observations.length === 0
                ? <EmptyState icon="🩺" text="No observations recorded yet" />
                : (
                  <div className="space-y-4">
                    {observations.map((obs) => (
                      <div key={obs.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${OBS_TYPE_COLOR[obs.type] ?? "bg-slate-100 text-slate-700"}`}>
                              {OBS_TYPE_DISPLAY[obs.type] ?? obs.type}
                            </span>
                            <span className="text-xs text-slate-500">{obs.date} at {obs.time}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{obs.doctorName}</span>
                        </div>
                        <ObsRow label="Chief Complaint"   value={obs.chiefComplaint} />
                        <ObsRow label="Clinical Findings" value={obs.clinicalFindings} />
                        <ObsRow label="Diagnosis"         value={obs.diagnosis} highlight />
                        <ObsRow label="Plan"              value={obs.plan} />
                        {obs.notes && <ObsRow label="Notes" value={obs.notes} />}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ══ LAB ORDERS ══ */}
          {tab === "labs" && (
            <div className="space-y-4">
              {isActive && (role === "Admin" || role === "Managing Director" || role === "Doctor" || role === "Receptionist" || role === "Lab/Ins/Reception") && (
                <div className="flex justify-end gap-2">
                  <button onClick={openDocUpload}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[#00059f] text-[#00059f] hover:bg-blue-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Upload Document
                  </button>
                  <button onClick={() => setLabModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Order Tests
                  </button>
                </div>
              )}
              {labs.length === 0
                ? <EmptyState icon="🔬" text="No lab tests ordered yet" />
                : (
                  <div className="space-y-3">
                    {groupLabs(labs).map(grp => {
                      const total = grp.tests.reduce((s, t) => s + (t.price ?? 0), 0);
                      const isGroup = grp.tests.length > 1;
                      return (
                        <div key={grp.key} className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* group header */}
                          <div className="flex items-center justify-between gap-3 bg-slate-50 border-b border-slate-100 px-3 py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isGroup
                                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{grp.tests.length} tests</span>
                                : <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Single test</span>}
                              <Badge label={LAB_STATUS_DISPLAY[grp.groupStatus] ?? grp.groupStatus} dot />
                              <span className="text-xs text-slate-400">{grp.orderedDate} {grp.orderedTime}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-700">₹{total.toLocaleString("en-IN")}</span>
                          </div>
                          {/* tests in group */}
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-50">
                              {grp.tests.map(l => (
                                <tr key={l.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2.5 font-mono text-xs text-[#00059f] font-semibold whitespace-nowrap">{l.labId}</td>
                                  <td className="px-3 py-2.5"><p className="text-xs font-semibold text-slate-800">{l.investigationName}</p><p className="text-xs text-slate-400">{l.category}{l.sampleType ? ` · ${l.sampleType}` : ""}</p></td>
                                  <td className="px-3 py-2.5"><Badge label={l.priority} /></td>
                                  <td className="px-3 py-2.5 font-semibold text-slate-800 text-xs whitespace-nowrap">₹{(l.price ?? 0).toLocaleString("en-IN")}</td>
                                  <td className="px-3 py-2.5"><Badge label={LAB_STATUS_DISPLAY[l.status] ?? l.status} dot /></td>
                                  <td className="px-3 py-2.5">
                                    {l.result
                                      ? <span className={`text-xs font-semibold ${l.isAbnormal ? "text-red-600" : "text-emerald-600"}`}>{l.result}{l.isAbnormal && " ⚠"}</span>
                                      : <span className="text-xs text-slate-400">—</span>
                                    }
                                    {l.normalRange && <p className="text-xs text-slate-400">Ref: {l.normalRange}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    {l.status === "COMPLETED" && l.resultType === "PDF" && l.reportPdfPath && (
                                      <a
                                        href={`/api/lab/investigations/files/${l.reportPdfPath.split("/").pop()}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors">
                                        📄 View PDF
                                      </a>
                                    )}
                                    {l.status === "COMPLETED" && l.resultType !== "PDF" && (
                                      <button
                                        onClick={() => printLabResult(l)}
                                        title="Print lab result"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-[#00059f] hover:bg-blue-50 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Print
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    <div className="text-xs text-slate-400 text-right">
                      Total: ₹{labs.reduce((s, l) => s + (l.price ?? 0), 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                )
              }

              {/* ── Case Documents panel ── */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">📁 Documents</span>
                  <span className="text-xs text-slate-400 font-normal">
                    X-rays, external reports, consent forms, scans…
                  </span>
                </div>

                {caseDocs.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl py-6 text-center text-slate-400 text-xs">
                    No documents uploaded yet
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {caseDocs.map(doc => {
                      const isPdf = (doc.fileType ?? "").includes("pdf");
                      const sizeKb = doc.fileSize ? Math.round(doc.fileSize / 1024) : null;
                      return (
                        <div key={doc.id}
                          className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                          {/* icon */}
                          <span className="text-xl flex-shrink-0">{isPdf ? "📄" : "🖼"}</span>
                          {/* info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-slate-500 truncate">{doc.description}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">
                              {doc.originalName ?? ""}
                              {sizeKb ? ` · ${sizeKb} KB` : ""}
                              {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                              {doc.createdAt ? ` · ${doc.createdAt.slice(0, 10)}` : ""}
                            </p>
                          </div>
                          {/* actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setDocPreview(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                text-xs font-semibold text-slate-600 border border-slate-200
                                hover:bg-slate-50 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                              Preview
                            </button>
                            {(() => {
                              // Build download filename: "Title_YYYY-MM-DD_HH-MM.ext"
                              const ext = doc.originalName?.split(".").pop() ?? "pdf";
                              const dt  = doc.createdAt
                                ? doc.createdAt.slice(0, 16).replace("T", "_").replace(":", "-")
                                : "download";
                              const safeName = doc.title.replace(/[^a-zA-Z0-9\-_() ]/g, "").trim().replace(/\s+/g, "_");
                              const dlName = `${safeName}_${dt}.${ext}`;
                              return (
                                <a
                                  href={docFileUrl(doc.filePath)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={dlName}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                                    text-xs font-semibold text-[#00059f] border border-blue-200
                                    hover:bg-blue-50 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0
                                        0l-4-4m4 4V4"/>
                                  </svg>
                                  Download
                                </a>
                              );
                            })()}
                            {(role === "Admin" || role === "Managing Director" || role === "Doctor") && (
                              <button
                                onClick={() => handleDocDelete(doc.id)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500
                                  hover:bg-red-50 transition-colors" title="Delete document">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2
                                      0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1
                                      0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MEDICATIONS ══ */}
          {tab === "medications" && (
            <div className="space-y-4">
              {isActive && (role === "Admin" || role === "Managing Director" || role === "Doctor") && (
                <div className="flex justify-end">
                  <button onClick={() => setMedModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Prescribe
                  </button>
                </div>
              )}
              {medications.length === 0
                ? <EmptyState icon="💊" text="No medications prescribed yet" />
                : (
                  <div className="space-y-3">
                    {medications.map(m => (
                      <div key={m.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4
                        ${m.status === "STOPPED" ? "opacity-60 border-slate-200" : m.status === "ACTIVE" ? "border-emerald-200" : "border-slate-200"}`}>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-900">{m.drugName}</p>
                            <Badge label={MED_STATUS_DISPLAY[m.status] ?? m.status} />
                            <span className="text-xs text-slate-400">{m.date} {m.time}</span>
                          </div>
                          <p className="text-xs text-slate-600">
                            <span className="font-semibold">{m.dosage}</span> · {m.frequency} · {MED_ROUTE_DISPLAY[m.route] ?? m.route} · {m.duration}
                          </p>
                          {m.instructions && <p className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block">{m.instructions}</p>}
                          {m.stoppedOn && <p className="text-xs text-red-500">Stopped on {m.stoppedOn} — {m.stoppedReason}</p>}
                          <p className="text-xs text-slate-400">By: {m.prescribedBy}</p>
                        </div>
                        {m.status === "ACTIVE" && isActive && (isMD || role === "Admin" || role === "Doctor") && (
                          <button onClick={() => { setStopMedId(m.id); setStopReason(""); }}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors flex-shrink-0">
                            Stop
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ══ VITALS ══ */}
          {tab === "vitals" && (
            <div className="space-y-4">
              {isActive && (isMD || role === "Admin" || role === "Doctor" || role === "Nurse") && (
                <div className="flex justify-end">
                  <button onClick={() => setVitalsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Record Vitals
                  </button>
                </div>
              )}
              {vitals.length === 0
                ? <EmptyState icon="📊" text="No vitals recorded yet" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["Date / Time","BP (mmHg)","Pulse (bpm)","Temp (°F)","SpO₂ (%)","RR (/min)","Weight (kg)","Glucose","Recorded By"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {vitals.map(v => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDt(v.recordedAt)}</td>
                            <td className={`px-3 py-2.5 text-xs font-semibold ${v.bloodPressure ? "text-slate-700" : "text-slate-300"}`}>{v.bloodPressure ?? "—"}</td>
                            <td className={`px-3 py-2.5 text-xs ${vitalClass(vitalStatus("pulse", v.pulse))}`}>{v.pulse ?? "—"}</td>
                            <td className={`px-3 py-2.5 text-xs ${vitalClass(vitalStatus("temperature", v.temperature))}`}>{v.temperature ?? "—"}</td>
                            <td className={`px-3 py-2.5 text-xs ${vitalClass(vitalStatus("spo2", v.spo2))}`}>{v.spo2 ?? "—"}</td>
                            <td className={`px-3 py-2.5 text-xs ${vitalClass(vitalStatus("respiratoryRate", v.respiratoryRate))}`}>{v.respiratoryRate ?? "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">{v.weight ?? "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">{v.bloodGlucose ?? "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{v.recordedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {/* ══ BILLS ══ */}
          {tab === "bills" && (
            <div className="space-y-4">
              {/* Paid total is derived from actual payment records so partial
                  payments (e.g. ₹500 + ₹500) reflect real collections rather
                  than a single aggregate figure. */}
              <div className="flex items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  <BillCard label="Total Bills"   value={bills.length.toString()}                            color="blue" />
                  <BillCard label="Total Amount"  value={`₹${totalBill.toLocaleString("en-IN")}`}           color="indigo" />
                  <BillCard label="Paid"          value={`₹${totalPaid.toLocaleString("en-IN")}`}           color="green" />
                  <BillCard label="Outstanding"   value={`₹${totalDue.toLocaleString("en-IN")}`}            color={totalDue > 0 ? "red" : "green"} />
                </div>
              </div>

              {/* Only show Craft Bill button when no bills exist yet */}
              {canBill && patient && bills.length === 0 && (
                <div className="flex justify-end">
                  <Link
                    href={`/bills?newForPatient=${patient.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Bill
                  </Link>
                </div>
              )}

              {bills.length === 0
                ? <EmptyState icon="💰" text="No bills raised yet" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["","Bill No","Date","Towards","Total","Paid","Due","Status",""].map((h, i) => (
                            <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bills.map(b => {
                          const pays       = b.payments ?? [];
                          const paid       = pays.reduce((s, p) => s + (p.amount ?? 0), 0);
                          const items      = b.items ?? [];
                          const isExpanded = expandedBills.has(b.id);
                          const toggleExpand = () => setExpandedBills(prev => {
                            const next = new Set(prev);
                            next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                            return next;
                          });
                          return (
                            <Fragment key={b.id}>
                              {/* ── Bill summary row ── */}
                              <tr className="hover:bg-slate-50">
                                {/* Expand toggle */}
                                <td className="px-2 py-2.5 w-6">
                                  {items.length > 0 && (
                                    <button onClick={toggleExpand}
                                      className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                                      title={isExpanded ? "Hide items" : "Show items"}>
                                      <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                                      </svg>
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-[#00059f] font-semibold">{b.billNo}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{b.date}</td>
                                <td className="px-3 py-2.5 text-xs">
                                  {b.towards && (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold
                                      ${b.towards === "IPD"        ? "bg-indigo-100 text-indigo-700" :
                                        b.towards === "Lab"         ? "bg-purple-100 text-purple-700" :
                                        b.towards === "Pharmacy"    ? "bg-teal-100 text-teal-700"    :
                                        b.towards === "OPD"         ? "bg-sky-100 text-sky-700"      :
                                                                      "bg-slate-100 text-slate-600"}`}>
                                      {b.towards}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">₹{(b.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                                <td className="px-3 py-2.5 text-xs text-emerald-600 font-semibold">₹{paid.toLocaleString("en-IN")}</td>
                                <td className={`px-3 py-2.5 text-xs font-semibold ${(b.dueAmount ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                  ₹{(b.dueAmount ?? 0).toLocaleString("en-IN")}
                                </td>
                                <td className="px-3 py-2.5"><Badge label={b.status} dot /></td>
                                {/* Per-bill action — open the patient's bills page to collect/edit */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {canBill
                                    && b.status !== "CANCELLED"
                                    && (b.dueAmount ?? 0) > 0 && (
                                    <Link href={`/bills/patient/${b.patientId}`}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold
                                        bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                                      </svg>
                                      Bills
                                    </Link>
                                  )}
                                </td>
                              </tr>

                              {/* ── Expanded: items + payments (only shown when toggled) ── */}
                              {isExpanded && (
                                <>
                                {items.length > 0 && (
                                <tr className="bg-slate-50/60">
                                  <td colSpan={9} className="px-4 py-3">
                                    <div className="pl-3 border-l-2 border-[#00059f]/20 space-y-2">
                                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Particulars</p>
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-slate-400 border-b border-slate-200">
                                            <th className="text-left py-1 pr-3 font-semibold">Description</th>
                                            <th className="text-left py-1 pr-3 font-semibold w-24">Modality</th>
                                            <th className="text-right py-1 pr-3 font-semibold w-10">Qty</th>
                                            <th className="text-right py-1 pr-3 font-semibold w-20">Unit Price</th>
                                            <th className="text-right py-1 font-semibold w-20">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {items.map((it, idx) => (
                                            <tr key={it.id ?? idx} className="text-slate-700">
                                              <td className="py-1.5 pr-3">{it.description}</td>
                                              <td className="py-1.5 pr-3 text-slate-500">{it.modalityName ?? "—"}</td>
                                              <td className="py-1.5 pr-3 text-right">{it.quantity}</td>
                                              <td className="py-1.5 pr-3 text-right">₹{(it.unitPrice ?? 0).toLocaleString("en-IN")}</td>
                                              <td className="py-1.5 text-right font-semibold">₹{(it.total ?? 0).toLocaleString("en-IN")}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="border-t border-slate-200 text-slate-700 font-semibold">
                                            <td colSpan={4} className="pt-1.5 pr-3 text-right">Total</td>
                                            <td className="pt-1.5 text-right">₹{(b.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                                )}
                                {pays.length > 0 && (
                                <tr className="bg-emerald-50/40">
                                  <td colSpan={9} className="px-4 py-2">
                                    <div className="pl-3 border-l-2 border-emerald-300 space-y-1">
                                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Payments</p>
                                      {pays.map(p => (
                                        <div key={p.id} className="flex items-center gap-3 text-xs text-slate-600">
                                          <span className="text-slate-500 w-24">{p.date}</span>
                                          <span className="font-semibold text-emerald-700 w-24">₹{(p.amount ?? 0).toLocaleString("en-IN")}</span>
                                          <span className="w-20">{p.paymentMode}</span>
                                          {p.referenceNo && <span className="text-slate-400">Ref: {p.referenceNo}</span>}
                                          {p.receivedBy && <span className="text-slate-400 ml-auto">by {p.receivedBy}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                                )}
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}
          {/* ══ TIMELINE ══ */}
          {tab === "timeline" && (
            <div className="space-y-4">
              {(() => {
                const transfers = admission
                  ? [...admission.transfers].sort((a, b) => (a.transferDate + (a.transferTime ?? "")).localeCompare(b.transferDate + (b.transferTime ?? "")))
                  : [];
                const hasData = !!admission || opVisits.length > 0;
                if (!hasData) return <EmptyState icon="⏱" text="No timeline events yet" />;
                return (
                  <div className="space-y-4">

                    {/* ── Current admission events (admission-scoped) ── */}
                    {admission && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Admission — {admission.admissionNo}
                        </p>
                        <div className="space-y-2">
                          {/* Admission event */}
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">Admitted</span>
                                <span className="text-xs text-slate-400">{admission.admissionNo}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${admission.status === "ADMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{admission.status}</span>
                              </div>
                              <p className="text-sm text-slate-700 mt-0.5">{(admission.wardName ?? "—") + (admission.bedNumber ? " · Bed " + admission.bedNumber : "")}</p>
                              {admission.admittingDoctorName && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{admission.admittingDoctorName}</span></p>}
                              {admission.provisionalDiagnosis && <p className="text-xs text-slate-400 italic mt-0.5">{admission.provisionalDiagnosis}</p>}
                              <p className="text-xs text-slate-400 mt-0.5">{admission.admissionDate}{admission.admissionTime ? ", " + admission.admissionTime : ""}{admission.daysAdmitted != null ? " (" + admission.daysAdmitted + "d)" : ""}</p>
                            </div>
                          </div>

                          {/* Transfer events */}
                          {transfers.map((h, i) => (
                            <div key={"tr-"+i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800 capitalize">{h.transferType.charAt(0) + h.transferType.slice(1).toLowerCase().replace(/_/g, " ")}</span>
                                  <span className="text-sm"><span className="text-red-500">{h.fromValue}</span>{" → "}<span className="text-emerald-600 font-medium">{h.toValue}</span></span>
                                </div>
                                {h.orderedBy && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{h.orderedBy}</span></p>}
                                {h.reason && <p className="text-xs text-slate-400 italic mt-0.5">{h.reason}</p>}
                                <p className="text-xs text-slate-400 mt-0.5">{h.transferDate}{h.transferTime ? ", " + h.transferTime : ""}</p>
                              </div>
                            </div>
                          ))}

                          {/* Discharge event — only when DISCHARGED */}
                          {admission.status === "DISCHARGED" && admission.dischargeDate && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800">Discharged</span>
                                  {admission.dischargeType && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{admission.dischargeType}</span>}
                                </div>
                                {admission.dischargingDoctorName && <p className="text-xs text-slate-500 mt-0.5">by <span className="font-medium">{admission.dischargingDoctorName}</span></p>}
                                {admission.finalDiagnosis && <p className="text-xs text-slate-400 italic mt-0.5">{admission.finalDiagnosis}</p>}
                                <p className="text-xs text-slate-400 mt-0.5">{admission.dischargeDate}{admission.dischargeTime ? ", " + admission.dischargeTime : ""}{admission.totalDaysStayed != null ? " (" + admission.totalDaysStayed + "d total)" : ""}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── OP visits (patient-level, shown once) ── */}
                    {opVisits.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          OP Visits — patient history
                        </p>
                        <div className="space-y-2">
                          {opVisits
                            .filter(v => v.uhid === patient?.uhid)
                            .sort((a, b) => (b.visitDate + (b.visitTime ?? "")).localeCompare(a.visitDate + (a.visitTime ?? "")))
                            .map((v, i) => (
                              <div key={"op-"+i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
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

          {/* ══ DISCHARGE SUMMARY ══ */}
          {tab === "discharge" && (() => {
            const canEdit = ["Doctor", "Admin", "Managing Director"].includes(role);
            const inp = (key: string, placeholder?: string) =>
              canEdit
                ? <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white placeholder-slate-300" value={dsForm[key] ?? ""} placeholder={placeholder ?? ""} onChange={e => { setDsForm(p => ({ ...p, [key]: e.target.value })); setDsIsDirty(true); }} />
                : <div className="w-full px-3 py-2 rounded-lg border border-slate-100 text-sm text-slate-700 bg-slate-50">{dsForm[key] || "—"}</div>;
            const area = (key: string, rows = 4, placeholder?: string) =>
              canEdit
                ? <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white placeholder-slate-300 resize-y" rows={rows} value={dsForm[key] ?? ""} placeholder={placeholder ?? "Type here..."} onChange={e => { setDsForm(p => ({ ...p, [key]: e.target.value })); setDsIsDirty(true); }} />
                : <div className="w-full px-3 py-2 rounded-lg border border-slate-100 text-sm text-slate-700 bg-slate-50 whitespace-pre-wrap min-h-[60px]">{dsForm[key] || "—"}</div>;
            const lbl = (text: string) => <label className="block text-xs font-semibold text-slate-500 mb-1">{text}</label>;
            return (
              <div className="space-y-4">
                {/* ── Toolbar ── */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-slate-500">
                    {dsIsDirty && <span className="text-amber-600 font-semibold">Unsaved changes</span>}
                    {dsSaveMsg && <span className="text-emerald-600 font-semibold">{dsSaveMsg}</span>}
                    {dsSaveErr && <span className="text-red-600">{dsSaveErr}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePrintDs}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
                      🖨 Print
                    </button>
                    {canEdit && (
                      <button onClick={handleSaveDs} disabled={dsSaving || !dsIsDirty}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00059f] text-white text-xs font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors">
                        {dsSaving ? "Saving…" : "Save"}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Print preview header ── */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <HospitalHeader formTitle="DISCHARGE SUMMARY" />
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-700">
                    {dsForm.insuranceName && <div className="sm:col-span-2 font-bold text-sm mb-1">INSURANCE: {dsForm.insuranceName.toUpperCase()}{dsForm.claimNo ? " | CLAIM NO: " + dsForm.claimNo : ""}</div>}
                    <div><span className="font-bold w-32 inline-block">Patient Name</span>: {dsForm.patientName || "—"}</div>
                    <div><span className="font-bold w-32 inline-block">Age / Sex</span>: {dsForm.ageSex || "—"}</div>
                    <div><span className="font-bold w-32 inline-block">IP No</span>: {dsForm.ipNo || "—"}</div>
                    <div><span className="font-bold w-32 inline-block">UHID</span>: {dsForm.uhid || "—"}</div>
                    <div><span className="font-bold w-32 inline-block">Room No</span>: {dsForm.roomNo || "—"}</div>
                    <div><span className="font-bold w-32 inline-block">Consultant</span>: {dsForm.consultantName || "—"}</div>
                  </div>
                </div>

                {/* ── Editable header fields ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5"><h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Patient & Admission Details</h3></div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>{lbl("Patient Name")}{inp("patientName")}</div>
                    <div>{lbl("Age / Sex")}{inp("ageSex", "e.g. 18 Years / Male")}</div>
                    <div>{lbl("IP No")}{inp("ipNo")}</div>
                    <div>{lbl("UHID")}{inp("uhid")}</div>
                    <div>{lbl("Room No")}{inp("roomNo")}</div>
                    <div>{lbl("Consultant")}{inp("consultantName")}</div>
                    <div>{lbl("Consultant Designation")}{inp("consultantDesignation", "e.g. MBBS, MS, MCh")}</div>
                    <div>{lbl("Insurance Company")}{inp("insuranceName")}</div>
                    <div>{lbl("Claim No")}{inp("claimNo")}</div>
                    <div>{lbl("Date of Admission")}{canEdit ? <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" value={dsForm.dateOfAdmission ?? ""} onChange={e => { setDsForm(p=>({...p, dateOfAdmission: e.target.value})); setDsIsDirty(true); }} /> : <div className="w-full px-3 py-2 rounded-lg border border-slate-100 text-sm bg-slate-50">{dsForm.dateOfAdmission || "—"}</div>}</div>
                    <div>{lbl("Time of Admission")}{inp("timeOfAdmission", "e.g. 10:45 PM")}</div>
                    <div>{lbl("Date of Discharge")}{canEdit ? <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" value={dsForm.dateOfDischarge ?? ""} onChange={e => { setDsForm(p=>({...p, dateOfDischarge: e.target.value})); setDsIsDirty(true); }} /> : <div className="w-full px-3 py-2 rounded-lg border border-slate-100 text-sm bg-slate-50">{dsForm.dateOfDischarge || "—"}</div>}</div>
                    <div>{lbl("Time of Discharge")}{inp("timeOfDischarge", "e.g. 03:45 PM")}</div>
                  </div>
                </div>

                {/* ── Clinical sections ── */}
                {([
                  ["finalDiagnosis",          "Final Diagnosis",                                  3, "e.g. Viral Febrile Illness — Swine Flu"],
                  ["chiefComplaints",          "Chief Complaints",                                 4, "High-grade fever with chills for 3 days\nNausea and body pain for 3 days"],
                  ["historyOfPresentIllness",  "History of Present Illness",                      5, "Describe the history of present illness..."],
                  ["pastHistory",              "Past History",                                    4, "Diabetes – No. Hypertension – No. CAD – No.\nDrug allergy – Nil."],
                  ["clinicalExamination",      "Clinical Examination",                            5, "CVS – No significant abnormality.\nRS – Bilateral air entry present.\nAbdomen – No significant abnormality.\nCNS – No focal neurological deficit."],
                  ["investigations",           "Investigations",                                  4, "List key investigation results..."],
                  ["pulmonaryFunctionTest",    "Pulmonary Function Test (if applicable)",         3, "e.g. Reduced FVC/FEV1 values..."],
                  ["hospitalCourse",           "Hospital Course",                                 5, "Describe the clinical course during hospital stay..."],
                  ["treatmentInHospital",      "Medications / Treatment Given in Hospital",       6, "IVF\nInj Pan 40mg + 100ml NS  IV 1-0-1 × 5 days\nTab Tamiflu 75mg  P/O 1-0-1 × 5 days"],
                  ["conditionAtDischarge",     "Condition at Discharge",                          3, "The patient was clinically improved and haemodynamically stable."],
                  ["dischargeMedication",      "Discharge Medication",                            5, "Cap RARA D (B/F)  PO 1-0-1 × 5 DAYS\nTab BILVAS        PO 1-0-1 × 5 DAYS"],
                  ["dischargeAdvice",          "Discharge Advice",                                7, "Adequate oral fluids and good hydration.\nTake medications strictly as prescribed.\nAdequate rest and nutritious diet."],
                  ["followUp",                 "Follow-Up",                                       3, "Follow-up with treating physician: As advised.\nRepeat CBC/platelet count: As clinically indicated."],
                ] as [string, string, number, string][]).map(([key, title, rows, placeholder]) => (
                  <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
                    </div>
                    <div className="p-4">{area(key, rows, placeholder)}</div>
                  </div>
                ))}

                {/* ── Bottom save bar ── */}
                {canEdit && (
                  <div className="sticky bottom-4 z-10">
                    <div className="bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {dsIsDirty ? <span className="text-amber-600 font-semibold">Unsaved changes</span> : dsSaveMsg ? <span className="text-emerald-600 font-semibold">{dsSaveMsg}</span> : "All changes saved"}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={handlePrintDs} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50">🖨 Print</button>
                        <button onClick={handleSaveDs} disabled={dsSaving || !dsIsDirty} className="px-4 py-1.5 rounded-lg bg-[#00059f] text-white text-xs font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors">{dsSaving ? "Saving…" : "Save Changes"}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Confirm Discharge — at the very bottom after all clinical sections ── */}
                {dischargeErr && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{dischargeErr}</div>
                )}
                {dischargeBillBlock && (
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div className="text-sm text-red-700">
                      <p className="font-semibold">Cannot discharge — outstanding balance</p>
                      <p className="mt-0.5">
                        Bills totalling <span className="font-bold">₹{dischargeBillBlock.dueAmount.toLocaleString("en-IN")}</span> are unsettled.
                        Discharge summary has been saved as draft. Clear all dues before discharging.
                      </p>
                      <a href={`/bills?patientId=${patient?.id}`}
                        className="inline-block mt-1.5 text-xs font-semibold underline underline-offset-2">
                        Go to Bills →
                      </a>
                    </div>
                  </div>
                )}
                {isActive && canEdit && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-amber-800">Confirm Discharge</p>
                      {admission?.free && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          🏷 Free Admission — bill check bypassed
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Discharge Type <span className="text-red-500">*</span></label>
                        <select
                          value={dischargeForm.dischargeType}
                          onChange={e => setDischargeForm(p => ({ ...p, dischargeType: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                          <option value="NORMAL">Normal — Recovered</option>
                          <option value="LAMA">LAMA — Left Against Medical Advice</option>
                          <option value="REFERRED">Referred — Transferred</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      </div>
                      {dischargeForm.dischargeType === "REFERRED" && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Referred To</label>
                          <input
                            value={dischargeForm.referredTo}
                            onChange={e => setDischargeForm(p => ({ ...p, referredTo: e.target.value }))}
                            placeholder="e.g. Apollo Hospital"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleConfirmDischarge}
                      disabled={discharging}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors">
                      {discharging
                        ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Processing…</>
                        : "✓ Save & Confirm Discharge"}
                    </button>
                    <p className="text-xs text-amber-700">This will save the discharge summary and mark the patient as discharged. Bills must be fully settled.</p>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* ═══ Add Observation Modal ═══ */}
      <Modal open={obsModalOpen} onClose={() => setObsModalOpen(false)} title="Add Doctor Observation" size="lg"
        footer={
          <>
            <button onClick={() => setObsModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSaveObs} disabled={obsSaving || !obsForm.chiefComplaint.trim() || !obsForm.diagnosis.trim()}
              className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {obsSaving && <Spinner />} Save Observation
            </button>
          </>
        }>
        <div className="space-y-4">
          <FormField label="Observation Type">
            <Select value={obsForm.type} onChange={e => setObsForm({ ...obsForm, type: e.target.value })}>
              {["Round","Consultation","Post-Op","Emergency","Discharge Note"].map(t => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Chief Complaint" required>
            <Textarea value={obsForm.chiefComplaint} onChange={e => setObsForm({ ...obsForm, chiefComplaint: e.target.value })} placeholder="Patient's complaints / presenting symptoms" rows={2} />
          </FormField>
          <FormField label="Clinical Findings">
            <Textarea value={obsForm.clinicalFindings} onChange={e => setObsForm({ ...obsForm, clinicalFindings: e.target.value })} placeholder="Examination findings, vitals, investigations noted" rows={3} />
          </FormField>
          <FormField label="Diagnosis" required>
            <Textarea value={obsForm.diagnosis} onChange={e => setObsForm({ ...obsForm, diagnosis: e.target.value })} placeholder="Working or confirmed diagnosis" rows={2} />
          </FormField>
          <FormField label="Treatment Plan">
            <Textarea value={obsForm.plan} onChange={e => setObsForm({ ...obsForm, plan: e.target.value })} placeholder="Medications ordered, procedures, follow-up plan" rows={3} />
          </FormField>
          <FormField label="Additional Notes">
            <Textarea value={obsForm.notes} onChange={e => setObsForm({ ...obsForm, notes: e.target.value })} placeholder="Any additional notes (optional)" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ═══ Order Lab Tests Modal ═══ */}
      <Modal open={labModalOpen} onClose={() => { setLabModalOpen(false); setOrderTests([]); }} title="Order Lab Tests" size="md"
        footer={
          <>
            <button onClick={() => { setLabModalOpen(false); setOrderTests([]); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleOrderLabs} disabled={orderSaving || orderTests.length === 0}
              className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {orderSaving && <Spinner />} Order {orderTests.length} Test{orderTests.length !== 1 ? "s" : ""}
            </button>
          </>
        }>
        <div className="space-y-4">
          <FormField label="Add Test">
            <TestSearchSelect
              options={labMasters}
              excludeIds={new Set(orderTests.map(x => x.id))}
              accent="blue"
              onAdd={t => setOrderTests(prev => [...prev, { ...t, priority: "Routine" }])}
            />
          </FormField>
          {orderTests.length > 0 && (
            <div className="space-y-2">
              {orderTests.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.category} · ₹{t.price}</p>
                  </div>
                  <select value={t.priority}
                    onChange={e => setOrderTests(prev => prev.map((x, j) => j === i ? { ...x, priority: e.target.value } : x))}
                    className={`text-xs px-2 py-1 rounded border focus:outline-none font-semibold
                      ${t.priority === "STAT" ? "bg-red-50 text-red-700 border-red-200"
                        : t.priority === "Urgent" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                  <button onClick={() => setOrderTests(prev => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <p className="text-xs text-right text-slate-500 font-semibold">
                Total: ₹{orderTests.reduce((s, t) => s + (t.price ?? 0), 0).toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ Prescribe Medication Modal ═══ */}
      <Modal open={medModalOpen} onClose={() => setMedModalOpen(false)} title="Prescribe Medication" size="md"
        footer={
          <>
            <button onClick={() => setMedModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSaveMed} disabled={medSaving || !medForm.drugName.trim() || !medForm.dosage.trim()}
              className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {medSaving && <Spinner />} Prescribe
            </button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Drug Name" required>
              <Input value={medForm.drugName} onChange={e => setMedForm({ ...medForm, drugName: e.target.value })} placeholder="e.g. Paracetamol" />
            </FormField>
            <FormField label="Dosage" required>
              <Input value={medForm.dosage} onChange={e => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="e.g. 500mg" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Frequency">
              <Input value={medForm.frequency} onChange={e => setMedForm({ ...medForm, frequency: e.target.value })} placeholder="e.g. Twice daily" />
            </FormField>
            <FormField label="Route">
              <Select value={medForm.route} onChange={e => setMedForm({ ...medForm, route: e.target.value })}>
                {["Oral","IV","IM","SC","Topical","Inhaled","Sublingual"].map(r => <option key={r}>{r}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Duration">
            <Input value={medForm.duration} onChange={e => setMedForm({ ...medForm, duration: e.target.value })} placeholder="e.g. 5 days, Lifelong" />
          </FormField>
          <FormField label="Special Instructions">
            <Textarea value={medForm.instructions} onChange={e => setMedForm({ ...medForm, instructions: e.target.value })} placeholder="e.g. After food, with water" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ═══ Record Vitals Modal ═══ */}
      <Modal open={vitalsModalOpen} onClose={() => setVitalsModalOpen(false)} title="Record Vitals" size="md"
        footer={
          <>
            <button onClick={() => setVitalsModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSaveVitals} disabled={vitalsSaving}
              className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 transition-colors flex items-center gap-2">
              {vitalsSaving && <Spinner />} Save Vitals
            </button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Blood Pressure (mmHg)">
              <Input value={vitalsForm.bloodPressure} onChange={e => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })} placeholder="e.g. 120/80" />
            </FormField>
            <FormField label="Pulse (bpm)">
              <Input type="number" value={vitalsForm.pulse} onChange={e => setVitalsForm({ ...vitalsForm, pulse: e.target.value })} placeholder="e.g. 78" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Temperature (°F)">
              <Input type="number" step="0.1" value={vitalsForm.temperature} onChange={e => setVitalsForm({ ...vitalsForm, temperature: e.target.value })} placeholder="e.g. 98.6" />
            </FormField>
            <FormField label="SpO₂ (%)">
              <Input type="number" value={vitalsForm.spo2} onChange={e => setVitalsForm({ ...vitalsForm, spo2: e.target.value })} placeholder="e.g. 98" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Respiratory Rate (/min)">
              <Input type="number" value={vitalsForm.respiratoryRate} onChange={e => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })} placeholder="e.g. 16" />
            </FormField>
            <FormField label="Weight (kg)">
              <Input type="number" step="0.1" value={vitalsForm.weight} onChange={e => setVitalsForm({ ...vitalsForm, weight: e.target.value })} placeholder="Optional" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Height (cm)">
              <Input type="number" step="0.1" value={vitalsForm.height} onChange={e => setVitalsForm({ ...vitalsForm, height: e.target.value })} placeholder="Optional" />
            </FormField>
            <FormField label="Blood Glucose (mg/dL)">
              <Input type="number" step="0.1" value={vitalsForm.bloodGlucose} onChange={e => setVitalsForm({ ...vitalsForm, bloodGlucose: e.target.value })} placeholder="Optional" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea value={vitalsForm.notes} onChange={e => setVitalsForm({ ...vitalsForm, notes: e.target.value })} placeholder="Any observations" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ═══ Stop Medication Confirm ═══ */}
      <Modal open={!!stopMedId} onClose={() => setStopMedId(null)} title="Stop Medication" size="sm"
        footer={
          <>
            <button onClick={() => setStopMedId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleStopMed} disabled={stopSaving}
              className="px-4 py-2 text-sm bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors flex items-center gap-2">
              {stopSaving && <Spinner />} Stop Medication
            </button>
          </>
        }>
        <FormField label="Reason for stopping">
          <Textarea value={stopReason} onChange={e => setStopReason(e.target.value)} placeholder="Reason (optional)" rows={2} />
        </FormField>
      </Modal>

      {/* ═══ Upload Document Modal ═══ */}
      <Modal
        open={docUploadOpen}
        onClose={() => { setDocUploadOpen(false); setDocFile(null); setDocErr(""); }}
        title="Upload Document"
        size="sm"
        footer={
          <>
            <button onClick={() => { setDocUploadOpen(false); setDocFile(null); setDocErr(""); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleDocUpload} disabled={!docFile || docUploading}
              className="px-4 py-2 text-sm bg-[#00059f] text-white font-semibold rounded-lg
                hover:bg-blue-800 disabled:opacity-40 transition-colors flex items-center gap-2">
              {docUploading && <Spinner />}
              Upload
            </button>
          </>
        }>
        <div className="space-y-4">
          {docErr && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {docErr}
            </p>
          )}
          <FormField label="Title" required>
            <Input
              value={docTitle}
              onChange={e => { setDocTitle(e.target.value); setDocErr(""); }}
              placeholder="e.g. Chest X-Ray, CT Abdomen, Outsourced CBC"
              autoFocus
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={docDescription}
              onChange={e => setDocDescription(e.target.value)}
              placeholder="Optional notes, e.g. PA view taken 15 Feb 2026"
              rows={2}
            />
          </FormField>
          <FormField label="File (PDF or Image)" required>
            <div className="space-y-2">
              <input
                ref={docFileRef}
                type="file"
                accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif"
                onChange={e => { setDocFile(e.target.files?.[0] ?? null); setDocErr(""); }}
                className="block w-full text-sm text-slate-700
                  file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                  file:text-xs file:font-semibold file:bg-blue-50 file:text-[#00059f]
                  hover:file:bg-blue-100 border border-slate-200 rounded-lg px-2 py-1.5"
              />
              {docFile && (
                <div className="flex items-center gap-3">
                  {docThumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={docThumbUrl}
                      alt="Selected file preview"
                      className="w-14 h-14 rounded-lg border border-slate-200 object-cover flex-shrink-0"
                    />
                  )}
                  <p className="text-xs text-slate-500 min-w-0 truncate">
                    {docFile.name} · {Math.round(docFile.size / 1024)} KB
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-400">PDF, JPG, PNG, WebP — max 20 MB</p>
            </div>
          </FormField>
        </div>
      </Modal>

      {/* ═══ Document Preview Modal ═══ */}
      <Modal
        open={!!docPreview}
        onClose={() => setDocPreview(null)}
        title={docPreview?.title ?? "Preview"}
        size="xl"
        footer={
          <>
            {docPreview && (
              <a
                href={docFileUrl(docPreview.filePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-[#00059f] border border-blue-200 rounded-lg
                  hover:bg-blue-50 transition-colors">
                Open in new tab
              </a>
            )}
            <button onClick={() => setDocPreview(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Close
            </button>
          </>
        }>
        {docPreview && (
          (docPreview.fileType ?? "").includes("pdf") ? (
            <iframe
              src={docFileUrl(docPreview.filePath)}
              title={docPreview.title}
              className="w-full h-[70vh] rounded-lg border border-slate-200"
            />
          ) : (
            <div className="flex justify-center bg-slate-50 rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={docFileUrl(docPreview.filePath)}
                alt={docPreview.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          )
        )}
      </Modal>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-100" />{title}<span className="h-px flex-1 bg-slate-100" />
      </h3>
      {children}
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">{children}</div>;
}

function InfoItem({ label, value, span2, highlight }: {
  label: string; value?: string | null; span2?: boolean; highlight?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value || "—"}</p>
    </div>
  );
}

function ObsRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-xs ${highlight ? "font-semibold text-[#00059f]" : "text-slate-700"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function BillCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-3 ${colors[color] ?? "bg-slate-50 text-slate-700"}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
