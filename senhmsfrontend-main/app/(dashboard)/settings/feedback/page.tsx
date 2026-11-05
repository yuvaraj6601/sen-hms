"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import PageHeader from "../../../_components/PageHeader";
import Modal from "../../../_components/Modal";
import Badge from "../../../_components/Badge";
import { printHtml } from "../../../_lib/print";
import {
  buildFeedbackReportHtml,
  ratingLabel,
  type FeedbackReportData,
} from "../../../_lib/feedback-report";

const PAGE_SIZE = 20;

// ─── Backend shapes ───────────────────────────────────────────────────────────
interface FeedbackSummary {
  id: number;
  name: string;
  mobile: string;
  averageScore: number | null;
  answeredCount: number;
  hasComments: boolean;
  createdAt: string;
}

interface FeedbackAnswer {
  question: string;
  order: number;
  questionEnglish: string;
  questionTamil: string | null;
  rating: string | null;
  score: number | null;
}

interface FeedbackDetail {
  id: number;
  name: string;
  mobile: string;
  comments: string | null;
  averageScore: number | null;
  createdAt: string;
  answers: FeedbackAnswer[];
}

interface PagedShape<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─── API helper (goes through the same-origin BFF proxy) ─────────────────────
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error ?? "Request failed");
  }
  return json.data as T;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── QR code helpers (same free service used by the QR self-registration page) ─
function getFormUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/feedback-form`;
}

function buildQrUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(text)}`;
}

type BadgeVariant = "green" | "yellow" | "red" | "gray";

function scoreVariant(score: number | null): BadgeVariant {
  if (score == null) return "gray";
  if (score >= 4) return "green";
  if (score >= 3) return "yellow";
  return "red";
}

export default function FeedbackPage() {
  const [rows, setRows]         = useState<FeedbackSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [page, setPage]         = useState(0);
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Detail modal
  const [detail, setDetail]           = useState<FeedbackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // QR code for the public feedback form
  const [formUrl, setFormUrl] = useState("");
  const [copied, setCopied]   = useState(false);

  useEffect(() => { setFormUrl(getFormUrl()); }, []);

  function copyUrl() {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrintQr() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Patient Feedback QR</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: sans-serif; }
    .card { text-align: center; padding: 32px; border: 2px solid #e2e8f0; border-radius: 16px; max-width: 340px; }
    .logo { width: 56px; height: 56px; border-radius: 12px; margin: 0 auto 12px; object-fit: contain; }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #0f172a; }
    p  { font-size: 13px; color: #64748b; margin: 0 0 4px; }
    .ta { font-size: 12px; color: #0369a1; margin: 0 0 18px; }
    img.qr { width: 200px; height: 200px; }
    .note { font-size: 11px; color: #94a3b8; margin-top: 16px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/hos-logo.jpg" alt="Sen Hospital"/>
    <h1>Sen Hospital</h1>
    <p>Scan to share your feedback</p>
    <p class="ta">உங்கள் கருத்தை பகிர ஸ்கேன் செய்யவும்</p>
    <img class="qr" src="${buildQrUrl(formUrl)}" alt="Feedback QR Code"/>
    <p class="note">${formUrl}</p>
  </div>
</body>
</html>`;
    printHtml(html);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      qs.set("page", String(page));
      qs.set("size", String(PAGE_SIZE));
      const data = await apiGet<PagedShape<FeedbackSummary>>(`/api/feedback?${qs.toString()}`);
      setRows(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feedback.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to first page whenever filters change.
  useEffect(() => { setPage(0); }, [search, dateFrom, dateTo]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await apiGet<FeedbackDetail>(`/api/feedback/${id}`);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the submission.");
    } finally {
      setDetailLoading(false);
    }
  }

  function downloadReport(fb: FeedbackDetail) {
    const html = buildFeedbackReportHtml(fb as FeedbackReportData);
    printHtml(html);
  }

  return (
    <div>
      <PageHeader
        title="Patient Feedback"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Settings" }, { label: "Patient Feedback" }]}
      />

      {/* QR code card — print & display for patients to scan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-5 p-5">
          {/* QR image */}
          <div className="flex-shrink-0">
            {formUrl ? (
              <img
                src={buildQrUrl(formUrl)}
                alt="Feedback form QR code"
                width={140}
                height={140}
                className="rounded-xl border border-slate-100"
              />
            ) : (
              <div className="w-[140px] h-[140px] rounded-xl bg-slate-100 flex items-center justify-center">
                <span className="text-slate-400 text-xs">Loading…</span>
              </div>
            )}
          </div>

          {/* Info + actions */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-white flex-shrink-0">
                <Image src="/hos-logo.jpg" alt="Sen Hospital" width={28} height={28} className="object-contain" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Patient Feedback QR</h2>
            </div>
            <p className="text-sm text-slate-500">
              Print this and place it at reception, wards, or on the bill. Patients scan it with
              their phone — no app or login needed — and submit feedback directly.
            </p>
            <p className="text-xs text-slate-400 break-all mt-1">{formUrl}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <button
                onClick={handlePrintQr}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800
                  text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Download QR
              </button>
              <button
                onClick={copyUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200
                  hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
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
              {formUrl && (
                <a
                  href={formUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sky-200
                    bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Preview Form
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Search (name / mobile)</label>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or mobile…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3 text-center">Avg. Score</th>
                <th className="px-4 py-3 text-center">Answered</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No feedback submissions found.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.name}
                    {r.hasComments && (
                      <span className="ml-2 inline-flex items-center text-[10px] text-sky-600" title="Has comments">💬</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.mobile}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={scoreVariant(r.averageScore)}
                      label={r.averageScore != null ? r.averageScore.toFixed(2) : "—"}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{r.answeredCount} / 18</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetail(r.id)}
                      className="text-sky-600 hover:text-sky-700 font-medium text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              {totalElements} submission{totalElements === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Prev
              </button>
              <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail ? `Feedback — ${detail.name}` : "Loading…"}
          size="lg"
        >
          {detailLoading && (
            <div className="py-10 text-center text-slate-400">Loading submission…</div>
          )}
          {detail && (
            <div>
              {/* Header meta */}
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-4">
                <div><span className="text-slate-400">Name:</span> <span className="font-medium">{detail.name}</span></div>
                <div><span className="text-slate-400">Mobile:</span> <span className="font-medium">{detail.mobile}</span></div>
                <div><span className="text-slate-400">Submitted:</span> <span className="font-medium">{fmtDate(detail.createdAt)}</span></div>
                <div>
                  <span className="text-slate-400">Average:</span>{" "}
                  <Badge
                    variant={scoreVariant(detail.averageScore)}
                    label={detail.averageScore != null ? detail.averageScore.toFixed(2) : "—"}
                  />
                </div>
              </div>

              {/* Answers */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">Statement</th>
                      <th className="px-3 py-2 text-right">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.answers.map((a) => (
                      <tr key={a.question}>
                        <td className="px-3 py-2 text-slate-400 text-center">{a.order}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{a.questionEnglish}</div>
                          {a.questionTamil && <div className="text-xs text-sky-600">{a.questionTamil}</div>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {a.rating ? (
                            <Badge variant={scoreVariant(a.score)} label={ratingLabel(a.rating)} />
                          ) : (
                            <span className="text-slate-300 text-xs">Not answered</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Comments */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Special Comments</h4>
                <p className="text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 min-h-[44px] whitespace-pre-wrap">
                  {detail.comments || <span className="text-slate-300">No comments</span>}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setDetail(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => downloadReport(detail)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600
                    text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download / Print
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
