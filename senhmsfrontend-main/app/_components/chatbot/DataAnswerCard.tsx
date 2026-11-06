"use client";

import { useState } from "react";
import { BarChart, LineChart, PieChart, CHART_COLORS } from "../charts/Charts";
import { printHtml } from "../../_lib/print";
import { answerToCsv, toChart, type DataAnswer } from "../../_lib/chatbot";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function DataAnswerCard({ answer }: { answer: DataAnswer }) {
  const chart = toChart(answer);
  const [view, setView] = useState<"bar" | "line">(chart?.kind === "line" ? "line" : "bar");

  function download() {
    const blob = new Blob([answerToCsv(answer)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${answer.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function print() {
    const head = answer.columns.map(c => `<th>${esc(c)}</th>`).join("");
    const body = answer.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
    printHtml(`<html><head><title>${esc(answer.title)}</title><style>
      body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;font-size:13px}th{background:#f1f5f9}</style></head>
      <body><h2>${esc(answer.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 w-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{answer.title}</p>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={download} aria-label="Download as CSV" title="Download CSV"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
          </button>
          <button type="button" onClick={print} aria-label="Print" title="Print"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" /></svg>
          </button>
        </div>
      </div>

      {chart && chart.kind !== "pie" && (
        <>
          <div className="flex gap-1.5">
            {(["bar", "line"] as const).map(k => (
              <button key={k} type="button" onClick={() => setView(k)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border ${view === k ? "bg-[#00059f] text-white border-[#00059f]" : "bg-white text-slate-600 border-slate-200"}`}>
                {k === "bar" ? "Bar" : "Line"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            {view === "bar"
              ? <BarChart labels={chart.labels} series={chart.series.map((s, i) => ({ ...s, color: CHART_COLORS[i] }))} height={200} />
              : <LineChart labels={chart.labels} series={chart.series.map((s, i) => ({ ...s, color: CHART_COLORS[i] }))} height={200} />}
          </div>
          {chart.series.length > 1 && (
            <div className="flex gap-3 text-xs text-slate-600">
              {chart.series.map((s, i) => (
                <span key={s.label} className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[i] }} />{s.label}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {chart && chart.kind === "pie" && (
        <div className="flex justify-center">
          <PieChart size={200} slices={chart.labels.map((l, i) => ({ label: l, value: chart.series[0].values[i], color: CHART_COLORS[i % CHART_COLORS.length] }))} />
        </div>
      )}

      <div className="max-h-56 overflow-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>{answer.columns.map(c => <th key={c} className="text-left font-semibold text-slate-500 px-3 py-2">{c}</th>)}</tr>
          </thead>
          <tbody>
            {answer.rows.length === 0 && (
              <tr><td colSpan={answer.columns.length} className="px-3 py-3 text-slate-400">No data for this period.</td></tr>
            )}
            {answer.rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((c, j) => <td key={j} className="px-3 py-2 text-slate-700">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
