"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getSession } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";
import ErrorBanner from "../../../_components/ErrorBanner";

// ─── Backend response shapes ──────────────────────────────────────────────────
interface DoctorResponse {
  id: number;
  name: string;
  registrationNo: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  departmentId: number;
  departmentName: string;
  phone: string;
  email: string | null;
  experienceYears: number;
  opdFee: number;
  opdStartTime: string | null;
  opdEndTime: string | null;
  avgConsultMins: number;
  bio: string | null;
  status: "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  qualifications: string[];
  specializations: string[];
  opdDays: string[];
  illnessTags: string[];
  createdBy: string;
  createdAt: string;
}

interface DepartmentResponse {
  id: number;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

// ─── Frontend types ───────────────────────────────────────────────────────────
type DoctorStatus = "Active" | "On Leave" | "Inactive";
type DoctorGender = "Male" | "Female" | "Other";

interface Doctor {
  _id: number;
  id: string;
  name: string;
  registrationNo: string;
  dob: string;
  gender: DoctorGender;
  departmentId: number;
  department: string;
  phone: string;
  email: string;
  experience: number;
  opdFee: number;
  opdStartTime: string;
  opdEndTime: string;
  avgConsultMins: number;
  bio: string;
  status: DoctorStatus;
  qualification: string[];
  specializations: string[];
  opdDays: string[];
  illnessTags: string[];
}

interface Dept { _id: number; id: string; name: string; }

// ─── Mapping helpers ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<DoctorResponse["status"], DoctorStatus> = {
  ACTIVE:   "Active",
  ON_LEAVE: "On Leave",
  INACTIVE: "Inactive",
};

const STATUS_MAP_REVERSE: Record<DoctorStatus, DoctorResponse["status"]> = {
  Active:    "ACTIVE",
  "On Leave":"ON_LEAVE",
  Inactive:  "INACTIVE",
};

const GENDER_MAP: Record<DoctorResponse["gender"], DoctorGender> = {
  MALE:   "Male",
  FEMALE: "Female",
  OTHER:  "Other",
};

const GENDER_MAP_REVERSE: Record<DoctorGender, DoctorResponse["gender"]> = {
  Male:   "MALE",
  Female: "FEMALE",
  Other:  "OTHER",
};

