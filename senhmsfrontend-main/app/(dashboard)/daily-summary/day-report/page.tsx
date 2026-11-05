"use client";

import { useState, useEffect } from "react";
import PageHeader from "../../../_components/PageHeader";
import Badge from "../../../_components/Badge";
import { HOSPITAL } from "../../../_lib/hospital-config";

// ─── helpers ─────────────────────────────────────────────────────────────────
function inr(n: number) { return "\u20B9" + n.toLocaleString("en-IN"); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtLong(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nowStamp() {
  return new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManualEntryResponse {
  id: number; sno: number;
  patientName: string; age: number; sex: string; visitType: string;
  consultantName: string; diagnosis: string;
  paymentMode: string; amount: number;
  paymentSplitsJson: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClaimItem {
  claimNo: string;
  billNo: string;
  patientName: string;
  insuranceCompany: string;
  claimedAmount: number;
  settledAmount: number;
  status: string;
}

interface ExpenseItem {
  expenseNo: string;
  category: string;
  towards: string;
  amount: number;
  paymentMode: string;
  status: string;
}

interface DailySummaryResponse {
  date: string;
  status: string;
  submittedBy: string | null;
  submittedAt: string | null;
  totalIncome: number;
  totalExpense: number;
  netCollection: number;
  manualEntries: ManualEntryResponse[];
  manualTotal: number; manualCash: number; manualUpi: number; manualCard: number; manualCheque: number;
  bills: unknown[];
  totalBillAmount: number; totalBillPaid: number;
  billCash: number; billCard: number; billUpi: number; billCheque: number; billInsurance: number;
  claims: ClaimItem[];
  totalClaimsSubmitted: number; totalClaimsSettled: number;
  expenses: ExpenseItem[];
  totalExpenses: number;
  expenseCash: number; expenseUpi: number; expenseCheque: number; expenseBankTransfer: number;
  opVisitCount: number; admittedCount: number; dischargedCount: number; appointmentCount: number;
}

interface PrintSettings {
  hospitalName: string; hospitalNameSecondary?: string; tagline?: string;
  address: string; city: string; state: string; pincode: string;
  phone: string; alternatePhone?: string; email?: string; website?: string;
  gstNo?: string; registrationNo?: string; logoBase64?: string;
  billSettings: { signatureName?: string; signatureDesignation?: string; };
}

type PaymentSplit = { mode: string; amount: number };

// ─── Print HTML builder ───────────────────────────────────────────────────────
function buildPrintHtml(args: {
  hs: PrintSettings;
  date: string;
  daySummary: DailySummaryResponse | null;
}): string {
  const { hs, date, daySummary } = args;

  const cashTotal   = (daySummary?.billCash ?? 0)   + (daySummary?.manualCash ?? 0);
  const upiTotal    = (daySummary?.billUpi ?? 0)    + (daySummary?.manualUpi ?? 0);
  const cardTotal   = (daySummary?.billCard ?? 0)   + (daySummary?.manualCard ?? 0);
  const chequeTotal = (daySummary?.billCheque ?? 0) + (daySummary?.manualCheque ?? 0);
  const collTotal   = daySummary?.totalIncome ?? 0;
  const insTotal    = daySummary?.totalClaimsSettled ?? 0;
  const expTotal    = daySummary?.totalExpenses ?? 0;
  const grandIncome = collTotal + insTotal;
  const netBalance  = grandIncome - expTotal;

  function thead(cols: string[]) {
    return `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;
  }
  function trow(cells: string[], cls = "") {
    return `<tr class="${cls}">${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
  }
  function tfoot(label: string, value: string, span: number) {
    return `<tr class="total-row"><td colspan="${span}" style="text-align:right;font-weight:700;">${label}</td><td style="text-align:right;font-weight:700;">${value}</td></tr>`;
  }

  // ── collection entries table (manual entries) ──
  const entries = daySummary?.manualEntries ?? [];
  const entryRows = entries.length
    ? entries.map((e, i) => {
        let modeCell = e.paymentMode;
        if (e.paymentSplitsJson) {
          try {
            const splits: PaymentSplit[] = JSON.parse(e.paymentSplitsJson);
            if (splits.length > 1) {
              modeCell = splits.map(sp => `${sp.mode}: ${inr(sp.amount)}`).join(" + ");
            }
          } catch { /* use paymentMode */ }
        }
        return trow([
          String(i + 1), e.patientName, `${e.age}/${e.sex}`, e.visitType,
          e.consultantName, e.diagnosis, modeCell,
          `<span style="float:right;">${inr(e.amount)}</span>`,
        ]);
      }).join("") +
      tfoot("Total Collection", `<span style="float:right;">${inr(collTotal)}</span>`, 7)
    : `<tr><td colspan="8" style="text-align:center;color:#888;font-style:italic;">No cash collection entry recorded for this date.</td></tr>`;

  // ── insurance claims table ──
  const claims = daySummary?.claims ?? [];
  const claimRows = claims.length
    ? claims.map((c, i) =>
        trow([
          String(i + 1), c.patientName, "—",
          c.insuranceCompany, "—",
          `<span style="float:right;">${inr(c.claimedAmount)}</span>`,
          `<span style="float:right;">—</span>`,
          `<span style="float:right;">—</span>`,
          `<span style="float:right;font-weight:700;">${inr(c.settledAmount ?? 0)}</span>`,
        ])
      ).join("") +
      `<tr class="total-row"><td colspan="8" style="text-align:right;font-weight:700;">Total Insurance Received</td><td style="text-align:right;font-weight:700;">${inr(insTotal)}</td></tr>`
    : `<tr><td colspan="9" style="text-align:center;color:#888;font-style:italic;">No insurance claims received on this date.</td></tr>`;

  // ── expenses table ──
  const expenses = daySummary?.expenses ?? [];
  const expRows = expenses.length
    ? expenses.map((e, i) =>
        trow([
          String(i + 1), e.expenseNo, e.category, e.towards,
          e.paymentMode, e.status,
          `<span style="float:right;">${inr(e.amount)}</span>`,
        ])
      ).join("") +
      tfoot("Total Expenses", `<span style="float:right;">${inr(expTotal)}</span>`, 6)
    : `<tr><td colspan="7" style="text-align:center;color:#888;font-style:italic;">No expenses recorded for this date.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Day Summary Report &mdash; ${fmtShort(date)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; background: #fff; padding: 12mm 14mm; }
  .letterhead { display: flex; align-items: flex-start; gap: 12px; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 8px; }
  .letterhead .logo-box { width: 70px; height: 70px; flex-shrink: 0; border: 2px solid #00059f; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #00059f; color: #fff; font-size: 28pt; font-weight: 900; line-height: 1; }
  .letterhead .logo-box img { width: 66px; height: 66px; object-fit: contain; border-radius: 4px; }
  .letterhead .hosp-details { flex: 1; text-align: center; }
  .letterhead .hosp-name { font-size: 20pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .letterhead .hosp-name-sec { font-size: 13pt; color: #333; margin-top: 2px; }
  .letterhead .tagline { font-size: 9pt; font-style: italic; color: #555; margin-top: 3px; }
  .letterhead .address { font-size: 9.5pt; margin-top: 4px; color: #222; }
  .letterhead .contact { font-size: 9pt; color: #333; margin-top: 2px; }
  .reg-line { font-size: 8.5pt; color: #444; margin-top: 3px; }
  .letterhead .report-meta { text-align: right; flex-shrink: 0; min-width: 110px; }
  .letterhead .report-meta .meta-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  .letterhead .report-meta .meta-date { font-size: 10.5pt; font-weight: 700; margin-top: 3px; }
  .letterhead .report-meta .meta-day { font-size: 8.5pt; color: #444; }
  .letterhead .report-meta .meta-print { font-size: 7.5pt; color: #888; margin-top: 4px; }
  .section-heading { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; border-top: 1.5px solid #000; border-bottom: 1px solid #000; padding: 3px 4px; margin: 12px 0 0; background: #f5f5f5; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 9.5pt; }
  th { background: #efefef; border: 1px solid #999; padding: 4px 6px; text-align: left; font-weight: 700; font-size: 9pt; text-transform: uppercase; }
  td { border: 1px solid #bbb; padding: 3px 6px; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  tr.total-row td { border-top: 2px solid #000; background: #efefef; font-size: 10pt; }
  .mode-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #999; margin-top: 4px; }
  .mode-cell { padding: 5px 8px; border-right: 1px solid #bbb; font-size: 9.5pt; }
  .mode-cell:last-child { border-right: none; }
  .mode-cell .mode-label { font-size: 8pt; color: #555; }
  .mode-cell .mode-val { font-size: 11pt; font-weight: 700; }
  .balance-box { border: 2px solid #000; margin-top: 14px; }
  .balance-box .bal-title { background: #000; color: #fff; text-align: center; font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 8px; }
  .balance-box table { border: none; font-size: 10pt; }
  .balance-box table td { border: none; border-bottom: 1px solid #ddd; padding: 5px 10px; }
  .balance-box table tr:last-child td { border-bottom: none; }
  .balance-box .grand-row td { font-size: 12pt; font-weight: 700; border-top: 2px solid #000; background: #f0f0f0; }
  .sig-section { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 8px; border-top: 1px solid #aaa; }
  .sig-block { text-align: center; min-width: 120px; }
  .sig-line { border-top: 1px solid #000; margin: 28px auto 4px; width: 100px; }
  .sig-label { font-size: 8.5pt; color: #333; }
  .print-footer { text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ccc; margin-top: 20px; padding-top: 6px; }
  @media print { body { padding: 0; } @page { size: A4 portrait; margin: 14mm 14mm 16mm; } }
</style>
</head>
<body>

<div class="letterhead">
  <div class="logo-box">
    ${hs.logoBase64
      ? `<img src="${hs.logoBase64}" alt="Hospital Logo" />`
      : `<span style="font-family:serif;font-size:26pt;font-weight:900;color:#fff;">&#x2695;</span>`
    }
  </div>
  <div class="hosp-details">
    <div class="hosp-name">${hs.hospitalName}</div>
    ${hs.hospitalNameSecondary ? `<div class="hosp-name-sec">${hs.hospitalNameSecondary}</div>` : ""}
    ${hs.tagline ? `<div class="tagline">${hs.tagline}</div>` : ""}
    <div class="address">${hs.address}, ${hs.city} &ndash; ${hs.pincode}, ${hs.state}</div>
    <div class="contact">
      Ph: ${hs.phone}${hs.alternatePhone ? " / " + hs.alternatePhone : ""}
      ${hs.email ? " &nbsp;|&nbsp; " + hs.email : ""}
      ${hs.website ? " &nbsp;|&nbsp; " + hs.website : ""}
    </div>
    <div class="reg-line">
      ${hs.registrationNo ? "Reg. No.: " + hs.registrationNo : ""}
      ${hs.gstNo ? " &nbsp;&nbsp; GSTIN: " + hs.gstNo : ""}
    </div>
  </div>
  <div class="report-meta">
    <div class="meta-label">Daily Summary Report</div>
    <div class="meta-date">${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
    <div class="meta-day">${new Date(date).toLocaleDateString("en-IN", { weekday: "long" })}</div>
    <div class="meta-print">Printed: ${nowStamp()}</div>
  </div>
</div>

<div class="section-heading">I. Cash Collection Summary</div>
<div class="mode-grid">
  <div class="mode-cell"><div class="mode-label">Cash</div><div class="mode-val">${inr(cashTotal)}</div></div>
  <div class="mode-cell"><div class="mode-label">UPI / Online</div><div class="mode-val">${inr(upiTotal)}</div></div>
  <div class="mode-cell"><div class="mode-label">Card (Debit / Credit)</div><div class="mode-val">${inr(cardTotal)}</div></div>
  <div class="mode-cell"><div class="mode-label">Cheque / DD</div><div class="mode-val">${inr(chequeTotal)}</div></div>
</div>
<table>
  ${thead(["S.No","Patient Name","Age/Sex","Type","Consultant","Diagnosis","Mode","Amount (₹)"])}
  ${entryRows}
</table>

<div class="section-heading">II. Insurance Claims Received</div>
<table>
  ${thead(["S.No","Patient Name","D.O.D","TPA / Company","Cheque No.","Claimed (₹)","Deducted (₹)","IT Ded. (₹)","Settled (₹)"])}
  ${claimRows}
</table>

<div class="section-heading">III. Expenses (Paid / Approved)</div>
<table>
  ${thead(["S.No","Exp. No.","Category","Towards","Mode","Status","Amount (₹)"])}
  ${expRows}
</table>

<div class="balance-box">
  <div class="bal-title">Day Balance Summary</div>
  <table>
    <tr><td style="width:60%">A. Total Collection (Cash + UPI + Card + Cheque)</td><td style="text-align:right;font-weight:600;">${inr(collTotal)}</td></tr>
    <tr><td>B. Insurance Claims Received</td><td style="text-align:right;font-weight:600;">${inr(insTotal)}</td></tr>
    <tr><td style="font-weight:700;">C. Gross Income &nbsp;(A + B)</td><td style="text-align:right;font-weight:700;border-top:1px solid #999;">${inr(grandIncome)}</td></tr>
    <tr><td>D. Total Expenses</td><td style="text-align:right;font-weight:600;">${inr(expTotal)}</td></tr>
    <tr class="grand-row"><td>E. Net Balance &nbsp;(C &minus; D)</td><td style="text-align:right;">${inr(netBalance)}</td></tr>
  </table>
</div>

<div class="sig-section">
  <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Prepared By</div></div>
  <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Verified By</div></div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <div class="sig-label">${hs.billSettings.signatureName ?? "Medical Director"}</div>
    <div class="sig-label">${hs.billSettings.signatureDesignation ?? "Authorised Signatory"}</div>
  </div>
</div>

<div class="print-footer">
  This is a computer-generated report. &nbsp;|&nbsp; ${hs.hospitalName}, ${hs.city}
  ${hs.website ? " &nbsp;|&nbsp; " + hs.website : ""}
</div>
</body>
</html>`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DayReportPage() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [settings,     setSettings]     = useState<PrintSettings | null>(null);
  const [daySummary,   setDaySummary]   = useState<DailySummaryResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Load hospital settings once. If this fails (e.g. older sessions without
  // settings read access), we still allow printing via a safe fallback below.
  useEffect(() => {
    apiFetch("/api/settings/hospital").then(({ ok, data }) => {
      if (ok && data) {
        const d = data as Record<string, unknown>;
        const mapped: PrintSettings = {
          hospitalName:          (d.hospitalName as string)  ?? "",
          hospitalNameSecondary: (d.hospitalNameSecondary as string) ?? undefined,
          tagline:               (d.tagline as string) ?? undefined,
          address:               (d.address as string) ?? "",
          city:                  (d.city as string) ?? "",
          state:                 (d.state as string) ?? "",
          pincode:               (d.pincode as string) ?? "",
          phone:                 (d.phone as string) ?? "",
          alternatePhone:        (d.alternatePhone as string) ?? undefined,
          email:                 (d.email as string) ?? undefined,
          website:               (d.website as string) ?? undefined,
          gstNo:                 (d.gstNo as string) ?? undefined,
          registrationNo:        (d.regNo as string) ?? undefined,
          logoBase64:            undefined,
          billSettings: {
            signatureName:        undefined,
            signatureDesignation: undefined,
          },
        };
        setSettings(mapped);
      }
    });
  }, []);

  // Load daily summary when date changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/daily-summary?date=${selectedDate}`)
      .then(({ ok, data, error: err }) => {
        if (ok) {
          setDaySummary(data as DailySummaryResponse);
        } else {
          setError(err);
          setDaySummary(null);
        }
      })
      .catch(() => setError("Failed to load daily summary"))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const cashTotal   = (daySummary?.billCash ?? 0)   + (daySummary?.manualCash ?? 0);
  const upiTotal    = (daySummary?.billUpi ?? 0)    + (daySummary?.manualUpi ?? 0);
  const cardTotal   = (daySummary?.billCard ?? 0)   + (daySummary?.manualCard ?? 0);
  const chequeTotal = (daySummary?.billCheque ?? 0) + (daySummary?.manualCheque ?? 0);
  const collTotal   = daySummary?.totalIncome ?? 0;
  const insTotal    = daySummary?.totalClaimsSettled ?? 0;
  const expTotal    = daySummary?.totalExpenses ?? 0;
  const netBalance  = daySummary?.netCollection ?? 0;

  const hasData = !!(daySummary && (
    (daySummary.manualEntries?.length ?? 0) > 0 ||
    (daySummary.bills?.length ?? 0) > 0 ||
    (daySummary.expenses?.length ?? 0) > 0 ||
    (daySummary.claims?.length ?? 0) > 0
  ));

  function handlePrint() {
    // Use loaded hospital settings when available; otherwise fall back to the
    // static hospital config so Print still works even if the settings fetch
    // failed (e.g. a session without settings read access). Printing must never
    // silently do nothing.
    const hs: PrintSettings = settings ?? {
      hospitalName:          HOSPITAL.fullName,
      hospitalNameSecondary: undefined,
      tagline:               HOSPITAL.tagline,
      address:               HOSPITAL.address,
      city:                  "Chennai",
      state:                 "Tamil Nadu",
      pincode:               "",
      phone:                 HOSPITAL.phones.join(", "),
      alternatePhone:        undefined,
      email:                 HOSPITAL.email,
      website:               HOSPITAL.website,
      gstNo:                 undefined,
      registrationNo:        HOSPITAL.regdNo,
      logoBase64:            undefined,
      billSettings: { signatureName: undefined, signatureDesignation: undefined },
    };

    const html = buildPrintHtml({ hs, date: selectedDate, daySummary });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank", "width=900,height=750");
    if (!win) {
      URL.revokeObjectURL(url);
      alert("Your browser blocked the print window. Please allow pop-ups for this site and click Print again.");
      return;
    }
    win.addEventListener("load", () => {
      win.focus();
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  const manualEntries = daySummary?.manualEntries ?? [];
  const claims        = daySummary?.claims ?? [];
  const expenses      = daySummary?.expenses ?? [];

  return (
    <div>
      <PageHeader
        title="Day Summary Report"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Daily Summary" }, { label: "Day Summary Report" }]}
      />

      {/* ── Date Selector ── */}
      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Select Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"/>
        </div>

        {/* Today shortcut */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Quick Select</label>
          <button onClick={() => setSelectedDate(today())}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedDate === today() ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-violet-400"}`}>
            Today
          </button>
        </div>

        {hasData && (
          <button onClick={handlePrint}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00059f] text-white text-sm font-semibold hover:bg-blue-900 transition-colors shadow">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Print / Save PDF
          </button>
        )}
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-16">
                <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-5 bg-slate-200 rounded w-1/3" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 bg-slate-200 rounded w-24" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
                <div className="h-3 bg-slate-200 rounded w-20" />
                <div className="h-3 bg-slate-200 rounded w-32" />
                <div className="h-3 bg-slate-200 rounded w-16" />
                <div className="h-3 bg-slate-200 rounded w-16" />
                <div className="h-5 bg-slate-200 rounded-full w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}
      {error && !loading && <div className="py-6 text-center text-red-500 text-sm">{error}</div>}

      {/* ── On-screen preview ── */}
      {!loading && !hasData && !error && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-sm font-medium text-slate-500">No data found for {fmtLong(selectedDate)}</p>
          <p className="text-xs mt-1 text-slate-400">Select a date that has collection, insurance or expense records.</p>
        </div>
      )}

      {!loading && hasData && (
        <div className="space-y-4">

          {/* Grand summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Total Collection", inr(collTotal),   "text-violet-700", "bg-violet-50 border-violet-200"],
              ["Insurance Received", inr(insTotal),  "text-teal-700",   "bg-teal-50 border-teal-200"],
              ["Expenses",          inr(expTotal),   "text-red-600",    "bg-red-50 border-red-200"],
              ["Net Balance",       inr(netBalance), netBalance >= 0 ? "text-emerald-700" : "text-red-700", "bg-slate-50 border-slate-200"],
            ].map(([label, val, textCls, bgCls]) => (
              <div key={label as string} className={`border rounded-xl px-4 py-3 ${bgCls as string}`}>
                <p className="text-xs font-medium text-slate-500">{label as string}</p>
                <p className={`text-xl font-extrabold mt-0.5 ${textCls as string}`}>{val as string}</p>
              </div>
            ))}
          </div>

          {/* Collection section */}
          <PreviewSection title="I. Cash Collection Summary">
            {manualEntries.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {([["💵 Cash", cashTotal, "text-green-700"],
                     ["📱 UPI / Online", upiTotal, "text-sky-700"],
                     ["💳 Card", cardTotal, "text-violet-700"],
                     ["🧾 Cheque / DD", chequeTotal, "text-amber-700"]] as [string, number, string][])
                    .map(([label, val, cls]) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400">{label}</p>
                        <p className={`text-base font-bold ${cls}`}>{inr(val)}</p>
                      </div>
                    ))}
                </div>
                <PreviewTable
                  headers={["#","Patient Name","Age/Sex","Type","Consultant","Diagnosis","Mode","Amount"]}
                  rows={manualEntries.map((e, i) => {
                    let mode = e.paymentMode;
                    if (e.paymentSplitsJson) {
                      try {
                        const splits: PaymentSplit[] = JSON.parse(e.paymentSplitsJson);
                        if (splits.length > 1) mode = splits.map(sp => `${sp.mode}: ${inr(sp.amount)}`).join(" + ");
                      } catch { /* keep paymentMode */ }
                    }
                    return [String(i + 1), e.patientName, `${e.age}/${e.sex}`, e.visitType, e.consultantName, e.diagnosis, mode, inr(e.amount)];
                  })}
                  totalLabel="Total Collection"
                  totalValue={inr(collTotal)}
                  totalSpan={7}
                />
              </>
            ) : <NoData text="No collection entry for this date." />}
          </PreviewSection>

          {/* Insurance section */}
          <PreviewSection title="II. Insurance Claims Received">
            {claims.length > 0 ? (
              <PreviewTable
                headers={["#","Patient Name","D.O.D","TPA","Cheque No","Claimed","Deducted","IT Ded.","Settled"]}
                rows={claims.map((c, i) => [
                  String(i + 1), c.patientName, "—", c.insuranceCompany, "—",
                  inr(c.claimedAmount), "—", "—", inr(c.settledAmount ?? 0),
                ])}
                totalLabel="Total Insurance Received"
                totalValue={inr(insTotal)}
                totalSpan={8}
              />
            ) : <NoData text="No insurance claims received on this date." />}
          </PreviewSection>

          {/* Expenses section */}
          <PreviewSection title="III. Expenses (Paid / Approved)">
            {expenses.length > 0 ? (
              <PreviewTable
                headers={["#","Exp. No.","Category","Towards","Mode","Status","Amount"]}
                rows={expenses.map((e, i) => [
                  String(i + 1), e.expenseNo, e.category, e.towards, e.paymentMode, e.status, inr(e.amount),
                ])}
                totalLabel="Total Expenses"
                totalValue={inr(expTotal)}
                totalSpan={6}
              />
            ) : <NoData text="No expenses recorded for this date." />}
          </PreviewSection>

          {/* Balance summary */}
          <div className="bg-white border-2 border-[#00059f] rounded-xl overflow-hidden">
            <div className="bg-[#00059f] px-5 py-2.5">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Day Balance Summary</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["A. Total Collection (Cash + UPI + Card + Cheque)", inr(collTotal), "font-semibold"],
                  ["B. Insurance Claims Received", inr(insTotal), "font-semibold"],
                  ["C. Gross Income  (A + B)", inr(collTotal + insTotal), "font-bold text-slate-900"],
                  ["D. Total Expenses", inr(expTotal), "font-semibold text-red-600"],
                  ["E. Net Balance  (C − D)", inr(netBalance), `font-extrabold text-lg ${netBalance >= 0 ? "text-emerald-700" : "text-red-700"}`],
                ].map(([label, val, cls], i) => (
                  <tr key={i} className={i === 4 ? "border-t-2 border-[#00059f] bg-slate-50" : "border-t border-slate-100"}>
                    <td className={`px-5 py-2.5 text-slate-700 ${cls as string}`}>{label as string}</td>
                    <td className={`px-5 py-2.5 text-right ${cls as string}`}>{val as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 text-center pt-1">
            Click "Print / Save PDF" to generate the formal A4 report with hospital letterhead.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Screen-only sub-components ───────────────────────────────────────────────
function PreviewSection({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
        {badge && <Badge label={badge} variant="gray" />}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PreviewTable({ headers, rows, totalLabel, totalValue, totalSpan }: {
  headers: string[]; rows: string[][]; totalLabel: string; totalValue: string; totalSpan: number;
}) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 text-slate-700 ${j === row.length - 1 ? "text-right font-semibold" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50">
            <td colSpan={totalSpan} className="px-3 py-2 text-right font-bold text-slate-700 text-xs uppercase tracking-wide">{totalLabel}</td>
            <td className="px-3 py-2 text-right font-bold text-slate-900">{totalValue}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 italic py-2">{text}</p>;
}
