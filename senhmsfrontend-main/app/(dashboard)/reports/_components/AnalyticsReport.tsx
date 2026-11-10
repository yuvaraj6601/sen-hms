"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "../../../_components/PageHeader";
import { BarChart, LineChart, PieChart, CHART_COLORS } from "../../../_components/charts/Charts";
import { Dropdown } from "../../../_components/MultiSelect";
import { downloadCsv, openPdf, downloadSvgAsPng, svgToString } from "../../../_lib/report-export";

// Generic report screen for the backend /reports/analytics endpoint. Every
// analytics report (department-wise, doctor-wise, discharge, claims, beds,
// lab, payments) returns the same table + chart payload, so one screen renders all.

type AnalyticsType =
  | "DEPARTMENT_PATIENTS" | "DOCTOR_OP" | "DISCHARGE" | "INSURANCE_CLAIMS"
  | "BED_OCCUPANCY" | "LAB_STATUS" | "PAYMENT_ANALYSIS";
type GroupBy = "DAY" | "MONTH" | "YEAR";
type Format = "TABLE" | "CHART" | "BOTH";
type ChartKind = "bar" | "line" | "pie";

interface AnalyticsReport {
  type: string; title: string; fromDate: string; toDate: string; groupBy: string | null; note: string;
  headers: string[]; rows: (string | number)[][]; hasTotalRow: boolean; moneyColumns: number[];
  summary: { label: string; value: string }[];
  chartLabels: string[]; chartSeries: { label: string; values: number[] }[];
  pie: { label: string; value: number }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const inr = (n: number) => "₹" + Math.round(n ?? 0).toLocaleString("en-IN");

function rangeFor(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "TODAY": return { from: today(), to: today() };
    case "WEEK": return { from: iso(new Date(y, m, d - ((now.getDay() + 6) % 7))), to: today() };
    case "MONTH": return { from: iso(new Date(y, m, 1)), to: today() };
    case "YEAR": return { from: iso(new Date(y, 0, 1)), to: today() };
    default: return { from: today(), to: today() };
  }
}

async function apiFetch(path: string) {
  try {
    const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
    const json = await res.json();
    return { ok: res.ok && json.success, data: json.data, error: json.error ?? json.message ?? "Request failed" };
  } catch {
    return { ok: false, data: null, error: "Cannot reach the server." };
  }
}