function toFrontend(d: DoctorResponse): Doctor {
  return {
    _id:           d.id,
    id:            String(d.id),
    name:          d.name,
    registrationNo:d.registrationNo,
    dob:           d.dob ? d.dob.slice(0, 10) : "",
    gender:        GENDER_MAP[d.gender] ?? "Other",
    departmentId:  d.departmentId,
    department:    d.departmentName ?? "",
    phone:         d.phone ?? "",
    email:         d.email ?? "",
    experience:    d.experienceYears,
    opdFee:        d.opdFee,
    opdStartTime:  d.opdStartTime ?? "09:00",
    opdEndTime:    d.opdEndTime ?? "13:00",
    avgConsultMins:d.avgConsultMins,
    bio:           d.bio ?? "",
    status:        STATUS_MAP[d.status] ?? "Active",
    qualification: d.qualifications ?? [],
    specializations: d.specializations ?? [],
    opdDays:       d.opdDays ?? [],
    illnessTags:   d.illnessTags ?? [],
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_QUALIFICATIONS = [
  "MBBS","MD","MS","DNB","DM","MCh","DGO","FACS","FICO",
  "MD Cardiology","DM Cardiology","MD Neurology","DM Neurology",
  "MS Orthopedics","MD Obstetrics & Gynecology","MD Pediatrics",
  "MS General Surgery","MD Dermatology","MS ENT","MS Ophthalmology",
  "MD (Internal Medicine)","MD (Medicine)","IDCCM","EDIC",
  "Fellowship Neonatology","Diploma Cosmetology",
];

const ALL_SPECIALIZATIONS = [
  "Cardiologist","Interventional Cardiology","Heart Failure",
  "Neurologist","Stroke","Epilepsy",
  "Orthopedic Surgeon","Joint Replacement","Spine Surgery",
  "Gynecologist","Obstetrician","Infertility",
  "Pediatrician","Neonatologist","Child Development",
  "General Surgeon","Laparoscopic Surgery","GI Surgery",
  "Dermatologist","Cosmetologist","Trichologist",
  "ENT Specialist","Head & Neck Surgery","Cochlear Implants",
  "Ophthalmologist","Cataract Surgery","Retina",
  "Intensivist","Critical Care","Pulmonology",
];

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function calcAge(dob: string) {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() - birth.getMonth() < 0 ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

function emptyForm() {
  return {
    name: "", dob: "", gender: "Male" as DoctorGender,
    qualification: [] as string[], specializations: [] as string[],
    departmentId: 0, phone: "", email: "",
    experience: 0, opdFee: 500,
    opdDays: [] as string[], opdStartTime: "09:00", opdEndTime: "13:00",
    avgConsultMins: 15, registrationNo: "",
    status: "ACTIVE" as DoctorResponse["status"],
    bio: "", illnessTags: [] as string[],
  };
}

// ─── MultiSelect pill ─────────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, placeholder }: {
  label: string; options: string[]; selected: string[];
  onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o));
  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  }
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {selected.map(s => (
          <span key={s} className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {s}
            <button type="button" onClick={() => toggle(s)} className="hover:text-red-500 ml-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input type="text" value={query}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder ?? "Type to search or select…"}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
            {filtered.map(o => (
              <li key={o}>
                <button type="button" onMouseDown={() => { toggle(o); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-sky-50 hover:text-sky-700 transition-colors">{o}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Day toggle ───────────────────────────────────────────────────────────────
function DayToggle({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map(d => (
        <button key={d} type="button"
          onClick={() => onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d])}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
            ${selected.includes(d) ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
          {d}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DoctorsPage() {
  const session = getSession();
  const role    = session?.role ?? "Admin";
  const canEdit = role === "Admin" || role === "Managing Director";

  const { data: rawDoctors, loading: dLoading, error: dError, reload } =
    useMaster<DoctorResponse>("/api/masters/doctors");
  const { data: rawDepts, loading: deptLoading } =
    useMaster<DepartmentResponse>("/api/masters/departments");

  const doctors = useMemo(() => rawDoctors.map(toFrontend), [rawDoctors]);
  const departments = useMemo((): Dept[] =>
    rawDepts.filter(d => d.status === "ACTIVE").map(d => ({ _id: d.id, id: String(d.id), name: d.name })),
    [rawDepts]);

  const [search,       setSearch]       = useState("");
  const [deptFilter,   setDeptFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState<Doctor | null>(null);
  const [form,        setForm]        = useState(emptyForm());
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [saving,      setSaving]      = useState(false);
  const [apiError,    setApiError]    = useState("");
  const [viewDoctor,  setViewDoctor]  = useState<Doctor | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; isEdit: boolean } | null>(null);

  const filtered = useMemo(() => {
    return doctors.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        d.name.toLowerCase().includes(q) ||
        (d.specializations ?? []).some(s => s.toLowerCase().includes(q)) ||
        (d.department ?? "").toLowerCase().includes(q) ||
        (d.phone ?? "").includes(q);
      const matchDept   = !deptFilter   || d.department === deptFilter;
      const matchStatus = !statusFilter || d.status     === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [doctors, search, deptFilter, statusFilter]);

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setModalOpen(true);
  }

  function openEdit(d: Doctor) {
    setForm({
      name: d.name, dob: d.dob, gender: d.gender,
      qualification: [...d.qualification], specializations: [...d.specializations],
      departmentId: d.departmentId, phone: d.phone, email: d.email,
      experience: d.experience, opdFee: d.opdFee,
      opdDays: [...d.opdDays], opdStartTime: d.opdStartTime,
      opdEndTime: d.opdEndTime, avgConsultMins: d.avgConsultMins,
      registrationNo: d.registrationNo,
      status: STATUS_MAP_REVERSE[d.status],
      bio: d.bio, illnessTags: [...d.illnessTags],
    });
    setErrors({}); setApiError(""); setEditing(d); setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())         e.name            = "Name is required";
    if (!form.dob)                 e.dob             = "Date of birth is required";
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (!form.departmentId)        e.department      = "Department is required";
    if (form.qualification.length === 0) e.qualification = "At least one qualification required";
    if (form.specializations.length === 0) e.specializations = "At least one specialization required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body = {
      name:           form.name,
      registrationNo: form.registrationNo || undefined,
      dob:            form.dob,
      gender:         GENDER_MAP_REVERSE[form.gender],
      departmentId:   form.departmentId,
      phone:          form.phone,
      email:          form.email || undefined,
      experienceYears:form.experience,
      opdFee:         form.opdFee,
      opdStartTime:   form.opdStartTime || undefined,
      opdEndTime:     form.opdEndTime || undefined,
      avgConsultMins: form.avgConsultMins,
      bio:            form.bio || undefined,
      status:         form.status,
      qualifications: form.qualification,
      specializations:form.specializations,
      opdDays:        form.opdDays,
      illnessTags:    form.illnessTags,
    };
    const result = editing
      ? await masterUpdate("/api/masters/doctors", editing._id, body)
      : await masterCreate("/api/masters/doctors", body);
    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
    setToast({ msg: editing ? `${form.name} updated` : `${form.name} added`, isEdit: !!editing });
    setTimeout(() => setToast(null), 4000);
  }

  const statusColor: Record<DoctorStatus, string> = {
    Active: "green", "On Leave": "yellow", Inactive: "red",
  };

  const totalActive   = doctors.filter(d => d.status === "Active").length;
  const totalOnLeave  = doctors.filter(d => d.status === "On Leave").length;
  const totalInactive = doctors.filter(d => d.status === "Inactive").length;

  if (dLoading || deptLoading) return <LoadingState />;

  return (
    <div>
      {dError && <ErrorBanner msg={dError} onRetry={reload} />}
      <PageHeader
        title="Doctor List"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Doctors" }]}
        action={canEdit ? { label: "Add Doctor", onClick: openAdd } : undefined}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatMini label="Total Doctors" value={doctors.length}  color="text-slate-900" />
        <StatMini label="Active"        value={totalActive}     color="text-emerald-600" />
        <StatMini label="On Leave"      value={totalOnLeave}    color="text-amber-500" />
        <StatMini label="Inactive"      value={totalInactive}   color="text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, specialization, phone…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Status</option>
            {["Active", "On Leave", "Inactive"].map(s => <option key={s}>{s}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-xs text-slate-400 self-center">{filtered.length} doctors</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Doctor","Age / Gender","Department","Qualifications","Specializations","Experience","OPD Fee","OPD Days","Status","Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No doctors found</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sky-700 font-bold text-xs">
                          {d.name.split(" ").filter(w => !w.startsWith("Dr")).map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 whitespace-nowrap">{d.name}</p>
                        <p className="text-xs text-slate-400">{d.registrationNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{calcAge(d.dob)}y / {d.gender.charAt(0)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge label={d.department} variant="sky" /></td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <div className="flex flex-wrap gap-1">
                      {d.qualification.slice(0, 2).map(q => (
                        <span key={q} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{q}</span>
                      ))}
                      {d.qualification.length > 2 && <span className="text-xs text-slate-400">+{d.qualification.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {d.specializations.slice(0, 2).map(s => (
                        <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                      {d.specializations.length > 2 && <span className="text-xs text-slate-400">+{d.specializations.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.experience} yrs</td>
                  <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">₹{d.opdFee}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.opdDays.map(day => (
                        <span key={day} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">{day}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={d.status} variant={statusColor[d.status] as "green" | "yellow" | "red"} dot />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewDoctor(d)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors" title="View">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(d)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={async () => { await masterToggle("/api/masters/doctors", d._id); reload(); }}
                            className={`p-1.5 rounded-lg transition-colors ${d.status === "Active" ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                            title={d.status === "Active" ? "Deactivate" : "Activate"}>
                            {d.status === "Active" ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-400">No doctors found</div>
          ) : filtered.map((d) => (
            <div key={d.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sky-700 font-bold text-xs">
                      {d.name.split(" ").filter(w => !w.startsWith("Dr")).map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.registrationNo}</p>
                  </div>
                </div>
                <Badge label={d.status} variant={statusColor[d.status] as "green" | "yellow" | "red"} dot />
              </div>
              <p className="text-xs text-slate-600">{d.department} · {d.experience} yrs exp · ₹{d.opdFee}</p>
              <div className="flex items-center gap-1 pt-0.5">
                <button onClick={() => setViewDoctor(d)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700">View</button>
                {canEdit && <button onClick={() => openEdit(d)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700">Edit</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Doctor — ${editing.name}` : "Add New Doctor"}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add Doctor"}
            </button>
          </>
        }>
        <div className="space-y-5">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}
          <SH>Personal Details</SH>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Full Name" required error={errors.name}>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Full Name" autoFocus/>
            </FormField>
            <FormField label="Date of Birth" required error={errors.dob}>
              <Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
            </FormField>
            <FormField label="Age (auto)">
              <Input value={form.dob ? calcAge(form.dob) + " years" : "—"} disabled />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Gender">
              <Select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as DoctorGender })}>
                {["Male","Female","Other"].map(g => <option key={g}>{g}</option>)}
              </Select>
            </FormField>
            <FormField label="Phone" required error={errors.phone}>
              <Input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit mobile number" />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="doctor@senhospital.com" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Registration Number">
              <Input value={form.registrationNo} onChange={e => setForm({ ...form, registrationNo: e.target.value })} placeholder="MCI / State council reg no" />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DoctorResponse["status"] })}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>

          <SH>Qualifications & Specializations</SH>
          <MultiSelect label="Qualifications *" options={ALL_QUALIFICATIONS} selected={form.qualification}
            onChange={v => setForm({ ...form, qualification: v })} placeholder="Type to search qualifications…"/>
          {errors.qualification && <p className="text-xs text-red-500 -mt-3">{errors.qualification}</p>}
          <MultiSelect label="Specializations *" options={ALL_SPECIALIZATIONS} selected={form.specializations}
            onChange={v => setForm({ ...form, specializations: v })} placeholder="Type to search specializations…"/>
          {errors.specializations && <p className="text-xs text-red-500 -mt-3">{errors.specializations}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department" required error={errors.department}>
              <Select value={form.departmentId ? String(form.departmentId) : ""}
                onChange={e => setForm({ ...form, departmentId: Number(e.target.value) })}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d._id} value={String(d._id)}>{d.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Experience (years)">
              <Input type="number" min={0} value={form.experience}
                onChange={e => setForm({ ...form, experience: Number(e.target.value) })} />
            </FormField>
          </div>

          <SH>OPD Schedule</SH>
          <FormField label="OPD Days">
            <DayToggle selected={form.opdDays} onChange={v => setForm({ ...form, opdDays: v })} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="OPD Start Time">
              <Input type="time" value={form.opdStartTime} onChange={e => setForm({ ...form, opdStartTime: e.target.value })} />
            </FormField>
            <FormField label="OPD End Time">
              <Input type="time" value={form.opdEndTime} onChange={e => setForm({ ...form, opdEndTime: e.target.value })} />
            </FormField>
            <FormField label="OPD Fee (₹)">
              <Input type="number" min={0} value={form.opdFee} onChange={e => setForm({ ...form, opdFee: Number(e.target.value) })} />
            </FormField>
          </div>
          <FormField label="Avg. Consultation Time (mins)">
            <Input type="number" min={5} max={120} value={form.avgConsultMins}
              onChange={e => setForm({ ...form, avgConsultMins: Number(e.target.value) })} className="max-w-[120px]" />
          </FormField>

          <SH>Illness Tags (for auto-suggestion)</SH>
          <FormField label="Illness Keywords">
            <Textarea value={form.illnessTags.join(", ")}
              onChange={e => setForm({ ...form, illnessTags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
              placeholder="chest pain, heart attack, hypertension…" rows={2}/>
            <p className="text-xs text-slate-400 mt-1">Comma-separated. Used to suggest this doctor when a patient describes their illness.</p>
          </FormField>
          <FormField label="Bio / About">
            <Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Brief description of expertise…" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-start gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p>{toast.msg}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Contact info {toast.isEdit ? "updated" : "added"} automatically.{" "}
              <Link href="/contacts" className="text-sky-400 hover:text-sky-300 underline">View Contacts →</Link>
            </p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-500 hover:text-white ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── View Modal ── */}
      <Modal open={!!viewDoctor} onClose={() => setViewDoctor(null)} title="Doctor Profile" size="md">
        {viewDoctor && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sky-700 font-bold text-xl">
                  {viewDoctor.name.split(" ").filter(w => !w.startsWith("Dr")).map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{viewDoctor.name}</h3>
                <p className="text-sm text-slate-500">{viewDoctor.registrationNo}</p>
                <Badge label={viewDoctor.status} variant={statusColor[viewDoctor.status] as "green" | "yellow" | "red"} dot />
              </div>
            </div>
            {viewDoctor.bio && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{viewDoctor.bio}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Age" value={`${calcAge(viewDoctor.dob)} years`} />
              <InfoRow label="Gender" value={viewDoctor.gender} />
              <InfoRow label="Department" value={viewDoctor.department} />
              <InfoRow label="Experience" value={`${viewDoctor.experience} years`} />
              <InfoRow label="Phone" value={viewDoctor.phone} />
              <InfoRow label="OPD Fee" value={`₹${viewDoctor.opdFee}`} />
            </div>
            {viewDoctor.specializations.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Specializations</p>
                <div className="flex flex-wrap gap-1">
                  {viewDoctor.specializations.map(s => (
                    <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-slate-100"/>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
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
