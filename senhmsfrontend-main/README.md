# HMS Frontend — Next.js 15

> Next.js 15 App Router frontend for Sen Hospital Management System.  
> Communicates with the Spring Boot backend exclusively through internal API proxy routes.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Folder Structure](#2-folder-structure)
3. [Request Flow — How a Browser Call Reaches Spring Boot](#3-request-flow)
4. [Authentication & Session](#4-authentication--session)
5. [Sidebar & Navigation](#5-sidebar--navigation)
6. [Shared Components](#6-shared-components)
7. [Module Pages](#7-module-pages)
8. [Role-Based Access](#8-role-based-access)
9. [Running Locally](#9-running-locally)

---

## 1. Tech Stack

| Tool | Purpose |
|---|---|
| Next.js 15 (App Router) | Framework + server-side API proxy routes |
| React 19 | UI rendering |
| TypeScript | Type safety throughout |
| Tailwind CSS v4 | Styling |
| `js-cookie` / `httpOnly` cookie | JWT storage (set by Next.js API route, not JS) |

---

## 2. Folder Structure

```
HMS/
├── app/
│   ├── layout.tsx                        # Root HTML layout
│   ├── globals.css                       # Tailwind base styles
│   ├── page.tsx                          # Login page (public)
│   │
│   ├── _components/                      # Shared UI components (prefixed _ to exclude from routing)
│   │   ├── Sidebar.tsx                   # Role-filtered navigation menu
│   │   ├── Header.tsx                    # Top bar: greeting, global search, user menu
│   │   ├── Modal.tsx                     # Accessible modal + FormField / Input / Select / Textarea
│   │   ├── Badge.tsx                     # Status pill badges
│   │   ├── PageHeader.tsx                # Page title + breadcrumbs + primary action button
│   │   ├── StatCard.tsx                  # KPI card with icon, value, subtitle
│   │   └── UnderDevelopment.tsx          # Placeholder for incomplete modules
│   │
│   ├── _lib/                             # Non-component utilities
│   │   ├── auth.ts                       # Session helpers, role types, canEdit()
│   │   ├── types.ts                      # Shared TypeScript interfaces
│   │   └── useMaster.ts                  # Generic hook for fetching paginated masters lists
│   │
│   ├── api/                              # Next.js Route Handlers — proxy layer to Spring Boot
│   │   ├── auth/login/route.ts           # POST /api/auth/login
│   │   ├── patients/[[...segments]]/route.ts
│   │   ├── admissions/[[...segments]]/route.ts
│   │   ├── op-visits/[[...segments]]/route.ts
│   │   ├── appointments/[[...segments]]/route.ts
│   │   ├── lab/[[...segments]]/route.ts
│   │   ├── bills/[[...segments]]/route.ts
│   │   ├── insurance/[[...segments]]/route.ts
│   │   ├── expenses/[[...segments]]/route.ts
│   │   ├── contacts/[[...segments]]/route.ts
│   │   ├── masters/[[...segments]]/route.ts
│   │   ├── dashboard/[[...segments]]/route.ts
│   │   ├── daily-summary/[[...segments]]/route.ts
│   │   ├── case-sheet/[[...segments]]/route.ts
│   │   └── settings/[[...segments]]/route.ts
│   │
│   └── (dashboard)/                      # Route group — all pages inside share DashboardLayout
│       ├── layout.tsx                    # Auth guard + Sidebar + Header shell
│       ├── dashboard/page.tsx            # Role-aware KPI dashboard
│       ├── op-visits/page.tsx            # OP Token Queue
│       ├── patients/
│       │   ├── page.tsx                  # Patient list (all tabs)
│       │   ├── inpatients/page.tsx
│       │   ├── inpatients-bed/page.tsx
│       │   ├── ward-view/page.tsx
│       │   └── [patientId]/case-sheet/page.tsx
│       ├── admissions/page.tsx
│       ├── appointments/
│       │   ├── list/page.tsx
│       │   └── sms/page.tsx
│       ├── lab/
│       │   ├── investigations/page.tsx
│       │   └── tat-report/page.tsx
│       ├── bills/page.tsx
│       ├── insurance/
│       │   ├── page.tsx
│       │   ├── claims-received/page.tsx
│       │   ├── claims-report/page.tsx
│       │   └── claims-pending-report/page.tsx
│       ├── expenses/page.tsx
│       ├── contacts/page.tsx
│       ├── daily-summary/
│       │   ├── page.tsx
│       │   ├── day-report/page.tsx
│       │   └── insurance-claims/page.tsx
│       ├── reports/
│       │   ├── admission-form/page.tsx
│       │   ├── collection/page.tsx
│       │   └── expense-list/page.tsx
│       ├── masters/
│       │   ├── users/page.tsx
│       │   ├── doctors/page.tsx
│       │   ├── referrers/page.tsx
│       │   ├── departments/page.tsx
│       │   ├── wards-beds/page.tsx
│       │   ├── investigations/page.tsx
│       │   ├── lab/page.tsx
│       │   ├── billing-modality/page.tsx
│       │   ├── billing-masters/page.tsx
│       │   ├── expense-category/page.tsx
│       │   └── insurance-companies/page.tsx
│       └── settings/
│           └── bill-customization/page.tsx
│
├── proxy.ts                              # Next.js middleware — JWT cookie check on all dashboard routes
└── .env.local                            # BACKEND_URL=http://localhost:8080/api
```

---

## 3. Request Flow

This is the complete path a browser API call takes from the React component to the Spring Boot database and back.

```
Browser (React Component)
        │
        │  fetch("/api/patients?search=Sharon&page=0&size=15")
        ▼
Next.js Middleware  (proxy.ts)
        │
        │  Runs on EVERY request to /dashboard/*, /patients/*, etc.
        │  Checks for "hms_token" cookie
        │  → Missing cookie? Redirect to /
        │  → Cookie present? NextResponse.next()
        ▼
Next.js Route Handler  (app/api/patients/[[...segments]]/route.ts)
        │
        │  1. Reads "hms_token" from httpOnly cookie (server-side only)
        │  2. Builds Spring Boot URL:
        │     http://localhost:8080/api/patients?search=Sharon&page=0&size=15
        │  3. Forwards the JWT as Authorization: Bearer <token>
        │  4. Proxies the HTTP method + body
        ▼
Spring Boot  (localhost:8080/api)
        │
        │  JwtAuthFilter validates the Bearer token
        │  Routes to PatientController.search()
        │  Queries MySQL via JPA/Hibernate
        ▼
MySQL Database  (hms_db)
        │
        │  Returns rows
        ▼
Spring Boot  →  JSON response  →  Next.js Route Handler
        │
        │  Parses JSON, returns NextResponse.json(data)
        ▼
Browser (React Component)
        │
        │  const { ok, data } = await apiFetch("/api/patients?...")
        │  Updates React state → re-renders UI
```

### Why the proxy layer?

The Next.js proxy routes serve three purposes:

1. **Security** — The JWT is stored in an `httpOnly` cookie. Browser JS cannot read it. Only the Next.js server-side route handler can attach it to the Spring Boot request.
2. **CORS** — The browser never talks directly to `localhost:8080`. All requests go to `localhost:3000/api/*` which avoids CORS entirely.
3. **Unified API surface** — Frontend code only knows about `/api/*` paths. Switching backend URL only requires changing `BACKEND_URL` in `.env.local`.

### Catch-all proxy pattern

Every module has a catch-all route handler like:

```typescript
// app/api/patients/[[...segments]]/route.ts
const path = `/patients${segments.length ? "/" + segments.join("/") : ""}`;
const url  = `${BACKEND}${path}${req.nextUrl.search}`;
// Forwards method, headers, body, query string — everything
```

This single file handles:
- `GET /api/patients` → `GET http://localhost:8080/api/patients`
- `GET /api/patients/42` → `GET http://localhost:8080/api/patients/42`
- `POST /api/patients` → `POST http://localhost:8080/api/patients`
- `PATCH /api/patients/42/toggle-status` → etc.

---

## 4. Authentication & Session

### Login flow

```
User submits email + password on /  (page.tsx)
    │
    ▼
POST /api/auth/login  (app/api/auth/login/route.ts)
    │
    │  Forwards to Spring Boot POST /auth/login
    │  Spring Boot validates credentials, returns JWT
    │
    ▼
Next.js route handler sets httpOnly cookie:
    Set-Cookie: hms_token=<jwt>; HttpOnly; Path=/; SameSite=Strict
    │
    ▼
Also stores session in localStorage (non-sensitive fields only):
    { id, name, role, email, doctorId }
    │
    ▼
Redirects to /dashboard
```

### Session helpers (`_lib/auth.ts`)

```typescript
// Read session from localStorage
getSession(): Session | null

// Check if role can edit a given module
canEdit(role: Role, permKey: string): boolean

// Logout — clears cookie + localStorage
logout(): Promise<void>

// Role type
type Role = "Admin" | "Doctor" | "Receptionist" | "Lab Tech" | "Insurance Coordinator" | "Nurse"
```

### Dashboard layout guard (`(dashboard)/layout.tsx`)

```typescript
useEffect(() => {
  const s = getSession();
  if (!s) router.replace("/");  // No session → back to login
  setSession(s);
}, []);
```

---

## 5. Sidebar & Navigation

**File:** `app/_components/Sidebar.tsx`

The sidebar is a static nav tree where each item has a `permKey`. Items are shown or hidden based on `canEdit(role, permKey)`.

### Nav tree structure

```typescript
interface NavLeaf {
  kind: "leaf"
  href: string        // e.g. "/masters/doctors"
  label: string
  permKey: string     // maps to permission check
}

interface NavGroup {
  kind: "group"
  key: string
  label: string
  icon: ReactNode
  entries: NavLeaf[]
}
```

### Permission filtering

```typescript
// In Sidebar.tsx
const visibleGroups = NAV_TREE.filter(group =>
  group.entries.some(e => canView(role, e.permKey))
)
```

### Nav sections

| Section | Key Routes |
|---|---|
| Dashboard | `/dashboard` |
| OP Token Queue | `/op-visits` |
| Masters | `/masters/*` |
| Patient & Admissions | `/patients`, `/admissions` |
| Lab | `/lab/investigations`, `/lab/tat-report` |
| Appointments | `/appointments/list`, `/appointments/sms` |
| Bills | `/bills` |
| Insurance | `/insurance`, `/insurance/*` |
| Expenses | `/expenses` |
| Contacts | `/contacts` |
| Daily Summary | `/daily-summary/*` |
| Reports | `/reports/*` |
| Settings | `/settings/*` |

---

## 6. Shared Components

### `Modal.tsx`

Accessible modal with `role="dialog"`, `aria-modal`, Escape-to-close, and body scroll lock.

```tsx
<Modal open={open} onClose={close} title="Add Patient" size="lg" footer={<>...</>}>
  {/* form content */}
</Modal>
```

Also exports: `FormField`, `Input`, `Select`, `Textarea` — all styled consistently.

### `useMaster` hook (`_lib/useMaster.ts`)

Generic hook used by all masters pages:

```typescript
const { data, loading, error, reload } =
  useMaster<InsuranceCompanyResponse>("/api/masters/insurance-companies");
```

Handles pagination, error state, and refetch.

Also exports: `masterCreate`, `masterUpdate`, `masterToggle`, `masterDelete` — one-line CRUD operations.

### `apiFetch` pattern

Used in every page file (not a shared import — inline to avoid client/server boundary issues):

```typescript
async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}
```

---

## 7. Module Pages

### Search debounce pattern (OP Queue, Bills)

Pages that do server-side search use a 300ms debounce to avoid race conditions from rapid typing:

```typescript
const [search, setSearch]               = useState("");
const [debouncedSearch, setDebounced]   = useState("");

useEffect(() => {
  const t = setTimeout(() => setDebounced(search), 300);
  return () => clearTimeout(t);
}, [search]);

// useCallback deps use debouncedSearch, not search
const loadData = useCallback(async () => {
  const qs = new URLSearchParams({ search: debouncedSearch, ... });
  ...
}, [debouncedSearch, ...otherFilters]);
```

### Patient search dropdown — portal pattern (Bills modal)

The Craft Bill modal has a patient search autocomplete. Because the modal body has `overflow-y-auto`, a standard `position: absolute` dropdown gets clipped. It uses `createPortal` with `position: fixed` coordinates from `getBoundingClientRect()`:

```typescript
createPortal(
  <ul style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}>
    ...
  </ul>,
  document.body
)
```

### Age calculation from DOB

Used in OP Token Queue and Patient Registration:

```typescript
function calcAgeFromDob(dob: string): number {
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}
```

When an existing patient is selected in the OP queue modal, their stored DOB is fetched via `PatientSummaryResponse.dateOfBirth` and age is recalculated live — so a patient who first visited 5 years ago gets the correct current age on their new token.

---

## 8. Role-Based Access

| Module | Admin | Doctor | Receptionist | Lab Tech | Insurance | Nurse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ Own | ✅ | ✅ | ✅ | ✅ |
| OP Token Queue | ✅ | ✅ | ✅ | ❌ | ❌ | 👁 |
| Masters | ✅ Full | 👁 Some | 👁 Some | 👁 Lab | 👁 Ins. | 👁 Some |
| Patients | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Lab | ✅ | 👁+Order | ❌ | ✅ Full | ❌ | 👁 |
| Appointments | ✅ | ✅ Own | ✅ | ❌ | ❌ | 👁 |
| Bills | ✅ | 👁 | ✅ | ❌ | 👁 | ❌ |
| Insurance | ✅ | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| Expenses | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contacts | ✅ | 👁 | ✅ | ❌ | 👁 | ❌ |
| Reports | ✅ | 👁 Own | 👁 Some | ❌ | ❌ | ❌ |

---

## 9. Running Locally

```bash
cd HMS
npm install
# Create .env.local if not present:
echo "BACKEND_URL=http://localhost:8080/api" > .env.local
npm run dev
```

Visit `http://localhost:3000`

Default credentials (created by backend seed):

| Role | Email | Password |
|---|---|---|
| Admin | admin@hms.com | Admin@123 |
