import type { Referrer } from "../types";

export const REFERRERS: Referrer[] = [
  { id: "ref1", name: "Dr. Srinivasan",      type: "Doctor",     specialization: "General Physician", organization: "Srinivasan Clinic",        phone: "9841002001", alternatePhone: "",             address: "45, Nungambakkam, Chennai",    status: "Active",   notes: "Long-term referral partner", totalReferrals: 42 },
  { id: "ref2", name: "Dr. Kavitha Mohan",   type: "Doctor",     specialization: "Gynecologist",      organization: "Kavitha Womens Clinic",    phone: "9841002002", alternatePhone: "044-23456789", address: "12, T Nagar, Chennai",         status: "Active",   notes: "",                           totalReferrals: 28 },
  { id: "ref3", name: "Apollo First Med",    type: "Hospital",   organization: "Apollo First Med",    phone: "044-28001234", alternatePhone: "",             address: "100, Velachery Main Rd, Chennai", status: "Active",   notes: "Refers complex cases",       totalReferrals: 15 },
  { id: "ref4", name: "Meenakshi Clinic",    type: "Clinic",     organization: "Meenakshi Clinic",    phone: "9841003001", alternatePhone: "",             address: "23, Tambaram, Chennai",        status: "Active",   notes: "",                           totalReferrals: 19 },
  { id: "ref5", name: "Mr. Rajesh Kumar",    type: "Individual",                                      phone: "9876501111", alternatePhone: "",             address: "67, Adyar, Chennai",           status: "Active",   notes: "Patient who refers family members", totalReferrals: 6 },
  { id: "ref6", name: "Dr. Anand Sharma",    type: "Doctor",     specialization: "Orthopedic",        organization: "Anand Bone & Joint Clinic", phone: "9841002003", alternatePhone: "",             address: "89, Anna Nagar, Chennai",      status: "Inactive", notes: "On leave",                   totalReferrals: 11 },
  { id: "ref7", name: "Vijaya Hospital",     type: "Hospital",   organization: "Vijaya Hospital",     phone: "044-24501234", alternatePhone: "",             address: "434, NSK Salai, Chennai",     status: "Active",   notes: "",                           totalReferrals: 8 },
  { id: "ref8", name: "LifeCare Diagnostics",type: "Clinic",     organization: "LifeCare Diagnostics",phone: "9841004001", alternatePhone: "",             address: "56, Porur, Chennai",           status: "Active",   notes: "Diagnostic centre partner",  totalReferrals: 22 },
];

let _referrers: Referrer[] = [...REFERRERS];

export function getReferrers(): Referrer[] { return _referrers; }
export function getReferrerById(id: string) { return _referrers.find((r) => r.id === id); }

export function addReferrer(data: Omit<Referrer, "id">): Referrer {
  const r: Referrer = { ...data, id: `ref${Date.now()}` };
  _referrers = [r, ..._referrers];
  return r;
}

export function updateReferrer(id: string, data: Partial<Referrer>): Referrer | null {
  const i = _referrers.findIndex((r) => r.id === id);
  if (i === -1) return null;
  _referrers[i] = { ..._referrers[i], ...data };
  return _referrers[i];
}

export function toggleReferrerStatus(id: string): void {
  const i = _referrers.findIndex((r) => r.id === id);
  if (i !== -1) _referrers[i].status = _referrers[i].status === "Active" ? "Inactive" : "Active";
}
