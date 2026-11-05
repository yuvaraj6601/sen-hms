/**
 * buildAdvanceReceiptHtml
 * ───────────────────────
 * Generates a standalone "rough amount" receipt for money collected during a
 * stay — an advance deposit, an interim settlement, or a refund. It is NOT a
 * bill and carries no line items. Mirrors the half-A4 payment-receipt layout.
 *
 * Supports split payments (e.g. ₹2,500 cash + ₹2,500 card): pass `splits`.
 */

export interface AdvanceReceiptSplit {
  mode: string;
  amount: number;
  ref?: string | null;
}

export interface AdvanceReceiptData {
  receiptNo: string;
  date: string;              // ISO date (or date-time)
  time?: string | null;
  patientId?: number | string | null;
  patientName: string;
  uhid: string;
  admissionNo?: string | null;
  ward?: string | null;
  bedNumber?: string | null;
  doctorName?: string | null;
  age?: number | null;
  gender?: string | null;
  /** Receipt total. Negative for a REFUND. */
  amount: number;
  /** ADVANCE | SETTLEMENT | REFUND */
  receiptType: string;
  paymentMode: string;       // single mode, or "MIXED" when splits present
  splits?: AdvanceReceiptSplit[] | null;
  referenceNo?: string | null;
  receivedBy?: string | null;
}

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
  UPI: "UPI", CHEQUE: "Cheque", INSURANCE: "Insurance", MIXED: "Mixed (Split)",
};

const TYPE_LABEL: Record<string, string> = {
  ADVANCE: "Advance", SETTLEMENT: "Settlement", REFUND: "Refund",
};

function fmtAmt(n: number): string {
  return Math.abs(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined, time?: string | null): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return time ? `${d} ${time}` : d;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const base = `${dd}-${mm}-${yyyy}`;
    return time ? `${base} ${time}` : base;
  } catch {
    return d;
  }
}

