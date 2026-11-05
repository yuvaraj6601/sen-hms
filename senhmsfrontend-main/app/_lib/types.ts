// ─── MASTERS ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string;   // Role-prefixed: DOC-0001, RCP-0001, NRS-0001…
  name: string;
  email: string;
  password: string;     // stored plain for mock — hashed in real app
  role: "Admin" | "Doctor" | "Receptionist" | "Lab Tech" | "Insurance Coordinator" | "Nurse";
  department: string;
  phone: string;
  status: "Active" | "Inactive";
  joinedDate: string;   // YYYY-MM-DD
  createdBy: string;
  createdDate: string;  // YYYY-MM-DD
}

export interface Doctor {
  id: string;
  name: string;
  dob: string;                    // YYYY-MM-DD
  gender: "Male" | "Female" | "Other";
  qualification: string[];        // multiple e.g. ["MBBS", "MD", "DM Cardiology"]
  specializations: string[];      // multiple e.g. ["Cardiologist", "Interventional Cardiology"]
  department: string;
  phone: string;
  email: string;
  experience: number;             // years
  opdFee: number;
  opdDays: string[];
  opdStartTime: string;           // "09:00"
  opdEndTime: string;             // "13:00"
  avgConsultMins: number;         // avg minutes per consultation
  registrationNo: string;         // medical council reg no
  status: "Active" | "On Leave" | "Inactive";
  bio?: string;
  illnessTags: string[];          // keywords mapped to this doctor e.g. ["chest pain","hypertension","ECG"]
}

export interface Referrer {
  id: string;
  name: string;
  type: "Doctor" | "Hospital" | "Clinic" | "Individual" | "Other";
  specialization?: string;   // for Doctor type
  organization?: string;     // hospital/clinic name
  phone: string;
  alternatePhone?: string;
  address?: string;
  status: "Active" | "Inactive";
  notes?: string;
  totalReferrals?: number;   // derived stat
}

export interface Department {
  id: string;
  deptCode: string;           // Auto: DEPT001, DEPT002 …
  name: string;
  shortName: string;          // GM, ICU, SURG …
  type: "Clinical" | "Surgical" | "Diagnostic" | "Administrative" | "Support";
  hasWards: boolean;
  totalBeds?: number;         // optional
  floor?: string;             // optional, e.g. "Ground Floor", "2nd Floor"
  status: "Active" | "Inactive";
  // legacy / kept for backward compat with other pages
  head: string;
  occupiedBeds: number;
  phone: string;
  // audit
  createdBy: string;
  createdDate: string;        // YYYY-MM-DD
}

export interface Investigation {
  id: string;
  testCode: string;       // Auto: LAB001, LAB002 …
  name: string;
  category: string;
  price: number;
  turnaroundTime?: string; // e.g. "2 hours"
  normalRange?: string;
  unit?: string;
  sampleType?: string;    // Blood, Urine, Stool, Swab…
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;    // YYYY-MM-DD
}

export interface BillingModality {
  id: string;
  modalityCode: string;   // Auto: MOD001, MOD002 …
  name: string;
  shortName: string;      // e.g. CONS, LAB, ICU
  description: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;    // YYYY-MM-DD
}

export interface BillingMaster {
  id: string;
  serviceCode: string;      // Auto: SVC001, SVC002 …
  serviceName: string;
  modalityId: string;       // links to BillingModality.id
  modalityName: string;     // denormalised for display
  price: number;
  discountAllowed: boolean;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;      // YYYY-MM-DD
}

export interface ExpenseCategory {
  id: string;
  categoryCode: string;    // Auto: EXC001, EXC002 …
  name: string;
  description: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;     // YYYY-MM-DD
}

export interface TowardsMaster {
  id: string;
  name: string;
  type: "Credit" | "Debit";
  description: string;
  status: "Active" | "Inactive";
}

export interface Area {
  id: string;
  name: string;
  district: string;
  pincode: string;
  status: "Active" | "Inactive";
}

export interface District {
  id: string;
  name: string;
  state: string;
  status: "Active" | "Inactive";
}

export interface InsuranceCompany {
  id: string;
  companyCode: string;      // Auto: INS001, INS002 …
  name: string;
  tpaName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: "Active" | "Inactive";
  createdBy: string;
  createdDate: string;
}

export interface ICDCode {
  id: string;
  code: string;
  type: "ICD" | "PCS";
  description: string;
  category: string;
  status: "Active" | "Inactive";
}

// ─── PATIENTS ───────────────────────────────────────────────────────────────

