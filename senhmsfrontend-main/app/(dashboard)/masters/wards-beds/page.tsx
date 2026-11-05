"use client";

import { useState, useMemo, useEffect, Fragment, useCallback } from "react";
import { getSession, canEdit as checkEdit } from "../../../_lib/auth";
import PageHeader from "../../../_components/PageHeader";
import Badge from "../../../_components/Badge";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";
import { useMaster, masterCreate, masterUpdate, masterToggle, masterDelete } from "../../../_lib/useMaster";

// ─── Backend response shapes ──────────────────────────────────────────────────
interface WardResponse {
  id: number;
  wardCode: string;
  name: string;
  wardType: string;
  departmentId: number;
  departmentName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  chargePerDay: number;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
  beds?: BedResponse[];
}

interface BedResponse {
  id: number;
  number: string;
  wardId: number;
  wardName: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  patientId?: number | null;
  patientName?: string | null;
}

interface DepartmentResponse {
  id: number;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

// ─── Frontend types ───────────────────────────────────────────────────────────
type WardType = "General" | "Private" | "ICU" | "HDU" | "NICU" | "Maternity" | "Pediatric";
type BedStatus = "Available" | "Occupied" | "Reserved" | "Maintenance";

interface Ward {
  _id: number;
  id: string;
  wardCode: string;
  name: string;
  type: WardType;
  departmentId: number;
  department: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  chargePerDay: number;
  status: "Active" | "Inactive";
}

interface Bed {
  _id: number;
  id: string;
  number: string;
  wardId: number;
  wardName: string;
  status: BedStatus;
  patientName: string;
}

interface Dept { _id: number; id: string; name: string; }

// ─── Mapping helpers ──────────────────────────────────────────────────────────
const BED_STATUS_MAP: Record<BedResponse["status"], BedStatus> = {
  AVAILABLE:   "Available",
  OCCUPIED:    "Occupied",
  RESERVED:    "Reserved",
  MAINTENANCE: "Maintenance",
};

const BED_STATUS_REVERSE: Record<BedStatus, BedResponse["status"]> = {
  Available:   "AVAILABLE",
  Occupied:    "OCCUPIED",
  Reserved:    "RESERVED",
  Maintenance: "MAINTENANCE",
};

function wardToFrontend(w: WardResponse): Ward {
  return {
    _id:          w.id,
    id:           String(w.id),
    wardCode:     w.wardCode,
    name:         w.name,
    type:         capitalize(w.wardType) as WardType,
    departmentId: w.departmentId,
    department:   w.departmentName ?? "",
    totalBeds:    w.totalBeds,
    occupiedBeds: w.occupiedBeds,
    availableBeds:w.availableBeds,
    chargePerDay: w.chargePerDay,
    status:       w.status === "ACTIVE" ? "Active" : "Inactive",
  };
}

function bedToFrontend(b: BedResponse): Bed {
  return {
    _id:       b.id,
    id:        String(b.id),
    number:    b.number,
    wardId:    b.wardId,
    wardName:  b.wardName,
    status:    BED_STATUS_MAP[b.status] ?? "Available",
    patientName: b.patientName ?? "",
  };
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WARD_TYPES: WardType[] = ["General","Private","ICU","HDU","NICU","Maternity","Pediatric"];
const BED_STATUSES: BedStatus[] = ["Available","Occupied","Reserved","Maintenance"];

const WARD_TYPE_COLOR: Record<WardType, "sky"|"purple"|"red"|"orange"|"pink"|"green"|"indigo"> = {
  General:   "sky",
  Private:   "purple",
  ICU:       "red",
  HDU:       "orange",
  NICU:      "pink",
  Maternity: "green",
  Pediatric: "indigo",
};

const BED_STATUS_COLOR: Record<BedStatus, string> = {
  Available:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  Occupied:    "bg-red-100    text-red-700    border-red-200",
  Reserved:    "bg-amber-100  text-amber-700  border-amber-200",
  Maintenance: "bg-slate-100  text-slate-500  border-slate-200",
};

const BED_STATUS_DOT: Record<BedStatus, string> = {
  Available:   "bg-emerald-500",
  Occupied:    "bg-red-500",
  Reserved:    "bg-amber-500",
  Maintenance: "bg-slate-400",
};

function emptyWardForm() {
  return { name: "", wardType: "General" as WardType, departmentId: 0, totalBeds: 10, chargePerDay: 0, status: "ACTIVE" as "ACTIVE" | "INACTIVE" };
}

function emptyBedForm() {
  return { number: "", wardId: 0, status: "AVAILABLE" as BedResponse["status"] };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WardsBedPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const canEdit  = checkEdit(role, "masters/wards-beds");

  const { data: rawWards, loading: wardLoading, error: wardError, reload: reloadWards } =
    useMaster<WardResponse>("/api/masters/wards");
  const { data: rawDepts, loading: deptLoading } =
    useMaster<DepartmentResponse>("/api/masters/departments");

  const wards = useMemo(() => rawWards.map(wardToFrontend), [rawWards]);
  const departments = useMemo((): Dept[] =>
    rawDepts.filter(d => d.status === "ACTIVE").map(d => ({ _id: d.id, id: String(d.id), name: d.name })),
    [rawDepts]);

  // ward filters
  const [wardSearch,   setWardSearch]   = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // expanded ward
  const [expandedWardId, setExpandedWardId] = useState<number | null>(null);
  const [expandedBeds,   setExpandedBeds]   = useState<Bed[]>([]);
  const [bedsLoading,    setBedsLoading]    = useState(false);
  const [bedStatusFilter,setBedStatusFilter]= useState("");

  // ward modal
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [editingWard,   setEditingWard]   = useState<Ward | null>(null);
  const [wardForm,      setWardForm]      = useState(emptyWardForm());
  const [wardErrors,    setWardErrors]    = useState<Record<string, string>>({});
  const [wardSaving,    setWardSaving]    = useState(false);
  const [wardApiError,  setWardApiError]  = useState("");

  // bed modal
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [editingBed,   setEditingBed]   = useState<Bed | null>(null);
  const [bedForm,      setBedForm]      = useState(emptyBedForm());
  const [bedErrors,    setBedErrors]    = useState<Record<string, string>>({});
  const [bedSaving,    setBedSaving]    = useState(false);
  const [bedApiError,  setBedApiError]  = useState("");
  const [bedForWardId, setBedForWardId] = useState<number>(0);

  // load beds for expanded ward
  const loadBeds = useCallback(async (wardId: number) => {
    setBedsLoading(true);
    try {
      const res = await fetch(`/api/masters/wards/${wardId}/beds?page=0&size=200`);
      const json = await res.json();
      if (json.success) {
        const raw: BedResponse[] = json.data?.content ?? json.data ?? [];
        setExpandedBeds(raw.map(bedToFrontend));
      } else {
        setExpandedBeds([]);
      }
    } catch {
      setExpandedBeds([]);
    } finally {
      setBedsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expandedWardId !== null) { loadBeds(expandedWardId); }
  }, [expandedWardId, loadBeds]);

  // computed
  const filteredWards = useMemo(() => {
    return wards.filter(w => {
      const q = wardSearch.toLowerCase();
      const matchSearch = !q || w.name.toLowerCase().includes(q) ||
        w.department.toLowerCase().includes(q) || w.wardCode.toLowerCase().includes(q);
      return matchSearch && (!typeFilter || w.type === typeFilter) && (!statusFilter || w.status === statusFilter);
    });
  }, [wards, wardSearch, typeFilter, statusFilter]);

  const filteredBeds = useMemo(() =>
    bedStatusFilter ? expandedBeds.filter(b => b.status === bedStatusFilter) : expandedBeds,
    [expandedBeds, bedStatusFilter]);

  // summary
  const totalBeds     = wards.reduce((s, w) => s + w.totalBeds, 0);
  const occupiedBeds  = wards.reduce((s, w) => s + w.occupiedBeds, 0);
  const availableBeds = wards.reduce((s, w) => s + w.availableBeds, 0);
  const occupancyPct  = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  function occupancyColor(pct: number) {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  }

  function toggleExpand(wardId: number) {
    if (expandedWardId === wardId) {
      setExpandedWardId(null);
      setBedStatusFilter("");
    } else {
      setExpandedWardId(wardId);
      setBedStatusFilter("");
    }
  }

  // ── Ward handlers ──
  function openAddWard() {
    setWardForm(emptyWardForm());
    setWardErrors({}); setWardApiError(""); setEditingWard(null); setWardModalOpen(true);
  }

  function openEditWard(w: Ward) {
    setWardForm({ name: w.name, wardType: w.type, departmentId: w.departmentId,
      totalBeds: w.totalBeds, chargePerDay: w.chargePerDay,
      status: w.status === "Active" ? "ACTIVE" : "INACTIVE" });
    setWardErrors({}); setWardApiError(""); setEditingWard(w); setWardModalOpen(true);
  }

  function validateWard() {
    const e: Record<string, string> = {};
    if (!wardForm.name.trim())       e.name         = "Ward name is required";
    if (!wardForm.wardType)          e.wardType     = "Ward type is required";
    if (!wardForm.departmentId)      e.departmentId = "Department is required";
    if (!wardForm.totalBeds || wardForm.totalBeds < 1) e.totalBeds = "Total beds must be ≥ 1";
    setWardErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveWard() {
    if (!validateWard()) return;
    setWardSaving(true); setWardApiError("");
    const body = {
      name:         wardForm.name,
      wardType:     wardForm.wardType.toUpperCase(),
      departmentId: wardForm.departmentId,
      totalBeds:    wardForm.totalBeds,
      chargePerDay: wardForm.chargePerDay || 0,
      status:       wardForm.status,
    };
    const result = editingWard
      ? await masterUpdate("/api/masters/wards", editingWard._id, body)
      : await masterCreate("/api/masters/wards", body);
    setWardSaving(false);
    if (result.error) { setWardApiError(result.error); return; }
    await reloadWards();
    setWardModalOpen(false);
  }

  async function handleToggleWard(w: Ward) {
    await masterToggle("/api/masters/wards", w._id);
    reloadWards();
  }

  // ── Bed handlers ──
  function openAddBed(wardId: number) {
    setBedForm({ ...emptyBedForm(), wardId });
    setBedErrors({}); setBedApiError(""); setEditingBed(null); setBedForWardId(wardId); setBedModalOpen(true);
  }

  function openEditBed(b: Bed) {
    setBedForm({ number: b.number, wardId: b.wardId, status: BED_STATUS_REVERSE[b.status] });
    setBedErrors({}); setBedApiError(""); setEditingBed(b); setBedForWardId(b.wardId); setBedModalOpen(true);
  }

  function validateBed() {
    const e: Record<string, string> = {};
    if (!bedForm.number.trim()) e.number = "Bed number is required";
    if (!bedForm.wardId)        e.wardId = "Ward is required";
    setBedErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveBed() {
    if (!validateBed()) return;
    setBedSaving(true); setBedApiError("");
    const body = { number: bedForm.number, wardId: bedForm.wardId, status: bedForm.status };
    const result = editingBed
      ? await masterUpdate("/api/masters/wards/beds", editingBed._id, body)
      : await masterCreate("/api/masters/wards/beds", body);
    setBedSaving(false);
    if (result.error) { setBedApiError(result.error); return; }
    setBedModalOpen(false);
    await reloadWards();
    if (expandedWardId !== null) await loadBeds(expandedWardId);
  }

  async function handleDeleteBed(b: Bed) {
    if (!confirm(`Delete bed ${b.number}? This cannot be undone.`)) return;
    const result = await masterDelete("/api/masters/wards/beds", b._id);
    if (result.error) { alert(result.error); return; }
    await reloadWards();
    if (expandedWardId !== null) await loadBeds(expandedWardId);
  }

  const loading = wardLoading || deptLoading;
  const fetchErr = wardError;

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reloadWards} />}
      <PageHeader
        title="Wards & Beds"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Wards & Beds" }]}
        action={canEdit ? { label: "Add Ward", onClick: openAddWard } : undefined}
      />

      {/* ── Hospital-wide Bed Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Total Beds"  value={totalBeds}     color="text-slate-800"   bg="bg-slate-50" />
        <SummaryCard label="Available"   value={availableBeds} color="text-emerald-600" bg="bg-emerald-50" dot="bg-emerald-500" />
        <SummaryCard label="Occupied"    value={occupiedBeds}  color="text-red-600"     bg="bg-red-50"     dot="bg-red-500" />
        <SummaryCard label="Total Wards" value={wards.length}  color="text-sky-600"     bg="bg-sky-50" />
      </div>

      {/* ── Occupancy meter ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-slate-700">Hospital Bed Occupancy</span>
          <span className={`font-bold ${occupancyPct >= 90 ? "text-red-600" : occupancyPct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>
            {occupancyPct}%
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${occupancyColor(occupancyPct)}`}
            style={{ width: `${occupancyPct}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-400">
          <span>{occupiedBeds} occupied of {totalBeds} total beds</span>
          <span className="ml-auto">{availableBeds} beds available now</span>
        </div>
      </div>

      {/* ── Ward filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={wardSearch} onChange={e => setWardSearch(e.target.value)}
            placeholder="Search ward name, department, code…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <DropFilter value={typeFilter} onChange={setTypeFilter} label="All Types">
          {WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </DropFilter>
        <DropFilter value={statusFilter} onChange={setStatusFilter} label="All Status">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </DropFilter>
        {(wardSearch || typeFilter || statusFilter) && (
          <button onClick={() => { setWardSearch(""); setTypeFilter(""); setStatusFilter(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center whitespace-nowrap">
          {filteredWards.length} ward{filteredWards.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Ward Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "", "Ward Code", "Ward Name", "Type", "Department",
                  "Available", "Occupied", "Total", "Charge/Day",
                  "Occupancy", "Status",
                  ...(canEdit ? ["Actions"] : []),
                ].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500
                    uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredWards.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="px-4 py-12 text-center text-slate-400">No wards found</td>
                </tr>
              ) : filteredWards.map(w => {
                const isExpanded = expandedWardId === w._id;
                const pct = w.totalBeds > 0 ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
                return (
                  <Fragment key={w.id}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? "bg-sky-50 hover:bg-sky-50" : ""}`}
                      onClick={() => toggleExpand(w._id)}>
                      <td className="px-3 py-3 w-8">
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">{w.wardCode}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800 whitespace-nowrap">{w.name}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge label={w.type} variant={WARD_TYPE_COLOR[w.type]} />
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap text-xs">{w.department}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">{w.availableBeds}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 text-xs font-bold">{w.occupiedBeds}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold text-slate-700">{w.totalBeds}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {w.chargePerDay > 0 ? `₹${w.chargePerDay}` : "—"}
                      </td>
                      <td className="px-3 py-3 min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${occupancyColor(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge label={w.status} variant={w.status === "Active" ? "green" : "gray"} dot />
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditWard(w)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleToggleWard(w)}
                              className={`p-1.5 rounded-lg transition-colors ${w.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                              title={w.status === "Active" ? "Deactivate" : "Activate"}>
                              {w.status === "Active" ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* ── Expanded Bed Grid ── */}
                    {isExpanded && (
                      <tr key={`${w.id}-beds`}>
                        <td colSpan={canEdit ? 12 : 11} className="bg-slate-50 border-t border-slate-100 px-5 py-4">
                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            <h3 className="text-sm font-bold text-slate-700">{w.name} — Bed Layout</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {BED_STATUSES.map(s => (
                                <span key={s} className="flex items-center gap-1">
                                  <span className={`w-2.5 h-2.5 rounded-full ${BED_STATUS_DOT[s]}`} />
                                  {s}
                                </span>
                              ))}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              <DropFilter value={bedStatusFilter} onChange={setBedStatusFilter} label="All Beds" small>
                                {BED_STATUSES.map(s => (
                                  <option key={s} value={s}>{s} ({expandedBeds.filter(b => b.status === s).length})</option>
                                ))}
                              </DropFilter>
                              {canEdit && (
                                <button onClick={() => openAddBed(w._id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Bed
                                </button>
                              )}
                            </div>
                          </div>

                          {bedsLoading ? (
                            <p className="text-sm text-slate-400 py-4 text-center">Loading beds…</p>
                          ) : filteredBeds.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">No beds found</p>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                              {filteredBeds.map(bed => (
                                <BedCell key={bed.id} bed={bed} canEdit={canEdit}
                                  onEdit={() => openEditBed(bed)}
                                  onDelete={() => handleDeleteBed(bed)} />
                              ))}
                            </div>
                          )}

                          <div className="flex gap-4 mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                            <span>Total: <strong className="text-slate-700">{w.totalBeds}</strong></span>
                            <span className="text-emerald-600">Available: <strong>{w.availableBeds}</strong></span>
                            <span className="text-red-600">Occupied: <strong>{w.occupiedBeds}</strong></span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filteredWards.length} of {wards.length} wards
        </div>
      </div>

      {/* ── Add/Edit Ward Modal ── */}
      <Modal open={wardModalOpen} onClose={() => setWardModalOpen(false)}
        title={editingWard ? `Edit Ward — ${editingWard.wardCode}` : "Add New Ward"}
        size="lg"
        footer={
          <>
            <button onClick={() => setWardModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={saveWard} disabled={wardSaving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {wardSaving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editingWard ? "Save Changes" : "Add Ward"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {wardApiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{wardApiError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Ward Name" required error={wardErrors.name}>
              <Input value={wardForm.name} onChange={e => setWardForm({ ...wardForm, name: e.target.value })} placeholder="e.g. General Ward A" autoFocus/>
            </FormField>
            <FormField label="Ward Type" required error={wardErrors.wardType}>
              <Select value={wardForm.wardType} onChange={e => setWardForm({ ...wardForm, wardType: e.target.value as WardType })}>
                {WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department" required error={wardErrors.departmentId}>
              <Select value={wardForm.departmentId ? String(wardForm.departmentId) : ""}
                onChange={e => setWardForm({ ...wardForm, departmentId: Number(e.target.value) })}>
                <option value="">Select department…</option>
                {departments.map(d => <option key={d._id} value={String(d._id)}>{d.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Total Beds" required error={wardErrors.totalBeds}>
              <Input type="number" min={1} value={wardForm.totalBeds}
                onChange={e => setWardForm({ ...wardForm, totalBeds: Number(e.target.value) })}/>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Charge Per Day (₹)">
              <Input type="number" min={0} value={wardForm.chargePerDay}
                onChange={e => setWardForm({ ...wardForm, chargePerDay: Number(e.target.value) })}/>
            </FormField>
            <FormField label="Status">
              <Select value={wardForm.status} onChange={e => setWardForm({ ...wardForm, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ── Add/Edit Bed Modal ── */}
      <Modal open={bedModalOpen} onClose={() => setBedModalOpen(false)}
        title={editingBed ? `Edit Bed — ${editingBed.number}` : "Add New Bed"}
        size="sm"
        footer={
          <>
            <button onClick={() => setBedModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={saveBed} disabled={bedSaving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {bedSaving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editingBed ? "Save Changes" : "Add Bed"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {bedApiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{bedApiError}</div>
          )}
          <FormField label="Bed Number" required error={bedErrors.number}>
            <Input value={bedForm.number} onChange={e => setBedForm({ ...bedForm, number: e.target.value })} placeholder="e.g. 101, A-01" autoFocus/>
          </FormField>
          <FormField label="Status">
            <Select value={bedForm.status} onChange={e => setBedForm({ ...bedForm, status: e.target.value as BedResponse["status"] })}>
              {BED_STATUSES.map(s => <option key={s} value={BED_STATUS_REVERSE[s]}>{s}</option>)}
            </Select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ─── Bed Cell ─────────────────────────────────────────────────────────────────
function BedCell({ bed, canEdit, onEdit, onDelete }: {
  bed: Bed; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`relative rounded-lg border p-2 text-center transition-all ${BED_STATUS_COLOR[bed.status]}`}
    >
      <p className="text-xs font-bold leading-tight">{bed.number}</p>
      <p className="text-xs leading-tight opacity-70">{bed.status.slice(0, 3)}</p>
      {bed.patientName && <p className="text-xs opacity-60 truncate">{bed.patientName}</p>}
      {hover && canEdit && (
        <div className="absolute inset-0 bg-white/90 rounded-lg flex items-center justify-center gap-1">
          <button onClick={onEdit}
            className="p-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors" title="Edit">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={onDelete}
            className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors" title="Delete">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, bg, dot }: {
  label: string; value: number; color: string; bg: string; dot?: string;
}) {
  return (
    <div className={`${bg} rounded-xl border border-slate-200 px-4 py-3 shadow-sm`}>
      <div className="flex items-center gap-1.5 mb-1">
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DropFilter({ value, onChange, label, children, small }: {
  value: string; onChange: (v: string) => void; label: string; children: React.ReactNode; small?: boolean;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 rounded-lg border border-slate-200
          bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer
          ${small ? "text-xs py-1.5" : "text-sm py-2"}`}>
        <option value="">{label}</option>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-slate-200 rounded w-48" />
        <div className="h-9 bg-slate-200 rounded w-36" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-16">
            <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 h-16" />
      <div className="flex gap-3">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
            <div className="h-3 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-200 rounded w-36" />
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
            <div className="h-3 bg-slate-200 rounded w-12" />
            <div className="h-5 bg-slate-200 rounded-full w-14 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-red-600 font-medium">{msg}</p>
      <button onClick={onRetry} className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">Retry</button>
    </div>
  );
}