function numberToWords(n: number): string {
  n = Math.abs(n);
  if (n === 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function words(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + words(num % 100) : "");
    if (num < 100000) return words(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + words(num % 1000) : "");
    if (num < 10000000) return words(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + words(num % 100000) : "");
    return words(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + words(num % 10000000) : "");
  }
  const rupees = Math.floor(n);
  return words(rupees) + " Rupees Only";
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildAdvanceReceiptHtml(d: AdvanceReceiptData, origin: string): string {
  const leftLogo = `${origin}/images/sen-logo.png`;
  const rightLogo = `${origin}/images/nabh-seal.png`;

  const typeLabel = TYPE_LABEL[d.receiptType] ?? d.receiptType;
  const isRefund = d.receiptType === "REFUND" || d.amount < 0;

  const ptLine = [
    d.patientName.toUpperCase(),
    d.age ? `${d.age} Y` : "",
    d.gender ? d.gender.toUpperCase() : "",
  ].filter(Boolean).join("  ·  ");

  const ipLine = d.admissionNo || d.ward
    ? `${d.admissionNo ?? "—"}${d.ward ? "  ·  " + d.ward : ""}${d.bedNumber ? " / Bed " + d.bedNumber : ""}`
    : "";

  // Payment mode line — expand splits when MIXED.
  const splits = d.splits ?? [];
  const modeLine = splits.length > 0
    ? splits.map(s => `${MODE_LABEL[s.mode] ?? s.mode} ₹${fmtAmt(s.amount)}${s.ref ? " (" + esc(s.ref) + ")" : ""}`).join("  +  ")
    : (MODE_LABEL[d.paymentMode] ?? d.paymentMode) + (d.referenceNo ? " — Ref: " + esc(d.referenceNo) : "");

  const amountLabel = isRefund ? "Amount Refunded" : "Amount Received";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(typeLabel)} Receipt — ${esc(d.receiptNo)}</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:16px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    /* A5 landscape = 210mm wide × 148mm tall */
    .receipt{width:210mm;min-height:148mm;margin:auto;padding:8mm 12mm;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.2);}
    .header{display:grid;grid-template-columns:20% 60% 20%;align-items:center;border-bottom:2px solid #111;padding-bottom:6px;}
    .logo{max-width:110px;max-height:80px;object-fit:contain;}
    .header-left{display:flex;flex-direction:column;align-items:flex-start;justify-self:start;}
    .reg-no{font-size:9px;font-weight:600;margin-top:22px;white-space:nowrap;}
    .right-logo{justify-self:end;}
    .hospital-info{text-align:center;line-height:1.3;}
    .hospital-info h1{margin:0;font-size:22px;color:#242445;font-family:Georgia,"Times New Roman",serif;letter-spacing:.5px;}
    .hospital-info h2{margin:0 0 6px;font-size:14px;color:#242445;}
    .hospital-info p{margin:1px 0;font-size:10px;font-weight:600;}
    .title{text-align:center;margin:8px 0 2px;font-size:16px;font-weight:bold;letter-spacing:.5px;}
    .meta{display:flex;justify-content:space-between;font-weight:600;padding:6px 0;border-bottom:1px solid #111;}
    .rows{padding:8px 0;border-bottom:1px solid #111;}
    .row{display:grid;grid-template-columns:150px 12px 1fr;min-height:22px;align-items:start;font-weight:600;}
    .row .value{font-weight:normal;word-break:break-word;}
    .amount-box{display:flex;justify-content:space-between;align-items:center;margin:12px 0;padding:10px 14px;background:${isRefund ? "#fef2f2" : "#eef6ff"};-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1.5px solid ${isRefund ? "#ef4444" : "#0ea5e9"};border-radius:6px;}
    .amount-box .lbl{font-size:13px;font-weight:700;}
    .amount-box .amt{font-size:20px;font-weight:800;}
    .words{font-weight:600;margin-bottom:12px;}
    .footer{display:flex;justify-content:flex-start;margin-top:24px;}
    .received-by{font-weight:600;align-self:end;}
    .signature{text-align:right;align-self:end;}
    .signature .sig-line{margin-top:34px;font-weight:bold;border-top:1px solid #111;display:inline-block;padding-top:3px;min-width:150px;}
    .note{text-align:center;font-size:9px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px;}
    .print-btn{display:block;margin:14px auto;padding:8px 32px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;}
    @media print{
      body{padding:0;background:#fff;}
      .receipt{width:210mm;min-height:148mm;margin:0;padding:8mm 12mm;box-shadow:none;}
      .print-btn{display:none!important;}
      @page{size:A5 landscape;margin:0;}
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨&nbsp; Print / Save PDF</button>
  <div class="receipt">
    <div class="header">
      <div class="header-left">
        <img class="logo" src="${leftLogo}" alt="SEN Hospital Logo" onerror="this.style.display='none'">
        <div class="reg-no">(Regd. No. : CHENALL20210030927)</div>
      </div>
      <div class="hospital-info">
        <h1>SEN HOSPITAL</h1>
        <h2>MULTI - SPECIALITY CENTRE</h2>
        <p>New No.51, Old No. 18, Bunder Garden Street, Perambur, Chennai - 11.</p>
        <p>Tel : 25586896, 42769724 &nbsp;&nbsp; Cell : 9600899382, 7200207833</p>
        <p>Email : senhospital2@gmail.com &nbsp;&nbsp; www.senhospital.in</p>
      </div>
      <img class="logo right-logo" src="${rightLogo}" alt="NABH Seal" onerror="this.style.display='none'">
    </div>

    <div class="title">${esc(typeLabel.toUpperCase())} RECEIPT</div>

    <div class="meta">
      <span>Receipt No : ${esc(d.receiptNo)}</span>
      <span>Date : ${fmtDate(d.date, d.time)}</span>
    </div>

    <div class="rows">
      <div class="row"><b>${isRefund ? "Paid To" : "Received From"}</b><span>:</span><span class="value">${esc(ptLine)}</span></div>
      <div class="row"><b>Patient ID</b><span>:</span><span class="value">${esc(d.patientId ?? "—")}</span></div>
      <div class="row"><b>UHID</b><span>:</span><span class="value">${esc(d.uhid)}</span></div>
      ${ipLine ? `<div class="row"><b>IP No / Ward</b><span>:</span><span class="value">${esc(ipLine)}</span></div>` : ""}
      ${d.doctorName ? `<div class="row"><b>Consultant</b><span>:</span><span class="value">${esc(d.doctorName)}</span></div>` : ""}
      <div class="row"><b>Towards</b><span>:</span><span class="value">${esc(typeLabel)}${isRefund ? " (deposit returned)" : " deposit"}</span></div>
      <div class="row"><b>Payment Mode</b><span>:</span><span class="value">${modeLine}</span></div>
    </div>

    <div class="amount-box">
      <span class="lbl">${amountLabel}</span>
      <span class="amt">₹ ${fmtAmt(d.amount)}</span>
    </div>
    <div class="words">In Words : ${numberToWords(d.amount)}</div>

    <div class="footer">
      <div class="received-by">${isRefund ? "Refunded By" : "Received By"} : ${esc(d.receivedBy ?? "—")}</div>
    </div>

    <div class="note">
      This is a computer-generated ${esc(typeLabel.toLowerCase())} receipt. It is an advance / interim collection and will be adjusted against the final bill at discharge.
    </div>
  </div>
</body>
</html>`;
}
