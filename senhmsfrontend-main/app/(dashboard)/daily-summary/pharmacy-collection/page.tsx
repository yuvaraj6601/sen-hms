"use client";

import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import PageHeader from "../../../_components/PageHeader";
import Badge from "../../../_components/Badge";
import Modal, { FormField, Input, Select, Textarea } from "../../../_components/Modal";

// ─── helpers ──────────────────────────────────────────────────────────────────
function inr(n: number | string) {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return "₹" + (isNaN(v) ? "0" : Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function nowStamp() {
  return new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function n(v: unknown) { return parseFloat(String(v ?? 0)) || 0; }

// ─── Types ─────────────────────────────────────────────────────────────────────
type PMode = "CASH" | "CARD" | "DEBIT" | "UPI" | "INSURANCE" | "CHEQUE" | "MIXED";
const PMODES: PMode[] = ["CASH", "CARD", "DEBIT", "UPI", "INSURANCE", "CHEQUE", "MIXED"];
const SPLIT_MODES: Exclude<PMode, "MIXED">[] = ["CASH", "UPI", "DEBIT", "CARD", "INSURANCE", "CHEQUE"];

const MODE_LABEL: Record<PMode, string> = {
  CASH: "Cash", CARD: "Credit Card", DEBIT: "Debit Card", UPI: "UPI",
  INSURANCE: "Insurance", CHEQUE: "Cheque", MIXED: "Mixed",
};
const MODE_COLOR: Record<PMode, string> = {
  CASH:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD:      "bg-violet-50  text-violet-700  border-violet-200",
  DEBIT:     "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  UPI:       "bg-blue-50    text-blue-700    border-blue-200",
  INSURANCE: "bg-sky-50     text-sky-700     border-sky-200",
  CHEQUE:    "bg-amber-50   text-amber-700   border-amber-200",
  MIXED:     "bg-slate-50   text-slate-700   border-slate-200",
};

// Backend PharmacyPaymentMode enum does not include DEBIT — map it to CARD for the
// top-level paymentMode field. The precise breakdown is preserved in the splits JSON.
function toBackendMode(m: PMode): Exclude<PMode, "DEBIT"> {
  return m === "DEBIT" ? "CARD" : m;
}

interface PaymentSplit { mode: Exclude<PMode, "MIXED">; amount: number; }

interface PharmacyPaymentRecord {
  id: number;
  entryId: number;
  paymentDate: string;
  amount: string;
  paymentMode: PMode;
  paymentSplitsJson: string | null;
  advance: boolean;
  notes: string;
  createdAt: string;
}

interface PharmacyReturnRecord {
  id: number;
  entryId: number;
  returnDate: string;
  returnAmount: string;
  paymentMode: PMode;
  notes: string;
  createdAt: string;
}

interface PharmacyEntry {
  id: number;
  entryNo: string;
  entryDate: string;
  sno: number;
  patientName: string;
  insuranceName: string;
  totalAmount: string;
  paidToDate: string;
  totalReturned: string;
  outstanding: string;        // total − returned − paid ; negative = refund due
  collectedOnDate: string;    // collected on the selected report date
  returnedOnDate: string;     // returned on the selected report date
  notes: string;
  createdAt: string;
  payments: PharmacyPaymentRecord[];
  returns: PharmacyReturnRecord[];
}

// ─── Form state ─────────────────────────────────────────────────────────────
interface EntryForm {
  patientName: string;
  insuranceName: string;
  splits: PaymentSplit[];
  notes: string;
}
interface PayForm {
  paymentDate: string;
  amount: string;
  paymentMode: PMode;
  splits: PaymentSplit[];
  notes: string;
}
interface ReturnForm {
  returnDate: string;
  returnAmount: string;
  paymentMode: Exclude<PMode, "MIXED">;
  notes: string;
}

function emptyEntry(): EntryForm {
  return { patientName: "", insuranceName: "", splits: [{ mode: "CASH", amount: 0 }], notes: "" };
}
function emptyPay(): PayForm {
  return { paymentDate: today(), amount: "", paymentMode: "CASH", splits: [], notes: "" };
}
function emptyReturn(): ReturnForm {
  return { returnDate: today(), returnAmount: "", paymentMode: "CASH", notes: "" };
}
function splitTotal(splits: PaymentSplit[]) {
  return splits.reduce((s, sp) => s + (sp.amount || 0), 0);
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SCard({ label, value, color = "text-slate-700", sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs text-slate-500 mb-0.5 font-medium">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Table skeleton loader ─────────────────────────────────────────────────────
function Bar({ w = "w-full" }: { w?: string }) {
  return <div className={`h-3.5 rounded bg-slate-200/80 ${w}`} />;
}
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <table className="w-full text-sm animate-pulse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 uppercase tracking-wide">
          <th className="px-4 py-3 w-8"></th>
          <th className="px-4 py-3 text-left w-12">#</th>
          <th className="px-4 py-3 text-left">Patient</th>
          <th className="px-4 py-3 text-right">Collected Today (₹)</th>
          <th className="px-4 py-3 text-right">Returned Today (₹)</th>
          <th className="px-4 py-3 text-right">Net Today (₹)</th>
          <th className="px-4 py-3 text-center w-40">Actions</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-b border-slate-100">
            <td className="px-3 py-4"><div className="w-6 h-6 rounded-full bg-slate-200/80 mx-auto" /></td>
            <td className="px-4 py-4"><Bar w="w-4" /></td>
            <td className="px-4 py-4">
              <div className="space-y-1.5">
                <Bar w="w-32" />
                <Bar w="w-20" />
              </div>
            </td>
            <td className="px-4 py-4"><Bar w="w-16 ml-auto" /></td>
            <td className="px-4 py-4"><Bar w="w-14 ml-auto" /></td>
            <td className="px-4 py-4"><Bar w="w-16 ml-auto" /></td>
            <td className="px-4 py-4">
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-12 h-7 rounded-lg bg-slate-200/80" />
                <div className="w-12 h-7 rounded-lg bg-slate-200/80" />
                <div className="w-7 h-7 rounded-lg bg-slate-200/80" />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Split payment editor (shared by Add-Entry advance and Pay modals) ─────────
function SplitEditor({
  splits, onAdd, onRemove, onUpdate,
}: {
  splits: PaymentSplit[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: keyof PaymentSplit, val: unknown) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">Payment Splits</p>
        <button type="button" onClick={onAdd} className="text-xs text-sky-600 hover:text-sky-800 font-medium">+ Add split</button>
      </div>
      {splits.map((sp, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={sp.mode} onChange={e => onUpdate(i, "mode", e.target.value)} className="w-36">
            {SPLIT_MODES.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </Select>
          <Input
            type="number" min={0} step={0.01}
            value={sp.amount || ""}
            onChange={e => onUpdate(i, "amount", parseFloat(e.target.value) || 0)}
            placeholder="Amount" className="flex-1"
          />
          <button type="button" onClick={() => onRemove(i)}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}
      {splits.length > 0 && (
        <p className="text-xs text-slate-500 text-right">
          Total: <span className="font-semibold text-slate-700">{inr(splitTotal(splits))}</span>
        </p>
      )}
    </div>
  );
}

// ─── Hospital settings for print ───────────────────────────────────────────────
interface HospitalSettings {
  hospitalName: string; hospitalNameSecondary?: string; tagline?: string;
  address: string; city: string; state: string; pinCode?: string;
  phone: string; alternatePhone?: string; email?: string; website?: string;
  regNo?: string; gstNo?: string; logoBase64?: string;
}
const DEFAULT_HS: HospitalSettings = {
  hospitalName: "Sen Hospital", tagline: "Multi-Speciality Centre",
  address: "New No.51, Old No.18, Bunder Garden Street, Perambur",
  city: "Chennai", state: "Tamil Nadu", pinCode: "600011",
  phone: "044-25586896 / 9600899382", email: "senhospital2@gmail.com",
  website: "www.senhospital.in", regNo: "CHENALL20210030927",
};
function ri(v: number) {
  return v > 0 ? v.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "";
}

/**
 * A5 landscape receipt for a pharmacy return / cash refund.
 * Lists the dates money was collected so far, the amount returned, and net kept.
 */
function buildReturnReceiptHtml(
  entry: PharmacyEntry,
  returnAmt: number,
  cashRefund: number,
  returnDate: string,
  mode: string,
  notes: string,
  hs: HospitalSettings,
): string {
  const modeLabel = MODE_LABEL[mode as PMode] ?? mode;
  const collectedSoFar = n(entry.paidToDate);
  const netKept = collectedSoFar - returnAmt;

  // Each positive payment is a "collected on <date>" row. Negative amounts are
  // earlier cash refunds and are shown as returns.
  const payRows = (entry.payments ?? [])
    .filter(p => n(p.amount) > 0)
    .map(p => {
      const splitTxt = p.paymentMode === "MIXED" && p.paymentSplitsJson
        ? (() => { try { const s: PaymentSplit[] = JSON.parse(p.paymentSplitsJson!); return " (" + s.map(x => `${MODE_LABEL[x.mode]} ${ri(x.amount)}`).join(", ") + ")"; } catch { return ""; } })()
        : "";
      return `<tr>
        <td style="border:1px solid #bbb;padding:3px 8px;">${fmt(p.paymentDate)}</td>
        <td style="border:1px solid #bbb;padding:3px 8px;">${MODE_LABEL[p.paymentMode] ?? p.paymentMode}${splitTxt}</td>
        <td style="border:1px solid #bbb;padding:3px 8px;text-align:right;">&#x20B9;${ri(n(p.amount))}</td>
      </tr>`;
    }).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Pharmacy Return Receipt</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Times New Roman",Times,serif; font-size:11pt; color:#000; background:#fff; padding:8mm 10mm; }
.lh { display:flex; align-items:flex-start; gap:10px; border-bottom:3px double #000; padding-bottom:6px; margin-bottom:8px; }
.lh-logo { width:54px; height:54px; flex-shrink:0; border:2px solid #00059f; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#00059f; color:#fff; font-size:22pt; font-weight:900; }
.lh-logo img { width:50px; height:50px; object-fit:contain; border-radius:3px; }
.lh-mid { flex:1; text-align:center; }
.lh-name { font-size:17pt; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
.lh-tag  { font-size:8.5pt; font-style:italic; color:#444; }
.lh-addr { font-size:8.5pt; color:#222; margin-top:2px; }
.lh-ph   { font-size:8pt; color:#444; margin-top:1px; }
.lh-right { text-align:right; min-width:150px; flex-shrink:0; }
.lh-title { font-size:13pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
.lh-date  { font-size:9.5pt; color:#222; margin-top:3px; }
.lh-print { font-size:7.5pt; color:#999; margin-top:2px; }
.cols { display:flex; gap:14px; align-items:flex-start; }
.col-l { flex:1.3; }
.col-r { flex:1; }
.info { font-size:10pt; margin-bottom:3px; }
.info .l { color:#555; display:inline-block; min-width:92px; }
.info .v { font-weight:600; }
table { width:100%; border-collapse:collapse; font-size:9.5pt; margin-top:4px; }
th { background:#e8e8e8; border:1px solid #888; padding:3px 8px; text-align:left; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.3px; }
th.r { text-align:right; }
.sumbox { border:1px solid #999; margin-top:6px; }
.sumrow { display:flex; justify-content:space-between; padding:4px 10px; border-bottom:1px solid #ddd; font-size:10.5pt; }
.sumrow:last-child { border-bottom:none; }
.sumrow .v { font-weight:700; }
.ret { background:#fff7ed; color:#9a3412; }
.net { background:#ecfdf5; color:#065f46; font-size:11.5pt; }
.bignum { font-size:15pt; font-weight:900; }
.sig { display:flex; justify-content:space-between; margin-top:26px; }
.sig-blk { text-align:center; min-width:120px; }
.sig-line { border-top:1px solid #000; margin:22px auto 3px; width:100px; }
.sig-lbl { font-size:8.5pt; color:#333; }
.footer { text-align:center; font-size:7.5pt; color:#888; border-top:1px solid #ccc; margin-top:12px; padding-top:4px; }
@media print { body { padding:0; } @page { size:A5 landscape; margin:8mm; } }
</style></head><body>

<div class="lh">
  <div class="lh-logo">${hs.logoBase64 ? `<img src="${hs.logoBase64}" alt="Logo"/>` : `<span>&#x2695;</span>`}</div>
  <div class="lh-mid">
    <div class="lh-name">${hs.hospitalName}</div>
    ${hs.tagline ? `<div class="lh-tag">${hs.tagline}</div>` : ""}
    <div class="lh-addr">${hs.address}, ${hs.city}${hs.pinCode ? " &ndash; " + hs.pinCode : ""}, ${hs.state}</div>
    <div class="lh-ph">Ph: ${hs.phone}${hs.email ? " &nbsp;|&nbsp; " + hs.email : ""}</div>
  </div>
  <div class="lh-right">
    <div class="lh-title">Pharmacy<br/>Return Receipt</div>
    <div class="lh-date">Return Date: ${fmt(returnDate)}</div>
    <div class="lh-print">Printed: ${nowStamp()}</div>
  </div>
</div>

<div class="cols">
  <div class="col-l">
    <div class="info"><span class="l">Patient</span><span class="v">${entry.patientName}</span></div>
    <div class="info"><span class="l">Entry No</span><span class="v">${entry.entryNo}</span></div>
    <div class="info"><span class="l">Opened On</span><span class="v">${fmt(entry.entryDate.toString())}</span></div>
    ${entry.insuranceName ? `<div class="info"><span class="l">Insurance</span><span class="v">${entry.insuranceName}</span></div>` : ""}

    <table>
      <thead>
        <tr>
          <th style="width:90px;">Collected On</th>
          <th>Mode</th>
          <th class="r" style="width:90px;">Amount (&#x20B9;)</th>
        </tr>
      </thead>
      <tbody>
        ${payRows || `<tr><td colspan="3" style="border:1px solid #bbb;padding:4px 8px;text-align:center;color:#999;font-style:italic;">No payments recorded.</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="col-r">
    <div class="sumbox">
      <div class="sumrow"><span>Collected So Far</span><span class="v">&#x20B9;${ri(collectedSoFar)}</span></div>
      <div class="sumrow ret"><span>Amount Returned${modeLabel ? ` (${modeLabel})` : ""}</span><span class="v">&#x2212; &#x20B9;${ri(returnAmt)}</span></div>
      <div class="sumrow net"><span>Net Amount Kept</span><span class="bignum">&#x20B9;${ri(netKept > 0 ? netKept : 0)}</span></div>
    </div>
    ${cashRefund > 0
      ? `<div class="sumrow ret" style="border:1px solid #f59e0b;margin-top:8px;"><span>Cash Returned to Patient</span><span class="bignum">&#x20B9;${ri(cashRefund)}</span></div>`
      : ""}
    ${notes ? `<div class="info" style="margin-top:8px;"><span class="l">Notes</span><span>${notes}</span></div>` : ""}
  </div>
</div>

<div class="sig">
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Patient Signature</div></div>
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Pharmacist</div></div>
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Authorised Signatory</div></div>
</div>

<div class="footer">
  Computer-generated receipt. &nbsp;|&nbsp; ${hs.hospitalName}, ${hs.city}${hs.website ? " &nbsp;|&nbsp; " + hs.website : ""}
</div>
</body></html>`;
}

/**
 * Print HTML for the selected day — a standalone cash register.
 * Columns: Patient | Mode(s) | Collected today | Returned today | Net today.
 */
function buildPrintHtml(entries: PharmacyEntry[], date: string, hs: HospitalSettings): string {
  let tCollectedToday = 0, tReturnedToday = 0;

  // Mode breakdown of the net collected on this day, aggregated across patients.
  const modeTotals: Record<string, number> = {};

  const rows = entries.length
    ? entries.map((e, i) => {
        const net         = n(e.collectedOnDate);      // payments today − returns today
        const returnedTdy = n(e.returnedOnDate);
        const grossColl   = net + returnedTdy;         // cash received today
        tCollectedToday  += grossColl;
        tReturnedToday   += returnedTdy;

        // Which modes were used today (from payments dated today)
        const todaysModes = new Set<string>();
        (e.payments ?? []).forEach(p => {
          if (p.paymentDate === date && n(p.amount) > 0) {
            if (p.paymentMode === "MIXED" && p.paymentSplitsJson) {
              try { (JSON.parse(p.paymentSplitsJson) as PaymentSplit[]).forEach(s => { todaysModes.add(MODE_LABEL[s.mode] ?? s.mode); modeTotals[s.mode] = (modeTotals[s.mode] ?? 0) + (s.amount || 0); }); }
              catch { todaysModes.add("Mixed"); }
            } else {
              todaysModes.add(MODE_LABEL[p.paymentMode] ?? p.paymentMode);
              modeTotals[p.paymentMode] = (modeTotals[p.paymentMode] ?? 0) + n(p.amount);
            }
          }
        });
        const modeTxt = todaysModes.size ? Array.from(todaysModes).join(", ") : "—";

        const netStyle = net > 0 ? `color:#166534;font-weight:700;` : net < 0 ? `color:#b45309;font-weight:700;` : `color:#999;`;
        const netCell = net !== 0
          ? `<span style="${netStyle}">${net < 0 ? "−" : ""}${ri(Math.abs(net))}</span>`
          : `<span style="color:#aaa;">—</span>`;

        return `<tr>
          <td style="border:1px solid #bbb;padding:3px 6px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #bbb;padding:3px 6px;">
            <span style="font-weight:600;">${e.patientName}</span>${e.insuranceName ? `<br/><span style="font-size:8pt;color:#0369a1;">${e.insuranceName}</span>` : ""}
          </td>
          <td style="border:1px solid #bbb;padding:3px 6px;font-size:8.5pt;">${modeTxt}</td>
          <td style="border:1px solid #bbb;padding:3px 6px;text-align:right;">${grossColl > 0 ? ri(grossColl) : "—"}</td>
          <td style="border:1px solid #bbb;padding:3px 6px;text-align:right;color:#b45309;">${returnedTdy > 0 ? "− " + ri(returnedTdy) : "—"}</td>
          <td style="border:1px solid #bbb;padding:3px 6px;text-align:right;">${netCell}</td>
        </tr>`;
      }).join("") +
      `<tr style="background:#f0f0f0;font-weight:700;font-size:10pt;">
        <td colspan="3" style="border:1px solid #888;padding:4px 6px;text-align:right;">Totals</td>
        <td style="border:1px solid #888;padding:4px 6px;text-align:right;color:#166534;">${ri(tCollectedToday)}</td>
        <td style="border:1px solid #888;padding:4px 6px;text-align:right;color:#b45309;">${tReturnedToday > 0 ? "− " + ri(tReturnedToday) : "—"}</td>
        <td style="border:1px solid #888;padding:4px 6px;text-align:right;color:#166534;">${ri(tCollectedToday - tReturnedToday)}</td>
      </tr>`
    : `<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic;padding:12px;">No activity for this date.</td></tr>`;

  // Mode breakdown chips for the summary (net cash by mode)
  const modeChips = Object.entries(modeTotals)
    .filter(([, v]) => v > 0)
    .map(([m, v]) => `<span style="display:inline-block;margin:0 6px 0 0;padding:2px 8px;border:1px solid #bbb;border-radius:10px;font-size:8.5pt;">${MODE_LABEL[m as PMode] ?? m}: ₹${ri(v)}</span>`)
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Pharmacy Cash Collection — ${fmt(date)}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Times New Roman",Times,serif; font-size:10.5pt; color:#000; background:#fff; padding:10mm 12mm; }
.lh { display:flex; align-items:flex-start; gap:10px; border-bottom:3px double #000; padding-bottom:8px; margin-bottom:6px; }
.lh-logo { width:64px; height:64px; flex-shrink:0; border:2px solid #00059f; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#00059f; color:#fff; font-size:26pt; font-weight:900; }
.lh-logo img { width:60px; height:60px; object-fit:contain; border-radius:3px; }
.lh-mid { flex:1; text-align:center; }
.lh-name { font-size:18pt; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
.lh-tag  { font-size:9pt;  font-style:italic; color:#444; margin-top:2px; }
.lh-addr { font-size:9pt;  color:#222; margin-top:3px; }
.lh-ph   { font-size:8.5pt; color:#444; margin-top:2px; }
.lh-reg  { font-size:8pt;  color:#666; margin-top:2px; }
.lh-right { text-align:right; min-width:110px; flex-shrink:0; }
.lh-title { font-size:12pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
.lh-date  { font-size:10pt; color:#222; margin-top:3px; }
.lh-print { font-size:7.5pt; color:#999; margin-top:3px; }
.sum-bar { display:flex; border:1px solid #bbb; margin-bottom:6px; }
.sum-cell { flex:1; padding:4px 6px; text-align:center; border-right:1px solid #bbb; }
.sum-cell:last-child { border-right:none; }
.sum-lbl { font-size:7.5pt; color:#555; }
.sum-val { font-size:10pt; font-weight:700; }
.title-bar { font-size:11pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:center; border:2px solid #000; padding:3px; margin-bottom:0; background:#fff; }
table { width:100%; border-collapse:collapse; font-size:9.5pt; }
table th { background:#e8e8e8; border:1px solid #888; padding:3px 5px; text-align:center; font-size:8.5pt; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; }
table td { border:1px solid #bbb; padding:2px 5px; vertical-align:middle; }
.sig { display:flex; justify-content:space-between; margin-top:20px; padding-top:6px; border-top:1px solid #aaa; }
.sig-blk { text-align:center; min-width:110px; }
.sig-line { border-top:1px solid #000; margin:26px auto 3px; width:90px; }
.sig-lbl { font-size:8pt; color:#333; }
.footer { text-align:center; font-size:7.5pt; color:#888; border-top:1px solid #ccc; margin-top:16px; padding-top:4px; }
@media print { body { padding:0; } @page { size:A4 portrait; margin:12mm 12mm 14mm; } }
</style></head><body>

<div class="lh">
  <div class="lh-logo">${hs.logoBase64 ? `<img src="${hs.logoBase64}" alt="Logo"/>` : `<span>&#x2695;</span>`}</div>
  <div class="lh-mid">
    <div class="lh-name">${hs.hospitalName}</div>
    ${hs.tagline ? `<div class="lh-tag">${hs.tagline}</div>` : ""}
    <div class="lh-addr">${hs.address}, ${hs.city}${hs.pinCode ? " &ndash; " + hs.pinCode : ""}, ${hs.state}</div>
    <div class="lh-ph">Ph: ${hs.phone}${hs.alternatePhone ? " / " + hs.alternatePhone : ""}${hs.email ? " &nbsp;|&nbsp; " + hs.email : ""}</div>
    ${hs.regNo ? `<div class="lh-reg">Regd. No.: ${hs.regNo}${hs.gstNo ? " &nbsp;|&nbsp; GSTIN: " + hs.gstNo : ""}</div>` : ""}
  </div>
  <div class="lh-right">
    <div class="lh-title">Pharmacy<br/>Cash Collection</div>
    <div class="lh-date">Date: ${fmt(date)}</div>
    <div class="lh-print">Printed: ${nowStamp()}</div>
  </div>
</div>

<div class="sum-bar">
  <div class="sum-cell"><div class="sum-lbl">Collected Today</div><div class="sum-val" style="color:#166534;">₹${ri(tCollectedToday) || "0.00"}</div></div>
  <div class="sum-cell"><div class="sum-lbl">Returned Today</div><div class="sum-val" style="color:#b45309;">₹${ri(tReturnedToday) || "0.00"}</div></div>
  <div class="sum-cell"><div class="sum-lbl">Net Cash Today</div><div class="sum-val" style="color:#166534;">₹${ri(tCollectedToday - tReturnedToday) || "0.00"}</div></div>
</div>

${modeChips ? `<div style="margin-bottom:6px;font-size:8.5pt;color:#555;"><strong style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.3px;">By mode:</strong> ${modeChips}</div>` : ""}

<div class="title-bar">PHARMACY CASH COLLECTION &nbsp;&nbsp; Net Cash Today ₹${ri(tCollectedToday - tReturnedToday) || "0.00"}</div>

<table>
  <thead>
    <tr>
      <th style="width:26px;">S.No.</th>
      <th>Patient Name</th>
      <th style="width:120px;">Mode(s)</th>
      <th style="width:85px;">Collected<br/>Today</th>
      <th style="width:85px;">Returned<br/>Today</th>
      <th style="width:85px;">Net Today</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="sig">
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Prepared By</div></div>
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Verified By</div></div>
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Pharmacist In-Charge</div></div>
  <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Authorised Signatory</div></div>
</div>

<div class="footer">
  This is a computer-generated report. &nbsp;|&nbsp; ${hs.hospitalName}, ${hs.city}${hs.website ? " &nbsp;|&nbsp; " + hs.website : ""}
</div>
</body></html>`;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PharmacyCashCollectionPage() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [entries, setEntries]           = useState<PharmacyEntry[]>([]);
  const [loading, setLoading]           = useState(false);
  const [apiError, setApiError]         = useState("");
  const [search, setSearch]             = useState("");
  const [printing, setPrinting]         = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  // entry modal (create/edit account)
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry]     = useState<PharmacyEntry | null>(null);
  const [entryForm, setEntryForm]           = useState<EntryForm>(emptyEntry());
  const [entryErrors, setEntryErrors]       = useState<Partial<Record<keyof EntryForm | "splits", string>>>({});
  const [entrySaving, setEntrySaving]       = useState(false);
  const [entryApiErr, setEntryApiErr]       = useState("");

  // pay modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForEntry, setPayForEntry]   = useState<PharmacyEntry | null>(null);
  const [payForm, setPayForm]           = useState<PayForm>(emptyPay());
  const [payErrors, setPayErrors]       = useState<Partial<Record<keyof PayForm | "splits", string>>>({});
  const [paySaving, setPaySaving]       = useState(false);
  const [payApiErr, setPayApiErr]       = useState("");

  // return modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnForEntry, setReturnForEntry]   = useState<PharmacyEntry | null>(null);
  const [returnForm, setReturnForm]           = useState<ReturnForm>(emptyReturn());
  const [returnErrors, setReturnErrors]       = useState<Partial<ReturnForm>>({});
  const [returnSaving, setReturnSaving]       = useState(false);
  const [returnApiErr, setReturnApiErr]       = useState("");

  // find-patient modal
  const [findModalOpen, setFindModalOpen] = useState(false);
  const [findQuery, setFindQuery]         = useState("");
  const [findResults, setFindResults]     = useState<PharmacyEntry[]>([]);
  const [findLoading, setFindLoading]     = useState(false);
  const [findErr, setFindErr]             = useState("");

  // delete confirms
  const [deleteTarget, setDeleteTarget]               = useState<PharmacyEntry | null>(null);
  const [deletePayTarget, setDeletePayTarget]         = useState<{ entry: PharmacyEntry; pay: PharmacyPaymentRecord } | null>(null);
  const [deleteReturnTarget, setDeleteReturnTarget]   = useState<{ entry: PharmacyEntry; ret: PharmacyReturnRecord } | null>(null);
  const [deleting, setDeleting]                       = useState(false);

  // ── Load entries for selected date ───────────────────────────────────────────
  const loadEntries = useCallback(async (date: string) => {
    setLoading(true); setApiError("");
    try {
      const res  = await fetch(`/api/pharmacy?date=${date}`);
      const json = await res.json();
      if (json.success) setEntries(json.data ?? []);
      else { setApiError(json.error ?? "Failed to load entries"); setEntries([]); }
    } catch {
      setApiError("Cannot reach server"); setEntries([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(selectedDate); }, [selectedDate, loadEntries]);

  // ── Filtered entries ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.patientName.toLowerCase().includes(q) ||
      (e.insuranceName ?? "").toLowerCase().includes(q) ||
      e.entryNo.toLowerCase().includes(q)
    );
  }, [entries, search]);

  // ── Summary totals ───────────────────────────────────────────────────────────
  // collectedOnDate from backend is already NET (payments today − returns today).
  const totals = useMemo(() => {
    const t = { collectedToday: 0, returnedToday: 0 };
    filtered.forEach(e => {
      t.collectedToday += n(e.collectedOnDate);
      t.returnedToday  += n(e.returnedOnDate);
    });
    return t;
  }, [filtered]);

  function toggleExpand(id: number) { setExpandedId(prev => prev === id ? null : id); }

  // ── Entry (account) handlers ──────────────────────────────────────────────────
  function openAddEntry() {
    setEntryForm(emptyEntry()); setEntryErrors({}); setEntryApiErr(""); setEditingEntry(null); setEntryModalOpen(true);
  }
  function openEditEntry(e: PharmacyEntry) {
    setEntryForm({
      patientName: e.patientName, insuranceName: e.insuranceName ?? "",
      splits: [{ mode: "CASH", amount: 0 }],
      notes: e.notes ?? "",
    });
    setEntryErrors({}); setEntryApiErr(""); setEditingEntry(e); setEntryModalOpen(true);
  }
  function updateEntryField<K extends keyof EntryForm>(k: K, v: EntryForm[K]) {
    setEntryForm(p => ({ ...p, [k]: v }));
  }
  function addEntrySplit() {
    setEntryForm(p => {
      const used = new Set(p.splits.map(s => s.mode));
      const next = SPLIT_MODES.find(m => !used.has(m)) ?? "CASH";
      return { ...p, splits: [...p.splits, { mode: next, amount: 0 }] };
    });
  }
  function removeEntrySplit(i: number) {
    setEntryForm(p => ({ ...p, splits: p.splits.filter((_, xi) => xi !== i) }));
  }
  function updateEntrySplit(i: number, field: keyof PaymentSplit, val: unknown) {
    setEntryForm(p => ({ ...p, splits: p.splits.map((s, xi) => xi === i ? { ...s, [field]: val } : s) }));
  }
  function validateEntry() {
    const e: Partial<Record<keyof EntryForm | "splits", string>> = {};
    if (!entryForm.patientName.trim()) e.patientName = "Required";
    // A new day-1 entry must carry an amount collected (one or more split rows).
    if (!editingEntry) {
      const paidRows = entryForm.splits.filter(s => (s.amount || 0) > 0);
      if (paidRows.length === 0) e.splits = "Enter the amount collected (at least one row > 0)";
    }
    setEntryErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveEntry() {
    if (!validateEntry()) return;
    setEntrySaving(true); setEntryApiErr("");

    // Only keep split rows that actually carry an amount
    const paidRows = entryForm.splits.filter(s => (s.amount || 0) > 0);
    const amountPaid = splitTotal(paidRows);
    // Single row → use that mode directly; multiple rows → MIXED with a breakdown JSON
    const mode: PMode = paidRows.length > 1 ? "MIXED" : (paidRows[0]?.mode ?? "CASH");
    const splitsJson = paidRows.length > 1
      ? JSON.stringify(paidRows.map(s => ({ mode: s.mode, amount: s.amount })))
      : null;

    // Standalone register: there is no fixed "medicine total". We set the account
    // total equal to the amount collected so the backend's outstanding is always 0.
    const body: Record<string, unknown> = {
      entryDate:     selectedDate,
      patientName:   entryForm.patientName.trim(),
      insuranceName: entryForm.insuranceName.trim() || null,
      totalAmount:   editingEntry ? n(editingEntry.totalAmount) : amountPaid,
      notes:         entryForm.notes.trim() || null,
    };
    // Day-1 collection is recorded as the initial payment on the entry date
    if (!editingEntry && amountPaid > 0) {
      body.advanceAmount      = amountPaid;
      body.advancePaymentMode = toBackendMode(mode);
      body.advanceSplitsJson  = splitsJson;
    }

    try {
      const res = await fetch(
        editingEntry ? `/api/pharmacy/${editingEntry.id}` : "/api/pharmacy",
        { method: editingEntry ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const json = await res.json();
      if (json.success) { setEntryModalOpen(false); await loadEntries(selectedDate); }
      else setEntryApiErr(json.error ?? "Save failed");
    } catch { setEntryApiErr("Cannot reach server"); }
    finally { setEntrySaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/pharmacy/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        if (expandedId === deleteTarget.id) setExpandedId(null);
        setDeleteTarget(null); await loadEntries(selectedDate);
      } else alert(json.error ?? "Delete failed");
    } catch { alert("Cannot reach server"); }
    finally { setDeleting(false); }
  }

  // ── Payment handlers ──────────────────────────────────────────────────────────
  function openPay(entry: PharmacyEntry) {
    setPayForEntry(entry); setPayForm(emptyPay()); setPayErrors({}); setPayApiErr(""); setPayModalOpen(true);
  }
  function updatePayField<K extends keyof PayForm>(k: K, v: PayForm[K]) { setPayForm(p => ({ ...p, [k]: v })); }
  function addPaySplit() {
    setPayForm(p => {
      const used = new Set(p.splits.map(s => s.mode));
      const next = SPLIT_MODES.find(m => !used.has(m)) ?? "CASH";
      return { ...p, splits: [...p.splits, { mode: next, amount: 0 }] };
    });
  }
  function removePaySplit(i: number) { setPayForm(p => ({ ...p, splits: p.splits.filter((_, xi) => xi !== i) })); }
  function updatePaySplit(i: number, field: keyof PaymentSplit, val: unknown) {
    setPayForm(p => ({ ...p, splits: p.splits.map((s, xi) => xi === i ? { ...s, [field]: val } : s) }));
  }
  useEffect(() => {
    if (payForm.paymentMode === "MIXED" && payForm.splits.length > 0) {
      const tot = splitTotal(payForm.splits);
      if (tot > 0) setPayForm(p => ({ ...p, amount: String(tot) }));
    }
  }, [payForm.splits, payForm.paymentMode]);

  function validatePay() {
    const e: Partial<Record<keyof PayForm | "splits", string>> = {};
    if (!payForm.paymentDate) e.paymentDate = "Required";
    if (payForm.paymentMode === "MIXED") {
      if (!payForm.splits.length || splitTotal(payForm.splits) <= 0) e.splits = "Add at least one split with amount > 0";
    } else if (!payForm.amount || n(payForm.amount) <= 0) e.amount = "Must be > 0";
    setPayErrors(e);
    return Object.keys(e).length === 0;
  }

  async function savePay() {
    if (!validatePay() || !payForEntry) return;
    setPaySaving(true); setPayApiErr("");
    const amount = payForm.paymentMode === "MIXED" ? splitTotal(payForm.splits) : n(payForm.amount);
    const splitsJson = payForm.paymentMode === "MIXED" && payForm.splits.length ? JSON.stringify(payForm.splits) : null;
    const body = {
      paymentDate:       payForm.paymentDate,
      amount,
      paymentMode:       payForm.paymentMode,
      paymentSplitsJson: splitsJson,
      notes:             payForm.notes.trim() || null,
    };
    try {
      const res  = await fetch(`/api/pharmacy/${payForEntry.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { setPayModalOpen(false); await loadEntries(selectedDate); }
      else setPayApiErr(json.error ?? "Save failed");
    } catch { setPayApiErr("Cannot reach server"); }
    finally { setPaySaving(false); }
  }

  async function confirmDeletePay() {
    if (!deletePayTarget) return;
    setDeleting(true);
    try {
      const { entry, pay } = deletePayTarget;
      const res  = await fetch(`/api/pharmacy/${entry.id}/payments/${pay.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { setDeletePayTarget(null); await loadEntries(selectedDate); }
      else alert(json.error ?? "Delete failed");
    } catch { alert("Cannot reach server"); }
    finally { setDeleting(false); }
  }

  // ── Return handlers ───────────────────────────────────────────────────────────
  function openAddReturn(entry: PharmacyEntry) {
    setReturnForEntry(entry); setReturnForm(emptyReturn()); setReturnErrors({}); setReturnApiErr(""); setReturnModalOpen(true);
  }

  /** Compute how much cash the pharmacy owes back after this return */
  function computeCashRefund(entry: PharmacyEntry | null, returnAmtStr: string): number {
    if (!entry) return 0;
    const returnAmt      = n(returnAmtStr);
    if (returnAmt <= 0) return 0;
    const alreadyReturned = n(entry.totalReturned);
    const effectiveBill   = n(entry.totalAmount) - alreadyReturned - returnAmt;
    const paid            = n(entry.paidToDate);
    const refund          = paid - effectiveBill;
    return refund > 0 ? refund : 0;
  }

  function validateReturn() {
    const e: Partial<ReturnForm> = {};
    if (!returnForm.returnDate) e.returnDate = "Required";
    if (!returnForm.returnAmount || n(returnForm.returnAmount) <= 0) e.returnAmount = "Must be > 0";
    setReturnErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveReturn() {
    if (!validateReturn() || !returnForEntry) return;
    setReturnSaving(true); setReturnApiErr("");
    const cashRefund = computeCashRefund(returnForEntry, returnForm.returnAmount);
    const body = {
      returnDate:   returnForm.returnDate,
      returnAmount: n(returnForm.returnAmount),
      paymentMode:  returnForm.paymentMode,
      notes:        returnForm.notes.trim() || null,
    };
    try {
      const res  = await fetch(`/api/pharmacy/${returnForEntry.id}/returns`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setReturnModalOpen(false);
        await loadEntries(selectedDate);
        // Auto-print receipt after successful return
        printReturnReceipt(returnForEntry, n(returnForm.returnAmount), cashRefund, returnForm.returnDate, returnForm.paymentMode, returnForm.notes.trim());
      } else setReturnApiErr(json.error ?? "Save failed");
    } catch { setReturnApiErr("Cannot reach server"); }
    finally { setReturnSaving(false); }
  }

  function printReturnReceipt(
    entry: PharmacyEntry,
    returnAmt: number,
    cashRefund: number,
    returnDate: string,
    mode: string,
    notes: string,
  ) {
    const hs = DEFAULT_HS;
    const html = buildReturnReceiptHtml(entry, returnAmt, cashRefund, returnDate, mode, notes, hs);
    const win = window.open("", "_blank", "width=900,height=620");
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
  }
  async function confirmDeleteReturn() {
    if (!deleteReturnTarget) return;
    setDeleting(true);
    try {
      const { entry, ret } = deleteReturnTarget;
      const res  = await fetch(`/api/pharmacy/${entry.id}/returns/${ret.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { setDeleteReturnTarget(null); await loadEntries(selectedDate); }
      else alert(json.error ?? "Delete failed");
    } catch { alert("Cannot reach server"); }
    finally { setDeleting(false); }
  }

  // ── Find patient ─────────────────────────────────────────────────────────────
  function openFind() { setFindQuery(""); setFindResults([]); setFindErr(""); setFindModalOpen(true); }

  const runFind = useCallback(async (q: string) => {
    if (!q.trim()) { setFindResults([]); return; }
    setFindLoading(true); setFindErr("");
    try {
      const res  = await fetch(`/api/pharmacy/search?name=${encodeURIComponent(q.trim())}&outstanding=false`);
      const json = await res.json();
      if (json.success) setFindResults(json.data ?? []);
      else { setFindErr(json.error ?? "Search failed"); setFindResults([]); }
    } catch { setFindErr("Cannot reach server"); setFindResults([]); }
    finally { setFindLoading(false); }
  }, []);

  useEffect(() => {
    if (!findModalOpen) return;
    const t = setTimeout(() => runFind(findQuery), 300);
    return () => clearTimeout(t);
  }, [findQuery, findModalOpen, runFind]);

  function payFromFind(entry: PharmacyEntry) {
    setFindModalOpen(false);
    openPay(entry);
  }

  // ── Print ─────────────────────────────────────────────────────────────────────
  async function handlePrint() {
    setPrinting(true);
    let hs: HospitalSettings = DEFAULT_HS;
    try {
      const res  = await fetch("/api/settings/hospital");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        hs = {
          ...DEFAULT_HS,
          hospitalName: d.hospitalName ?? DEFAULT_HS.hospitalName,
          hospitalNameSecondary: d.hospitalNameSecondary ?? undefined,
          tagline: d.tagline ?? DEFAULT_HS.tagline,
          address: d.address ?? DEFAULT_HS.address,
          city: d.city ?? DEFAULT_HS.city,
          state: d.state ?? DEFAULT_HS.state,
          pinCode: d.pinCode ?? DEFAULT_HS.pinCode,
          phone: d.phone ?? DEFAULT_HS.phone,
          alternatePhone: d.alternatePhone ?? undefined,
          email: d.email ?? DEFAULT_HS.email,
          website: d.website ?? DEFAULT_HS.website,
          regNo: d.regNo ?? DEFAULT_HS.regNo,
          gstNo: d.gstNo ?? undefined,
          logoBase64: d.logoBase64 ?? undefined,
        };
      }
    } catch { /* use defaults */ }
    setPrinting(false);
    const html = buildPrintHtml(filtered, selectedDate, hs);
    const win  = window.open("", "_blank", "width=1000,height=750");
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pharmacy-cash-page">
      {/* Scope: hide number-input spinners only within this page */}
      <style>{`
        .pharmacy-cash-page input[type="number"]::-webkit-inner-spin-button,
        .pharmacy-cash-page input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .pharmacy-cash-page input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      <PageHeader
        title="Pharmacy Cash Collection"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Daily Summary" },
          { label: "Pharmacy Collection" },
        ]}
        action={{ label: "+ Add Entry", onClick: openAddEntry }}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-end gap-4 mb-5 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"/>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter today's list by patient, insurance, entry no…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{filtered.length} patients</span>
          <button onClick={openFind}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
            Find & Pay
          </button>
          <button onClick={handlePrint} disabled={printing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-60">
            {printing
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>}
            {printing ? "Preparing…" : "Print Report"}
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SCard label="Collected Today" value={inr(totals.collectedToday + totals.returnedToday)} color="text-emerald-700" sub="payments received" />
        <SCard label="Returned Today"  value={inr(totals.returnedToday)}  color="text-orange-600" sub="cash paid back (−)" />
        <SCard label="Net Cash Today"  value={inr(totals.collectedToday)} color={totals.collectedToday >= 0 ? "text-emerald-700" : "text-amber-600"} sub="collected − returned" />
      </div>

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{apiError}</div>
      )}

      {/* ── Table ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-right">Collected Today (₹)</th>
                <th className="px-4 py-3 text-right">Returned Today (₹)</th>
                <th className="px-4 py-3 text-right">Net Today (₹)</th>
                <th className="px-4 py-3 text-center w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"/>
                    </svg>
                    No activity for {fmt(selectedDate)}
                  </td>
                </tr>
              ) : filtered.map(entry => {
                const isExpanded = expandedId === entry.id;
                const paidAmt    = n(entry.paidToDate);
                const retAmt     = n(entry.totalReturned);
                const retToday   = n(entry.returnedOnDate);
                // collectedOnDate from backend is already net (payments today − returns today)
                const netToday   = n(entry.collectedOnDate);
                const collToday  = netToday + retToday; // gross cash collected today

                return (
                  <Fragment key={entry.id}>
                    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isExpanded ? "bg-emerald-50/40" : ""}`}>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleExpand(entry.id)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isExpanded ? "bg-emerald-100 text-emerald-600 rotate-90" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
                          title={isExpanded ? "Collapse" : "Expand payments & returns"}>
                          <svg className="w-3 h-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">{entry.sno}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{entry.patientName}</p>
                        {entry.insuranceName && <p className="text-xs text-sky-600 mt-0.5">{entry.insuranceName}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{entry.entryNo} · opened {fmt(entry.entryDate)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {collToday > 0 ? <span className="font-semibold text-emerald-700">{inr(collToday)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {retToday > 0 ? <span className="text-orange-600 font-medium">− {inr(retToday)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {netToday !== 0
                          ? <span className={`font-bold ${netToday > 0 ? "text-emerald-700" : "text-amber-600"}`}>{netToday < 0 ? "− " : ""}{inr(netToday)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openPay(entry)}
                            className="px-2.5 h-7 rounded-lg flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            title="Add a payment for this patient">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2c-1.11 0-2.08.402-2.599 1"/></svg>
                            Pay
                          </button>
                          <button onClick={() => openAddReturn(entry)}
                            className="px-2.5 h-7 rounded-lg flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            title="Add a return for this patient">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                            Return
                          </button>
                          <button onClick={() => openEditEntry(entry)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit patient">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => setDeleteTarget(entry)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete patient & all records">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/60 border-b border-slate-200 px-0 py-0">
                          <div className="px-10 py-4 space-y-4">
                            {/* Payments */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Payments</span>
                                  {entry.payments.length > 0 && <Badge label={`${entry.payments.length}`} variant="green" />}
                                  <span className="text-xs text-slate-500">Total collected <span className="font-semibold text-indigo-600">{inr(paidAmt)}</span></span>
                                </div>
                                <button onClick={() => openPay(entry)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200 transition-colors">
                                  + Add Payment
                                </button>
                              </div>
                              {entry.payments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-1">No payments recorded yet.</p>
                              ) : (
                                <table className="w-full text-xs rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="bg-emerald-100/60 text-emerald-800 uppercase tracking-wide">
                                      <th className="px-3 py-2 text-left">Date</th>
                                      <th className="px-3 py-2 text-left">Mode</th>
                                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                                      <th className="px-3 py-2 text-left">Notes</th>
                                      <th className="px-3 py-2 text-center w-16">Del</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entry.payments.map(pay => (
                                      <tr key={pay.id} className="border-t border-emerald-100 bg-white hover:bg-emerald-50/40">
                                        <td className="px-3 py-2 text-slate-600">{fmt(pay.paymentDate)}{pay.advance && <span className="ml-1 text-[10px] text-emerald-600 font-semibold">ADV</span>}</td>
                                        <td className="px-3 py-2">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${MODE_COLOR[pay.paymentMode] ?? ""}`}>{MODE_LABEL[pay.paymentMode] ?? pay.paymentMode}</span>
                                          {pay.paymentMode === "MIXED" && pay.paymentSplitsJson && (() => {
                                            try {
                                              const s: PaymentSplit[] = JSON.parse(pay.paymentSplitsJson);
                                              return <span className="ml-1 text-[10px] text-slate-400">({s.map(x => `${MODE_LABEL[x.mode]} ${x.amount}`).join(", ")})</span>;
                                            } catch { return null; }
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{inr(n(pay.amount))}</td>
                                        <td className="px-3 py-2 text-slate-500">{pay.notes || "—"}</td>
                                        <td className="px-3 py-2 text-center">
                                          <button onClick={() => setDeletePayTarget({ entry, pay })}
                                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors mx-auto" title="Delete payment">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* Returns */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Returns</span>
                                  {entry.returns.length > 0 && <Badge label={`${entry.returns.length}`} variant="yellow" />}
                                  <span className="text-xs text-slate-500">Returned <span className="font-semibold text-orange-600">{inr(retAmt)}</span></span>
                                </div>
                                <button onClick={() => openAddReturn(entry)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                  Add Return
                                </button>
                              </div>
                              {entry.returns.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-1">No returns recorded yet.</p>
                              ) : (
                                <table className="w-full text-xs rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="bg-amber-100/60 text-amber-800 uppercase tracking-wide">
                                      <th className="px-3 py-2 text-left">Date</th>
                                      <th className="px-3 py-2 text-left">Mode</th>
                                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                                      <th className="px-3 py-2 text-left">Notes</th>
                                      <th className="px-3 py-2 text-center w-16">Del</th>
                                      <th className="px-3 py-2 text-center w-16">Print</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entry.returns.map(ret => (
                                      <tr key={ret.id} className="border-t border-amber-100 bg-white hover:bg-amber-50/40">
                                        <td className="px-3 py-2 text-slate-600">{fmt(ret.returnDate)}</td>
                                        <td className="px-3 py-2">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${MODE_COLOR[ret.paymentMode] ?? ""}`}>{MODE_LABEL[ret.paymentMode] ?? ret.paymentMode}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-orange-700">− {inr(n(ret.returnAmount))}</td>
                                        <td className="px-3 py-2 text-slate-500">{ret.notes || "—"}</td>
                                        <td className="px-3 py-2 text-center">
                                          <button onClick={() => setDeleteReturnTarget({ entry, ret })}
                                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors mx-auto" title="Delete return">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                          </button>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <button
                                            onClick={() => {
                                              // Compute cash refund for this specific return
                                              // We need to know what alreadyReturned was before this return.
                                              // Since we can't know the order perfectly from the client, we
                                              // use totalReturned − thisReturn as the "already returned before this"
                                              const alreadyBeforeThis = Math.max(0, n(entry.totalReturned) - n(ret.returnAmount));
                                              const effectiveBill = n(entry.totalAmount) - alreadyBeforeThis - n(ret.returnAmount);
                                              const cashRefund = Math.max(0, n(entry.paidToDate) - effectiveBill);
                                              printReturnReceipt(entry, n(ret.returnAmount), cashRefund, ret.returnDate, ret.paymentMode, ret.notes ?? "");
                                            }}
                                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors mx-auto"
                                            title="Reprint return receipt"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                            </svg>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold text-slate-700">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs text-slate-500 uppercase tracking-wide">Day Totals</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{inr(totals.collectedToday + totals.returnedToday)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{totals.returnedToday > 0 ? <>− {inr(totals.returnedToday)}</> : "—"}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-bold">{inr(totals.collectedToday)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* ════════════════════════ Entry Modal ════════════════════════ */}
      <Modal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title={editingEntry ? "Edit Patient" : "New Pharmacy Collection"}
        size="md"
        footer={
          <>
            <button onClick={() => setEntryModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveEntry} disabled={entrySaving} className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {entrySaving ? "Saving…" : editingEntry ? "Update" : "Save Collection"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {entryApiErr && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{entryApiErr}</div>}

          <FormField label="Patient Name" required error={entryErrors.patientName}>
            <Input value={entryForm.patientName} onChange={e => updateEntryField("patientName", e.target.value)} placeholder="e.g. Mr. Rajesh Kumar" />
          </FormField>

          <FormField label="Insurance / Staff (optional)">
            <Input value={entryForm.insuranceName} onChange={e => updateEntryField("insuranceName", e.target.value)} placeholder="e.g. BSMI, Staff, TNHB…" />
          </FormField>

          {/* Amount collected today. Enter one or more rows to split across modes,
              e.g. ₹500 Cash + ₹500 UPI. On later days, use "Find & Pay" to add more
              payments to the same patient. */}
          {!editingEntry && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Amount Collected</p>
                <span className="text-xs text-slate-500">
                  Total: <span className="font-semibold text-emerald-700">{inr(splitTotal(entryForm.splits))}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                Add a row per payment mode to split, e.g. ₹500 Cash + ₹500 UPI.
              </p>
              {entryErrors.splits && <p className="text-xs text-red-500">{entryErrors.splits}</p>}
              <SplitEditor splits={entryForm.splits} onAdd={addEntrySplit} onRemove={removeEntrySplit} onUpdate={updateEntrySplit} />
            </div>
          )}
          {editingEntry && (
            <p className="text-xs text-slate-500">
              To add another day&apos;s payment or a return for this patient, close this and use the row actions or <span className="font-medium">Find &amp; Pay</span>.
            </p>
          )}

          <FormField label="Notes (optional)">
            <Textarea value={entryForm.notes} onChange={e => updateEntryField("notes", e.target.value)} placeholder="Any remarks…" rows={2} />
          </FormField>
        </div>
      </Modal>

      {/* ════════════════════════ Pay Modal ════════════════════════ */}
      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`Record Payment — ${payForEntry?.patientName ?? ""}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setPayModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={savePay} disabled={paySaving} className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {paySaving ? "Saving…" : "Save Payment"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {payForEntry && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              Patient: <strong>{payForEntry.patientName}</strong>{" · "}Collected so far: <strong>{inr(n(payForEntry.paidToDate))}</strong>
            </div>
          )}
          {payApiErr && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{payApiErr}</div>}

          <FormField label="Payment Date" required error={payErrors.paymentDate}>
            <Input type="date" value={payForm.paymentDate} onChange={e => updatePayField("paymentDate", e.target.value)} />
          </FormField>

          <FormField label="Payment Mode" required>
            <Select value={payForm.paymentMode} onChange={e => updatePayField("paymentMode", e.target.value as PMode)}>
              {PMODES.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </Select>
          </FormField>

          {payForm.paymentMode === "MIXED" ? (
            <>
              {payErrors.splits && <p className="text-xs text-red-500">{payErrors.splits}</p>}
              <SplitEditor splits={payForm.splits} onAdd={addPaySplit} onRemove={removePaySplit} onUpdate={updatePaySplit} />
            </>
          ) : (
            <FormField label="Amount (₹)" required error={payErrors.amount}>
              <Input type="number" min={0.01} step={0.01} value={payForm.amount} onChange={e => updatePayField("amount", e.target.value)} placeholder="0.00" />
            </FormField>
          )}

          <FormField label="Notes (optional)">
            <Textarea value={payForm.notes} rows={2} onChange={e => updatePayField("notes", e.target.value)} placeholder="Any remarks…" />
          </FormField>
        </div>
      </Modal>

      {/* ════════════════════════ Return Modal ════════════════════════ */}
      <Modal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={`Add Return — ${returnForEntry?.patientName ?? ""}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setReturnModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveReturn} disabled={returnSaving} className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60">
              {returnSaving ? "Saving…" : "Save Return"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {returnForEntry && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Patient: <strong>{returnForEntry.patientName}</strong>{" · "}Collected so far: <strong>{inr(n(returnForEntry.paidToDate))}</strong>{n(returnForEntry.totalReturned) > 0 ? <>{" · "}Already returned: <strong>{inr(n(returnForEntry.totalReturned))}</strong></> : null}
            </div>
          )}
          {returnApiErr && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{returnApiErr}</div>}

          <FormField label="Return Date" required error={returnErrors.returnDate}>
            <Input type="date" value={returnForm.returnDate} onChange={e => setReturnForm(p => ({ ...p, returnDate: e.target.value }))} />
          </FormField>

          <FormField label="Return Amount (₹)" required error={returnErrors.returnAmount}>
            <Input type="number" min={0.01} step={0.01} value={returnForm.returnAmount}
              onChange={e => setReturnForm(p => ({ ...p, returnAmount: e.target.value }))} placeholder="0.00" />
          </FormField>

          <FormField label="Refund Mode" required>
            <Select value={returnForm.paymentMode} onChange={e => setReturnForm(p => ({ ...p, paymentMode: e.target.value as Exclude<PMode, "MIXED"> }))}>
              {SPLIT_MODES.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </Select>
          </FormField>

          {/* Live cash-refund indicator — the return amount is paid back to the patient */}
          {(() => {
            const cashRefund = computeCashRefund(returnForEntry, returnForm.returnAmount);
            if (cashRefund <= 0) return null;
            return (
              <div className="flex items-start gap-2 px-3 py-3 bg-amber-50 border border-amber-300 rounded-lg">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/>
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-800">Cash to Return to Patient</p>
                  <p className="text-lg font-bold text-amber-700 mt-0.5">{inr(cashRefund)}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Pay back {inr(cashRefund)} in {MODE_LABEL[returnForm.paymentMode]}. This reduces today&apos;s net collection by the same amount.
                  </p>
                </div>
              </div>
            );
          })()}

          <FormField label="Notes (optional)">
            <Textarea value={returnForm.notes} rows={2} onChange={e => setReturnForm(p => ({ ...p, notes: e.target.value }))} placeholder="Reason for return…" />
          </FormField>

          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            A return receipt will print automatically after saving.
          </p>
        </div>
      </Modal>

      {/* ════════════════════════ Find Patient Modal ════════════════════════ */}
      <Modal
        open={findModalOpen}
        onClose={() => setFindModalOpen(false)}
        title="Find Patient Account"
        size="md"
        footer={<button onClick={() => setFindModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Close</button>}
      >
        <div className="space-y-3">
          <FormField label="Search by patient name">
            <Input autoFocus value={findQuery} onChange={e => setFindQuery(e.target.value)} placeholder="Type a name…" />
          </FormField>
          {findErr && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{findErr}</div>}

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {findLoading ? (
              <div className="animate-pulse divide-y divide-slate-100">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-40 rounded bg-slate-200/80" />
                      <div className="h-3 w-56 rounded bg-slate-200/70" />
                      <div className="h-3 w-24 rounded bg-slate-200/70" />
                    </div>
                    <div className="w-12 h-7 rounded-lg bg-slate-200/80" />
                  </div>
                ))}
              </div>
            ) : findQuery.trim() && findResults.length === 0 ? (
              <p className="text-center py-8 text-sm text-slate-400">No patient found for “{findQuery}”.</p>
            ) : !findQuery.trim() ? (
              <p className="text-center py-8 text-sm text-slate-400">Start typing to search by patient name.</p>
            ) : (
              findResults.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{r.patientName}{r.insuranceName && <span className="ml-2 text-xs text-sky-600">{r.insuranceName}</span>}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.entryNo} · opened {fmt(r.entryDate)} · Collected so far {inr(n(r.paidToDate))}{n(r.totalReturned) > 0 ? ` · Returned ${inr(n(r.totalReturned))}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => payFromFind(r)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                      Pay
                    </button>
                    <button onClick={() => { setFindModalOpen(false); openAddReturn(r); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                      Return
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ════════════════════════ Delete Account Confirm ════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Account"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete account for <strong>{deleteTarget?.patientName}</strong> ({deleteTarget?.entryNo})?
          {((deleteTarget?.payments.length ?? 0) + (deleteTarget?.returns.length ?? 0)) > 0 && (
            <span className="block mt-1 text-orange-600 text-xs">
              ⚠ This will also delete {deleteTarget?.payments.length} payment(s) and {deleteTarget?.returns.length} return(s).
            </span>
          )}
        </p>
      </Modal>

      {/* ════════════════════════ Delete Payment Confirm ════════════════════════ */}
      <Modal
        open={!!deletePayTarget}
        onClose={() => setDeletePayTarget(null)}
        title="Delete Payment"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletePayTarget(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={confirmDeletePay} disabled={deleting} className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete Payment"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete payment of <strong>{inr(n(deletePayTarget?.pay.amount ?? 0))}</strong> for <strong>{deletePayTarget?.entry.patientName}</strong>?
        </p>
      </Modal>

      {/* ════════════════════════ Delete Return Confirm ════════════════════════ */}
      <Modal
        open={!!deleteReturnTarget}
        onClose={() => setDeleteReturnTarget(null)}
        title="Delete Return"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteReturnTarget(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={confirmDeleteReturn} disabled={deleting} className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
              {deleting ? "Deleting…" : "Delete Return"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete return of <strong>{inr(n(deleteReturnTarget?.ret.returnAmount ?? 0))}</strong> for <strong>{deleteReturnTarget?.entry.patientName}</strong>?
        </p>
      </Modal>
    </div>
  );
}