export default function AnalyticsReport({
  type, title, dateRange = true, groupable = false, defaultChart = "bar",
}: {
  type: AnalyticsType; title: string; dateRange?: boolean; groupable?: boolean; defaultChart?: ChartKind;
}) {
  const [from, setFrom] = useState(rangeFor("MONTH").from);
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState("MONTH");
  const [groupBy, setGroupBy] = useState<GroupBy>("DAY");
  const [format, setFormat] = useState<Format>("BOTH");
  const [chartKind, setChartKind] = useState<ChartKind>(defaultChart);

  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [applied, setApplied] = useState<null | { format: Format }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  const dateError = dateRange && from && to && to < from ? "To Date cannot be earlier than From Date" : "";

  async function generate() {
    if (dateError) return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ type });
    if (dateRange) { qs.set("from", from); qs.set("to", to); }
    if (groupable) qs.set("groupBy", groupBy);
    const { ok, data, error: err } = await apiFetch(`/api/reports/analytics?${qs.toString()}`);
    if (ok) { setReport(data as AnalyticsReport); setApplied({ format }); }
    else { setError(err); setReport(null); }
    setLoading(false);
  }

  useEffect(() => {
    // Snapshot reports have no filters — load immediately.
    let live = true;
    if (!dateRange) {
      apiFetch(`/api/reports/analytics?type=${type}`).then(({ ok, data, error: err }) => {
        if (!live) return;
        if (ok) { setReport(data as AnalyticsReport); setApplied({ format: "BOTH" }); }
        else setError(err);
      });
    }
    return () => { live = false; setReport(null); setApplied(null); setError(null); };
  }, [dateRange, type]);

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== "CUSTOM") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); }
  }
  function resetFilters() {
    const r = rangeFor("MONTH");
    setFrom(r.from); setTo(today()); setPreset("MONTH"); setGroupBy("DAY"); setFormat("BOTH");
    setReport(null); setApplied(null); setError(null);
  }

  const money = useMemo(() => new Set(report?.moneyColumns ?? []), [report]);
  const hasData = !!report && report.rows.length > 0;
  const isMoneyChart = !!report && (report.type === "INSURANCE_CLAIMS" || report.type === "PAYMENT_ANALYSIS");
  const fmtVal = isMoneyChart ? inr : (n: number) => (n ?? 0).toLocaleString("en-IN");
  const series = (report?.chartSeries ?? []).map((s, i) => ({ label: s.label, color: CHART_COLORS[i % CHART_COLORS.length], values: s.values }));
  const slices = (report?.pie ?? []).filter(s => s.value > 0).map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const periodText = report
    ? (dateRange ? `${report.fromDate} to ${report.toDate}${report.groupBy ? ` · Grouped by ${report.groupBy}` : ""}` : `As of ${report.toDate}`)
    : "";
  const filterLines = report?.note ? [report.note] : [];
  const cell = (c: string | number, j: number) =>
    typeof c === "number" ? (money.has(j) ? inr(c) : c.toLocaleString("en-IN")) : c;

  function handleCsv() {
    if (!report) return;
    downloadCsv({ filename: `${type.toLowerCase().replace(/_/g, "-")}-report`, meta: [title, periodText, ...filterLines], headers: report.headers, rows: report.rows });
  }
  function handlePdf() {
    if (!report) return;
    openPdf({
      reportTitle: title, periodText, filterLines, summary: report.summary,
      chartSvg: applied?.format !== "TABLE" ? svgToString(chartRef.current) : undefined,
      headers: report.headers, rows: report.rows,
    });
  }
  function handlePng() { downloadSvgAsPng(chartRef.current, `${type.toLowerCase().replace(/_/g, "-")}-chart`); }

  return (
    <div>
      <PageHeader title={title} breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }, { label: title }]} />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-5 sticky top-2 z-10">
        {dateRange && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-slate-500 mr-1">Quick range:</span>
            {[["TODAY", "Today"], ["WEEK", "This Week"], ["MONTH", "This Month"], ["YEAR", "This Year"], ["CUSTOM", "Custom"]].map(([k, l]) => (
              <button key={k} onClick={() => applyPreset(k)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${preset === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dateRange && (
            <>
              <Field label="From Date">
                <input type="date" value={from} max={to || undefined}
                  onChange={e => { setFrom(e.target.value); setPreset("CUSTOM"); }} className={inputCls} />
              </Field>
              <Field label="To Date">
                <input type="date" value={to} min={from || undefined}
                  onChange={e => { setTo(e.target.value); setPreset("CUSTOM"); }} className={inputCls} />
              </Field>
            </>
          )}
          {groupable && (
            <Field label="Group By">
              <Dropdown value={groupBy} onChange={v => setGroupBy(v as GroupBy)}
                options={[{ value: "DAY", label: "Day" }, { value: "MONTH", label: "Month" }, { value: "YEAR", label: "Year" }]} />
            </Field>
          )}
          <Field label="Report View">
            <Dropdown value={format} onChange={v => setFormat(v as Format)}
              options={[{ value: "TABLE", label: "Table" }, { value: "CHART", label: "Chart" }, { value: "BOTH", label: "Table + Chart" }]} />
          </Field>
          <div className="flex items-end gap-2">
            <button onClick={generate} disabled={!!dateError || loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
              {loading ? "Generating…" : dateRange ? "Generate Report" : "Refresh"}
            </button>
            {dateRange && (
              <button onClick={resetFilters}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Reset
              </button>
            )}
          </div>
        </div>
        {dateError && <p className="text-xs text-red-500 mt-2">{dateError}</p>}
      </div>

      {loading && <div className="py-16 text-center text-slate-400 text-sm">Generating report…</div>}
      {error && !loading && <div className="py-6 text-center text-red-500 text-sm">{error}</div>}
      {!loading && !error && !applied && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
          <p className="text-sm font-medium">Set your filters and click <span className="text-indigo-600 font-semibold">Generate Report</span>.</p>
        </div>
      )}
      {!loading && !error && applied && !hasData && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
          <p className="text-sm font-medium text-slate-500">No data for the selected period.</p>
          <p className="text-xs mt-1">Try a wider date range.</p>
        </div>
      )}

      {!loading && !error && applied && hasData && report && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800">{title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{periodText}</p>
                {report.note && <p className="text-[11px] text-slate-400 mt-1">{report.note}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <ExportBtn onClick={handlePdf} label="PDF" />
                <ExportBtn onClick={handleCsv} label="CSV" />
                {applied.format !== "TABLE" && <ExportBtn onClick={handlePng} label="Chart PNG" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.summary.map(c => (
              <div key={c.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-slate-500 truncate">{c.label}</p>
                <p className="text-xl font-extrabold mt-0.5 text-slate-800">{c.value}</p>
              </div>
            ))}
          </div>

          {applied.format !== "TABLE" && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700">Chart</h3>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                  {(["bar", "line", "pie"] as ChartKind[]).map(k => (
                    <button key={k} onClick={() => setChartKind(k)}
                      className={`px-3 py-1 text-xs font-medium capitalize ${chartKind === k ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <div ref={setSvgRef(chartRef)}>
                {chartKind === "bar" && <BarChart labels={report.chartLabels} series={series} valueFormatter={fmtVal} ariaLabel={`${title} bar chart`} />}
                {chartKind === "line" && <LineChart labels={report.chartLabels} series={series} valueFormatter={fmtVal} ariaLabel={`${title} line chart`} />}
                {chartKind === "pie" && <PieChart slices={slices} donut valueFormatter={fmtVal} ariaLabel={`${title} breakdown`} />}
              </div>
            </div>
          )}

          {applied.format !== "CHART" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {report.headers.map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.rows.map((r, i) => {
                      const isTotal = report.hasTotalRow && i === report.rows.length - 1;
                      return (
                        <tr key={i} className={isTotal ? "bg-slate-50 font-bold" : "hover:bg-slate-50"}>
                          {r.map((c, j) => (
                            <td key={j} className={`px-4 py-2 ${j === 0 ? "font-medium text-slate-700" : "text-slate-600"} ${isTotal ? "text-slate-900" : ""}`}>
                              {cell(c, j)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function setSvgRef(ref: React.RefObject<SVGSVGElement | null>) {
  return (el: HTMLDivElement | null) => {
    if (el) {
      const svg = el.querySelector("svg");
      if (svg) (ref as React.MutableRefObject<SVGSVGElement | null>).current = svg as SVGSVGElement;
    }
  };
}

function ExportBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  );
}
