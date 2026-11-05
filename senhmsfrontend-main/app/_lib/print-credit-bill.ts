/**
 * buildCreditBillHtml
 * ───────────────────
 * Generates a self-contained Insurance / Inpatient Bill HTML page.
 * Layout matches the physical bill format used at SEN Hospital:
 *   - Modality-grouped charges with QTY / RATE / TOTAL columns
 *   - Sub-total per modality group
 *   - Gross → Discount → Bill Amount summary
 *   - Optional Insurance Details + Approval sections
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditBillItem {
  id: number;
  description: string;
  /** Modality / category name — used for grouping (e.g. "Ward Charges", "LAB") */
  modalityName?: string | null;
  quantity?: number;
  unitPrice?: number;
  total: number;
  /** ISO date (optionally with time) the service was rendered. Printed in the
   *  DATE column of the dated "Final Detailed Split-up Bill". Null = blank cell. */
  serviceDate?: string | null;
}

export interface CreditBillDetails {
  billNo?: string | null;
  date?: string | null;
  ward?: string | null;
  bedNumber?: string | null;
  doctorName?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  admittedDate?: string | null;
  items?: CreditBillItem[];
  subtotal?: number;
  totalDiscount?: number;
  totalAmount?: number;
  createdBy?: string | null;
  address?: string | null;
}

export interface CreditBillClaim {
  claimNo: string;
  billNo?: string | null;
  uhid: string;
  patientName: string;
  patientType?: string | null;
  admissionDate?: string | null;
  admissionNo?: string | null;
  dischargeDate?: string | null;
  diagnosis?: string | null;
  insuranceCompany: string;
  tpaName?: string | null;
  policyNo?: string | null;
  preAuthNumber?: string | null;
  billAmount?: number | null;
  claimedAmount: number;
  approvedAmount?: number | null;
  settledAmount?: number | null;
  /** Authorized Amount (persisted on the claim, from the insurer's reply). */
  authorizedAmount?: number | null;
  /** Co-Payment Amount (persisted on the claim, entered — not derived). */
  coPayAmount?: number | null;
  /** Insured person name + card number for the Insurance Details block. */
  insuredPersonName?: string | null;
  cardNumber?: string | null;
  submittedDate: string;
  settledDate?: string | null;
  remarks?: string | null;
  createdBy?: string | null;
  /** Who prepared this bill — shown in footer. Falls back to createdBy. */
  preparedBy?: string | null;
  billDetails?: CreditBillDetails | null;
  /** Payment ledger — when supplied, a "Payment Details" table is printed. */
  payments?: CreditBillPayment[] | null;
  /** Total collected against the bill. Drives the Amount Paid / Balance Due lines. */
  paidAmount?: number | null;
  /** Outstanding balance. Falls back to billAmount - paidAmount when omitted. */
  dueAmount?: number | null;
}

