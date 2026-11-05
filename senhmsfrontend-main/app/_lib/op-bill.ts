/**
 * Shared OP Bill HTML builder — used by both the OP Token Queue page
 * and the Bills page when printing an outpatient receipt.
 */
import { HOSPITAL } from "./hospital-config";
import { printHtml } from "./print";

export interface OPBillData {
  billNo:      string;
  billDate:    string;
  billTime?:   string;   // bill generation time (defaults to now when omitted)
  visitNo:     string;
  tokenNo:     string;
  uhid:        string;
  patientName: string;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  doctorName:  string;
  department:  string | null;
  address?:    string | null;   // patient's postal address (optional)
  items:       { description: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  totalAmount: number;
  paidAmount:  number;
  payMode:     string;
  preparedBy:  string;
  referredBy?: string;
  regType?:    string | null;   // Consultation / X-Ray / Review / Physiotherapy / Others
}

/** Human-readable Reg Type label from the backend enum value. */
function regTypeLabelBill(v?: string | null): string {
  switch ((v ?? "").toUpperCase()) {
    case "CONSULTATION":  return "Consultation";
    case "XRAY":          return "X-Ray";
    case "REVIEW":        return "Review";
    case "PHYSIOTHERAPY": return "Physiotherapy";
    case "OTHERS":        return "Others";
    default:              return v ? v : "";
  }
}

/** Escape a value for safe insertion into the bill HTML. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numWordsOPBill(n: number): string {
  if (n === 0) return "Zero Only";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function b100(x: number): string { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? "-"+ones[x%10] : ""); }
  function b1000(x: number): string { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+b100(x%100):""); }
  const r = Math.floor(n);
  const parts: string[] = [];
  const cr = Math.floor(r/10000000); const lk = Math.floor((r%10000000)/100000);
  const th = Math.floor((r%100000)/1000); const rm = r%1000;
  if (cr) parts.push(b1000(cr)+" Crore");
  if (lk) parts.push(b1000(lk)+" Lakh");
  if (th) parts.push(b1000(th)+" Thousand");
  if (rm) parts.push(b1000(rm));
  return parts.join(" ") + " Only";
}

export function buildOPBillHtml(d: OPBillData): string {
  const origin   = typeof window !== "undefined" ? window.location.origin : "";
  const leftLogo = `${origin}${HOSPITAL.logo}`;
  const sealUrl  = `${origin}${HOSPITAL.seal}`;
  const inr2 = (n: number) => (n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const disc     = d.items.reduce((s,i) => s + i.discount, 0);
  // Gross subtotal (before any discount) = sum of each line's qty × rate. The
  // Amount column shows this gross per line; the overall discount is then shown
  // once as a summary row, so individual lines never read as 0 after a full
  // bill-level discount.
  const grossOf  = (it: OPBillData["items"][number]) => it.quantity * it.unitPrice;
  const subTotal = d.items.reduce((s,i) => s + grossOf(i), 0);
  const regType  = regTypeLabelBill(d.regType);

  // Split the token (e.g. "CON-171026-005") into the code part ("CON-171026")
  // shown as a small label, and the trailing sequence ("05") shown large.
  const tokenMatch = /^(.*)-(\d+)$/.exec((d.tokenNo ?? "").trim());
  const tokenCode  = tokenMatch ? tokenMatch[1] : (d.tokenNo ?? "");
  const tokenSeq   = tokenMatch ? String(parseInt(tokenMatch[2], 10)).padStart(2, "0") : "";

  // Bill time defaults to the moment the bill is generated (not the OP token
  // time). Callers may still pass an explicit billTime (e.g. reprint).
  const billTime = (d.billTime && d.billTime.trim())
    ? d.billTime.trim()
    : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const patientLine = `${esc(d.patientName.toUpperCase())}${d.age ? " , " + d.age : ""}${d.gender ? " / " + esc(d.gender.toUpperCase()) : ""}`;
  const addressLine = (d.address && d.address.trim()) ? esc(d.address.trim()) : "—";
  const phoneLine   = d.phone ? esc(d.phone) : "—";

  const itemRows = d.items.map((it, idx) => `
    <tr>
      <td class="sno">${idx+1}</td>
      <td class="desc">${esc(it.description.toUpperCase())}</td>
      <td class="qty">${it.quantity}</td>
      <td class="rate">${inr2(it.unitPrice)}</td>
      <td class="amount">${inr2(grossOf(it))}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Outpatient Bill — ${esc(d.billNo)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #e2e8f0; font-family: Arial, Helvetica, sans-serif; color: #000; display: flex; align-items: flex-start; justify-content: center; min-height: 100vh; padding: 20px; }
        .slip { width: 840px; background: #fff; padding: 12px 28px 12px; border: 1px solid #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
        /* ── Letterhead Header ── */
        .head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 2px; }
        .head .logo { width: 220px; flex: 0 0 220px; text-align: left; }
        .head .logo img { max-width: 160px; max-height: 72px; object-fit: contain; }
        .head .center { flex: 1 1 auto; text-align: center; padding: 0 10px; }
        .head .spacer { width: 100px; flex: 0 0 100px; text-align: right; }
        .head .spacer img { max-width: 95px; max-height: 72px; object-fit: contain; }
        .hosp-name { font-family: "Times New Roman", Georgia, serif; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; line-height: 1.1; color: #000; }
        .regd { font-family: "Times New Roman", Georgia, serif; font-size: 12px; font-weight: 700; margin-top: 1px; }
        .tagline { font-size: 18px; font-style: italic; font-family: "Brush Script MT", "Segoe Script", "Dancing Script", cursive; margin-top: 1px; color: #111; }
        .contact { font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 600; margin-top: 2px; line-height: 1.3; }
        /* ── Dividers & Title ── */
        .hr { border: 0; border-top: 1px solid #71717a; margin: 3px 0; }
        .bill-title { text-align: center; font-weight: 700; font-size: 15px; font-family: Arial, Helvetica, sans-serif; padding: 1px 0; }
        /* ── Patient & Bill Details Grid ── */
        .patient-info { padding: 2px 0; font-size: 12px; line-height: 1.45; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { padding: 1px 0; vertical-align: middle; }
        .lbl { font-weight: 400; color: #111; white-space: nowrap; }
        .colon { padding: 0 6px 0 2px; font-weight: 400; }
        .val { font-weight: 700; color: #000; }
        .token-cell { text-align: right; white-space: nowrap; vertical-align: top; }
        /* Token: full code as a small label on top, large sequence number below. */
        .token-code { font-size: 12px; font-weight: 700; color: #000; }
        .token-code .lbl { font-weight: 400; }
        .token-seq {
            font-size: 34px;
            font-weight: 800;
            line-height: 1;
            color: #000;
            margin-top: 2px;
        }
        /* ── barcode (commented out for now) ──
        .barcode-cell { text-align: right; vertical-align: middle; }
        .barcode-img { height: 38px; max-width: 165px; }
        */
        /* ── Items Table ── */
        .charges-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
        .charges-table th { background-color: #d1d5db; color: #000; font-weight: 700; font-size: 12px; padding: 4px 8px; border: none; }
        .charges-table th.sno { width: 45px; text-align: left; }
        .charges-table th.desc { text-align: left; }
        .charges-table th.qty { width: 60px; text-align: right; }
        .charges-table th.rate { width: 90px; text-align: right; }
        .charges-table th.amount { width: 100px; text-align: right; }
        .charges-table td { padding: 3px 8px; font-size: 12px; color: #000; border: none; }
        .charges-table td.sno { text-align: left; }
        .charges-table td.desc { text-align: left; }
        .charges-table td.qty { text-align: right; }
        .charges-table td.rate { text-align: right; }
        .charges-table td.amount { text-align: right; font-weight: 400; }
        .charges-table tr.summary-tr td { padding: 2px 8px; font-size: 12px; }
        .charges-table td.summary-label { text-align: right; font-weight: 400; }
        .charges-table td.summary-val { text-align: right; font-weight: 600; }
        .charges-table tr.bill-amount-tr td { background-color: #d1d5db; padding: 4px 8px; }
        .charges-table td.bill-amount-label { text-align: right; font-weight: 700; font-size: 12px; }
        .charges-table td.bill-amount-val { text-align: right; font-weight: 700; font-size: 13px; }
        .charges-table tr.pay-row-tr td { padding: 4px 8px 3px 8px; font-size: 12px; }
        .charges-table td.pay-mode-td { text-align: left; }
        .charges-table td.paid-label { text-align: right; font-weight: 700; font-size: 12px; }
        .charges-table td.paid-val { text-align: right; font-weight: 700; font-size: 13px; }
        /* ── Payment & Footer ── */
        .payment-info { padding: 3px 0 2px 0; font-size: 12px; }
        .pay-row { display: flex; justify-content: space-between; align-items: center; padding: 1px 0; }
        .prep-sign-row { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 0 2px 0; font-size: 12px; }
        /* Default the paper to A5 landscape so the print dialog pre-selects it.
           margin:0 keeps the browser from injecting its own header/footer
           (URL, date/time, title) into a margin band. */
        @page { size: A5 landscape; margin: 0; }
        /* Keep rows and the totals/footer intact across page breaks so nothing
           splits mid-row. If the services list overflows one A5 page, the rows
           flow onto page 2 while the summary + Prepared-By block stay together. */
        .charges-table tr { page-break-inside: avoid; }
        .charges-table tfoot { page-break-inside: avoid; }
        .payment-info { page-break-inside: avoid; }
        /* Print styles */
        @media print {
            body { background: #fff; padding: 0; }
            .slip { border: none; box-shadow: none; width: 100%; padding: 3mm 6mm; }
            .charges-table thead { display: table-header-group; }
            .charges-table tfoot { display: table-footer-group; }
        }
    </style>
</head>
<body>
    <div class="slip">
        <!-- Letterhead Header -->
        <div class="head">
            <div class="logo">
                <img src="${leftLogo}" alt="SEN HOSPITAL" onerror="this.style.display='none'" />
            </div>
            <div class="center">
                <div class="hosp-name">SEN HOSPITAL</div>
                <div class="regd">(Regd. No. : ${esc(HOSPITAL.regdNo)})</div>
                <div class="tagline">Multi Speciality Centre</div>
                <div class="contact">
                    Tel : ${esc(HOSPITAL.phones.slice(0, 2).join(", "))}, Cell : ${esc(HOSPITAL.phones.slice(2).join(", "))}<br />
                    Email : ${esc(HOSPITAL.email)} &nbsp;&nbsp; Web : ${esc(HOSPITAL.website)}
                </div>
            </div>
            <div class="spacer">
                <img src="${sealUrl}" alt="NABH" onerror="this.style.display='none'" />
            </div>
        </div>

        <hr class="hr" />
        <div class="bill-title">Outpatient Bill</div>
        <hr class="hr" />

        <!-- Patient & Bill Details -->
        <div class="patient-info">
            <table class="info-table">
                <tr>
                    <td style="width: 44%;">
                        <span class="lbl">Bill No</span><span class="colon">:</span><span class="val">${esc(d.billNo)}</span><br />
                        <span class="lbl">Date</span><span class="colon">:</span><span class="val">${esc(d.billDate)} ${esc(billTime)}</span>
                    </td>
                    <td style="width: 38%;">
                        <span class="lbl">Outpatient No</span><span class="colon">:</span><span class="val">${esc(d.visitNo)}</span>
                    </td>
                    <td class="token-cell" style="width: 18%;">
                        <div class="token-code"><span class="lbl">Token No :</span> ${esc(tokenCode)}</div>
                        ${tokenSeq ? `<div class="token-seq">${esc(tokenSeq)}</div>` : ""}
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="lbl">UHID</span><span class="colon">:</span><span class="val">${esc(d.uhid)}</span>
                    </td>
                    <td colspan="2">
                        <span class="lbl">Consultant</span><span class="colon">:</span><span class="val">${esc(d.doctorName.toUpperCase())}${d.department ? " — " + esc(d.department) : ""}</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="lbl">Reg Type</span><span class="colon">:</span><span class="val">${esc(regType || "—")}</span>
                    </td>
                    <td colspan="2">
                        <span class="lbl">Referred By</span><span class="colon">:</span><span class="val">${esc(d.referredBy || "Self")}</span>
                    </td>
                </tr>
            </table>

            <hr class="hr" style="margin: 4px 0;" />

            <table class="info-table">
                <tr>
                    <td style="width: 62%;">
                        <span class="lbl">Patient Name</span><span class="colon">:</span><span class="val">${patientLine}</span>
                    </td>
                    <td style="width: 38%;">
                        <span class="lbl">Phone</span><span class="colon">:</span><span class="val">${phoneLine}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Address</span><span class="colon">:</span><span class="val" style="font-weight: 600;">${addressLine}</span>
                    </td>
                </tr>
            </table>
        </div>

        <hr class="hr" style="margin: 4px 0;" />

        <!-- Charges Table -->
        <table class="charges-table">
            <thead>
                <tr>
                    <th class="sno">S.No</th>
                    <th class="desc">Description</th>
                    <th class="qty">Qty</th>
                    <th class="rate">Rate</th>
                    <th class="amount">Amount</th>
                </tr>
            </thead>
            <tbody id="itemsBody">
                ${itemRows}
            </tbody>
            <tfoot>
                ${disc > 0 ? `
                <tr class="summary-tr">
                    <td colspan="4" class="summary-label">Sub Total :</td>
                    <td class="summary-val">${inr2(subTotal)}</td>
                </tr>
                <tr class="summary-tr">
                    <td colspan="4" class="summary-label">Discount :</td>
                    <td class="summary-val">- ${inr2(disc)}</td>
                </tr>` : ""}
                <tr class="bill-amount-tr">
                    <td colspan="4" class="bill-amount-label">Bill Amount :</td>
                    <td class="bill-amount-val">${inr2(d.totalAmount)}</td>
                </tr>
                <tr class="pay-row-tr">
                    <td colspan="3" class="pay-mode-td">
                        <span class="lbl">Pay Mode</span><span class="colon"> : </span><span class="val">${esc(d.payMode)}</span>
                    </td>
                    <td class="paid-label">Paid :</td>
                    <td class="paid-val">${inr2(d.paidAmount)}</td>
                </tr>
                ${d.totalAmount - d.paidAmount > 0 ? `
                <tr class="pay-row-tr">
                    <td colspan="4" class="paid-label">Balance Due :</td>
                    <td class="paid-val">${inr2(d.totalAmount - d.paidAmount)}</td>
                </tr>` : ""}
            </tfoot>
        </table>

        <hr class="hr" style="margin-top: 2px;" />

        <!-- Payment Summary & Signature -->
        <div class="payment-info">
            <div class="pay-row" style="margin-top: 2px;">
                <div>
                    <span class="lbl">In Words</span><span class="colon">:</span><span class="val">${esc(numWordsOPBill(Math.round(d.paidAmount)))}</span>
                </div>
            </div>
            <hr class="hr" style="margin-top: 6px;" />
            <div class="prep-sign-row">
                <div>
                    <span class="lbl">Prepared By</span><span class="colon">:</span><span class="val">${esc(d.preparedBy)}</span>
                </div>
                <div class="val" style="font-weight: 700;">Signature</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function printOPBill(data: OPBillData): void {
  printHtml(buildOPBillHtml(data));
}
