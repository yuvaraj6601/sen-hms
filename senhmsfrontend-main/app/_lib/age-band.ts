/**
 * age-band.ts
 * ────────────
 * Shared utilities for age-banded normal ranges (NTproBNP, HbA1C, etc.)
 *
 * Storage format (fits in the existing `normalRange` TEXT column, no migration):
 *
 *   AGE_BANDS:18-44=< 115 pg/ml|45-54=< 172 pg/ml|55-64=< 263 pg/ml|75+=< 738 pg/ml
 *
 * Rules:
 *  • Prefix must be exactly "AGE_BANDS:" (case-sensitive)
 *  • Bands separated by "|"
 *  • Each band: "<fromAge>-<toAge>=<rangeText>"  or  "<fromAge>+=<rangeText>" for open end
 *  • fromAge / toAge are integers (years)
 *  • rangeText is free text (e.g. "< 115 pg/ml", "115 - 172 pg/ml")
 */

export const AGE_BANDS_PREFIX = "AGE_BANDS:";

export interface AgeBand {
  /** Minimum age in years (inclusive). */
  fromAge: number;
  /** Maximum age in years (inclusive). 999 = open-ended (75+). */
  toAge: number;
  /** Human-readable label shown in UI and on report. */
  label: string;
  /** The normal range text for this band (e.g. "< 115 pg/ml"). */
  rangeText: string;
}

// ── Detect ────────────────────────────────────────────────────────────────────

export function isAgeBanded(normalRange: string | null | undefined): boolean {
  return (normalRange ?? "").startsWith(AGE_BANDS_PREFIX);
}

// ── Parse ─────────────────────────────────────────────────────────────────────

export function parseAgeBands(normalRange: string | null | undefined): AgeBand[] {
  const r = (normalRange ?? "").trim();
  if (!r.startsWith(AGE_BANDS_PREFIX)) return [];
  const payload = r.slice(AGE_BANDS_PREFIX.length);
  if (!payload) return [];

  return payload.split("|").flatMap((part): AgeBand[] => {
    const eq = part.indexOf("=");
    if (eq === -1) return [];
    const key = part.slice(0, eq).trim();
    const rangeText = part.slice(eq + 1).trim();
    if (!rangeText) return [];

    // "75+" open-ended
    const openMatch = key.match(/^(\d+)\s*\+$/);
    if (openMatch) {
      const from = parseInt(openMatch[1], 10);
      return [{ fromAge: from, toAge: 999, label: `${from} yrs and above`, rangeText }];
    }

    // "18-44" range
    const rangeMatch = key.match(/^(\d+)\s*[-\u2013]\s*(\d+)$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to   = parseInt(rangeMatch[2], 10);
      return [{ fromAge: from, toAge: to, label: `${from} to ${to} yrs`, rangeText }];
    }

    return [];
  });
}

// ── Serialize ─────────────────────────────────────────────────────────────────

export function serializeAgeBands(bands: AgeBand[]): string {
  const valid = bands.filter(b => b.rangeText.trim());
  if (valid.length === 0) return "";
  const parts = valid.map(b => {
    const key = b.toAge >= 999 ? `${b.fromAge}+` : `${b.fromAge}-${b.toAge}`;
    return `${key}=${b.rangeText.trim()}`;
  });
  return AGE_BANDS_PREFIX + parts.join("|");
}

// ── Print rendering ───────────────────────────────────────────────────────────

export function formatAgeBandsHtml(
  normalRange: string,
  patientAge: number | null,
): string {
  const bands = parseAgeBands(normalRange);
  if (bands.length === 0) return "";

  let html = `<span class="nv-line nv-age-head">Age cut off value</span>`;

  for (const b of bands) {
    const active = patientAge != null && patientAge >= b.fromAge && patientAge <= b.toAge;
    html += `<span class="nv-line${active ? " nv-age-active" : ""}">`;
    html += `<span class="nv-age-lbl">${escHtml(b.label)}</span>`;
    html += ` : ${escHtml(b.rangeText)}`;
    html += `</span>`;
  }

  return html;
}

// ── Abnormal detection ────────────────────────────────────────────────────────

export function ageBandAbnormal(
  value: string,
  normalRange: string,
  patientAge: number | null,
): boolean | null {
  if (patientAge == null) return null;
  const bands = parseAgeBands(normalRange);
  if (bands.length === 0) return null;

  const band = bands.find(b => patientAge >= b.fromAge && patientAge <= b.toAge);
  if (!band) return null;

  const numVal = parseFloat(value.replace(/[^0-9.\-]/g, ""));
  if (Number.isNaN(numVal)) return null;

  const rt = band.rangeText.trim();

  const ltMatch = rt.match(/^<=?\s*([\d.]+)/);
  if (ltMatch) return numVal >= parseFloat(ltMatch[1]);

  const gtMatch = rt.match(/^>=?\s*([\d.]+)/);
  if (gtMatch) return numVal <= parseFloat(gtMatch[1]);

  const rangeMatch = rt.match(/^([\d.]+)\s*[-\u2013]\s*([\d.]+)/);
  if (rangeMatch) {
    return numVal < parseFloat(rangeMatch[1]) || numVal > parseFloat(rangeMatch[2]);
  }

  return null;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function emptyBand(): AgeBand {
  return { fromAge: 0, toAge: 0, label: "", rangeText: "" };
}

export function bandWithAutoLabel(b: AgeBand): AgeBand {
  const label = b.toAge >= 999
    ? `${b.fromAge} yrs and above`
    : `${b.fromAge} to ${b.toAge} yrs`;
  return { ...b, label };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
