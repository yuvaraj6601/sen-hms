# Hospital Management System — Module Plan

## Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- TypeScript
- In-memory mock data (no backend, Phase 1)

---

## Route Structure

```
app/
├── layout.tsx                         # Root layout
├── globals.css
├── page.tsx                           # Login page
├── _components/                       # Shared UI components
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── StatCard.tsx
│   ├── DataTable.tsx
│   ├── Modal.tsx
│   ├── Badge.tsx
│   └── PageHeader.tsx
├── _lib/                              # Mock data & helpers
│   ├── mockData.ts
│   ├── types.ts
│   └── auth.ts                        # Role definitions + mock session
│
├── (dashboard)/                       # Route group — all protected pages share DashboardLayout
│   ├── layout.tsx                     # Sidebar + Header shell (reads role, filters nav)
│   ├── dashboard/page.tsx             # Role-aware KPI dashboard
│   │
│   ├── masters/
│   │   ├── users/page.tsx
│   │   ├── doctors/page.tsx
│   │   ├── referrers/page.tsx
│   │   ├── departments/page.tsx
│   │   ├── investigations/page.tsx
│   │   ├── lab/page.tsx
│   │   ├── billing-modality/page.tsx
│   │   ├── billing-masters/page.tsx
│   │   ├── expense-category/page.tsx
│   │   ├── towards/page.tsx
│   │   ├── area/page.tsx
│   │   ├── district/page.tsx
│   │   ├── insurance-company/page.tsx
│   │   └── icd-pcs/page.tsx
│   │
│   ├── patients/
│   │   ├── list/page.tsx
│   │   ├── outpatients/page.tsx
│   │   ├── inpatients/page.tsx
│   │   ├── inpatients-bed/page.tsx
│   │   ├── inpatients-discharged/page.tsx
│   │   └── ward-view/page.tsx
│   │
│   ├── lab/
│   │   ├── investigations/page.tsx
│   │   └── tat-report/page.tsx
│   │
│   ├── appointments/
│   │   ├── list/page.tsx
│   │   ├── review/page.tsx
│   │   ├── sms-op-ip/page.tsx
│   │   └── sms-patient/page.tsx
│   │
│   ├── bills/
│   │   ├── list/page.tsx
│   │   ├── cancelled/page.tsx
│   │   ├── receipts/page.tsx
│   │   └── cancelled-receipts/page.tsx
│   │
│   ├── insurance/
│   │   ├── claims-received/page.tsx
│   │   ├── claims-report/page.tsx
│   │   ├── claims-received-report/page.tsx
│   │   └── claims-pending-report/page.tsx
│   │
│   ├── expenses/page.tsx
│   ├── contacts/page.tsx
│   │
│   └── reports/
│       ├── admission-form/page.tsx
│       ├── collection/page.tsx
│       ├── income/page.tsx
│       ├── expense-list/page.tsx
│       ├── op-doctor-wise/page.tsx
│       ├── op-referrer-wise/page.tsx
│       ├── ip-doctor-wise/page.tsx
│       └── ip-referrer-wise/page.tsx
```

---

## Authentication & Role-Based Access

### How it works (UI Phase)
- Login page (`/`) — email + password form
- On submit, match credentials against mock users in `_lib/auth.ts`
- Store session in `localStorage` as `{ id, name, role, email }`
- `(dashboard)/layout.tsx` reads session client-side → redirects to `/` if missing
- Sidebar filters nav items based on role permissions map
- Individual pages check role and show 403 if accessed directly without permission

### Roles & Credentials (mock logins)

| Role | Email | Password |
|---|---|---|
| Admin | admin@senhospital.com | admin123 |
| Doctor | doctor@senhospital.com | doctor123 |
| Receptionist | reception@senhospital.com | recep123 |
| Lab Tech | lab@senhospital.com | lab123 |
| Insurance Coordinator | insurance@senhospital.com | insure123 |
| Nurse | nurse@senhospital.com | nurse123 |

---

## Role Permission Matrix

