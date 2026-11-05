/**
 * buildPaymentReceiptHtml
 * ───────────────────────
 * Generates a compact payment RECEIPT (proof of a single payment event),
 * distinct from the full Credit Bill (which shows what is owed).
 *
 * Use case (partial payments):
 *   Bill total ₹20,000 · patient pays ₹2,000 today → this slip proves that
 *   single ₹2,000 collection and carries the running balance (₹18,000).
 *
 * Layout: half-A4 (148mm tall) so two receipts fit on one A4 sheet, matching
 * the Sen Hospital letterhead used on the Credit Bill.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReceiptPriorPayment {
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo?: string | null;
  transactionGroupId?: string | null;
}

export interface ReceiptPayment {
  /** Receipt / payment record id — used for the receipt number. */
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo?: string | null;
  receivedBy?: string | null;
}

export interface ReceiptBill {
  billNo: string;
  patientName: string;
  uhid: string;
  patientType?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  ward?: string | null;
  bedNumber?: string | null;
  admissionNo?: string | null;
  doctorName?: string | null;
  /** Whole-bill figures for the running-balance summary. */
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  /**
   * All payments made BEFORE this receipt (excluding records in the same split
   * group as the current payment). When supplied, the balance summary shows a
   * dated per-record breakdown instead of a single "Previously Paid" lump sum.
   */
  priorPayments?: ReceiptPriorPayment[] | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function numberToWords(n: number): string {
  if (n === 0) return "Zero Rupees Only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function words(num: number): string {
    if (num < 20)       return ones[num];
    if (num < 100)      return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000)     return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + words(num % 100) : "");
    if (num < 100000)   return words(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + words(num % 1000) : "");
    if (num < 10000000) return words(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + words(num % 100000) : "");
    return words(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + words(num % 10000000) : "");
  }

  const rupees = Math.floor(n);
  const paise  = Math.round((n - rupees) * 100);
  let result   = words(rupees) + " Rupees";
  if (paise > 0) result += " and " + words(paise) + " Paise";
  return result + " Only";
}

function fmtAmt(n: number): string {
  return (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined, withTime = false): string {
  if (!d) return "—";
  try {
    const dt   = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const dd   = String(dt.getDate()).padStart(2, "0");
    const mm   = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    if (!withTime) return `${dd}-${mm}-${yyyy}`;
    const hh   = String(dt.getHours()).padStart(2, "0");
    const min  = String(dt.getMinutes()).padStart(2, "0");
    const ampm = dt.getHours() < 12 ? "AM" : "PM";
    return `${dd}-${mm}-${yyyy} ${hh}:${min} ${ampm}`;
  } catch {
    return d;
  }
}

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
  UPI: "UPI", CHEQUE: "Cheque", INSURANCE: "Insurance",
};

