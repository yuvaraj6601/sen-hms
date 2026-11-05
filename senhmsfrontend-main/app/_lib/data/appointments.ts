import type { Appointment, AppointmentStatus, AppointmentType } from "../types";
import { TODAY } from "./visits";

function daysOffset(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
const D_MINUS2 = daysOffset(-2);
const D_MINUS1 = daysOffset(-1);
const D_PLUS1  = daysOffset(1);
const D_PLUS2  = daysOffset(2);
const D_PLUS7  = daysOffset(7);
const D_PLUS8  = daysOffset(8);
const D_PLUS9  = daysOffset(9);
const D_PLUS10 = daysOffset(10);

export const APPOINTMENTS: Appointment[] = [
  // ── Today — OP ──
  { id: "a1",  appointmentNo: "APT-001", patientId: "p1",  patientName: "Suresh Kumar",   uhid: "UH-2025-0001", phone: "9876500001", patientCategory: "OP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: TODAY,     time: "09:00", type: "Review",    status: "Completed",   reason: "Chest pain follow-up",              tokenNo: 1, bookedBy: "Priya Menon",     bookedDate: D_MINUS1, smsSent: true },
  { id: "a2",  appointmentNo: "APT-002", patientId: "p4",  patientName: "Priya Kumari",   uhid: "UH-2025-0004", phone: "9876500004", patientCategory: "OP", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    date: TODAY,     time: "10:00", type: "Follow-up", status: "Scheduled",   reason: "Vaccination schedule check",        tokenNo: 2, bookedBy: "Priya Menon",     bookedDate: D_MINUS1 },
  { id: "a3",  appointmentNo: "APT-003", patientId: "p6",  patientName: "Lakshmi N",      uhid: "UH-2025-0006", phone: "9876500006", patientCategory: "OP", doctorId: "doc7", doctorName: "Dr. Anitha Rao",    department: "Dermatology",   date: TODAY,     time: "09:30", type: "New",       status: "In Progress", reason: "Skin rash and itching",             tokenNo: 1, bookedBy: "Priya Menon",     bookedDate: D_MINUS1, smsSent: true },
  { id: "a4",  appointmentNo: "APT-004", patientId: "p8",  patientName: "Kavitha R",      uhid: "UH-2025-0008", phone: "9876500008", patientCategory: "OP", doctorId: "doc9", doctorName: "Dr. Meena Kumari",  department: "Ophthalmology", date: TODAY,     time: "11:00", type: "New",       status: "Scheduled",   reason: "Blurred vision",                    tokenNo: 3, bookedBy: "Priya Menon",     bookedDate: D_MINUS1 },
  { id: "a5",  appointmentNo: "APT-005", patientId: "p10", patientName: "Sangeetha M",    uhid: "UH-2025-0010", phone: "9876500010", patientCategory: "OP", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    date: TODAY,     time: "09:30", type: "New",       status: "Scheduled",   reason: "Child fever — 3 days",              tokenNo: 2, bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a9",  appointmentNo: "APT-009", patientId: "p4",  patientName: "Priya Kumari",   uhid: "UH-2025-0004", phone: "9876500004", patientCategory: "OP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: TODAY,     time: "10:30", type: "Follow-up", status: "Confirmed",   reason: "Routine gynaec follow-up",          tokenNo: 4, bookedBy: "Priya Menon",     bookedDate: TODAY, smsSent: true },
  { id: "a10", appointmentNo: "APT-010", patientId: "p6",  patientName: "Lakshmi N",      uhid: "UH-2025-0006", phone: "9876500006", patientCategory: "OP", doctorId: "doc2", doctorName: "Dr. Sathish Kumar", department: "Neurology",     date: TODAY,     time: "12:00", type: "New",       status: "Scheduled",   reason: "Frequent headaches",                tokenNo: 5, bookedBy: "Rajan K",         bookedDate: TODAY },
  { id: "a11", appointmentNo: "APT-011", patientId: "p8",  patientName: "Kavitha R",      uhid: "UH-2025-0008", phone: "9876500008", patientCategory: "OP", doctorId: "doc3", doctorName: "Dr. Ramesh Babu",   department: "Orthopedics",   date: TODAY,     time: "14:00", type: "Review",    status: "Confirmed",   reason: "Post-op knee review",               tokenNo: 6, bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a12", appointmentNo: "APT-012", patientId: "p10", patientName: "Sangeetha M",    uhid: "UH-2025-0010", phone: "9876500010", patientCategory: "OP", doctorId: "doc8", doctorName: "Dr. Selvan P",      department: "ENT",           date: TODAY,     time: "15:00", type: "New",       status: "Scheduled",   reason: "Ear pain",                          tokenNo: 7, bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a13", appointmentNo: "APT-013", patientId: "p1",  patientName: "Suresh Kumar",   uhid: "UH-2025-0001", phone: "9876500001", patientCategory: "OP", doctorId: "doc6", doctorName: "Dr. Murugan S",     department: "General Surgery",date: TODAY,    time: "16:00", type: "Follow-up", status: "Cancelled",   reason: "BP monitoring",                     cancelReason: "Patient called to reschedule", bookedBy: "Priya Menon", bookedDate: D_MINUS1 },
  { id: "a14", appointmentNo: "APT-014", patientId: "p4",  patientName: "Priya Kumari",   uhid: "UH-2025-0004", phone: "9876500004", patientCategory: "OP", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    date: TODAY,     time: "11:30", type: "Review",    status: "No Show",     reason: "Growth assessment",                 bookedBy: "Priya Menon",     bookedDate: D_MINUS2 },
  // ── Today — IP rounds ──
  { id: "a6",  appointmentNo: "APT-006", patientId: "p2",  patientName: "Meena Devi",     uhid: "UH-2025-0002", phone: "9876500002", patientCategory: "IP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: TODAY,     time: "11:00", type: "Review",    status: "Confirmed",   reason: "Ante-natal morning round",          bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a7",  appointmentNo: "APT-007", patientId: "p3",  patientName: "Ravi Shankar",   uhid: "UH-2025-0003", phone: "9876500003", patientCategory: "IP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: TODAY,     time: "08:00", type: "Review",    status: "Confirmed",   reason: "Post angioplasty morning round",    bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a15", appointmentNo: "APT-015", patientId: "p5",  patientName: "Karthik S",      uhid: "UH-2025-0005", phone: "9876500005", patientCategory: "IP", doctorId: "doc2", doctorName: "Dr. Sathish Kumar", department: "Neurology",     date: TODAY,     time: "08:30", type: "Review",    status: "Completed",   reason: "Post-stroke morning round",         bookedBy: "Priya Menon",     bookedDate: TODAY },
  { id: "a16", appointmentNo: "APT-016", patientId: "p7",  patientName: "Murugesan P",    uhid: "UH-2025-0007", phone: "9876500007", patientCategory: "IP", doctorId: "doc3", doctorName: "Dr. Ramesh Babu",   department: "Orthopedics",   date: TODAY,     time: "09:00", type: "Review",    status: "In Progress", reason: "Ortho post-op review",              bookedBy: "Priya Menon",     bookedDate: TODAY },
  // ── Yesterday ──
  { id: "a17", appointmentNo: "APT-017", patientId: "p1",  patientName: "Suresh Kumar",   uhid: "UH-2025-0001", phone: "9876500001", patientCategory: "OP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_MINUS1, time: "10:00", type: "Follow-up", status: "Completed",   reason: "ECG review",          smsSent: true, bookedBy: "Priya Menon", bookedDate: D_MINUS2 },
  { id: "a18", appointmentNo: "APT-018", patientId: "p6",  patientName: "Lakshmi N",      uhid: "UH-2025-0006", phone: "9876500006", patientCategory: "OP", doctorId: "doc7", doctorName: "Dr. Anitha Rao",    department: "Dermatology",   date: D_MINUS1, time: "11:00", type: "New",       status: "No Show",     reason: "Acne treatment consult",             bookedBy: "Priya Menon", bookedDate: D_MINUS2 },
  { id: "a19", appointmentNo: "APT-019", patientId: "p10", patientName: "Sangeetha M",    uhid: "UH-2025-0010", phone: "9876500010", patientCategory: "OP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: D_MINUS1, time: "09:00", type: "New",       status: "Completed",   reason: "Gynaec first consult", smsSent: true, bookedBy: "Rajan K", bookedDate: D_MINUS2 },
  { id: "a20", appointmentNo: "APT-020", patientId: "p2",  patientName: "Meena Devi",     uhid: "UH-2025-0002", phone: "9876500002", patientCategory: "IP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: D_MINUS1, time: "11:00", type: "Review",    status: "Completed",   reason: "Ante-natal morning round",           bookedBy: "Priya Menon", bookedDate: D_MINUS1 },
  // ── 2 days ago ──
  { id: "a21", appointmentNo: "APT-021", patientId: "p8",  patientName: "Kavitha R",      uhid: "UH-2025-0008", phone: "9876500008", patientCategory: "OP", doctorId: "doc9", doctorName: "Dr. Meena Kumari",  department: "Ophthalmology", date: D_MINUS2, time: "10:00", type: "New",       status: "Completed",   reason: "Eye check-up",         smsSent: true, bookedBy: "Priya Menon", bookedDate: D_MINUS2 },
  { id: "a22", appointmentNo: "APT-022", patientId: "p4",  patientName: "Priya Kumari",   uhid: "UH-2025-0004", phone: "9876500004", patientCategory: "OP", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    date: D_MINUS2, time: "11:00", type: "Follow-up", status: "Cancelled",   reason: "Child cough review",   cancelReason: "Doctor on leave", bookedBy: "Priya Menon", bookedDate: D_MINUS2 },
  { id: "a23", appointmentNo: "APT-023", patientId: "p3",  patientName: "Ravi Shankar",   uhid: "UH-2025-0003", phone: "9876500003", patientCategory: "IP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_MINUS2, time: "08:00", type: "Review",    status: "Completed",   reason: "Post angioplasty round",              bookedBy: "Priya Menon", bookedDate: D_MINUS2 },
  // ── Tomorrow ──
  { id: "a24", appointmentNo: "APT-024", patientId: "p1",  patientName: "Suresh Kumar",   uhid: "UH-2025-0001", phone: "9876500001", patientCategory: "OP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_PLUS1, time: "09:00", type: "Follow-up", status: "Scheduled",   reason: "BP and cholesterol review",          bookedBy: "Dr. Venkatesan R", bookedDate: TODAY },
  { id: "a25", appointmentNo: "APT-025", patientId: "p6",  patientName: "Lakshmi N",      uhid: "UH-2025-0006", phone: "9876500006", patientCategory: "OP", doctorId: "doc7", doctorName: "Dr. Anitha Rao",    department: "Dermatology",   date: D_PLUS1, time: "10:00", type: "Follow-up", status: "Scheduled",   reason: "Eczema medication review",           bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a26", appointmentNo: "APT-026", patientId: "p10", patientName: "Sangeetha M",    uhid: "UH-2025-0010", phone: "9876500010", patientCategory: "OP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: D_PLUS1, time: "11:30", type: "Review",    status: "Scheduled",   reason: "Ante-natal check week 28",           bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a27", appointmentNo: "APT-027", patientId: "p8",  patientName: "Kavitha R",      uhid: "UH-2025-0008", phone: "9876500008", patientCategory: "OP", doctorId: "doc2", doctorName: "Dr. Sathish Kumar", department: "Neurology",     date: D_PLUS1, time: "14:00", type: "New",       status: "Confirmed",   reason: "Migraine evaluation",                bookedBy: "Rajan K",          bookedDate: TODAY },
  { id: "a28", appointmentNo: "APT-028", patientId: "p2",  patientName: "Meena Devi",     uhid: "UH-2025-0002", phone: "9876500002", patientCategory: "IP", doctorId: "doc4", doctorName: "Dr. Lakshmi Priya", department: "Gynecology",    date: D_PLUS1, time: "08:30", type: "Review",    status: "Scheduled",   reason: "Ante-natal morning round",           bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a29", appointmentNo: "APT-029", patientId: "p5",  patientName: "Karthik S",      uhid: "UH-2025-0005", phone: "9876500005", patientCategory: "IP", doctorId: "doc2", doctorName: "Dr. Sathish Kumar", department: "Neurology",     date: D_PLUS1, time: "09:00", type: "Review",    status: "Scheduled",   reason: "Neuro post-stroke evening round",    bookedBy: "Priya Menon",      bookedDate: TODAY },
  // ── Day after tomorrow ──
  { id: "a30", appointmentNo: "APT-030", patientId: "p4",  patientName: "Priya Kumari",   uhid: "UH-2025-0004", phone: "9876500004", patientCategory: "OP", doctorId: "doc5", doctorName: "Dr. Arjun Nair",    department: "Pediatrics",    date: D_PLUS2, time: "10:00", type: "Follow-up", status: "Scheduled",   reason: "Post vaccination review",            bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a31", appointmentNo: "APT-031", patientId: "p7",  patientName: "Murugesan P",    uhid: "UH-2025-0007", phone: "9876500007", patientCategory: "OP", doctorId: "doc3", doctorName: "Dr. Ramesh Babu",   department: "Orthopedics",   date: D_PLUS2, time: "11:00", type: "Review",    status: "Confirmed",   reason: "Knee replacement post-op review",    bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a32", appointmentNo: "APT-032", patientId: "p9",  patientName: "Balamurugan T",  uhid: "UH-2025-0009", phone: "9876500009", patientCategory: "OP", doctorId: "doc6", doctorName: "Dr. Murugan S",     department: "General Surgery",date: D_PLUS2, time: "09:30", type: "New",       status: "Scheduled",   reason: "Annual health check-up",             bookedBy: "Rajan K",          bookedDate: TODAY },
  { id: "a33", appointmentNo: "APT-033", patientId: "p3",  patientName: "Ravi Shankar",   uhid: "UH-2025-0003", phone: "9876500003", patientCategory: "IP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_PLUS2, time: "08:00", type: "Review",    status: "Scheduled",   reason: "Post angioplasty morning round",     bookedBy: "Priya Menon",      bookedDate: TODAY },
  // ── Next week ──
  { id: "a8",  appointmentNo: "APT-008", patientId: "p1",  patientName: "Suresh Kumar",   uhid: "UH-2025-0001", phone: "9876500001", patientCategory: "OP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_PLUS7,  time: "09:00", type: "Review",    status: "Scheduled",   reason: "Follow-up ECG review",  originalVisitDate: TODAY, bookedBy: "Dr. Venkatesan R", bookedDate: TODAY },
  { id: "a34", appointmentNo: "APT-034", patientId: "p6",  patientName: "Lakshmi N",      uhid: "UH-2025-0006", phone: "9876500006", patientCategory: "OP", doctorId: "doc9", doctorName: "Dr. Meena Kumari",  department: "Ophthalmology", date: D_PLUS8,  time: "10:00", type: "New",       status: "Scheduled",   reason: "Vision correction consult",          bookedBy: "Rajan K",          bookedDate: TODAY },
  { id: "a35", appointmentNo: "APT-035", patientId: "p10", patientName: "Sangeetha M",    uhid: "UH-2025-0010", phone: "9876500010", patientCategory: "OP", doctorId: "doc8", doctorName: "Dr. Selvan P",      department: "ENT",           date: D_PLUS9,  time: "11:00", type: "Follow-up", status: "Scheduled",   reason: "Ear discharge follow-up",            bookedBy: "Priya Menon",      bookedDate: TODAY },
  { id: "a36", appointmentNo: "APT-036", patientId: "p8",  patientName: "Kavitha R",      uhid: "UH-2025-0008", phone: "9876500008", patientCategory: "OP", doctorId: "doc1", doctorName: "Dr. Venkatesan R",  department: "Cardiology",    date: D_PLUS10, time: "09:30", type: "New",       status: "Scheduled",   reason: "Palpitations and breathlessness",    bookedBy: "Priya Menon",      bookedDate: TODAY },
];

let _appointments: Appointment[] = [...APPOINTMENTS];
let _aptCounter = APPOINTMENTS.length + 1;

function generateAptNo(): string {
  return `APT-${String(_aptCounter++).padStart(3, "0")}`;
}

export function getAppointments(): Appointment[] { return _appointments; }
export function getAppointmentById(id: string) { return _appointments.find((a) => a.id === id); }
export function getAppointmentsByDoctor(doctorId: string) { return _appointments.filter((a) => a.doctorId === doctorId); }
export function getAppointmentsByPatient(patientId: string) { return _appointments.filter((a) => a.patientId === patientId); }

export function addAppointment(data: Omit<Appointment, "id" | "appointmentNo">): Appointment {
  const a: Appointment = { ...data, id: `apt${Date.now()}`, appointmentNo: generateAptNo() };
  _appointments = [a, ..._appointments];
  return a;
}

export function updateAppointment(id: string, data: Partial<Appointment>): Appointment | null {
  const i = _appointments.findIndex((a) => a.id === id);
  if (i === -1) return null;
  _appointments[i] = { ..._appointments[i], ...data };
  return _appointments[i];
}

export function confirmAppointment(id: string): Appointment | null {
  return updateAppointment(id, { status: "Confirmed" });
}

export function cancelAppointment(id: string, reason: string): Appointment | null {
  return updateAppointment(id, { status: "Cancelled", cancelReason: reason });
}

export function markNoShow(id: string): Appointment | null {
  return updateAppointment(id, { status: "No Show" });
}

export function completeAppointment(id: string, notes?: string): Appointment | null {
  return updateAppointment(id, { status: "Completed", ...(notes ? { notes } : {}) });
}

export function issueTokenFromAppointment(id: string, issuedBy: string): Appointment | null {
  const a = _appointments.find((x) => x.id === id);
  if (!a) return null;
  const tokenNo = _appointments.filter((x) => x.doctorId === a.doctorId && x.date === a.date && x.tokenNo).length + 1;
  return updateAppointment(id, { status: "In Progress", tokenNo });
}

export function markSmsSent(ids: string[]): void {
  ids.forEach((id) => updateAppointment(id, { smsSent: true }));
}