### MASTERS

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Users | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Doctors | ✅ Full | 👁 View | 👁 View | ❌ | ❌ | 👁 View |
| Referrers | ✅ Full | 👁 View | ✅ Full | ❌ | ❌ | ❌ |
| Departments | ✅ Full | 👁 View | 👁 View | 👁 View | ❌ | 👁 View |
| Investigations | ✅ Full | 👁 View | ❌ | ✅ Full | ❌ | ❌ |
| Lab (submenu) | ✅ Full | ❌ | ❌ | ✅ Full | ❌ | ❌ |
| Billing Modality | ✅ Full | ❌ | 👁 View | ❌ | ❌ | ❌ |
| Billing Masters | ✅ Full | ❌ | 👁 View | ❌ | ❌ | ❌ |
| Expense Category | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Towards Master | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Area | ✅ Full | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| District | ✅ Full | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| Insurance Company | ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| ICD & PCS Codes | ✅ Full | 👁 View | ❌ | ❌ | 👁 View | ❌ |

### PATIENTS

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| All Patients | ✅ Full | 👁 View | ✅ Full | 👁 View | 👁 View | 👁 View |
| Out Patients | ✅ Full | ✅ Full | ✅ Full | ❌ | ❌ | 👁 View |
| In Patients | ✅ Full | ✅ Full | ✅ Full | ❌ | 👁 View | ✅ Full |
| In Patients – In Bed | ✅ Full | ✅ Full | 👁 View | ❌ | ❌ | ✅ Full |
| In Patients – Discharged | ✅ Full | 👁 View | 👁 View | ❌ | 👁 View | 👁 View |
| Ward View | ✅ Full | 👁 View | 👁 View | ❌ | ❌ | ✅ Full |

### LAB

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Lab Investigations | ✅ Full | 👁 View | ❌ | ✅ Full | ❌ | 👁 View |
| TAT Report | ✅ Full | 👁 View | ❌ | ✅ Full | ❌ | ❌ |

### APPOINTMENTS

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Appointments | ✅ Full | ✅ Full | ✅ Full | ❌ | ❌ | 👁 View |
| Review List | ✅ Full | ✅ Full | ✅ Full | ❌ | ❌ | 👁 View |
| Group SMS – OP/IP Wise | ✅ Full | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| Group SMS – Patient Wise | ✅ Full | ❌ | ✅ Full | ❌ | ❌ | ❌ |

### BILL LIST

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Bill List | ✅ Full | 👁 View | ✅ Full | ❌ | 👁 View | ❌ |
| Cancelled Bills | ✅ Full | ❌ | 👁 View | ❌ | 👁 View | ❌ |
| Receipt List | ✅ Full | ❌ | ✅ Full | ❌ | 👁 View | ❌ |
| Cancelled Receipts | ✅ Full | ❌ | 👁 View | ❌ | 👁 View | ❌ |

### INSURANCE

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Claims Received | ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Claims Report | ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Received List Report | ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Pending List Report | ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |

### EXPENSES & CONTACTS

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Expenses | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contacts | ✅ Full | 👁 View | ✅ Full | ❌ | 👁 View | ❌ |

### REPORTS

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Admission Form | ✅ Full | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| Collection Reports | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Income Reports | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Expense List Report | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| OP – Doctor Wise | ✅ Full | ✅ Full | 👁 View | ❌ | ❌ | ❌ |
| OP – Referrer Wise | ✅ Full | ❌ | 👁 View | ❌ | ❌ | ❌ |
| IP – Doctor Wise | ✅ Full | ✅ Full | 👁 View | ❌ | ❌ | ❌ |
| IP – Referrer Wise | ✅ Full | ❌ | 👁 View | ❌ | ❌ | ❌ |

---

## Role Dashboard Views

Each role lands on `/dashboard` but sees role-specific KPI cards and quick links:

### Admin Dashboard
- Total Patients today (OP + IP)
- Total Revenue today
- Beds Occupied / Total
- Pending Bills amount
- Pending Insurance Claims
- Expense this month
- Quick links → all modules

