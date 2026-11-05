import JsBarcode from "jsbarcode";
import { HOSPITAL } from "./hospital-config";

// ─── OP Registration Slip — matches the physical SEN Hospital slip ─────────────
export interface OPSlipData {
  tokenNo:     string;
  uhid:        string;
  patientName: string;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  address:     string;
  visitDate:   string;         // "YYYY-MM-DD"
  visitTime:   string | null;  // "HH:mm"
  doctorName:  string;
  referredBy:  string | null;
  regType?:    string | null;  // Consultation / X-Ray / Review / Physiotherapy / Others
  reason?:     string | null;  // chief complaint / reason for visit (unused on slip)
  preparedBy?: string | null;  // receptionist who generated the OP token
  paidAmount?: number | null;  // amount collected at token time (printed as "Paid")
  payModeLabel?: string | null; // e.g. "Cash" or "Cash : ₹500 + Credit Card : ₹500"
  free?:       boolean;         // true → consultation waived (printed as FREE)
}

/** Human-readable Reg Type label from the backend enum value. */
function regTypeLabel(v?: string | null): string {
  switch ((v ?? "").toUpperCase()) {
    case "CONSULTATION":  return "Consultation";
    case "XRAY":          return "X-Ray";
    case "REVIEW":        return "Review";
    case "PHYSIOTHERAPY": return "Physiotherapy";
    case "OTHERS":        return "Others";
    default:              return v ? v : "";
  }
}

/** Escape a value for safe insertion into the slip HTML. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(isoDate: string): string {
  return new Date(isoDate)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

/**
 * Generates a Code128 barcode of the given value as a PNG data-URL.
 * Rendered locally in the browser (no external service). Returns "" if the
 * value is empty or rendering fails.
 */
