import JsBarcode from "jsbarcode";
import { HOSPITAL } from "./hospital-config";
import { isAgeBanded, formatAgeBandsHtml } from "./age-band";

/**
 * buildLabReportHtml
 * ──────────────────
 * Renders a print-ready A4 Lab Report that exactly matches the ZN Diagnostics
 * PDF layout with SEN Hospital branding:
 *
 *   Header:  logo left  |  hospital name + address right-aligned
 *   Patient: barcode top-right; flat 3-col info grid (Name / Age·Printed / Collection·Received·Released)
 *   Results: category title centred italic; Test : Result / Unit / Reference Range table
 *            method+specimen in italic small below each param row
 *   Footer:  Lab Incharge left | page centre | Medical Director right
 *            bottom bar: disclaimer + home-collection in red
 */

export interface LabReportTest {
  labId:             string;
  investigationName: string;
  category:          string;
  /** Panel/test name band. Omit for flat tests. */
  testName?:  string | null;
  /** Sub-group header (e.g. DIFFERENTIAL COUNT:). Params under it are indented. */
  subGroup?:  string | null;
  result:     string | null;
  unit:       string | null;
  normalRange: string | null;
  abnormal:   boolean;
  /** Optional method string shown in italic small below the param row. */
  method?:    string | null;
  /** Optional specimen string shown in italic small below the param row. */
  specimen?:  string | null;
}