### Doctor Dashboard
- My Appointments today
- My Patients (OP + IP)
- Pending Lab Results for my patients
- Review appointments due
- Quick links → Appointments, My Patients, Lab Results, OP Reports

### Receptionist Dashboard
- Today's Appointments
- New Registrations today
- Pending Bills
- Bed Availability summary
- Quick links → New Patient, Appointments, Bill List, Ward View

### Lab Tech Dashboard
- Pending Lab Tests
- In-Progress Tests
- Completed today
- TAT compliance %
- Quick links → Lab Investigations, TAT Report

### Insurance Coordinator Dashboard
- Open Claims
- Claims submitted this month
- Approved this month
- Rejected / Pending
- Quick links → Claims Received, Claims Report, Pending Report

### Nurse Dashboard
- Patients in my ward
- Bed occupancy (ward-level)
- Appointments today (their ward)
- Quick links → Ward View, In Patients – In Bed, Appointments

---

## Access Control Implementation

### `_lib/auth.ts` exports:
```ts
type Role = "Admin" | "Doctor" | "Receptionist" | "Lab Tech" | "Insurance Coordinator" | "Nurse"

interface Permission {
  view: boolean   // can see the page
  edit: boolean   // can add/edit records
  delete: boolean // can delete records
}

// Map: route path → Role → Permission
const PERMISSIONS: Record<string, Record<Role, Permission>>

// Hook: useAuth() → { user, role, can(path) }
// Helper: hasAccess(role, path) → Permission
```

### Sidebar behavior:
- Sections with **zero** accessible items for a role → entire section hidden
- Items with `view: false` → hidden from nav
- Items with `view: true, edit: false` → shown but Add/Edit/Delete buttons hidden

### Page-level guard:
- Each page checks `hasAccess(role, path).view`
- If false → renders `<AccessDenied />` component
- Edit/Delete buttons check `hasAccess(role, path).edit`

---

## Module Build Order (Updated)

### ✅ Phase 1 — Foundation (done)
- [x] `globals.css`
- [x] `app/layout.tsx`
- [x] `app/_lib/types.ts`

### 🔲 Phase 2 — Auth Layer
- [ ] `app/_lib/auth.ts` — roles, permissions map, mock users
- [ ] `app/page.tsx` — Login page (role selector + credentials)
- [ ] `app/_components/AccessDenied.tsx`

### 🔲 Phase 3 — Shell
- [ ] `app/_components/Sidebar.tsx` — role-filtered nav with submenus
- [ ] `app/_components/Header.tsx`
- [ ] `app/_components/PageHeader.tsx`
- [ ] `app/_components/Badge.tsx`
- [ ] `app/_components/StatCard.tsx`
- [ ] `app/_components/DataTable.tsx`
- [ ] `app/_components/Modal.tsx`
- [ ] `app/(dashboard)/layout.tsx`
- [ ] `app/(dashboard)/dashboard/page.tsx` — role dashboards

### 🔲 Phase 4 — MASTERS (Admin only mostly)
- [ ] Users → Doctors → Referrers → Departments
- [ ] Investigations → Lab → Billing Modality → Billing Masters
- [ ] Expense Category → Towards → Area → District
- [ ] Insurance Company → ICD & PCS Codes

### 🔲 Phase 5 — PATIENTS
- [ ] All Patients → OP → IP → In-Bed → Discharged → Ward View

### 🔲 Phase 6 — LAB
- [ ] Lab Investigations → TAT Report

### 🔲 Phase 7 — APPOINTMENTS
- [ ] Appointments → Review List → Group SMS (x2)

### 🔲 Phase 8 — BILLS
- [ ] Bill List → Cancelled → Receipts → Cancelled Receipts

### 🔲 Phase 9 — INSURANCE
- [ ] Claims Received → Claims Report → Received Report → Pending Report

### 🔲 Phase 10 — EXPENSES & CONTACTS

### 🔲 Phase 11 — REPORTS
- [ ] All 8 report pages

---

## UI Design System