export type PatientType = "OP" | "IP";
export type PatientStatus = "Active" | "Discharged" | "Admitted" | "Pending";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type IPCondition = "Stable" | "Critical" | "Serious" | "Under Observation" | "Improving";
export type DischargeType = "Normal" | "LAMA" | "Expired" | "Referred";
export type Religion = "Hindu" | "Muslim" | "Christian" | "Sikh" | "Buddhist" | "Jain" | "Other";

export interface StatusUpdate {
  updatedAt: string;       // ISO date-time
  updatedBy: string;       // user name
  updatedByRole: string;   // role
  field: string;           // what changed: "condition" | "ward" | "bed" | "doctor" | "status"
  from: string;
  to: string;
  notes?: string;
}

export interface Patient {
  id: string;
  uhid: string;

  // ── Basic details ──
  name: string;
  dob: string;             // YYYY-MM-DD
  age: number;             // derived from dob
  gender: "Male" | "Female" | "Other";
  religion: Religion;
  bloodGroup: BloodGroup;
  maritalStatus: "Single" | "Married" | "Widowed" | "Divorced";
  phone: string;
  alternatePhone?: string;
  email?: string;
  address: string;
  area: string;
  district: string;

  // ── Clinical ──
  illness: string;         // chief complaint / illness reason
  referrer: string;
  doctor: string;
  department: string;

  // ── Type & status ──
  type: PatientType;
  status: PatientStatus;
  registrationDate: string;

  // ── OP specific ──
  visitType?: "New" | "Review" | "Follow-up";

  // ── IP specific ──
  admittedDate?: string;
  admissionType?: "Emergency" | "Planned Treatment" | "Maternity" | "Daycare";
  ward?: string;
  wardId?: string;
  bedNumber?: string;
  bedId?: string;
  condition?: IPCondition;
  dischargedDate?: string;
  dischargeType?: DischargeType;
  finalDiagnosis?: string;

  // ── Insurance / Payment ──
  insuranceCompany?: string;
  insurancePolicyNo?: string;
  tpaName?: string;
  preAuthNumber?: string;
  paymentMode?: "Cash" | "Insurance" | "Corporate";

  // ── Admission extras ──
  admissionNo?: string;        // Auto: ADM-2026-0001
  admittedTime?: string;       // HH:MM
  provisionalDiagnosis?: string;
  mlc?: boolean;               // Medico-Legal Case
  mlcNumber?: string;

  // ── Emergency contact ──
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  // ── Audit trail ──
  statusHistory: StatusUpdate[];
  createdBy: string;
  lastUpdatedBy?: string;
}

export interface Ward {
  id: string;
  name: string;
  department: string;
  totalBeds: number;
  occupiedBeds: number;
  beds: Bed[];
}

export interface Bed {
  id: string;
  number: string;
  ward: string;
  status: "Available" | "Occupied" | "Reserved" | "Maintenance";
  patientId?: string;
  patientName?: string;
}

// ─── LAB ────────────────────────────────────────────────────────────────────

export type LabStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";
export type LabPriority = "Routine" | "Urgent" | "STAT";

export interface LabInvestigation {
  id: string;
  labId: string;             // Auto: LAB001, LAB002 …
  patientId: string;
  patientName: string;
  uhid: string;
  patientType: "OP" | "IP";
  doctorName: string;
  testCode: string;          // from Lab Master
  investigationName: string;
  category: string;
  sampleType?: string;
  priority: LabPriority;
  orderedDate: string;       // YYYY-MM-DD
  orderedTime: string;       // HH:MM
  orderedBy: string;         // who placed the order
  collectedDate?: string;
  collectedTime?: string;
  collectedBy?: string;     // lab tech who collected the sample
  completedDate?: string;
  completedTime?: string;
  completedBy?: string;     // lab tech who entered the result
  result?: string;
  isAbnormal?: boolean;
  normalRange?: string;
  unit?: string;
  turnaroundTime?: string;   // expected from Lab Master
  actualTATMinutes?: number; // calculated on completion
  status: LabStatus;
  cancelReason?: string;
  price: number;
}

export interface TATReport {
  id: string;
  investigationName: string;
  category: string;
  totalOrders: number;
  avgTAT: string;
  minTAT: string;
  maxTAT: string;
  withinTAT: number;
  exceededTAT: number;
  period: string;
}

// ─── APPOINTMENTS ────────────────────────────────────────────────────────────

