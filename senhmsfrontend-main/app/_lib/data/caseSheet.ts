import type { DoctorObservation, Medication, VitalSign } from "../types";

// ─── Doctor Observations ──────────────────────────────────────────────────────

const OBSERVATIONS: DoctorObservation[] = [
  {
    id: "obs1", patientId: "p3",
    date: "2025-06-08", time: "03:00",
    doctorName: "Dr. Venkatesan R",
    type: "Consultation",
    chiefComplaint: "Severe chest pain radiating to left arm, diaphoresis",
    clinicalFindings: "BP: 160/100 mmHg, Pulse: 110/min irregular. ECG: ST elevation in leads II, III, aVF. Troponin elevated.",
    diagnosis: "Acute Inferior Wall Myocardial Infarction (STEMI)",
    plan: "Thrombolysis with streptokinase, anticoagulation, monitor vitals every 30 min, ICU care",
    notes: "Emergency admitted. Family informed. Consent obtained for thrombolysis.",
    createdBy: "Dr. Venkatesan R",
  },
  {
    id: "obs2", patientId: "p3",
    date: "2025-06-09", time: "08:00",
    doctorName: "Dr. Venkatesan R",
    type: "Round",
    chiefComplaint: "Follow-up post thrombolysis",
    clinicalFindings: "BP: 130/85 mmHg, Pulse: 88/min regular. Chest pain resolved. Troponin trending down.",
    diagnosis: "Post-STEMI recovery — improving",
    plan: "Continue anticoagulation. Add aspirin 75mg + clopidogrel 75mg. ECG repeat in 6 hours.",
    createdBy: "Dr. Venkatesan R",
  },
  {
    id: "obs3", patientId: "p5",
    date: "2025-06-11", time: "15:30",
    doctorName: "Dr. Murugan S",
    type: "Consultation",
    chiefComplaint: "Severe right iliac fossa pain, nausea, vomiting",
    clinicalFindings: "Tenderness at McBurney's point, Rovsing's sign positive. WBC elevated. USG: appendix dilated 8mm.",
    diagnosis: "Acute Appendicitis",
    plan: "Emergency appendectomy scheduled for tonight. NPO, IV antibiotics started, consent taken.",
    createdBy: "Dr. Murugan S",
  },
  {
    id: "obs4", patientId: "p5",
    date: "2025-06-12", time: "10:00",
    doctorName: "Dr. Murugan S",
    type: "Post-Op",
    chiefComplaint: "Post appendectomy check",
    clinicalFindings: "Afebrile, abdomen soft, wound dry and clean. Bowel sounds present.",
    diagnosis: "Post-laparoscopic appendectomy — uncomplicated",
    plan: "Start sips, progress diet. Continue IV antibiotics for 48h, then switch to oral. Wound review in 2 days.",
    createdBy: "Dr. Murugan S",
  },
  {
    id: "obs5", patientId: "p7",
    date: "2025-06-09", time: "08:30",
    doctorName: "Dr. Sathish Kumar",
    type: "Consultation",
    chiefComplaint: "Sudden onset right sided weakness, speech difficulty, dizziness",
    clinicalFindings: "NIHSS score 14. Right hemiplegia, dysarthria. CT head: no hemorrhage. MRI: left MCA territory infarct.",
    diagnosis: "Acute Ischemic Stroke — Left MCA territory",
    plan: "IV thrombolysis (tPA) administered. Antiplatelet therapy, HDU monitoring, physiotherapy referral.",
    notes: "Onset within 4h, eligible for thrombolysis. Family counselled about prognosis.",
    createdBy: "Dr. Sathish Kumar",
  },
  {
    id: "obs6", patientId: "p7",
    date: "2025-06-11", time: "09:00",
    doctorName: "Dr. Sathish Kumar",
    type: "Round",
    chiefComplaint: "Monitoring post thrombolysis",
    clinicalFindings: "NIHSS score improved to 8. Mild right hand grip noted. Speech clearer. BP controlled at 140/90.",
    diagnosis: "Improving ischemic stroke",
    plan: "Continue antiplatelets, statin, antihypertensives. Increase physiotherapy sessions. Swallowing assessment.",
    createdBy: "Dr. Sathish Kumar",
  },
];

let _observations: DoctorObservation[] = [...OBSERVATIONS];