/** Receipt number derived from the payment record id, e.g. RCPT-000042. */
function receiptNo(paymentId: number): string {
  return `RCPT-${String(paymentId).padStart(6, "0")}`;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Build a self-contained payment-receipt HTML page.
 *
 * @param payment  the single payment record being proven
 * @param bill     the parent bill (for running balance + patient details)
 * @param origin   window.location.origin — used to resolve the logo/seal images
 */
export function buildPaymentReceiptHtml(
  payment: ReceiptPayment,
  bill: ReceiptBill,
  origin: string,
): string {
  const leftLogo  = `${origin}/images/sen-logo.png`;
  const rightLogo = `${origin}/images/nabh-seal.png`;

  // "Previously paid" = amount already on the bill BEFORE this payment.
  // bill.paidAmount is the running total INCLUDING this payment (fetched fresh
  // after recording), so subtract this payment to get the prior figure.
  const previouslyPaid = Math.max(0, (bill.paidAmount ?? 0) - payment.amount);
  const balanceDue     = bill.dueAmount ?? 0;
  const modeLabel      = MODE_LABEL[payment.paymentMode] ?? payment.paymentMode;

  // ── Prior-payment breakdown rows ─────────────────────────────────────────
  // Group priorPayments by transactionGroupId so split sessions show as one
  // combined row (e.g. "Cash ₹200 + UPI ₹100") instead of two separate rows.
  const priorList = bill.priorPayments ?? [];
  type PGroup = { date: string; records: ReceiptPriorPayment[]; total: number };
  const pgOrder: string[] = [];
  const pgMap = new Map<string, ReceiptPriorPayment[]>();
  for (const pr of priorList) {
    const key = pr.transactionGroupId ?? `solo_${pr.date}_${pr.paymentMode}_${pr.amount}`;
    if (!pgMap.has(key)) { pgMap.set(key, []); pgOrder.push(key); }
    pgMap.get(key)!.push(pr);
  }
  const pGroups: PGroup[] = pgOrder.map(k => {
    const recs = pgMap.get(k)!;
    return { date: recs[0].date, records: recs, total: recs.reduce((s, r) => s + r.amount, 0) };
  });

  const priorRows = pGroups.length > 0
    ? pGroups.map(g => {
        const lbl = g.records.length === 1
          ? (MODE_LABEL[g.records[0].paymentMode] ?? g.records[0].paymentMode)
              + (g.records[0].referenceNo ? " \u2014 " + g.records[0].referenceNo : "")
          : g.records.map(r => `${MODE_LABEL[r.paymentMode] ?? r.paymentMode} \u20B9${fmtAmt(r.amount)}`).join(" + ");
        return `<tr>
          <td style="color:#555;font-size:11px;padding:3px 8px;">${fmtDate(g.date)} &nbsp;&middot;&nbsp; ${lbl}</td>
          <td style="color:#555;font-size:11px;text-align:right;padding:3px 8px;">\u20B9 ${fmtAmt(g.total)}</td>
        </tr>`;
      }).join("")
    : `<tr><td style="padding:5px 8px;">Previously Paid</td><td style="text-align:right;padding:5px 8px;font-weight:700;">\u20B9 ${fmtAmt(previouslyPaid)}</td></tr>`;

  const ptLine = [
    bill.patientName.toUpperCase(),
    bill.age ? `${bill.age} Y` : "",
    bill.gender ? bill.gender.toUpperCase() : "",
  ].filter(Boolean).join("  ·  ");

  const ipLine = bill.patientType === "IP"
    ? `${bill.admissionNo ?? "—"}${bill.ward ? "  ·  " + bill.ward : ""}${bill.bedNumber ? " / Bed " + bill.bedNumber : ""}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt — ${receiptNo(payment.id)}</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:16px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .receipt{width:210mm;min-height:148mm;margin:auto;padding:10mm 12mm;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.2);}

    /* header */
    .header{display:grid;grid-template-columns:20% 60% 20%;align-items:center;border-bottom:2px solid #111;padding-bottom:6px;}
    .logo{max-width:110px;max-height:80px;object-fit:contain;}
    .header-left{display:flex;flex-direction:column;align-items:flex-start;justify-self:start;}
    .reg-no{font-size:9px;font-weight:600;margin-top:22px;white-space:nowrap;}
    .right-logo{justify-self:end;}
    .hospital-info{text-align:center;line-height:1.3;}
    .hospital-info h1{margin:0;font-size:22px;color:#242445;font-family:Georgia,"Times New Roman",serif;letter-spacing:.5px;}
    .hospital-info h2{margin:0 0 6px;font-size:14px;color:#242445;}
    .hospital-info p{margin:1px 0;font-size:10px;font-weight:600;}

    /* title */
    .title{text-align:center;margin:8px 0 2px;font-size:16px;font-weight:bold;letter-spacing:.5px;}

    /* meta row (receipt no + date) */
    .meta{display:flex;justify-content:space-between;font-weight:600;padding:6px 0;border-bottom:1px solid #111;}

    /* detail rows */
    .rows{padding:8px 0;border-bottom:1px solid #111;}
    .row{display:grid;grid-template-columns:150px 12px 1fr;min-height:22px;align-items:start;font-weight:600;}
    .row .value{font-weight:normal;word-break:break-word;}

    /* amount box */
    .amount-box{display:flex;justify-content:space-between;align-items:center;margin:12px 0;padding:10px 14px;background:#eef6ff;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1.5px solid #0ea5e9;border-radius:6px;}
    .amount-box .lbl{font-size:13px;font-weight:700;}
    .amount-box .amt{font-size:20px;font-weight:800;}
    .words{font-weight:600;margin-bottom:12px;}

    /* balance summary */
    .balance{width:100%;border-collapse:collapse;margin-top:4px;}
    .balance td{padding:5px 8px;font-size:12px;border-bottom:1px solid #ccc;}
    .balance td:last-child{text-align:right;font-weight:700;white-space:nowrap;}
    .balance tr.due td{font-weight:800;font-size:13px;border-bottom:2px solid #111;}

    /* footer */
    .footer{display:grid;grid-template-columns:1fr 1fr;margin-top:28px;}
    .received-by{font-weight:600;align-self:end;}
    .signature{text-align:right;align-self:end;}
    .signature .sig-line{margin-top:34px;font-weight:bold;border-top:1px solid #111;display:inline-block;padding-top:3px;min-width:150px;}
    .note{text-align:center;font-size:9px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px;}

    .print-btn{display:block;margin:14px auto;padding:8px 32px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;}

    @media print{
      body{padding:0;background:#fff;}
      .receipt{width:210mm;min-height:148mm;margin:0;padding:10mm 12mm;box-shadow:none;}
      .print-btn{display:none!important;}
      @page{size:A4;margin:0;}
    }
  </style>
</head>
<body>

  <button class="print-btn" onclick="window.print()">🖨&nbsp; Print / Save PDF</button>

  <div class="receipt">

    <!-- HEADER -->
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

    <!-- TITLE -->
    <div class="title">PAYMENT RECEIPT</div>

    <!-- META -->
    <div class="meta">
      <span>Receipt No : ${receiptNo(payment.id)}</span>
      <span>Date : ${fmtDate(payment.date, true)}</span>
    </div>

    <!-- DETAILS -->
    <div class="rows">
      <div class="row"><b>Received From</b><span>:</span><span class="value">${ptLine}</span></div>
      <div class="row"><b>UHID</b><span>:</span><span class="value">${bill.uhid}</span></div>
      ${ipLine ? `<div class="row"><b>IP No / Ward</b><span>:</span><span class="value">${ipLine}</span></div>` : ""}
      ${bill.doctorName ? `<div class="row"><b>Consultant</b><span>:</span><span class="value">${bill.doctorName}</span></div>` : ""}
      <div class="row"><b>Against Bill No</b><span>:</span><span class="value">${bill.billNo}</span></div>
      <div class="row"><b>Payment Mode</b><span>:</span><span class="value">${modeLabel}${payment.referenceNo ? " — Ref: " + payment.referenceNo : ""}</span></div>
    </div>

    <!-- AMOUNT -->
    <div class="amount-box">
      <span class="lbl">Amount Received</span>
      <span class="amt">₹ ${fmtAmt(payment.amount)}</span>
    </div>
    <div class="words">In Words : ${numberToWords(payment.amount)}</div>

    <!-- BALANCE SUMMARY -->
    <table class="balance">
      <tr><td style="padding:5px 8px;">Total Bill Amount</td><td style="text-align:right;padding:5px 8px;font-weight:700;">&#8377; ${fmtAmt(bill.totalAmount)}</td></tr>
      ${previouslyPaid > 0 ? `
      <tr><td colspan="2" style="padding:3px 8px 1px;font-size:11px;color:#888;font-weight:600;border-bottom:none;">Previously Paid :</td></tr>
      ${priorRows}
      <tr style="border-top:1px solid #ccc;"><td style="padding:3px 8px 5px;font-size:11px;color:#555;">Subtotal previously paid</td><td style="text-align:right;padding:3px 8px 5px;font-size:11px;color:#555;">&#8377; ${fmtAmt(previouslyPaid)}</td></tr>
      ` : ""}
      <tr style="border-top:1.5px solid #111;"><td style="padding:5px 8px;font-weight:700;">This Payment</td><td style="text-align:right;padding:5px 8px;font-weight:700;">&#8377; ${fmtAmt(payment.amount)}</td></tr>
      <tr class="due"><td style="padding:5px 8px;">Balance Due</td><td style="text-align:right;padding:5px 8px;">&#8377; ${fmtAmt(balanceDue)}</td></tr>
    </table>

    <!-- FOOTER -->
    <div class="footer">
      <div class="received-by">Received By : ${payment.receivedBy ?? "—"}</div>
      <div class="signature">
        <div>For &nbsp;<b>SEN HOSPITAL</b></div>
        <div class="sig-line">Authorized Signatory</div>
      </div>
    </div>

    <div class="note">
      This is a computer-generated receipt. ${balanceDue > 0
        ? "Balance due is payable at discharge / next visit."
        : "Bill fully settled — thank you."}
    </div>

  </div>
</body>
</html>`;
}
