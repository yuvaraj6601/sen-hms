"use client";

import { useState, useEffect, useMemo } from "react";
import PageHeader from "../../../_components/PageHeader";

// ─── backend type ──────────────────────────────────────────────────────────────
interface LabInvestigationResponse {
  id: number;
  labId: string;
  patientId: number;
  patientName: string;
  uhid: string;
  patientType: string;
  doctorName: string;
  doctorId: number | null;
  admissionId: number | null;
  visitId: number | null;
  testCode: string;
  investigationName: string;
  category: string;
  sampleType: string | null;
  normalRange: string | null;
  unit: string | null;
  turnaroundTime: string | null;
  price: number;
  priority: string;
  orderedDate: string; // YYYY-MM-DD
  orderedTime: string;
  orderedBy: string;
  collectedDate: string | null;
  collectedTime: string | null;
  collectedBy: string | null;
  result: string | null;
  abnormal: boolean;
  completedDate: string | null;
  completedTime: string | null;
  completedBy: string | null;
  actualTatMinutes: number | null;
  cancelReason: string | null;
  status: string; // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function lastMonthRange(): [string, string] {
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}
function weekStart() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}
function fmtTAT(mins: number): string {
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60 * 10) / 10}h`;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

interface TATRow {
  investigationName: string;
  testCode: string;
  category: string;
  expectedTATMins: number | null;
  totalOrders: number;
  completedOrders: number;
  avgTATMins: number | null;
  minTATMins: number | null;
  maxTATMins: number | null;
  withinTAT: number;
  exceededTAT: number;
  compliancePct: number;
  attendedBy: string[];
}

export default function TATReportPage() {
  const [tests,     setTests]     = useState<LabInvestigationResponse[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [dateFrom,  setDateFrom]  = useState(monthStart());
  const [dateTo,    setDateTo]    = useState(today());
  const [catFilter, setCatFilter] = useState("");
  const [sortBy,    setSortBy]    = useState<"compliance" | "name" | "avg">("compliance");

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/lab/investigations?page=0&size=1000").then(({ ok, data }) => {
      if (ok) {
        const list: LabInvestigationResponse[] = Array.isArray(data) ? data : (data?.content ?? []);
        setTests(list);
      }
    }).finally(() => setLoading(false));
  }, []);

  // filter to date range and completed-only for TAT calc
  const inRange = useMemo(() => tests.filter(t => {
    const mdf = !dateFrom || t.orderedDate >= dateFrom;
    const mdt = !dateTo   || t.orderedDate <= dateTo;
    const mc  = !catFilter || t.category === catFilter;
    return mdf && mdt && mc;
  }), [tests, dateFrom, dateTo, catFilter]);

  const categories = useMemo(() => [...new Set(tests.map(t => t.category))], [tests]);

  // group by test name
  const rows = useMemo((): TATRow[] => {
    const map = new Map<string, LabInvestigationResponse[]>();
    inRange.forEach(t => {
      const key = t.investigationName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });

    return Array.from(map.entries()).map(([name, group]) => {
      const completed = group.filter(t => t.status === "COMPLETED" && t.actualTatMinutes != null);
      const tatMins   = completed.map(t => t.actualTatMinutes!);

      // Expected TAT from turnaroundTime string e.g. "2 hours", "30 minutes"
      let expectedTATMins: number | null = null;
      const tatStr = group[0].turnaroundTime ?? "";
      const hoursMatch = tatStr.match(/([\d.]+)\s*hour/i);
      const minsMatch  = tatStr.match(/([\d.]+)\s*min/i);
      if (hoursMatch)  expectedTATMins = parseFloat(hoursMatch[1]) * 60;
      else if (minsMatch) expectedTATMins = parseFloat(minsMatch[1]);

      const withinTAT   = expectedTATMins != null
        ? tatMins.filter(m => m <= expectedTATMins!).length : 0;
      const exceededTAT = expectedTATMins != null
        ? tatMins.filter(m => m > expectedTATMins!).length : 0;
      const compliancePct = tatMins.length > 0 && expectedTATMins != null
        ? Math.round((withinTAT / tatMins.length) * 100) : 0;

      return {
        investigationName: name,
        testCode:   group[0].testCode,
        category:   group[0].category,
        expectedTATMins,
        totalOrders:    group.length,
        completedOrders:completed.length,
        avgTATMins:  tatMins.length ? Math.round(tatMins.reduce((a, b) => a + b, 0) / tatMins.length) : null,
        minTATMins:  tatMins.length ? Math.min(...tatMins) : null,
        maxTATMins:  tatMins.length ? Math.max(...tatMins) : null,
        withinTAT, exceededTAT, compliancePct,
        attendedBy: [...new Set(completed.flatMap(t => [t.collectedBy, t.completedBy].filter(Boolean) as string[]))],
      };
    }).sort((a, b) => {
      if (sortBy === "compliance") return a.compliancePct - b.compliancePct; // worst first
      if (sortBy === "avg") return (b.avgTATMins ?? 0) - (a.avgTATMins ?? 0);
      return a.investigationName.localeCompare(b.investigationName);
    });
  }, [inRange, sortBy]);

  const totalOrders     = rows.reduce((s, r) => s + r.totalOrders, 0);
  const totalCompleted  = rows.reduce((s, r) => s + r.completedOrders, 0);
  const totalWithin     = rows.reduce((s, r) => s + r.withinTAT, 0);
  const totalExceeded   = rows.reduce((s, r) => s + r.exceededTAT, 0);
  const overallCompliance = totalCompleted > 0
    ? Math.round((totalWithin / totalCompleted) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="TAT Report"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Lab" }, { label: "TAT Report" }]}
      />

      {/* summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <SC label="Total Orders"    value={String(totalOrders)}    color="text-slate-900"/>
        <SC label="Completed"       value={String(totalCompleted)} color="text-emerald-600"/>
        <SC label="Within TAT"      value={String(totalWithin)}    color="text-sky-600"/>
        <SC label="Exceeded TAT"    value={String(totalExceeded)}  color="text-red-500"/>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Overall Compliance</p>
          <p className={`text-2xl font-bold mt-0.5
            ${overallCompliance >= 80 ? "text-emerald-600" : overallCompliance >= 60 ? "text-amber-600" : "text-red-500"}`}>
            {overallCompliance}%
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
            <div className={`h-full rounded-full transition-all
              ${overallCompliance >= 80 ? "bg-emerald-500" : overallCompliance >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${overallCompliance}%` }}/>
          </div>
        </div>
      </div>

      {/* filter + sort bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* preset buttons */}
        {[
          { label: "Today",      fn: () => { setDateFrom(today()); setDateTo(today()); } },
          { label: "This Week",  fn: () => { setDateFrom(weekStart()); setDateTo(today()); } },
          { label: "This Month", fn: () => { setDateFrom(monthStart()); setDateTo(today()); } },
          { label: "Last Month", fn: () => { const [s, e] = lastMonthRange(); setDateFrom(s); setDateTo(e); } },
        ].map(p => (
          <button key={p.label} onClick={p.fn}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200
              bg-white text-slate-600 hover:bg-sky-50 hover:border-sky-300
              hover:text-sky-700 transition-colors whitespace-nowrap">
            {p.label}
          </button>
        ))}

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        {/* category */}
        <div className="relative">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        {/* sort */}
        <div className="relative">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
              bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
            <option value="compliance">Sort: Worst Compliance First</option>
            <option value="avg">Sort: Slowest Average TAT</option>
            <option value="name">Sort: Test Name A–Z</option>
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>

        <p className="text-xs text-slate-400 self-center">{rows.length} tests · {dateFrom} to {dateTo}</p>
      </div>

      {/* loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded w-20" />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="h-3 bg-slate-200 rounded w-32" />
              <div className="h-5 bg-slate-200 rounded-full w-16" />
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-12" />
              <div className="h-5 bg-slate-200 rounded-full w-14 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* TAT table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["#","Test Name","Category","Expected TAT","Total","Done",
                    "Avg TAT","Min TAT","Max TAT","Within TAT","Exceeded","Compliance","Attended By"
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                      text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={13} className="px-4 py-12 text-center text-slate-400">
                    No completed investigations in this period
                  </td></tr>
                ) : rows.map((r, idx) => (
                  <tr key={r.investigationName} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 whitespace-nowrap">{r.investigationName}</p>
                      <p className="text-xs text-slate-400">{r.testCode}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-purple-700 bg-purple-50
                        px-2 py-0.5 rounded-full">{r.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {r.expectedTATMins != null ? fmtTAT(r.expectedTATMins) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold text-center">{r.totalOrders}</td>
                    <td className="px-4 py-3 text-slate-700 font-semibold text-center">{r.completedOrders}</td>

                    {/* Avg TAT */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.avgTATMins != null ? (
                        <span className={`font-semibold
                          ${r.expectedTATMins != null
                            ? r.avgTATMins <= r.expectedTATMins ? "text-emerald-600" : "text-red-500"
                            : "text-slate-700"}`}>
                          {fmtTAT(r.avgTATMins)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.minTATMins != null ? fmtTAT(r.minTATMins) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.maxTATMins != null ? fmtTAT(r.maxTATMins) : "—"}
                    </td>

                    {/* Within */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-emerald-700 font-semibold">{r.withinTAT}</span>
                    </td>
                    {/* Exceeded */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={r.exceededTAT > 0 ? "text-red-500 font-semibold" : "text-slate-400"}>
                        {r.exceededTAT}
                      </span>
                    </td>

                    {/* Compliance bar */}
                    <td className="px-4 py-3 min-w-[120px]">
                      {r.completedOrders > 0 && r.expectedTATMins != null ? (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`font-bold
                              ${r.compliancePct >= 80 ? "text-emerald-600"
                                : r.compliancePct >= 60 ? "text-amber-600" : "text-red-500"}`}>
                              {r.compliancePct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full">
                            <div className={`h-full rounded-full
                              ${r.compliancePct >= 80 ? "bg-emerald-500"
                                : r.compliancePct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${r.compliancePct}%` }}/>
                          </div>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* Attended By */}
                    <td className="px-4 py-3 min-w-[140px]">
                      {r.attendedBy.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.attendedBy.map(name => (
                            <span key={name}
                              className="inline-flex items-center gap-1 text-xs font-medium
                                text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 flex justify-between text-xs text-slate-400">
            <span>{rows.length} test types · {dateFrom} to {dateTo}</span>
            <span>Overall compliance: <span className={`font-bold
              ${overallCompliance >= 80 ? "text-emerald-600" : overallCompliance >= 60 ? "text-amber-600" : "text-red-500"}`}>
              {overallCompliance}%
            </span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function SC({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}
