import type { Department } from "../types";

export const DEPARTMENTS: Department[] = [
  { id: "d1",  deptCode: "DEPT001", name: "Cardiology",      shortName: "CARDIO",  type: "Clinical",       hasWards: true,  totalBeds: 20, floor: "2nd Floor",    head: "Dr. Venkatesan",    occupiedBeds: 14, phone: "040-1001", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d2",  deptCode: "DEPT002", name: "Neurology",       shortName: "NEURO",   type: "Clinical",       hasWards: true,  totalBeds: 15, floor: "3rd Floor",    head: "Dr. Sathish Kumar", occupiedBeds: 9,  phone: "040-1002", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d3",  deptCode: "DEPT003", name: "Orthopedics",     shortName: "ORTHO",   type: "Surgical",       hasWards: true,  totalBeds: 18, floor: "2nd Floor",    head: "Dr. Ramesh Babu",   occupiedBeds: 12, phone: "040-1003", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d4",  deptCode: "DEPT004", name: "Gynecology",      shortName: "GYNEC",   type: "Clinical",       hasWards: true,  totalBeds: 16, floor: "1st Floor",    head: "Dr. Lakshmi Priya", occupiedBeds: 11, phone: "040-1004", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d5",  deptCode: "DEPT005", name: "Pediatrics",      shortName: "PEDS",    type: "Clinical",       hasWards: true,  totalBeds: 14, floor: "1st Floor",    head: "Dr. Arjun Nair",    occupiedBeds: 8,  phone: "040-1005", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d6",  deptCode: "DEPT006", name: "General Surgery", shortName: "SURG",    type: "Surgical",       hasWards: true,  totalBeds: 22, floor: "3rd Floor",    head: "Dr. Murugan",       occupiedBeds: 17, phone: "040-1006", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d7",  deptCode: "DEPT007", name: "Dermatology",     shortName: "DERM",    type: "Clinical",       hasWards: false, totalBeds: 6,  floor: "Ground Floor", head: "Dr. Anitha Rao",    occupiedBeds: 3,  phone: "040-1007", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d8",  deptCode: "DEPT008", name: "ENT",             shortName: "ENT",     type: "Surgical",       hasWards: false, totalBeds: 8,  floor: "Ground Floor", head: "Dr. Selvan",        occupiedBeds: 5,  phone: "040-1008", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d9",  deptCode: "DEPT009", name: "Ophthalmology",   shortName: "OPHTHAL", type: "Surgical",       hasWards: false, totalBeds: 10, floor: "Ground Floor", head: "Dr. Meena Kumari",  occupiedBeds: 6,  phone: "040-1009", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d10", deptCode: "DEPT010", name: "ICU",             shortName: "ICU",     type: "Clinical",       hasWards: true,  totalBeds: 12, floor: "4th Floor",    head: "Dr. Prakash",       occupiedBeds: 10, phone: "040-1010", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d11", deptCode: "DEPT011", name: "Radiology",       shortName: "RADIO",   type: "Diagnostic",     hasWards: false,                floor: "Ground Floor", head: "—",                 occupiedBeds: 0,  phone: "040-1011", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d12", deptCode: "DEPT012", name: "Laboratory",      shortName: "LAB",     type: "Diagnostic",     hasWards: false,                floor: "Ground Floor", head: "—",                 occupiedBeds: 0,  phone: "040-1012", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "d13", deptCode: "DEPT013", name: "Administration",  shortName: "ADMIN",   type: "Administrative", hasWards: false,                floor: "Ground Floor", head: "Dr. Admin",         occupiedBeds: 0,  phone: "040-1013", status: "Active",   createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];

let _departments: Department[] = [...DEPARTMENTS];
let _deptCodeCounter = DEPARTMENTS.length + 1;

function generateDeptCode(): string {
  return `DEPT${String(_deptCodeCounter++).padStart(3, "0")}`;
}

export function getDepartments(): Department[] { return _departments; }
export function getDepartmentById(id: string) { return _departments.find((d) => d.id === id); }

export function addDepartment(data: Omit<Department, "id" | "deptCode" | "occupiedBeds">): Department {
  const d: Department = { ...data, id: `dept${Date.now()}`, deptCode: generateDeptCode(), occupiedBeds: 0 };
  _departments = [..._departments, d];
  return d;
}

export function updateDepartment(id: string, data: Partial<Department>): Department | null {
  const i = _departments.findIndex((d) => d.id === id);
  if (i === -1) return null;
  _departments[i] = { ..._departments[i], ...data };
  return _departments[i];
}

export function toggleDepartmentStatus(id: string): void {
  const i = _departments.findIndex((d) => d.id === id);
  if (i !== -1) _departments[i].status = _departments[i].status === "Active" ? "Inactive" : "Active";
}