| Token | Value |
|---|---|
| Sidebar bg | `#0f172a` (slate-900) |
| Primary | `#0ea5e9` (sky-500) |
| Background | `#f8fafc` (slate-50) |
| Card bg | `#ffffff` |
| Border | `#e2e8f0` (slate-200) |
| Success | `#10b981` (emerald-500) |
| Warning | `#f59e0b` (amber-500) |
| Danger | `#ef4444` (red-500) |
| Info | `#6366f1` (indigo-500) |

---

## Shared Components

| Component | Description |
|---|---|
| `Sidebar` | Role-filtered nav, collapsible sections, submenus, mobile slide-in |
| `Header` | Search bar, notifications bell, user avatar + role badge, logout |
| `PageHeader` | Title, breadcrumb trail, primary action button (hidden if no edit permission) |
| `DataTable` | Search, column sort, status filter, pagination, row actions |
| `Modal` | Accessible overlay, form add/edit, close on backdrop click |
| `Badge` | Status pill — variant per value (Active=green, Pending=yellow, etc.) |
| `StatCard` | Icon + label + value + optional trend arrow |
| `AccessDenied` | 403 page shown when role lacks view permission |

---

## Patient Workflows

---

### OP (Outpatient) Flow

```
Receptionist                Doctor                  Billing/Reception
     │                         │                          │
     ▼                         │                          │
 Patient Arrives               │                          │
     │                         │                          │
     ▼                         │                          │
 New Patient?                  │                          │
  ├─ YES → Register            │                          │
  │   (Name, Age, Phone,       │                          │
  │    Address, Referrer,      │                          │
  │    Doctor, Dept)           │                          │
  │   UHID auto-generated      │                          │
  └─ NO  → Search by           │                          │
           UHID / Phone        │                          │
     │                         │                          │
     ▼                         │                          │
 Select Doctor + Dept          │                          │
     │                         │                          │
     ▼                         │                          │
 Token Auto-Assigned           │                          │
 (per doctor, per day,         │                          │
  sequential: T001, T002…)     │                          │
     │                         │                          │
     ▼                         │                          │
 Appointment Created           │                          │
 Status: WAITING          ─────┼──────────────────────▶  │
                               │                          │
                          Doctor's Queue                  │
                          shows WAITING list              │
                          sorted by Token No              │
                               │                          │
                               ▼                          │
                          Doctor calls patient            │
                          Status: IN CONSULTATION         │
                               │                          │
                               ▼                          │
                          Consultation Done               │
                          • Notes entered                 │
                          • Prescriptions added           │
                          • Lab tests ordered (opt)       │
                          • Review date set (opt)         │
                          Status: CONSULTATION DONE  ─────┼──────────▶
                                                          │
                                                    Bill Auto-generated
                                                    (OPD fee + services)
                                                          │
                                                          ▼
                                                    Payment Collected
                                                    (Cash/Card/UPI)
                                                          │
                                                          ▼
                                                    Receipt Printed
                                                    Status: PAID
```

#### OP Token Rules
- Token resets to T001 every day per doctor
- Token format: `T{DoctorCode}{Date}{SeqNo}` e.g. `T-VEN-20250615-001`
- Walk-in and pre-booked appointments share the same token queue
- Receptionist can manually re-order tokens (emergency bumping)

#### OP Status States
```
WAITING → IN CONSULTATION → CONSULTATION DONE → BILLED → PAID
                                              → REVIEW SCHEDULED
```

---

### IP (Inpatient) Flow

