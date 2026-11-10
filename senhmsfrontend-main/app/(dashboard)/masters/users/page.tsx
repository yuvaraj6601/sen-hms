"use client";

import { useState, useMemo } from "react";
import { getSession } from "../../../_lib/auth";
import { useMaster, masterCreate, masterUpdate, masterToggle } from "../../../_lib/useMaster";
import Badge from "../../../_components/Badge";
import PageHeader from "../../../_components/PageHeader";
import Modal, { FormField, Input, Select } from "../../../_components/Modal";
import ErrorBanner from "@/app/_components/ErrorBanner";

// ─── Backend response shape ───────────────────────────────────────────────────
interface UserResponse {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  role: "MANAGING_DIRECTOR" | "ADMIN" | "DOCTOR" | "RECEPTIONIST" | "LAB_TECH" | "INSURANCE_COORDINATOR" | "NURSE" | "LAB_INS_REC";
  departmentId: number | null;
  departmentName: string | null;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
  joinedDate: string;
  createdBy: string;
  createdAt: string;
}

// ─── Frontend types ───────────────────────────────────────────────────────────
type UserRole = "Managing Director" | "Admin" | "Doctor" | "Receptionist" | "Lab Tech" | "Insurance Coordinator" | "Nurse" | "Lab/Ins/Reception";
type UserStatus = "Active" | "Inactive";

interface AppUser {
  _id: number;
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  departmentId: number | null;
  phone: string;
  status: UserStatus;
  joinedDate: string;
  createdBy: string;
  createdDate: string;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────
const ROLE_MAP: Record<UserResponse["role"], UserRole> = {
  MANAGING_DIRECTOR:      "Managing Director",
  ADMIN:                  "Admin",
  DOCTOR:                 "Doctor",
  RECEPTIONIST:           "Receptionist",
  LAB_TECH:               "Lab Tech",
  INSURANCE_COORDINATOR:  "Insurance Coordinator",
  NURSE:                  "Nurse",
  LAB_INS_REC:            "Lab/Ins/Reception",
};

const ROLE_MAP_REVERSE: Record<UserRole, UserResponse["role"]> = {
  "Managing Director":    "MANAGING_DIRECTOR",
  Admin:                  "ADMIN",
  Doctor:                 "DOCTOR",
  Receptionist:           "RECEPTIONIST",
  "Lab Tech":             "LAB_TECH",
  "Insurance Coordinator":"INSURANCE_COORDINATOR",
  Nurse:                  "NURSE",
  "Lab/Ins/Reception":    "LAB_INS_REC",
};

function toFrontend(u: UserResponse): AppUser {
  return {
    _id:          u.id,
    id:           String(u.id),
    employeeId:   u.employeeId,
    name:         u.name,
    email:        u.email,
    role:         ROLE_MAP[u.role] ?? "Receptionist",
    department:   u.departmentName ?? "",
    departmentId: u.departmentId,
    phone:        u.phone ?? "",
    status:       u.status === "ACTIVE" ? "Active" : "Inactive",
    joinedDate:   u.joinedDate ? u.joinedDate.slice(0, 10) : "",
    createdBy:    u.createdBy ?? "system",
    createdDate:  u.createdAt ? u.createdAt.slice(0, 10) : "",
  };
}

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<UserRole, string> = {
  "Managing Director":    "bg-yellow-100 text-yellow-700",
  Admin:                  "bg-violet-100 text-violet-700",
  Doctor:                 "bg-sky-100 text-sky-700",
  Receptionist:           "bg-emerald-100 text-emerald-700",
  "Lab Tech":             "bg-amber-100 text-amber-700",
  "Insurance Coordinator":"bg-rose-100 text-rose-700",
  Nurse:                  "bg-pink-100 text-pink-700",
  "Lab/Ins/Reception":    "bg-teal-100 text-teal-700",
};

const ROLE_DESC: Record<UserRole, string> = {
  "Managing Director":    "Super admin — full access to all modules, reports, settings, and user management.",
  Admin:                  "Full access to all modules, settings, and user management.",
  Doctor:                 "Access to OP visits, admissions, prescriptions, and patient records.",
  Receptionist:           "Manages patient registration, appointments, billing, and referrers.",
  "Lab Tech":             "Lab investigations, TAT reports, and lab masters.",
  "Insurance Coordinator":"Insurance claims, reports, and coordination.",
  Nurse:                  "Ward management, nursing notes, and patient care.",
  "Lab/Ins/Reception":    "Combined front-office role — reception, lab, and insurance coordinator access.",
};

const ALL_ROLES: UserRole[] = [
  "Managing Director", "Admin", "Doctor", "Receptionist", "Lab Tech", "Insurance Coordinator", "Nurse", "Lab/Ins/Reception",
];

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    name: "", email: "", password: "",
    role: "Receptionist" as UserRole,
    phone: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    joinedDate: new Date().toISOString().slice(0, 10),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const session   = getSession();
  const role      = session?.role ?? "Admin";
  const sessionId = String(session?.id ?? "");

