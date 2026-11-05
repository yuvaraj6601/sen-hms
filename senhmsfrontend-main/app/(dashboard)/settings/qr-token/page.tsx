"use client";

import { useState, useEffect } from "react";
import PageHeader from "../../../_components/PageHeader";
import Image from "next/image";
import { buildOPRegistrationSlipHtml } from "../../../_lib/op-slip";
import { printHtml } from "../../../_lib/print";

// ── Types ────────────────────────────────────────────────────────────────────
interface TokenEntry {
  id: string;
  uhid: string;
  name: string;
  mobile: string;
  dob: string;
  age: number;
  gender: string;
  visitType: string;
  illness: string;
  address: string;
  doctorName: string;
  referredBy: string;
  tokenNo: string;
  registeredAt: string;
  date: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getRegisterUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/opd/register`;
}

function buildQrUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(text)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function QRTokenSettingsPage() {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [date, setDate] = useState(todayStr());
  const [registerUrl, setRegisterUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Only access window on client
  useEffect(() => {
    setRegisterUrl(getRegisterUrl());
  }, []);

  // Load tokens for selected date (and auto-refresh every 10s)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tokens?date=${date}`);
        if (res.ok) setTokens(await res.json());
      } catch { /* network error — keep existing */ }
      setLastRefresh(new Date());
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [date]);

  function copyUrl() {
    navigator.clipboard.writeText(registerUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Print OP Registration Slip for a self-registered token ─────────────────
  async function printSlip(t: TokenEntry) {
    // registeredAt from self-registration is a display time (e.g. "05:51 PM").
    // Convert to 24h "HH:mm" so the shared slip builder formats it consistently.
    let visitTime: string | null = null;
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t.registeredAt || "");
    if (m) {
      let h = Number(m[1]);
      const min = m[2];
      const ap = (m[3] || "").toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      visitTime = `${String(h).padStart(2, "0")}:${min}`;
    }

    const html = await buildOPRegistrationSlipHtml({
      tokenNo:     t.tokenNo,
      uhid:        t.uhid || t.id,
      patientName: t.name,
      age:         t.age > 0 ? t.age : null,
      gender:      t.gender || null,
      phone:       t.mobile || null,
      address:     t.address || "",
      visitDate:   t.date,
      visitTime,
      doctorName:  t.doctorName || "",
      referredBy:  t.referredBy || "SELF",
    });

    printHtml(html);
  }

  function handlePrintQr() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>QR Token Registration</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: sans-serif; }
    .card { text-align: center; padding: 32px; border: 2px solid #e2e8f0; border-radius: 16px; max-width: 320px; }
    .logo { width: 56px; height: 56px; border-radius: 12px; margin: 0 auto 12px; object-fit: contain; }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #0f172a; }
    p  { font-size: 13px; color: #64748b; margin: 0 0 20px; }
    img.qr { width: 200px; height: 200px; }
    .note { font-size: 11px; color: #94a3b8; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/hos-logo.jpg" alt="Sen Hospital"/>
    <h1>Sen Hospital</h1>
    <p>Scan to register &amp; get your OP token</p>
    <img class="qr" src="${buildQrUrl(registerUrl)}" alt="QR Code"/>
    <p class="note">${registerUrl}</p>
  </div>
</body>
</html>`;
    printHtml(html);
  }

  const STATUS_COLORS: Record<string, string> = {
    New: "bg-sky-100 text-sky-700",
    Review: "bg-violet-100 text-violet-700",
    "Follow-up": "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      <PageHeader
        title="QR Self-Registration"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings" },
          { label: "QR Self-Registration" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: QR Code Card ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* QR display */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0">
                <Image src="/hos-logo.jpg" alt="Sen Hospital" width={36} height={36} className="object-contain" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Sen Hospital</p>
                <p className="text-slate-400 text-xs">Patient Self-Registration</p>
              </div>
            </div>

            <div className="flex flex-col items-center p-6 gap-3">
              <p className="text-xs text-slate-500 text-center">Scan this code to register &amp; get an OP token</p>
              {registerUrl ? (
                <img
                  src={buildQrUrl(registerUrl)}
                  alt="QR Code for OP registration"
                  width={200}
                  height={200}
                  className="rounded-xl border border-slate-100"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-slate-100 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">Loading…</span>
                </div>
              )}
              <p className="text-xs text-slate-400 text-center break-all">{registerUrl}</p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={handlePrintQr}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Download QR
              </button>
              <button
                onClick={copyUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
              >
                {copied ? (
                  <><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg><span className="text-emerald-600">Copied!</span></>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>Copy Link</>
                )}
              </button>
              <a
                href={registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview Form
              </a>
            </div>
          </div>

          {/* Tip card */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">💡 How to use</p>
            <p>1. Print the QR code and place it at reception or the entrance.</p>
            <p>2. Patients scan it with their phone camera — no app needed.</p>
            <p>3. They fill the form and get a token instantly.</p>
            <p>4. New entries appear in the queue table on the right automatically.</p>
          </div>
        </div>

        {/* ── Right: Token Queue Table ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Table header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-slate-800">Self-Registered Tokens</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auto-refreshes every 10s · Last: {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700
                    focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/tokens?date=${date}`);
                      if (res.ok) setTokens(await res.json());
                    } catch { /* ignore */ }
                    setLastRefresh(new Date());
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              {[
                { label: "Total Registered", value: tokens.length,                                          color: "text-slate-800"  },
                { label: "New Patients",      value: tokens.filter(t => t.visitType === "New").length,      color: "text-sky-600"    },
                { label: "Reviews",           value: tokens.filter(t => t.visitType !== "New").length,      color: "text-violet-600" },
              ].map(s => (
                <div key={s.label} className="px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            {tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 4h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-sm">No self-registered tokens for {date}</p>
                <p className="text-xs">Patients who scan the QR will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Token", "Name", "Mobile", "Age/Sex", "Type", "Illness", "Time", "Slip"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tokens.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded text-sm">
                            {t.tokenNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{t.name}</td>
                        <td className="px-4 py-3 text-slate-600">{t.mobile}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {t.age > 0 ? `${t.age}y` : "—"}/{t.gender.charAt(0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.visitType] ?? "bg-slate-100 text-slate-600"}`}>
                            {t.visitType}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-xs text-slate-600 truncate" title={t.illness}>{t.illness}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{t.registeredAt}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => printSlip(t)}
                            title="Print OP registration slip"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
              {tokens.length} patient{tokens.length !== 1 ? "s" : ""} registered via QR for {date}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
