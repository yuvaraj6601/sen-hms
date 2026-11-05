import type { LabInvestigation, Investigation, LabPriority } from "../types";

export const LAB_INVESTIGATIONS: LabInvestigation[] = [
  { id: "l1", labId: "LAB001", patientId: "p3", patientName: "Ravi Shankar",  uhid: "UH-2025-0003", patientType: "IP", doctorName: "Dr. Venkatesan R", testCode: "LAB001", investigationName: "CBC (Complete Blood Count)", category: "Haematology",  sampleType: "Blood", priority: "STAT",    orderedDate: "2025-06-08", orderedTime: "02:30", orderedBy: "Dr. Venkatesan R", collectedDate: "2025-06-08", collectedTime: "02:45", collectedBy: "Karthik Rajan", completedDate: "2025-06-08", completedTime: "04:30", completedBy: "Karthik Rajan", actualTATMinutes: 120, result: "WBC: 8.2 K/µL", isAbnormal: false, normalRange: "WBC: 4–11 K/µL", unit: "K/µL",   turnaroundTime: "2 hours",  status: "Completed",    price: 250 },
  { id: "l2", labId: "LAB002", patientId: "p3", patientName: "Ravi Shankar",  uhid: "UH-2025-0003", patientType: "IP", doctorName: "Dr. Venkatesan R", testCode: "LAB010", investigationName: "Troponin I",                 category: "Cardiology",   sampleType: "Blood", priority: "STAT",    orderedDate: "2025-06-08", orderedTime: "02:30", orderedBy: "Dr. Venkatesan R", collectedDate: "2025-06-08", collectedTime: "02:45", collectedBy: "Karthik Rajan", completedDate: "2025-06-08", completedTime: "03:45", completedBy: "Karthik Rajan", actualTATMinutes: 75,  result: "0.98 ng/mL",    isAbnormal: true,  normalRange: "< 0.04 ng/mL",   unit: "ng/mL", turnaroundTime: "1 hour",   status: "Completed",    price: 1200 },
  { id: "l3", labId: "LAB003", patientId: "p5", patientName: "Karthik S",     uhid: "UH-2025-0005", patientType: "IP", doctorName: "Dr. Murugan S",     testCode: "LAB013", investigationName: "Blood Culture",              category: "Microbiology", sampleType: "Blood", priority: "Urgent",  orderedDate: "2025-06-11", orderedTime: "15:00", orderedBy: "Dr. Murugan S",     collectedDate: "2025-06-11", collectedTime: "15:30", collectedBy: "Karthik Rajan",                                                                                                                              turnaroundTime: "48 hours", status: "In Progress",  price: 800 },
  { id: "l4", labId: "LAB004", patientId: "p1", patientName: "Suresh Kumar",  uhid: "UH-2025-0001", patientType: "OP", doctorName: "Dr. Venkatesan R", testCode: "LAB006", investigationName: "Lipid Profile",              category: "Biochemistry", sampleType: "Blood", priority: "Routine", orderedDate: "2025-06-15", orderedTime: "09:30", orderedBy: "Dr. Venkatesan R",                                                                                                                                                                                       normalRange: "Total < 200 mg/dL", unit: "mg/dL", turnaroundTime: "4 hours", status: "Pending",      price: 500 },
  { id: "l5", labId: "LAB005", patientId: "p7", patientName: "Murugesan P",   uhid: "UH-2025-0007", patientType: "IP", doctorName: "Dr. Sathish Kumar", testCode: "LAB003", investigationName: "Blood Sugar Fasting",        category: "Biochemistry", sampleType: "Blood", priority: "Routine", orderedDate: "2025-06-11", orderedTime: "07:00", orderedBy: "Dr. Sathish Kumar", collectedDate: "2025-06-11", collectedTime: "07:15", collectedBy: "Karthik Rajan", completedDate: "2025-06-11", completedTime: "08:00", completedBy: "Karthik Rajan", actualTATMinutes: 60,  result: "142 mg/dL",     isAbnormal: true,  normalRange: "70–110 mg/dL",    unit: "mg/dL", turnaroundTime: "1 hour",   status: "Completed",    price: 80 },
];

