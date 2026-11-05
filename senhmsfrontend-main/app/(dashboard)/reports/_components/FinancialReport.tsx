"use client";

/**
 * Reusable financial report generator used by the Income, Expense and Net Cash
 * report pages. Same filter/table/chart/export pattern as the Patient Report.
 *
 * The graph is generated only after the user clicks "Generate Report" and it
 * reflects exactly the selected date range, grouping, category and chart type.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "../../../_components/PageHeader";
import { BarChart, LineChart, PieChart, CHART_COLORS } from "../../../_components/charts/Charts";
import { MultiSelect, Dropdown } from "../../../_components/MultiSelect";
import { downloadCsv, openPdf, downloadSvgAsPng, svgToString } from "../../../_lib/report-export";

// ── helpers ──────────────────────────────────────────────────────────────────
function inr(n: number) { return "\u20B9" + (n ?? 0).toLocaleString("en-IN"); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function today() { return iso(new Date()); }

async function apiFetch(path: string) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

function rangeFor(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "TODAY": return { from: today(), to: today() };
    case "WEEK": {
      const day = now.getDay();
      const monday = new Date(y, m, d - ((day + 6) % 7));
      return { from: iso(monday), to: today() };
    }
    case "MONTH": return { from: iso(new Date(y, m, 1)), to: today() };
    case "YEAR": return { from: iso(new Date(y, 0, 1)), to: today() };
    default: return { from: today(), to: today() };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type FinType = "INCOME" | "EXPENSE" | "NETCASH";
type GroupBy = "DAY" | "MONTH" | "YEAR";
type Format = "TABLE" | "CHART" | "BOTH";
type ChartKind = "bar" | "line" | "pie";

interface Bucket {
  label: string; start: string;
  income: number; expense: number; netCash: number;
  incomeTxns: number; expenseTxns: number;
}
interface CategoryRow { category: string; amount: number; txns: number; }
interface FinancialReport {
  type: string; groupBy: string; fromDate: string; toDate: string; category: string | null;
  buckets: Bucket[];
  totalIncome: number; totalExpense: number; netCash: number;
  incomeTxns: number; expenseTxns: number;
  avgIncomePerTxn: number; avgExpensePerTxn: number;
  categoryBreakdown: CategoryRow[];
}

interface Props {
  type: FinType;
  title: string;
}

export default function FinancialReport({ type, title }: Props) {
  const [from, setFrom] = useState(rangeFor("MONTH").from);
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState("MONTH");
  const [groupBy, setGroupBy] = useState<GroupBy>("DAY");
  const [categories, setCategories] = useState<string[]>([]);
  const [format, setFormat] = useState<Format>("BOTH");

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [applied, setApplied] = useState<null | { format: Format; groupBy: GroupBy; categories: string[] }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>(type === "NETCASH" ? "line" : "bar");
  const chartRef = useRef<SVGSVGElement>(null);

  const dateError = from && to && to < from ? "To Date cannot be earlier than From Date" : "";
  const showCategory = type !== "NETCASH"; // Net Cash aggregates all categories

  // Load category options for the active report type
  useEffect(() => {
    if (type === "EXPENSE") {
      apiFetch("/api/masters/expense-categories?page=0&size=200").then(({ ok, data }) => {
        if (ok) {
          const raw = data?.content ?? data ?? [];
          setCategoryOptions(raw.map((c: { name: string }) => c.name).filter(Boolean));
        }
      });
    } else if (type === "INCOME") {
      apiFetch("/api/reports/income-categories").then(({ ok, data }) => {
        if (ok && Array.isArray(data)) setCategoryOptions(data.filter(Boolean));
      });
    }
    // Clear any generated report when leaving so a return visit starts fresh
    // (Next.js keeps this component mounted in the router cache).
    return () => { setReport(null); setApplied(null); setError(null); };
  }, [type]);

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== "CUSTOM") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); }
  }

  function resetFilters() {
    const r = rangeFor("MONTH");
    setFrom(r.from); setTo(today()); setPreset("MONTH");
    setGroupBy("DAY"); setCategories([]); setFormat("BOTH");
    setReport(null); setApplied(null); setError(null);
  }

  async function generate() {
    if (dateError) return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ type, from, to, groupBy });
    // Only send a category filter when exactly one is chosen; multiple or none = All
    // (the backend filters a single category; the breakdown table still lists each).
    if (showCategory && categories.length === 1) qs.set("category", categories[0]);
    const { ok, data, error: err } = await apiFetch(`/api/reports/financial?${qs.toString()}`);
    if (ok) {
      let rep = data as FinancialReport;
      // Client-side narrowing when the user picked a specific subset (>1) of categories.
      if (showCategory && categories.length > 1) {
        rep = { ...rep, categoryBreakdown: rep.categoryBreakdown.filter(c => categories.includes(c.category)) };
      }
      setReport(rep);
      setApplied({ format, groupBy, categories: [...categories] });
    } else { setError(err); setReport(null); }
    setLoading(false);
  }

  const labels = report?.buckets.map(b => b.label) ?? [];
  const hasData = !!report && report.buckets.length > 0 &&
    (type === "INCOME" ? report.totalIncome > 0 : type === "EXPENSE" ? report.totalExpense > 0 : (report.totalIncome > 0 || report.totalExpense > 0));

  const gbLabel = report?.groupBy === "MONTH" ? "Month" : report?.groupBy === "YEAR" ? "Year" : "Date";

  // ── build table + chart per type ──
  const { headers, rows, chartSeries, pieSlices } = useMemo(() => {
    if (!report) return { headers: [] as string[], rows: [] as (string | number)[][], chartSeries: [] as { label: string; color: string; values: number[] }[], pieSlices: [] as { label: string; value: number; color: string }[] };

    if (type === "NETCASH") {
      const hdrs = [gbLabel, "Income (₹)", "Expense (₹)", "Net Cash (₹)"];
      const rws: (string | number)[][] = report.buckets.map(b => [b.label, Math.round(b.income), Math.round(b.expense), Math.round(b.netCash)]);
      rws.push(["Total", Math.round(report.totalIncome), Math.round(report.totalExpense), Math.round(report.netCash)]);
      const series = [
        { label: "Income", color: CHART_COLORS[2], values: report.buckets.map(b => b.income) },
        { label: "Expense", color: CHART_COLORS[4], values: report.buckets.map(b => b.expense) },
        { label: "Net Cash", color: CHART_COLORS[0], values: report.buckets.map(b => b.netCash) },
      ];
      const pie = [
        { label: "Income", value: report.totalIncome, color: CHART_COLORS[2] },
        { label: "Expense", value: report.totalExpense, color: CHART_COLORS[4] },
      ];
      return { headers: hdrs, rows: rws, chartSeries: series, pieSlices: pie };
    }

    // INCOME or EXPENSE
    const amtField = (b: Bucket) => (type === "INCOME" ? b.income : b.expense);
    const total = type === "INCOME" ? report.totalIncome : report.totalExpense;
    const hdrs = [gbLabel, type === "INCOME" ? "Income (₹)" : "Expense (₹)", "Transactions"];
    const txnField = (b: Bucket) => (type === "INCOME" ? b.incomeTxns : b.expenseTxns);
    const rws: (string | number)[][] = report.buckets.map(b => [b.label, Math.round(amtField(b)), txnField(b)]);
    const totalTxns = type === "INCOME" ? report.incomeTxns : report.expenseTxns;
    rws.push(["Total", Math.round(total), totalTxns]);
    const series = [{ label: type === "INCOME" ? "Income" : "Expense", color: type === "INCOME" ? CHART_COLORS[2] : CHART_COLORS[4], values: report.buckets.map(amtField) }];
    const pie = report.categoryBreakdown.map((c, i) => ({ label: c.category, value: c.amount, color: CHART_COLORS[i % CHART_COLORS.length] }));
    return { headers: hdrs, rows: rws, chartSeries: series, pieSlices: pie };
  }, [report, type, gbLabel]);

  const summaryCards = useMemo(() => {
    if (!report) return [] as { label: string; value: string }[];
    if (type === "INCOME") return [
      { label: "Total Income", value: inr(report.totalIncome) },
      { label: "Transactions", value: String(report.incomeTxns) },
      { label: "Avg / Transaction", value: inr(report.avgIncomePerTxn) },
    ];
    if (type === "EXPENSE") return [
      { label: "Total Expense", value: inr(report.totalExpense) },
      { label: "Transactions", value: String(report.expenseTxns) },
      { label: "Avg / Transaction", value: inr(report.avgExpensePerTxn) },
    ];
    return [
      { label: "Total Income", value: inr(report.totalIncome) },
      { label: "Total Expense", value: inr(report.totalExpense) },
      { label: "Net Cash", value: inr(report.netCash) },
    ];
  }, [report, type]);

  const periodText = report ? `${report.fromDate} to ${report.toDate} · Grouped by ${report.groupBy}` : "";
  const filterLines = useMemo(() => {
    if (!report) return [];
    const l = [`Accounting basis: Cash (received income / posted expenses)`];
    if (applied && applied.categories.length > 0) l.push(`Category: ${applied.categories.join(", ")}`);
    return l;
  }, [report, applied]);

  function handleCsv() {
    downloadCsv({ filename: `${type.toLowerCase()}-report`, meta: [title, periodText, ...filterLines], headers, rows });
  }
  function handlePdf() {
    openPdf({
      reportTitle: title, periodText, filterLines,
      summary: summaryCards, chartSvg: applied?.format !== "TABLE" ? svgToString(chartRef.current) : undefined,
      headers, rows,
    });
  }
  function handlePng() { downloadSvgAsPng(chartRef.current, `${type.toLowerCase()}-report-chart`); }

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }, { label: title }]}
      />

      {/* ── Filter panel ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-5 sticky top-2 z-10">
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
          {showCategory ? (
            <Field label="Category">
              <MultiSelect
                options={categoryOptions.map(c => ({ value: c, label: c }))}
                selected={categories}
                onChange={setCategories}
                placeholder="All categories"
              />
            </Field>
          ) : (
            <Field label="Category">
              <div className={`${inputCls} text-slate-400`}>All income &amp; expense</div>
            </Field>
          )}
          <Field label="Report View">
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
          <div className="flex items-end gap-2 lg:col-span-3">
            <button onClick={generate} disabled={!!dateError || loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
              {loading ? "Generating…" : "Generate Report"}
            </button>
            <button onClick={resetFilters}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Reset
            </button>
          </div>
        </div>
        {dateError && <p className="text-xs text-red-500 mt-2">{dateError}</p>}
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
          <p className="text-sm font-medium text-slate-500">No transactions match the selected filters.</p>
          <p className="text-xs mt-1">Try a wider date range or a different category.</p>
        </div>
      )}

      {/* ── Report preview ── */}
      {!loading && !error && applied && hasData && report && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800">{title}</h2>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summaryCards.map(c => (
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
                {chartKind === "bar" && <BarChart labels={labels} series={chartSeries} valueFormatter={inr} ariaLabel={`${title} bar chart`} />}
                {chartKind === "line" && <LineChart labels={labels} series={chartSeries} valueFormatter={inr} ariaLabel={`${title} line chart`} />}
                {chartKind === "pie" && <PieChart slices={pieSlices} donut valueFormatter={inr} ariaLabel={`${title} breakdown`} />}
              </div>
            </div>
          )}

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
                            <td key={j} className={`px-4 py-2 ${j === 0 ? "font-medium text-slate-700" : "text-slate-600"} ${isTotal ? "text-slate-900" : ""}`}>
                              {j > 0 && headers[j]?.includes("₹") && typeof c === "number" ? inr(c) : c}
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

          {/* category breakdown table for income/expense */}
          {type !== "NETCASH" && report.categoryBreakdown.length > 0 && applied.format !== "CHART" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-700">Category Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Category", "Amount (₹)", "Transactions"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.categoryBreakdown.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">{c.category}</td>
                        <td className="px-4 py-2 text-slate-600">{inr(c.amount)}</td>
                        <td className="px-4 py-2 text-slate-600">{c.txns}</td>
                      </tr>
                    ))}
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

// ── small components ────────────────────────────────────────────────────────────
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
