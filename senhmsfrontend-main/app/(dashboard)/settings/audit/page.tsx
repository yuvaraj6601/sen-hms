"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSession } from "../../../_lib/auth";
import PageHeader from "../../../_components/PageHeader";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend shapes ─────────────────────────────────────────────────────────
interface AuditLogResponse {
  id: number;
  createdAt: string;      // ISO date-time
  performedBy: string | null;       // username (display name)
  performedByEmail: string | null;  // underlying email
  action: string | null;
  entityType: string | null;   // "Module"
  entityId: number | null;
  details: string | null;      // "Description"
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditPerformer {
  email: string;
  name: string;
}

interface PagedData<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

const PAGE_SIZE = 25;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Action → colored pill
function actionClass(action: string | null): string {
  const a = (action ?? "").toUpperCase();
  if (a === "CREATE" || a === "BOOKED") return "bg-emerald-100 text-emerald-700";
  if (a === "UPDATE" || a.includes("TOGGLE")) return "bg-amber-100 text-amber-700";
  if (a === "DELETE" || a === "CANCELLED" || a === "CANCEL") return "bg-red-100 text-red-700";
  if (a === "LOGIN") return "bg-sky-100 text-sky-700";
  if (a === "DISCHARGE" || a === "TRANSFER") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-600";
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const session = getSession();
  const role = session?.role ?? "Admin";

  // Frontend route protection (backend enforces this too).
  if (role !== "Managing Director") {
    return <AccessDenied />;
  }

  return <AuditContent />;
}

function AuditContent() {
  // ── Draft filter values (what's in the form) ──
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userFilter, setUserFilter] = useState(""); // "" = All Users

  // ── Applied filters (what's actually queried) ──
  const [applied, setApplied] = useState({ fromDate: "", toDate: "", user: "" });
  const [dateError, setDateError] = useState("");

  // ── Data / paging ──
  const [rows, setRows] = useState<AuditLogResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Expanded row detail ──
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── User dropdown list ──
  const [users, setUsers] = useState<AuditPerformer[]>([]);

