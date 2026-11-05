"use client";

/**
 * Lightweight, dependency-free SVG charts for the reporting screens.
 * Rendered as inline SVG so they can be exported to PNG and printed cleanly.
 */
import React from "react";

export const CHART_COLORS = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16", "#0ea5e9",
];

function fmtNum(n: number) { return (n ?? 0).toLocaleString("en-IN"); }

// ── Bar chart (single or grouped series) ─────────────────────────────────────
export interface BarSeries { label: string; color?: string; values: number[]; }

export function BarChart({
  labels, series, height = 280, valueFormatter = fmtNum, ariaLabel,
}: {
  labels: string[]; series: BarSeries[]; height?: number;
  valueFormatter?: (n: number) => string; ariaLabel?: string;
}) {
  const width = Math.max(labels.length * (series.length * 16 + 26) + 60, 340);
  const padL = 48, padB = 48, padT = 12, padR = 12;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxV = Math.max(1, ...series.flatMap(s => s.values));
  const groupW = chartW / Math.max(labels.length, 1);
  const barW = Math.min(30, (groupW - 8) / Math.max(series.length, 1));
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxV / yTicks) * i));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img"
      aria-label={ariaLabel ?? "Bar chart"} style={{ maxWidth: "100%" }}>
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
      {ticks.map((tk, i) => {
        const y = padT + chartH - (tk / maxV) * chartH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtNum(tk)}</text>
          </g>
        );
      })}
      {labels.map((lab, gi) => {
        const gx = padL + gi * groupW;
        return (
          <g key={gi}>
            {series.map((s, si) => {
              const v = s.values[gi] ?? 0;
              const h = (v / maxV) * chartH;
              const x = gx + (groupW - barW * series.length) / 2 + si * barW;
              const y = padT + chartH - h;
              return (
                <rect key={si} x={x} y={y} width={barW - 2} height={Math.max(0, h)} rx={2}
                  fill={s.color ?? CHART_COLORS[si % CHART_COLORS.length]}>
                  <title>{`${lab} — ${s.label}: ${valueFormatter(v)}`}</title>
                </rect>
              );
            })}
            <text x={gx + groupW / 2} y={height - padB + 14} textAnchor="middle" fontSize={9}
              fill="#64748b">{lab.length > 10 ? lab.slice(0, 9) + "…" : lab}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Line chart ────────────────────────────────────────────────────────────────
export interface LineSeries { label: string; color?: string; values: number[]; }

export function LineChart({
  labels, series, height = 280, valueFormatter = fmtNum, ariaLabel,
}: {
  labels: string[]; series: LineSeries[]; height?: number;
  valueFormatter?: (n: number) => string; ariaLabel?: string;
}) {
  const width = Math.max(labels.length * 60 + 60, 340);
  const padL = 48, padB = 48, padT = 12, padR = 12;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const allVals = series.flatMap(s => s.values);
  const maxV = Math.max(1, ...allVals);
  const stepX = chartW / Math.max(labels.length - 1, 1);
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxV / yTicks) * i));
  const yOf = (v: number) => padT + chartH - (v / maxV) * chartH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img"
      aria-label={ariaLabel ?? "Line chart"} style={{ maxWidth: "100%" }}>
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
      {ticks.map((tk, i) => {
        const y = yOf(tk);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtNum(tk)}</text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
        const pts = s.values.map((v, i) => `${padL + i * stepX},${yOf(v)}`).join(" ");
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={padL + i * stepX} cy={yOf(v)} r={2.5} fill={color}>
                <title>{`${labels[i]} — ${s.label}: ${valueFormatter(v)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {labels.map((lab, i) => (
        <text key={i} x={padL + i * stepX} y={height - padB + 14} textAnchor="middle" fontSize={9}
          fill="#64748b">{lab.length > 8 ? lab.slice(0, 7) + "…" : lab}</text>
      ))}
    </svg>
  );
}

// ── Pie / Donut ─────────────────────────────────────────────────────────────
export interface PieSlice { label: string; value: number; color?: string; }

export function PieChart({
  slices, size = 240, donut = false, valueFormatter = fmtNum, ariaLabel,
}: {
  slices: PieSlice[]; size?: number; donut?: boolean;
  valueFormatter?: (n: number) => string; ariaLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 8;
  const innerR = donut ? r * 0.58 : 0;
  const legendW = 160;
  const width = size + legendW;
  let angle = -Math.PI / 2;

  function arcPath(startA: number, endA: number) {
    const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
    const large = endA - startA > Math.PI ? 1 : 0;
    if (innerR > 0) {
      const xi1 = cx + innerR * Math.cos(endA),   yi1 = cy + innerR * Math.sin(endA);
      const xi2 = cx + innerR * Math.cos(startA), yi2 = cy + innerR * Math.sin(startA);
      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`;
    }
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  return (
    <svg viewBox={`0 0 ${width} ${size}`} width="100%" height={size} role="img"
      aria-label={ariaLabel ?? (donut ? "Donut chart" : "Pie chart")} style={{ maxWidth: "100%" }}>
      <rect x={0} y={0} width={width} height={size} fill="#ffffff" />
      {total === 0 ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" />
          <text x={cx} y={cy} textAnchor="middle" fontSize={11} fill="#94a3b8">No data</text>
        </>
      ) : (
        slices.map((s, i) => {
          const frac = Math.max(0, s.value) / total;
          const start = angle;
          const end = angle + frac * Math.PI * 2;
          angle = end;
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return (
            <path key={i} d={arcPath(start, end)} fill={color} stroke="#ffffff" strokeWidth={1.5}>
              <title>{`${s.label}: ${valueFormatter(s.value)} (${(frac * 100).toFixed(1)}%)`}</title>
            </path>
          );
        })
      )}
      {donut && total > 0 && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
          {valueFormatter(total)}
        </text>
      )}
      {slices.map((s, i) => {
        const ly = 16 + i * 20;
        const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
        const pct = total > 0 ? ((Math.max(0, s.value) / total) * 100).toFixed(0) : "0";
        return (
          <g key={i}>
            <rect x={size + 6} y={ly - 8} width={10} height={10} rx={2} fill={color} />
            <text x={size + 22} y={ly + 1} fontSize={10} fill="#475569">
              {(s.label.length > 16 ? s.label.slice(0, 15) + "…" : s.label)} · {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
