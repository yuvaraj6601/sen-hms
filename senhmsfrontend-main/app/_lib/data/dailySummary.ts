import type { DailySummary, DailySummaryInsuranceClaim } from "../types";

// ─── Seed Data ────────────────────────────────────────────────────────────────

const DAILY_SUMMARIES: DailySummary[] = [
  {
    id: "ds1",
    summaryNo: "DS-20260731-001",
    date: "2026-07-31",
    collectionEntries: [
      { id: "ce1", sNo: 1, patientName: "Mr. James",     age: 66, sex: "M", visitType: "ICU", consultantName: "Dr. Arun",    diagnosis: "Admission", paymentMode: "Cash",   amount: 3500  },
      { id: "ce2", sNo: 2, patientName: "Mr. James",     age: 66, sex: "M", visitType: "ICU", consultantName: "Dr. Arun",    diagnosis: "Advance",   paymentMode: "Card",   amount: 40000 },
      { id: "ce3", sNo: 3, patientName: "Mr. Ganeshan",  age: 10, sex: "M", visitType: "OP",  consultantName: "Dr. Sathish", diagnosis: "Cough",     paymentMode: "Cash",   amount: 250   },
      { id: "ce4", sNo: 4, patientName: "Mrs. Gowsalya", age: 28, sex: "F", visitType: "OP",  consultantName: "Dr. Sathish", diagnosis: "Cough",     paymentMode: "Cash",   amount: 250   },
      { id: "ce5", sNo: 5, patientName: "Mrs. Gowsalya", age: 28, sex: "F", visitType: "OP",  consultantName: "Dr. Sathish", diagnosis: "CANCER",    paymentMode: "UPI",    amount: 1050  },
      { id: "ce6", sNo: 6, patientName: "Mr. Prasanna",  age: 27, sex: "M", visitType: "OP",  consultantName: "Dr. Sathish", diagnosis: "Cough",     paymentMode: "Cash",   amount: 250   },
      { id: "ce7", sNo: 7, patientName: "Mrs. Saranya",  age: 56, sex: "F", visitType: "OP",  consultantName: "Dr. Arun",    diagnosis: "Cough",     paymentMode: "Cheque", amount: 350   },
    ],
    totalCollection: 45650,
    cashTotal: 4250,
    upiTotal: 1050,
    cardTotal: 40000,
    chequeTotal: 350,
    notes: "",
    createdBy: "Dr. Admin",
    status: "Submitted",
  },
  {
    id: "ds2",
    summaryNo: "DS-20260819-001",
    date: "2026-08-19",
    collectionEntries: [
      { id: "ce10", sNo: 1, patientName: "Mrs. Kavitha", age: 42, sex: "F", visitType: "OP", consultantName: "Dr. Venkatesan", diagnosis: "Fever",    paymentMode: "Cash", amount: 500  },
      { id: "ce11", sNo: 2, patientName: "Mr. Ramesh",   age: 55, sex: "M", visitType: "IP", consultantName: "Dr. Murugan",    diagnosis: "Fracture", paymentMode: "Card", amount: 5000 },
      { id: "ce12", sNo: 3, patientName: "Mrs. Lakshmi", age: 48, sex: "F", visitType: "OP", consultantName: "Dr. Sathish",    diagnosis: "Diabetes", paymentMode: "UPI",  amount: 300  },
    ],
    totalCollection: 5800,
    cashTotal: 500,
    upiTotal: 300,
    cardTotal: 5000,
    chequeTotal: 0,
    notes: "Public holiday — reduced footfall",
    createdBy: "Dr. Admin",
    status: "Draft",
  },
];