  // Fetch distinct performers once for the dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/audit-logs/users");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
          setUsers(
            (json.data as AuditPerformer[]).filter((u) => u && u.email)
          );
        }
      } catch {
        /* dropdown falls back to All Users only */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Data fetch (server-side filtering + pagination) ──
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (applied.user) qs.set("user", applied.user);
      if (applied.fromDate) qs.set("fromDate", applied.fromDate);
      if (applied.toDate) qs.set("toDate", applied.toDate);

      const res = await fetch(`/api/audit-logs?${qs.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to load audit logs.");
        setRows([]);
        setTotalPages(0);
        setTotalElements(0);
        return;
      }

      const data = json.data as PagedData<AuditLogResponse>;
      setRows(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch {
      setError("Network error. Please try again.");
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Filter actions ──
  function handleApply() {
    if (fromDate && toDate && fromDate > toDate) {
      setDateError("From Date cannot be later than To Date.");
      return;
    }
    setDateError("");
    setPage(0);
    setExpandedId(null);
    setApplied({ fromDate, toDate, user: userFilter });
  }

  function handleReset() {
    setFromDate("");
    setToDate("");
    setUserFilter("");
    setDateError("");
    setPage(0);
    setExpandedId(null);
    setApplied({ fromDate: "", toDate: "", user: "" });
  }

  const hasActiveFilters = !!(applied.fromDate || applied.toDate || applied.user);
  const draftDirty =
    fromDate !== applied.fromDate ||
    toDate !== applied.toDate ||
    userFilter !== applied.user;

  const startRow = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const endRow = Math.min((page + 1) * PAGE_SIZE, totalElements);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Audit" },
        ]}
      />

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">From Date</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">To Date</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-semibold text-slate-500">User</label>
            <UserSelect value={userFilter} onChange={setUserFilter} options={users} />
          </div>

          <button
            onClick={handleApply}
            className="inline-flex items-center gap-2 bg-[#00059f] hover:bg-[#00047a] text-white
              text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Apply Filter
          </button>

          <button
            onClick={handleReset}
            disabled={!hasActiveFilters && !fromDate && !toDate && !userFilter}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-600
              hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
              text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        </div>

        {dateError && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {dateError}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3">
          <p className="text-xs text-slate-400">
            {loading ? "Loading…" : `${totalElements} record${totalElements === 1 ? "" : "s"}`}
            {hasActiveFilters && !loading && " (filtered)"}
          </p>
          {draftDirty && !loading && (
            <span className="text-xs text-amber-600 font-medium">
              Unapplied changes — click Apply Filter
            </span>
          )}
        </div>
      </div>

      {error && <ErrorBanner msg={error} onRetry={loadLogs} />}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Date & Time", "User", "Action", "Module", "Description", "IP Address", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <SkeletonRows />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <EmptyState filtered={hasActiveFilters} />
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOpen = expandedId === r.id;
                  return (
                    <FragmentRow
                      key={r.id}
                      row={r}
                      isOpen={isOpen}
                      onToggle={() => setExpandedId(isOpen ? null : r.id)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3
            px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing <span className="font-medium text-slate-600">{startRow}</span>–
              <span className="font-medium text-slate-600">{endRow}</span> of{" "}
              <span className="font-medium text-slate-600">{totalElements}</span>
            </p>
            <div className="flex items-center gap-1">
              <PageBtn disabled={page === 0} onClick={() => setPage(0)} label="First" />
              <PageBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} label="Prev" />
              <span className="px-3 py-1.5 text-xs text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
              <PageBtn disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} label="Next" />
              <PageBtn disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} label="Last" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row (with expandable detail) ─────────────────────────────────────────────
function FragmentRow({
  row, isOpen, onToggle,
}: { row: AuditLogResponse; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors align-top">
        <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">
          {formatDateTime(row.createdAt)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="font-medium text-slate-800">{row.performedBy ?? "system"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionClass(row.action)}`}>
            {row.action ?? "—"}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.entityType ?? "—"}</td>
        <td className="px-4 py-3 text-slate-600 max-w-md">
          <span className="block truncate" title={row.details ?? ""}>
            {row.details ?? "—"}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
          {row.ipAddress ?? "—"}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <button
            onClick={onToggle}
            className="text-xs font-medium text-[#00059f] hover:text-[#00047a] inline-flex items-center gap-1"
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide" : "View"}
            <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/60">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <DetailItem label="Log ID" value={String(row.id)} />
              <DetailItem label="Date & Time" value={formatDateTime(row.createdAt)} />
              <DetailItem label="User" value={row.performedBy ?? "system"} />
              <DetailItem label="Email" value={row.performedByEmail ?? "—"} />
              <DetailItem label="Action" value={row.action ?? "—"} />
              <DetailItem label="Module" value={row.entityType ?? "—"} />
              <DetailItem label="Record ID" value={row.entityId != null ? String(row.entityId) : "—"} />
              <DetailItem label="IP Address" value={row.ipAddress ?? "—"} />
              <DetailItem label="Client / User Agent" value={row.userAgent ?? "—"} />
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words bg-white
                border border-slate-200 rounded-lg px-3 py-2">
                {row.details ?? "—"}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-slate-700 break-words">{value}</p>
    </div>
  );
}

// ─── Searchable user dropdown ─────────────────────────────────────────────────
// `value` is the selected user's email ("" = All Users); the dropdown displays
// the username (name) while filtering happens by email on the server.
function UserSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: AuditPerformer[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q)
    );
  }, [query, options]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const match = options.find((o) => o.email.toLowerCase() === value.toLowerCase());
    return match ? match.name : value;
  }, [value, options]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-200
          rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <span className={value ? "text-slate-800 truncate" : "text-slate-500"}>
          {selectedLabel || "All Users"}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg
          max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user…"
              className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="overflow-y-auto">
            <button
              type="button"
              onClick={() => pick("")}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50
                ${value === "" ? "text-[#00059f] font-semibold bg-[#00059f]/5" : "text-slate-700"}`}
            >
              All Users
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No matching users</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.email}
                  type="button"
                  onClick={() => pick(o.email)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50
                    ${value.toLowerCase() === o.email.toLowerCase()
                      ? "bg-[#00059f]/5" : ""}`}
                  title={o.email}
                >
                  <span className={`block text-sm truncate ${value.toLowerCase() === o.email.toLowerCase()
                    ? "text-[#00059f] font-semibold" : "text-slate-700"}`}>
                    {o.name}
                  </span>
                  <span className="block text-xs text-slate-400 truncate">{o.email}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function PageBtn({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600
        hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-32" /></td>
          <td className="px-4 py-3"><div className="h-3 bg-slate-200 rounded w-36" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-full w-16" /></td>
          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-full" /></td>
          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-24" /></td>
          <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-10 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-slate-600 font-medium">No audit records found</p>
      <p className="text-xs text-slate-400">
        {filtered
          ? "No audit logs match the selected filters. Try adjusting the date range or user."
          : "There are no audit-log entries recorded yet."}
      </p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-slate-700 font-semibold">Access Denied</p>
      <p className="text-sm text-slate-400">Only the Managing Director can view audit logs.</p>
    </div>
  );
}
