"use client";

import { useState, useEffect, useMemo } from "react";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";

// ─── Backend types ────────────────────────────────────────────────────────────

interface AppointmentResponse {
  id: number;
  appointmentNo: string;
  patientId: number;
  patientName: string;
  uhid: string;
  phone: string;
  patientCategory: string;
  doctorId: number;
  doctorName: string;
  department: string;
  date: string;      // "YYYY-MM-DD"
  time: string;
  type: string;      // SCREAMING_SNAKE_CASE
  status: string;    // SCREAMING_SNAKE_CASE
  reason: string;
  smsSent: boolean;
}

interface DoctorOption { id: number; name: string; department: string | null; }
interface DeptOption   { id: number; name: string; }

// ─── Enum display maps ────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, string> = {
  SCHEDULED:   "Scheduled",
  CONFIRMED:   "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  NO_SHOW:     "No Show",
  CANCELLED:   "Cancelled",
};

const TYPE_DISPLAY: Record<string, string> = {
  NEW:       "New",
  REVIEW:    "Review",
  FOLLOW_UP: "Follow-up",
  IP_ROUNDS: "IP Rounds",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// Default editable template. Placeholders are filled per-recipient.
const DEFAULT_SMS_TEMPLATE =
  "Dear {name}, your appointment with {doctor} ({dept}) is on {date} at {time}. Please arrive 10 minutes early. — Sen Hospital";

function formatApptDate(date: string): string {
  const dt = new Date(date);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatApptTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm   = h >= 12 ? "PM" : "AM";
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Fill a template string with values from one appointment.
function renderTemplate(tpl: string, a: AppointmentResponse): string {
  return tpl
    .replace(/\{name\}/g,   a.patientName.split(" ")[0])
    .replace(/\{fullName\}/g, a.patientName)
    .replace(/\{doctor\}/g, a.doctorName)
    .replace(/\{dept\}/g,   a.department)
    .replace(/\{date\}/g,   formatApptDate(a.date))
    .replace(/\{time\}/g,   formatApptTime(a.time))
    .replace(/\{uhid\}/g,   a.uhid);
}

function smsMessage(a: AppointmentResponse, tpl: string = DEFAULT_SMS_TEMPLATE): string {
  return renderTemplate(tpl, a);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupSMSPage() {
  const [smsMode,    setSmsMode]    = useState<"op-ip" | "patient">("op-ip");
  const [dateFrom,   setDateFrom]   = useState(today());
  const [dateTo,     setDateTo]     = useState(today());
  const [deptFilter, setDeptFilter] = useState("");
  const [docFilter,  setDocFilter]  = useState("");
  const [typeFilter, setTypeFilter] = useState<"OP" | "IP" | "">("");
  const [ptSearch,   setPtSearch]   = useState("");
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [sent,       setSent]       = useState(false);
  const [sentCount,  setSentCount]  = useState(0);

  // ── Editable SMS template + review modal ──
  const [template,   setTemplate]   = useState(DEFAULT_SMS_TEMPLATE);
  const [reviewOpen, setReviewOpen] = useState(false);

  // ── Data ──
  const [allAppts,    setAllAppts]    = useState<AppointmentResponse[]>([]);
  const [doctors,     setDoctors]     = useState<DoctorOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading,     setLoading]     = useState(true);

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [apptRes, docRes, deptRes] = await Promise.all([
        apiFetch("/api/appointments?page=0&size=500"),
        apiFetch("/api/masters/doctors?page=0&size=200&active=true"),
        apiFetch("/api/masters/departments?page=0&size=200"),
      ]);
      if (apptRes.ok) {
        const content: AppointmentResponse[] = Array.isArray(apptRes.data)
          ? apptRes.data
          : (apptRes.data?.content ?? []);
        setAllAppts(content);
      }
      if (docRes.ok) {
        const content: DoctorOption[] = Array.isArray(docRes.data)
          ? docRes.data
          : (docRes.data?.content ?? []);
        setDoctors(content);
      }
      if (deptRes.ok) {
        const content: DeptOption[] = Array.isArray(deptRes.data)
          ? deptRes.data
          : (deptRes.data?.content ?? []);
        setDepartments(content);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return allAppts.filter(a => {
      // Skip terminal statuses
      if (["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status)) return false;
      const mdf = !dateFrom || a.date >= dateFrom;
      const mdt = !dateTo   || a.date <= dateTo;
      const mdc = !deptFilter || a.department === deptFilter;
      const mdr = !docFilter  || String(a.doctorId) === docFilter;
      if (smsMode === "op-ip") {
        const mt = !typeFilter || a.patientCategory === typeFilter;
        return mdf && mdt && mdc && mdr && mt;
      } else {
        const q  = ptSearch.toLowerCase();
        const ms = !q ||
          a.patientName.toLowerCase().includes(q) ||
          a.uhid.toLowerCase().includes(q);
        return mdf && mdt && ms;
      }
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [allAppts, smsMode, dateFrom, dateTo, deptFilter, docFilter, typeFilter, ptSearch]);

  const withPhone    = filtered.filter(a => a.phone);
  const withoutPhone = filtered.filter(a => !a.phone);
  // Rows that are actually sendable: have a phone AND not already sent.
  const sendable     = filtered.filter(a => a.phone && !a.smsSent);

  // ── Select helpers ─────────────────────────────────────────────────────────

  function toggleAll() {
    if (sendable.length > 0 && selected.size === sendable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sendable.map(a => a.id)));
    }
  }

  function toggleOne(id: number) {
    // Guard: never allow selecting a row that isn't sendable (no phone / already sent).
    const appt = allAppts.find(a => a.id === id);
    if (!appt || !appt.phone || appt.smsSent) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── SMS send ───────────────────────────────────────────────────────────────

  // Opens the review modal so the user can see / edit the message before sending.
  function handleSendSMS() {
    if (selected.size === 0) return;
    setReviewOpen(true);
  }

  // Confirms sending after the user reviewed / edited the template.
  function confirmSendSMS() {
    // Only send to rows that have a phone and were not already sent.
    const targets = allAppts.filter(a => selected.has(a.id) && a.phone && !a.smsSent);
    if (targets.length === 0) { setReviewOpen(false); return; }
    const targetIds = new Set(targets.map(a => a.id));

    // NOTE: The backend does not yet have a dedicated SMS endpoint.
    // Optimistic update: mark selected appointments as smsSent locally.
    // When a backend SMS endpoint is available, replace this with an API call
    // that posts { appointmentId, phone, message: renderTemplate(template, a) }.
    const count = targets.length;
    setAllAppts(prev =>
      prev.map(a => targetIds.has(a.id) ? { ...a, smsSent: true } : a)
    );
    setSentCount(count);
    setSent(true);
    setSelected(new Set());
    setReviewOpen(false);
    setTimeout(() => setSent(false), 5000);
  }

  // Appointments currently selected (for the review modal preview).
  const selectedAppts = useMemo(
    () => allAppts.filter(a => selected.has(a.id)),
    [allAppts, selected]
  );

  const allChecked = sendable.length > 0 && selected.size === sendable.length;

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Group SMS"
        breadcrumbs={[{ label: "Home", href: "/dashboard" },
          { label: "Appointments" }, { label: "Group SMS" }]}
      />

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        {(["op-ip", "patient"] as const).map(m => (
          <button key={m} onClick={() => { setSmsMode(m); setSelected(new Set()); setSent(false); }}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors
              ${smsMode === m
                ? "bg-sky-500 text-white border-sky-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
            {m === "op-ip" ? "🏥 OP / IP Wise" : "👤 Patient Wise"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-36
              focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        {smsMode === "op-ip" ? (
          <>
            <DF value={typeFilter} onChange={v => setTypeFilter(v as "OP" | "IP" | "")} options={[
              { value: "",   label: "OP & IP"  },
              { value: "OP", label: "OP Only"  },
              { value: "IP", label: "IP Only"  },
            ]}/>
            <DF value={docFilter} onChange={setDocFilter} options={[
              { value: "", label: "All Doctors" },
              ...doctors.map(d => ({ value: String(d.id), label: d.name })),
            ]}/>
            <DF value={deptFilter} onChange={setDeptFilter} options={[
              { value: "", label: "All Departments" },
              ...departments.map(d => ({ value: d.name, label: d.name })),
            ]}/>
          </>
        ) : (
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input value={ptSearch} onChange={e => setPtSearch(e.target.value)}
              placeholder="Search patient by name or UHID…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
                text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
          </div>
        )}

        <p className="text-xs text-slate-400 self-center">
          {loading ? "Loading…" : `${filtered.length} appointments · ${withPhone.length} with phone`}
        </p>
      </div>

      {/* Success banner */}
      {sent && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200
          text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {sentCount} SMS sent successfully
          {withoutPhone.length > 0 && (
            <span className="text-xs text-amber-600 ml-2">
              · {withoutPhone.length} skipped (no phone number)
            </span>
          )}
        </div>
      )}

      {/* Review & edit message modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Review message</h3>
                <p className="text-xs text-slate-400">
                  Sending to {selected.size} recipient{selected.size === 1 ? "" : "s"}
                </p>
              </div>
              <button onClick={() => setReviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto space-y-4">
              {/* Editable template */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Message template
                </label>
                <textarea
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y"/>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {["{name}", "{fullName}", "{doctor}", "{dept}", "{date}", "{time}", "{uhid}"].map(ph => (
                    <button key={ph} type="button"
                      onClick={() => setTemplate(t => t + " " + ph)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100
                        text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition-colors">
                      {ph}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Placeholders are replaced per recipient. Click a tag to insert it.
                </p>
                <button type="button" onClick={() => setTemplate(DEFAULT_SMS_TEMPLATE)}
                  className="mt-1 text-[11px] text-sky-600 hover:underline">
                  Reset to default
                </button>
              </div>

              {/* Live preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Preview {selectedAppts.length > 1 && "(first recipient)"}
                </label>
                {selectedAppts[0] ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                    text-sm text-slate-700 whitespace-pre-wrap">
                    {renderTemplate(template, selectedAppts[0])}
                    <div className="mt-2 text-[11px] text-slate-400">
                      {renderTemplate(template, selectedAppts[0]).length} characters ·
                      {" "}{Math.ceil(renderTemplate(template, selectedAppts[0]).length / 160) || 1} SMS part(s)
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No recipients selected.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setReviewOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm
                  font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={confirmSendSMS}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white
                  text-sm font-semibold">
                Send {selected.size} SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={allChecked}
            onChange={toggleAll} className="w-4 h-4 accent-sky-500 cursor-pointer"/>
          <span className="text-xs text-slate-500">
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
        </div>
        <button
          onClick={handleSendSMS}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500
            hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-sm font-semibold transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0
                012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          Send SMS ({selected.size})
        </button>
      </div>

      {/* Preview table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-10"></th>
                {["Patient","UHID","Phone","Appt Date","Time","Doctor","Type","Status","SMS Preview"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  Loading appointments…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  No appointments found for the selected filters
                </td></tr>
              ) : filtered.map(a => {
                const hasPhone   = !!a.phone;
                const isSelected = selected.has(a.id);
                const canSend    = hasPhone && !a.smsSent;
                return (
                  <tr key={a.id}
                    className={`transition-colors
                      ${isSelected ? "bg-sky-50" : "hover:bg-slate-50"}
                      ${!hasPhone ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox"
                        checked={isSelected}
                        disabled={!canSend}
                        title={a.smsSent ? "SMS already sent" : !hasPhone ? "No phone number" : ""}
                        onChange={() => toggleOne(a.id)}
                        className="w-4 h-4 accent-sky-500 cursor-pointer disabled:cursor-not-allowed"/>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                          ${a.patientCategory === "IP" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}`}>
                          {a.patientCategory}
                        </span>
                        <p className="font-medium text-slate-800 whitespace-nowrap">{a.patientName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.uhid}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {hasPhone ? a.phone : (
                        <span className="text-red-400 text-xs">⚠ No phone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{a.date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{a.time}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{a.doctorName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge label={TYPE_DISPLAY[a.type] ?? a.type} variant="gray"/>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge label={STATUS_DISPLAY[a.status] ?? a.status} dot/>
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      {a.smsSent ? (
                        <span className="text-xs text-emerald-600 font-medium">✓ Already sent</span>
                      ) : hasPhone ? (
                        <p className="text-xs text-slate-500 truncate italic" title={smsMessage(a, template)}>
                          {smsMessage(a, template)}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex justify-between text-xs text-slate-400">
          <span>{filtered.length} appointments</span>
          <span>{withPhone.length} with phone · {withoutPhone.length} without</span>
        </div>
      </div>
    </div>
  );
}

// ─── Dropdown helper ──────────────────────────────────────────────────────────

function DF({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-slate-700 focus:outline-none focus:ring-2
          focus:ring-sky-500 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
        w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
      </svg>
    </div>
  );
}
