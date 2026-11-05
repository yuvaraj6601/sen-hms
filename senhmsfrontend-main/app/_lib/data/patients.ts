import type { Patient, StatusUpdate } from "../types";
import { updateBedStatus } from "./wardsBeds";

export const PATIENTS: Patient[] = [
  {
    id: "p1", uhid: "UH-2025-0001", name: "Suresh Kumar", dob: "1980-03-15", age: 45,
    gender: "Male", religion: "Hindu", bloodGroup: "B+", maritalStatus: "Married",
    phone: "9876500001", email: "suresh@gmail.com",
    address: "12, Anna Nagar, Chennai", area: "Anna Nagar", district: "Chennai",
    illness: "Chest pain, hypertension follow-up", referrer: "Self",
    doctor: "Dr. Venkatesan R", department: "Cardiology",
    type: "OP", status: "Active", visitType: "Review",
    registrationDate: "2025-01-10", statusHistory: [], createdBy: "Priya Menon",
  },
  {
    id: "p2", uhid: "UH-2025-0002", name: "Meena Devi", dob: "1993-07-22", age: 32,
    gender: "Female", religion: "Hindu", bloodGroup: "A+", maritalStatus: "Married",
    phone: "9876500002", email: "meena@gmail.com",
    address: "45, T Nagar, Chennai", area: "T Nagar", district: "Chennai",
    illness: "Ante-natal care – 32 weeks", referrer: "Dr. Sathish Kumar",
    doctor: "Dr. Lakshmi Priya", department: "Gynecology",
    type: "IP", status: "Admitted", admittedDate: "2025-06-10",
    admissionType: "Maternity", ward: "General Ward", wardId: "w3",
    bedNumber: "GW-05", bedId: "bgw5", condition: "Stable",
    registrationDate: "2025-06-10",
    statusHistory: [
      { updatedAt: "2025-06-10T09:00:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "status", from: "Active", to: "Admitted", notes: "Admitted for ante-natal care" },
      { updatedAt: "2025-06-10T09:30:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "bed", from: "-", to: "GW-05 (General Ward)", notes: "Bed assigned" },
    ],
    createdBy: "Priya Menon",
  },
  {
    id: "p3", uhid: "UH-2025-0003", name: "Ravi Shankar", dob: "1967-11-08", age: 58,
    gender: "Male", religion: "Hindu", bloodGroup: "O+", maritalStatus: "Married",
    phone: "9876500003", email: "",
    address: "78, Adyar, Chennai", area: "Adyar", district: "Chennai",
    illness: "Acute myocardial infarction", referrer: "Self",
    doctor: "Dr. Venkatesan R", department: "Cardiology",
    type: "IP", status: "Admitted", admittedDate: "2025-06-08",
    admissionType: "Emergency", ward: "ICU", wardId: "w1",
    bedNumber: "ICU-02", bedId: "b2", condition: "Critical",
    insuranceCompany: "Star Health", insurancePolicyNo: "SH-2024-98765",
    registrationDate: "2025-06-08",
    statusHistory: [
      { updatedAt: "2025-06-08T02:15:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "status", from: "-", to: "Admitted", notes: "Emergency admission" },
      { updatedAt: "2025-06-08T03:00:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "bed", from: "-", to: "ICU-02 (ICU)", notes: "Assigned ICU bed" },
      { updatedAt: "2025-06-09T08:00:00", updatedBy: "Dr. Venkatesan R", updatedByRole: "Doctor", field: "condition", from: "Serious", to: "Critical", notes: "Post angioplasty monitoring" },
    ],
    createdBy: "Priya Menon",
  },
  {
    id: "p4", uhid: "UH-2025-0004", name: "Priya Kumari", dob: "1997-05-30", age: 28,
    gender: "Female", religion: "Christian", bloodGroup: "AB+", maritalStatus: "Single",
    phone: "9876500004", email: "priya@gmail.com",
    address: "23, Velachery, Chennai", area: "Velachery", district: "Chennai",
    illness: "Child vaccination – 18 months", referrer: "Self",
    doctor: "Dr. Arjun Nair", department: "Pediatrics",
    type: "OP", status: "Active", visitType: "Follow-up",
    registrationDate: "2025-06-12", statusHistory: [], createdBy: "Priya Menon",
  },
  {
    id: "p5", uhid: "UH-2025-0005", name: "Karthik S", dob: "1990-09-14", age: 35,
    gender: "Male", religion: "Hindu", bloodGroup: "B-", maritalStatus: "Married",
    phone: "9876500005", email: "karthik@gmail.com",
    address: "56, Tambaram, Chennai", area: "Tambaram", district: "Chennai",
    illness: "Acute appendicitis", referrer: "Dr. Ramesh Babu",
    doctor: "Dr. Murugan S", department: "General Surgery",
    type: "IP", status: "Admitted", admittedDate: "2025-06-11",
    admissionType: "Emergency", ward: "General Ward", wardId: "w3",
    bedNumber: "GW-12", bedId: "bgw12", condition: "Stable",
    registrationDate: "2025-06-11",
    statusHistory: [
      { updatedAt: "2025-06-11T14:00:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "status", from: "-", to: "Admitted", notes: "Admitted for appendectomy" },
      { updatedAt: "2025-06-12T10:00:00", updatedBy: "Dr. Murugan S", updatedByRole: "Doctor", field: "condition", from: "Serious", to: "Stable", notes: "Post-op recovery good" },
    ],
    createdBy: "Priya Menon",
  },
  {
    id: "p6", uhid: "UH-2025-0006", name: "Lakshmi N", dob: "1973-02-18", age: 52,
    gender: "Female", religion: "Hindu", bloodGroup: "A-", maritalStatus: "Married",
    phone: "9876500006", email: "",
    address: "89, Porur, Chennai", area: "Porur", district: "Chennai",
    illness: "Chronic skin rash – eczema", referrer: "Self",
    doctor: "Dr. Anitha Rao", department: "Dermatology",
    type: "OP", status: "Active", visitType: "New",
    registrationDate: "2025-06-14", statusHistory: [], createdBy: "Priya Menon",
  },
  {
    id: "p7", uhid: "UH-2025-0007", name: "Murugesan P", dob: "1958-04-25", age: 67,
    gender: "Male", religion: "Hindu", bloodGroup: "O-", maritalStatus: "Married",
    phone: "9876500007", email: "",
    address: "34, Chromepet, Chennai", area: "Chromepet", district: "Chennai",
    illness: "Ischemic stroke – right sided weakness", referrer: "Dr. Selvan P",
    doctor: "Dr. Sathish Kumar", department: "Neurology",
    type: "IP", status: "Admitted", admittedDate: "2025-06-09",
    admissionType: "Emergency", ward: "HDU", wardId: "w2",
    bedNumber: "HDU-03", bedId: "b12", condition: "Under Observation",
    insuranceCompany: "New India", insurancePolicyNo: "NIA-2024-11223",
    registrationDate: "2025-06-09",
    statusHistory: [
      { updatedAt: "2025-06-09T07:30:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "status", from: "-", to: "Admitted", notes: "Emergency – stroke" },
      { updatedAt: "2025-06-09T08:00:00", updatedBy: "Deepa Suresh", updatedByRole: "Nurse", field: "bed", from: "-", to: "HDU-03", notes: "HDU bed assigned" },
      { updatedAt: "2025-06-11T09:00:00", updatedBy: "Dr. Sathish Kumar", updatedByRole: "Doctor", field: "condition", from: "Critical", to: "Under Observation", notes: "Responding to thrombolysis" },
    ],
    createdBy: "Priya Menon",
  },
  {
    id: "p8", uhid: "UH-2025-0008", name: "Kavitha R", dob: "1984-12-05", age: 41,
    gender: "Female", religion: "Christian", bloodGroup: "B+", maritalStatus: "Married",
    phone: "9876500008", email: "kavitha@gmail.com",
    address: "67, Perambur, Chennai", area: "Perambur", district: "Chennai",
    illness: "Blurred vision, difficulty reading", referrer: "Self",
    doctor: "Dr. Meena Kumari", department: "Ophthalmology",
    type: "OP", status: "Active", visitType: "New",
    registrationDate: "2025-06-13", statusHistory: [], createdBy: "Priya Menon",
  },
  {
    id: "p9", uhid: "UH-2025-0009", name: "Balamurugan T", dob: "1975-06-10", age: 50,
    gender: "Male", religion: "Hindu", bloodGroup: "A+", maritalStatus: "Married",
    phone: "9876500009", email: "",
    address: "12, Guindy, Chennai", area: "Guindy", district: "Chennai",
    illness: "Fracture – right femur", referrer: "Self",
    doctor: "Dr. Ramesh Babu", department: "Orthopedics",
    type: "IP", status: "Discharged", admittedDate: "2025-06-01",
    admissionType: "Emergency", ward: "General Ward", wardId: "w3",
    bedNumber: "GW-08", bedId: "bgw8", condition: "Stable",
    dischargedDate: "2025-06-10", dischargeType: "Normal",
    finalDiagnosis: "Right femur fracture – post ORIF surgery",
    registrationDate: "2025-06-01",
    statusHistory: [
      { updatedAt: "2025-06-01T11:00:00", updatedBy: "Priya Menon", updatedByRole: "Receptionist", field: "status", from: "-", to: "Admitted", notes: "Road traffic accident" },
      { updatedAt: "2025-06-10T12:00:00", updatedBy: "Dr. Ramesh Babu", updatedByRole: "Doctor", field: "status", from: "Admitted", to: "Discharged", notes: "Recovery complete" },
    ],
    createdBy: "Priya Menon",
  },
  {
    id: "p10", uhid: "UH-2025-0010", name: "Sangeetha M", dob: "1996-08-19", age: 29,
    gender: "Female", religion: "Hindu", bloodGroup: "O+", maritalStatus: "Single",
    phone: "9876500010", email: "sangeetha@gmail.com",
    address: "90, Kodambakkam, Chennai", area: "Kodambakkam", district: "Chennai",
    illness: "Child fever and cold – 3 days", referrer: "Self",
    doctor: "Dr. Arjun Nair", department: "Pediatrics",
    type: "OP", status: "Active", visitType: "New",
    registrationDate: "2025-06-15", statusHistory: [], createdBy: "Priya Menon",
  },
];

let _patients: Patient[] = [...PATIENTS];
let _uhidCounter = 11;

function generateUhid(): string {
  return `UH-2025-${String(_uhidCounter++).padStart(4, "0")}`;
}

let _admissionCounter = 1;
function generateAdmissionNo(): string {
  return `ADM-${new Date().getFullYear()}-${String(_admissionCounter++).padStart(4, "0")}`;
}

export function getPatients(): Patient[] { return _patients; }
export function getPatientById(id: string): Patient | undefined { return _patients.find((p) => p.id === id); }
export function getPatientByUhid(uhid: string): Patient | undefined { return _patients.find((p) => p.uhid === uhid); }

export function updatePatient(id: string, updates: Partial<Patient>): Patient | null {
  const idx = _patients.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  _patients[idx] = { ..._patients[idx], ...updates };
  return _patients[idx];
}

export function addStatusUpdate(patientId: string, update: StatusUpdate): Patient | null {
  const idx = _patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;
  _patients[idx] = {
    ..._patients[idx],
    statusHistory: [..._patients[idx].statusHistory, update],
    lastUpdatedBy: update.updatedBy,
  };
  return _patients[idx];
}

export interface AdmitPatientData {
  admissionType: Patient["admissionType"];
  wardId: string;
  ward: string;
  bedId: string;
  bedNumber: string;
  admittedDate: string;
  admittedTime: string;
  provisionalDiagnosis?: string;
  condition: Patient["condition"];
  mlc?: boolean;
  mlcNumber?: string;
  paymentMode?: Patient["paymentMode"];
  insuranceCompany?: string;
  insurancePolicyNo?: string;
  tpaName?: string;
  preAuthNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  doctor?: string;
  department?: string;
  notes?: string;
  admittedBy: string;
  admittedByRole: string;
}

export function admitOPPatient(patientId: string, data: AdmitPatientData): Patient | null {
  const idx = _patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;
  const patient = _patients[idx];
  const admissionNo = generateAdmissionNo();

  // Mark bed occupied in wardsBeds store (single source of truth)
  updateBedStatus(data.bedId, "Occupied", patientId, patient.name, data.admittedDate);

  _patients[idx] = {
    ..._patients[idx],
    type: "IP", status: "Admitted", admissionNo,
    admittedDate: data.admittedDate, admittedTime: data.admittedTime,
    admissionType: data.admissionType,
    wardId: data.wardId, ward: data.ward,
    bedId: data.bedId, bedNumber: data.bedNumber,
    condition: data.condition,
    provisionalDiagnosis: data.provisionalDiagnosis,
    mlc: data.mlc, mlcNumber: data.mlcNumber,
    paymentMode: data.paymentMode,
    insuranceCompany: data.insuranceCompany,
    insurancePolicyNo: data.insurancePolicyNo,
    tpaName: data.tpaName, preAuthNumber: data.preAuthNumber,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactRelation: data.emergencyContactRelation,
    ...(data.doctor ? { doctor: data.doctor } : {}),
    ...(data.department ? { department: data.department } : {}),
    lastUpdatedBy: data.admittedBy,
    statusHistory: [
      ..._patients[idx].statusHistory,
      {
        updatedAt: new Date().toISOString(),
        updatedBy: data.admittedBy,
        updatedByRole: data.admittedByRole,
        field: "status",
        from: "Active (OP)",
        to: `Admitted — ${data.ward} / ${data.bedNumber}`,
        notes: data.notes || `Admission No: ${admissionNo}`,
      },
    ],
  };
  return _patients[idx];
}

export function addPatient(data: Omit<Patient, "id" | "uhid" | "statusHistory">): Patient {
  const admissionNo = data.type === "IP" ? generateAdmissionNo() : undefined;
  const newPatient: Patient = {
    ...data,
    id: `p${Date.now()}`,
    uhid: generateUhid(),
    admissionNo,
    statusHistory: [{
      updatedAt: new Date().toISOString(),
      updatedBy: data.createdBy,
      updatedByRole: "Receptionist",
      field: "status",
      from: "-",
      to: data.status,
      notes: data.type === "IP" ? `Direct IP admission — ${admissionNo}` : "Patient registered",
    }],
  };
  // Mark bed occupied when directly registering as IP
  if (data.type === "IP" && data.bedId) {
    updateBedStatus(data.bedId, "Occupied", newPatient.id, newPatient.name, data.admittedDate);
  }
  _patients = [newPatient, ..._patients];
  return newPatient;
}
