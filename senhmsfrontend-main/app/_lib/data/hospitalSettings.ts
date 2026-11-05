"use client";

import type { HospitalSettings } from "../types";

// Default hospital settings
const DEFAULT_SETTINGS: HospitalSettings = {
  id: "settings-1",
  
  // Basic Info
  hospitalName: "Sen Hospital",
  hospitalNameSecondary: "சென் மருத்துவமனை",
  tagline: "Caring for You, Always",
  address: "123, Anna Salai, Teynampet",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600018",
  country: "India",
  phone: "+91 44 1234 5678",
  alternatePhone: "+91 44 8765 4321",
  email: "contact@senhospital.com",
  website: "www.senhospital.com",
  
  // Registration
  registrationNo: "REG/2020/12345",
  gstNo: "33AABCU9603R1ZM",
  panNo: "AABCU9603R",
  
  // Bill Customization
  billSettings: {
    // Header
    showLogo: true,
    showHospitalName: true,
    showAddress: true,
    showContactInfo: true,
    showRegistrationNos: true,

    // Drag order for header blocks
    headerSectionOrder: ["logo", "name", "address", "contact", "regno"],

    // Header layout
    headerLayout: "logo-left",
    logoSize: "md",

    // Body sections (drag-reorderable, each togglable)
    bodySections: [
      { id: "patient",   label: "Patient & Doctor Info", enabled: true },
      { id: "items",     label: "Services / Charges",    enabled: true },
      { id: "totals",    label: "Amount Summary",         enabled: true },
      { id: "insurance", label: "Insurance Details",      enabled: true },
      { id: "payment",   label: "Payment History",        enabled: true },
      { id: "signature", label: "Signature Block",        enabled: true },
    ],

    // Bill Layout
    billLayout: "standard",
    paperSize: "A4",

    // Colors & Branding
    primaryColor: "#00059f",
    accentColor: "#10b981",
    headerBgColor: "#f8fafc",

    // Content
    showPatientDetails: true,
    showDoctorInfo: true,
    showItemizedList: true,
    showPaymentBreakdown: true,
    showTermsConditions: true,
    termsText: "All payments are non-refundable. Please verify bill details before payment.",

    // Footer
    footerText: "Thank you for choosing Sen Hospital. Get well soon!",
    showSignature: true,
    signatureName: "Dr. Admin",
    signatureDesignation: "Medical Director",

    // Formatting
    currencySymbol: "₹",
    dateFormat: "DD/MM/YYYY",
    showBarcode: true,
    showQRCode: true,
  },
  
  // Document Settings
  documentSettings: {
    // OP Token
    tokenLayout: "standard",
    tokenShowQueueInfo: true,
    tokenShowDoctorPhoto: false,
    
    // Prescriptions
    prescriptionShowLetterhead: true,
    prescriptionShowDoctorQualification: true,
    
    // Lab Reports
    labReportShowNormalRange: true,
    labReportHighlightAbnormal: true,
    
    // Admission Forms
    admissionShowConsent: true,
    
    // Discharge Summary
    dischargeShowMedications: true,
    dischargeShowFollowUp: true,
  },
  
  // Watermark
  watermarkSettings: {
    enabled: true,
    type: "text" as const,
    text: "ORIGINAL",
    imageUrl: undefined,
    opacity: 15,
    fontSize: 72,
    rotation: -45,
    color: "#6b7280",
    position: "diagonal",
  },
  
  // Metadata
  updatedBy: "System",
  updatedDate: "2025-01-31",
};

// In-memory store
let hospitalSettings: HospitalSettings = { ...DEFAULT_SETTINGS };

// Initialize from localStorage (if available)
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("hms_hospital_settings");
    if (stored) {
      hospitalSettings = JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load hospital settings from localStorage:", error);
  }
}

// ─── Getters ─────────────────────────────────────────────────────────────────

export function getHospitalSettings(): HospitalSettings {
  return hospitalSettings;
}

// ─── Updaters ────────────────────────────────────────────────────────────────

export function updateHospitalSettings(data: Partial<HospitalSettings>): void {
  hospitalSettings = {
    ...hospitalSettings,
    ...data,
    updatedDate: new Date().toISOString().slice(0, 10),
  };
  
  // Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("hms_hospital_settings", JSON.stringify(hospitalSettings));
    } catch (error) {
      console.error("Failed to save hospital settings to localStorage:", error);
    }
  }
}

export function resetHospitalSettings(): void {
  hospitalSettings = { ...DEFAULT_SETTINGS };
  
  if (typeof window !== "undefined") {
    localStorage.removeItem("hms_hospital_settings");
  }
}
