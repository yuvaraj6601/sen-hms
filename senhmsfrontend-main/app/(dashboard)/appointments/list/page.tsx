"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getSession } from "../../../_lib/auth";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";

// ─── Backend types ────────────────────────────────────────────────────────────

interface AppointmentResponse {
  id: number;
  appointmentNo: string;
  patientId: number;
  patientName: string;
  uhid: string;
  phone: string;
  patientCategory: string;
  doctorId: number;
  doctorName: string;
  department: string;
  date: string;        // "YYYY-MM-DD"
  time: string;
  type: string;        // SCREAMING_SNAKE_CASE: NEW | REVIEW | FOLLOW_UP | IP_ROUNDS
  status: string;      // SCREAMING_SNAKE_CASE: SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | NO_SHOW | CANCELLED
  reason: string;
  bookedBy: string;
  bookedDate: string;
  completionNotes: string | null;
  cancelReason: string | null;
  originalVisitDate: string | null;
  reviewNotes: string | null;
  tokenNo: string | null;
  opVisitId: number | null;
  smsSent: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface DoctorOption   {
  id: number; name: string; department: string | null;
  qualifications?: string[] | null;  // ["MBBS","MD"]
  opdStartTime?: string | null;   // "09:00"
  opdEndTime?:   string | null;   // "13:00"
  avgConsultMins?: number | null; // slot duration
  opdDays?: string[] | null;      // ["Mon","Tue",...]
  status?: string | null;         // ACTIVE | ON_LEAVE | INACTIVE
}
interface DeptOption     { id: number; name: string; }
interface PatientSummary { id: number; name: string; uhid: string; phone: string; patientType: string; age: number | null; }

// ─── Enum display maps ────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, string> = {
  SCHEDULED:   "Scheduled",
  CONFIRMED:   "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  NO_SHOW:     "No Show",
  CANCELLED:   "Cancelled",
};

const TYPE_DISPLAY: Record<string, string> = {
  NEW:       "New",
  REVIEW:    "Review",
  FOLLOW_UP: "Follow-up",
};

const STATUS_COLORS: Record<string, "gray" | "sky" | "orange" | "green" | "red" | "purple"> = {
  SCHEDULED:   "gray",
  CONFIRMED:   "sky",
  IN_PROGRESS: "orange",
  COMPLETED:   "green",
  CANCELLED:   "red",
  NO_SHOW:     "purple",
};

// Display values used in tabs / filter
type TabValue = "All" | "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