export type AppointmentStatus = "Scheduled" | "Confirmed" | "In Progress" | "Completed" | "Cancelled" | "No Show";
export type AppointmentType   = "New" | "Review" | "Follow-up";
export type PatientCategory   = "OP" | "IP";

export interface Appointment {
  id: string;
  appointmentNo: string;    // Auto: APT-001, APT-002…
  patientId: string;
  patientName: string;
  uhid: string;
  phone: string;
  patientCategory: PatientCategory;   // OP → gets token; IP → doctor round
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;             // YYYY-MM-DD
  time: string;             // HH:MM
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  tokenNo?: number;         // set when token is issued (OP only)
  // review specific
  originalVisitDate?: string;
  reviewNotes?: string;
  // audit
  bookedBy: string;
  bookedDate: string;
  cancelReason?: string;
  smsSent?: boolean;        // flag for group SMS
}

// ─── BILLING ────────────────────────────────────────────────────────────────

export type BillStatus = "Draft" | "Pending" | "Partial" | "Paid" | "Cancelled";
export type BillPaymentMode = "Cash" | "Card" | "UPI" | "Insurance" | "Cheque";

export interface BillItem {
  id: string;
  serviceCode?: string;       // from BillingMaster
  modalityName?: string;      // from BillingModality
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;           // per-line discount amount
  total: number;              // (unitPrice × qty) - discount
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  paymentMode: BillPaymentMode;
  referenceNo?: string;
  receivedBy: string;
}

export interface Bill {
  id: string;
  billNo: string;
  date: string;
  patientId: string;
  patientName: string;
  uhid: string;
  patientType: "OP" | "IP";
  age?: number;
  gender?: string;
  phone?: string;
  doctorName: string;
  department: string;
  // IP specific
  ward?: string;
  bedNumber?: string;
  admittedDate?: string;
  // bill items
  items: BillItem[];
  // totals
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  // payment
  paymentMode: BillPaymentMode;
  referenceNo?: string;
  towards: string;             // OPD / IPD
  payments: PaymentRecord[];   // full payment history
  // insurance
  isInsurance: boolean;
  insuranceCompany?: string;
  policyNo?: string;
  claimedAmount?: number;      // amount submitted to insurer
  insurancePaidAmount?: number;// amount actually paid by insurer
  insuranceStatus?: "Pending" | "Partial" | "Settled" | "Rejected";
  insuranceRemarks?: string;
  // status
  status: BillStatus;
  cancellationReason?: string;
  // audit
  createdBy: string;
  createdDate: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  billNo: string;
  patientName: string;
  uhid: string;
  date: string;
  amount: number;
  paymentMode: "Cash" | "Card" | "UPI" | "Insurance" | "Cheque";
  towards: string;
  receivedBy: string;
  status: "Active" | "Cancelled";
}

// ─── INSURANCE ───────────────────────────────────────────────────────────────

export type ClaimStatus = "Submitted" | "Under Review" | "Approved" | "Partial" | "Settled" | "Rejected";
export type PreAuthStatus = "Requested" | "Pending" | "Approved" | "Rejected" | "Expired";
export type ClaimType = "Cashless" | "Reimbursement";
export type DocumentType = "Discharge Summary" | "Bills" | "Prescriptions" | "Lab Reports" | "Investigation Reports" | "Other";

export interface PreAuthorization {
  id: string;
  preAuthNo: string;              // Auto: PA-2026-0001
  patientId: string;
  patientName: string;
  uhid: string;
  insuranceCompany: string;
  policyNo: string;
  tpaName: string;
  tpaRefNo?: string;
  admissionDate: string;
  provisionalDiagnosis: string;
  icdCodes?: string[];            // ICD-10 codes
  treatmentPlan: string;
  estimatedAmount: number;
  requestedAmount: number;
  approvedAmount?: number;
  requestedDate: string;
  approvedDate?: string;
  expiryDate?: string;            // Pre-auth validity
  status: PreAuthStatus;
  remarks?: string;
  requestedBy: string;
  approvedBy?: string;
  documents?: ClaimDocument[];
}

export interface ClaimDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;                // In real app: S3/storage URL
  uploadedDate: string;
  uploadedBy: string;
  notes?: string;
}

