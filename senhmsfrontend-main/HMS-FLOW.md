# MediCare HMS — Module Flow & Functionality Reference

> Generated from source code. Last updated: 2026-08-19

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [OP Token Queue](#2-op-token-queue)
3. [Masters](#3-masters)
4. [Patient & Admissions](#4-patient--admissions)
5. [Lab](#5-lab)
6. [Appointments](#6-appointments)
7. [Bills](#7-bills)
8. [Insurance](#8-insurance)
9. [Expenses](#9-expenses)
10. [Contacts](#10-contacts)
11. [Reports](#11-reports)
12. [Role-Based Access Summary](#12-role-based-access-summary)

---

## 1. Dashboard

**Route:** `/dashboard`  
**Access:** All roles

### Overview Cards (8 KPIs)
| Card | Data Source |
|---|---|
| Today's OP Patients | OP visits filtered to today |
| IP Admitted | Patients with status = Admitted |
| Bed Occupancy % | Occupied / Total beds |
| Today's Revenue | Bills paid today |
| Pending Bills | Sum of due amounts on Pending/Partial bills |
| Pending Claims | Insurance claims Submitted/Under Review |
| Pending Lab Tests | Lab tests Pending or In Progress |
| Today's Appointments | Appointments scheduled for today |

### Charts
- **Revenue Overview (Area Chart)** — Monthly revenue Jan→Dec, animates left to right on load
- **Patient Mix (Donut Chart)** — OP / IP Admitted / Discharged breakdown, spin-in animation on load
- **Bed Occupancy (Ward-wise bars)** — Per-ward progress bars, color-coded (green < 70%, amber 70–90%, red > 90%)
- **Lab Status (Bar Chart)** — Pending / In Progress / Completed / STAT counts

### Other Widgets
- **Today's Appointments Table** — Token No, Patient, Doctor, Dept, Time, Status (top 6)
- **Recent Admissions** — Last 5 admitted IP patients with ward, bed, condition, days admitted
- **Quick Actions** — Register / New Bill / Ward View / Lab / Reports / Appointments shortcuts
- **System Summary** — All key metrics in one dot-list

### Role-Specific Dashboards
| Role | Dashboard View |
|---|---|
| Admin | Full dashboard — all widgets |
| Doctor | Own appointments, IP round patients, pending lab results |
| Receptionist | Today's OP queue, appointments, quick register |
| Lab Tech | Pending/in-progress lab tests only |
| Insurance Coordinator | Pending claims, submitted/under review |
| Nurse | Ward-wise patients, condition alerts |

---

## 2. OP Token Queue

**Route:** `/op-visits`  
**Access:** Admin, Doctor, Receptionist, Nurse (view only)

### Flow
```
Register Patient → Assign Doctor → Token Issued (Waiting)
    → In Consultation → Consultation Done → Billed → Paid
```

### Features
- **Token generation** — Auto-increment token number per day
- **New visit registration** — Search existing patient by UHID or register new
- **Chief complaint** input at registration
- **Doctor suggestion** — Suggests doctors based on illness/chief complaint keyword
- **Status progression** — One-click advance through the status flow above
- **Filters** — By doctor, status, date
- **Search** — By patient name, UHID, token number

### Status Colors
| Status | Color |
|---|---|
| Waiting | Amber |
| In Consultation | Sky |
| Consultation Done | Emerald |
| Billed | Indigo |
| Paid | Green |

---

## 3. Masters

All masters are management/setup screens. **Access: Admin only** (some viewable by relevant roles).

### 3.1 Users (`/masters/users`)
- Create / edit / deactivate system users
- Assign role: Admin, Doctor, Receptionist, Lab Tech, Insurance Coordinator, Nurse
- Set Employee ID, email, password, department

### 3.2 Doctor List (`/masters/doctors`)
- Add / edit doctors with specialisation, department, fees
- Set availability schedule
- Viewable by Receptionist, Nurse

### 3.3 Referrer List (`/masters/referrers`)
- Manage external referrers (doctors/clinics that refer patients)
- Used in patient registration for referral tracking in reports

### 3.4 Departments (`/masters/departments`)
- Hospital departments (Cardiology, General Medicine, Ortho, etc.)
- Used in doctor assignment, OP visits, appointments

### 3.5 Wards & Beds (`/masters/wards-beds`)
- Create wards, set total bed count
- Add individual beds with type (General, Private, ICU, etc.)
- Track occupied / available status
- Used in IP admission and ward view

### 3.6 Investigation Masters (`/masters/investigations`)
- Define lab test catalog: test code, name, category, normal range, unit, sample type, price
- Feeds into lab order entry

### 3.7 Lab Masters (`/masters/lab`)
- Lab department configuration, lab equipment, reporting templates

### 3.8 Billing Modality (`/masters/billing-modality`)
- Service categories: Consultation, Procedure, Lab, Pharmacy, Room Rent, etc.
- Used to group billing line items

### 3.9 Billing Masters (`/masters/billing-masters`)
- Service/item catalog: code, name, modality, unit price, discount allowed flag
- Drives the bill line-item picker

### 3.10 Expense Category (`/masters/expense-category`)
- Categories for hospital expenses: Medicines, Equipment, Utilities, Salary, etc.

### 3.11 Insurance Company (`/masters/insurance-company`)
- Insurance company list with TPA name, contact details, policy terms
- Used in patient registration and insurance claim creation

---

## 4. Patient & Admissions

**Route:** `/patients`  
**Access:** Admin (full), Doctor/Receptionist (full), Nurse (view), Insurance Coordinator (view)

### 4.1 Patient Registration Flow
```
New Patient Registration
  ├── Personal Details (name, DOB, gender, blood group, religion, marital status)
  ├── Contact Details (phone, alternate phone, email, address, area, district)
  ├── Medical Details (illness, referrer, doctor, department)
  ├── Visit Type → OP or IP
  │     ├── OP → Token issued, enters OP queue
  │     └── IP → Ward/Bed selection, admission type (Elective/Emergency/Maternity)
  └── Insurance Details (optional — company, policy number)
```

### 4.2 Filter Views (Tabs)
| Tab | Shows |
|---|---|
| All | Every registered patient |
| Out Patients | type = OP |
| In Patients | type = IP (all) |
| In Patients – In Bed | IP + status = Admitted |
| In Patients – Discharged | IP + status = Discharged |

### 4.3 Patient Record Actions
- **Edit** — Update demographics, contact, insurance
- **Admit (OP → IP)** — Move OP patient to IP with ward/bed assignment
- **Status Updates** — Add clinical notes/status timeline (visible to doctors/nurses)
- **View Bills** — All bills linked to patient
- **Order Lab Tests** — Directly from patient record

### 4.4 Sub-pages
| Page | Route | Purpose |
|---|---|---|
| Inpatients | `/patients/inpatients` | All currently admitted patients |
| Inpatients – Bed | `/patients/inpatients-bed` | Bed-level view of admitted patients |
| Ward View | `/patients/ward-view` | Visual ward map showing each bed and patient |

### 4.5 Admissions (`/admissions`)
> 🚧 Under Development — IP admission management (formal admission form, discharge summary)

---

## 5. Lab

**Route:** `/lab/investigations`  
**Access:** Lab Tech (full), Admin (full), Doctor (view + order), Nurse (view)

### 5.1 Lab Investigation Flow
```
Doctor/Receptionist orders test
    → Test created (Pending)
    → Lab Tech collects sample (In Progress)
    → Lab Tech enters result (Completed)
    → Result viewable by Doctor / Patient record
    → (Optional) Cancel at any stage
```

### 5.2 Features
- **Order new tests** — Search patient, pick tests from catalog (multi-test per order)
- **Priority flags** — Routine / Urgent / STAT (STAT shown in red everywhere)
- **Sample collection** — One-click "Collect Sample" moves to In Progress
- **Result entry** — Enter result value, reference range auto-filled from master
- **Filters** — Status, priority, category, date range, search
- **TAT Report** (`/lab/tat-report`) — Turnaround time analysis per test/category

### 5.3 Status Flow
```
Pending → In Progress → Completed
              ↓
           Cancelled (any stage)
```

---

## 6. Appointments

**Route:** `/appointments/list`  
**Access:** Admin (full), Doctor (own appointments), Receptionist (full), Nurse (view)

### 6.1 Appointment Flow
```
Book Appointment (Receptionist/Admin)
    → Scheduled
    → Confirmed (Receptionist confirms)
    → In Progress (Doctor starts consultation)
    → Completed
    OR
    → No Show / Cancelled
```

### 6.2 Features
- **Book appointment** — Patient (existing UHID or new), doctor, department, date, time, type
- **Appointment types** — New / Follow-up / Review / IP Rounds
- **Token issue** — Issue OP token directly from appointment
- **Tabs** — All / Scheduled / Confirmed / In Progress / Completed / No Show / Cancelled / IP Rounds
- **Filters** — Date, department, doctor, search by name
- **IP Rounds tab** — Shows admitted patients scheduled for doctor ward rounds

### 6.3 Group SMS (`/appointments/sms`)
- Send SMS reminders to patients for upcoming appointments
- Filter by date range, doctor, department
- Bulk select and send

---

## 7. Bills

**Route:** `/bills`  
**Access:** Admin (full), Receptionist (full), Doctor (view), Insurance Coordinator (view)

### 7.1 Billing Flow
```
Create Bill (link to patient)
    → Add line items (services from Billing Masters)
    → Apply discounts per item or bill-level
    → Save as Draft or Pending
    → Record Payment (Cash/Card/UPI/Cheque/Insurance)
         ├── Full payment → Paid
         ├── Partial payment → Partial
         └── Insurance → triggers insurance claim
    → Print / Share bill
    → Cancel if needed
```

### 7.2 Bill Line Items
- Pick services from Billing Masters catalog
- Set quantity, unit price auto-filled, discount (if allowed)
- Multiple modalities in one bill (Consultation + Lab + Room Rent, etc.)

### 7.3 Payment Modes
`Cash` | `Card` | `UPI` | `Cheque` | `Insurance`

### 7.4 Bill Statuses
| Status | Meaning |
|---|---|
| Draft | Saved but not finalised |
| Pending | Awaiting payment |
| Partial | Partially paid |
| Paid | Fully paid |
| Cancelled | Voided |

### 7.5 Insurance on Bill
- Flag bill as insurance-linked
- Set company, policy, TPA
- Auto-creates or links insurance claim record

---

## 8. Insurance

**Route:** `/insurance`  
**Access:** Admin (full), Insurance Coordinator (full)

### 8.1 Claims Flow
```
Bill created with Insurance payment mode
    → Insurance Claim auto-created (Submitted)
    → Coordinator updates: Under Review
    → Company responds:
         ├── Approved → record approved amount
         ├── Partial → record partial settlement
         ├── Settled → final payment received, bill updated
         └── Rejected → reason noted, bill reverted to pending
```

### 8.2 Features
- **Claim list** — Tabbed by status: All / Submitted / Under Review / Approved / Partial / Settled / Rejected
- **Claim details** — Patient, UHID, bill no, admission date, diagnosis, TPA, policy no, claim amount
- **Status updates** — Move claim through lifecycle with notes
- **Record payment** — Enter settlement amount received
- **Filters** — Company, status, date range, search

### 8.3 Sub-reports
| Page | Route | Purpose |
|---|---|---|
| Claims Received | `/insurance/claims-received` | Claims received from companies |
| Claims Report | `/insurance/claims-report` | Summary report |
| Claims Pending Report | `/insurance/claims-pending-report` | Outstanding/aging claims |

---

## 9. Expenses

**Route:** `/expenses`  
**Access:** Admin (full), Insurance Coordinator (view), Others (view)

### 9.1 Expense Flow
```
Staff creates expense entry (Pending)
    → Admin reviews → Approved or Rejected
    → Mark as Paid (record payment reference)
```

### 9.2 Features
- **Add expense** — Date, category (from master), towards, amount, payment mode, reference no, description
- **Approval workflow** — Pending → Approved → Paid (Admin only)
- **Reject** — With reason
- **Filters** — Category, status, date range, search
- **Payment modes** — Cash / Bank Transfer / UPI / Cheque

### 9.3 Expense Statuses
| Status | Color |
|---|---|
| Pending | Amber |
| Approved | Green |
| Paid | Sky |
| Rejected | Red |

---

## 10. Contacts

**Route:** `/contacts`  
**Access:** Admin (full), Receptionist (full), Others (view)

### Features
- **Contact types** — Doctor / Vendor / Staff / Insurance / Other
- **Add/edit/delete** contacts
- **Fields** — Name, type, phone, organisation, address, notes
- **Filters** — By type, search by name/phone/org
- Used for quick reference — supplier contacts, insurance company reps, visiting doctors

---

## 11. Reports

**Route:** `/reports/*`  
**Access:** Admin (full), limited access for others

> Most report pages are currently under development (`UnderDevelopment` placeholder).

| Report | Route | Description |
|---|---|---|
| Admission Form | `/reports/admission-form` | Printable IP admission form |
| Collection Report | `/reports/collection` | Daily/weekly/monthly collection summary |
| Income Report | `/reports/income` | Revenue by service category |
| Expense List Report | `/reports/expense-list` | Expense register with filters |
| OP – Doctor Wise | `/reports/op-doctor-wise` | OP patient count and revenue per doctor |
| OP – Referrer Wise | `/reports/op-referrer-wise` | Referral source analysis for OP |
| IP – Doctor Wise | `/reports/ip-doctor-wise` | IP admissions and revenue per doctor |
| IP – Referrer Wise | `/reports/ip-referrer-wise` | Referral source analysis for IP |

---

## 12. Role-Based Access Summary

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ Full | ✅ Own | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| OP Token Queue | ✅ | ✅ | ✅ | ❌ | ❌ | 👁 View |
| Masters | ✅ Full | 👁 Some | 👁 Some | 👁 Lab | 👁 Insurance | 👁 Some |
| Patients | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Lab | ✅ | 👁 + Order | ❌ | ✅ Full | ❌ | 👁 |
| Appointments | ✅ | ✅ Own | ✅ | ❌ | ❌ | 👁 |
| Bills | ✅ | 👁 | ✅ | ❌ | 👁 | ❌ |
| Insurance | ✅ | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Expenses | ✅ Full | ❌ | 👁 | 👁 | 👁 | 👁 |
| Contacts | ✅ | 👁 | ✅ | ❌ | 👁 | ❌ |
| Reports | ✅ | 👁 Own | 👁 Some | ❌ | ❌ | ❌ |

---

## 13. Pending / Under Development Modules

| Module | Status | Notes |
|---|---|---|
| Admissions (formal IP) | 🚧 Planned | Formal admission form, discharge summary |
| Collection Report | 🚧 Planned | |
| Income Report | 🚧 Planned | |
| Expense List Report | 🚧 Planned | |
| OP Doctor/Referrer Reports | 🚧 Planned | |
| IP Doctor/Referrer Reports | 🚧 Planned | |
| Pharmacy | ❌ Not started | Drug inventory, dispensing |
| OT / Surgery Schedule | ❌ Not started | Operation theatre management |
| Discharge Summary | ❌ Not started | Clinical discharge documentation |
| Patient Portal | ❌ Not started | Self-service for patients |
| Payroll / HR | ❌ Not started | Staff salary management |
| Inventory | ❌ Not started | Medical supplies and assets |

---

*MediCare HMS — Built with Next.js 14 (App Router) + TypeScript + Tailwind CSS*  
*Backend target: Spring Boot + PostgreSQL*
