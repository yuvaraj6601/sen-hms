import type { Contact, Doctor } from "../types";

export const CONTACTS: Contact[] = [
  { id: "c1", name: "MediSupply Co.", type: "Vendor", phone: "044-28001001", email: "sales@medisupply.com", organization: "MediSupply Co.", address: "100, Industrial Estate, Chennai", area: "Industrial Estate", district: "Chennai" },
  { id: "c2", name: "Dr. Srinivasan", type: "Doctor", phone: "9841002001", email: "srini@clinic.com", organization: "Srinivasan Clinic", address: "45, Nungambakkam, Chennai", area: "Nungambakkam", district: "Chennai", notes: "Referring doctor" },
  { id: "c3", name: "Medi Assist TPA", type: "Insurance", phone: "1800-425-9090", email: "claims@mediassist.in", organization: "Medi Assist India", address: "Bangalore", area: "Bangalore Central", district: "Bangalore", notes: "TPA for Star Health" },
];

let _contacts: Contact[] = [...CONTACTS];

export function getContacts(): Contact[] { return _contacts; }
export function getContactById(id: string) { return _contacts.find((c) => c.id === id); }

export function addContact(data: Omit<Contact, "id">): Contact {
  const c: Contact = { ...data, id: `c${Date.now()}` };
  _contacts = [c, ..._contacts];
  return c;
}

export function updateContact(id: string, data: Partial<Contact>): Contact | null {
  const i = _contacts.findIndex((c) => c.id === id);
  if (i === -1) return null;
  _contacts[i] = { ..._contacts[i], ...data };
  return _contacts[i];
}

export function deleteContact(id: string): void {
  _contacts = _contacts.filter((c) => c.id !== id);
}

// ─── Doctor → Contact sync ────────────────────────────────────────────────────
const _doctorContactMap = new Map<string, string>(); // doctorId → contactId

export function syncDoctorToContact(doctor: Doctor): void {
  const existingContactId = _doctorContactMap.get(doctor.id);
  const contactData: Omit<Contact, "id"> = {
    name: doctor.name,
    type: "Doctor",
    phone: doctor.phone,
    email: doctor.email,
    organization: `${doctor.department} – Sen Hospital`,
    address: "",
    area: "",
    district: "",
    notes: [
      doctor.specializations.join(", "),
      doctor.qualification.join(", "),
      `Reg: ${doctor.registrationNo}`,
    ].filter(Boolean).join(" | "),
  };

  if (existingContactId) {
    updateContact(existingContactId, contactData);
  } else {
    const c = addContact(contactData);
    _doctorContactMap.set(doctor.id, c.id);
  }
}