  if (role !== "Admin" && role !== "Managing Director") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9"/>
          </svg>
        </div>
        <p className="text-slate-700 font-semibold">Access Denied</p>
        <p className="text-sm text-slate-400">Only Admins and Managing Directors can manage users.</p>
      </div>
    );
  }

  return <UsersManager sessionId={sessionId} />;
}

// Hooks live here so they are never called conditionally (role gate is above).
function UsersManager({ sessionId }: { sessionId: string }) {
  const { data: raw, loading, error: fetchErr, reload } = useMaster<UserResponse>("/api/masters/users");
  const users = useMemo(() => raw.map(toFrontend), [raw]);

  // filters
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<AppUser | null>(null);
  const [form,      setForm]      = useState(emptyForm());
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [apiError,  setApiError]  = useState("");

  // reset password modal
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPwd,      setNewPwd]      = useState("");
  const [newPwdErr,   setNewPwdErr]   = useState("");
  const [showNewPwd,  setShowNewPwd]  = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  // filtered
  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const ms = !q ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.employeeId ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").includes(q);
    const mr = !roleFilter   || u.role   === roleFilter;
    const mt = !statusFilter || u.status === statusFilter;
    return ms && mr && mt;
  }), [users, search, roleFilter, statusFilter]);

  const totalActive = users.filter(u => u.status === "Active").length;
  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    users.forEach(u => { m[u.role] = (m[u.role] ?? 0) + 1; });
    return m;
  }, [users]);

  function openAdd() {
    setForm(emptyForm());
    setErrors({}); setApiError(""); setEditing(null); setShowPwd(false); setModalOpen(true);
  }

  function openEdit(u: AppUser) {
    setForm({
      name: u.name, email: u.email, password: "",
      role: u.role, phone: u.phone,
      status: u.status === "Active" ? "ACTIVE" : "INACTIVE",
      joinedDate: u.joinedDate,
    });
    setErrors({}); setApiError(""); setEditing(u); setShowPwd(false); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())     e.name     = "Name is required";
    if (!form.email.trim())    e.email    = "Email is required";
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (!form.joinedDate)      e.joinedDate = "Joined date is required";
    if (!editing && !form.password.trim()) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setApiError("");
    const body: Record<string, unknown> = {
      name:       form.name,
      email:      form.email,
      role:       ROLE_MAP_REVERSE[form.role],
      phone:      form.phone,
      status:     form.status,
      joinedDate: form.joinedDate,
    };
    if (form.password.trim()) body.password = form.password;

    const result = editing
      ? await masterUpdate("/api/masters/users", editing._id, body)
      : await masterCreate("/api/masters/users", body);

    setSaving(false);
    if (result.error) { setApiError(result.error); return; }
    await reload();
    setModalOpen(false);
  }

  async function handleToggleStatus(u: AppUser) {
    if (u.id === sessionId) return;
    await masterToggle("/api/masters/users", u._id);
    reload();
  }

  function openReset(u: AppUser) {
    setResetTarget(u);
    setNewPwd(""); setNewPwdErr(""); setShowNewPwd(false);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (!newPwd.trim() || newPwd.length < 6) {
      setNewPwdErr("Password must be at least 6 characters"); return;
    }
    setResetSaving(true);
    try {
      const res  = await fetch(`/api/masters/users/${resetTarget._id}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPwd }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setNewPwdErr(json.error ?? "Failed to reset password");
        return;
      }
      setResetTarget(null);
    } catch {
      setNewPwdErr("Network error");
    } finally {
      setResetSaving(false);
    }
  }

  function clearFilters() { setSearch(""); setRoleFilter(""); setStatusFilter(""); }
  const anyFilter = !!(search || roleFilter || statusFilter);

  if (loading) return <LoadingState />;

  return (
    <div>
      {fetchErr && <ErrorBanner msg={fetchErr} onRetry={reload} />}
      <PageHeader
        title="User Management"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Masters" }, { label: "Users" }]}
        action={{ label: "Add User", onClick: openAdd }}
      />

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Users",  value: users.length,               color: "text-slate-900" },
          { label: "Active",       value: totalActive,                color: "text-emerald-600" },
          { label: "Inactive",     value: users.length - totalActive, color: "text-slate-400" },
          { label: "Roles",        value: ALL_ROLES.length,           color: "text-sky-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, ID, phone…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white
              text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        <DF value={roleFilter} onChange={v => setRoleFilter(v as UserRole | "")}
          options={[
            { value: "", label: "All Roles" },
            ...ALL_ROLES.map(r => ({ value: r, label: `${r} (${roleCounts[r] ?? 0})` })),
          ]}/>

        <DF value={statusFilter} onChange={v => setStatusFilter(v as UserStatus | "")}
          options={[
            { value: "",         label: "All Status" },
            { value: "Active",   label: `Active (${totalActive})` },
            { value: "Inactive", label: `Inactive (${users.length - totalActive})` },
          ]}/>

        {anyFilter && (
          <button onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
              bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear
          </button>
        )}
        <p className="text-xs text-slate-400 self-center">{filtered.length} users</p>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#","Employee ID","Name","Role","Email","Phone","Department",
                  "Joined","Created By","Status","Actions"
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  No users found
                </td></tr>
              ) : filtered.map((u, idx) => {
                const isSelf = u.id === sessionId;
                return (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.status === "Inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>

                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${ROLE_COLORS[u.role]}`}>
                        {u.employeeId}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center
                          justify-center text-xs font-bold ${ROLE_COLORS[u.role]}`}>
                          {u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 whitespace-nowrap">{u.name}</p>
                          {isSelf && <span className="text-xs text-sky-500 font-medium">You</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{u.phone}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{u.department || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{u.joinedDate}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{u.createdBy}</td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge label={u.status} variant={u.status === "Active" ? "green" : "gray"} dot/>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50
                            hover:text-amber-600 transition-colors" title="Edit user">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                                m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>

                        <button onClick={() => openReset(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50
                            hover:text-indigo-600 transition-colors" title="Reset password">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1
                                1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                          </svg>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isSelf}
                          title={isSelf ? "Cannot deactivate yourself" :
                            u.status === "Active" ? "Deactivate" : "Activate"}
                          className={`p-1.5 rounded-lg transition-colors
                            ${isSelf ? "opacity-30 cursor-not-allowed text-slate-400" :
                              u.status === "Active"
                                ? "text-slate-400 hover:bg-red-50 hover:text-red-500"
                                : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                            }`}>
                          {u.status === "Active" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728
                                  A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {users.length} users
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit User — ${editing.employeeId}` : "Add New User"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300
                text-white font-medium rounded-lg flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              {editing ? "Save Changes" : "Add User"}
            </button>
          </>
        }>
        <div className="space-y-4">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.name}>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name" autoFocus/>
            </FormField>
            <FormField label="Role" required>
              <Select value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Email" required error={errors.email}>
            <Input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@senhospital.com"
              disabled={!!editing}
              className={editing ? "bg-slate-50 cursor-not-allowed" : ""}/>
            {editing && (
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed after creation.</p>
            )}
          </FormField>

          <FormField label={editing ? "New Password (leave blank to keep current)" : "Password"}
            required={!editing} error={errors.password}>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "Leave blank to keep current password" : "Min 6 characters"}
                className="pr-10"/>
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97
                        9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242
                        4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953
                        9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132
                        5.411m0 0L21 21"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542
                        7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone" required error={errors.phone}>
              <Input type="tel" inputMode="numeric" maxLength={10} value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                placeholder="10-digit mobile number"/>
            </FormField>
            <FormField label="Status">
              <Select value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Joined Date" required error={errors.joinedDate}>
            <Input type="date" value={form.joinedDate}
              onChange={e => setForm(f => ({ ...f, joinedDate: e.target.value }))}
              className="max-w-[200px]"/>
          </FormField>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Access for <span className={`px-1.5 py-0.5 rounded ${ROLE_COLORS[form.role]}`}>
                {form.role}
              </span>
            </p>
            <p className="text-xs text-slate-500">{ROLE_DESC[form.role]}</p>
          </div>
        </div>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.employeeId}`} size="sm"
        footer={
          <>
            <button onClick={() => setResetTarget(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button onClick={handleResetPassword} disabled={resetSaving}
              className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300
                text-white font-medium rounded-lg flex items-center gap-2">
              {resetSaving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>}
              Reset Password
            </button>
          </>
        }>
        {resetTarget && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                text-xs font-bold ${ROLE_COLORS[resetTarget.role]}`}>
                {resetTarget.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{resetTarget.name}</p>
                <p className="text-xs text-slate-400">{resetTarget.employeeId} · {resetTarget.email}</p>
              </div>
            </div>
            {newPwdErr && <p className="text-xs text-red-500">{newPwdErr}</p>}
            <FormField label="New Password" required>
              <div className="relative">
                <Input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setNewPwdErr(""); }}
                  placeholder="Min 6 characters" autoFocus
                  className="pr-10"/>
                <button type="button" onClick={() => setShowNewPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={showNewPwd
                        ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"
                        : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      }/>
                  </svg>
                </button>
              </div>
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DF({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
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

function LoadingState() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-slate-200 rounded w-48" />
        <div className="h-9 bg-slate-200 rounded w-36" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-16">
            <div className="h-2.5 bg-slate-200 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-slate-50 flex gap-6 items-center">
            <div className="h-3 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-200 rounded w-36" />
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
            <div className="h-3 bg-slate-200 rounded w-12" />
            <div className="h-5 bg-slate-200 rounded-full w-14 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-red-600 font-medium">{msg}</p>
      <button onClick={onRetry}
        className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">
        Retry
      </button>
    </div>
  );
}