function buildBarcodeDataUrl(value: string): string {
  if (!value || typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,   // the UHID is already printed as text on the slip
      width: 2,
      height: 44,
      margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

/**
 * Builds a print-ready OP Registration Slip that mirrors the physical hospital slip.
 * Kept async so callers don't need to change (barcode generation is synchronous).
 */
export async function buildOPRegistrationSlipHtml(d: OPSlipData): Promise<string> {
  const dateStr = formatDate(d.visitDate);
  // Appointment time (printed in its own row) — the 15-min-ahead scheduled time.
  const timeStr = d.visitTime ? formatTime(d.visitTime) : "";
  // DATE row shows when the slip is generated (current time), not the future
  // appointment time.
  const nowTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateTime = `${dateStr} ${nowTime}`;
  const ageGender = `${d.age != null ? d.age : "—"} / ${(d.gender ?? "").toUpperCase()}`;

  // Split the token (e.g. "CON-171026-005") into the code part ("CON-171026")
  // shown small, and the trailing sequence ("05") shown large — mirrors the OP bill.
  const tokenMatch = /^(.*)-(\d+)$/.exec((d.tokenNo ?? "").trim());
  const tokenCode  = tokenMatch ? tokenMatch[1] : (d.tokenNo ?? "");
  const tokenSeq   = tokenMatch ? String(parseInt(tokenMatch[2], 10)).padStart(2, "0") : "";

  // Absolute origin so images resolve when the slip is opened from a blob: URL.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = `${origin}${HOSPITAL.logo}`;
  const sealUrl = `${origin}${HOSPITAL.seal}`;

  // Code128 barcode of the UHID, generated locally (offline).
  const barcodeDataUrl = buildBarcodeDataUrl(d.uhid);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>senhospital-${esc(d.tokenNo)}-${esc(dateStr)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      background: #e2e8f0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      color: #000;
    }
    .slip {
      background: #fff;
      width: 840px;
      padding: 18px 28px 16px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    /* ── Letterhead Header ── */
    .head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 4px; }
    .head .logo { width: 220px; flex: 0 0 220px; text-align: left; }
    .head .logo img { max-width: 215px; max-height: 110px; object-fit: contain; }
    .head .center { flex: 1 1 auto; text-align: center; padding: 0 10px; }
    .head .spacer { width: 135px; flex: 0 0 135px; text-align: right; }
    .head .spacer img { max-width: 130px; max-height: 110px; object-fit: contain; }
    .hosp-name { font-family: "Times New Roman", Georgia, serif; font-size: 28px; font-weight: 800; letter-spacing: 0.5px; line-height: 1.1; color: #000; }
    .regd { font-family: "Times New Roman", Georgia, serif; font-size: 13px; font-weight: 700; margin-top: 1px; }
    .tagline { font-size: 22px; font-style: italic; font-family: "Brush Script MT", "Segoe Script", "Dancing Script", cursive; margin-top: 1px; color: #111; }
    .contact { font-family: "Times New Roman", Georgia, serif; font-size: 12.5px; font-weight: 600; margin-top: 3px; line-height: 1.35; }
    /* ── Dividers & Title ── */
    .hr { border: 0; border-top: 1px solid #000; margin: 4px 0; }
    .slip-title { text-align: center; font-weight: 800; font-size: 17px; font-family: "Times New Roman", Georgia, serif; text-decoration: underline; padding: 2px 0; letter-spacing: 0.5px; }
    /* ── Token + Barcode row ── */
    .token-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; margin-bottom: 2px; }
    /* Token: full code as a small label on top, large sequence number below. */
    .token-code { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; }
    .token-seq { font-weight: 800; font-size: 34px; line-height: 1; margin-top: 2px; }
    .barcode-box { text-align: center; }
    .barcode-img { height: 44px; max-width: 260px; object-fit: contain; }
    /* ── Patient & OP Slip Details Table ── */
    .info-table { width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.7; margin-top: 2px; }
    .info-table td { vertical-align: top; padding: 1px 0; }
    .lbl { font-weight: 800; color: #000; white-space: nowrap; }
    .colon { padding: 0 8px 0 2px; font-weight: 800; }
    .val { font-weight: 700; color: #000; }
    /* ── Vitals Section ── */
    .vitals-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 800; padding: 5px 4px 2px 4px; }
    .vitals-item { white-space: nowrap; }
    /* ── Prepared-by / Nurse / Payment Section ── */
.sign-row { display: flex; justify-content: flex-start; gap: 100px; align-items: center; font-size: 14px; font-weight: 700; padding: 70px 4px 2px 4px; }
    .sign-item { white-space: nowrap; }
    /* Default the paper to A5 landscape so the print dialog pre-selects it.
       margin:0 removes the browser's auto header/footer (URL, page no., date/time). */
    @page { size: A5 landscape; margin: 0; }
    /* Print styles */
    @media print {
      body { background: #fff; padding: 0; }
      .slip { border: none; box-shadow: none; width: 100%; padding: 4mm 6mm; }
    }
  </style>
</head>
<body>
  <div class="slip">
    <!-- Letterhead Header -->
    <div class="head">
      <div class="logo">
        <img src="${logoUrl}" alt="SEN HOSPITAL" onerror="this.style.display='none'" />
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
    <div class="slip-title">OP REGISTRATION SLIP</div>
    <hr class="hr" />

    <!-- Token + Barcode -->
    <div class="token-row">
      <div class="token-box">
        <div class="token-code">TOKEN NO : ${esc(tokenCode)}</div>
        ${tokenSeq ? `<div class="token-seq">${esc(tokenSeq)}</div>` : ""}
      </div>
      ${barcodeDataUrl ? `<div class="barcode-box"><img class="barcode-img" src="${barcodeDataUrl}" alt="${esc(d.uhid)}" /></div>` : ""}
    </div>

    <!-- Demographics & Doctor Info Table -->
    <table class="info-table">
      <tr>
        <td style="width: 140px;"><span class="lbl">UHID</span></td>
        <td style="width: 15px;"><span class="colon">:</span></td>
        <td style="width: 260px;"><span class="val">${esc(d.uhid)}</span></td>
        <td style="width: 140px;"><span class="lbl">DATE</span></td>
        <td style="width: 15px;"><span class="colon">:</span></td>
        <td><span class="val">${esc(dateTime)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">PATIENT NAME</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.patientName.toUpperCase())}</span></td>
        <td><span class="lbl">APPOINTMENT TIME</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(timeStr)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">AGE/GENDER</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(ageGender)}</span></td>
        <td><span class="lbl">DOCTOR NAME</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.doctorName)}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">CONTACT NO</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.phone ?? "")}</span></td>
        <td><span class="lbl">REG TYPE</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(regTypeLabel(d.regType) || "—")}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">ADDRESS</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc(d.address || "")}</span></td>
        <td><span class="lbl">REFERRED BY</span></td>
        <td><span class="colon">:</span></td>
        <td><span class="val">${esc((d.referredBy && d.referredBy.trim()) || "SELF")}</span></td>
      </tr>
    </table>

    <hr class="hr" style="margin-top: 5px;" />

    <!-- Vitals Footer -->
    <div class="vitals-row">
      <span class="vitals-item">HEIGHT :</span>
      <span class="vitals-item">WEIGHT :</span>
      <span class="vitals-item">BP :</span>
      <span class="vitals-item">TEMP :</span>
      <span class="vitals-item">SpO2 :</span>
      <span class="vitals-item">PR :</span>
    </div>

    <!-- Prepared By / Nurse / Payment Footer -->
    <div class="sign-row">
      <span class="sign-item">PREPARED BY : ${esc((d.preparedBy && d.preparedBy.trim()) || "—")}</span>
      <span class="sign-item">NURSE :</span>
      <span class="sign-item">${d.free
        ? "PAYMENT : FREE (NO CHARGE)"
        : "PAID : ₹" + Number(d.paidAmount ?? 0).toLocaleString("en-IN")}</span>
    </div>
  </div>
</body>
</html>`;
}
