import type { OPVisit } from "../types";

export const TODAY = new Date().toISOString().slice(0, 10);

export const OP_VISITS: OPVisit[] = [
  { id: "v1", visitNo: "VIS-20250615-001", uhid: "UH-2025-0001", patientName: "Suresh Kumar",   age: 45, gender: "Male",   phone: "9876500001", doctorId: "doc1", doctorName: "Dr. Venkatesan R", department: "Cardiology",    tokenNo: "T001", visitDate: TODAY, visitTime: "09:15", type: "Review",    status: "Consultation Done", chiefComplaint: "Chest pain follow-up" },
  { id: "v2", visitNo: "VIS-20250615-002", uhid: "UH-2025-0010", patientName: "Sangeetha M",    age: 29, gender: "Female", phone: "9876500010", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    tokenNo: "T001", visitDate: TODAY, visitTime: "09:30", type: "New",       status: "Waiting",           chiefComplaint: "Child fever and cold" },
  { id: "v3", visitNo: "VIS-20250615-003", uhid: "UH-2025-0006", patientName: "Lakshmi N",      age: 52, gender: "Female", phone: "9876500006", doctorId: "doc7", doctorName: "Dr. Anitha Rao",    department: "Dermatology",   tokenNo: "T001", visitDate: TODAY, visitTime: "09:45", type: "New",       status: "In Consultation",   chiefComplaint: "Skin rash on arms" },
  { id: "v4", visitNo: "VIS-20250615-004", uhid: "UH-2025-0008", patientName: "Kavitha R",      age: 41, gender: "Female", phone: "9876500008", doctorId: "doc9", doctorName: "Dr. Meena Kumari",  department: "Ophthalmology", tokenNo: "T001", visitDate: TODAY, visitTime: "10:00", type: "New",       status: "Waiting",           chiefComplaint: "Blurred vision" },
  { id: "v5", visitNo: "VIS-20250615-005", uhid: "UH-2025-0004", patientName: "Priya Kumari",   age: 28, gender: "Female", phone: "9876500004", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    tokenNo: "T002", visitDate: TODAY, visitTime: "10:15", type: "Follow-up", status: "Waiting",           chiefComplaint: "Vaccination" },
  { id: "v6", visitNo: "VIS-20250615-006", uhid: "UH-2025-NEW",  patientName: "Anand Krishnan", age: 38, gender: "Male",   phone: "9876511111", doctorId: "doc1", doctorName: "Dr. Venkatesan R", department: "Cardiology",    tokenNo: "T002", visitDate: TODAY, visitTime: "10:30", type: "New",       status: "Waiting",           chiefComplaint: "Hypertension check" },
];

let _opVisits: OPVisit[] = [...OP_VISITS];

export function getOPVisits(): OPVisit[] { return _opVisits; }

export function getNextToken(doctorId: string, date: string): string {
  const count = _opVisits.filter((v) => v.doctorId === doctorId && v.visitDate === date).length + 1;
  return `T${String(count).padStart(3, "0")}`;
}

export function addOPVisit(data: Omit<OPVisit, "id" | "visitNo" | "tokenNo">): OPVisit {
  const token = getNextToken(data.doctorId, data.visitDate);
  const count = _opVisits.length + 1;
  const visit: OPVisit = {
    ...data,
    id: `v${Date.now()}`,
    visitNo: `VIS-${data.visitDate.replace(/-/g, "")}-${String(count).padStart(3, "0")}`,
    tokenNo: token,
  };
  _opVisits = [..._opVisits, visit];
  return visit;
}

export function updateOPVisitStatus(id: string, status: OPVisit["status"]): void {
  const i = _opVisits.findIndex((v) => v.id === id);
  if (i !== -1) _opVisits[i] = { ..._opVisits[i], status };
}
