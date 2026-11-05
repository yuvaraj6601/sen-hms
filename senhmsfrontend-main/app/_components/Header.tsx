"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout, type Role } from "../_lib/auth";

// ─── Patient search result type ───────────────────────────────────────────────
interface PatientHit {
  id: number;
  uhid: string;
  name: string;
  age: number | null;
  phone: string;
  patientType: string;
}

const ROLE_COLORS: Record<Role, string> = {
  "Managing Director":     "bg-yellow-100 text-yellow-700",
  Admin:                   "bg-blue-100 text-blue-800",
  Doctor:                  "bg-blue-100 text-blue-800",
  Receptionist:            "bg-blue-100 text-blue-800",
  "Lab Tech":              "bg-blue-100 text-blue-800",
  "Insurance Coordinator": "bg-blue-100 text-blue-800",
  Nurse:                   "bg-blue-100 text-blue-800",
  "Lab/Ins/Reception":     "bg-blue-100 text-blue-800",
};

const ROLE_AVATAR: Record<Role, string> = {
  "Managing Director":     "bg-yellow-600",
  Admin:                   "bg-[#00059f]",
  Doctor:                  "bg-[#00059f]",
  Receptionist:            "bg-[#00059f]",
  "Lab Tech":              "bg-[#00059f]",
  "Insurance Coordinator": "bg-[#00059f]",
  Nurse:                   "bg-[#00059f]",
  "Lab/Ins/Reception":     "bg-[#00059f]",
};

interface HeaderProps {
  userName: string;
  role: Role;
  onMenuClick: () => void;
  onLogout?: () => void;
}

// ─── Notification Bell ───────────────────────────────────────────────────────
interface ExpenseNotif {
  id: number;
  expenseNo: string;
  towards: string;
  amount: number;
  preparedBy: string;
  status: string;
  date: string;
}

const SEEN_KEY = "hms_notif_seen"; // localStorage key for seen notification IDs

function getSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch { return new Set(); }
}