export function getObservationsByPatient(patientId: string) {
  return _observations
    .filter(o => o.patientId === patientId)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

export function addObservation(data: Omit<DoctorObservation, "id">): DoctorObservation {
  const obs: DoctorObservation = {
    ...data,
    id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  _observations = [obs, ..._observations];
  return obs;
}

// ─── Medications ──────────────────────────────────────────────────────────────

const MEDICATIONS: Medication[] = [
  {
    id: "med1", patientId: "p3",
    date: "2025-06-08", time: "03:30",
    prescribedBy: "Dr. Venkatesan R",
    drugName: "Streptokinase", dosage: "1.5 MU", frequency: "Single dose",
    route: "IV", duration: "1 hour infusion",
    instructions: "Dilute in 100ml NS. Monitor for bleeding.",
    status: "Completed",
  },
  {
    id: "med2", patientId: "p3",
    date: "2025-06-08", time: "03:30",
    prescribedBy: "Dr. Venkatesan R",
    drugName: "Heparin", dosage: "5000 IU loading, 1000 IU/hr maintenance",
    frequency: "Continuous infusion", route: "IV", duration: "48 hours",
    instructions: "Monitor APTT every 6 hours",
    status: "Completed",
  },
  {
    id: "med3", patientId: "p3",
    date: "2025-06-09", time: "08:30",
    prescribedBy: "Dr. Venkatesan R",
    drugName: "Aspirin", dosage: "75mg",
    frequency: "Once daily", route: "Oral", duration: "Lifelong",
    instructions: "After food",
    status: "Active",
  },
  {
    id: "med4", patientId: "p3",
    date: "2025-06-09", time: "08:30",
    prescribedBy: "Dr. Venkatesan R",
    drugName: "Clopidogrel", dosage: "75mg",
    frequency: "Once daily", route: "Oral", duration: "12 months",
    instructions: "After food",
    status: "Active",
  },
  {
    id: "med5", patientId: "p5",
    date: "2025-06-11", time: "16:00",
    prescribedBy: "Dr. Murugan S",
    drugName: "Ceftriaxone", dosage: "1g",
    frequency: "Every 12 hours", route: "IV", duration: "48 hours pre + post op",
    status: "Active",
  },
  {
    id: "med6", patientId: "p5",
    date: "2025-06-11", time: "16:00",
    prescribedBy: "Dr. Murugan S",
    drugName: "Metronidazole", dosage: "500mg",
    frequency: "Every 8 hours", route: "IV", duration: "48 hours",
    status: "Active",
  },
  {
    id: "med7", patientId: "p7",
    date: "2025-06-09", time: "09:00",
    prescribedBy: "Dr. Sathish Kumar",
    drugName: "Alteplase (tPA)", dosage: "0.9 mg/kg (max 90mg)",
    frequency: "Single dose", route: "IV", duration: "1 hour infusion",
    instructions: "10% as bolus over 1 min, rest over 60 min",
    status: "Completed",
  },
  {
    id: "med8", patientId: "p7",
    date: "2025-06-09", time: "10:00",
    prescribedBy: "Dr. Sathish Kumar",
    drugName: "Aspirin", dosage: "150mg",
    frequency: "Once daily", route: "Oral", duration: "Ongoing",
    instructions: "After food. Start 24h post tPA.",
    status: "Active",
  },
  {
    id: "med9", patientId: "p7",
    date: "2025-06-09", time: "10:00",
    prescribedBy: "Dr. Sathish Kumar",
    drugName: "Atorvastatin", dosage: "40mg",
    frequency: "Once daily at bedtime", route: "Oral", duration: "Ongoing",
    status: "Active",
  },
];

let _medications: Medication[] = [...MEDICATIONS];

export function getMedicationsByPatient(patientId: string) {
  return _medications.filter(m => m.patientId === patientId)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

export function addMedication(data: Omit<Medication, "id">): Medication {
  const med: Medication = {
    ...data,
    id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  _medications = [med, ..._medications];
  return med;
}

export function stopMedication(id: string, reason: string): Medication | null {
  const i = _medications.findIndex(m => m.id === id);
  if (i === -1) return null;
  _medications[i] = {
    ..._medications[i],
    status: "Stopped",
    stoppedOn: new Date().toISOString().slice(0, 10),
    stoppedReason: reason,
  };
  return _medications[i];
}

// ─── Vital Signs ─────────────────────────────────────────────────────────────

const VITALS: VitalSign[] = [
  {
    id: "v1", patientId: "p3",
    recordedAt: "2025-06-08T02:30:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "160/100", pulse: 110, temperature: 98.6, spo2: 96, respiratoryRate: 22,
  },
  {
    id: "v2", patientId: "p3",
    recordedAt: "2025-06-08T06:30:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "145/92", pulse: 98, temperature: 99.1, spo2: 97, respiratoryRate: 20,
  },
  {
    id: "v3", patientId: "p3",
    recordedAt: "2025-06-08T14:30:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "132/85", pulse: 88, temperature: 98.8, spo2: 98, respiratoryRate: 18,
  },
  {
    id: "v4", patientId: "p3",
    recordedAt: "2025-06-09T08:00:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "128/82", pulse: 82, temperature: 98.4, spo2: 99, respiratoryRate: 16,
  },
  {
    id: "v5", patientId: "p5",
    recordedAt: "2025-06-11T15:00:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "118/78", pulse: 94, temperature: 100.2, spo2: 98, respiratoryRate: 20,
  },
  {
    id: "v6", patientId: "p5",
    recordedAt: "2025-06-12T08:00:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "120/80", pulse: 80, temperature: 98.6, spo2: 99, respiratoryRate: 16,
  },
  {
    id: "v7", patientId: "p7",
    recordedAt: "2025-06-09T07:30:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "180/105", pulse: 96, temperature: 99.0, spo2: 97, respiratoryRate: 18,
  },
  {
    id: "v8", patientId: "p7",
    recordedAt: "2025-06-09T14:00:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "155/95", pulse: 88, temperature: 98.8, spo2: 98, respiratoryRate: 16,
  },
  {
    id: "v9", patientId: "p7",
    recordedAt: "2025-06-11T09:00:00",
    recordedBy: "Deepa Suresh",
    bloodPressure: "142/88", pulse: 82, temperature: 98.4, spo2: 99, respiratoryRate: 15,
  },
];

let _vitals: VitalSign[] = [...VITALS];

export function getVitalsByPatient(patientId: string) {
  return _vitals
    .filter(v => v.patientId === patientId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function addVital(data: Omit<VitalSign, "id">): VitalSign {
  const vital: VitalSign = {
    ...data,
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  _vitals = [vital, ..._vitals];
  return vital;
}