```
REGISTERED
    │
    │  (Can come from OP consultation or direct admission)
    ▼
ADMITTED
    │  Receptionist/Admin assigns:
    │  • Admission No (auto)
    │  • Admitting Doctor
    │  • Department
    │  • Estimated stay
    ▼
WARD / BED ASSIGNED
    │
    │  Ward Types:
    │  ┌─────────────────────────────────────────┐
    │  │  ICU          (Intensive Care Unit)      │
    │  │  HDU          (High Dependency Unit)     │
    │  │  General Ward (multi-bed, open)          │
    │  │  Private Room (single bed, attached)     │
    │  │  Semi-Private (2-bed room)               │
    │  │  Observation  (short-stay, 24h)          │
    │  └─────────────────────────────────────────┘
    │
    ▼
STABLE / CRITICAL / UNDER OBSERVATION
    │  (Condition updated by Doctor/Nurse)
    │
    ├──────────────── TRANSFERS (any point) ─────────────────┐
    │                                                         │
    │  Transfer Type        Example                          │
    │  ─────────────────────────────────────────────────     │
    │  Ward Transfer        ICU → General Ward               │
    │  Room Transfer        Room 101 → Room 205              │
    │  Bed Transfer         Bed 3 → Bed 7 (same ward)        │
    │  Department Transfer  Surgery → Cardiology             │
    │  Doctor Transfer      Dr. A → Dr. B                    │
    │  Condition Update     Critical → Stable                │
    │  Procedure Update     Pre-op → Post-op                 │
    │                                                         │
    │  Every transfer logs:                                   │
    │  • Transfer type, From, To                             │
    │  • Date + Time                                         │
    │  • Reason / Notes                                      │
    │  • Done by (User)                                      │
    └─────────────────────────────────────────────────────────┘
    │
    ▼
DISCHARGE INITIATED
    │  Doctor marks discharge
    │  Final bill generated (all charges accumulated)
    │  Pending payments cleared
    │
    ▼
DISCHARGED
    │
    ├── Normal Discharge     (planned, bill settled)
    ├── LAMA                 (Left Against Medical Advice)
    ├── Expired              (death, death certificate issued)
    └── Referred             (transferred to another facility)
```

#### IP Status States
```
REGISTERED
    ↓
ADMITTED
    ↓
BED ASSIGNED  ←──── TRANSFER (loops back here)
    ↓
STABLE | CRITICAL | UNDER OBSERVATION
    ↓
DISCHARGE INITIATED
    ↓
DISCHARGED (Normal) | LAMA | EXPIRED | REFERRED
```

#### IP Admission Record Fields
```
• Admission No      (auto: ADM-YYYYMMDD-XXXX)
• UHID
• Patient Name, Age, Gender, Blood Group
• Admitting Doctor
• Department
• Ward + Bed
• Admission Date + Time
• Admission Type    (Emergency / Elective / Maternity / Daycare)
• Diagnosis (provisional)
• Referred By
• Attendant Name + Relation + Phone
• Insurance Details (if applicable)
• Condition on Admission (Stable / Critical / Serious)
```

#### Transfer Log Record Fields
```
• Transfer No       (auto)
• Admission No
• Patient Name + UHID
• Transfer Type     (Ward / Room / Bed / Department / Doctor / Condition / Procedure / Discharge)
• From              (Ward/Room/Bed/Doctor/Department/Condition)
• To                (Ward/Room/Bed/Doctor/Department/Condition)
• Transfer Date + Time
• Reason
• Ordered By        (Doctor)
• Done By           (Nurse/Admin)
• Notes
```

#### Discharge Record Fields
```
• Discharge No      (auto)
• Admission No
• Patient Name + UHID
• Discharge Type    (Normal / LAMA / Expired / Referred)
• Discharge Date + Time
• Discharge Doctor
• Final Diagnosis
• Procedures Performed
• Condition on Discharge
• Follow-up Date
• Referred To       (if Referred type)
• Total Days Stayed
• Final Bill Amount
• Settlement Mode
```

---

### Bed & Ward State Machine

```
AVAILABLE ──────────▶ RESERVED (appointment booked)
    ▲                     │
    │                     ▼
    │              OCCUPIED (patient admitted)
    │                     │
    │         ┌───────────┤
    │         │           │
    │    TRANSFER     DISCHARGE
    │    (bed freed)  (bed freed)
    │         │           │
    └─────────┴───────────┘
              │
         MAINTENANCE (cleaning / repair)
              │
              ▼
          AVAILABLE
```

#### Bed Status Colors (Ward View UI)
| Status | Color |
|---|---|
| Available | Green |
| Occupied | Red |
| Reserved | Yellow |
| Maintenance | Gray |

---

### New Data Types Needed (additions to types.ts)