export const LAB_MASTERS: Investigation[] = [
  { id: "lm01", testCode: "LAB001", name: "CBC (Complete Blood Count)",    category: "Haematology",   price: 250,  turnaroundTime: "2 hours",  normalRange: "WBC: 4–11 K/µL",      unit: "K/µL",   sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm02", testCode: "LAB002", name: "Haemoglobin",                   category: "Haematology",   price: 80,   turnaroundTime: "1 hour",   normalRange: "M: 13–17 g/dL",       unit: "g/dL",   sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm03", testCode: "LAB003", name: "Blood Sugar Fasting",           category: "Biochemistry",  price: 80,   turnaroundTime: "1 hour",   normalRange: "70–110 mg/dL",        unit: "mg/dL",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm04", testCode: "LAB004", name: "Blood Sugar PP",                category: "Biochemistry",  price: 80,   turnaroundTime: "1 hour",   normalRange: "< 140 mg/dL",         unit: "mg/dL",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm05", testCode: "LAB005", name: "HbA1c",                         category: "Biochemistry",  price: 350,  turnaroundTime: "3 hours",  normalRange: "< 5.7%",              unit: "%",      sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm06", testCode: "LAB006", name: "Lipid Profile",                 category: "Biochemistry",  price: 500,  turnaroundTime: "4 hours",  normalRange: "Total < 200 mg/dL",   unit: "mg/dL",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm07", testCode: "LAB007", name: "Liver Function Test (LFT)",     category: "Biochemistry",  price: 600,  turnaroundTime: "4 hours",  normalRange: "ALT: 7–56 U/L",       unit: "U/L",    sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm08", testCode: "LAB008", name: "Kidney Function Test (KFT)",    category: "Biochemistry",  price: 600,  turnaroundTime: "4 hours",  normalRange: "Creatinine: 0.7–1.3", unit: "mg/dL",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm09", testCode: "LAB009", name: "Thyroid Profile (T3/T4/TSH)",   category: "Endocrinology", price: 700,  turnaroundTime: "6 hours",  normalRange: "TSH: 0.4–4.0 mIU/L", unit: "mIU/L",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm10", testCode: "LAB010", name: "Troponin I",                    category: "Cardiology",    price: 1200, turnaroundTime: "1 hour",   normalRange: "< 0.04 ng/mL",        unit: "ng/mL",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm11", testCode: "LAB011", name: "Urine Routine & Microscopy",    category: "Urine",         price: 100,  turnaroundTime: "1 hour",   normalRange: "No abnormality",      unit: "",       sampleType: "Urine",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm12", testCode: "LAB012", name: "Urine Culture & Sensitivity",   category: "Microbiology",  price: 500,  turnaroundTime: "48 hours", normalRange: "No growth",           unit: "",       sampleType: "Urine",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm13", testCode: "LAB013", name: "Blood Culture",                 category: "Microbiology",  price: 800,  turnaroundTime: "48 hours", normalRange: "No growth",           unit: "",       sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm14", testCode: "LAB014", name: "Stool Routine",                 category: "Stool",         price: 120,  turnaroundTime: "2 hours",  normalRange: "No abnormality",      unit: "",       sampleType: "Stool",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm15", testCode: "LAB015", name: "Widal Test",                    category: "Serology",      price: 200,  turnaroundTime: "4 hours",  normalRange: "< 1:80",              unit: "titre",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm16", testCode: "LAB016", name: "Dengue NS1 Antigen",            category: "Serology",      price: 600,  turnaroundTime: "2 hours",  normalRange: "Non-reactive",        unit: "",       sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm17", testCode: "LAB017", name: "Malaria Antigen Test",          category: "Serology",      price: 300,  turnaroundTime: "1 hour",   normalRange: "Negative",            unit: "",       sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm18", testCode: "LAB018", name: "COVID-19 RT-PCR",               category: "Molecular",     price: 1200, turnaroundTime: "24 hours", normalRange: "Not detected",        unit: "",       sampleType: "Swab",   status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm19", testCode: "LAB019", name: "Serum Electrolytes",            category: "Biochemistry",  price: 400,  turnaroundTime: "3 hours",  normalRange: "Na: 136–145 mEq/L",  unit: "mEq/L",  sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "lm20", testCode: "LAB020", name: "PT/INR",                        category: "Haematology",   price: 300,  turnaroundTime: "2 hours",  normalRange: "INR: 0.8–1.2",        unit: "",       sampleType: "Blood",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];

let _labInvestigations: LabInvestigation[] = [...LAB_INVESTIGATIONS];
let _labIdCounter = LAB_INVESTIGATIONS.length + 1;

function generateLabId(): string {
  return `LAB${String(_labIdCounter++).padStart(3, "0")}`;
}

export function getLabInvestigations(): LabInvestigation[] { return _labInvestigations; }
export function getLabInvestigationsByPatient(patientId: string) {
  return _labInvestigations.filter((l) => l.patientId === patientId);
}

export function orderLabTests(
  orders: Omit<LabInvestigation, "id" | "labId" | "status" | "actualTATMinutes">[],
): LabInvestigation[] {
  const created = orders.map((o) => ({
    ...o,
    id: `lab${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    labId: generateLabId(),
    status: "Pending" as const,
  }));
  _labInvestigations = [...created, ..._labInvestigations];
  return created;
}

export function collectSample(id: string, collectedBy: string): LabInvestigation | null {
  const i = _labInvestigations.findIndex((l) => l.id === id);
  if (i === -1) return null;
  const now = new Date();
  _labInvestigations[i] = {
    ..._labInvestigations[i],
    status: "In Progress",
    collectedDate: now.toISOString().slice(0, 10),
    collectedTime: now.toTimeString().slice(0, 5),
    collectedBy,
  };
  return _labInvestigations[i];
}

export function completeLabTest(id: string, result: string, completedBy: string): LabInvestigation | null {
  const i = _labInvestigations.findIndex((l) => l.id === id);
  if (i === -1) return null;
  const test = _labInvestigations[i];
  const now  = new Date();
  const orderedAt = new Date(`${test.orderedDate}T${test.orderedTime}`);
  const actualTATMinutes = Math.round((now.getTime() - orderedAt.getTime()) / 60000);
  let isAbnormal = false;
  if (test.normalRange && result) {
    const numResult = parseFloat(result.replace(/[^0-9.]/g, ""));
    const rangeMatch = test.normalRange.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
    if (!isNaN(numResult) && rangeMatch) {
      isAbnormal = numResult < parseFloat(rangeMatch[1]) || numResult > parseFloat(rangeMatch[2]);
    }
    const ltMatch = test.normalRange.match(/^<\s*([\d.]+)/);
    if (!isNaN(numResult) && ltMatch) isAbnormal = numResult >= parseFloat(ltMatch[1]);
  }
  _labInvestigations[i] = {
    ...test, status: "Completed", result, isAbnormal,
    completedDate: now.toISOString().slice(0, 10),
    completedTime: now.toTimeString().slice(0, 5),
    completedBy, actualTATMinutes,
  };
  return _labInvestigations[i];
}

export function cancelLabTest(id: string, reason: string): LabInvestigation | null {
  const i = _labInvestigations.findIndex((l) => l.id === id);
  if (i === -1) return null;
  if (_labInvestigations[i].status === "Completed") return null;
  _labInvestigations[i] = { ..._labInvestigations[i], status: "Cancelled", cancelReason: reason };
  return _labInvestigations[i];
}

// ─── Lab Masters ──────────────────────────────────────────────────────────────
let _labMasters: Investigation[] = [...LAB_MASTERS];
let _labCodeCounter = LAB_MASTERS.length + 1;

function generateLabCode(): string {
  return `LAB${String(_labCodeCounter++).padStart(3, "0")}`;
}

export function getLabMasters(): Investigation[] { return _labMasters; }
export function getLabMasterById(id: string) { return _labMasters.find((l) => l.id === id); }

export function addLabMaster(data: Omit<Investigation, "id" | "testCode">): Investigation {
  const l: Investigation = { ...data, id: `lm${Date.now()}`, testCode: generateLabCode() };
  _labMasters = [..._labMasters, l];
  return l;
}

export function updateLabMaster(id: string, data: Partial<Investigation>): Investigation | null {
  const i = _labMasters.findIndex((l) => l.id === id);
  if (i === -1) return null;
  _labMasters[i] = { ..._labMasters[i], ...data };
  return _labMasters[i];
}

export function toggleLabMasterStatus(id: string): void {
  const i = _labMasters.findIndex((l) => l.id === id);
  if (i !== -1) _labMasters[i].status = _labMasters[i].status === "Active" ? "Inactive" : "Active";
}
