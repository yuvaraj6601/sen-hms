/**
 * Report export helpers: CSV, PDF (print-to-PDF window with hospital
 * letterhead) and chart PNG. All dependency-free and browser-only.
 */
import { HOSPITAL } from "./hospital-config";

// ── CSV ──────────────────────────────────────────────────────────────────────
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(opts: {
  filename: string;
  meta?: string[];
  headers: string[];
  rows: (string | number)[][];
}) {
  const { filename, meta = [], headers, rows } = opts;
  const lines: string[] = [];
  meta.forEach(m => lines.push(csvCell(m)));
  if (meta.length) lines.push("");
  lines.push(headers.map(csvCell).join(","));
  rows.forEach(r => lines.push(r.map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

// ── PDF (print window) ─────────────────────────────────────────────────────────
export function openPdf(opts: {
  reportTitle: string;
  periodText: string;
  filterLines?: string[];
  summary?: { label: string; value: string }[];
  chartSvg?: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  // NOTE: `summary` (KPI cards) and `chartSvg` are intentionally NOT rendered in
  // the PDF. The exported PDF is a traditional tabular hospital report: letterhead
  // + title + period + filters + the data table only. The dashboard UI keeps its
  // cards and charts; only the downloaded PDF is table-only.
  const { reportTitle, periodText, filterLines = [], headers, rows } = opts;
  const printed = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const filtersHtml = filterLines.length
    ? `<div class="filters">${filterLines.map(l => `<span>${esc(l)}</span>`).join("")}</div>` : "";
  const tableHtml =
    `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
    + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(reportTitle)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:"Segoe UI",Arial,sans-serif; font-size:11px; color:#1e293b; padding:14mm 12mm; }
    .letterhead { text-align:center; border-bottom:2px solid #00059f; padding-bottom:8px; margin-bottom:10px; }
    .hosp-name { font-size:20px; font-weight:800; color:#00059f; letter-spacing:0.5px; }
    .tagline { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:1px; }
    .addr { font-size:9px; color:#475569; margin-top:2px; }
    .report-title { text-align:center; font-size:15px; font-weight:700; margin:10px 0 2px; }
    .meta { text-align:center; font-size:9.5px; color:#64748b; margin-bottom:8px; }
    .filters { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-bottom:12px; }
    .filters span { font-size:9px; background:#eef2ff; color:#4338ca; border-radius:10px; padding:2px 8px; }
    table { width:100%; border-collapse:collapse; margin-top:4px; font-size:9.5px; table-layout:auto; }
    thead { display:table-header-group; }          /* repeat header on every printed page */
    tfoot { display:table-footer-group; }
    tr { page-break-inside:avoid; }                /* keep a row on one page */
    th { background:#eef2ff; border:1px solid #94a3b8; padding:5px 6px; text-align:left; font-weight:700; }
    td { border:1px solid #cbd5e1; padding:4px 6px; }
    tr:nth-child(even) td { background:#f8fafc; }
    tr:last-child td { font-weight:700; background:#e8eeff; }
    .footer { text-align:center; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; margin-top:16px; padding-top:6px; }
    /* @page margin:0 removes the browser's auto date/title header and blob URL footer.
       Page padding is applied to the body so content still has proper margins. */
    @media print { @page { size:A4; margin:0; } body { padding:12mm; } }
  </style></head><body>
    <div class="letterhead">
      <div class="hosp-name">${esc(HOSPITAL.fullName)}</div>
      <div class="tagline">${esc(HOSPITAL.tagline)}</div>
      <div class="addr">${esc(HOSPITAL.address)} &nbsp;|&nbsp; Ph: ${esc(HOSPITAL.phones.join(", "))}</div>
    </div>
    <div class="report-title">${esc(reportTitle)}</div>
    <div class="meta">${esc(periodText)} &nbsp;|&nbsp; Generated: ${esc(printed)}</div>
    ${filtersHtml}
    ${tableHtml}
    <div class="footer">Computer-generated report — ${esc(HOSPITAL.fullName)}, Chennai</div>
    <script>
      // Print from WITHIN the new tab so the parent app is never blocked by the
      // synchronous print() dialog. Trigger after paint; the tab stays open so the
      // user can re-print or close it themselves.
      window.addEventListener("load", function () {
        setTimeout(function () { window.focus(); window.print(); }, 300);
      });
    </script>
  </body></html>`;

  // Open a blank tab first, then write the document into it. We do NOT call
  // print() from the opener and we do NOT tie cleanup to the child's load event,
  // so the main application never freezes while the print/save dialog is open.
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) { alert("Please allow pop-ups to export the PDF."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Chart PNG ────────────────────────────────────────────────────────────────
export function downloadSvgAsPng(svgEl: SVGSVGElement | null, filename: string, scale = 2) {
  if (!svgEl) { alert("Chart not ready to export."); return; }
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const vb = svgEl.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svgEl.clientWidth || 600;
  const h = vb && vb.height ? vb.height : svgEl.clientHeight || 400;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const svgStr = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (blob) triggerDownload(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
    }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert("Could not render the chart image."); };
  img.src = url;
}

export function svgToString(svgEl: SVGSVGElement | null): string {
  if (!svgEl) return "";
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
