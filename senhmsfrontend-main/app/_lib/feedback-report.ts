/**
 * Builds a printable patient-feedback report (one submission per page).
 * Returned as a standalone HTML document for `printHtml()` → browser "Save as PDF".
 */

import { HOSPITAL } from "./hospital-config";

export interface FeedbackReportAnswer {
  order: number;
  questionEnglish: string;
  questionTamil: string | null;
  rating: string | null; // enum name, e.g. SATISFIED
  score: number | null;
}

export interface FeedbackReportData {
  id: number;
  name: string;
  mobile: string;
  comments: string | null;
  averageScore: number | null;
  createdAt: string;
  answers: FeedbackReportAnswer[];
}

const RATING_LABEL: Record<string, string> = {
  STRONGLY_DISSATISFIED: "Strongly Dissatisfied",
  DISSATISFIED: "Dissatisfied",
  NEUTRAL: "Neutral",
  SATISFIED: "Satisfied",
  STRONGLY_SATISFIED: "Strongly Satisfied",
};

const SCALE_ORDER = [
  "STRONGLY_DISSATISFIED",
  "DISSATISFIED",
  "NEUTRAL",
  "SATISFIED",
  "STRONGLY_SATISFIED",
];

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Build the report for a single feedback submission. */
export function buildFeedbackReportHtml(fb: FeedbackReportData): string {
  const origin  = typeof window !== "undefined" ? window.location.origin : "";
  const logoSrc = `${origin}${HOSPITAL.logo}`;
  const rows = [...fb.answers]
    .sort((a, b) => a.order - b.order)
    .map((a) => {
      const cells = SCALE_ORDER.map((key) => {
        const marked = a.rating === key;
        // ☑ checked box for the chosen rating, ☐ empty box otherwise — mirrors
        // the printed NABH paper form's checkbox columns.
        return `<td class="box">${marked
          ? '<span class="chk checked">&#9745;</span>'
          : '<span class="chk">&#9744;</span>'}</td>`;
      }).join("");
      return `
        <tr>
          <td class="sno">${a.order}</td>
          <td class="stmt">
            <div class="en">${esc(a.questionEnglish)}</div>
            ${a.questionTamil ? `<div class="ta">${esc(a.questionTamil)}</div>` : ""}
          </td>
          ${cells}
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Patient Feedback — ${esc(fb.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1e293b; margin: 0; padding: 18px 22px; }

  /* Letterhead — logo left, hospital details right-aligned (matches lab report) */
  .letterhead { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 10px; }
  .letterhead .logo { width: 150px; height: 112px; object-fit: contain; flex-shrink: 0; }
  .letterhead .info { flex: 1; text-align: right; }
  .letterhead .hosp { font-size: 22px; font-weight: 800; color: #0b2e6f; letter-spacing: .5px; }
  .letterhead .tag  { font-size: 12px; font-weight: 700; color: #334155; letter-spacing: 1px; }
  .letterhead .regd { font-size: 10px; color: #64748b; margin-top: 1px; }
  .letterhead .addr { font-size: 10px; color: #475569; margin-top: 2px; line-height: 1.4; }

  .title { text-align: center; font-size: 13px; font-weight: 700; color: #0f172a; margin: 2px 0 8px; letter-spacing: .3px; }

  .meta { display: flex; flex-wrap: wrap; gap: 4px 28px; font-size: 11px; margin-bottom: 8px; }
  .meta div span { color: #64748b; }
  .meta div b { color: #0f172a; }
  .note { font-size: 9.5px; color: #64748b; font-style: italic; margin-bottom: 6px; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 3px 6px; font-size: 10.5px; vertical-align: middle; }
  th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; text-align: center; }
  td.sno { text-align: center; width: 24px; color: #64748b; }
  td.stmt .en { font-weight: 600; font-size: 10.5px; }
  td.stmt .ta { font-size: 9px; color: #0369a1; margin-top: 0; }
  td.box { text-align: center; width: 58px; }
  td.box .chk { font-size: 15px; color: #475569; line-height: 1; }
  td.box .chk.checked { color: #059669; font-weight: 700; }
  th .en2 { display: block; }
  th .ta2 { display: block; font-size: 8px; font-weight: 500; color: #0369a1; margin-top: 1px; text-transform: none; letter-spacing: 0; }

  .comments { margin-top: 12px; break-inside: avoid; }
  .comments h3 { font-size: 11px; margin: 0 0 3px; color: #475569; }
  .comments p { font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 9px; min-height: 40px; margin: 0; white-space: pre-wrap; }
  .sign { margin-top: 26px; text-align: right; font-size: 11px; color: #475569; }
  .foot { margin-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="letterhead">
    <img class="logo" src="${logoSrc}" alt="SEN Hospital" onerror="this.style.display='none'"/>
    <div class="info">
      <div class="hosp">${esc(HOSPITAL.fullName.toUpperCase())}</div>
      <div class="tag">${esc(HOSPITAL.tagline)}</div>
      <div class="regd">(Regd. No. : ${esc(HOSPITAL.regdNo)})</div>
      <div class="addr">
        ${esc(HOSPITAL.address)}<br/>
        Telephone : ${esc(HOSPITAL.phones.slice(0, 2).join(" / "))}
        &nbsp;&nbsp; Cell : ${esc(HOSPITAL.phones.slice(2).join(" / "))}<br/>
        Email : ${esc(HOSPITAL.email)}
      </div>
    </div>
  </div>

  <div class="title">Patient Satisfaction Feedback</div>

  <div class="meta">
    <div><span>Name:</span> <b>${esc(fb.name)}</b></div>
    <div><span>Mobile:</span> <b>${esc(fb.mobile)}</b></div>
    <div><span>Submitted:</span> <b>${esc(fmtDate(fb.createdAt))}</b></div>
  </div>

  <div class="note">Note: Please do not answer if anything is not applicable. / குறிப்பு: எந்தவொரு விஷயமும் உங்களுக்கு சம்பந்தப்படவில்லை என்றால் பதிலளிக்க வேண்டாம்.</div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th style="text-align:left">Statements / விபரங்கள்</th>
        <th><span class="en2">Strongly Dissatisfied</span><span class="ta2">மிகவும் அதிருப்தி</span></th>
        <th><span class="en2">Dissatisfied</span><span class="ta2">அதிருப்தி</span></th>
        <th><span class="en2">Neutral</span><span class="ta2">நடுநிலை</span></th>
        <th><span class="en2">Satisfied</span><span class="ta2">திருப்தி</span></th>
        <th><span class="en2">Strongly Satisfied</span><span class="ta2">மிகவும் திருப்தி</span></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="comments">
    <h3>Special Comments / மேலும் ஏதேனும் விபரங்கள்</h3>
    <p>${esc(fb.comments) || "&nbsp;"}</p>
  </div>

  <div class="sign">Signature / கையொப்பம் : ____________________</div>

  <div class="foot">${esc(HOSPITAL.fullName)} · Generated ${esc(fmtDate(new Date().toISOString()))}</div>
</body>
</html>`;
}

/** Human-readable rating label for on-screen display. */
export function ratingLabel(rating: string | null): string {
  if (!rating) return "—";
  return RATING_LABEL[rating] ?? rating;
}
