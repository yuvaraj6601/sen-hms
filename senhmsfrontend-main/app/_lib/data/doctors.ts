import type { Doctor } from "../types";
import { syncDoctorToContact } from "./contacts";

export const DOCTORS: Doctor[] = [
  {
    id: "doc1", name: "Dr. Venkatesan R", dob: "1975-04-12", gender: "Male",
    qualification: ["MBBS", "MD (Internal Medicine)", "DM Cardiology"],
    specializations: ["Cardiologist", "Interventional Cardiology", "Heart Failure"],
    department: "Cardiology", phone: "9841001001", email: "venkat@senhospital.com",
    experience: 18, opdFee: 500, opdDays: ["Mon", "Wed", "Fri"],
    opdStartTime: "09:00", opdEndTime: "13:00", avgConsultMins: 15,
    registrationNo: "TN-MCI-12345", status: "Active",
    illnessTags: ["chest pain", "heart attack", "hypertension", "palpitations", "shortness of breath", "angina", "ecg", "myocardial infarction", "cardiac"],
    bio: "Senior cardiologist with expertise in interventional procedures and heart failure management.",
  },
  {
    id: "doc2", name: "Dr. Sathish Kumar", dob: "1979-08-23", gender: "Male",
    qualification: ["MBBS", "MD (Medicine)", "DM Neurology"],
    specializations: ["Neurologist", "Stroke", "Epilepsy"],
    department: "Neurology", phone: "9841001002", email: "sathish@senhospital.com",
    experience: 14, opdFee: 600, opdDays: ["Tue", "Thu", "Sat"],
    opdStartTime: "10:00", opdEndTime: "14:00", avgConsultMins: 20,
    registrationNo: "TN-MCI-23456", status: "Active",
    illnessTags: ["headache", "stroke", "seizure", "epilepsy", "memory loss", "dizziness", "numbness", "tremor", "paralysis", "migraine", "nerve"],
    bio: "Neurologist specializing in stroke management, epilepsy and movement disorders.",
  },
  {
    id: "doc3", name: "Dr. Ramesh Babu", dob: "1972-01-30", gender: "Male",
    qualification: ["MBBS", "MS Orthopedics", "DNB"],
    specializations: ["Orthopedic Surgeon", "Joint Replacement", "Spine Surgery"],
    department: "Orthopedics", phone: "9841001003", email: "ramesh@senhospital.com",
    experience: 20, opdFee: 500, opdDays: ["Mon", "Tue", "Thu"],
    opdStartTime: "09:00", opdEndTime: "12:00", avgConsultMins: 15,
    registrationNo: "TN-MCI-34567", status: "Active",
    illnessTags: ["fracture", "bone pain", "joint pain", "knee pain", "back pain", "spine", "arthritis", "slip disc", "sports injury", "hip replacement"],
    bio: "Orthopedic surgeon with 20 years of experience in joint replacement and spinal surgeries.",
  },
  {
    id: "doc4", name: "Dr. Lakshmi Priya", dob: "1981-11-05", gender: "Female",
    qualification: ["MBBS", "MD Obstetrics & Gynecology", "DGO"],
    specializations: ["Gynecologist", "Obstetrician", "Infertility"],
    department: "Gynecology", phone: "9841001004", email: "lakshmi@senhospital.com",
    experience: 12, opdFee: 450, opdDays: ["Mon", "Wed", "Fri", "Sat"],
    opdStartTime: "10:00", opdEndTime: "14:00", avgConsultMins: 20,
    registrationNo: "TN-MCI-45678", status: "Active",
    illnessTags: ["pregnancy", "ante-natal", "periods", "menstruation", "ovarian", "uterus", "infertility", "delivery", "gynec", "menopause", "pcos", "vaginal"],
    bio: "Gynecologist with expertise in high-risk pregnancies, laparoscopic surgeries and infertility.",
  },
  {
    id: "doc5", name: "Dr. Arjun Nair", dob: "1984-06-18", gender: "Male",
    qualification: ["MBBS", "MD Pediatrics", "Fellowship Neonatology"],
    specializations: ["Pediatrician", "Neonatologist", "Child Development"],
    department: "Pediatrics", phone: "9841001005", email: "arjun@senhospital.com",
    experience: 10, opdFee: 400, opdDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    opdStartTime: "09:00", opdEndTime: "13:00", avgConsultMins: 15,
    registrationNo: "TN-MCI-56789", status: "Active",
    illnessTags: ["child", "baby", "infant", "vaccination", "fever child", "cold child", "cough child", "newborn", "growth", "pediatric", "toddler"],
    bio: "Pediatrician with special interest in neonatology and child developmental disorders.",
  },
  {
    id: "doc6", name: "Dr. Murugan S", dob: "1970-09-14", gender: "Male",
    qualification: ["MBBS", "MS General Surgery", "FACS"],
    specializations: ["General Surgeon", "Laparoscopic Surgery", "GI Surgery"],
    department: "General Surgery", phone: "9841001006", email: "murugan@senhospital.com",
    experience: 22, opdFee: 500, opdDays: ["Tue", "Wed", "Fri"],
    opdStartTime: "09:00", opdEndTime: "13:00", avgConsultMins: 15,
    registrationNo: "TN-MCI-67890", status: "Active",
    illnessTags: ["appendix", "appendicitis", "hernia", "gallbladder", "stomach pain", "abdominal pain", "surgery", "abscess", "colorectal", "fistula", "piles"],
    bio: "Senior general and laparoscopic surgeon with expertise in GI and colorectal surgeries.",
  },
  {
    id: "doc7", name: "Dr. Anitha Rao", dob: "1986-03-27", gender: "Female",
    qualification: ["MBBS", "MD Dermatology", "Diploma Cosmetology"],
    specializations: ["Dermatologist", "Cosmetologist", "Trichologist"],
    department: "Dermatology", phone: "9841001007", email: "anitha@senhospital.com",
    experience: 8, opdFee: 400, opdDays: ["Mon", "Thu", "Sat"],
    opdStartTime: "10:00", opdEndTime: "14:00", avgConsultMins: 10,
    registrationNo: "TN-MCI-78901", status: "Active",
    illnessTags: ["skin rash", "eczema", "psoriasis", "acne", "allergy skin", "hair loss", "dandruff", "fungal infection", "warts", "vitiligo", "itching"],
    bio: "Dermatologist specializing in medical dermatology, cosmetic procedures and hair disorders.",
  },
  {
    id: "doc8", name: "Dr. Selvan P", dob: "1978-12-10", gender: "Male",
    qualification: ["MBBS", "MS ENT", "DNB"],
    specializations: ["ENT Specialist", "Head & Neck Surgery", "Cochlear Implants"],
    department: "ENT", phone: "9841001008", email: "selvan@senhospital.com",
    experience: 15, opdFee: 450, opdDays: ["Tue", "Thu"],
    opdStartTime: "09:00", opdEndTime: "13:00", avgConsultMins: 15,
    registrationNo: "TN-MCI-89012", status: "Active",
    illnessTags: ["ear pain", "hearing loss", "tonsil", "throat pain", "nose bleed", "sinusitis", "vertigo", "ear discharge", "snoring", "ENT", "tinnitus"],
    bio: "ENT surgeon with special interest in cochlear implants and head & neck oncology.",
  },
  {
    id: "doc9", name: "Dr. Meena Kumari", dob: "1982-07-04", gender: "Female",
    qualification: ["MBBS", "MS Ophthalmology", "FICO"],
    specializations: ["Ophthalmologist", "Cataract Surgery", "Retina"],
    department: "Ophthalmology", phone: "9841001009", email: "meena@senhospital.com",
    experience: 11, opdFee: 400, opdDays: ["Mon", "Wed", "Fri"],
    opdStartTime: "09:00", opdEndTime: "12:00", avgConsultMins: 10,
    registrationNo: "TN-MCI-90123", status: "Active",
    illnessTags: ["eye pain", "blurred vision", "cataract", "glaucoma", "red eye", "vision loss", "eye checkup", "retina", "spectacles", "conjunctivitis"],
    bio: "Ophthalmologist specializing in cataract surgeries, glaucoma and retinal disorders.",
  },
  {
    id: "doc10", name: "Dr. Prakash V", dob: "1973-02-20", gender: "Male",
    qualification: ["MBBS", "MD (Medicine)", "IDCCM", "EDIC"],
    specializations: ["Intensivist", "Critical Care", "Pulmonology"],
    department: "ICU", phone: "9841001010", email: "prakash@senhospital.com",
    experience: 16, opdFee: 700, opdDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    opdStartTime: "08:00", opdEndTime: "10:00", avgConsultMins: 30,
    registrationNo: "TN-MCI-01234", status: "Active",
    illnessTags: ["icu", "critical", "ventilator", "breathing difficulty", "lung", "sepsis", "unconscious", "covid", "ards", "multi-organ"],
    bio: "Intensivist with expertise in critical care, mechanical ventilation and organ support.",
  },
];

let _doctors: Doctor[] = [...DOCTORS];

export function getDoctors(): Doctor[] { return _doctors; }
export function getDoctorById(id: string) { return _doctors.find((d) => d.id === id); }

export function addDoctor(data: Omit<Doctor, "id">): Doctor {
  const d: Doctor = { ...data, id: `doc${Date.now()}` };
  _doctors = [d, ..._doctors];
  syncDoctorToContact(d);
  return d;
}

export function updateDoctor(id: string, data: Partial<Doctor>): Doctor | null {
  const i = _doctors.findIndex((d) => d.id === id);
  if (i === -1) return null;
  _doctors[i] = { ..._doctors[i], ...data };
  syncDoctorToContact(_doctors[i]);
  return _doctors[i];
}

export function getDoctorsByIllness(illness: string): Doctor[] {
  if (!illness.trim()) return [];
  const words = illness.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return [];
  const scored = _doctors
    .filter((d) => d.status === "Active")
    .map((d) => ({
      doctor: d,
      score: words.reduce((acc, word) => {
        const match = d.illnessTags.some(
          (tag) => tag.toLowerCase().includes(word) || word.includes(tag.toLowerCase())
        );
        return acc + (match ? 1 : 0);
      }, 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.doctor);
}
