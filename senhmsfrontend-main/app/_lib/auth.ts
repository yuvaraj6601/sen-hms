"use client";

export type Role =
  | "Managing Director"
  | "Admin"
  | "Doctor"
  | "Receptionist"
  | "Lab Tech"
  | "Insurance Coordinator"
  | "Nurse"
  | "Lab/Ins/Reception";

export interface Session {
  id:             string;
  employeeId:     string;
  name:           string;
  email:          string;
  role:           Role;
  departmentId?:  number | null;
  departmentName?: string | null;
  doctorId?:      number | null;
}

export interface Permission {
  view:   boolean;
  edit:   boolean;
  delete: boolean;
}

// ─── Permission Matrix ────────────────────────────────────────────────────────
const FULL: Permission = { view: true,  edit: true,  delete: true  };
const VIEW: Permission = { view: true,  edit: false, delete: false };
const NONE: Permission = { view: false, edit: false, delete: false };

export const PERMISSIONS: Record<string, Record<Role, Permission>> = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  "dashboard": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": FULL, "Insurance Coordinator": FULL, Nurse: FULL,
    "Lab/Ins/Reception": FULL,
  },

  // ── OP Visits ─────────────────────────────────────────────────────────────
  "op-visits": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },

  // ── Admissions ────────────────────────────────────────────────────────────
  "admissions": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },

  // ── Discharge ─────────────────────────────────────────────────────────────
  "discharge": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },

  // ── MASTERS ───────────────────────────────────────────────────────────────
  "masters/users": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "masters/doctors": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },
  "masters/referrers": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/departments": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: VIEW,
    "Lab Tech": VIEW, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },
  "masters/investigations": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: NONE,
    "Lab Tech": FULL, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/lab": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": FULL, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/billing-modality": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": VIEW,
  },
  "masters/billing-masters": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": VIEW,
  },
  "masters/expense-category": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "masters/towards": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "masters/area": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/district": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/insurance-companies": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": FULL, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "masters/wards-beds": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: FULL,
    "Lab/Ins/Reception": VIEW,
  },
  "masters/icd-codes": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: NONE,
    "Lab/Ins/Reception": VIEW,
  },
  // Managed dropdown lists (Areas, Districts, Units) used across OP + Lab.
  "masters/dropdowns": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": FULL, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── PATIENTS ──────────────────────────────────────────────────────────────
  "patients/list": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: FULL,
    "Lab Tech": VIEW, "Insurance Coordinator": VIEW, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },
  "patients/outpatients": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },
  "patients/inpatients": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: FULL,
    "Lab/Ins/Reception": FULL,
  },
  "patients/inpatients-bed": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: FULL,
    "Lab/Ins/Reception": VIEW,
  },
  "patients/inpatients-discharged": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },
  "patients/ward-view": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: FULL,
    "Lab/Ins/Reception": VIEW,
  },

  // ── LAB ───────────────────────────────────────────────────────────────────
  "lab/investigations": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: FULL,
    "Lab Tech": FULL, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },
  "lab/tat-report": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: NONE,
    "Lab Tech": FULL, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── APPOINTMENTS ──────────────────────────────────────────────────────────
  "appointments/list": {
    "Managing Director": FULL, Admin: FULL, Doctor: FULL, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": FULL,
  },
  "appointments/sms": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── BILLS ─────────────────────────────────────────────────────────────────
  "bills": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── INSURANCE ─────────────────────────────────────────────────────────────
  "insurance": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": FULL, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  "expenses": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: VIEW,
    "Lab Tech": VIEW, "Insurance Coordinator": VIEW, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },

  // ── CONTACTS ──────────────────────────────────────────────────────────────
  "contacts": {
    "Managing Director": FULL, Admin: FULL, Doctor: VIEW, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": VIEW, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── REPORTS ───────────────────────────────────────────────────────────────
  "reports/statistics": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "reports/income": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "reports/expense-list": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "reports/net-cash": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "reports/admission-form": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },

  // ── DAILY SUMMARY ─────────────────────────────────────────────────────────
  "daily-summary": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "daily-summary/pharmacy-collection": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "daily-summary/insurance-claims": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": FULL, Nurse: NONE,
    "Lab/Ins/Reception": FULL,
  },
  "daily-summary/day-report": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: FULL,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  "settings": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "settings/hospital": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "settings/bill-customization": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  "settings/qr-token": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
  // Patient feedback (NABH) — mirrors backend SecurityConfig:
  // GET for MD/Admin/Reception/Nurse/LIR; writes stay MD/Admin.
  "settings/feedback": {
    "Managing Director": FULL, Admin: FULL, Doctor: NONE, Receptionist: VIEW,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: VIEW,
    "Lab/Ins/Reception": VIEW,
  },
  // Audit logs — Managing Director only. Every other role has NO access,
  // matching the backend authorization guard.
  "settings/audit": {
    "Managing Director": FULL, Admin: NONE, Doctor: NONE, Receptionist: NONE,
    "Lab Tech": NONE, "Insurance Coordinator": NONE, Nurse: NONE,
    "Lab/Ins/Reception": NONE,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hasAccess(role: Role, path: string): Permission {
  return PERMISSIONS[path]?.[role] ?? NONE;
}

export function canView(role: Role, path: string): boolean {
  return hasAccess(role, path).view;
}

export function canEdit(role: Role, path: string): boolean {
  return hasAccess(role, path).edit;
}

export function canDelete(role: Role, path: string): boolean {
  return hasAccess(role, path).delete;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Calls the Next.js API route which proxies to Spring Boot,
 * stores the JWT in an httpOnly cookie, and stores session
 * metadata in a readable cookie.
 */
export async function login(
  email: string,
  password: string
): Promise<{ session: Session } | { error: string }> {
  const res = await fetch("/api/auth/login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    return { error: data.error ?? "Invalid email or password." };
  }

  // Mark this specific tab as authenticated — new tabs opening the URL will
  // not have this sessionStorage key and will be redirected to login.
  markTabAuthenticated();

  return { session: data.session as Session };
}

/**
 * Clears both cookies by calling the logout API route.
 */
export async function logout(): Promise<void> {
  clearTabAuth();
  await fetch("/api/auth/logout", { method: "POST" });
}

/**
 * Reads the non-sensitive session metadata from the readable cookie.
 * Safe to call on the client side.
 */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("hms_session="));
    if (!match) return null;
    const value = decodeURIComponent(match.split("=").slice(1).join("="));
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

/**
 * Marks this browser tab as an authenticated session.
 * Must be called after a successful login.
 * Uses sessionStorage so the token is NOT shared with other tabs.
 */
export function markTabAuthenticated(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("hms_tab_auth", "1");
}

/**
 * Returns true only if this specific tab has been authenticated
 * (i.e. the user logged in within this tab, not just copied the URL).
 */
export function isTabAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("hms_tab_auth") === "1";
}

/**
 * Clears the tab authentication marker (called on logout).
 */
export function clearTabAuth(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("hms_tab_auth");
}
