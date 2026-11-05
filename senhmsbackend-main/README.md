# HMS Backend — Spring Boot 3

> Spring Boot 3 REST API for Sen Hospital Management System.  
> Serves all data to the Next.js frontend via JWT-authenticated endpoints.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Project Structure](#3-project-structure)
4. [Architecture & Request Flow](#4-architecture--request-flow)
5. [Authentication](#5-authentication)
6. [Database & Migrations](#6-database--migrations)
7. [Common Patterns](#7-common-patterns)
8. [Module Reference](#8-module-reference)
   - [Masters](#81-masters)
   - [Patients](#82-patients)
   - [Admissions](#83-admissions)
   - [OP Visits](#84-op-visits)
   - [Appointments](#85-appointments)
   - [Lab Investigations](#86-lab-investigations)
   - [Billing](#87-billing)
   - [Insurance Claims](#88-insurance-claims)
   - [Expenses](#89-expenses)
   - [Contacts](#810-contacts)
   - [Dashboard](#811-dashboard)
   - [Daily Summary](#812-daily-summary)
   - [Case Sheet](#813-case-sheet)
   - [Settings](#814-settings)
9. [Module Dependency Map](#9-module-dependency-map)
10. [Error Handling](#10-error-handling)

---

## 1. Tech Stack

| Component | Technology |
|---|---|
| Framework | Spring Boot 3.3, Java 21 |
| Security | Spring Security 6, JWT (JJWT) |
| Data | Spring Data JPA, Hibernate |
| Database | MySQL 8.x |
| Migrations | Flyway |
| Build | Maven 3.9 |
| Mapping | Lombok (`@Data`, `@Builder`, etc.) |
| Validation | Jakarta Bean Validation (`@NotBlank`, `@Size`, etc.) |

---

## 2. Prerequisites & Setup

### Requirements
- Java 21
- Maven 3.9+
- MySQL 8.x running on `localhost:3306`

### Database creation

```sql
CREATE DATABASE hms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Configuration (`src/main/resources/application.yml`)

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/hms_db?useSSL=false&serverTimezone=Asia/Kolkata
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:}        # set DB_PASSWORD env var; never commit a real password
  jpa:
    hibernate:
      ddl-auto: validate      # Flyway manages schema; Hibernate only validates
  flyway:
    enabled: true
    baseline-on-migrate: true
server:
  port: 8080
  servlet:
    context-path: /api        # All endpoints prefixed with /api
```

### Run

```bash
mvn spring-boot:run
```

Flyway runs all migrations automatically on startup. API available at `http://localhost:8080/api`.

### Default admin

| Field | Value |
|---|---|
| Email | admin@hms.com |
| Password | Admin@123 |

---

## 3. Project Structure

```
src/main/java/com/hms/
│
├── HmsBackendApplication.java         # Spring Boot entry point
│
├── auth/                              # Authentication module
│   ├── controller/AuthController.java # POST /auth/login
│   ├── dto/LoginRequest.java
│   ├── dto/LoginResponse.java
│   ├── filter/JwtAuthFilter.java      # Validates JWT on every request
│   └── service/AuthService.java       # Credential check + JWT generation
│
├── config/
│   ├── SecurityConfig.java            # Spring Security filter chain
│   ├── AppConfig.java                 # PasswordEncoder bean
│   ├── CorsConfig.java                # CORS for Next.js frontend
│   └── JpaConfig.java                 # JPA auditing (createdBy, updatedAt)
│
├── common/
│   ├── BaseEntity.java                # createdAt, updatedAt, createdBy, updatedBy
│   ├── ApiResponse.java               # Unified response wrapper
│   └── PagedResponse.java             # Paginated list wrapper
│
├── exception/
│   ├── GlobalExceptionHandler.java    # @RestControllerAdvice
│   ├── ResourceNotFoundException.java
│   └── DuplicateResourceException.java
│
├── masters/                           # All reference data masters
│   ├── controller/
│   │   ├── UserController.java
│   │   ├── DoctorController.java
│   │   ├── ReferrerController.java
│   │   ├── DepartmentController.java
│   │   ├── WardBedController.java
│   │   ├── InvestigationController.java
│   │   ├── LabMasterController.java
│   │   ├── BillingMasterController.java
│   │   ├── BillingModalityController.java
│   │   ├── ExpenseCategoryController.java
│   │   └── InsuranceCompanyController.java
│   ├── entity/                        # JPA entities
│   ├── dto/                           # Request + Response DTOs
│   ├── repository/                    # Spring Data JPA repositories
│   ├── service/                       # Business logic
│   └── enums/                         # DoctorStatus, Status, Gender, UserRole, etc.
│
└── modules/                           # Business modules
    ├── patient/
    ├── admission/
    ├── opvisit/
    ├── appointment/
    ├── lab/
    ├── billing/
    ├── insurance/
    ├── expense/
    ├── contact/
    ├── dashboard/
    ├── dailysummary/
    ├── casesheet/
    └── settings/
```

Each module follows a strict layered structure:
```
module/
├── controller/     # HTTP layer — routes, request parsing
├── dto/            # Request + Response objects
├── entity/         # JPA entity (maps to DB table)
├── enums/          # Module-specific enums
├── repository/     # Data access (JpaRepository + custom @Query)
└── service/        # Business logic
```

---

## 4. Architecture & Request Flow

```
Next.js Route Handler
    │
    │  GET http://localhost:8080/api/patients?search=Sharon
    │  Authorization: Bearer <jwt>
    ▼
Spring Boot Entry
    │
    ▼
JwtAuthFilter  (runs on every request)
    │
    │  1. Extracts Bearer token from Authorization header
    │  2. Validates signature + expiry using app.jwt.secret
    │  3. Sets SecurityContextHolder with username + authorities
    │  4. Calls chain.doFilter() → continues to controller
    ▼
Spring Security Filter Chain  (SecurityConfig.java)
    │
    │  All requests require authentication (except /auth/login)
    │  No role-based restrictions at Spring level — roles enforced by frontend
    ▼
PatientController.search()  (@GetMapping on /patients)
    │
    ▼
PatientService.search()
    │
    │  Builds Pageable, calls repository
    ▼
PatientRepository.search()  (custom @Query JPQL)
    │
    │  JPQL LIKE query on name/uhid/phone/email
    │  Returns Page<Patient>
    ▼
PatientService.toSummary()  (maps entity → DTO)
    │
    ▼
ApiResponse.ok(new PagedResponse<>(...))
    │
    ▼
JSON response → Next.js Route Handler → Browser
```

### Response envelope

Every response is wrapped in `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Patient not found with id: 42"
}
```

### Paginated responses use `PagedResponse<T>`:

```json
{
  "success": true,
  "data": {
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 143,
    "totalPages": 8,
    "last": false
  }
}
```

---

## 5. Authentication

**File:** `auth/controller/AuthController.java`  
**Endpoint:** `POST /auth/login`

```json
// Request
{ "email": "admin@hms.com", "password": "Admin@123" }

// Response
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "id": 1,
    "name": "System Admin",
    "email": "admin@hms.com",
    "role": "ADMIN",
    "employeeId": "ADM-0001"
  }
}
```

JWT payload contains:
- `sub` — user email
- `role` — user role (ADMIN, DOCTOR, etc.)
- `exp` — 24 hours from issue

The Next.js login route handler receives this JWT, stores it in an `httpOnly` cookie named `hms_token`, and never exposes it to browser JavaScript.

### JPA Auditing

All entities extend `BaseEntity` which auto-populates:

```java
@CreatedDate   LocalDateTime createdAt
@LastModifiedDate LocalDateTime updatedAt
@CreatedBy     String createdBy      // username from SecurityContextHolder
@LastModifiedBy String updatedBy
```

---

## 6. Database & Migrations

Schema is managed by **Flyway**. Files in `src/main/resources/db/migration/`:

| File | Tables Created |
|---|---|
| V1 | departments, users, doctors, referrers, investigations, billing_modalities, billing_masters, expense_categories, insurance_companies, wards, beds |
| V2 | contacts, expenses |
| V3 | op_visits |
| V4 | patients |
| V5 | admissions, admission_transfers |
| V6 | case_sheets, vital_entries, clinical_notes, medication_entries, care_plans |
| V7 | lab_investigations |
| V8 | bills, bill_items, bill_payments |
| V9 | insurance_claims |
| V10 | appointments |
| V11 | settings, daily_summaries |
| V12 | Seed data — demo users |

`ddl-auto: validate` means Hibernate checks that the JPA entities match the DB schema at startup. If there's a mismatch, the application will not start.

---

## 7. Common Patterns

### Repository search queries

All list endpoints support debounced full-text search via JPQL:

```java
@Query("""
    SELECT p FROM Patient p
    WHERE (:search IS NULL
           OR LOWER(p.name)  LIKE LOWER(CONCAT('%', :search, '%'))
           OR LOWER(p.uhid)  LIKE LOWER(CONCAT('%', :search, '%'))
           OR p.phone        LIKE CONCAT('%', :search, '%'))
    AND (:patientType IS NULL OR p.patientType = :patientType)
    AND (:active IS NULL OR p.active = :active)
""")
Page<Patient> search(@Param("search") String search, ...);
```

Passing `null` for a param effectively disables that filter (`:search IS NULL` is true → OR short-circuits).

### Auto-number generation

Records that require unique sequential numbers use a pattern like:

```java
// Bills: BILL-20260828-001
String datePrefix = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
int seq = repo.findMaxBillSeqForDate(datePrefix) + 1;
return String.format("BILL-%s-%03d", datePrefix, seq);
```

Similar for: UHID (`UHID-YYYYMMDD-XXXXX`), admissions (`ADM-YYYYMMDD-XXXX`), claims (`CLM-YYYYMMDD-XXXX`), OPV visits, tokens.

### Status toggle

```java
// Common pattern across all masters
public T toggleStatus(Long id) {
    Entity entity = findOrThrow(id);
    entity.setStatus(entity.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE);
    return toResponse(repo.save(entity));
}
```

---

## 8. Module Reference

### 8.1 Masters

All masters share the base path `/masters/{resource}` and use identical CRUD patterns.

| Resource | Path | Entity |
|---|---|---|
| Users | `/masters/users` | `users` table |
| Doctors | `/masters/doctors` | `doctors` table |
| Referrers | `/masters/referrers` | `referrers` table |
| Departments | `/masters/departments` | `departments` table |
| Wards & Beds | `/masters/wards` | `wards` + `beds` tables |
| Investigations | `/masters/investigations` | `investigations` table |
| Lab Masters | `/masters/lab-masters` | `lab_masters` table |
| Billing Modality | `/masters/billing-modalities` | `billing_modalities` table |
| Billing Masters | `/masters/billing-masters` | `billing_masters` table |
| Expense Category | `/masters/expense-categories` | `expense_categories` table |
| Insurance Company | `/masters/insurance-companies` | `insurance_companies` table |

**Common endpoints:**

```
GET    /masters/{resource}                       list / search (with optional ?search=, ?page=, ?size=)
GET    /masters/{resource}/{id}                  single record
POST   /masters/{resource}                       create
PUT    /masters/{resource}/{id}                  update
PATCH  /masters/{resource}/{id}/toggle-status    activate / deactivate
```

**Ward/Bed specific:**

```
GET    /masters/wards/{wardId}/beds              all beds in ward
GET    /masters/wards/{wardId}/beds/available    available beds only
POST   /masters/wards/beds                       add bed
PATCH  /masters/wards/beds/{bedId}/status        update bed status
DELETE /masters/wards/beds/{bedId}               delete bed
```

**Side effect — auto contact creation:**

When a Doctor, Referrer, or Insurance Company is created, `ContactService.create()` is called automatically to add a corresponding Contact record. This ensures the Contacts menu always reflects all key people in the system.

| Master Created | Contact Type | Contact Name |
|---|---|---|
| Doctor | `DOCTOR` | Doctor name |
| Referrer | `OTHER` | Referrer name |
| Insurance Company | `INSURANCE` | Contact person name |

---

### 8.2 Patients

**Base path:** `/patients`  
**Entity:** `Patient` (`patients` table)  
**UHID format:** `UHID-YYYYMMDD-XXXXX`

```
GET    /patients                        paginated search (?search=, ?patientType=, ?active=)
GET    /patients/{id}                   full record
GET    /patients/uhid/{uhid}            lookup by UHID
POST   /patients                        register new patient (UHID auto-generated)
PUT    /patients/{id}                   update
PATCH  /patients/{id}/toggle-status     activate/deactivate
```

**Search fields:** name, UHID, phone, email  
**`PatientSummaryResponse`** includes `dateOfBirth` so the frontend can recalculate current age on each visit.

**Depends on:** nothing (foundational module)

---

### 8.3 Admissions

**Base path:** `/admissions`  
**Entity:** `Admission` (`admissions` table) + `AdmissionTransfer` (`admission_transfers` table)  
**Admission No format:** `ADM-YYYYMMDD-XXXX`

```
GET    /admissions                                   paginated search
GET    /admissions/{id}                              full record + transfers
GET    /admissions/no/{admissionNo}                  by number
GET    /admissions/patient/{patientId}               all admissions for patient
POST   /admissions                                   admit patient (marks bed OCCUPIED)
PATCH  /admissions/{id}/status                       update condition
POST   /admissions/{id}/transfers                    log ward/bed/doctor transfer
PATCH  /admissions/{id}/initiate-discharge           mark discharge initiated
POST   /admissions/{id}/discharge                    complete discharge (frees bed)
```

**Depends on:** Patients (UHID), Masters/Wards (bed assignment), Masters/Doctors

---

### 8.4 OP Visits

**Base path:** `/op-visits`  
**Entity:** `OPVisit` (`op_visits` table)  
**Visit No format:** `OPV-YYYY-XXXXX`  
**Token format:** `T001`, `T002`… (resets daily per doctor)

```
GET    /op-visits/queue                    today's queue (?date=, ?search=, ?doctorId=, ?status=)
GET    /op-visits/queue/stats              count by status for date
GET    /op-visits                          paginated search across dates
GET    /op-visits/{id}                     single visit
GET    /op-visits/patient/{uhid}           visit history for patient
POST   /op-visits                          create visit (auto-registers walk-in patients)
PATCH  /op-visits/{id}/status              advance status
```

**Walk-in patient auto-registration:**

When `patientId` is null or UHID starts with `WALK-`, `OPVisitService.create()` automatically calls `PatientService.create()` to register the patient first. The DOB is stored on the Patient record so age recalculates correctly on future visits.

**Age calculation on visit:**

1. If `dob` is sent in the request → calculate from DOB
2. Else if `patientId` exists → look up stored DOB from `patients` table, calculate
3. Else → use `age` field as-is

**Depends on:** Patients (auto-registration), Masters/Doctors (doctor validation)

---

### 8.5 Appointments

**Base path:** `/appointments`  
**Entity:** `Appointment` (`appointments` table)

```
GET    /appointments                       paginated search (?date=, ?doctorId=, ?status=, ?type=)
GET    /appointments/{id}                  single
POST   /appointments                       book
PATCH  /appointments/{id}/status           confirm / complete / cancel / no-show
```

**Depends on:** Patients, Masters/Doctors, Masters/Departments

---

### 8.6 Lab Investigations

**Base path:** `/lab/investigations`  
**Entity:** `LabInvestigation` (`lab_investigations` table)  
**Lab ID format:** `LAB-YYYYMMDD-XXXXX`

```
GET    /lab/investigations                  paginated search (?search=, ?status=, ?dateFrom=, ?dateTo=, ?doctorId=)
GET    /lab/investigations/{id}             single record
POST   /lab/investigations                  place order (multiple tests in one call)
PATCH  /lab/investigations/{id}/collect     mark sample collected (Pending → In Progress)
PATCH  /lab/investigations/{id}/result      enter result (In Progress → Completed)
PATCH  /lab/investigations/{id}/cancel      cancel
GET    /lab/tat-report                      turnaround time analysis
```

**Status flow:** `PENDING → IN_PROGRESS → COMPLETED` (or `CANCELLED`)

**Depends on:** Patients, Masters/Investigations (test catalog)

---

### 8.7 Billing

**Base path:** `/bills`  
**Entity:** `Bill` (`bills` table) + `BillItem` (`bill_items` table) + `BillPayment` (`bill_payments` table)  
**Bill No format:** `BILL-YYYYMMDD-XXX`

```
GET    /bills                              paginated search (?search=, ?status=, ?patientType=, ?insurance=, ?dateFrom=, ?dateTo=)
GET    /bills/{id}                         full bill with items and payments
GET    /bills/patient/{patientId}          all bills for patient
POST   /bills                              create bill
PUT    /bills/{id}                         update (Draft/Pending only)
PATCH  /bills/{id}/payment                 record payment
PATCH  /bills/{id}/insurance               update insurance details
PATCH  /bills/{id}/cancel                  cancel with reason
```

**Search fields:** patientName, UHID, billNo

**Depends on:** Patients, Masters/BillingMasters (service catalog), Masters/InsuranceCompanies

---

### 8.8 Insurance Claims

**Base path:** `/insurance/claims`  
**Entity:** `InsuranceClaim` (`insurance_claims` table)  
**Claim No format:** `CLM-YYYYMMDD-XXX`

```
GET    /insurance/claims                    paginated search (?search=, ?status=, ?company=, ?dateFrom=, ?dateTo=)
GET    /insurance/claims/{id}               single claim
GET    /insurance/claims/patient/{id}       all claims for patient
POST   /insurance/claims                    create claim (usually auto-triggered from billing)
PATCH  /insurance/claims/{id}/status        update status + settlement amounts
```

**Status flow:** `SUBMITTED → UNDER_REVIEW → APPROVED → PARTIAL/SETTLED` or `REJECTED`

**Search fields:** patientName, UHID, claimNo, insuranceCompany

**Depends on:** Patients, Billing (linked billId), Masters/InsuranceCompanies

---

### 8.9 Expenses

**Base path:** `/expenses`  
**Entity:** `Expense` (`expenses` table)

```
GET    /expenses                           paginated search (?search=, ?status=, ?category=, ?dateFrom=, ?dateTo=)
GET    /expenses/{id}                      single
POST   /expenses                           create (status = PENDING)
PUT    /expenses/{id}                      update (Pending only)
PATCH  /expenses/{id}/approve              Pending → Approved
PATCH  /expenses/{id}/reject               Pending → Rejected
PATCH  /expenses/{id}/pay                  Approved → Paid
DELETE /expenses/{id}                      delete (Pending only)
```

**Depends on:** Masters/ExpenseCategories

---

### 8.10 Contacts

**Base path:** `/contacts`  
**Entity:** `Contact` (`contacts` table)

```
GET    /contacts                           paginated search (?search=, ?type=)
GET    /contacts/{id}                      single
POST   /contacts                           create
PUT    /contacts/{id}                      update
DELETE /contacts/{id}                      delete
```

**Contact types:** `DOCTOR`, `VENDOR`, `STAFF`, `INSURANCE`, `OTHER`

Contacts are also **auto-created** when Doctors, Referrers, and Insurance Companies are added through Masters.

**Depends on:** nothing (standalone reference module)

---

### 8.11 Dashboard

**Base path:** `/dashboard`

```
GET    /dashboard/summary                  all KPI counts + amounts for today
GET    /dashboard/monthly-revenue?year=    12-month revenue breakdown
```

`DashboardSummaryResponse` aggregates data from: op_visits, admissions, beds, bills, insurance_claims, lab_investigations, appointments.

**Depends on:** All modules (read-only aggregation)

---

### 8.12 Daily Summary

**Base path:** `/daily-summary`

```
GET    /daily-summary?date=                day-level summary (OP, IP, Bills, Lab, Insurance)
GET    /daily-summary/insurance-claims     insurance claim summary for date range
```

**Depends on:** OPVisits, Billing, InsuranceClaims, Lab

---

### 8.13 Case Sheet

**Base path:** `/case-sheet`  
**Entities:** `CaseSheet`, `VitalEntry`, `ClinicalNote`, `MedicationEntry`, `CarePlan`

```
GET    /case-sheet/{patientId}             full case sheet for patient
POST   /case-sheet/{patientId}/vitals      add vital signs entry
POST   /case-sheet/{patientId}/notes       add clinical note
POST   /case-sheet/{patientId}/medications add medication entry
POST   /case-sheet/{patientId}/care-plans  add care plan
```

**Depends on:** Patients, Admissions (current admission context)

---

### 8.14 Settings

**Base path:** `/settings`

```
GET    /settings/bill-customization        hospital name, logo, address for bills
PUT    /settings/bill-customization        update
```

**Depends on:** nothing

---

## 9. Module Dependency Map

```
patients ◄──────────────────────────────────────────────────────────────────────────
   ▲        is referenced by every clinical/billing module
   │
   ├─── op_visits ──────────────────► masters/doctors
   │         │                           ▲
   │         └── (auto-registers) ───► patients
   │
   ├─── admissions ─────────────────► masters/wards + masters/beds
   │         │                           ▲
   │         └── admission_transfers     └── masters/wards
   │
   ├─── appointments ───────────────► masters/doctors + masters/departments
   │
   ├─── lab_investigations ─────────► masters/investigations (test catalog)
   │
   ├─── bills ──────────────────────► masters/billing_masters (service items)
   │         │                        masters/insurance_companies
   │         └── bill_payments
   │
   └─── insurance_claims ───────────► bills (linked billId)
                                      masters/insurance_companies

contacts ◄────── masters/doctors (auto-created on Doctor create)
         ◄────── masters/referrers (auto-created on Referrer create)
         ◄────── masters/insurance_companies (auto-created on InsuranceCompany create)

dashboard ───────────► all modules (read-only aggregation)
daily_summary ──────► op_visits + bills + insurance_claims + lab

case_sheet ─────────► patients + admissions

expenses ───────────► masters/expense_categories
```

### Key cross-module rules

| Rule | Where enforced |
|---|---|
| OPVisit must reference a valid doctor | `OPVisitService` — token generated per doctor/day |
| Walk-in patients auto-registered | `OPVisitService.create()` → `PatientService.create()` |
| Age recalculated from DOB at visit time | `OPVisitService` — `calculateAge(storedDob)` |
| Admitting a patient marks bed OCCUPIED | `AdmissionService` → `WardBedService.occupyBed()` |
| Discharge frees the bed | `AdmissionService` → `WardBedService.releaseBed()` |
| Bill payment with Insurance mode links to claim | `BillingService` — sets `insurance=true` |
| Doctor/Referrer/InsuranceCompany creation → Contact | `DoctorService`, `ReferrerService`, `InsuranceCompanyService` |

---

## 10. Error Handling

All errors go through `GlobalExceptionHandler` (`@RestControllerAdvice`):

| Exception | HTTP Status | Response |
|---|---|---|
| `ResourceNotFoundException` | 404 | `{ success: false, error: "Patient not found with id: 42" }` |
| `DuplicateResourceException` | 409 | `{ success: false, error: "UHID already exists" }` |
| `@Valid` validation failure | 400 | `{ success: false, error: "Name is required; Phone is required" }` |
| JWT expired / invalid | 401 | `{ success: false, error: "Unauthorized" }` |
| Any unhandled exception | 500 | `{ success: false, error: "Internal server error" }` |

The frontend's `apiFetch` helper checks `json.success` on every response and surfaces `json.error` in the UI.
