/**
 * wardsBeds.ts
 * Standalone mock data + CRUD for Wards and Beds.
 * Import from here — do NOT use the old wards.ts seed for management pages.
 */

// ─── Extended Types (local, beyond the minimal Ward/Bed in types.ts) ──────────

export type WardType = "General" | "Private" | "ICU" | "HDU" | "NICU" | "Maternity" | "Pediatric";
export type WardStatus = "Active" | "Inactive";
export type BedStatus = "Available" | "Occupied" | "Reserved" | "Maintenance";
export type BedCategory = "General" | "Private" | "Semi-Private" | "ICU" | "HDU" | "NICU";

export interface WardRecord {
  id: string;
  wardCode: string;          // Auto: WARD001, WARD002 …
  name: string;
  type: WardType;
  department: string;        // Department name (linked to departments master)
  floor: string;
  totalBeds: number;
  availableBeds: number;     // computed / updated on bed status changes
  occupiedBeds: number;
  reservedBeds: number;
  maintenanceBeds: number;
  status: WardStatus;
  incharge: string;          // nurse / ward in-charge name
  phone: string;
  notes: string;
  createdBy: string;
  createdDate: string;
}

export interface BedRecord {
  id: string;
  bedCode: string;           // Auto: BED001, BED002 …
  number: string;            // Display number: GW-01, ICU-01, PR-101 …
  wardId: string;
  wardName: string;
  category: BedCategory;
  floor: string;
  status: BedStatus;
  patientId?: string;
  patientName?: string;
  admissionDate?: string;
  notes: string;
  createdBy: string;
  createdDate: string;
}

// ─── Seed Data — Wards ────────────────────────────────────────────────────────

