"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession, type Session } from "../../_lib/auth";
import StatCard from "../../_components/StatCard";
import Badge from "../../_components/Badge";

// ─── Backend types ────────────────────────────────────────────────────────────

interface DashboardSummaryResponse {
  date: string;
  todayOpVisits: number;
  todayAdmissions: number;
  currentInpatients: number;
  todayDischarges: number;
  todayAppointments: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercent: number;
  todayRevenue: number;
  pendingBillsTotal: number;
  pendingClaimsCount: number;
  pendingClaimsAmount: number;
  labPendingCount: number;
  labInProgressCount: number;
  labStatCount: number;
  monthlyExpenses: number;
  freePatientCount: number;
}

interface AppointmentResponse {
  id: number;
  appointmentNo: string;
  patientName: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  type: string;
  status: string;
  tokenNo: string | null;
  patientCategory: string;
}

interface WardSummary {
  id: number;
  name: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  status: string;
}

interface MonthlyRevenueData {
  month: number;
  monthLabel: string;
  billRevenue: number;
  insuranceRevenue: number;
  manualCash: number;
  totalRevenue: number;
}

interface MonthlyRevenueResponse {
  year: number;
  months: MonthlyRevenueData[];
  totalBillRevenue: number;
  totalInsuranceRevenue: number;
  totalManualCash: number;
  totalRevenue: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(path: string) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

function today() { return new Date().toISOString().slice(0, 10); }

const STATUS_DISPLAY: Record<string, string> = {
  SCHEDULED: "Scheduled", CONFIRMED: "Confirmed", IN_PROGRESS: "In Progress",
  COMPLETED: "Completed", NO_SHOW: "No Show", CANCELLED: "Cancelled",
};

// ─── Monthly revenue — loaded from backend ────────────────────────────────────
// Fallback to zeros if API not yet available
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── SVG Area Chart ──────────────────────────────────────────────────────────
function AreaChart({ data, color = "#0ea5e9" }: { data: number[]; color?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const W = 600; const H = 140; const PAD = 10;
  const rawMax = Math.max(...data);
  const rawMin = Math.min(...data) * 0.9;
  // Guard: if all values are equal (e.g. all zeros), set a synthetic range to avoid division by zero
  const max = rawMax === rawMin ? rawMax + 1 : rawMax;
  const min = rawMax === rawMin ? 0 : rawMin;
  const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2));
  const ys = data.map((v) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2));
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i-1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i-1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const area = `${d} L ${xs[xs.length-1]} ${H} L ${xs[0]} ${H} Z`;
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); }, []);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="drawClip">
          <rect x="0" y="0" height={H + 20} width={drawn ? W : 0}
            style={{ transition: drawn ? "width 1.1s cubic-bezier(0.4,0,0.2,1)" : "none" }} />
        </clipPath>
      </defs>
      <g clipPath="url(#drawClip)">
        <path d={area} fill="url(#areaGrad)" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {xs.map((x, i) => (
        <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
          <rect x={x - 20} y={0} width={40} height={H} fill="transparent" />
          {hovered === i && <line x1={x} y1={0} x2={x} y2={H} stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />}
          <circle cx={x} cy={ys[i]} r={hovered === i ? 5 : 3} fill={color} stroke="white" strokeWidth="2" style={{ transition: "r 0.1s" }} />
          {hovered === i && (
            <g>
              <rect x={Math.min(x - 45, W - 100)} y={ys[i] - 36} width={90} height={26} rx={5} fill="#1e293b" opacity="0.92" />
              <text x={Math.min(x, W - 55)} y={ys[i] - 17} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">₹{(data[i] / 1000).toFixed(0)}K</text>
              <text x={Math.min(x, W - 55)} y={ys[i] - 7} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{MONTHS[i]}</text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 48; const CX = 64; const CY = 64; const stroke = 20;
  const circ = 2 * Math.PI * R;
  useEffect(() => {
    const t = setTimeout(() => {
      let start: number | null = null;
      function step(ts: number) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 900, 1);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Guard: render empty placeholder when all segments are zero
  if (total === 0) {
    return (
      <div className="flex items-center gap-4 mt-2">
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 128 128" className="w-28 h-28">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
            <circle cx={CX} cy={CY} r={R - stroke / 2 - 3} fill="white" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-slate-800">0</span>
            <span className="text-[9px] text-slate-400">Total</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 italic">No data</div>
      </div>
    );
  }

  const offsets = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, sg) => sum + (sg.value / total) * circ, 0));
  return (
    <div className="flex items-center gap-4 mt-2">
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 128 128" className="w-28 h-28 -rotate-90">
          {segments.map((seg, i) => {
            const fullDash = (seg.value / total) * circ;
            const animDash = fullDash * progress;
            const gap = circ - animDash;
            const isHov = hovered === i;
            const animOffset = -offsets[i] * progress;
            const el = (
              <circle key={i} cx={CX} cy={CY} r={isHov ? R + 3 : R}
                fill="none" stroke={seg.color} strokeWidth={isHov ? stroke + 4 : stroke}
                strokeDasharray={`${animDash} ${gap}`} strokeDashoffset={animOffset}
                strokeLinecap="butt" style={{ transition: "r 0.15s, stroke-width 0.15s", cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
            );
            return el;
          })}
          <circle cx={CX} cy={CY} r={R - stroke / 2 - 3} fill="white" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered !== null ? (
            <>
              <span className="text-[11px] font-bold" style={{ color: segments[hovered].color }}>
                {Math.round((segments[hovered].value / total) * 100)}%
              </span>
              <span className="text-[9px] text-slate-400 leading-tight text-center px-1">
                {segments[hovered].label.split(" ")[0]}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-slate-800">{total}</span>
              <span className="text-[9px] text-slate-400">Total</span>
            </>
          )}
        </div>
      </div>
      <div className="space-y-2 min-w-0 flex-1">
        {segments.map((seg, i) => (
          <div key={seg.label}
            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors cursor-default ${hovered === i ? "bg-slate-50" : ""}`}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-slate-600 truncate flex-1">{seg.label}</span>
            <span className="font-semibold text-slate-800">{seg.value}</span>
            <span className="text-slate-400 w-8 text-right">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ bars }: { bars: { label: string; value: number; color: string }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...bars.map((b) => b.value), 1);
  const W = 300; const H = 100; const barW = 32; const gap = (W - bars.length * barW) / (bars.length + 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full">
      {bars.map((b, i) => {
        const barH = Math.max((b.value / max) * H, 2);
        const x = gap + i * (barW + gap); const y = H - barH;
        const isHov = hovered === i;
        return (
          <g key={b.label} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
            <rect x={x - 4} y={0} width={barW + 8} height={H + 28} fill="transparent" />
            <rect x={x} y={y} width={barW} height={barH} rx={5} fill={b.color} opacity={isHov ? 1 : 0.75} style={{ transition: "opacity 0.15s" }} />
            {isHov && <rect x={x} y={y} width={barW} height={4} rx={3} fill="white" opacity={0.3} />}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="9" fill={isHov ? "#475569" : "#94a3b8"} fontWeight={isHov ? "700" : "400"}>{b.label}</text>
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill={isHov ? b.color : "#64748b"}>{b.value}</text>
            {isHov && b.value > 0 && (
              <g>
                <rect x={x - 8} y={y - 28} width={barW + 16} height={20} rx={4} fill="#1e293b" opacity="0.9" />
                <text x={x + barW / 2} y={y - 14} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white">{b.value} tests</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Register",  href: "/patients",          color: "bg-sky-100 text-sky-600",      icon: "👤" },
  { label: "New Bill",  href: "/bills",              color: "bg-green-100 text-green-600",  icon: "🧾" },
  { label: "Ward View", href: "/patients/ward-view", color: "bg-indigo-100 text-indigo-600",icon: "🏥" },
  { label: "Lab",       href: "/lab/investigations", color: "bg-purple-100 text-purple-600",icon: "🔬" },
  { label: "Reports",   href: "/reports/collection", color: "bg-amber-100 text-amber-600",  icon: "📊" },
  { label: "Appts",     href: "/appointments/list",  color: "bg-rose-100 text-rose-600",    icon: "📅" },
];

// ─── Dashboard Skeleton ───────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-24">
            <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
            <div className="h-6 bg-slate-200 rounded w-1/2 mb-2" />
            <div className="h-2.5 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-56">
          <div className="h-3 bg-slate-200 rounded w-1/4 mb-2" />
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-6" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-56">
          <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-6" />
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-slate-100 flex-shrink-0" />
            <div className="flex-1 space-y-3">
              {[1, 2, 3].map((j) => <div key={j} className="h-6 bg-slate-100 rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>
      {/* Table + side cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-1.5" />
            <div className="h-3 bg-slate-100 rounded w-1/4" />
          </div>
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-4">
                <div className="h-3 bg-slate-200 rounded w-10" />
                <div className="h-3 bg-slate-200 rounded w-28" />
                <div className="h-3 bg-slate-200 rounded w-24" />
                <div className="h-3 bg-slate-200 rounded w-20" />
                <div className="h-3 bg-slate-200 rounded w-12" />
                <div className="h-5 bg-slate-100 rounded-full w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-32">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-32">
            <div className="h-3 bg-slate-200 rounded w-1/3 mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [session,      setSession]      = useState<Session | null>(() => getSession());
  const [summary,      setSummary]      = useState<DashboardSummaryResponse | null>(null);
  const [wards,        setWards]        = useState<WardSummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [monthlyRev,   setMonthlyRev]   = useState<MonthlyRevenueResponse | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [summaryRes, wardsRes, apptRes, revRes] = await Promise.all([
        apiFetch("/api/dashboard/summary"),
        apiFetch("/api/masters/wards?page=0&size=200"),
        apiFetch(`/api/appointments?date=${today()}&page=0&size=10`),
        apiFetch(`/api/dashboard/monthly-revenue?year=${new Date().getFullYear()}`),
      ]);
      if (summaryRes.ok) setSummary(summaryRes.data as DashboardSummaryResponse);
      if (wardsRes.ok) {
        const raw = (wardsRes.data as { content?: WardSummary[] })?.content ?? (wardsRes.data as WardSummary[]);
        setWards((Array.isArray(raw) ? raw : []).filter((w) => w.status === "ACTIVE" || w.status === "Active").slice(0, 5));
      }
      if (apptRes.ok) {
        const raw = (apptRes.data as { content?: AppointmentResponse[] })?.content ?? (apptRes.data as AppointmentResponse[]);
        setAppointments(Array.isArray(raw) ? raw : []);
      }
      if (revRes.ok) setMonthlyRev(revRes.data as MonthlyRevenueResponse);
      setLoading(false);
    }
    loadAll();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!session) {
    return <DashboardSkeleton />;
  }

  const s = summary ?? ({} as DashboardSummaryResponse);

  return (
    <div>
      {(session.role === "Admin" || session.role === "Managing Director") && <AdminDashboard        summary={s} wards={wards} appointments={appointments} monthlyRev={monthlyRev} role={session.role} />}
      {session.role === "Doctor"                && <DoctorDashboard       summary={s} appointments={appointments} />}
      {session.role === "Receptionist"          && <ReceptionistDashboard summary={s} appointments={appointments} />}
      {session.role === "Lab/Ins/Reception"     && <LabInsReceptionDashboard summary={s} appointments={appointments} />}
      {session.role === "Lab Tech"              && <LabDashboard          summary={s} />}
      {session.role === "Insurance Coordinator" && <InsuranceDashboard    summary={s} />}
      {session.role === "Nurse"                 && <NurseDashboard        summary={s} />}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ summary, wards, appointments, monthlyRev, role }: {
  summary: DashboardSummaryResponse;
  wards: WardSummary[];
  appointments: AppointmentResponse[];
  monthlyRev: MonthlyRevenueResponse | null;
  role: string;
}) {
  const occupancyPct = Math.round(summary.occupancyPercent ?? 0);
  const labPend = summary.labPendingCount ?? 0;
  const labProg = summary.labInProgressCount ?? 0;
  const labStat = summary.labStatCount ?? 0;
  const totalPatients = (summary.todayOpVisits ?? 0) + (summary.currentInpatients ?? 0) + (summary.todayDischarges ?? 0);

  // ── Pending expense approvals — shown only to Admin, not MD ──
  const isAdminOnly = role === "Admin";
  const [pendingExpenses, setPendingExpenses] = useState<{
    id: number; expenseNo: string; towards: string; amount: number;
    category: string; preparedBy: string; date: string;
  }[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdminOnly) return;
    fetch("/api/expenses?status=PENDING&page=0&size=20&sort=date,desc", {
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const raw = j.data?.content ?? j.data ?? [];
          setPendingExpenses(raw.map((e: {
            id: number; expenseNo: string; towards: string; amount: number;
            category: string; preparedBy: string; date: string;
          }) => ({
            id: e.id, expenseNo: e.expenseNo, towards: e.towards,
            amount: e.amount, category: e.category,
            preparedBy: e.preparedBy, date: e.date,
          })));
        }
      })
      .catch(() => {});
  }, [isAdminOnly]);

  async function quickApprove(id: number) {
    setApprovingId(id);
    await fetch(`/api/expenses/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    setApprovingId(null);
    setPendingExpenses(prev => prev.filter(e => e.id !== id));
  }

  async function quickReject(id: number) {
    setRejectingId(id);
    await fetch(`/api/expenses/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", rejectionReason: "Rejected from dashboard" }),
    });
    setRejectingId(null);
    setPendingExpenses(prev => prev.filter(e => e.id !== id));
  }

  // Build 12-month revenue array from backend; fall back to zeros if not loaded yet
  const revenueData: number[] = monthlyRev?.months
    ? monthlyRev.months.map((m) => m.totalRevenue ?? 0)
    : Array(12).fill(0);
  const totalYearRevenue = monthlyRev?.totalRevenue ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's OP Patients" value={summary.todayOpVisits ?? 0} sub="Outpatients today" iconBg="bg-sky-50" href="/op-visits"
          icon={<svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard label="IP Admitted" value={summary.currentInpatients ?? 0} sub="Currently admitted" iconBg="bg-indigo-50" href="/patients"
          icon={<svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>} />
        <StatCard label="Bed Occupancy" value={`${occupancyPct}%`} sub={`${summary.occupiedBeds ?? 0}/${summary.totalBeds ?? 0} beds`} iconBg="bg-emerald-50" href="/masters/wards-beds"
          icon={<svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
        <StatCard label="Today's Revenue" value={`₹${(summary.todayRevenue ?? 0).toLocaleString("en-IN")}`} sub="Collected today" iconBg="bg-green-50" href="/bills"
          icon={<svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>} />
        <StatCard label="Pending Bills" value={`₹${(summary.pendingBillsTotal ?? 0).toLocaleString("en-IN")}`} sub="Unsettled bills" iconBg="bg-amber-50" href="/bills"
          icon={<svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>} />
        <StatCard label="Pending Claims" value={summary.pendingClaimsCount ?? 0} sub="Insurance pending" iconBg="bg-rose-50" href="/insurance"
          icon={<svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
        <StatCard label="Pending Lab Tests" value={labPend + labProg} sub="Pending + in progress" iconBg="bg-purple-50" href="/lab/investigations"
          icon={<svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>} />
        <StatCard label="Today's Appointments" value={summary.todayAppointments ?? 0} sub="Scheduled today" iconBg="bg-teal-50" href="/appointments/list"
          icon={<svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Revenue Overview</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{totalYearRevenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Bills + Insurance + Cash · {monthlyRev?.year ?? new Date().getFullYear()}
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">This Year</span>
          </div>
          <div className="h-36"><AreaChart data={revenueData.length > 0 && revenueData.some(v => v > 0) ? revenueData : Array(12).fill(0)} color="#0ea5e9" /></div>
          <div className="flex justify-between mt-2 px-1">
            {MONTHS.map((m) => <span key={m} className="text-[9px] text-slate-400">{m}</span>)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Patient Mix</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{totalPatients} Total</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">Today</span>
          </div>
          <DonutChart segments={[
            { label: "OP Patients", value: summary.todayOpVisits ?? 0,     color: "#0ea5e9" },
            { label: "IP Admitted", value: summary.currentInpatients ?? 0, color: "#6366f1" },
            { label: "Discharged",  value: summary.todayDischarges ?? 0,   color: "#10b981" },
            { label: "Free Patients", value: summary.freePatientCount ?? 0, color: "#f59e0b" },
          ]} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Today&apos;s Appointments</p>
              <p className="text-xs text-slate-400 mt-0.5">{appointments.length} scheduled for today</p>
            </div>
            <Link href="/appointments/list" className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1">
              View all <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Token","Patient","Doctor","Dept","Time","Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {appointments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No appointments today</td></tr>
                ) : appointments.slice(0, 6).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-sky-600">{a.tokenNo ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{a.patientName}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{a.doctorName}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{a.department}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.time}</td>
                    <td className="px-4 py-2.5"><Badge label={STATUS_DISPLAY[a.status] ?? a.status} dot /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Recent Admissions</p>
                <p className="text-xs text-slate-400 mt-0.5">{summary.currentInpatients ?? 0} currently admitted</p>
              </div>
              <Link href="/patients" className="text-xs text-sky-500 hover:text-sky-600 font-semibold">View all</Link>
            </div>
            <div className="px-4 py-6 text-xs text-center">
              <Link href="/patients/inpatients" className="text-sky-500 hover:underline font-medium">View all inpatients →</Link>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <Link key={qa.href} href={qa.href} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${qa.color} hover:opacity-80 transition-opacity`}>
                  <span className="text-lg leading-none">{qa.icon}</span>
                  <span className="text-[10px] font-semibold leading-tight text-center">{qa.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Expense Approvals — Admin only ── */}
      {isAdminOnly && pendingExpenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-sm font-semibold text-amber-900">Pending Expense Approvals</p>
              <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                {pendingExpenses.length}
              </span>
            </div>
            <Link href="/expenses" className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1">
              View all
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingExpenses.slice(0, 5).map(e => (
              <div key={e.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      {e.expenseNo}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{e.towards}</span>
                    <span className="text-xs text-slate-400">{e.category}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    By <span className="font-medium text-slate-600">{e.preparedBy}</span> · {e.date}
                  </p>
                </div>
                <span className="font-bold text-slate-900 whitespace-nowrap text-sm">
                  ₹{Number(e.amount).toLocaleString("en-IN")}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => quickApprove(e.id)}
                    disabled={approvingId === e.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                      bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                    {approvingId === e.id ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => quickReject(e.id)}
                    disabled={rejectingId === e.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                      bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                    {rejectingId === e.id ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    )}
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingExpenses.length > 5 && (
              <div className="px-5 py-3 text-center">
                <Link href="/expenses?status=Pending" className="text-xs text-amber-700 hover:underline font-medium">
                  +{pendingExpenses.length - 5} more pending — view all →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-900">Bed Occupancy</p>
            <Link href="/masters/wards-beds" className="text-xs text-sky-500 hover:text-sky-600 font-semibold">View all</Link>
          </div>
          <div className="mb-4 p-3 bg-slate-50 rounded-xl">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Hospital-wide</span>
              <span className="font-bold text-slate-800">{occupancyPct}%</span>
            </div>
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${occupancyPct >= 90 ? "bg-red-500" : occupancyPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${occupancyPct}%` }} />
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
              <span className="text-emerald-600 font-medium">{summary.availableBeds ?? 0} free</span>
              <span className="text-red-500 font-medium">{summary.occupiedBeds ?? 0} occupied</span>
              <span>{summary.totalBeds ?? 0} total</span>
            </div>
          </div>
          <div className="space-y-3">
            {wards.map((w) => {
              const pct = w.totalBeds > 0 ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
              return (
                <div key={w.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium truncate max-w-[120px]">{w.name}</span>
                    <span className="text-slate-500 flex-shrink-0">{w.availableBeds} free / {w.totalBeds}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-900">Lab Status</p>
            <Link href="/lab/investigations" className="text-xs text-sky-500 hover:text-sky-600 font-semibold">View all</Link>
          </div>
          <BarChart bars={[
            { label: "Pending",     value: labPend, color: "#f59e0b" },
            { label: "In Progress", value: labProg, color: "#0ea5e9" },
            { label: "Completed",   value: 0,       color: "#10b981" },
            { label: "STAT",        value: labStat, color: "#ef4444" },
          ]} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Pending",     value: labPend, color: "text-amber-600 bg-amber-50" },
              { label: "In Progress", value: labProg, color: "text-sky-600 bg-sky-50" },
              { label: "Completed",   value: 0,       color: "text-emerald-600 bg-emerald-50" },
              { label: "STAT",        value: labStat, color: "text-red-600 bg-red-50" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg px-3 py-2 ${item.color}`}>
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-lg font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-900">System Summary</p>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">● Online</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "OP Patients Today",    value: summary.todayOpVisits ?? 0,      color: "bg-sky-500" },
              { label: "IP Admitted",          value: summary.currentInpatients ?? 0,  color: "bg-indigo-500" },
              { label: "Today's Admissions",   value: summary.todayAdmissions ?? 0,    color: "bg-amber-500" },
              { label: "Today's Appointments", value: summary.todayAppointments ?? 0,  color: "bg-teal-500" },
              { label: "Pending Claims",       value: summary.pendingClaimsCount ?? 0, color: "bg-rose-500" },
              { label: "Pending Lab Tests",    value: labPend + labProg,               color: "bg-purple-500" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                <span className="text-xs text-slate-600 flex-1">{row.label}</span>
                <span className="text-sm font-bold text-slate-800">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
            <div className="text-center"><p className="text-[10px] text-slate-400">System Status</p><p className="text-xs font-semibold text-emerald-600 mt-0.5">● Online</p></div>
            <div className="text-center"><p className="text-[10px] text-slate-400">Database</p><p className="text-xs font-semibold text-emerald-600 mt-0.5">● Normal</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────
function DoctorDashboard({ summary, appointments }: { summary: DashboardSummaryResponse; appointments: AppointmentResponse[] }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Today's OP" value={summary.todayOpVisits ?? 0} sub="OP visits today" iconBg="bg-amber-100" href="/op-visits"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Appointments" value={summary.todayAppointments ?? 0} sub="Scheduled today" iconBg="bg-sky-100" href="/appointments/list"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
        <StatCard label="IP Patients" value={summary.currentInpatients ?? 0} sub="Admitted" iconBg="bg-indigo-100" href="/patients/inpatients"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>} />
        <StatCard label="Pending Lab" value={summary.labPendingCount ?? 0} sub="Awaiting results" iconBg="bg-purple-100" href="/lab/investigations"
          icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>} />
      </div>
      <QuickLinks links={[
        { href: "/op-visits", label: "My OP Queue", color: "sky" },
        { href: "/patients/inpatients", label: "My IP Patients", color: "indigo" },
        { href: "/lab/investigations", label: "Lab Results", color: "purple" },
        { href: "/appointments/list", label: "Appointments", color: "amber" },
      ]} />
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Today&apos;s Schedule</p>
          <Link href="/appointments/list" className="text-xs text-sky-500 font-semibold">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              {["Token","Patient","Time","Type","Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {appointments.length === 0
                ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No appointments today</td></tr>
                : appointments.slice(0, 6).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-sky-600">{a.tokenNo ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{a.patientName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.time}</td>
                    <td className="px-4 py-2.5"><Badge label={a.type} /></td>
                    <td className="px-4 py-2.5"><Badge label={STATUS_DISPLAY[a.status] ?? a.status} dot /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Receptionist Dashboard ───────────────────────────────────────────────────
function ReceptionistDashboard({ summary, appointments }: { summary: DashboardSummaryResponse; appointments: AppointmentResponse[] }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Today's Appts" value={summary.todayAppointments ?? 0} sub="Scheduled today" iconBg="bg-sky-100" href="/appointments/list"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
        <StatCard label="OP Visits Today" value={summary.todayOpVisits ?? 0} sub="Outpatient visits" iconBg="bg-amber-100" href="/op-visits"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Available Beds" value={summary.availableBeds ?? 0} sub="Free beds" iconBg="bg-emerald-100" href="/masters/wards-beds"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
        <StatCard label="Pending Bills" value={`₹${(summary.pendingBillsTotal ?? 0).toLocaleString("en-IN")}`} sub="Unsettled" iconBg="bg-amber-100" href="/bills"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>} />
      </div>
      <QuickLinks links={[
        { href: "/op-visits", label: "OP Token Queue", color: "sky" },
        { href: "/patients", label: "Register Patient", color: "emerald" },
        { href: "/appointments/list", label: "Appointments", color: "indigo" },
        { href: "/bills", label: "Bills", color: "amber" },
      ]} />
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Today&apos;s Appointments</p>
          <Link href="/appointments/list" className="text-xs text-sky-500 font-semibold">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              {["Token","Patient","Doctor","Time","Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {appointments.length === 0
                ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No appointments</td></tr>
                : appointments.slice(0, 6).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-sky-600">{a.tokenNo ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{a.patientName}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{a.doctorName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.time}</td>
                    <td className="px-4 py-2.5"><Badge label={STATUS_DISPLAY[a.status] ?? a.status} dot /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Lab / Insurance / Reception Combined Dashboard ───────────────────────────
function LabInsReceptionDashboard({ summary, appointments }: {
  summary: DashboardSummaryResponse;
  appointments: AppointmentResponse[];
}) {
  const labPend = summary.labPendingCount ?? 0;
  const labProg = summary.labInProgressCount ?? 0;
  const labStat = summary.labStatCount ?? 0;

  // Live insurance claim status breakdown (same source as the Insurance dashboard)
  const [claims, setClaims] = useState({ submitted: 0, underReview: 0, approved: 0, rejected: 0 });
  useEffect(() => {
    apiFetch("/api/insurance/claims?page=0&size=500").then(({ ok, data }) => {
      if (!ok) return;
      const raw = (data as { content?: { status: string }[] })?.content ?? (data as { status: string }[]);
      const list = Array.isArray(raw) ? raw : [];
      setClaims({
        submitted:   list.filter((c) => c.status === "SUBMITTED").length,
        underReview: list.filter((c) => c.status === "UNDER_REVIEW").length,
        approved:    list.filter((c) => c.status === "APPROVED" || c.status === "SETTLED" || c.status === "PARTIAL").length,
        rejected:    list.filter((c) => c.status === "REJECTED").length,
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* ══ RECEPTION ══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reception</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Today's Appts" value={summary.todayAppointments ?? 0} sub="Scheduled today" iconBg="bg-sky-100" href="/appointments/list"
            icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          <StatCard label="OP Visits Today" value={summary.todayOpVisits ?? 0} sub="Outpatient visits" iconBg="bg-amber-100" href="/op-visits"
            icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard label="Available Beds" value={summary.availableBeds ?? 0} sub="Free beds" iconBg="bg-emerald-100" href="/masters/wards-beds"
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
          <StatCard label="Pending Bills" value={`₹${(summary.pendingBillsTotal ?? 0).toLocaleString("en-IN")}`} sub="Unsettled" iconBg="bg-yellow-100" href="/bills"
            icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>} />
        </div>
      </section>

      <QuickLinks links={[
        { href: "/op-visits", label: "OP Token Queue", color: "sky" },
        { href: "/patients", label: "Register Patient", color: "emerald" },
        { href: "/appointments/list", label: "Appointments", color: "indigo" },
        { href: "/bills", label: "Bills", color: "amber" },
        { href: "/lab/investigations", label: "Lab Investigations", color: "purple" },
        { href: "/insurance", label: "Insurance Claims", color: "teal" },
      ]} />

      {/* ══ LAB ══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lab</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Pending Tests" value={labPend} sub="Not started" iconBg="bg-amber-100" href="/lab/investigations"
            icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>} />
          <StatCard label="In Progress" value={labProg} sub="Running" iconBg="bg-sky-100" href="/lab/investigations"
            icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
          <StatCard label="STAT Priority" value={labStat} sub="Urgent" iconBg="bg-red-100" href="/lab/investigations"
            icon={<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          <StatCard label="Total Active" value={labPend + labProg} sub="Pending + running" iconBg="bg-purple-100" href="/lab/investigations"
            icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
        </div>
      </section>

      {/* ══ INSURANCE ══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Insurance</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Pending Claims" value={summary.pendingClaimsCount ?? 0} sub="Awaiting action" iconBg="bg-rose-100" href="/insurance"
            icon={<svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <StatCard label="Claims Amount" value={`₹${(summary.pendingClaimsAmount ?? 0).toLocaleString("en-IN")}`} sub="Pending value" iconBg="bg-violet-100" href="/insurance"
            icon={<svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>} />
          <StatCard label="Approved" value={claims.approved} sub="Approved + settled" iconBg="bg-emerald-100" href="/insurance"
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard label="Rejected" value={claims.rejected} sub="Needs rework" iconBg="bg-red-100" href="/insurance"
            icon={<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </section>

      {/* ══ CHARTS ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lab Status chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-900">Lab Status</p>
            <Link href="/lab/investigations" className="text-xs text-sky-500 hover:text-sky-600 font-semibold">View all</Link>
          </div>
          <div className="max-w-[340px] mx-auto">
            <BarChart bars={[
              { label: "Pending",     value: labPend, color: "#f59e0b" },
              { label: "In Progress", value: labProg, color: "#0ea5e9" },
              { label: "Completed",   value: 0,       color: "#10b981" },
              { label: "STAT",        value: labStat, color: "#ef4444" },
            ]} />
          </div>
        </div>
        {/* Insurance Claims chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-900">Claims Breakdown</p>
            <Link href="/insurance" className="text-xs text-sky-500 hover:text-sky-600 font-semibold">View all</Link>
          </div>
          <DonutChart segments={[
            { label: "Submitted",    value: claims.submitted,   color: "#0ea5e9" },
            { label: "Under Review", value: claims.underReview, color: "#f59e0b" },
            { label: "Approved",     value: claims.approved,    color: "#10b981" },
            { label: "Rejected",     value: claims.rejected,    color: "#ef4444" },
          ]} />
        </div>
      </div>

      {/* ══ Today's Appointments ══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Today&apos;s Appointments</p>
          <Link href="/appointments/list" className="text-xs text-sky-500 font-semibold">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              {["Token","Patient","Doctor","Time","Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {appointments.length === 0
                ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No appointments</td></tr>
                : appointments.slice(0, 6).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-sky-600">{a.tokenNo ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{a.patientName}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{a.doctorName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.time}</td>
                    <td className="px-4 py-2.5"><Badge label={STATUS_DISPLAY[a.status] ?? a.status} dot /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Lab Dashboard ────────────────────────────────────────────────────────────
function LabDashboard({ summary }: { summary: DashboardSummaryResponse }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Pending Tests" value={summary.labPendingCount ?? 0} sub="Not started" iconBg="bg-amber-100" href="/lab/investigations"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>} />
        <StatCard label="In Progress" value={summary.labInProgressCount ?? 0} sub="Running" iconBg="bg-sky-100" href="/lab/investigations"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
        <StatCard label="Completed" value={0} sub="Results ready" iconBg="bg-emerald-100" href="/lab/investigations"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="STAT Priority" value={summary.labStatCount ?? 0} sub="Urgent" iconBg="bg-red-100" href="/lab/investigations"
          icon={<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
      </div>
      <QuickLinks links={[
        { href: "/lab/investigations", label: "Lab Investigations", color: "sky" },
        { href: "/lab/tat-report", label: "TAT Report", color: "purple" },
      ]} />
    </div>
  );
}

// ─── Insurance Dashboard ──────────────────────────────────────────────────────
function InsuranceDashboard({ summary }: { summary: DashboardSummaryResponse }) {
  const [counts, setCounts] = useState({ submitted: 0, underReview: 0, approved: 0, rejected: 0 });
  useEffect(() => {
    apiFetch("/api/insurance/claims?page=0&size=500").then(({ ok, data }) => {
      if (ok) {
        const raw = (data as { content?: { status: string }[] })?.content ?? (data as { status: string }[]);
        const claims = Array.isArray(raw) ? raw : [];
        setCounts({
          submitted:   claims.filter((c) => c.status === "SUBMITTED").length,
          underReview: claims.filter((c) => c.status === "UNDER_REVIEW").length,
          approved:    claims.filter((c) => c.status === "APPROVED" || c.status === "SETTLED" || c.status === "PARTIAL").length,
          rejected:    claims.filter((c) => c.status === "REJECTED").length,
        });
      }
    });
  }, []);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Submitted" value={counts.submitted} sub="Awaiting review" iconBg="bg-sky-100" href="/insurance"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
        <StatCard label="Under Review" value={counts.underReview} sub="Being processed" iconBg="bg-amber-100" href="/insurance"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
        <StatCard label="Approved / Settled" value={counts.approved} sub="Approved + settled" iconBg="bg-emerald-100" href="/insurance"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Rejected" value={counts.rejected} sub="This month" iconBg="bg-red-100" href="/insurance"
          icon={<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>
      <QuickLinks links={[
        { href: "/insurance", label: "Claims", color: "sky" },
        { href: "/insurance/claims-pending-report", label: "Pending Report", color: "amber" },
      ]} />
    </div>
  );
}

// ─── Nurse Dashboard ──────────────────────────────────────────────────────────
function NurseDashboard({ summary }: { summary: DashboardSummaryResponse }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="IP Patients" value={summary.currentInpatients ?? 0} sub="Admitted" iconBg="bg-indigo-100" href="/patients/inpatients"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>} />
        <StatCard label="Beds Occupied" value={summary.occupiedBeds ?? 0} sub={`${summary.availableBeds ?? 0} available`} iconBg="bg-rose-100" href="/patients/ward-view"
          icon={<svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
        <StatCard label="Today's Appts" value={summary.todayAppointments ?? 0} sub="Scheduled" iconBg="bg-sky-100" href="/appointments/list"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
      </div>
      <QuickLinks links={[
        { href: "/patients/ward-view", label: "Ward View", color: "indigo" },
        { href: "/patients/inpatients-bed", label: "In Bed Patients", color: "sky" },
        { href: "/patients/inpatients", label: "All IP Patients", color: "emerald" },
        { href: "/masters/wards-beds", label: "Wards & Beds", color: "teal" },
      ]} />
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  sky:     "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200",
  indigo:  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200",
  amber:   "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200",
  rose:    "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200",
  purple:  "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200",
  teal:    "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200",
};

function QuickLinks({ links }: { links: { href: string; label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${colorMap[l.color] ?? colorMap.sky}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