export interface CreditBillPayment {
  date: string;
  amount: number;
  paymentMode: string;
  referenceNo?: string | null;
  /** UUID shared by all records in the same split-payment session. Null for single-mode payments. */
  transactionGroupId?: string | null;
  /** ADVANCE / SETTLEMENT / LAB / REFUND — shown in the Receipt Type column. */
  receiptType?: string | null;
  /** Receipt number shown in the ledger, e.g. RCPT-YYYYMMDD-XXXX. */
  receiptNo?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
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
    const dd   = String(dt.getDate()).padStart(2, "0");
    const mm   = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    if (!withTime) return `${dd}-${mm}-${yyyy}`;
    // Guard: a date-only string (no time component) parses at local midnight —
    // don't tack on a misleading "12:00 AM". Only show time when one is present.
    const hasTime = typeof d === "string" && /[T\s]\d{1,2}:\d{2}/.test(d);
    if (!hasTime) return `${dd}-${mm}-${yyyy}`;
    const h24  = dt.getHours();
    const min  = String(dt.getMinutes()).padStart(2, "0");
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12  = String(((h24 + 11) % 12) + 1).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${h12}:${min} ${ampm}`;
  } catch {
    return d;
  }
}

/**
 * Strip backend-generated suffixes from item descriptions before printing.
 *
 * Removed patterns:
 *  - " (9 DAYS, 2026-09-20 TO 2026-09-28)"  — ward/consultation date range
 *  - " (LAB-20260920-00005)"                 — lab order code
 *  - " ✓" or " ✓ " trailing checkmark        — lab billed indicator
 *  - " — BED B013"                           — bed suffix on ward lines
 */
function cleanDescription(desc: string): string {
  return desc
    // Remove (N DAYS, YYYY-MM-DD TO YYYY-MM-DD)
    .replace(/\s*\(\d+\s+DAYS?,\s*\d{4}-\d{2}-\d{2}\s+TO\s+\d{4}-\d{2}-\d{2}\)/gi, "")
    // Remove (LAB-YYYYMMDD-XXXXX) style lab codes
    .replace(/\s*\(LAB-\d{8}-\d+\)/gi, "")
    // Remove trailing ✓ checkmark (with optional space)
    .replace(/\s*✓\s*$/, "")
    // Remove " — BED XXXX" bed suffix
    .replace(/\s+—\s+BED\s+\S+/gi, "")
    .trim();
}

/**
 * Format QTY display:
 * - Ward / Consultation / IPD charges → "N Days"
 * - Qty = 1 → show nothing (blank)
 * - Others → plain number
 */
function fmtQty(qty: number | undefined, modality: string): string {
  if (!qty || qty <= 0) return "";
  const mod = modality.toUpperCase();
  const isDayBased = mod.includes("WARD") || mod.includes("CONSULTATION") ||
                     mod.includes("IPD") || mod.includes("ROOM");
  if (isDayBased) return `${qty} Days`;
  // Always show the quantity (matches the SAP bill where every line shows "1").
  return String(qty);
}

/**
 * Build modality-grouped item rows.
 * Layout (matches the physical bill photo):
 *
 *  ┌─────────────────────────────────────┬──────────┬──────────┬──────────┐
 *  │ MODALITY HEADING                    │  QTY     │  RATE    │  TOTAL   │
 *  │   Item description                  │          │          │          │
 *  │                          Sub Total :│          │          │  x,xxx   │
 *  └─────────────────────────────────────┴──────────┴──────────┴──────────┘
 */
function buildItemRows(items: CreditBillItem[], summaryMode = false, showDate = false): string {
  // Total number of columns in the charges table. The dated split-up adds a
  // leading DATE column (never shown in summaryMode).
  const dated   = showDate && !summaryMode;
  const colSpan = dated ? 5 : 4;

  if (items.length === 0) {
    return `<tr><td colspan="${colSpan}" style="text-align:center;color:#888;font-style:italic;padding:12px;">No bill items attached</td></tr>`;
  }

  // Group by modalityName (preserve insertion order)
  const groups = new Map<string, CreditBillItem[]>();
  for (const it of items) {
    const key = (it.modalityName ?? "OTHER").toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  // Leading blank DATE cell for heading / sub-total rows (keeps column alignment).
  const dateHeadCell = dated ? `<td class="mod-date"></td>` : "";

  let html = "";
  for (const [modality, groupItems] of groups) {
    const groupTotal = groupItems.reduce((s, i) => s + (i.total ?? 0), 0);
    const firstItem  = groupItems[0];

    // Summary mode: one line per modality group — heading + group total only.
    // No item rows, no per-group sub-total row. (Never dated.)
    if (summaryMode) {
      html += `
      <tr class="modality-head">
        <td class="mod-name">${modality}</td>
        <td class="mod-qty"></td>
        <td class="mod-rate"></td>
        <td class="mod-total">${fmtAmt(groupTotal)}</td>
      </tr>`;
      continue;
    }

    // For single-item groups that are day-based (ward/consultation),
    // show qty+rate in the heading row itself
    const isSingleDayBased = groupItems.length === 1 &&
      (modality.includes("WARD") || modality.includes("CONSULTATION") ||
       modality.includes("IPD")  || modality.includes("ROOM"));

    const headQty  = isSingleDayBased ? fmtQty(firstItem.quantity, modality) : "";
    const headRate = isSingleDayBased && firstItem.unitPrice ? fmtAmt(firstItem.unitPrice) : "";
    // Dated layout: the heading row shows the first item's date so a single
    // day-based group (ward/consultation) still carries its date.
    const headDate = dated
      ? `<td class="item-date">${isSingleDayBased ? fmtDate(firstItem.serviceDate, true) : ""}</td>`
      : "";

    // Modality heading row (grey background)
    html += `
      <tr class="modality-head">
        ${dateHeadCell}
        <td class="mod-name">${modality}</td>
        <td class="mod-qty">${headQty}</td>
        <td class="mod-rate">${headRate}</td>
        <td class="mod-total">${fmtAmt(groupTotal)}</td>
      </tr>`;

    // Item rows — show for multi-item groups, or single non-day-based items
    const showItems = groupItems.length > 1 || !isSingleDayBased;
    if (showItems) {
      for (const it of groupItems) {
        const cleanDesc = cleanDescription(it.description).toUpperCase();
        const qty       = fmtQty(it.quantity, modality);
        const rate      = it.unitPrice && it.unitPrice > 0 ? fmtAmt(it.unitPrice) : "";
        const dateCell  = dated ? `<td class="item-date">${fmtDate(it.serviceDate, true)}</td>` : "";
        html += `
      <tr class="item-row">
        ${dateCell}
        <td class="item-desc">${cleanDesc}</td>
        <td class="item-qty">${qty}</td>
        <td class="item-rate">${rate}</td>
        <td class="item-total">${fmtAmt(it.total)}</td>
      </tr>`;
      }
    } else {
      // Single day-based item: show description below heading. In the dated
      // layout the heading already carries the date, so the description spans
      // the remaining columns.
      const cleanDesc = cleanDescription(firstItem.description).toUpperCase();
      html += `
      <tr class="item-row">
        ${headDate}
        <td class="item-desc" colspan="3">${cleanDesc}</td>
        <td></td>
      </tr>`;
    }

    // Sub-total row per group
    html += `
      <tr class="subtotal-row">
        ${dateHeadCell}
        <td colspan="3" class="subtotal-label">Sub Total :</td>
        <td class="subtotal-val">${fmtAmt(groupTotal)}</td>
      </tr>`;
  }

  return html;
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface IPBillOptions {
  /** Override the bill title. Defaults to "Credit - Bill". */
  title?: string;
  /** Show the Insurance Details section. Defaults to true. */
  showInsurance?: boolean;
  /** Show the Approval (authorized / co-pay / approved) table. Defaults to true. */
  showApproval?: boolean;
  /**
   * Print on pre-printed letterhead stationery.
   * When true, the code-drawn hospital header is hidden and a blank
   * reserved space (default 5.5 cm) is left at the top of the sheet so the
   * paper's pre-printed letterhead shows through. Defaults to false.
   */
  letterheadMode?: boolean;
  /**
   * Height of the reserved blank space at the top when letterheadMode is on.
   * Any valid CSS length. Defaults to "5.5cm".
   */
  letterheadSpace?: string;
  /**
   * Summary mode — render only the modality heading rows with their group
   * totals, skipping the individual item rows and per-group sub-total rows.
   * Used by the "Summary" IP bill. Defaults to false (full itemised bill).
   */
  summaryMode?: boolean;
  /**
   * Show the Discharge Date row in the bill header.
   * Only the Consolidated / Summary bills carry a discharge date; the ordinary
   * Detailed and Payment-History bills omit it. Defaults to false.
   */
  showDischargeDate?: boolean;
  /**
   * Render a leading DATE column (date + time per line) in the charges table.
   * Used by the cash "Final Detailed Split-up Bill" (5 columns:
   * DATE | PARTICULARS | QTY | RATE | TOTAL). The Cumulative / Summary bills
   * omit it (4 columns). Ignored in summaryMode. Defaults to false.
   */
  showDateColumn?: boolean;
}

export function buildCreditBillHtml(
  claim: CreditBillClaim,
  origin: string,
  options?: IPBillOptions,
): string {
  const title        = options?.title          ?? "Credit - Bill";
  const showIns      = options?.showInsurance  ?? true;
  const showApproval = options?.showApproval   ?? true;
  const letterhead   = options?.letterheadMode  ?? false;
  const lhSpace      = options?.letterheadSpace ?? "4.5cm";
  const summaryMode  = options?.summaryMode     ?? false;
  const showDischarge = options?.showDischargeDate ?? false;
  // DATE column only on the dated split-up layout (never in summary mode).
  const showDateCol  = (options?.showDateColumn ?? false) && !summaryMode;

  const b           = claim.billDetails;
  const items       = b?.items ?? [];
  const grossAmt    = b?.subtotal      ?? claim.billAmount ?? claim.claimedAmount ?? 0;
  const discountAmt = b?.totalDiscount ?? 0;
  const billAmt     = b?.totalAmount   ?? claim.billAmount ?? claim.claimedAmount ?? 0;
  // Approval table figures. Prefer the PERSISTED claim values (entered from the
  // insurer's email). These are PERSISTED figures only — they must NOT be
  // derived from the bill/claimed amount. Until the coordinator enters them
  // from the insurer's reply (Insurance module), they print as 0.00. Deriving
  // them (e.g. co-pay = bill − approved) would show fabricated figures on a
  // bill where nothing has been approved yet.
  const authorizedAmt = claim.authorizedAmount ?? 0;
  const coPayAmt       = claim.coPayAmount ?? 0;
  const claimAprAmt    = claim.approvedAmount ?? 0;

  // Who prepared / verified — use explicit preparedBy, fall back to createdBy
  const preparedBy  = claim.preparedBy ?? b?.createdBy ?? claim.createdBy ?? "—";

  // Receipt ledger — printed only when supplied. Paid is the signed sum of
  // receipts (advances + settlements − refunds); Balance = Bill − Paid and may
  // be negative (a credit) when advances exceed the charged amount.
  const payList  = claim.payments ?? [];
  const paidAmt  = claim.paidAmount ?? payList.reduce((s, p) => s + (p.amount ?? 0), 0);
  const dueAmt   = claim.dueAmount ?? (billAmt - paidAmt);
  const modeLbl: Record<string, string> = {
    CASH: "Cash", CARD: "Card", CREDIT_CARD: "Credit Card", DEBIT_CARD: "Debit Card",
    UPI: "UPI", CHEQUE: "Cheque", INSURANCE: "Insurance",
  };

  const typeLbl: Record<string, string> = {
    ADVANCE: "Advance Amount", SETTLEMENT: "Settlement Amount", LAB: "Lab Amount", REFUND: "Refund Amount",
  };

  // ── Receipt ledger (SAP-style) ────────────────────────────────────────────
  // One row per receipt: Date · Receipt No · Receipt Type · Payment Mode · Amount.
  // Paid Amount is the signed sum (advances + settlements − refunds); Balance is
  // Bill Amount − Paid Amount. Matches the hospital's "Final Split Up Bill" footer.
  const paymentRows = payList
    .map(p => `
        <tr>
          <td>${fmtDate(p.date, true)}</td>
          <td>${p.receiptNo ?? "—"}</td>
          <td>${typeLbl[p.receiptType ?? ""] ?? (p.receiptType ?? "—")}</td>
          <td>${modeLbl[p.paymentMode] ?? p.paymentMode}</td>
          <td class="${(p.amount ?? 0) < 0 ? "pt-neg" : ""}">${fmtAmt(p.amount)}</td>
        </tr>`)
    .join("");
  // On the dated split-up the ledger ALWAYS prints (header + receipt rows +
  // Paid Amount / Balance totals). When no receipts exist the body carries only
  // the Paid Amount: 0.00 + Balance rows — no placeholder text. Elsewhere the
  // ledger prints only when receipts exist (so a plain reprint stays clean).
  const showLedger = showDateCol || payList.length > 0;
  const hasReceipts = payList.length > 0;
  const paymentBlock = showLedger ? `
    <div class="payment-details">
      <table class="pay-table">
        ${hasReceipts ? `
        <thead>
          <tr>
            <th>Date</th><th>Receipt No</th><th>Receipt Type</th>
            <th>Payment Mode</th><th class="pt-amt">Amount</th>
          </tr>
        </thead>` : ""}
        <tbody>
          ${paymentRows}
          <tr class="pay-total"><td colspan="4">Paid Amount :</td><td>${fmtAmt(paidAmt)}</td></tr>
          <tr class="pay-due"><td colspan="4">Balance :</td><td>${fmtAmt(dueAmt)}</td></tr>
        </tbody>
      </table>
    </div>` : "";

  const leftLogo  = `${origin}/images/sen-logo.png`;
  const rightLogo = `${origin}/images/nabh-seal.png`;

  const itemRows = buildItemRows(items, summaryMode, showDateCol);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — ${claim.billNo ?? claim.claimNo}</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:20px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .bill-page{width:210mm;min-height:297mm;margin:auto;padding:12mm 12mm 10mm;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.2);}
    /* letterhead mode: measure the reserved space from the true top edge of
       the sheet, so drop the page's own top padding and let the spacer own it */
    .bill-page.letterhead{padding-top:0;}
    /* Letterhead toggle classes — controlled by applyLh() JS function.
       lh-hide: visible by default, hidden when lh-mode is active.
       lh-show: hidden by default, visible when lh-mode is active. */
    .lh-hide{ display:block; }
    .lh-show{ display:none; }
    .lh-mode .lh-hide{ display:none !important; }
    .lh-mode .lh-show{ display:block; }
    /* In letterhead mode, bill-page has no top padding (space comes from letterhead-space) */
    .lh-mode-page{ padding-top:0 !important; }
    .letterhead-space{
      height:${lhSpace};
      box-sizing:border-box;
    }
    .lh-banner{
      height:100%;
      border:2px dashed #aaa;
      border-radius:4px;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#888;
      font-size:12px;
      font-style:italic;
      user-select:none;
    }
    @media print{ .lh-banner{ display:none; } .letterhead-space{ border:none; } }
    /* kill the ~1cm gap between pre-printed letterhead and the bill title:
       the spacer already reserves the header area, so the title should sit
       flush right under it with no extra top margin */
    .bill-page.letterhead .bill-title{margin-top:0;}

    /* header */
    .header{display:grid;grid-template-columns:20% 60% 20%;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;}
    .logo{max-width:130px;max-height:95px;object-fit:contain;}
    .header-left{display:flex;flex-direction:column;align-items:flex-start;justify-self:start;}
    .reg-no{font-size:10px;font-weight:600;color:#111;margin-top:30px;white-space:nowrap;}
    .right-logo{justify-self:end;}
    .hospital-info{text-align:center;line-height:1.35;}
    .hospital-info h1{margin:0;font-size:25px;color:#242445;font-family:Georgia,"Times New Roman",serif;letter-spacing:.5px;}
    .hospital-info h2{margin:0 0 8px;font-size:16px;color:#242445;}
    .hospital-info p{margin:2px 0;font-size:11px;font-weight:600;}

    /* title */
    .bill-title{text-align:center;margin:8px 0;font-size:18px;font-weight:bold;}
    .Line{background-color:#111;border:none;height:1.5px;}

    /* details grid */
    .details-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;border-bottom:2px solid #111;padding:2px 0 7px;}
    .detail-row{display:grid;grid-template-columns:135px 12px 1fr;min-height:24px;align-items:start;font-weight:600;}
    .detail-row .value{font-weight:normal;word-break:break-word;font-size:12px;}

    /* patient / insurance sections */
    .patient-section{border-bottom:2px solid #111;padding:6px 0;}
    .insurance-section{border-bottom:2px solid #111;padding:7px 0 5px;}
    .section-heading{font-weight:bold;margin-bottom:12px;width:fit-content;border-bottom:2px solid black;}

    /* charges table — 4 columns: Particulars | QTY | RATE | TOTAL */
    .charges-table{width:100%;border-collapse:collapse;margin-top:10px;}
    .charges-table th{
      background:#bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;
      text-align:left;padding:6px 8px;font-size:12px;font-weight:700;
    }
    .charges-table th.th-qty,
    .charges-table th.th-rate,
    .charges-table th.th-total{text-align:right;}
    /* dated split-up: leading DATE column */
    .charges-table th.th-date{text-align:left;white-space:nowrap;width:30mm;}
    .item-date,.mod-date{text-align:left;white-space:nowrap;font-size:11px;color:#333;}
    .item-row td.item-date{padding-left:8px;}

    /* modality heading row */
    .modality-head td{
      background:#d9d9d9;-webkit-print-color-adjust:exact;print-color-adjust:exact;
      font-weight:700;font-size:12px;padding:5px 8px;border-top:1px solid #999;
    }
    .mod-name{text-align:left;}
    .mod-qty,.mod-rate,.mod-total{text-align:right;white-space:nowrap;}

    /* item rows */
    .item-row td{padding:5px 8px 5px 16px;font-size:12px;font-weight:600;border-bottom:1px solid #ddd;}
    .item-desc{text-align:left;}
    .item-qty,.item-rate,.item-total{text-align:right;white-space:nowrap;}

    /* sub-total row */
    .subtotal-row td{
      padding:4px 8px;font-weight:700;font-size:12px;
      border-bottom:2px solid #888;
    }
    .subtotal-label{text-align:right;padding-right:12px;}
    .subtotal-val{text-align:right;white-space:nowrap;}

    /* summary */
    .summary{margin-top:16px;width:100%;}
    .summary-row{display:grid;grid-template-columns:1fr 150px 110px;min-height:29px;align-items:center;padding:0 10px;}
    .summary-row:nth-child(1),.summary-row:nth-child(3){background:#bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .summary-row .label{grid-column:2;text-align:right;padding-right:18px;font-weight:bold;}
    .summary-row .amount{text-align:right;font-weight:bold;}
    .amount-words{padding:7px 8px;font-size:12px;font-weight:600;}

    /* payment details table */
    .payment-details{margin-top:14px;}
    .pay-heading{font-weight:bold;margin-bottom:4px;width:fit-content;border-bottom:2px solid #000;}
    .pay-table{width:100%;border-collapse:collapse;}
    .pay-table th{background:#bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:5px 8px;text-align:left;font-size:12px;font-weight:700;}
    .pay-table th.pt-amt{text-align:right;}
    .pay-table td{padding:5px 8px;border-bottom:1px solid #ccc;font-size:12px;font-weight:600;}
    .pay-table td:last-child{text-align:right;white-space:nowrap;}
    .pay-table tr.pay-total td{font-weight:700;border-top:1.5px solid #111;border-bottom:none;text-align:right;}
    .pay-table tr.pay-due td{font-weight:800;border-bottom:2px solid #111;text-align:right;}
    .pay-table td.pt-neg{color:#c0392b;}

    /* approval table */
    .approval-table{width:100%;border-collapse:collapse;margin-top:5px;}
    .approval-table th{background:#bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:7px 6px;text-align:left;font-size:12px;}
    .approval-table td{padding:8px 6px;border-bottom:2px solid #222;font-weight:600;}
    .approval-table th:not(:first-child),.approval-table td:not(:first-child){text-align:right;}

    /* footer */
    .footer{display:grid;grid-template-columns:1fr 1fr;margin-top:12px;min-height:105px;border-bottom:2px solid #111;}
    .prepared-by{line-height:2.3;font-weight:600;}
    .signature{text-align:right;display:flex;flex-direction:column;justify-content:space-between;padding:12px 0;}
    .signature-text{font-weight:bold;}
    .sign{display:flex;justify-content:flex-end;gap:4px;}

    /* dated split-up closing line */
    .get-well{text-align:center;font-weight:700;letter-spacing:1px;margin-top:18px;padding-top:10px;}

    /*
     * bill-tail: wraps summary + payment + approval + footer.
     * page-break-inside:avoid keeps the entire block together so it never
     * splits onto a fresh page on its own — which would cause a spurious
     * thead (header) repeat above just the footer.
     */
    .bill-tail{page-break-inside:avoid;break-inside:avoid;}

    /* print button + letterhead toggle bar (screen only) */
    .btn-bar{display:flex;justify-content:center;align-items:center;gap:12px;margin:14px auto;flex-wrap:wrap;}
    .print-btn{display:block;padding:8px 32px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:Arial,sans-serif;}
    .lh-toggle-label{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#fff;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13px;color:#334155;cursor:pointer;font-family:Arial,sans-serif;user-select:none;}
    .lh-toggle-label input{accent-color:#0ea5e9;width:14px;height:14px;cursor:pointer;}

    /*
     * ── Repeating print header ────────────────────────────────────────────────
     * The hospital header is wrapped in a single-column <table><thead>.
     * Browsers repeat <thead> content at the top of every printed page.
     * Everything else (bill details, charges, totals) is in the <tbody> and
     * flows naturally — the totals appear on the last page because that is
     * simply where the content ends.
     *
     * On screen the outer table is invisible (no borders, no spacing) so the
     * layout looks identical to the original single-div design.
     */
    .print-wrap{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
    }
    .print-wrap > thead > tr > th,
    .print-wrap > tbody > tr > td{
      padding:0;
      font-weight:normal;
      vertical-align:top;
    }
    /* On repeated pages the thead <th> provides the only spacing between the
       page edge and the header/body content. Add top+bottom padding that
       mirrors the bill-page padding used on page 1 (8mm top, 6mm below hr). */
    @media print{
      /* Normal mode: thead <th> adds spacing between page edge and header content. */
      .print-wrap > thead > tr > th{ padding-top:8mm; padding-bottom:2mm; }
      /* Letterhead mode: the <th> padding is replaced by the letterhead-space
         height itself — zero out the padding so there is no double gap.
         The .lh-hide rule (display:none !important) already hides the hospital
         header div; the .lh-show letterhead-space div stays visible and repeats
         on every page, reserving the correct blank area for the pre-printed paper. */
      .print-wrap.lh-mode > thead > tr > th{ padding-top:0; padding-bottom:0; }
    }

    @media print{
      body{padding:0;background:#fff;}
      .bill-page{width:210mm;min-height:unset;margin:0;padding:0 12mm;box-shadow:none;}
      .bill-page.letterhead{padding-top:0;}
      .btn-bar,.print-btn,.lh-toggle-label{display:none!important;}
      /* margin:0 lets the thead/tbody control all vertical spacing.
         Left/right margins give consistent side gutters on every page.
         Bottom margin gives breathing room below the last line of every page. */
      @page{ size:A4; margin: 0 0 12mm; }
    }
  </style>
</head>
<body>

  <script>
    function applyLh(on) {
      var wrap = document.getElementById('printWrap');
      var page = document.getElementById('billPage');
      if (!wrap || !page) return;
      if (on) {
        wrap.classList.add('lh-mode');
        page.classList.add('letterhead','lh-mode-page');
      } else {
        wrap.classList.remove('lh-mode');
        page.classList.remove('letterhead','lh-mode-page');
      }
      /* localStorage is inaccessible from a blob: URL (cross-origin) — skip */
    }
    /*
     * On load: the checkbox 'checked' attribute was already stamped by the
     * server-side builder to match the user's saved preference. Read that
     * baked-in value to sync the DOM classes, instead of trying to read
     * localStorage (which is always empty on a blob: origin).
     */
    (function() {
      var chk = document.getElementById('lhToggle');
      var on = chk ? chk.checked : false;
      applyLh(on);
    })();
  </script>

  <div class="btn-bar">
    <button class="print-btn" onclick="window.print()">🖨&nbsp; Print / Save PDF</button>
    <label class="lh-toggle-label"
      title="Hide the hospital header and leave blank space for pre-printed letterhead paper">
      <input type="checkbox" id="lhToggle"
        ${letterhead ? "checked" : ""}
        onchange="applyLh(this.checked)"/>
      📋&nbsp;Print on letterhead
    </label>
  </div>

  <div id="billPage" class="bill-page${letterhead ? " letterhead" : ""}">

  <!--
    print-wrap: a transparent single-column table whose <thead> causes the
    hospital header to repeat on every printed page. The <tbody> holds all
    remaining content and flows naturally — totals appear on the last page
    because that is simply where the content ends. Screen rendering is
    pixel-identical to the original flat layout.
  -->
  <table id="printWrap" class="print-wrap${letterhead ? " lh-mode" : ""}">

    <!-- REPEATED HEADER (every page).
         Normal mode : hospital logo/info repeats at top of every page.
         Letterhead mode: logo is hidden; the blank letterhead-space repeats
         instead, reserving the same height for the pre-printed paper header. -->
    <thead><tr><th>
      <!-- Hospital header — visible in normal mode, hidden in lh-mode -->
      <div class="header lh-hide">
        <div class="header-left">
          <img class="logo" src="${leftLogo}" alt="SEN Hospital Logo" onerror="this.style.display='none'">
          <div class="reg-no">(Regd. No. : CHENALL20210030927)</div>
        </div>
        <div class="hospital-info">
          <h1>SEN HOSPITAL</h1>
          <h2>MULTI - SPECIALITY CENTRE</h2>
          <p>New No.51, Old No. 18, Bunder Garden Street, Perambur, Chennai - 11.</p>
          <p>Tel : 25586896, 42769724 &nbsp;&nbsp; Cell : 9600899382, 7200207833</p>
          <p>Pharmacy : 8608679387</p>
          <p>Email : senhospital2@gmail.com &nbsp;&nbsp; www.senhospital.in</p>
        </div>
        <img class="logo right-logo" src="${rightLogo}" alt="NABH Seal" onerror="this.style.display='none'">
      </div>
      <!-- Letterhead spacer — hidden in normal mode, repeats on every page in lh-mode -->
      <div class="letterhead-space lh-show">
        <div class="lh-banner">📄 Pre-printed letterhead area (${lhSpace}) — header will show through when printed</div>
      </div>
    </th></tr></thead>

    <!-- BODY — bill title, then all content -->
    <tbody><tr><td>

      <div class="bill-title">${title}</div>
      <hr class="Line">

      <!-- BILL DETAILS -->
      <div class="details-grid">
        <div>
          <div class="detail-row"><b>Bill Number</b><span>:</span><span class="value">${claim.billNo ?? "—"}</span></div>
          <div class="detail-row"><b>UHID</b><span>:</span><span class="value">${claim.uhid}</span></div>
          <div class="detail-row"><b>Admission Date</b><span>:</span><span class="value">${fmtDate(claim.admissionDate, true)}</span></div>
          <div class="detail-row"><b>Ward</b><span>:</span><span class="value">${b?.ward ?? "—"}</span></div>
          <div class="detail-row"><b>Consultant</b><span>:</span><span class="value">${b?.doctorName ?? "—"}</span></div>
        </div>
        <div>
          <div class="detail-row"><b>Bill Date</b><span>:</span><span class="value">${fmtDate(b?.date, true)}</span></div>
          <div class="detail-row"><b>IP Number</b><span>:</span><span class="value">${claim.admissionNo ?? "—"}</span></div>
          ${showDischarge ? `<div class="detail-row"><b>Discharge Date</b><span>:</span><span class="value">${fmtDate(claim.dischargeDate, true)}</span></div>` : ""}
          <div class="detail-row"><b>Bed No</b><span>:</span><span class="value">${b?.bedNumber ?? "—"}</span></div>
        </div>
      </div>

      <!-- PATIENT -->
      <div class="patient-section">
        <div class="detail-row">
          <b>Patient Name</b><span>:</span>
          <span class="value">${claim.patientName.toUpperCase()}${b?.age ? " &nbsp;&nbsp; " + b.age + " Y" : ""}${b?.gender ? " / " + b.gender.toUpperCase() : ""}</span>
        </div>
        <div class="detail-row"><b>Contact No</b><span>:</span><span class="value">${b?.phone ?? "—"}</span></div>
        <div class="detail-row"><b>Address</b><span>:</span><span class="value">${b?.address ?? "—"}</span></div>
      </div>

      <!-- INSURANCE SECTION -->
      ${showIns ? `
      <div class="insurance-section">
        <div class="section-heading">Insurance Details :</div>
        <div class="details-grid" style="border:0;padding:0;">
          <div>
            <div class="detail-row">
              <b>Company / TPA Name</b><span>:</span>
              <span class="value">${claim.insuranceCompany}${claim.tpaName ? " / " + claim.tpaName : ""}</span>
            </div>
            <div class="detail-row">
              <b>Insured Person Name</b><span>:</span>
              <span class="value">${(claim.insuredPersonName || claim.patientName).toUpperCase()}</span>
            </div>
            <div class="detail-row">
              <b>Card No</b><span>:</span>
              <span class="value">${claim.cardNumber ?? claim.preAuthNumber ?? "—"}</span>
            </div>
          </div>
          <div>
            <div class="detail-row"><b>Policy No</b><span>:</span><span class="value">${claim.policyNo ?? "—"}</span></div>
            <div class="detail-row"><b>Claim No</b><span>:</span><span class="value">${claim.claimNo}</span></div>
          </div>
        </div>
      </div>` : ""}

      <!-- CHARGES TABLE -->
      <table class="charges-table${showDateCol ? " dated" : ""}">
        <thead>
          <tr>
            ${showDateCol ? `<th class="th-date">DATE</th>` : ""}
            <th>PARTICULARS</th>
            <th class="th-qty">QTY</th>
            <th class="th-rate">RATE</th>
            <th class="th-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- SUMMARY + PAYMENT + APPROVAL + FOOTER — wrapped to avoid page break splitting -->
      <div class="bill-tail">

      <!-- SUMMARY -->
      <div class="summary">
        ${showDateCol ? "" : `
        <div class="summary-row">
          <div></div>
          <div class="label">Gross Amount :</div>
          <div class="amount">${fmtAmt(grossAmt)}</div>
        </div>
        <div class="summary-row">
          <div></div>
          <div class="label">Discount Amount :</div>
          <div class="amount">${fmtAmt(discountAmt)}</div>
        </div>`}
        <div class="summary-row">
          <div class="amount-words"><span>In Words : </span><span>${numberToWords(billAmt)}</span></div>
          <div class="label">Bill Amount :</div>
          <div class="amount">${fmtAmt(billAmt)}</div>
        </div>
      </div>

      <!-- PAYMENT DETAILS (receipt ledger) -->
      ${paymentBlock}

      <!-- APPROVAL TABLE -->
      ${showApproval ? `
      <table class="approval-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Authorized Amount</th>
            <th>Co Payment Amount</th>
            <th>Claim Approved Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${fmtDate(claim.settledDate ?? claim.submittedDate, true)}</td>
            <td>${fmtAmt(authorizedAmt)}</td>
            <td>${fmtAmt(coPayAmt)}</td>
            <td>${fmtAmt(claimAprAmt)}</td>
          </tr>
        </tbody>
      </table>` : ""}

      <!-- FOOTER -->
      ${showDateCol ? `
      <div class="get-well">GET WELL SOON</div>` : `
      <div class="footer">
        <div class="prepared-by">
          <div>Bill Prepared By &nbsp;&nbsp; : &nbsp; ${preparedBy}</div>
          <div>Bill Verified By &nbsp;&nbsp;&nbsp; : &nbsp; ${preparedBy}</div>
        </div>
        <div class="signature">
          <div class="sign"><span>For &nbsp;</span><span class="signature-text">SEN HOSPITAL</span></div>
          <div class="signature-text">Authorized Signatory</div>
        </div>
      </div>`}

      </div><!-- end .bill-tail -->

    </td></tr></tbody>

  </table><!-- end .print-wrap -->

  </div><!-- end .bill-page -->

</body>
</html>`;
}