```ts
// OP Flow
interface OPVisit {
  id: string
  visitNo: string          // auto: VIS-YYYYMMDD-XXXX
  uhid: string
  patientName: string
  doctorId: string
  doctorName: string
  department: string
  tokenNo: string          // T-VEN-20250615-001
  visitDate: string
  visitTime: string
  type: "New" | "Review" | "Follow-up"
  status: "Waiting" | "In Consultation" | "Consultation Done" | "Billed" | "Paid"
  chiefComplaint: string
  notes?: string
  prescriptions?: Prescription[]
  labOrderIds?: string[]
  reviewDate?: string
  billId?: string
}

interface Prescription {
  medicine: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

// IP Flow
interface IPAdmission {
  id: string
  admissionNo: string      // ADM-YYYYMMDD-XXXX
  uhid: string
  patientId: string
  patientName: string
  admittingDoctorId: string
  admittingDoctorName: string
  department: string
  wardId: string
  wardName: string
  bedId: string
  bedNumber: string
  admissionDate: string
  admissionTime: string
  admissionType: "Emergency" | "Elective" | "Maternity" | "Daycare"
  provisionalDiagnosis: string
  conditionOnAdmission: "Stable" | "Critical" | "Serious" | "Under Observation"
  attendantName: string
  attendantRelation: string
  attendantPhone: string
  insuranceCompany?: string
  policyNo?: string
  referredBy?: string
  status: "Admitted" | "Stable" | "Critical" | "Under Observation" | "Discharge Initiated" | "Discharged"
  dischargeId?: string
  transferHistory: TransferLog[]
}

interface TransferLog {
  id: string
  transferNo: string
  admissionNo: string
  patientName: string
  uhid: string
  transferType: "Ward" | "Room" | "Bed" | "Department" | "Doctor" | "Condition" | "Procedure" | "Discharge Type"
  from: string
  to: string
  transferDate: string
  transferTime: string
  reason: string
  orderedBy: string        // Doctor name
  doneBy: string           // Nurse/Admin name
  notes?: string
}

interface DischargeRecord {
  id: string
  dischargeNo: string
  admissionNo: string
  uhid: string
  patientName: string
  dischargeType: "Normal" | "LAMA" | "Expired" | "Referred"
  dischargeDate: string
  dischargeTime: string
  dischargingDoctor: string
  finalDiagnosis: string
  proceduresPerformed: string[]
  conditionOnDischarge: "Stable" | "Improved" | "Unchanged" | "Deteriorated" | "Expired"
  followUpDate?: string
  referredTo?: string
  totalDaysStayed: number
  finalBillAmount: number
  settlementMode: "Cash" | "Card" | "UPI" | "Insurance" | "Cheque" | "Mixed"
  notes?: string
}
```

---

### New Pages Added to Route Structure

```
(dashboard)/
├── op-visits/
│   └── page.tsx           # Today's OP queue (token list, status per doctor)
│
├── patients/
│   ├── [id]/
│   │   └── page.tsx       # Patient detail (timeline, visits, bills, lab)
│   ├── inpatients-bed/
│   │   └── page.tsx       # Bed assignment view
│   └── ward-view/
│       └── page.tsx       # Ward grid with bed status colors
│
├── admissions/
│   ├── page.tsx           # All current admissions
│   ├── new/page.tsx       # New admission form
│   └── [id]/
│       ├── page.tsx       # Admission detail + transfer history
│       └── transfer/
│           └── page.tsx   # New transfer form
│
└── discharge/
    ├── page.tsx           # Discharge list
    └── [id]/page.tsx      # Discharge form + summary
```

---

## Backend Integration Plan (Phase 2 — Future)

When backend is ready, only `_lib/mockData.ts` and `_lib/auth.ts` need to change:

| Current (mock) | Future (real) |
|---|---|
| `mockUsers` array | `GET /api/users` |
| `localStorage` session | JWT / NextAuth.js session |
| Mock permission map | DB role table |
| Hardcoded data arrays | Prisma / Drizzle queries via Route Handlers |

Recommended: **NextAuth.js v5** for session + **Prisma + PostgreSQL** for data.
