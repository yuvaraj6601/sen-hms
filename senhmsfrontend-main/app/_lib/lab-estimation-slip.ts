import JsBarcode from "jsbarcode";
import { HOSPITAL } from "./hospital-config";

// ─── Lab Estimation Slip — modelled on the SEN Hospital OP receipt ─────────────

export interface LabEstimationTest {
  labId: string;
  testCode: string;
  investigationName: string;
  category?: string | null;
  price: number | null;
}

export interface LabEstimationSlipData {
  billNo:       string | null;   // bill number raised for the estimation
  uhid:         string;
  patientName:  string;
  age?:         number | null;
  gender?:      string | null;
  phone?:       string | null;
  patientType?: string | null;   // OP / IP
  doctorName?:  string | null;
  admissionId?: number | null;
  admissionNo?: string | null;
  orderedDate:  string;          // "YYYY-MM-DD"
  orderedTime?: string | null;   // "HH:mm"
  generatedBy?: string | null;
  tests:        LabEstimationTest[];
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
}

function formatTime(hhmm?: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function inr(n: number): string {
  return "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Number → words (Indian) for the amount-in-words line ──────────────────────
function amountInWords(num: number): string {
  const n = Math.round(num);
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (x: number): string => {
    if (x < 20) return ones[x];
    return tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  };
  const threeDigits = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
  };
  let words = "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore)    words += threeDigits(crore) + " Crore ";
  if (lakh)     words += twoDigits(lakh) + " Lakh ";
  if (thousand) words += twoDigits(thousand) + " Thousand ";
  if (rest)     words += threeDigits(rest);
  return words.trim();
}

function buildBarcodeDataUrl(value: string): string {
  if (!value || typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, { format: "CODE128", displayValue: false, width: 2, height: 44, margin: 0 });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

/**
 * Builds a print-ready Lab Estimation slip mirroring the hospital receipt layout.
 */
export function buildLabEstimationSlipHtml(d: LabEstimationSlipData): string {
  const dateStr = formatDate(d.orderedDate);
  const timeStr = formatTime(d.orderedTime);
  const dateTime = `${dateStr}${timeStr ? " " + timeStr : ""}`;
  const ageGender = (d.age != null || d.gender)
    ? `${d.age != null ? d.age : "—"} / ${(d.gender ?? "").toUpperCase()}`
    : "—";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}${HOSPITAL.logo}`;
  const barcodeDataUrl = buildBarcodeDataUrl(d.uhid);

  const total = d.tests.reduce((s, t) => s + (t.price ?? 0), 0);

  const rows = d.tests.map((t, i) => `
    <tr>
      <td class="c-sno">${i + 1}</td>
      <td class="c-test">
        <span class="t-name">${esc(t.investigationName)}</span>
        <span class="t-code">${esc(t.testCode)}${t.category ? " · " + esc(t.category) : ""}</span>
      </td>
      <td class="c-labid">${esc(t.labId)}</td>
      <td class="c-amt">${inr(t.price ?? 0)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>senhospital-lab-estimation-${esc(d.billNo ?? d.uhid)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      background: #e2e8f0;
      display: flex; align-items: flex-start; justify-content: center;
      min-height: 100vh; padding: 20px; color: #000;
    }
    .slip {
      background: #fff; width: 840px; padding: 18px 28px 16px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    }
    .head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 4px; }
    .head .logo { width: 160px; flex: 0 0 160px; text-align: left; }
    .head .logo img { max-width: 155px; max-height: 65px; object-fit: contain; }
    .head .center { flex: 1 1 auto; text-align: center; padding: 0 10px; }
    .head .spacer { width: 160px; flex: 0 0 160px; }
    .hosp-name { font-size: 28px; font-weight: 800; letter-spacing: 0.5px; line-height: 1.1; }
    .regd { font-size: 13px; font-weight: 700; margin-top: 1px; }
    .tagline { font-size: 22px; font-style: italic; font-family: "Brush Script MT", "Segoe Script", cursive; margin-top: 1px; }
    .contact { font-size: 12.5px; font-weight: 600; margin-top: 3px; line-height: 1.35; }
    .hr { border: 0; border-top: 1px solid #000; margin: 4px 0; }
    .slip-title { text-align: center; font-weight: 800; font-size: 17px; text-decoration: underline; padding: 2px 0; letter-spacing: 0.5px; }
    .token-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; margin-bottom: 2px; }
    .token-header { font-weight: 800; font-size: 15px; letter-spacing: 0.5px; }
    .barcode-box { text-align: center; }
    .barcode-img { height: 44px; max-width: 260px; object-fit: contain; }
    .info-table { width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.9; margin-top: 2px; }
    .info-table td { vertical-align: top; padding: 1px 0; }
    .lbl { font-weight: 800; white-space: nowrap; }
    .colon { padding: 0 8px 0 2px; font-weight: 800; }
    .val { font-weight: 700; }
    /* Line items */
    .items { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    .items thead th {
      background: #f1f5f9; border: 1px solid #000; padding: 5px 8px; text-align: left;
      font-weight: 800; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .items td { border: 1px solid #999; padding: 5px 8px; vertical-align: top; }
    .c-sno { width: 36px; text-align: center; font-weight: 700; }
    .c-labid { width: 150px; font-family: "Courier New", monospace; font-size: 12px; }
    .c-amt { width: 110px; text-align: right; font-weight: 700; white-space: nowrap; }
    .t-name { display: block; font-weight: 700; }
    .t-code { display: block; font-size: 11px; color: #475569; }
    .items .tot-row td { border: 1px solid #000; padding: 6px 8px; font-weight: 800; }
    .tot-lbl { text-align: right; text-transform: uppercase; letter-spacing: 0.3px; }
    .tot-amt { text-align: right; white-space: nowrap; font-size: 14px; }
    /* keep each line item (and the total row) from splitting across a page break */
    .items tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .words { margin-top: 8px; font-size: 13px; font-weight: 700; }
    .note { margin-top: 10px; font-size: 11.5px; font-style: italic; color: #334155; }
    .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 34px; font-size: 12.5px; font-weight: 700; }
    /* margin:0 on @page removes the browser-injected URL / date / page-number
       header & footer. The visual margin is restored via .slip padding. */
    @page { size: A4 portrait; margin: 0; }
    @media print {
      html, body { background: #fff; padding: 0; margin: 0; }
      .slip { border: none; box-shadow: none; width: 100%; padding: 10mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="head">
      <div class="logo"><img src="${logoUrl}" alt="SEN HOSPITAL" onerror="this.style.display='none'" /></div>
      <div class="center">
        <div class="hosp-name">SEN HOSPITAL</div>
        <div class="regd">(Regd. No. : ${esc(HOSPITAL.regdNo)})</div>
        <div class="tagline">Multi Speciality Centre</div>
        <div class="contact">
          Tel : ${esc(HOSPITAL.phones.slice(0, 2).join(", "))}, Cell : ${esc(HOSPITAL.phones.slice(2).join(", "))}<br />
          Email : ${esc(HOSPITAL.email)} &nbsp;&nbsp; Web : ${esc(HOSPITAL.website)}
        </div>
      </div>
      <div class="spacer"></div>
    </div>

    <hr class="hr" />
    <div class="slip-title">LAB ESTIMATION</div>
    <hr class="hr" />

    <div class="token-row">
      <div class="token-header">BILL NO : ${esc(d.billNo ?? "—")}</div>
      ${barcodeDataUrl ? `<div class="barcode-box"><img class="barcode-img" src="${barcodeDataUrl}" alt="${esc(d.uhid)}" /></div>` : ""}
    </div>

    <table class="info-table">
      <tr>
        <td style="width: 140px;"><span class="lbl">UHID</span></td>
        <td style="width: 15px;"><span class="colon">:</span></td>
        <td style="width: 260px;"><span class="val">${esc(d.uhid)}</span></td>
        <td style="width: 130px;"><span class="lbl">DATE</span></td>
        <td style="width: 15px;"><span class="colon">:</span></td>
        <td><span class="val">${esc(dateTime)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">PATIENT NAME</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc((d.patientName || "").toUpperCase())}</span></td>
        <td><span class="lbl">TYPE</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc((d.patientType ?? "").toUpperCase() || "—")}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">AGE/GENDER</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(ageGender)}</span></td>
        <td><span class="lbl">DOCTOR NAME</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.doctorName ?? "—")}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">CONTACT NO</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.phone || "—")}</span></td>
        <td><span class="lbl">${d.admissionNo || d.admissionId ? "ADMISSION NO" : "GENERATED BY"}</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.admissionNo ?? (d.admissionId != null ? String(d.admissionId) : (d.generatedBy ?? "—")))}</span></td>
      </tr>
      ${(d.admissionNo || d.admissionId) ? `
      <tr>
        <td><span class="lbl">GENERATED BY</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.generatedBy ?? "—")}</span></td>
        <td></td><td></td><td></td>
      </tr>` : ""}
    </table>

    <table class="items">
      <thead>
        <tr>
          <th class="c-sno">#</th>
          <th>Test</th>
          <th class="c-labid">Lab ID</th>
          <th class="c-amt" style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="tot-row">
          <td colspan="3" class="tot-lbl">Estimated Total</td>
          <td class="tot-amt">${inr(total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="words">Amount in Words : Rupees ${esc(amountInWords(total))} Only</div>
    <div class="note">* This is an estimated cost. Kindly pay at the reception to proceed with the test(s).</div>

    <div class="sign-row">
      <span>Patient / Attender</span>
      <span>Authorized Signatory</span>
    </div>
  </div>
</body>
</html>`;
}
