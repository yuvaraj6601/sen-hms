"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "../../../_components/PageHeader";
import { BarChart, LineChart, PieChart, CHART_COLORS } from "../../../_components/charts/Charts";
import { MultiSelect, Dropdown } from "../../../_components/MultiSelect";
import { downloadCsv, openPdf, downloadSvgAsPng, svgToString } from "../../../_lib/report-export";

// ─── helpers ─────────────────────────────────────────────────────────────────
function num(n: number) { return (n ?? 0).toLocaleString("en-IN"); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function today() { return iso(new Date()); }

async function apiFetch(path: string) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupBy = "DAY" | "MONTH" | "YEAR";
type PatientType = "OP" | "IP" | "BOTH";
type Format = "TABLE" | "CHART" | "BOTH";
type ChartKind = "bar" | "line" | "pie";

interface Bucket {
  label: string; start: string;
  opTotal: number; opFree: number; opPaid: number;
  ipTotal: number; ipFree: number; ipInsurance: number; ipNonInsurance: number;
  combined: number;
}
interface Totals {
  opTotal: number; opFree: number; opPaid: number;
  ipTotal: number; ipFree: number; ipInsurance: number; ipNonInsurance: number;
  combined: number; insuranceTotal: number; freeTotal: number;
  ipInsuranceSurgical: number; ipInsuranceNonSurgical: number;
  ipNonInsuranceSurgical: number; ipNonInsuranceNonSurgical: number;
  ipSurgicalTotal: number; ipNonSurgicalTotal: number;
}
interface PatientReport {
  groupBy: string; fromDate: string; toDate: string;
  buckets: Bucket[]; totals: Totals;
}
interface DeptOption { id: number; name: string; }

const PAYMENT_OPTIONS = ["Insurance", "Non-Insurance", "Free"] as const;
type PaymentCat = typeof PAYMENT_OPTIONS[number];

const TREATMENT_OPTIONS = ["Surgical", "Non-Surgical"] as const;
type TreatmentCat = typeof TREATMENT_OPTIONS[number];

// quick-select ranges
function rangeFor(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "TODAY":  return { from: today(), to: today() };
    case "WEEK": {
      const day = now.getDay(); // 0 Sun
      const monday = new Date(y, m, d - ((day + 6) % 7));
      return { from: iso(monday), to: today() };
    }
    case "MONTH":  return { from: iso(new Date(y, m, 1)), to: today() };
    case "YEAR":   return { from: iso(new Date(y, 0, 1)), to: today() };
    default:       return { from: today(), to: today() };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PatientReportPage() {
  // filters (draft — applied on Generate)
  const [from, setFrom] = useState(rangeFor("MONTH").from);
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState("MONTH");
  const [patientType, setPatientType] = useState<PatientType>("BOTH");
  const [payments, setPayments] = useState<PaymentCat[]>([...PAYMENT_OPTIONS]);
  const [treatments, setTreatments] = useState<TreatmentCat[]>([...TREATMENT_OPTIONS]);
  const [department, setDepartment] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("DAY");
  const [format, setFormat] = useState<Format>("BOTH");

  const [depts, setDepts] = useState<DeptOption[]>([]);
  const [report, setReport] = useState<PatientReport | null>(null);
  const [applied, setApplied] = useState<null | {
    from: string; to: string; patientType: PatientType; payments: PaymentCat[]; treatments: TreatmentCat[]; department: string; groupBy: GroupBy; format: Format;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const chartRef = useRef<SVGSVGElement>(null);

  const dateError = from && to && to < from ? "To Date cannot be earlier than From Date" : "";

  useEffect(() => {
    apiFetch("/api/masters/departments?page=0&size=200").then(({ ok, data }) => {
      if (ok) setDepts((data?.content ?? data ?? []).map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
    });
    // Clear any generated report when leaving the page so a return visit starts
    // fresh (Next.js keeps this component mounted in the router cache).
    return () => { setReport(null); setApplied(null); setError(null); };
  }, []);

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== "CUSTOM") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); }
  }

  function resetFilters() {
    const r = rangeFor("MONTH");
    setFrom(r.from); setTo(today()); setPreset("MONTH");
    setPatientType("BOTH"); setPayments([...PAYMENT_OPTIONS]); setTreatments([...TREATMENT_OPTIONS]);
    setDepartment(""); setGroupBy("DAY"); setFormat("BOTH");
    setReport(null); setApplied(null); setError(null);
  }

  async function generate() {
    if (dateError) return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ from, to, groupBy });
    if (department) qs.set("department", department);
    const { ok, data, error: err } = await apiFetch(`/api/reports/patient?${qs.toString()}`);
    if (ok) {
      setReport(data as PatientReport);
      setApplied({ from, to, patientType, payments: [...payments], treatments: [...treatments], department, groupBy, format });
    } else { setError(err); setReport(null); }
    setLoading(false);
  }

  // ── derived view based on applied filters ──
  const showOp = applied ? applied.patientType !== "IP" : true;
  const showIp = applied ? applied.patientType !== "OP" : true;
  const pays = applied?.payments ?? [...PAYMENT_OPTIONS];
  const wantInsurance = pays.includes("Insurance");
  const wantNonInsurance = pays.includes("Non-Insurance");
  const wantFree = pays.includes("Free");

  // build dynamic columns for the table + chart series
  const { headers, rows, chartSeries, pieSlices } = useMemo(() => {
    if (!report) return { headers: [] as string[], rows: [] as (string | number)[][], chartSeries: [] as { label: string; color: string; values: number[] }[], pieSlices: [] as { label: string; value: number; color: string }[] };
    const cols: { key: string; label: string; color: string; get: (b: Bucket) => number; totalGet: (t: Totals) => number }[] = [];

    if (showOp) {
      cols.push({ key: "opTotal", label: "OP", color: CHART_COLORS[1], get: b => b.opTotal, totalGet: t => t.opTotal });
      if (wantFree) cols.push({ key: "opFree", label: "OP Free", color: CHART_COLORS[3], get: b => b.opFree, totalGet: t => t.opFree });
    }
    if (showIp) {
      cols.push({ key: "ipTotal", label: "IP", color: CHART_COLORS[0], get: b => b.ipTotal, totalGet: t => t.ipTotal });
      if (wantInsurance) cols.push({ key: "ipIns", label: "IP Insurance", color: CHART_COLORS[6], get: b => b.ipInsurance, totalGet: t => t.ipInsurance });
      if (wantNonInsurance) cols.push({ key: "ipNonIns", label: "IP Non-Insurance", color: CHART_COLORS[9], get: b => b.ipNonInsurance, totalGet: t => t.ipNonInsurance });
      if (wantFree) cols.push({ key: "ipFree", label: "IP Free", color: CHART_COLORS[4], get: b => b.ipFree, totalGet: t => t.ipFree });
    }
    if (showOp && showIp) {
      cols.push({ key: "combined", label: "Total", color: CHART_COLORS[5], get: b => b.combined, totalGet: t => t.combined });
    }

    const gbLabel = report.groupBy === "MONTH" ? "Month" : report.groupBy === "YEAR" ? "Year" : "Date";
    const hdrs = [gbLabel, ...cols.map(c => c.label)];
    const rws: (string | number)[][] = report.buckets.map(b => [b.label, ...cols.map(c => c.get(b))]);
    // totals row
    rws.push(["Total", ...cols.map(c => c.totalGet(report.totals))]);

    const series = cols
      .filter(c => c.key !== "combined")
      .map(c => ({ label: c.label, color: c.color, values: report.buckets.map(c.get) }));

    const pie = cols
      .filter(c => c.key !== "combined" && c.key !== "opTotal" && c.key !== "ipTotal")
      .map(c => ({ label: c.label, value: c.totalGet(report.totals), color: c.color }));
    // fallback pie: if no sub-categories, use OP vs IP
    const pieFinal = pie.length ? pie : cols.filter(c => c.key === "opTotal" || c.key === "ipTotal")
      .map(c => ({ label: c.label, value: c.totalGet(report.totals), color: c.color }));

    return { headers: hdrs, rows: rws, chartSeries: series, pieSlices: pieFinal };
  }, [report, showOp, showIp, wantInsurance, wantNonInsurance, wantFree]);

  const labels = report?.buckets.map(b => b.label) ?? [];
  const hasData = !!report && report.buckets.length > 0 && (report.totals.combined > 0);

  const periodText = applied ? `${applied.from} to ${applied.to} · Grouped by ${applied.groupBy}` : "";
  const filterLines = useMemo(() => {
    if (!applied) return [];
    const lines = [
      `Patient Type: ${applied.patientType === "BOTH" ? "IP + OP" : applied.patientType}`,
      `Payment: ${applied.payments.length === PAYMENT_OPTIONS.length ? "All" : applied.payments.join(", ") || "None"}`,
    ];
    if (applied.department) lines.push(`Department: ${applied.department}`);
    return lines;
  }, [applied]);

  const summaryCards = report ? [
    { label: "Total Patients", value: num(report.totals.combined) },
    { label: "Total IP", value: num(report.totals.ipTotal) },
    { label: "Total OP", value: num(report.totals.opTotal) },
    { label: "Free", value: num(report.totals.freeTotal) },
    { label: "Insurance", value: num(report.totals.insuranceTotal) },
    { label: "Non-Insurance (IP)", value: num(report.totals.ipNonInsurance) },
  ] : [];

  function handleCsv() {
    downloadCsv({
      filename: "patient-report",
      meta: ["Patient Report", periodText, ...filterLines],
      headers, rows,
    });
  }
  function handlePdf() {
    openPdf({
      reportTitle: "Patient Report",
      periodText,
      filterLines,
      summary: summaryCards.map(c => ({ label: c.label, value: c.value })),
      chartSvg: applied?.format !== "TABLE" ? svgToString(chartRef.current) : undefined,
      headers, rows,
    });
  }
  function handlePng() { downloadSvgAsPng(chartRef.current, "patient-report-chart"); }

  return (
    <div>
      <PageHeader
        title="Patient Report Generator"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }, { label: "Patient Report" }]}
      />

      {/* ── Filter panel ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-5 sticky top-2 z-10">
        {/* quick presets */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium text-slate-500 mr-1">Quick range:</span>
          {[["TODAY", "Today"], ["WEEK", "This Week"], ["MONTH", "This Month"], ["YEAR", "This Year"], ["CUSTOM", "Custom"]].map(([k, l]) => (
            <button key={k} onClick={() => applyPreset(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${preset === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="From Date">
            <input type="date" value={from} max={to || undefined}
              onChange={e => { setFrom(e.target.value); setPreset("CUSTOM"); }} className={inputCls} />
          </Field>
          <Field label="To Date">
            <input type="date" value={to} min={from || undefined}
              onChange={e => { setTo(e.target.value); setPreset("CUSTOM"); }} className={inputCls} />
          </Field>
          <Field label="Patient Type">
            <Dropdown
              value={patientType}
              onChange={v => setPatientType(v as PatientType)}
              options={[
                { value: "OP", label: "OP (Outpatient)" },
                { value: "IP", label: "IP (Inpatient)" },
                { value: "BOTH", label: "IP + OP" },
              ]}
            />
          </Field>
          <Field label="Group By">
            <Dropdown
              value={groupBy}
              onChange={v => setGroupBy(v as GroupBy)}
              options={[
                { value: "DAY", label: "Day" },
                { value: "MONTH", label: "Month" },
                { value: "YEAR", label: "Year" },
              ]}
            />
          </Field>

          <Field label="Payment Category">
            <MultiSelect
              options={PAYMENT_OPTIONS.map(p => ({ value: p, label: p }))}
              selected={payments}
              onChange={next => setPayments(next as PaymentCat[])}
              placeholder="Select payment"
            />
          </Field>
          <Field label="Treatment Category (IP)">
            <MultiSelect
              options={TREATMENT_OPTIONS.map(t => ({ value: t, label: t }))}
              selected={treatments}
              onChange={next => setTreatments(next as TreatmentCat[])}
              placeholder="Select treatment"
            />
          </Field>
          <Field label="Department">
            <Dropdown
              value={department}
              onChange={setDepartment}
              options={[{ value: "", label: "All Departments" }, ...depts.map(d => ({ value: d.name, label: d.name }))]}
            />
          </Field>
          <Field label="Report Format">
            <Dropdown
              value={format}
              onChange={v => setFormat(v as Format)}
              options={[
                { value: "TABLE", label: "Table" },
                { value: "CHART", label: "Chart" },
                { value: "BOTH", label: "Table + Chart" },
              ]}
            />
          </Field>
          <div className="flex items-end gap-2">
            <button onClick={generate} disabled={!!dateError || loading}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
              {loading ? "Generating…" : "Generate Report"}
            </button>
            <button onClick={resetFilters}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Reset
            </button>
          </div>
        </div>

        {dateError && <p className="text-xs text-red-500 mt-2">{dateError}</p>}
        {(patientType === "OP") && (
          <p className="text-xs text-amber-600 mt-2">
            Note: Surgical / Non-Surgical categorization applies to IP admissions only.
          </p>
        )}
      </div>

      {/* ── States ── */}
      {loading && <div className="py-16 text-center text-slate-400 text-sm">Generating report…</div>}
      {error && !loading && <div className="py-6 text-center text-red-500 text-sm">{error}</div>}
      {!loading && !error && !applied && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
          <p className="text-sm font-medium">Set your filters and click <span className="text-indigo-600 font-semibold">Generate Report</span>.</p>
        </div>
      )}
      {!loading && !error && applied && !hasData && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
          <p className="text-sm font-medium text-slate-500">No patients match the selected filters.</p>
          <p className="text-xs mt-1">Try a wider date range or different patient type.</p>
        </div>
      )}

      {/* ── Report preview ── */}
      {!loading && !error && applied && hasData && report && (
        <div className="space-y-5">
          {/* title + meta */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800">Patient Report</h2>
                <p className="text-xs text-slate-500 mt-0.5">{periodText}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterLines.map((l, i) => (
                    <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5">{l}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ExportBtn onClick={handlePdf} label="PDF" />
                <ExportBtn onClick={handleCsv} label="CSV" />
                {applied.format !== "TABLE" && <ExportBtn onClick={handlePng} label="Chart PNG" />}
              </div>
            </div>
          </div>

          {/* summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map(c => (
              <div key={c.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-slate-500 truncate">{c.label}</p>
                <p className="text-xl font-extrabold mt-0.5 text-slate-800">{c.value}</p>
              </div>
            ))}
          </div>

          {/* chart */}
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
                {chartKind === "bar" && <BarChart labels={labels} series={chartSeries} ariaLabel="Patient report bar chart" />}
                {chartKind === "line" && <LineChart labels={labels} series={chartSeries} ariaLabel="Patient report line chart" />}
                {chartKind === "pie" && <PieChart slices={pieSlices} donut ariaLabel="Patient report breakdown" />}
              </div>
            </div>
          )}

          {/* table */}
          {applied.format !== "CHART" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {headers.map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r, i) => {
                      const isTotal = i === rows.length - 1;
                      return (
                        <tr key={i} className={isTotal ? "bg-slate-50 font-bold" : "hover:bg-slate-50"}>
                          {r.map((c, j) => (
                            <td key={j} className={`px-4 py-2 ${j === 0 ? "font-medium text-slate-700" : "text-slate-600"} ${isTotal ? "text-slate-900" : ""}`}>{c}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IP Category breakdown (insurance × surgical) */}
          {showIp && applied.format !== "CHART" && report.totals.ipTotal > 0 && (() => {
            const showSurg = applied.treatments.includes("Surgical");
            const showNonSurg = applied.treatments.includes("Non-Surgical");
            const t = report.totals;
            return (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-700">IP Patient Category</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                        {showSurg && <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Surgical</th>}
                        {showNonSurg && <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Non-Surgical</th>}
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">Insurance</td>
                        {showSurg && <td className="px-4 py-2 text-slate-600">{num(t.ipInsuranceSurgical)}</td>}
                        {showNonSurg && <td className="px-4 py-2 text-slate-600">{num(t.ipInsuranceNonSurgical)}</td>}
                        <td className="px-4 py-2 font-semibold text-slate-800">{num(t.ipInsurance)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">Non-Insurance</td>
                        {showSurg && <td className="px-4 py-2 text-slate-600">{num(t.ipNonInsuranceSurgical)}</td>}
                        {showNonSurg && <td className="px-4 py-2 text-slate-600">{num(t.ipNonInsuranceNonSurgical)}</td>}
                        <td className="px-4 py-2 font-semibold text-slate-800">{num(t.ipNonInsurance)}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="px-4 py-2 text-slate-900">Total IP</td>
                        {showSurg && <td className="px-4 py-2 text-slate-900">{num(t.ipSurgicalTotal)}</td>}
                        {showNonSurg && <td className="px-4 py-2 text-slate-900">{num(t.ipNonSurgicalTotal)}</td>}
                        <td className="px-4 py-2 text-slate-900">{num(t.ipTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── small components ───────────────────────────────────────────────────────────
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