export interface InsuranceClaim {
  id: string;
  claimNo: string;              // Auto: CLM001, CLM002 …
  claimType: ClaimType;         // Cashless or Reimbursement
  preAuthId?: string;           // Link to pre-authorization if cashless
  billId?: string;              // linked bill id
  billNo?: string;              // linked bill no for display
  patientId: string;
  patientName: string;
  uhid: string;
  insuranceCompany: string;
  policyNo: string;
  tpaName: string;
  admissionDate: string;
  dischargeDate?: string;
  diagnosis: string;
  icdCodes?: string[];          // ICD-10 diagnosis codes
  pcsCodes?: string[];          // PCS procedure codes
  claimAmount: number;
  approvedAmount?: number;
  settledAmount?: number;
  disallowedAmount?: number;    // Amount rejected by TPA
  disallowedReason?: string;    // Reason for disallowance
  patientPayable?: number;      // Amount patient must pay
  submittedDate: string;
  tpaRefNo?: string;
  status: ClaimStatus;
  remarks?: string;
  updatedBy?: string;
  updatedDate?: string;
  documents?: ClaimDocument[];  // Attached documents
  queries?: ClaimQuery[];       // TPA queries/clarifications
}

export interface ClaimQuery {
  id: string;
  queryDate: string;
  queryText: string;
  queriedBy: string;            // TPA name/person
  responseText?: string;
  responseDate?: string;
  respondedBy?: string;
  status: "Open" | "Responded" | "Closed";
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────

export type ExpenseStatus = "Pending" | "Approved" | "Paid" | "Rejected";
export type ExpensePaymentMode = "Cash" | "Bank Transfer" | "UPI" | "Cheque";

export interface Expense {
  id: string;
  expenseNo: string;          // Auto: EXP001, EXP002 …
  date: string;               // YYYY-MM-DD
  category: string;           // from ExpenseCategory master
  towards: string;            // Staff / Dept / Vendor free text
  amount: number;
  paymentMode: ExpensePaymentMode;
  referenceNo?: string;       // Cheque / UTR number
  description: string;        // what was purchased / notes
  preparedBy: string;         // who added
  approvedBy?: string;        // who approved
  status: ExpenseStatus;
  rejectionReason?: string;
}

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  type: "Doctor" | "Vendor" | "Staff" | "Insurance" | "Other";
  phone: string;
  email: string;
  organization: string;
  address: string;
  area: string;
  district: string;
  notes?: string;
}

export type OPVisitStatus = "Waiting" | "In Consultation" | "Consultation Done" | "Billed" | "Paid";

export interface OPVisit {
  id: string;
  visitNo: string;
  uhid: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  department: string;
  tokenNo: string;
  visitDate: string;
  visitTime: string;
  type: "New" | "Review" | "Follow-up";
  status: OPVisitStatus;
  chiefComplaint: string;
  billId?: string;
}

// ─── CASE SHEET ──────────────────────────────────────────────────────────────

export interface DoctorObservation {
  id: string;
  patientId: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  doctorName: string;
  type: "Round" | "Consultation" | "Post-Op" | "Emergency" | "Discharge Note";
  chiefComplaint: string;
  clinicalFindings: string;
  diagnosis: string;
  plan: string;          // treatment plan / next steps
  notes?: string;
  createdBy: string;
}

export interface Medication {
  id: string;
  patientId: string;
  date: string;
  time: string;
  prescribedBy: string;
  drugName: string;
  dosage: string;        // e.g. "500mg"
  frequency: string;     // e.g. "Twice daily", "Every 8 hours"
  route: string;         // Oral | IV | IM | SC | Topical
  duration: string;      // e.g. "5 days"
  instructions?: string; // e.g. "After food"
  status: "Active" | "Stopped" | "Completed";
  stoppedOn?: string;
  stoppedReason?: string;
}

export interface VitalSign {
  id: string;
  patientId: string;
  recordedAt: string;    // ISO datetime
  recordedBy: string;
  bloodPressure?: string; // e.g. "120/80"
  pulse?: number;         // bpm
  temperature?: number;   // °F
  spo2?: number;          // %
  respiratoryRate?: number; // breaths/min
  weight?: number;        // kg
  height?: number;        // cm
  notes?: string;
}

export interface CollectionReport {
  date: string;
  opdCollection: number;
  ipdCollection: number;
  labCollection: number;
  pharmacyCollection: number;
  otherCollection: number;
  totalCollection: number;
  cashCollection: number;
  cardCollection: number;
  upiCollection: number;
  insuranceCollection: number;
}

export interface IncomeReport {
  month: string;
  opdIncome: number;
  ipdIncome: number;
  labIncome: number;
  pharmacyIncome: number;
  otherIncome: number;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
}

// ─── HOSPITAL SETTINGS ───────────────────────────────────────────────────────