const SEED_WARDS: WardRecord[] = [
  {
    id: "w001",
    wardCode: "WARD001",
    name: "General Ward A",
    type: "General",
    department: "General Surgery",
    floor: "2nd Floor",
    totalBeds: 20,
    availableBeds: 8,
    occupiedBeds: 10,
    reservedBeds: 1,
    maintenanceBeds: 1,
    status: "Active",
    incharge: "Sr. Nurse Kavitha",
    phone: "040-2001",
    notes: "Male general ward",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w002",
    wardCode: "WARD002",
    name: "General Ward B",
    type: "General",
    department: "General Surgery",
    floor: "2nd Floor",
    totalBeds: 20,
    availableBeds: 9,
    occupiedBeds: 9,
    reservedBeds: 2,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Padma",
    phone: "040-2002",
    notes: "Female general ward",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w003",
    wardCode: "WARD003",
    name: "ICU",
    type: "ICU",
    department: "ICU",
    floor: "4th Floor",
    totalBeds: 12,
    availableBeds: 2,
    occupiedBeds: 9,
    reservedBeds: 0,
    maintenanceBeds: 1,
    status: "Active",
    incharge: "Sr. Nurse Usha",
    phone: "040-2003",
    notes: "Intensive care — 24hr monitoring",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w004",
    wardCode: "WARD004",
    name: "HDU",
    type: "HDU",
    department: "Neurology",
    floor: "4th Floor",
    totalBeds: 8,
    availableBeds: 2,
    occupiedBeds: 5,
    reservedBeds: 1,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Rekha",
    phone: "040-2004",
    notes: "High dependency unit",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w005",
    wardCode: "WARD005",
    name: "Private Rooms",
    type: "Private",
    department: "General Surgery",
    floor: "3rd Floor",
    totalBeds: 10,
    availableBeds: 5,
    occupiedBeds: 4,
    reservedBeds: 1,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Meena",
    phone: "040-2005",
    notes: "Single-occupancy private rooms",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w006",
    wardCode: "WARD006",
    name: "Maternity Ward",
    type: "Maternity",
    department: "Gynecology",
    floor: "1st Floor",
    totalBeds: 16,
    availableBeds: 5,
    occupiedBeds: 11,
    reservedBeds: 0,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Geetha",
    phone: "040-2006",
    notes: "Ante-natal and post-natal care",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w007",
    wardCode: "WARD007",
    name: "Pediatric Ward",
    type: "Pediatric",
    department: "Pediatrics",
    floor: "1st Floor",
    totalBeds: 14,
    availableBeds: 6,
    occupiedBeds: 7,
    reservedBeds: 1,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Sunitha",
    phone: "040-2007",
    notes: "Children 0–12 years",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w008",
    wardCode: "WARD008",
    name: "NICU",
    type: "NICU",
    department: "Pediatrics",
    floor: "1st Floor",
    totalBeds: 6,
    availableBeds: 2,
    occupiedBeds: 4,
    reservedBeds: 0,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Parvathi",
    phone: "040-2008",
    notes: "Neonatal intensive care",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w009",
    wardCode: "WARD009",
    name: "Cardiology Ward",
    type: "General",
    department: "Cardiology",
    floor: "2nd Floor",
    totalBeds: 20,
    availableBeds: 6,
    occupiedBeds: 13,
    reservedBeds: 1,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Radha",
    phone: "040-2009",
    notes: "Cardiac step-down and monitoring",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
  {
    id: "w010",
    wardCode: "WARD010",
    name: "Ortho Ward",
    type: "General",
    department: "Orthopedics",
    floor: "2nd Floor",
    totalBeds: 18,
    availableBeds: 5,
    occupiedBeds: 12,
    reservedBeds: 1,
    maintenanceBeds: 0,
    status: "Active",
    incharge: "Sr. Nurse Yamuna",
    phone: "040-2010",
    notes: "Post-surgical orthopedic recovery",
    createdBy: "Dr. Admin",
    createdDate: "2024-01-05",
  },
];

// ─── Seed Data — Beds ─────────────────────────────────────────────────────────

function makeBeds(): BedRecord[] {
  const beds: BedRecord[] = [];
  let bedCodeCounter = 1;

  const wardBedConfig: {
    wardId: string;
    wardName: string;
    prefix: string;
    count: number;
    category: BedCategory;
    floor: string;
    statuses: BedStatus[];
    patients?: { index: number; id: string; name: string; admDate: string }[];
  }[] = [
    {
      wardId: "w001", wardName: "General Ward A", prefix: "GWA", count: 20,
      category: "General", floor: "2nd Floor",
      statuses: ["Available","Occupied","Occupied","Available","Occupied","Occupied","Reserved","Occupied","Occupied","Maintenance","Available","Occupied","Occupied","Available","Occupied","Occupied","Available","Occupied","Available","Occupied"],
      patients: [
        { index: 1,  id: "p1", name: "Arjun Kumar",    admDate: "2025-07-01" },
        { index: 2,  id: "p2", name: "Meena Devi",     admDate: "2025-07-02" },
        { index: 4,  id: "p3", name: "Ravi Shankar",   admDate: "2025-07-03" },
        { index: 5,  id: "p4", name: "Sathya Priya",   admDate: "2025-07-04" },
        { index: 7,  id: "p5", name: "Karthik S",      admDate: "2025-07-05" },
        { index: 8,  id: "p6", name: "Nalini R",       admDate: "2025-07-05" },
        { index: 11, id: "p7", name: "Murugesan P",    admDate: "2025-07-06" },
        { index: 12, id: "p8", name: "Deepa T",        admDate: "2025-07-06" },
        { index: 14, id: "p9", name: "Selvam V",       admDate: "2025-07-07" },
        { index: 15, id: "p10",name: "Geetha K",       admDate: "2025-07-07" },
      ],
    },
    {
      wardId: "w002", wardName: "General Ward B", prefix: "GWB", count: 20,
      category: "General", floor: "2nd Floor",
      statuses: ["Occupied","Available","Occupied","Occupied","Available","Occupied","Occupied","Reserved","Occupied","Available","Occupied","Reserved","Occupied","Occupied","Available","Occupied","Occupied","Available","Occupied","Occupied"],
    },
    {
      wardId: "w003", wardName: "ICU", prefix: "ICU", count: 12,
      category: "ICU", floor: "4th Floor",
      statuses: ["Occupied","Occupied","Available","Occupied","Occupied","Occupied","Maintenance","Occupied","Occupied","Available","Occupied","Occupied"],
      patients: [
        { index: 0,  id: "p11", name: "Vijay R",       admDate: "2025-07-08" },
        { index: 1,  id: "p12", name: "Sudha M",       admDate: "2025-07-08" },
        { index: 3,  id: "p13", name: "Balamurugan",   admDate: "2025-07-09" },
        { index: 4,  id: "p14", name: "Preethi N",     admDate: "2025-07-09" },
      ],
    },
    {
      wardId: "w004", wardName: "HDU", prefix: "HDU", count: 8,
      category: "HDU", floor: "4th Floor",
      statuses: ["Occupied","Available","Occupied","Occupied","Available","Reserved","Occupied","Occupied"],
    },
    {
      wardId: "w005", wardName: "Private Rooms", prefix: "PR", count: 10,
      category: "Private", floor: "3rd Floor",
      statuses: ["Occupied","Occupied","Available","Occupied","Reserved","Available","Available","Occupied","Available","Available"],
      patients: [
        { index: 0, id: "p15", name: "Ramesh Babu",  admDate: "2025-07-01" },
        { index: 1, id: "p16", name: "Anitha Rao",   admDate: "2025-07-03" },
        { index: 3, id: "p17", name: "Senthil Kumar",admDate: "2025-07-05" },
        { index: 7, id: "p18", name: "Parvathi V",   admDate: "2025-07-07" },
      ],
    },
    {
      wardId: "w006", wardName: "Maternity Ward", prefix: "MAT", count: 16,
      category: "General", floor: "1st Floor",
      statuses: ["Occupied","Occupied","Occupied","Available","Occupied","Occupied","Occupied","Available","Occupied","Occupied","Occupied","Available","Occupied","Occupied","Available","Occupied"],
    },
    {
      wardId: "w007", wardName: "Pediatric Ward", prefix: "PED", count: 14,
      category: "General", floor: "1st Floor",
      statuses: ["Occupied","Available","Occupied","Occupied","Available","Occupied","Occupied","Reserved","Available","Occupied","Available","Occupied","Available","Available"],
    },
    {
      wardId: "w008", wardName: "NICU", prefix: "NICU", count: 6,
      category: "NICU", floor: "1st Floor",
      statuses: ["Occupied","Occupied","Available","Occupied","Occupied","Available"],
    },
    {
      wardId: "w009", wardName: "Cardiology Ward", prefix: "CARD", count: 20,
      category: "General", floor: "2nd Floor",
      statuses: ["Occupied","Occupied","Available","Occupied","Occupied","Occupied","Reserved","Occupied","Available","Occupied","Occupied","Occupied","Available","Occupied","Occupied","Occupied","Available","Occupied","Available","Occupied"],
    },
    {
      wardId: "w010", wardName: "Ortho Ward", prefix: "ORT", count: 18,
      category: "General", floor: "2nd Floor",
      statuses: ["Occupied","Available","Occupied","Occupied","Occupied","Available","Occupied","Reserved","Occupied","Occupied","Available","Occupied","Occupied","Available","Occupied","Occupied","Maintenance","Occupied"],
    },
  ];

  for (const cfg of wardBedConfig) {
    for (let i = 0; i < cfg.count; i++) {
      const num = String(i + 1).padStart(2, "0");
      const patient = cfg.patients?.find((p) => p.index === i);
      beds.push({
        id: `bed${String(bedCodeCounter).padStart(3, "0")}`,
        bedCode: `BED${String(bedCodeCounter).padStart(3, "0")}`,
        number: `${cfg.prefix}-${num}`,
        wardId: cfg.wardId,
        wardName: cfg.wardName,
        category: cfg.category,
        floor: cfg.floor,
        status: cfg.statuses[i] ?? "Available",
        patientId: patient?.id,
        patientName: patient?.name,
        admissionDate: patient?.admDate,
        notes: "",
        createdBy: "Dr. Admin",
        createdDate: "2024-01-05",
      });
      bedCodeCounter++;
    }
  }

  return beds;
}

// ─── In-memory stores ─────────────────────────────────────────────────────────

let _wards: WardRecord[] = SEED_WARDS.map((w) => ({ ...w }));
let _beds:  BedRecord[]  = makeBeds();
let _wardCodeCounter = SEED_WARDS.length + 1;
let _bedCodeCounter  = _beds.length + 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateWardCode(): string {
  return `WARD${String(_wardCodeCounter++).padStart(3, "0")}`;
}
function generateBedCode(): string {
  return `BED${String(_bedCodeCounter++).padStart(3, "0")}`;
}

/** Recompute ward bed counts from the beds store */
function syncWardCounts(wardId: string): void {
  const wi = _wards.findIndex((w) => w.id === wardId);
  if (wi === -1) return;
  const wardBeds = _beds.filter((b) => b.wardId === wardId);
  _wards[wi] = {
    ..._wards[wi],
    totalBeds:       wardBeds.length,
    availableBeds:   wardBeds.filter((b) => b.status === "Available").length,
    occupiedBeds:    wardBeds.filter((b) => b.status === "Occupied").length,
    reservedBeds:    wardBeds.filter((b) => b.status === "Reserved").length,
    maintenanceBeds: wardBeds.filter((b) => b.status === "Maintenance").length,
  };
}

// ─── Ward CRUD ────────────────────────────────────────────────────────────────

export function getWards(): WardRecord[] {
  return _wards;
}

export function getWardById(id: string): WardRecord | undefined {
  return _wards.find((w) => w.id === id);
}

export function addWard(
  data: Omit<WardRecord, "id" | "wardCode" | "totalBeds" | "availableBeds" | "occupiedBeds" | "reservedBeds" | "maintenanceBeds">
): WardRecord {
  const ward: WardRecord = {
    ...data,
    id: `w${Date.now()}`,
    wardCode: generateWardCode(),
    totalBeds: 0,
    availableBeds: 0,
    occupiedBeds: 0,
    reservedBeds: 0,
    maintenanceBeds: 0,
  };
  _wards = [..._wards, ward];
  return ward;
}

export function updateWard(
  id: string,
  data: Partial<Omit<WardRecord, "id" | "wardCode">>
): WardRecord | null {
  const i = _wards.findIndex((w) => w.id === id);
  if (i === -1) return null;
  _wards[i] = { ..._wards[i], ...data };
  return _wards[i];
}

export function toggleWardStatus(id: string): void {
  const i = _wards.findIndex((w) => w.id === id);
  if (i !== -1) {
    _wards[i].status = _wards[i].status === "Active" ? "Inactive" : "Active";
  }
}

// ─── Bed CRUD ─────────────────────────────────────────────────────────────────

export function getBeds(): BedRecord[] {
  return _beds;
}

export function getBedsByWard(wardId: string): BedRecord[] {
  return _beds.filter((b) => b.wardId === wardId);
}

export function getBedById(id: string): BedRecord | undefined {
  return _beds.find((b) => b.id === id);
}

export function addBed(
  data: Omit<BedRecord, "id" | "bedCode">
): BedRecord {
  const bed: BedRecord = {
    ...data,
    id: `bed${Date.now()}`,
    bedCode: generateBedCode(),
  };
  _beds = [..._beds, bed];
  syncWardCounts(data.wardId);
  return bed;
}

export function updateBed(
  id: string,
  data: Partial<Omit<BedRecord, "id" | "bedCode">>
): BedRecord | null {
  const i = _beds.findIndex((b) => b.id === id);
  if (i === -1) return null;
  _beds[i] = { ..._beds[i], ...data };
  syncWardCounts(_beds[i].wardId);
  return _beds[i];
}

export function updateBedStatus(
  id: string,
  status: BedStatus,
  patientId?: string,
  patientName?: string,
  admissionDate?: string
): BedRecord | null {
  return updateBed(id, {
    status,
    patientId:     status === "Occupied" ? patientId     : undefined,
    patientName:   status === "Occupied" ? patientName   : undefined,
    admissionDate: status === "Occupied" ? admissionDate : undefined,
  });
}

export function deleteBed(id: string): boolean {
  const bed = _beds.find((b) => b.id === id);
  if (!bed) return false;
  _beds = _beds.filter((b) => b.id !== id);
  syncWardCounts(bed.wardId);
  return true;
}

// ─── Summary / Stats ──────────────────────────────────────────────────────────

export interface BedSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  occupancyPct: number;
}

export function getHospitalBedSummary(): BedSummary {
  const activeWards = _wards.filter((w) => w.status === "Active");
  const total       = activeWards.reduce((s, w) => s + w.totalBeds,       0);
  const available   = activeWards.reduce((s, w) => s + w.availableBeds,   0);
  const occupied    = activeWards.reduce((s, w) => s + w.occupiedBeds,    0);
  const reserved    = activeWards.reduce((s, w) => s + w.reservedBeds,    0);
  const maintenance = activeWards.reduce((s, w) => s + w.maintenanceBeds, 0);
  return {
    total,
    available,
    occupied,
    reserved,
    maintenance,
    occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
  };
}