export interface LabReportData {
  uhid:            string;
  patientName:     string;
  age:             number | null;
  gender:          string | null;
  doctorName:      string | null;
  labTestId:       string | null;
  ipNumber:        string | null;
  sampleCollected: string | null;
  reportCompleted: string | null;
  /** Printed date/time — defaults to current time if not supplied. */
  printed?:        string | null;
  tests:           LabReportTest[];
  labIncharge?:    string | null;
  labTechnician?:  string | null;
  medicalDirector?: string | null;
  /** Hide the code-drawn header; leave blank space for pre-printed letterhead. */
  letterheadMode?:  boolean;
  letterheadSpace?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBarcodeDataUrl(value: string): string {
  if (!value || typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128", displayValue: false, width: 1.4, height: 32, margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch { return ""; }
}

function formatNormalRange(range: string | null, patientAge?: number | null): string {
  const r = (range ?? "").trim();
  if (!r) return "&nbsp;";
  if (isAgeBanded(r)) return formatAgeBandsHtml(r, patientAge ?? null);

  const maleMatch   = r.match(/(?:male|^m\b|\bm[:\s])\s*[:\-]?\s*([^/|;]+?)(?=(?:female|\bf\b|\bf[:\s])|$)/i);
  const femaleMatch = r.match(/(?:female|\bf\b|\bf[:\s])\s*[:\-]?\s*([^/|;]+)/i);
  if (maleMatch && femaleMatch) {
    const male   = maleMatch[1].trim().replace(/[,:;/|]+$/, "");
    const female = femaleMatch[1].trim().replace(/[,:;/|]+$/, "");
    return `<span class="nv-line"><span class="nv-sex">Male</span> : ${esc(male)}</span>`
         + `<span class="nv-line"><span class="nv-sex">Female</span> : ${esc(female)}</span>`;
  }
  if (r.includes("\n")) {
    return r.split("\n").map(l => `<span class="nv-line">${esc(l.trim())}</span>`).join("");
  }
  return esc(r);
}

// ── C&S antibiogram ───────────────────────────────────────────────────────────

function isCsResult(result: string | null): boolean {
  const t = (result ?? "").trim();
  return t.startsWith("{") && t.includes('"organism"');
}

function renderCsRow(t: LabReportTest): string {
  let parsed: {
    organism?: string; colonyCount?: string; gramStain?: string;
    antibiotics?: { name: string; sensitivity: string }[];
    comment?: string;
  } = {};
  try { if (t.result) parsed = JSON.parse(t.result); } catch { return ""; }

  const abRows = (parsed.antibiotics ?? [])
    .filter(a => a.name)
    .map(a => {
      const s   = (a.sensitivity ?? "").toUpperCase();
      const cls = s === "S" ? "ab-s" : s === "R" ? "ab-r" : s === "I" ? "ab-i" : "";
      return `<tr><td class="ab-name">${esc(a.name)}</td><td class="ab-val ${cls}">${esc(s || "—")}</td></tr>`;
    }).join("");

  return `<tr>
    <td colspan="5" class="cs-cell">
      <table class="cs-table">
        <tr>
          <td class="cs-lbl">Organism</td><td class="cs-val">${esc(parsed.organism || "—")}</td>
          <td class="cs-lbl">Colony Count</td><td class="cs-val">${esc(parsed.colonyCount || "—")}</td>
        </tr>
        ${parsed.gramStain ? `<tr><td class="cs-lbl">Gram Stain</td><td class="cs-val" colspan="3">${esc(parsed.gramStain)}</td></tr>` : ""}
        ${abRows ? `<tr><td colspan="4" class="cs-ab-head">Antibiotic Sensitivity</td></tr>
        <tr><td colspan="4" style="padding:0">
          <table class="ab-table">
            <thead><tr><th class="ab-hdr-name">Antibiotic</th><th class="ab-hdr-val">Sensitivity</th></tr></thead>
            <tbody>${abRows}</tbody>
          </table>
        </td></tr>` : ""}
        ${parsed.comment ? `<tr><td class="cs-lbl">Comment</td><td class="cs-val" colspan="3">${esc(parsed.comment)}</td></tr>` : ""}
      </table>
    </td>
  </tr>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function buildCss(lhSpace: string): string {
  return `
/* ── reset ── */
@page { size: A4 portrait; margin: 8mm 6mm 8mm 6mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report {
  width: 100%;
  max-width: 210mm;
  min-height: 281mm;
  margin: 0 auto;
}
.letterhead-space { height: ${lhSpace}; }

/* ── HEADER ── */
.report-header {
  display: flex;
  align-items: center;
  padding: 2mm 0 1mm;
  border-bottom: 2px solid #c76b6b;
  gap: 3mm;
}
.logo-area {
  flex-shrink: 0;
  width: 42mm;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}
.company-logo { width: 42mm; height: 42mm; object-fit: contain; }
.company-info {
  flex: 1;
  text-align: right;
  color: #171044;
  line-height: 1.3;
}
.company-name {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: bold;
  font-size: 17pt;
  line-height: 1.15;
  white-space: nowrap;
  margin-bottom: 0.5mm;
}
.company-tagline {
  font-size: 8.5pt;
  font-style: italic;
  color: #a44c4c;
}
.company-unit { font-size: 11pt; font-weight: 500; }
.company-address { font-size: 9.5pt; margin-top: 1mm; }

/* ── PATIENT SECTION ── */
.patient-section { padding: 1mm 1mm 1mm; }

/* barcode sits top-right above the patient grid */
.barcode-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 1mm;
}
.barcode-image { width: 46mm; height: 10mm; object-fit: fill; }
.barcode-number { font-size: 7pt; text-align: right; width: 46mm; letter-spacing: 0.5px; }

/* flat patient info grid — mirrors ZN: Name row, then 3-col row */
.patient-name-row {
  display: grid;
  grid-template-columns: 25mm 5mm 1fr;
  align-items: baseline;
  font-size: 10.5pt;
  font-weight: bold;
  min-height: 7mm;
  line-height: 1.3;
}
.patient-name-row .val { font-weight: bold; }

/* 3-column info row: Left | Middle | Right */
.patient-info-grid {
  display: grid;
  grid-template-columns: 32% 28% 40%;
  column-gap: 0;
  align-items: start;
}
.patient-column { min-width: 0; }
.info-row {
  display: grid;
  grid-template-columns: 25mm 5mm minmax(0, 1fr);
  align-items: baseline;
  min-height: 6.5mm;
  font-size: 10pt;
  line-height: 1.3;
}
/* Right column labels are longer — needs wider label column */
.patient-column:last-child .info-row {
  grid-template-columns: 34mm 5mm minmax(0, 1fr);
}
.info-label { font-weight: bold; white-space: nowrap; }
.info-colon { font-weight: bold; }
.info-value { overflow-wrap: anywhere; }

/* ── CATEGORY TITLE ── */
.report-title {
  margin: 2mm 0 0;
  border-top: 1.5px solid #555;
  border-bottom: 1.5px solid #555;
  text-align: center;
  padding: 1.5mm 0;
  font-size: 12pt;
  font-weight: bold;
  font-style: italic;
  text-transform: uppercase;
}

/* ── RESULTS TABLE ── */
.results-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 1mm;
}
.results-table col.test-col   { width: 36%; }
.results-table col.colon-col  { width:  4%; }
.results-table col.result-col { width: 12%; }
.results-table col.unit-col   { width: 17%; }
.results-table col.range-col  { width: 31%; }

/* thead — completely borderless, plain labels */
.results-table thead th {
  font-weight: normal;
  font-size: 10.5pt;
  text-align: left;
  padding: 1mm 0 1mm;
  border: none;
  background: transparent;
}
/* Result header aligns over the result value cell — no extra padding */
.results-table thead th.th-result { padding-left: 0; }
/* NO border on thead tr — separator is provided by .report-title border-bottom */
.results-table thead tr { border: none; }

/* all body cells */
.results-table tbody td {
  vertical-align: top;
  padding: 0.8mm 0;
  font-size: 10.5pt;
  overflow-wrap: anywhere;
  line-height: 1.35;
}

/* colon column */
.td-colon  { text-align: center; color: #333; padding-left: 0; padding-right: 0; }
.td-result { font-weight: bold; white-space: nowrap; }

/* range */
.td-range { font-size: 9.5pt; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

/* method / specimen annotation rows */
.annotation-row td {
  font-size: 7.5pt;
  font-style: italic;
  padding: 0 0 0.5mm;
  line-height: 1.25;
  color: #333;
}

/* panel-head (testName) — bold centred, no underline */
.panel-head-row td {
  text-align: center;
  font-weight: bold;
  font-size: 11pt;
  text-transform: uppercase;
  padding: 2mm 0 1mm;
  border-top: 1px dashed #bbb;
}
tbody tr.panel-head-row:first-child td { border-top: none; }

/* subgroup header */
.subgroup-row td {
  font-weight: bold;
  font-size: 10.5pt;
  text-decoration: underline;
  text-transform: uppercase;
  padding: 2mm 0 1mm;
}

/* indented param */
.param-row.indented td.td-name { padding-left: 5mm; }

/* male/female ranges */
.nv-line { display: block; }
.nv-sex  { display: inline-block; min-width: 50px; font-weight: 700; }

/* age-banded */
.nv-age-head   { font-weight: 700; font-style: italic; }
.nv-age-lbl    { display: inline-block; min-width: 120px; }
.nv-age-active {
  font-weight: 800;
  background: #fff9c4;
  border-radius: 2px;
  padding: 0 2px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* C&S */
.cs-cell { padding: 4px 0; }
.cs-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.cs-lbl { font-weight: 700; padding: 2px 6px 2px 0; width: 110px; vertical-align: top; color: #555; }
.cs-val { padding: 2px 10px 2px 0; vertical-align: top; }
.cs-ab-head { font-weight: 700; font-size: 10px; text-transform: uppercase; padding: 5px 0 2px; }
.ab-table { width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 10pt; }
.ab-hdr-name, .ab-hdr-val {
  background: #e8e8e8;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  padding: 2px 6px; font-weight: 700; border: 1px solid #ccc;
}
.ab-hdr-name { width: 65%; }
.ab-hdr-val  { width: 35%; }
.ab-name { padding: 2px 6px; border: 1px solid #e0e0e0; }
.ab-val  { padding: 2px 6px; border: 1px solid #e0e0e0; font-weight: 700; text-align: center; }
.ab-s { background: #d1fae5; color: #065f46; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ab-r { background: #fee2e2; color: #991b1b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ab-i { background: #fef3c7; color: #92400e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ── SIGNATURES ── */
.report-footer { margin: 4mm 0 0; }
.footer-signatures {
  display: grid;
  grid-template-columns: 1fr 0.7fr 1fr;
  align-items: end;
  gap: 4mm;
  min-height: 22mm;
}
.signature-block { font-size: 9pt; line-height: 1.2; }
.sig-right { text-align: right; }
.signature-image {
  display: block;
  width: 26mm;
  height: 12mm;
  object-fit: contain;
  object-position: left bottom;
  margin-bottom: 1mm;
}
.sig-right .signature-image { object-position: right bottom; margin-left: auto; }
.page-number { text-align: center; font-size: 10pt; margin-top: 1mm; }

/* ── BOTTOM FOOTER ── */
.footer-bottom {
  border-top: 2px solid #c76b6b;
  margin-top: 2mm;
  padding-top: 1mm;
  text-align: center;
  font-size: 8pt;
  line-height: 1.3;
}
.home-collection {
  color: #bd4545;
  font-size: 11pt;
  font-weight: bold;
  letter-spacing: 0.2px;
}

@media print {
  body { background: #fff; }
  .report { width: 100%; max-width: none; min-height: 0; padding-bottom: 38mm; }
  .no-print { display: none !important; }
  .results-table tr { break-inside: avoid; page-break-inside: avoid; }
  .report-header, .patient-section, .report-title { break-inside: avoid; }
  /* Pin footer to bottom of every printed page */
  .report-footer {
    position: fixed;
    bottom: 0;
    left: 6mm;
    right: 6mm;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
@media screen and (max-width: 700px) {
  .report-header { align-items: flex-start; }
  .company-logo  { width: 18mm; height: 18mm; }
  .company-name  { font-size: 12pt; white-space: normal; }
  .patient-info-grid { grid-template-columns: 1fr; }
  .info-row { grid-template-columns: 28mm 5mm 1fr; }
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildLabReportHtml(d: LabReportData): string {
  const origin     = typeof window !== "undefined" ? window.location.origin : "";
  const logoSrc    = `${origin}${HOSPITAL.logo}`;
  const barcode    = buildBarcodeDataUrl(d.uhid);
  const letterhead = d.letterheadMode  ?? false;
  const lhSpace    = d.letterheadSpace ?? "5.5cm";
  const ageGender  = `${d.age != null ? d.age + " Yrs." : "—"} / ${(d.gender ?? "").toUpperCase() || "—"}`;

  const labIncharge     = esc(d.labIncharge     ?? HOSPITAL.labSignatories.labIncharge);
  const medicalDirector = esc(d.medicalDirector ?? HOSPITAL.labSignatories.medicalDirector);

  // Printed time — use supplied value or fall back to current local time
  const printedStr = (() => {
    if (d.printed) return d.printed;
    const now  = new Date();
    const dd   = String(now.getDate()).padStart(2, "0");
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh   = now.getHours();
    const min  = String(now.getMinutes()).padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    return `${dd}-${mm}-${yyyy} ${hh % 12 || 12}:${min}${ampm}`;
  })();

  // ── Group by category, first-seen order ─────────────────────────────────────
  const categoryGroups = new Map<string, LabReportTest[]>();
  for (const t of d.tests) {
    const key = (t.category || "GENERAL").toUpperCase();
    if (!categoryGroups.has(key)) categoryGroups.set(key, []);
    categoryGroups.get(key)!.push(t);
  }

  // ── Single param row ─────────────────────────────────────────────────────────
  function renderParamRow(t: LabReportTest, indented: boolean): string {
    if (isCsResult(t.result)) return renderCsRow(t);

    const resultHtml = t.result ? esc(t.result).replace(/\n/g, "<br>") : "&nbsp;";
    const rangeHtml  = formatNormalRange(t.normalRange, d.age);
    const indCls     = indented ? " indented" : "";

    const methodRow = t.method
      ? `<tr class="annotation-row"><td colspan="5">Method: ${esc(t.method)}</td></tr>` : "";
    const specimenRow = t.specimen
      ? `<tr class="annotation-row"><td colspan="5">Specimen: ${esc(t.specimen)}</td></tr>` : "";

    return `<tr class="param-row${indCls}">
      <td class="td-name">${esc(t.investigationName)}</td>
      <td class="td-colon">:</td>
      <td class="td-result">${resultHtml}</td>
      <td class="td-unit">${esc(t.unit) || "&nbsp;"}</td>
      <td class="td-range">${rangeHtml}</td>
    </tr>${methodRow}${specimenRow}`;
  }

  // ── One category section ─────────────────────────────────────────────────────
  function renderSection(category: string, tests: LabReportTest[]): string {
    let currentTestName: string | null = null;
    let currentSub:      string | null = null;
    let firstPanel = true;

    const bodyRows = tests.map(t => {
      const tn  = (t.testName ?? "").trim();
      const sub = (t.subGroup ?? "").trim();
      let out = "";

      if (tn && tn.toUpperCase() !== category && tn !== currentTestName) {
        currentTestName = tn;
        currentSub = null;
        const style = firstPanel ? "" : ` style="border-top:1px dashed #bbb"`;
        out += `<tr class="panel-head-row"><td colspan="5"${style}>${esc(tn)}</td></tr>`;
        firstPanel = false;
      } else if (!tn) {
        currentTestName = null;
      }

      if (sub && sub !== currentSub) {
        currentSub = sub;
        out += `<tr class="subgroup-row"><td colspan="5">${esc(sub)}</td></tr>`;
      } else if (!sub) {
        currentSub = null;
      }

      out += renderParamRow(t, !!sub);
      return out;
    }).join("");

    return `
      <div class="report-title">${esc(category)}</div>
      <table class="results-table">
        <colgroup>
          <col class="test-col">
          <col class="colon-col">
          <col class="result-col">
          <col class="unit-col">
          <col class="range-col">
        </colgroup>
        <thead>
          <tr>
            <th colspan="2">Test</th>
            <th>Result</th>
            <th>Unit</th>
            <th>Reference Range</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  const sectionsHtml = Array.from(categoryGroups.entries())
    .map(([cat, tests]) => renderSection(cat, tests))
    .join("\n");

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerHtml = letterhead
    ? `<div class="letterhead-space"></div>`
    : `<header class="report-header">
        <div class="logo-area">
          <img class="company-logo" src="${logoSrc}" alt="SEN Hospital Logo"
               onerror="this.style.display='none'">
        </div>
        <div class="company-info">
          <div class="company-name">SEN HOSPITAL</div>
          <div class="company-tagline">MULTI – SPECIALITY CENTRE</div>
          <div class="company-unit">(Regd. No. : ${esc(HOSPITAL.regdNo)})</div>
          <div class="company-address">
            ${esc(HOSPITAL.address)}<br>
            Telephone : ${esc(HOSPITAL.phones.slice(0, 2).join(" / "))}
            &nbsp;&nbsp; Cell : ${esc(HOSPITAL.phones.slice(2).join(" / "))}<br>
            Email : ${esc(HOSPITAL.email)}
          </div>
        </div>
      </header>`;

  // ── Patient info — matches ZN exactly:
  //   row 1: barcode top-right (full width flex)
  //   row 2: Name (full row)
  //   row 3: 3-col grid — [Patient ID | Age/Sex + Printed | Sample Collection + Received + Released]
  const barcodeHtml = barcode
    ? `<img class="barcode-image" src="${barcode}" alt="${esc(d.uhid)}">`
    : `<div class="barcode-image" style="border:1px dashed #ccc;opacity:.3;"></div>`;

  const patientBox = `
    <section class="patient-section">
      <div class="barcode-area">
        ${barcodeHtml}
        <div class="barcode-number">${esc(d.uhid)}</div>
      </div>

      <div class="patient-name-row">
        <span class="info-label">Name</span>
        <span class="info-colon">:</span>
        <span class="val">${esc(d.patientName.toUpperCase())}</span>
      </div>

      <div class="patient-info-grid">
        <div class="patient-column">
          <div class="info-row">
            <span class="info-label">Patient ID</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(d.uhid)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ref. By</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(d.doctorName ?? "Self")}</span>
          </div>
        </div>

        <div class="patient-column">
          <div class="info-row">
            <span class="info-label">Age / Sex</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(ageGender)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Printed</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(printedStr)}</span>
          </div>
        </div>

        <div class="patient-column">
          <div class="info-row">
            <span class="info-label">Sample Collection</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(d.sampleCollected ?? "—")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sample Received</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(d.sampleCollected ?? "—")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report Released</span>
            <span class="info-colon">:</span>
            <span class="info-value">${esc(d.reportCompleted ?? "—")}</span>
          </div>
        </div>
      </div>
    </section>`;

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerHtml = `
    <footer class="report-footer">
      <div class="footer-signatures">
        <div class="signature-block">
          <div class="signature-name">${labIncharge}</div>
          <div class="signature-role">Lab Incharge</div>
        </div>
        <div style="text-align:center;">
          <div class="page-number">Lab Report</div>
        </div>
        <div class="signature-block sig-right">
          <div class="signature-name">${medicalDirector}</div>
          <div class="signature-role">Medical Director</div>
        </div>
      </div>
      <div class="footer-bottom">
        <div>**This is a computer-generated laboratory report. The results pertain to the sample received.</div>
        <div class="home-collection">
          FOR HOME COLLECTION : ${esc(HOSPITAL.phones[2] ?? "")} / ${esc(HOSPITAL.phones[3] ?? "")}
        </div>
      </div>
    </footer>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lab Report — ${esc(d.labTestId ?? d.uhid)}</title>
<style>${buildCss(lhSpace)}</style>
</head>
<body>
<div class="report">
  ${headerHtml}
  ${patientBox}
  ${sectionsHtml}
  ${footerHtml}
</div>
</body>
</html>`;
}