const TABS: { value: TabValue; label: string }[] = [
  { value: "All",         label: "All"         },
  { value: "SCHEDULED",   label: "Scheduled"   },
  { value: "CONFIRMED",   label: "Confirmed"   },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED",   label: "Completed"   },
  { value: "NO_SHOW",     label: "No Show"     },
  { value: "CANCELLED",   label: "Cancelled"   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

/** Age in whole years from a "YYYY-MM-DD" date of birth; "" when blank/invalid. */
function calcAgeFromDob(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

/** "YYYY-MM-DD" for N days from today (local). */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Slot math helpers ─────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "09:00" → 540 minutes since midnight */
function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 540 → "09:00" */
function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Day-of-week short name for a "YYYY-MM-DD" date string (local, no TZ drift) */
function dayNameOf(dateStr: string): string {
  if (!dateStr) return "";
  const [y, mo, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(y, mo - 1, d).getDay()];
}

/** True if the date is strictly before today (local) */
function isPastDate(dateStr: string): boolean {
  return !!dateStr && dateStr < today();
}

/** "Dr. Rao — MBBS, MD · Cardiology" for a doctor dropdown option */
function doctorLabel(d: DoctorOption): string {
  const quals = (d.qualifications ?? []).slice(0, 3).join(", ");
  const parts = [d.name];
  if (quals)        parts.push(quals);
  if (d.department) parts.push(d.department);
  // name — quals · dept
  return quals
    ? `${d.name} — ${quals}${d.department ? ` · ${d.department}` : ""}`
    : `${d.name}${d.department ? ` — ${d.department}` : ""}`;
}

type SlotState = "free" | "booked" | "suggested" | "past";

interface Slot {
  time:  string;                        // "09:15"
  state: SlotState;
  appt?: AppointmentResponse;           // occupant when booked
}

/** Current minutes-since-midnight (local). */
function nowMins(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Build the slot grid for a doctor on a given day.
 * - Steps from opdStartTime → opdEndTime in avgConsultMins increments.
 * - Marks a slot booked if an active (non cancelled/no-show/completed) appt sits on it.
 * - When `minTimeMins` is provided (i.e. the chosen date is today), any slot whose
 *   start time is at or before "now" is marked "past" and cannot be picked.
 * - Marks the first free slot that is still in the future as "suggested".
 * Returns null when the doctor has no OPD hours configured.
 */
function buildSlots(
  doctor: DoctorOption | undefined,
  dayAppts: AppointmentResponse[],
  minTimeMins?: number,
): Slot[] | null {
  if (!doctor) return null;
  const start = doctor.opdStartTime || "";
  const end   = doctor.opdEndTime   || "";
  if (!start || !end) return null;

  const step = doctor.avgConsultMins && doctor.avgConsultMins > 0 ? doctor.avgConsultMins : 15;
  const startM = timeToMins(start);
  const endM   = timeToMins(end);
  if (endM <= startM) return null;

  // Times that are actively occupied (ignore cancelled / no-show / completed)
  const takenMap = new Map<string, AppointmentResponse>();
  dayAppts.forEach(a => {
    if (!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status)) {
      takenMap.set(a.time, a);
    }
  });

  const slots: Slot[] = [];
  let suggestedMarked = false;
  for (let m = startM; m < endM; m += step) {
    const t = minsToTime(m);
    const appt = takenMap.get(t);
    const isPast = minTimeMins != null && m < minTimeMins;
    if (appt) {
      slots.push({ time: t, state: "booked", appt });
    } else if (isPast) {
      slots.push({ time: t, state: "past" });
    } else if (!suggestedMarked) {
      slots.push({ time: t, state: "suggested" });
      suggestedMarked = true;
    } else {
      slots.push({ time: t, state: "free" });
    }
  }
  return slots;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Slot grid component (shared by booking modal + schedule view) ─────────────

function SlotGrid({ slots, loading, doctor, selectedTime, onPick }: {
  slots: Slot[] | null;
  loading: boolean;
  doctor: DoctorOption | undefined;
  selectedTime?: string;
  onPick?: (time: string) => void;
}) {
  if (loading) {
    return <p className="text-xs text-slate-400 py-3">Loading schedule…</p>;
  }
  if (!doctor) {
    return <p className="text-xs text-slate-400 py-3">Select a doctor to see the schedule.</p>;
  }
  if (!slots) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
        OPD hours are not configured for {doctor.name}. Use the time field above, or set OPD hours in Doctor Master.
      </div>
    );
  }

  const bookedCount = slots.filter(s => s.state === "booked").length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs">
        <span className="font-semibold text-slate-600">
          {doctor.name} · OPD {doctor.opdStartTime}–{doctor.opdEndTime} · {doctor.avgConsultMins || 15} min slots
        </span>
        <span className="text-slate-400">{bookedCount}/{slots.length} booked</span>
      </div>
      <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
        {slots.map(s => {
          const isSelected = selectedTime === s.time;
          if (s.state === "booked") {
            return (
              <div key={s.time}
                title={`${s.appt?.patientName ?? ""} — ${STATUS_DISPLAY[s.appt?.status ?? ""] ?? s.appt?.status ?? ""}`}
                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-left cursor-not-allowed">
                <p className="text-xs font-bold text-red-700">{s.time}</p>
                <p className="text-[10px] text-red-500 truncate">{s.appt?.patientName}</p>
              </div>
            );
          }
          if (s.state === "past") {
            return (
              <div key={s.time}
                title="This time has already passed today"
                className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-left cursor-not-allowed opacity-60">
                <p className="text-xs font-bold text-slate-400 line-through">{s.time}</p>
                <p className="text-[10px] text-slate-400">passed</p>
              </div>
            );
          }
          const base = "rounded-lg border px-2 py-1.5 text-left transition-colors";
          const cls = isSelected
            ? "border-sky-500 bg-sky-500 text-white"
            : s.state === "suggested"
              ? "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
              : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50";
          return (
            <button key={s.time} type="button"
              onClick={() => onPick?.(s.time)}
              disabled={!onPick}
              className={`${base} ${cls} ${!onPick ? "cursor-default" : ""}`}>
              <p className="text-xs font-bold">{s.time}</p>
              <p className={`text-[10px] ${isSelected ? "text-sky-100" : "text-slate-400"}`}>
                {s.state === "suggested" ? "next free" : "free"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty booking form ───────────────────────────────────────────────────────

interface BookingForm {
  patientMode:     "existing" | "new";
  // new-patient fields (used when patientMode === "new")
  newName:         string;
  newPhone:        string;
  newGender:       "MALE" | "FEMALE" | "OTHER";
  newDob:          string;
  newAge:          string;
  patientId:       number | null;
  patientName:     string;
  uhid:            string;
  phone:           string;
  patientCategory: string;
  existingAge:     number | null;   // age of a selected existing patient (read-only display)
  doctorId:        number | null;
  doctorName:      string;
  department:      string;
  date:            string;
  time:            string;
  type:            string;   // backend enum: NEW | REVIEW | FOLLOW_UP | IP_ROUNDS
  reason:          string;
  bookedBy:        string;
  originalVisitDate: string | null;
  reviewNotes:     string;
}

function emptyForm(bookedBy: string): BookingForm {
  return {
    patientMode: "existing",
    newName: "", newPhone: "", newGender: "MALE", newDob: "", newAge: "",
    patientId: null, patientName: "", uhid: "", phone: "",
    patientCategory: "OP",
    existingAge: null,
    doctorId: null, doctorName: "", department: "",
    date: today(), time: "09:00",
    type: "NEW",
    reason: "", bookedBy,
    originalVisitDate: null, reviewNotes: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const session  = getSession();
  const role     = session?.role ?? "Admin";
  const userName = session?.name ?? "System";
  const sessionDoctorId = session?.doctorId ?? null;
  const isDoctor = role === "Doctor";
  const canBook  = ["Admin", "Receptionist", "Lab/Ins/Reception"].includes(role);
  const canAct   = ["Admin", "Receptionist", "Doctor", "Lab/Ins/Reception"].includes(role);

  // ── Data ──
  const [appts,       setAppts]       = useState<AppointmentResponse[]>([]);
  const [doctors,     setDoctors]     = useState<DoctorOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [issuingId,   setIssuingId]   = useState<number | null>(null);

  // ── Filters ──
  const [activeTab,    setActiveTab]    = useState<TabValue>("All");
  const [search,       setSearch]       = useState("");
  const [dateFilter,   setDateFilter]   = useState(today());
  const [deptFilter,   setDeptFilter]   = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");

  // ── Book modal ──
  const [modalOpen,   setModalOpen]   = useState(false);
  const [form,        setForm]        = useState<BookingForm>(emptyForm(userName));
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [saving,      setSaving]      = useState(false);
  const [ptQuery,     setPtQuery]     = useState("");
  const [ptResults,   setPtResults]   = useState<PatientSummary[]>([]);
  const [ptDropOpen,  setPtDropOpen]  = useState(false);
  const ptRef = useRef<HTMLDivElement>(null);

  // ── Slot grid for the booking modal (doctor's day) ──
  const [slotAppts,   setSlotAppts]   = useState<AppointmentResponse[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);

  // ── View Schedule modal ──
  const [schedOpen,    setSchedOpen]    = useState(false);
  const [schedDoctorId, setSchedDoctorId] = useState<number | null>(null);
  const [schedDate,    setSchedDate]    = useState(today());
  const [schedAppts,   setSchedAppts]   = useState<AppointmentResponse[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);

  // ── Cancel modal ──
  const [cancelTarget, setCancelTarget] = useState<AppointmentResponse | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr,    setCancelErr]    = useState("");

  // ── Complete modal ──
  const [completeTarget, setCompleteTarget] = useState<AppointmentResponse | null>(null);
  const [completeNotes,  setCompleteNotes]  = useState("");

  // ── Review modal ──
  const [reviewTarget, setReviewTarget] = useState<AppointmentResponse | null>(null);
  const [reviewDate,   setReviewDate]   = useState("");
  const [reviewNotes,  setReviewNotes]  = useState("");
  const [reviewErr,    setReviewErr]    = useState("");

  // ── Load appointments ──────────────────────────────────────────────────────

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: "0", size: "500" });
    if (dateFilter) params.set("date", dateFilter);
    if (isDoctor && sessionDoctorId) params.set("doctorId", String(sessionDoctorId));
    const { ok, data, error: err } = await apiFetch(`/api/appointments?${params}`);
    if (ok) {
      // backend returns PagedResponse — content array lives in data.content
      const content: AppointmentResponse[] = Array.isArray(data)
        ? data
        : (data?.content ?? []);
      setAppts(content);
    } else {
      setError(err);
    }
    setLoading(false);
  }, [dateFilter, isDoctor, sessionDoctorId, setLoading, setError, setAppts]);

  // ── Load masters ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadMasters() {
      const [docRes, deptRes] = await Promise.all([
        apiFetch("/api/masters/doctors?page=0&size=200&active=true"),
        apiFetch("/api/masters/departments?page=0&size=200"),
      ]);
      if (docRes.ok) {
        const raw = Array.isArray(docRes.data) ? docRes.data : (docRes.data?.content ?? []);
        const content: DoctorOption[] = raw.map((d: Record<string, unknown>) => ({
          id:             d.id as number,
          name:           d.name as string,
          department:     (d.departmentName ?? d.department ?? null) as string | null,
          qualifications: (d.qualifications ?? null) as string[] | null,
          opdStartTime:   (d.opdStartTime ?? null) as string | null,
          opdEndTime:     (d.opdEndTime ?? null) as string | null,
          avgConsultMins: (d.avgConsultMins ?? null) as number | null,
          opdDays:        (d.opdDays ?? null) as string[] | null,
          status:         (d.status ?? null) as string | null,
        }));
        setDoctors(content);
      }
      if (deptRes.ok) {
        const content: DeptOption[] = Array.isArray(deptRes.data)
          ? deptRes.data
          : (deptRes.data?.content ?? []);
        setDepartments(content);
      }
    }
    loadMasters();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // ── Patient search (debounced) ─────────────────────────────────────────────

  const ptSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePtQueryChange(val: string) {
    setPtQuery(val);
    setPtDropOpen(true);
    if (!val) {
      setForm(f => ({ ...f, patientId: null, patientName: "", uhid: "", phone: "" }));
      setPtResults([]);
      return;
    }
    if (ptSearchTimeout.current) clearTimeout(ptSearchTimeout.current);
    if (val.length < 2) { setPtResults([]); return; }
    ptSearchTimeout.current = setTimeout(async () => {
      const { ok, data } = await apiFetch(
        `/api/patients?search=${encodeURIComponent(val)}&page=0&size=10`
      );
      if (ok) {
        const content: PatientSummary[] = Array.isArray(data)
          ? data
          : (data?.content ?? []);
        setPtResults(content);
      }
    }, 300);
  }

  function selectPatient(p: PatientSummary) {
    setForm(f => ({
      ...f,
      patientId: p.id, patientName: p.name, uhid: p.uhid, phone: p.phone,
      patientCategory: p.patientType === "IP" ? "IP" : "OP",
      existingAge: p.age ?? null,
    }));
    setPtQuery(`${p.name} — ${p.uhid}`);
    setPtDropOpen(false);
    setPtResults([]);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return appts.filter(a => {
      const matchTab = activeTab === "All" ? true : a.status === activeTab;
      const q  = search.toLowerCase();
      const ms = !q ||
        a.patientName.toLowerCase().includes(q) ||
        a.uhid.toLowerCase().includes(q) ||
        a.appointmentNo.toLowerCase().includes(q) ||
        a.phone.includes(q);
      const mpt = !deptFilter   || a.department === deptFilter;
      const mdr = !doctorFilter || String(a.doctorId) === doctorFilter;
      return matchTab && ms && mpt && mdr;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [appts, activeTab, search, deptFilter, doctorFilter]);

  const tabCounts = useMemo(() => {
    const m: Record<string, number> = { All: appts.length };
    appts.forEach(a => { m[a.status] = (m[a.status] ?? 0) + 1; });
    return m;
  }, [appts]);

  // ── Fetch appointments for the doctor+date chosen in the booking modal ─────

  const fetchDayAppts = useCallback(async (doctorId: number, date: string): Promise<AppointmentResponse[]> => {
    const params = new URLSearchParams({ page: "0", size: "500", doctorId: String(doctorId), date });
    const { ok, data } = await apiFetch(`/api/appointments?${params}`);
    if (!ok) return [];
    return Array.isArray(data) ? data : (data?.content ?? []);
  }, []);

  // Load slot grid whenever the booking modal has both doctor + date
  useEffect(() => {
    if (!modalOpen || !form.doctorId || !form.date) { setSlotAppts([]); return; }
    let cancelled = false;
    setSlotLoading(true);
    fetchDayAppts(form.doctorId, form.date).then(list => {
      if (!cancelled) { setSlotAppts(list); setSlotLoading(false); }
    });
    return () => { cancelled = true; };
  }, [modalOpen, form.doctorId, form.date, fetchDayAppts]);

  const selectedDoctor = useMemo(
    () => doctors.find(d => d.id === form.doctorId),
    [doctors, form.doctorId]
  );

  // When booking for today, slots at/earlier than the current time are "past".
  const bookingSlots = useMemo(
    () => buildSlots(selectedDoctor, slotAppts, form.date === today() ? nowMins() : undefined),
    [selectedDoctor, slotAppts, form.date]
  );

  // True when booking for today and the doctor's OPD window has fully elapsed
  // (end time already passed, or every remaining slot is past/booked).
  const opdClosedForToday = useMemo(() => {
    if (!selectedDoctor || form.date !== today()) return false;
    if (!selectedDoctor.opdStartTime || !selectedDoctor.opdEndTime) return false;
    // Whole OPD window is behind us.
    if (nowMins() >= timeToMins(selectedDoctor.opdEndTime)) return true;
    // Or there are slots but none are still bookable today.
    if (bookingSlots && bookingSlots.length > 0) {
      return !bookingSlots.some(s => s.state === "free" || s.state === "suggested");
    }
    return false;
  }, [selectedDoctor, form.date, bookingSlots]);

  // ── View Schedule modal: load appts for chosen doctor+date ──
  useEffect(() => {
    if (!schedOpen || !schedDoctorId || !schedDate) { setSchedAppts([]); return; }
    let cancelled = false;
    setSchedLoading(true);
    fetchDayAppts(schedDoctorId, schedDate).then(list => {
      if (!cancelled) { setSchedAppts(list); setSchedLoading(false); }
    });
    return () => { cancelled = true; };
  }, [schedOpen, schedDoctorId, schedDate, fetchDayAppts]);

  const schedDoctor = useMemo(
    () => doctors.find(d => d.id === schedDoctorId),
    [doctors, schedDoctorId]
  );
  const schedSlots = useMemo(
    () => buildSlots(schedDoctor, schedAppts),
    [schedDoctor, schedAppts]
  );

  // Auto-suggest the next free slot when doctor/date/slots change
  useEffect(() => {
    if (!modalOpen || !bookingSlots) return;
    const suggested = bookingSlots.find(s => s.state === "suggested");
    if (suggested && form.time !== suggested.time) {
      // Auto-fill if current time is empty, or points to a now-booked / now-past slot
      const current = bookingSlots.find(s => s.time === form.time);
      if (!form.time || current?.state === "booked" || current?.state === "past") {
        setForm(f => ({ ...f, time: suggested.time }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingSlots, modalOpen]);

  // ── Booking-form edge-case warnings (derived, non-blocking) ────────────────

  const bookingWarnings = useMemo(() => {
    const w: string[] = [];
    if (!selectedDoctor || !form.date) return w;

    // Doctor on leave / inactive
    if (selectedDoctor.status === "ON_LEAVE") w.push(`${selectedDoctor.name} is currently marked On Leave.`);
    if (selectedDoctor.status === "INACTIVE") w.push(`${selectedDoctor.name} is currently Inactive.`);

    // Not scheduled that day
    const dn = dayNameOf(form.date);
    const opdDays = selectedDoctor.opdDays ?? [];
    if (opdDays.length > 0 && dn && !opdDays.includes(dn)) {
      w.push(`${selectedDoctor.name} is not scheduled on ${dn}days (OPD days: ${opdDays.join(", ")}).`);
    }

    // No OPD hours configured
    if (!selectedDoctor.opdStartTime || !selectedDoctor.opdEndTime) {
      w.push(`OPD hours not configured for ${selectedDoctor.name}. Set them in Doctor Master to enable the slot grid.`);
    } else if (form.time) {
      // Outside OPD hours
      const tM = timeToMins(form.time);
      if (tM < timeToMins(selectedDoctor.opdStartTime) || tM >= timeToMins(selectedDoctor.opdEndTime)) {
        w.push(`${form.time} is outside OPD hours (${selectedDoctor.opdStartTime}–${selectedDoctor.opdEndTime}).`);
      }
    }

    // All slots full (every bookable slot is taken). "past" slots are handled
    // separately by the opdClosedForToday alert, so ignore them here.
    if (
      bookingSlots &&
      bookingSlots.length > 0 &&
      bookingSlots.some(s => s.state !== "past") &&
      bookingSlots.filter(s => s.state !== "past").every(s => s.state === "booked")
    ) {
      w.push(`All remaining slots are booked for this day.`);
    }

    // Past date
    if (isPastDate(form.date)) w.push(`The selected date is in the past.`);

    // Same patient already booked same doctor+date
    if (form.patientId) {
      const dup = slotAppts.find(a =>
        a.patientId === form.patientId &&
        !["CANCELLED", "NO_SHOW"].includes(a.status)
      );
      if (dup) w.push(`${form.patientName} already has an appointment with this doctor on ${form.date} at ${dup.time} (${STATUS_DISPLAY[dup.status] ?? dup.status}).`);
    }

    return w;
  }, [selectedDoctor, form.date, form.time, form.patientId, form.patientName, bookingSlots, slotAppts]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function patchStatus(id: number, body: object) {
    const { ok, error: err } = await apiFetch(`/api/appointments/${id}/status`, {
      method: "PATCH",
      body:   JSON.stringify(body),
    });
    if (ok) { await loadAppointments(); }
    else    { alert(`Error: ${err}`); }
  }

  function handleConfirm(a: AppointmentResponse) {
    patchStatus(a.id, { status: "CONFIRMED" });
  }

  function handleNoShow(a: AppointmentResponse) {
    patchStatus(a.id, { status: "NO_SHOW" });
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { setCancelErr("Reason required"); return; }
    await patchStatus(cancelTarget.id, { status: "CANCELLED", cancelReason });
    setCancelTarget(null);
    setCancelReason("");
  }

  async function handleComplete() {
    if (!completeTarget) return;
    await patchStatus(completeTarget.id, { status: "COMPLETED", completionNotes: completeNotes });
    setCompleteTarget(null);
    setCompleteNotes("");
  }

  // Move a confirmed OP appointment into the OP queue (generates the token,
  // carrying the booked appointment time as the arrival time).
  async function handleIssueToken(a: AppointmentResponse) {
    setIssuingId(a.id);
    const { ok, data, error: err } = await apiFetch(`/api/appointments/${a.id}/issue-token`, {
      method: "POST",
    });
    setIssuingId(null);
    if (ok) {
      await loadAppointments();
      const token = (data as { tokenNo?: string } | null)?.tokenNo;
      alert(token
        ? `OP token ${token} issued. Patient moved to the OP queue.`
        : "Patient moved to the OP queue.");
    } else {
      alert(`Could not issue token: ${err}`);
    }
  }

  // ── Book / Review ──────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.patientMode === "existing") {
      if (!form.patientId) e.patient = "Select a patient";
    } else {
      if (!form.newName.trim())              e.newName  = "Name is required";
      if (!/^\d{10}$/.test(form.newPhone.trim())) e.newPhone = "Enter a valid 10-digit mobile number";
    }
    if (!form.doctorId)       e.doctor  = "Select a doctor";
    if (!form.date)           e.date    = "Date is required";
    // Block booking a time that has already passed when the date is today.
    if (form.date === today() && form.time && timeToMins(form.time) < nowMins()) {
      e.time = "That time has already passed. Pick a later slot or book for the next day.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleBook() {
    if (!validate()) return;
    setSaving(true);

    // Resolve patient identity — create first if this is a new walk-in patient.
    let patientId   = form.patientId;
    let patientName = form.patientName;
    let uhid        = form.uhid;
    let phone       = form.phone;
    const patientCategory = "OP";

    if (form.patientMode === "new") {
      const { ok, data, error: pErr } = await apiFetch("/api/patients", {
        method: "POST",
        body: JSON.stringify({
          name:        form.newName.trim(),
          phone:       form.newPhone.trim(),
          gender:      form.newGender,
          dateOfBirth: form.newDob || undefined,
          age:         form.newAge ? Number(form.newAge) : null,
          patientType: "OP",
        }),
      });
      if (!ok || !data?.id) {
        setSaving(false);
        setErrors(e => ({ ...e, newName: `Could not register patient: ${pErr}` }));
        return;
      }
      patientId   = data.id;
      patientName = data.name;
      uhid        = data.uhid;
      phone       = data.phone;
    }

    const body = {
      patientId,
      patientName,
      uhid,
      phone,
      patientCategory,
      doctorId:        form.doctorId,
      doctorName:      form.doctorName,
      department:      form.department,
      date:            form.date,
      time:            form.time,
      type:            form.type,
      reason:          form.reason || undefined,
      bookedBy:        form.bookedBy,
      originalVisitDate: form.originalVisitDate ?? undefined,
      reviewNotes:     form.reviewNotes || undefined,
    };
    const { ok, error: err } = await apiFetch("/api/appointments", {
      method: "POST",
      body:   JSON.stringify(body),
    });
    setSaving(false);
    if (ok) {
      await loadAppointments();
      setModalOpen(false);
      setForm(emptyForm(userName));
      setPtQuery("");
    } else if (/already booked|slot/i.test(err)) {
      // Slot conflict (409). Refresh the grid and suggest the next free slot.
      if (form.doctorId && form.date) {
        const fresh = await fetchDayAppts(form.doctorId, form.date);
        setSlotAppts(fresh);
        const nextSlots = buildSlots(selectedDoctor, fresh);
        const next = nextSlots?.find(s => s.state === "suggested");
        setErrors(e => ({
          ...e,
          time: next
            ? `${err}. Next free slot: ${next.time}.`
            : err,
        }));
        if (next) setForm(f => ({ ...f, time: next.time }));
      } else {
        setErrors(e => ({ ...e, time: err }));
      }
    } else {
      alert(`Booking failed: ${err}`);
    }
  }

  async function handleScheduleReview() {
    if (!reviewTarget) return;
    if (!reviewDate) { setReviewErr("Review date is required"); return; }
    setSaving(true);
    const body = {
      patientId:         reviewTarget.patientId,
      patientName:       reviewTarget.patientName,
      uhid:              reviewTarget.uhid,
      phone:             reviewTarget.phone,
      patientCategory:   reviewTarget.patientCategory,
      doctorId:          reviewTarget.doctorId,
      doctorName:        reviewTarget.doctorName,
      department:        reviewTarget.department,
      date:              reviewDate,
      time:              reviewTarget.time,
      type:              "REVIEW",
      reason:            reviewTarget.reason,
      originalVisitDate: reviewTarget.date,
      reviewNotes:       reviewNotes || undefined,
      bookedBy:          userName,
    };
    const { ok, error: err } = await apiFetch("/api/appointments", {
      method: "POST",
      body:   JSON.stringify(body),
    });
    setSaving(false);
    if (ok) {
      await loadAppointments();
      setReviewTarget(null);
      setReviewDate("");
      setReviewNotes("");
    } else {
      alert(`Schedule review failed: ${err}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Appointments"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Appointments" }]}
        action={canBook ? { label: "Book Appointment", onClick: () => setModalOpen(true) } : undefined}
      >
        <button
          onClick={() => { setSchedOpen(true); setSchedDoctorId(null); setSchedDate(today()); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
            border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700
            transition-colors whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          View Doctor Schedule
        </button>
      </PageHeader>

      {/* error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200
          text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {error}
          <button onClick={loadAppointments} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total",     value: appts.length,             color: "text-slate-900" },
          { label: "Scheduled", value: tabCounts["SCHEDULED"] ?? 0, color: "text-gray-600"  },
          { label: "Confirmed", value: tabCounts["CONFIRMED"] ?? 0, color: "text-sky-600"   },
          { label: "Completed", value: tabCounts["COMPLETED"] ?? 0, color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => {
          const active = activeTab === t.value;
          return (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-medium whitespace-nowrap transition-colors border
                ${active ? "bg-sky-500 text-white border-sky-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {tabCounts[t.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, UHID, appt no…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        {[
          { label: "Today",     fn: () => setDateFilter(today()) },
          { label: "All Dates", fn: () => setDateFilter("")      },
        ].map(p => (
          <button key={p.label} onClick={p.fn}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200
              bg-white text-slate-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700
              transition-colors whitespace-nowrap">
            {p.label}
          </button>
        ))}
        {!isDoctor && (
          <div className="relative">
            <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
                bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        )}
        <div className="relative">
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <p className="text-xs text-slate-400 self-center">{filtered.length} appointments</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Appt No","Date","Time","Patient","UHID","Type","Doctor","Dept",
                  "Status","Actions",
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  Loading appointments…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    No appointments found
                  </div>
                </td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className={`hover:bg-slate-50 transition-colors
                  ${a.status === "CANCELLED" || a.status === "NO_SHOW" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sky-700
                      bg-sky-50 px-2 py-0.5 rounded">{a.appointmentNo}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{a.date}</td>
                  <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">{a.time}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                        ${a.patientCategory === "IP" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}`}>
                        {a.patientCategory}
                      </span>
                      <p className="font-medium text-slate-800 whitespace-nowrap">{a.patientName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.uhid}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge label={TYPE_DISPLAY[a.type] ?? a.type} variant="gray"/>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{a.doctorName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {a.department}
                    {a.originalVisitDate && (
                      <p className="text-xs text-slate-400">Original: {a.originalVisitDate}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={STATUS_DISPLAY[a.status] ?? a.status}
                      variant={STATUS_COLORS[a.status] ?? "gray"}
                      dot
                    />
                    {a.smsSent && <p className="text-xs text-emerald-500 mt-0.5">📱 SMS sent</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {/* Confirm */}
                      {canAct && a.status === "SCHEDULED" && (
                        <button onClick={() => handleConfirm(a)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg
                            text-xs font-semibold bg-sky-50 text-sky-700
                            hover:bg-sky-100 transition-colors whitespace-nowrap">
                          ✓ Confirm
                        </button>
                      )}
                      {/* Issue Token — move the patient into the OP queue */}
                      {canAct && a.patientCategory === "OP" && a.status === "CONFIRMED" && !a.opVisitId && (
                        <button
                          onClick={() => handleIssueToken(a)}
                          disabled={issuingId === a.id}
                          title="Issue OP token & move to OP queue"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg
                            text-xs font-semibold bg-amber-50 text-amber-700
                            hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-50">
                          {issuingId === a.id ? "Issuing…" : "🎫 Token"}
                        </button>
                      )}
                      {/* Already in OP queue — show the issued token */}
                      {a.patientCategory === "OP" && a.opVisitId && a.tokenNo && (
                        <span
                          title="OP token issued — patient is in the OP queue"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg
                            text-xs font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap">
                          🎫 {a.tokenNo}
                        </span>
                      )}
                      {/* Complete */}
                      {canAct && ["CONFIRMED","IN_PROGRESS"].includes(a.status) && (
                        <button onClick={() => { setCompleteTarget(a); setCompleteNotes(""); }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg
                            text-xs font-semibold bg-emerald-50 text-emerald-700
                            hover:bg-emerald-100 transition-colors whitespace-nowrap">
                          ✓ Done
                        </button>
                      )}
                      {/* Review */}
                      {canAct && a.status === "COMPLETED" && (
                        <button onClick={() => { setReviewTarget(a); setReviewDate(""); setReviewNotes(""); setReviewErr(""); }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg
                            text-xs font-semibold bg-purple-50 text-purple-700
                            hover:bg-purple-100 transition-colors whitespace-nowrap">
                          📅 Review
                        </button>
                      )}
                      {/* No Show */}
                      {canAct && ["SCHEDULED","CONFIRMED"].includes(a.status) && (
                        <button onClick={() => handleNoShow(a)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-purple-50
                            hover:text-purple-600 transition-colors" title="No Show">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                        </button>
                      )}
                      {/* Cancel */}
                      {canAct && ["SCHEDULED","CONFIRMED"].includes(a.status) && (
                        <button onClick={() => { setCancelTarget(a); setCancelReason(""); setCancelErr(""); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50
                            hover:text-red-500 transition-colors" title="Cancel">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {appts.length} appointments
        </div>
      </div>

      {/* ── Book Appointment Modal ── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setPtQuery(""); setPtResults([]); }}
        title="Book Appointment" size="lg"
        footer={
          <>
            <button onClick={() => { setModalOpen(false); setPtQuery(""); setPtResults([]); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleBook} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                text-white font-medium rounded-lg">
              {saving ? "Booking…" : "Book Appointment"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {/* Existing / New toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {([
              { val: "existing", label: "Existing Patient" },
              { val: "new",      label: "New Patient" },
            ] as const).map(opt => (
              <button key={opt.val} type="button"
                onClick={() => setForm(f => ({ ...f, patientMode: opt.val }))}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors
                  ${form.patientMode === opt.val
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* NEW patient mini-form */}
          {form.patientMode === "new" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Patient Name" required error={errors.newName}>
                <Input value={form.newName}
                  onChange={e => setForm(f => ({ ...f, newName: e.target.value }))}
                  placeholder="Full name" autoFocus/>
              </FormField>
              <FormField label="Mobile Number" required error={errors.newPhone}>
                <Input type="tel" inputMode="numeric" maxLength={10} value={form.newPhone}
                  onChange={e => setForm(f => ({ ...f, newPhone: e.target.value.replace(/\D/g, "") }))}
                  placeholder="10-digit mobile"/>
              </FormField>
              <FormField label="Gender">
                <Select value={form.newGender}
                  onChange={e => setForm(f => ({ ...f, newGender: e.target.value as "MALE" | "FEMALE" | "OTHER" }))}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </FormField>
              <FormField label="Date of Birth">
                <Input type="date" max={today()} value={form.newDob}
                  onChange={e => {
                    const dob = e.target.value;
                    setForm(f => ({ ...f, newDob: dob, newAge: calcAgeFromDob(dob) || f.newAge }));
                  }}/>
              </FormField>
              <FormField label="Age">
                <Input type="number" min={0} max={150} value={form.newAge}
                  onChange={e => setForm(f => ({ ...f, newAge: e.target.value }))}
                  placeholder="Age in years"/>
              </FormField>
              <p className="sm:col-span-2 text-xs text-slate-400">
                Pick a date of birth to auto-fill age, or enter age directly.
                A new UHID is generated automatically on booking. Patient type: OP.
              </p>
            </div>
          )}

          {/* EXISTING patient search */}
          {form.patientMode === "existing" && (
          <FormField label="Patient" required error={errors.patient}>
            <div className="relative" ref={ptRef}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input value={ptQuery}
                  onChange={e => handlePtQueryChange(e.target.value)}
                  onFocus={() => setPtDropOpen(true)}
                  placeholder="Search patient by name, UHID or phone…"
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
                    text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
              </div>
              {ptDropOpen && ptResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200
                  rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
                  {ptResults.map(p => (
                    <li key={p.id}>
                      <button type="button" onMouseDown={() => selectPatient(p)}
                        className="w-full flex items-start gap-3 px-4 py-2.5
                          hover:bg-sky-50 text-left transition-colors">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded mt-0.5
                          ${p.patientType === "IP" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>
                          {p.patientType === "IP" ? "IP" : "OP"}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.uhid} · {p.age ?? "?"}y · {p.phone}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormField>
          )}

          {/* Patient card (existing selected patient) */}
          {form.patientMode === "existing" && form.patientId && (
            <div className="rounded-xl px-4 py-3 text-xs grid grid-cols-2 gap-2 bg-sky-50 border border-sky-200">
              <div><p className="text-slate-400">UHID</p><p className="font-semibold">{form.uhid}</p></div>
              <div><p className="text-slate-400">Phone</p><p className="font-semibold">{form.phone}</p></div>
              <div><p className="text-slate-400">Age</p><p className="font-semibold">{form.existingAge != null ? `${form.existingAge} yrs` : "—"}</p></div>
              <div><p className="text-slate-400">Type</p><p className="font-semibold">{form.patientCategory}</p></div>
            </div>
          )}

          {/* Doctor */}
          <FormField label="Doctor" required error={errors.doctor}>
            <select value={form.doctorId ?? ""}
              onChange={e => {
                const d = doctors.find(doc => doc.id === Number(e.target.value));
                setForm(f => ({
                  ...f,
                  doctorId:   d ? d.id : null,
                  doctorName: d?.name ?? "",
                  department: d?.department ?? "",
                }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white
                text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">Select doctor…</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{doctorLabel(d)}</option>
              ))}
            </select>
          </FormField>

          {/* Date + Time + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Date" required error={errors.date}>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
            </FormField>
            <FormField label="Time" error={errors.time}>
              <Input type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
            </FormField>
            <FormField label="Visit Type">
              <Select value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="NEW">New</option>
                <option value="REVIEW">Review</option>
                <option value="FOLLOW_UP">Follow-up</option>
              </Select>
            </FormField>
          </div>

          {/* Edge-case warnings */}
          {bookingWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
              {bookingWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"/>
                  </svg>
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* OPD closed for today — prompt to book next day */}
          {opdClosedForToday && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-700">
                  {selectedDoctor?.name}&rsquo;s OPD hours ({selectedDoctor?.opdStartTime}&ndash;{selectedDoctor?.opdEndTime}) have ended for today.
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  No more slots are available today. Please book for the next day.
                </p>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, date: dateOffset(1), time: "" }))}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Book for tomorrow ({dateOffset(1)})
                </button>
              </div>
            </div>
          )}

          {/* Slot grid */}
          {form.doctorId && (
            <SlotGrid
              slots={bookingSlots}
              loading={slotLoading}
              doctor={selectedDoctor}
              selectedTime={form.time}
              onPick={t => { setForm(f => ({ ...f, time: t })); setErrors(e => ({ ...e, time: "" })); }}
            />
          )}

        </div>
      </Modal>

      {/* ── Cancel Modal ── */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)}
        title={`Cancel — ${cancelTarget?.appointmentNo}`} size="sm"
        footer={
          <>
            <button onClick={() => setCancelTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Back</button>
            <button onClick={handleCancel}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg">
              Cancel Appointment
            </button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Cancelling appointment for <span className="font-semibold">{cancelTarget?.patientName}</span>
            {" "}on {cancelTarget?.date} at {cancelTarget?.time}.
          </p>
          {cancelErr && <p className="text-xs text-red-500">{cancelErr}</p>}
          <FormField label="Reason" required>
            <Textarea value={cancelReason}
              onChange={e => { setCancelReason(e.target.value); setCancelErr(""); }}
              placeholder="Reason for cancellation…" rows={2} autoFocus/>
          </FormField>
        </div>
      </Modal>

      {/* ── Complete Modal ── */}
      <Modal open={!!completeTarget} onClose={() => setCompleteTarget(null)}
        title={`Complete — ${completeTarget?.appointmentNo}`} size="sm"
        footer={
          <>
            <button onClick={() => setCompleteTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleComplete}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600
                text-white font-medium rounded-lg">
              Mark Complete
            </button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Marking <span className="font-semibold">{completeTarget?.patientName}</span> as completed.
          </p>
          <FormField label="Notes / Consultation Summary">
            <Textarea value={completeNotes}
              onChange={e => setCompleteNotes(e.target.value)}
              placeholder="Optional consultation notes…" rows={3} autoFocus/>
          </FormField>
        </div>
      </Modal>

      {/* ── Schedule Review Modal ── */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)}
        title="Schedule Review Appointment" size="sm"
        footer={
          <>
            <button onClick={() => setReviewTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleScheduleReview} disabled={saving}
              className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 disabled:opacity-50
                text-white font-medium rounded-lg">
              {saving ? "Scheduling…" : "Schedule Review"}
            </button>
          </>
        }>
        {reviewTarget && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs">
              <p className="font-semibold text-purple-800">{reviewTarget.patientName}</p>
              <p className="text-purple-600">{reviewTarget.uhid} · {reviewTarget.doctorName}</p>
            </div>
            {reviewErr && <p className="text-xs text-red-500">{reviewErr}</p>}
            <FormField label="Review Date" required>
              <Input type="date" value={reviewDate}
                onChange={e => { setReviewDate(e.target.value); setReviewErr(""); }}
                autoFocus/>
            </FormField>
            <FormField label="Review Notes">
              <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                placeholder="Follow-up instructions…" rows={2}/>
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── View Doctor Schedule Modal ── */}
      <Modal open={schedOpen} onClose={() => setSchedOpen(false)}
        title="Doctor Schedule" size="lg"
        footer={
          <button onClick={() => setSchedOpen(false)}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Close</button>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Doctor">
              <select value={schedDoctorId ?? ""}
                onChange={e => setSchedDoctorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white
                  text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">Select doctor…</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{doctorLabel(d)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Date">
              <Input type="date" value={schedDate}
                onChange={e => setSchedDate(e.target.value)}/>
            </FormField>
          </div>

          {schedDoctorId && schedDoctor && schedDate && (
            <>
              {/* schedule warnings */}
              {(() => {
                const dn = dayNameOf(schedDate);
                const opdDays = schedDoctor.opdDays ?? [];
                const notScheduled = opdDays.length > 0 && dn && !opdDays.includes(dn);
                return (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {schedDoctor.status === "ON_LEAVE" && (
                      <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">On Leave</span>
                    )}
                    {notScheduled && (
                      <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        Not scheduled on {dn}days
                      </span>
                    )}
                    {opdDays.length > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
                        OPD days: {opdDays.join(", ")}
                      </span>
                    )}
                  </div>
                );
              })()}

              <SlotGrid slots={schedSlots} loading={schedLoading} doctor={schedDoctor} />

              {/* legend */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200"></span> Booked</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-50 border border-sky-300"></span> Next free</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200"></span> Free</span>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