function markAllSeen(ids: number[]) {
  try {
    const existing = getSeenIds();
    ids.forEach(id => existing.add(id));
    // Keep only the last 200 to avoid unbounded growth
    const arr = Array.from(existing).slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

function NotificationBell({ role, userName }: { role: Role; userName: string }) {
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<ExpenseNotif[]>([]);
  const [unseenCount, setUnseen]  = useState(0);
  const [loading, setLoading]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAdmin = role === "Admin";
  const isMD    = role === "Managing Director";
  const isOther = !isAdmin && !isMD;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchNotifs = useCallback(async () => {
    if (isMD) return;
    setLoading(true);
    try {
      let url = "";
      if (isAdmin) {
        url = "/api/expenses?status=PENDING&page=0&size=10&sort=date,desc";
      } else {
        url = "/api/expenses?page=0&size=20&sort=date,desc";
      }
      const res  = await fetch(url, { headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      if (json.success) {
        const raw: ExpenseNotif[] = (json.data?.content ?? json.data ?? []).map((e: {
          id: number; expenseNo: string; towards: string; amount: number;
          preparedBy: string; status: string; date: string;
        }) => ({
          id: e.id, expenseNo: e.expenseNo, towards: e.towards,
          amount: e.amount, preparedBy: e.preparedBy,
          status: e.status, date: e.date,
        }));

        let filtered: ExpenseNotif[];
        if (isAdmin) {
          filtered = raw; // already filtered to PENDING
        } else {
          filtered = raw.filter(e =>
            e.preparedBy === userName &&
            (e.status === "APPROVED" || e.status === "REJECTED")
          ).slice(0, 10);
        }

        setItems(filtered);
        // Badge = items NOT yet seen
        const seen = getSeenIds();
        setUnseen(filtered.filter(e => !seen.has(e.id)).length);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isMD, userName]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // When dropdown opens → mark all current items as seen → badge goes to 0
  useEffect(() => {
    if (open && items.length > 0) {
      markAllSeen(items.map(e => e.id));
      setUnseen(0);
    }
  }, [open, items]);

  if (isMD) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        className="relative p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white
            text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl
          border border-slate-100 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {isAdmin ? "Pending Expense Approvals" : "My Expense Updates"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdmin
                  ? `${items.length} request${items.length !== 1 ? "s" : ""} awaiting your action`
                  : `${items.length} recent update${items.length !== 1 ? "s" : ""} on your requests`}
              </p>
            </div>
            <button onClick={fetchNotifs} title="Refresh"
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-slate-400">
                  {isAdmin ? "No pending approvals" : "No updates yet"}
                </p>
              </div>
            ) : items.map(item => (
              <div key={item.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {item.expenseNo}
                      </span>
                      {!isAdmin && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}>
                          {item.status === "APPROVED" ? "✓ Approved" : "✕ Rejected"}
                        </span>
                      )}
                      {isAdmin && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          ⏳ Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate mt-0.5">{item.towards}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isAdmin
                        ? <>By <span className="font-medium text-slate-600">{item.preparedBy}</span> · {item.date}</>
                        : item.date
                      }
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                    ₹{Number(item.amount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <a href="/expenses"
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center justify-center gap-1">
              View all expenses
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ userName, role, onMenuClick, onLogout }: HeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Global patient search ─────────────────────────────────────────────────
  const [gSearch,    setGSearch]    = useState("");
  const [gResults,   setGResults]   = useState<PatientHit[]>([]);
  const [gOpen,      setGOpen]      = useState(false);
  const [gSearching, setGSearching] = useState(false);
  const gRef     = useRef<HTMLDivElement>(null);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runGlobalSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setGResults([]); setGSearching(false); return; }
    setGSearching(true);
    try {
      const res  = await fetch(`/api/patients?search=${encodeURIComponent(q.trim())}&page=0&size=8`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        const list: PatientHit[] = Array.isArray(json.data)
          ? json.data
          : (json.data?.content ?? []);
        setGResults(list);
      }
    } finally {
      setGSearching(false);
    }
  }, []);

  function handleGSearchChange(val: string) {
    setGSearch(val);
    setGOpen(true);
    if (gTimerRef.current) clearTimeout(gTimerRef.current);
    if (!val.trim()) { setGResults([]); return; }
    gTimerRef.current = setTimeout(() => runGlobalSearch(val), 300);
  }

  function handleGSelect(p: PatientHit) {
    setGSearch("");
    setGResults([]);
    setGOpen(false);
    router.push(`/patients/${p.id}/case-sheet`);
  }

  // Close global search dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (gRef.current && !gRef.current.contains(e.target as Node)) {
        setGOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const parts    = userName.trim().split(" ").filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
  const displayName = parts.join(" ");
  const roleLabel   = role === "Insurance Coordinator" ? "Insurance" : role;

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleLogout() {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      router.replace("/");
    }
  }

  function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (pwForm.next.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    // Mock success — in real app call API here
    setPwSuccess(true);
    setTimeout(() => {
      setShowChangePw(false);
      setOpen(false);
      setPwForm({ current: "", next: "", confirm: "" });
      setPwSuccess(false);
    }, 1200);
  }

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-100 shadow-sm flex items-center
        justify-between px-3 sm:px-5 gap-3 flex-shrink-0">

        {/* ── Left: hamburger + greeting ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={onMenuClick} aria-label="Open menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Greeting — visible on md+ */}
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {userName.split(" ")[0]} 👋
            </span>
            <span className="text-[10px] text-slate-400">{dateStr}</span>
          </div>
        </div>

        {/* ── Center: global patient search ── */}
        <div className="flex-1 max-w-xs hidden md:block" ref={gRef}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={gSearch}
              onChange={e => handleGSearchChange(e.target.value)}
              onFocus={() => { if (gSearch.trim().length >= 2) setGOpen(true); }}
              placeholder="Search patients by name or UHID…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50
                text-xs text-slate-700 placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {gSearching && (
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin"
                fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {/* Results dropdown */}
            {gOpen && gResults.length > 0 && (
              <ul className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200
                rounded-xl shadow-lg z-[100] overflow-hidden text-sm">
                {gResults.map(p => (
                  <li key={p.id}>
                    <button
                      onMouseDown={() => handleGSelect(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sky-50
                        text-left transition-colors">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0
                        ${p.patientType === "IP" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}`}>
                        {p.patientType}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.uhid}
                          {p.age != null ? ` · ${p.age}y` : ""}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {gOpen && !gSearching && gSearch.trim().length >= 2 && gResults.length === 0 && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200
                rounded-xl shadow-lg z-[100] px-4 py-3 text-xs text-slate-400">
                No patients found for &quot;{gSearch}&quot;
              </div>
            )}
          </div>
        </div>

        {/* ── Right: notifications + user ── */}
        <div className="flex items-center gap-1 flex-shrink-0">

          {/* Notifications */}
          <NotificationBell role={role} userName={userName} />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

          {/* User button + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 pl-0.5 pr-1 py-1 rounded-xl
                hover:bg-slate-100 transition-colors focus:outline-none">
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full ${ROLE_AVATAR[role]}
                flex items-center justify-center flex-shrink-0`}>
                <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
              </div>
              {/* Name + role */}
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{displayName}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-px rounded-full mt-0.5 ${ROLE_COLORS[role]}`}>
                  {roleLabel}
                </span>
              </div>
              {/* Chevron */}
              <svg className={`hidden sm:block w-3 h-3 text-slate-400 flex-shrink-0 transition-transform duration-150
                ${open ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl
                border border-slate-100 shadow-lg py-1.5 z-50">

                {/* User info header */}
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-800 truncate">{displayName}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${ROLE_COLORS[role]}`}>
                    {roleLabel}
                  </span>
                </div>

                {/* Change Password */}
                <button
                  onClick={() => { setShowChangePw(true); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600
                    hover:bg-slate-50 transition-colors text-left">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Change Password
                </button>

                <div className="mx-4 my-1 h-px bg-slate-100" />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-500
                    hover:bg-red-50 transition-colors text-left">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Change Password Modal ── */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-slate-800">Change Password</h2>
              <button onClick={() => { setShowChangePw(false); setPwError(""); setPwSuccess(false); }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {pwSuccess ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">Password updated!</p>
              </div>
            ) : (
              <form onSubmit={handleChangePw} className="space-y-3">
                {[
                  { label: "Current Password",  key: "current" as const },
                  { label: "New Password",       key: "next"    as const },
                  { label: "Confirm Password",   key: "confirm" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input
                      type="password"
                      value={pwForm[key]}
                      onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs
                        text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                        focus:border-transparent transition-all placeholder:text-slate-400"
                      placeholder="••••••••"
                    />
                  </div>
                ))}

                {pwError && (
                  <p className="text-xs text-red-500 font-medium">{pwError}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button"
                    onClick={() => { setShowChangePw(false); setPwError(""); }}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-xs
                      font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 rounded-xl bg-[#00059f] text-white text-xs
                      font-semibold hover:bg-blue-900 transition-colors">
                    Update
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
