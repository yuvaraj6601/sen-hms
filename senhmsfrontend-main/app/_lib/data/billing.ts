import type { BillingModality, BillingMaster } from "../types";

export const BILLING_MODALITIES: BillingModality[] = [
  { id: "bm1", modalityCode: "MOD001", name: "Consultation", shortName: "CONS", description: "Doctor consultation and OPD visit charges",     status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm2", modalityCode: "MOD002", name: "ECG",          shortName: "ECG",  description: "Electrocardiogram investigation charges",        status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm3", modalityCode: "MOD003", name: "ICU Charges",  shortName: "ICU",  description: "Intensive care unit daily charges",              status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm4", modalityCode: "MOD004", name: "Lab",          shortName: "LAB",  description: "Laboratory investigation and test charges",      status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm5", modalityCode: "MOD005", name: "Ward Charges", shortName: "WARD", description: "Inpatient ward bed and nursing charges",         status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm6", modalityCode: "MOD006", name: "X-Ray",        shortName: "XRAY", description: "Radiology and X-ray imaging charges",           status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm7", modalityCode: "MOD007", name: "Procedures",   shortName: "PROC", description: "Surgical and clinical procedure charges",       status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "bm8", modalityCode: "MOD008", name: "Others",       shortName: "OTH",  description: "Miscellaneous charges not in other modalities", status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];//

export const BILLING_MASTERS: BillingMaster[] = [
  { id: "svc1",  serviceCode: "SVC001", serviceName: "OPD Consultation",    modalityId: "bm1", modalityName: "Consultation", price: 500,  discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc2",  serviceCode: "SVC002", serviceName: "Review Consultation",  modalityId: "bm1", modalityName: "Consultation", price: 300,  discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc3",  serviceCode: "SVC003", serviceName: "Emergency Consult",    modalityId: "bm1", modalityName: "Consultation", price: 750,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc4",  serviceCode: "SVC004", serviceName: "ECG",                  modalityId: "bm2", modalityName: "ECG",          price: 250,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc5",  serviceCode: "SVC005", serviceName: "ICU Per Day",          modalityId: "bm3", modalityName: "ICU Charges",  price: 3000, discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc6",  serviceCode: "SVC006", serviceName: "Ventilator Per Day",   modalityId: "bm3", modalityName: "ICU Charges",  price: 2500, discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc7",  serviceCode: "SVC007", serviceName: "Oxygen Per Hour",      modalityId: "bm3", modalityName: "ICU Charges",  price: 150,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc8",  serviceCode: "SVC008", serviceName: "CBC",                  modalityId: "bm4", modalityName: "Lab",          price: 250,  discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc9",  serviceCode: "SVC009", serviceName: "Blood Sugar (F)",      modalityId: "bm4", modalityName: "Lab",          price: 80,   discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc10", serviceCode: "SVC010", serviceName: "Urine Routine",        modalityId: "bm4", modalityName: "Lab",          price: 100,  discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc11", serviceCode: "SVC011", serviceName: "General Ward / Day",   modalityId: "bm5", modalityName: "Ward Charges", price: 800,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc12", serviceCode: "SVC012", serviceName: "Semi Private / Day",   modalityId: "bm5", modalityName: "Ward Charges", price: 1500, discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc13", serviceCode: "SVC013", serviceName: "Private Room / Day",   modalityId: "bm5", modalityName: "Ward Charges", price: 2500, discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc14", serviceCode: "SVC014", serviceName: "X-Ray Chest",          modalityId: "bm6", modalityName: "X-Ray",        price: 400,  discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc15", serviceCode: "SVC015", serviceName: "Dressing",             modalityId: "bm7", modalityName: "Procedures",   price: 200,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc16", serviceCode: "SVC016", serviceName: "Suturing",             modalityId: "bm7", modalityName: "Procedures",   price: 500,  discountAllowed: false, status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "svc17", serviceCode: "SVC017", serviceName: "Miscellaneous Charge", modalityId: "bm8", modalityName: "Others",       price: 0,    discountAllowed: true,  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];

let _billingModalities: BillingModality[] = [...BILLING_MODALITIES];
let _modCodeCounter = BILLING_MODALITIES.length + 1;

function generateModCode(): string { return `MOD${String(_modCodeCounter++).padStart(3, "0")}`; }

export function getBillingModalities(): BillingModality[] { return _billingModalities; }
export function getBillingModalityById(id: string) { return _billingModalities.find((m) => m.id === id); }

export function addBillingModality(data: Omit<BillingModality, "id" | "modalityCode">): BillingModality {
  const m: BillingModality = { ...data, id: `bm${Date.now()}`, modalityCode: generateModCode() };
  _billingModalities = [..._billingModalities, m];
  return m;
}

export function updateBillingModality(id: string, data: Partial<BillingModality>): BillingModality | null {
  const i = _billingModalities.findIndex((m) => m.id === id);
  if (i === -1) return null;
  _billingModalities[i] = { ..._billingModalities[i], ...data };
  return _billingModalities[i];
}

export function toggleBillingModalityStatus(id: string): void {
  const i = _billingModalities.findIndex((m) => m.id === id);
  if (i !== -1) _billingModalities[i].status = _billingModalities[i].status === "Active" ? "Inactive" : "Active";
}

let _billingMasters: BillingMaster[] = [...BILLING_MASTERS];
let _svcCodeCounter = BILLING_MASTERS.length + 1;

function generateSvcCode(): string { return `SVC${String(_svcCodeCounter++).padStart(3, "0")}`; }

export function getBillingMasters(): BillingMaster[] { return _billingMasters; }
export function getBillingMasterById(id: string) { return _billingMasters.find((s) => s.id === id); }

export function addBillingMaster(data: Omit<BillingMaster, "id" | "serviceCode">): BillingMaster {
  const s: BillingMaster = { ...data, id: `svc${Date.now()}`, serviceCode: generateSvcCode() };
  _billingMasters = [..._billingMasters, s];
  return s;
}

export function updateBillingMaster(id: string, data: Partial<BillingMaster>): BillingMaster | null {
  const i = _billingMasters.findIndex((s) => s.id === id);
  if (i === -1) return null;
  _billingMasters[i] = { ..._billingMasters[i], ...data };
  return _billingMasters[i];
}

export function toggleBillingMasterStatus(id: string): void {
  const i = _billingMasters.findIndex((s) => s.id === id);
  if (i !== -1) _billingMasters[i].status = _billingMasters[i].status === "Active" ? "Inactive" : "Active";
}