export interface HospitalSettings {
  id: string;
  // Basic Info
  hospitalName: string;
  hospitalNameSecondary?: string;  // Tamil/Hindi name
  tagline?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  alternatePhone?: string;
  email: string;
  website?: string;
  
  // Registration
  registrationNo?: string;
  gstNo?: string;
  panNo?: string;
  
  // Bill Customization
  billSettings: BillSettings;
  
  // Document Settings
  documentSettings: DocumentSettings;
  
  // Watermark
  watermarkSettings: WatermarkSettings;
  
  // Logo
  logoUrl?: string;
  logoBase64?: string;  // for embedded logo
  
  // Metadata
  updatedBy: string;
  updatedDate: string;
}

// Draggable section descriptor used by bill customizer
export interface BillSection {
  id: string;
  label: string;
  enabled: boolean;
}

export interface BillSettings {
  // Header toggles
  showLogo: boolean;
  showHospitalName: boolean;
  showAddress: boolean;
  showContactInfo: boolean;
  showRegistrationNos: boolean;

  // Drag order for header blocks
  headerSectionOrder: string[];   // ids: "logo" | "name" | "address" | "contact" | "regno"

  // Header layout
  headerLayout: "logo-left" | "logo-center" | "logo-right" | "logo-above" | "text-only";
  logoSize: "sm" | "md" | "lg";  // small=48px, medium=64px, large=96px

  // Body section order & visibility (draggable)
  bodySections: BillSection[];    // ids: "patient" | "items" | "totals" | "insurance" | "payment" | "signature"

  // Bill Layout
  billLayout: "compact" | "standard" | "detailed";
  paperSize: "A4" | "A5" | "thermal-80mm";

  // Colors & Branding
  primaryColor: string;
  accentColor: string;
  headerBgColor: string;

  // Content
  showPatientDetails: boolean;
  showDoctorInfo: boolean;
  showItemizedList: boolean;
  showPaymentBreakdown: boolean;
  showTermsConditions: boolean;
  termsText?: string;

  // Footer
  footerText?: string;
  showSignature: boolean;
  signatureName?: string;
  signatureDesignation?: string;

  // Formatting
  currencySymbol: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  showBarcode: boolean;
  showQRCode: boolean;
}

export interface DocumentSettings {
  // OP Token
  tokenLayout: "compact" | "standard";
  tokenShowQueueInfo: boolean;
  tokenShowDoctorPhoto: boolean;
  
  // Prescriptions
  prescriptionShowLetterhead: boolean;
  prescriptionShowDoctorQualification: boolean;
  
  // Lab Reports
  labReportShowNormalRange: boolean;
  labReportHighlightAbnormal: boolean;
  
  // Admission Forms
  admissionShowConsent: boolean;
  
  // Discharge Summary
  dischargeShowMedications: boolean;
  dischargeShowFollowUp: boolean;
}

export interface WatermarkSettings {
  enabled: boolean;
  type: "text" | "image";   // text or image watermark
  text: string;
  imageUrl?: string;        // base64 data URL for image watermark
  opacity: number;          // 0-100
  fontSize: number;
  rotation: number;         // degrees
  color: string;            // hex color
  position: "center" | "diagonal" | "top" | "bottom";
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export type CollectionPaymentMode = "Cash" | "UPI" | "Card" | "Cheque";

export interface DailySummaryCollectionEntry {
  id: string;
  sNo: number;
  patientName: string;
  age: number;
  sex: "M" | "F";
  visitType: "OP" | "IP" | "ICU" | "HDU";
  consultantName: string;
  diagnosis: string;
  paymentMode: CollectionPaymentMode;  // primary mode (or "Split" sentinel)
  amount: number;                       // total amount across all splits
  // Optional split breakdown — present when patient paid via multiple modes
  paymentSplits?: { mode: CollectionPaymentMode; amount: number }[];
}

export interface DailySummary {
  id: string;
  summaryNo: string;
  date: string;                              // YYYY-MM-DD
  collectionEntries: DailySummaryCollectionEntry[];
  totalCollection: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  chequeTotal: number;
  notes?: string;
  createdBy: string;
  submittedBy?: string;
  status: "Draft" | "Submitted";
}

export interface DailySummaryInsuranceClaim {
  id: string;
  claimNo: string;
  dod: string;                               // Date of Discharge
  patientName: string;
  chequeDate: string;
  chequeNo?: string;
  amountClaimed: number;
  amountDeducted: number;
  tpaName: string;
  itDeduction: number;
  amountSettled: number;
  financialYear: string;                     // e.g. "2026-2027"
  notes?: string;
}