const INSURANCE_CLAIMS_RECEIVED: DailySummaryInsuranceClaim[] = [
  { id: "irc1", claimNo: "IRC-2026-001", dod: "2026-03-18", patientName: "Mr. Sawbari Shadik", chequeDate: "2026-04-21", chequeNo: "PO 6431",  amountClaimed: 68932, amountDeducted: 0,    tpaName: "Medi Assist",  itDeduction: 6893,  amountSettled: 62039, financialYear: "2026-2027", notes: "" },
  { id: "irc2", claimNo: "IRC-2026-002", dod: "2026-03-22", patientName: "Mr. Yangiah",         chequeDate: "2026-04-14", chequeNo: "PO 6431",  amountClaimed: 30655, amountDeducted: 0,    tpaName: "Medi Assist",  itDeduction: 3068,  amountSettled: 27590, financialYear: "2026-2027", notes: "" },
  { id: "irc3", claimNo: "IRC-2026-003", dod: "2026-04-09", patientName: "Mrs. Kumaresan",      chequeDate: "2026-08-15", chequeNo: "",          amountClaimed: 78809, amountDeducted: 0,    tpaName: "Star Health",  itDeduction: 7881,  amountSettled: 70928, financialYear: "2026-2027", notes: "" },
  { id: "irc4", claimNo: "IRC-2026-004", dod: "2026-04-15", patientName: "Mrs. Selva Rani",     chequeDate: "2026-05-12", chequeNo: "PO 26173", amountClaimed: 48657, amountDeducted: 4870, tpaName: "Medi Assist",  itDeduction: 4866,  amountSettled: 43791, financialYear: "2026-2027", notes: "" },
  { id: "irc5", claimNo: "IRC-2026-005", dod: "2026-04-17", patientName: "Ms. Joshika",         chequeDate: "2026-06-15", chequeNo: "",          amountClaimed: 46731, amountDeducted: 0,    tpaName: "New India",    itDeduction: 4673,  amountSettled: 42058, financialYear: "2026-2027", notes: "" },
  { id: "irc6", claimNo: "IRC-2026-006", dod: "2026-04-17", patientName: "Mr. Chokkalingam",    chequeDate: "2026-08-15", chequeNo: "",          amountClaimed: 34499, amountDeducted: 1190, tpaName: "Star Health",  itDeduction: 3450,  amountSettled: 31049, financialYear: "2026-2027", notes: "" },
  { id: "irc7", claimNo: "IRC-2026-007", dod: "2026-04-22", patientName: "Mrs. Umera Banu",     chequeDate: "2026-08-16", chequeNo: "",          amountClaimed: 29794, amountDeducted: 3339, tpaName: "United India", itDeduction: 2979,  amountSettled: 26815, financialYear: "2026-2027", notes: "" },
  { id: "irc8", claimNo: "IRC-2026-008", dod: "2026-04-26", patientName: "Mr. Magesh Rajan",    chequeDate: "2026-05-25", chequeNo: "",          amountClaimed: 31310, amountDeducted: 9630, tpaName: "Oriental",     itDeduction: 3131,  amountSettled: 28179, financialYear: "2026-2027", notes: "" },
];

// ─── Mutable stores ───────────────────────────────────────────────────────────
let _summaries: DailySummary[] = [...DAILY_SUMMARIES];
let _claims: DailySummaryInsuranceClaim[] = [...INSURANCE_CLAIMS_RECEIVED];
let _dsCounter  = DAILY_SUMMARIES.length + 1;
let _ircCounter = INSURANCE_CLAIMS_RECEIVED.length + 1;
let _ceCounter  = 100;

function generateSummaryNo(date: string): string {
  const d = date.replace(/-/g, "");
  return `DS-${d}-${String(_dsCounter++).padStart(3, "0")}`;
}
function generateClaimNo(): string {
  return `IRC-2026-${String(_ircCounter++).padStart(3, "0")}`;
}
export function generateCeId(): string {
  return `ce${_ceCounter++}`;
}

// ─── Daily Summary CRUD ───────────────────────────────────────────────────────
export function getDailySummaries(): DailySummary[] { return _summaries; }

export function getDailySummaryById(id: string): DailySummary | undefined {
  return _summaries.find((s) => s.id === id);
}

export function getDailySummaryByDate(date: string): DailySummary | undefined {
  return _summaries.find((s) => s.date === date);
}

export function addDailySummary(data: Omit<DailySummary, "id" | "summaryNo">): DailySummary {
  const s: DailySummary = {
    ...data,
    id: `ds${Date.now()}`,
    summaryNo: generateSummaryNo(data.date),
    collectionEntries: data.collectionEntries.map((e, i) => ({
      ...e, id: e.id || generateCeId(), sNo: i + 1,
    })),
  };
  _summaries = [s, ..._summaries];
  return s;
}

export function updateDailySummary(id: string, data: Partial<DailySummary>): DailySummary | null {
  const i = _summaries.findIndex((s) => s.id === id);
  if (i === -1) return null;
  _summaries[i] = { ..._summaries[i], ...data };
  return _summaries[i];
}

export function deleteDailySummary(id: string): void {
  _summaries = _summaries.filter((s) => s.id !== id);
}

export function submitDailySummary(id: string, submittedBy: string): DailySummary | null {
  return updateDailySummary(id, { status: "Submitted", submittedBy });
}

// ─── Insurance Claims Received CRUD ──────────────────────────────────────────
export function getInsuranceClaimsReceived(): DailySummaryInsuranceClaim[] { return _claims; }

export function getDailySummaryInsuranceClaimById(id: string): DailySummaryInsuranceClaim | undefined {
  return _claims.find((c) => c.id === id);
}

export function addDailySummaryInsuranceClaim(data: Omit<DailySummaryInsuranceClaim, "id" | "claimNo">): DailySummaryInsuranceClaim {
  const c: DailySummaryInsuranceClaim = { ...data, id: `irc${Date.now()}`, claimNo: generateClaimNo() };
  _claims = [c, ..._claims];
  return c;
}

export function updateInsuranceClaimReceived(id: string, data: Partial<DailySummaryInsuranceClaim>): DailySummaryInsuranceClaim | null {
  const i = _claims.findIndex((c) => c.id === id);
  if (i === -1) return null;
  _claims[i] = { ..._claims[i], ...data };
  return _claims[i];
}

export function deleteInsuranceClaim(id: string): void {
  _claims = _claims.filter((c) => c.id !== id);
}
