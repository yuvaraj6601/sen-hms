import type { InsuranceCompany, InsuranceClaim, PreAuthorization, ClaimDocument, ClaimQuery, ClaimType, PreAuthStatus } from "../types";
import { _bills, recordPayment } from "./bills";

export const INSURANCE_COMPANIES: InsuranceCompany[] = [
  { id: "ins1", companyCode: "INS001", name: "Star Health Insurance",  tpaName: "Medi Assist",    contactPerson: "Rajesh Kumar",  phone: "044-28001111", email: "claims@starhealth.in",    address: "1, New Tank St, Chennai",  status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ins2", companyCode: "INS002", name: "New India Assurance",    tpaName: "Paramount TPA",  contactPerson: "Meera Iyer",    phone: "044-28002222", email: "claims@newindia.co.in",   address: "87, M G Road, Chennai",    status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ins3", companyCode: "INS003", name: "United India Insurance", tpaName: "MD India",       contactPerson: "Suresh Pillai", phone: "044-28003333", email: "tpa@uiic.co.in",          address: "24, Whites Road, Chennai", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ins4", companyCode: "INS004", name: "ICICI Lombard",          tpaName: "Health India",   contactPerson: "Anitha Sharma", phone: "044-28004444", email: "health@icicilombard.com",  address: "30, Nungambakkam, Chennai",status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ins5", companyCode: "INS005", name: "HDFC ERGO Health",       tpaName: "TTK Healthcare", contactPerson: "Venkat Raman",  phone: "044-28005555", email: "support@hdfcergo.com",     address: "45, Anna Salai, Chennai",  status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ins6", companyCode: "INS006", name: "Oriental Insurance",     tpaName: "Genins India",   contactPerson: "Priya Nair",    phone: "044-28006666", email: "regional@orientalins.com", address: "12, Mount Road, Chennai",  status: "Inactive", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];

let _insuranceCompanies: InsuranceCompany[] = [...INSURANCE_COMPANIES];
let _insCodeCounter = INSURANCE_COMPANIES.length + 1;

function generateInsCode(): string {
  return `INS${String(_insCodeCounter++).padStart(3, "0")}`;
}

export function getInsuranceCompanies(): InsuranceCompany[] { return _insuranceCompanies; }
export function getInsuranceCompanyById(id: string) { return _insuranceCompanies.find((c) => c.id === id); }
export function getInsuranceCompanyByName(name: string) { return _insuranceCompanies.find((c) => c.name === name); }

export function addInsuranceCompany(data: Omit<InsuranceCompany, "id" | "companyCode">): InsuranceCompany {
  const c: InsuranceCompany = { ...data, id: `ins${Date.now()}`, companyCode: generateInsCode() };
  _insuranceCompanies = [..._insuranceCompanies, c];
  return c;
}

export function updateInsuranceCompany(id: string, data: Partial<InsuranceCompany>): InsuranceCompany | null {
  const i = _insuranceCompanies.findIndex((c) => c.id === id);
  if (i === -1) return null;
  _insuranceCompanies[i] = { ..._insuranceCompanies[i], ...data };
  return _insuranceCompanies[i];
}

export function toggleInsuranceCompanyStatus(id: string): void {
  const i = _insuranceCompanies.findIndex((c) => c.id === id);
  if (i !== -1) _insuranceCompanies[i].status = _insuranceCompanies[i].status === "Active" ? "Inactive" : "Active";
}

// ─── Pre-Authorizations ──────────────────────────────────────────────────────
export const PRE_AUTHORIZATIONS: PreAuthorization[] = [
  {
    id: "pa1", preAuthNo: "PA-2026-0001",
    patientId: "p3", patientName: "Ravi Shankar", uhid: "UH-2025-0003",
    insuranceCompany: "Star Health Insurance", policyNo: "SH-2024-98765",
    tpaName: "Medi Assist", tpaRefNo: "MA-PA-44521",
    admissionDate: "2025-06-08",
    provisionalDiagnosis: "Acute Myocardial Infarction (STEMI)",
    icdCodes: ["I21.0"],
    treatmentPlan: "Thrombolysis, ICU monitoring, coronary angiography if needed",
    estimatedAmount: 50000, requestedAmount: 50000, approvedAmount: 35000,
    requestedDate: "2025-06-08", approvedDate: "2025-06-08",
    expiryDate: "2025-06-15",
    status: "Approved",
    remarks: "Pre-auth approved for ₹35,000. ICU charges max 3 days. Angiography requires separate auth.",
    requestedBy: "Ananya Krishnan", approvedBy: "TPA - Medi Assist",
  },
  {
    id: "pa2", preAuthNo: "PA-2026-0002",
    patientId: "p5", patientName: "Karthik S", uhid: "UH-2025-0005",
    insuranceCompany: "ICICI Lombard", policyNo: "IC-2024-55432",
    tpaName: "Health India", tpaRefNo: "HI-PA-88910",
    admissionDate: "2025-06-11",
    provisionalDiagnosis: "Acute Appendicitis",
    icdCodes: ["K35.80"],
    treatmentPlan: "Emergency laparoscopic appendectomy, 2-day ward stay",
    estimatedAmount: 45000, requestedAmount: 45000, approvedAmount: 42000,
    requestedDate: "2025-06-11", approvedDate: "2025-06-11",
    expiryDate: "2025-06-18",
    status: "Approved",
    remarks: "Approved for lap appendectomy. General ward only.",
    requestedBy: "Ananya Krishnan", approvedBy: "TPA - Health India",
  },
];

let _preAuths: PreAuthorization[] = [...PRE_AUTHORIZATIONS];
let _preAuthCounter = PRE_AUTHORIZATIONS.length + 1;

function generatePreAuthNo(): string {
  const year = new Date().getFullYear();
  return `PA-${year}-${String(_preAuthCounter++).padStart(4, "0")}`;
}

export function getPreAuthorizations(): PreAuthorization[] { return _preAuths; }
export function getPreAuthById(id: string) { return _preAuths.find(p => p.id === id); }
export function getPreAuthsByPatient(patientId: string) { return _preAuths.filter(p => p.patientId === patientId); }

export function addPreAuthorization(data: Omit<PreAuthorization, "id" | "preAuthNo">): PreAuthorization {
  const pa: PreAuthorization = { ...data, id: `pa${Date.now()}`, preAuthNo: generatePreAuthNo() };
  _preAuths = [pa, ..._preAuths];
  return pa;
}

export function updatePreAuthorization(id: string, data: Partial<PreAuthorization>): PreAuthorization | null {
  const i = _preAuths.findIndex(p => p.id === id);
  if (i === -1) return null;
  _preAuths[i] = { ..._preAuths[i], ...data };
  return _preAuths[i];
}

// ─── Claims ───────────────────────────────────────────────────────────────────
export const INSURANCE_CLAIMS: InsuranceClaim[] = [
  {
    id: "ic1", claimNo: "CLM001", claimType: "Cashless", preAuthId: "pa1",
    billId: "bill2", billNo: "BILL-002",
    patientId: "p3", patientName: "Ravi Shankar", uhid: "UH-2025-0003",
    insuranceCompany: "Star Health Insurance", policyNo: "SH-2024-98765",
    tpaName: "Medi Assist", tpaRefNo: "MA-2025-44521",
    admissionDate: "2025-06-08", diagnosis: "Acute Myocardial Infarction",
    icdCodes: ["I21.0"], pcsCodes: ["02703ZZ"],
    claimAmount: 34750, approvedAmount: 30000, settledAmount: 20000,
    disallowedAmount: 4750, disallowedReason: "ICU charges exceeded pre-auth limit",
    patientPayable: 14750,
    submittedDate: "2025-06-09", status: "Partial",
    remarks: "Partial pre-auth ₹20,000 released. Balance under review.",
    updatedBy: "Ananya Krishnan", updatedDate: "2025-06-12",
    queries: [{
      id: "q1", queryDate: "2025-06-10",
      queryText: "Please provide detailed ICU nursing notes for day 2-3",
      queriedBy: "TPA - Medi Assist", status: "Responded",
      responseText: "ICU notes uploaded as document",
      responseDate: "2025-06-11", respondedBy: "Ananya Krishnan",
    }],
  },
  {
    id: "ic2", claimNo: "CLM002", claimType: "Cashless", preAuthId: "pa2",
    billId: "bill4", billNo: "BILL-004",
    patientId: "p7", patientName: "Murugesan P", uhid: "UH-2025-0007",
    insuranceCompany: "New India Assurance", policyNo: "NIA-2024-11223",
    tpaName: "Paramount TPA", tpaRefNo: "PAR-2025-88731",
    admissionDate: "2025-06-09", diagnosis: "Ischemic Stroke",
    icdCodes: ["I63.9"],
    claimAmount: 6540, approvedAmount: 6540, settledAmount: 6540,
    submittedDate: "2025-06-10", status: "Settled",
    remarks: "Claim fully settled.",
    updatedBy: "Ananya Krishnan", updatedDate: "2025-06-15",
  },
];

let _claims: InsuranceClaim[] = [...INSURANCE_CLAIMS];
let _claimCounter = INSURANCE_CLAIMS.length + 1;

function generateClaimNo(): string {
  return `CLM${String(_claimCounter++).padStart(3, "0")}`;
}

export function getInsuranceClaims(): InsuranceClaim[] { return _claims; }
export function getInsuranceClaimById(id: string) { return _claims.find((c) => c.id === id); }
export function getClaimsByBill(billId: string) { return _claims.filter((c) => c.billId === billId); }
export function getClaimsByPatient(patientId: string) { return _claims.filter(c => c.patientId === patientId); }

export function addInsuranceClaim(data: Omit<InsuranceClaim, "id" | "claimNo">): InsuranceClaim {
  const c: InsuranceClaim = { ...data, id: `ic${Date.now()}`, claimNo: generateClaimNo() };
  _claims = [c, ..._claims];
  return c;
}

export function updateInsuranceClaim(id: string, data: Partial<InsuranceClaim>): InsuranceClaim | null {
  const i = _claims.findIndex((c) => c.id === id);
  if (i === -1) return null;
  _claims[i] = { ..._claims[i], ...data };
  // If settled → auto-record payment on linked bill
  if (data.status === "Settled" && _claims[i].billId && data.settledAmount) {
    const billIdx = _bills.findIndex((b) => b.id === _claims[i].billId);
    if (billIdx !== -1) {
      const bill = _bills[billIdx];
      const extra = data.settledAmount - bill.paidAmount;
      if (extra > 0) {
        recordPayment(bill.id, {
          date: new Date().toISOString().slice(0, 10),
          amount: extra,
          paymentMode: "Insurance",
          receivedBy: data.updatedBy ?? "System",
        }, data.updatedBy ?? "System");
      }
    }
  }
  return _claims[i];
}

// Add query to claim
export function addClaimQuery(claimId: string, query: Omit<ClaimQuery, "id">): InsuranceClaim | null {
  const i = _claims.findIndex(c => c.id === claimId);
  if (i === -1) return null;
  const newQuery = { ...query, id: `q${Date.now()}` };
  _claims[i] = {
    ..._claims[i],
    queries: [...(_claims[i].queries ?? []), newQuery],
  };
  return _claims[i];
}

// Respond to query
export function respondToClaimQuery(claimId: string, queryId: string, response: { responseText: string; respondedBy: string }): InsuranceClaim | null {
  const i = _claims.findIndex(c => c.id === claimId);
  if (i === -1 || !_claims[i].queries) return null;
  const qi = _claims[i].queries!.findIndex(q => q.id === queryId);
  if (qi === -1) return null;
  _claims[i].queries![qi] = {
    ..._claims[i].queries![qi],
    ...response,
    responseDate: new Date().toISOString().slice(0, 10),
    status: "Responded",
  };
  return _claims[i];
}

// Add document to claim or pre-auth
export function addDocument(targetId: string, type: "claim" | "preAuth", doc: Omit<ClaimDocument, "id">): boolean {
  const newDoc = { ...doc, id: `doc${Date.now()}` };
  if (type === "claim") {
    const i = _claims.findIndex(c => c.id === targetId);
    if (i === -1) return false;
    _claims[i] = { ..._claims[i], documents: [...(_claims[i].documents ?? []), newDoc] };
    return true;
  } else {
    const i = _preAuths.findIndex(p => p.id === targetId);
    if (i === -1) return false;
    _preAuths[i] = { ..._preAuths[i], documents: [...(_preAuths[i].documents ?? []), newDoc] };
    return true;
  }
}
