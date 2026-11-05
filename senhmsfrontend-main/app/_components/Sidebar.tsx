"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { canView, logout, type Role } from "../_lib/auth";

interface NavLeaf { href: string; label: string; permKey: string; exactMatch?: boolean; }
interface NavGroup { kind: "group"; label: string; items: NavLeaf[]; }
interface NavLeafEntry extends NavLeaf { kind: "leaf"; }
type NavEntry = NavLeafEntry | NavGroup;
interface NavSection {
  key: string;
  label: string;
  iconBg: string;      // bg color of the icon square
  iconColor: string;   // icon stroke/fill color
  icon: React.ReactNode;
  entries: NavEntry[];
}
interface FlatItem {
  href: string;
  label: string;
  permKey: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const FLAT_ITEMS: FlatItem[] = [
  {
    href: "/dashboard", label: "Dashboard", permKey: "dashboard",
    iconBg: "bg-violet-100", iconColor: "text-violet-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    href: "/op-visits", label: "OP Token Queue", permKey: "op-visits",
    iconBg: "bg-cyan-100", iconColor: "text-cyan-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
  },
];

// Sections rendered under the "Main Modules" heading (accordion style).
const MAIN_SECTIONS: NavSection[] = [
  {
    key: "appointments", label: "Appointments",
    iconBg: "bg-sky-100", iconColor: "text-sky-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    entries: [
      { kind: "leaf", href: "/appointments/list", label: "Appointments", permKey: "appointments/list" },
      { kind: "leaf", href: "/appointments/sms",  label: "Group SMS",    permKey: "appointments/sms" },
    ],
  },
];

const SECTIONS: NavSection[] = [
  {
    key: "patients", label: "Patient & Admissions",
    iconBg: "bg-blue-100", iconColor: "text-blue-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    entries: [
      { kind: "leaf", href: "/patients", label: "Patient List", permKey: "patients/list" },
    ],
  },
  {
    key: "bills", label: "Bills",
    iconBg: "bg-yellow-100", iconColor: "text-yellow-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
    entries: [
      { kind: "leaf", href: "/bills", label: "Bill List", permKey: "bills" },
    ],
  },
  {
    key: "insurance", label: "Insurance",
    iconBg: "bg-teal-100", iconColor: "text-teal-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    entries: [
      { kind: "leaf", href: "/insurance", label: "Insurance Claims", permKey: "insurance" },
    ],
  },
  {
    key: "lab", label: "Lab",
    iconBg: "bg-emerald-100", iconColor: "text-emerald-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    entries: [
      { kind: "leaf", href: "/lab/investigations", label: "Lab Investigations", permKey: "lab/investigations" },
      { kind: "leaf", href: "/lab/tat-report",     label: "TAT Report",         permKey: "lab/tat-report" },
    ],
  },
  {
    key: "daily-summary", label: "Daily Summary",
    iconBg: "bg-violet-100", iconColor: "text-violet-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    entries: [
      { kind: "leaf", href: "/daily-summary",                   label: "Cash Collection",           permKey: "daily-summary",                      exactMatch: true },
      { kind: "leaf", href: "/daily-summary/pharmacy-collection", label: "Pharmacy Cash Collection",  permKey: "daily-summary/pharmacy-collection" },
      { kind: "leaf", href: "/daily-summary/insurance-claims",  label: "Insurance Claims Received", permKey: "daily-summary/insurance-claims" },
      { kind: "leaf", href: "/daily-summary/day-report",        label: "Day Summary Report",        permKey: "daily-summary/day-report" },
    ],
  },
  {
    key: "expenses", label: "Expenses",
    iconBg: "bg-red-100", iconColor: "text-red-500",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>,
    entries: [
      { kind: "leaf", href: "/expenses", label: "Expense List", permKey: "expenses" },
    ],
  },
  {
    key: "contacts", label: "Contacts",
    iconBg: "bg-pink-100", iconColor: "text-pink-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    entries: [
      { kind: "leaf", href: "/contacts", label: "Contact Info List", permKey: "contacts" },
    ],
  },
  {
    key: "reports", label: "Reports",
    iconBg: "bg-indigo-100", iconColor: "text-indigo-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    entries: [
      { kind: "leaf", href: "/reports/statistics",     label: "Patient Report",  permKey: "reports/statistics" },
      { kind: "leaf", href: "/reports/income",         label: "Income Report",   permKey: "reports/income" },
      { kind: "leaf", href: "/reports/expense-list",   label: "Expense Report",  permKey: "reports/expense-list" },
      { kind: "leaf", href: "/reports/net-cash",       label: "Net Cash Report", permKey: "reports/net-cash" },
    ],
  },
  {
    key: "masters", label: "Masters",
    iconBg: "bg-orange-100", iconColor: "text-orange-500",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    entries: [
      { kind: "leaf", href: "/masters/users",             label: "Users",                 permKey: "masters/users" },
      { kind: "leaf", href: "/masters/doctors",           label: "Doctor List",           permKey: "masters/doctors" },
      { kind: "leaf", href: "/masters/referrers",         label: "Referrer List",         permKey: "masters/referrers" },
      { kind: "leaf", href: "/masters/departments",       label: "Departments",           permKey: "masters/departments" },
      { kind: "leaf", href: "/masters/wards-beds",        label: "Wards & Beds",          permKey: "masters/wards-beds" },
      { kind: "leaf", href: "/masters/lab",               label: "Lab Masters",           permKey: "masters/lab" },
      { kind: "leaf", href: "/masters/billing-modality",  label: "Billing Modality",      permKey: "masters/billing-modality" },
      { kind: "leaf", href: "/masters/billing-masters",   label: "Billing Masters",       permKey: "masters/billing-masters" },
      { kind: "leaf", href: "/masters/expense-category",  label: "Expense Category",      permKey: "masters/expense-category" },
      { kind: "leaf", href: "/masters/insurance-companies", label: "Insurance Company",     permKey: "masters/insurance-companies" },
      { kind: "leaf", href: "/masters/icd-codes",          label: "ICD / PCS Codes",       permKey: "masters/icd-codes" },
      { kind: "leaf", href: "/masters/dropdowns",          label: "Dropdowns",             permKey: "masters/dropdowns" },
    ],
  },
  {
    key: "settings", label: "Settings",
    iconBg: "bg-slate-100", iconColor: "text-slate-600",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    entries: [
      { kind: "leaf", href: "/settings/hospital",            label: "Hospital Info",        permKey: "settings/hospital" },
      { kind: "leaf", href: "/settings/bill-customization",  label: "Bill Customization",   permKey: "settings/bill-customization" },
      { kind: "leaf", href: "/settings/qr-token",            label: "QR Self-Registration", permKey: "settings/qr-token" },
      { kind: "leaf", href: "/settings/feedback",            label: "Patient Feedback",     permKey: "settings/feedback" },
      { kind: "leaf", href: "/settings/audit",               label: "Audit",                permKey: "settings/audit" },
    ],
  },
];

const COLLAPSE_KEY = "sidebarCollapsed";

interface SidebarProps {
  role: Role;
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ role, userName, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openGroup,   setOpenGroup]   = useState<string | null>(null);

  // ── Gmail-style collapse state ──
  // `collapsed` = pinned mini mode (persisted). `hovering` = temporary hover
  // expansion while in mini mode. The nav renders expanded whenever it is not
  // collapsed OR the user is hovering the mini rail.
  const [collapsed, setCollapsed] = useState(false);
  const [hovering,  setHovering]  = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The rail is effectively expanded (full labels) when not pinned-mini, or
  // when the user is hovering the mini rail. Mobile always renders expanded.
  const expanded = !collapsed || hovering;

  // Restore the pinned collapse preference on mount.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      // Dropping into mini mode should also clear the hover-expand so the rail
      // doesn't stay wide under the cursor that just clicked the logo.
      if (next) setHovering(false);
      return next;
    });
  }

  // Hover enter/leave with a small leave delay so brushing past the edge or
  // crossing a 1px gap doesn't cause the rail to flicker closed.
  function handleMouseEnter() {
    if (!collapsed) return;
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setHovering(true);
  }
  function handleMouseLeave() {
    if (!collapsed) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovering(false), 150);
  }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  useEffect(() => {
    let matched = false;
    for (const section of [...MAIN_SECTIONS, ...SECTIONS]) {
      const hasActive = section.entries.some((e) => {
        if (e.kind === "leaf") return pathname === e.href || (!e.exactMatch && pathname.startsWith(e.href + "/"));
        return e.items.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"));
      });
      if (hasActive) {
        setOpenSection(section.key);
        for (const e of section.entries) {
          if (e.kind === "group" && e.items.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"))) {
            setOpenGroup(e.label);
          }
        }
        matched = true;
        break;
      }
    }
    // If the current path belongs to a flat item (Dashboard, OP Token Queue),
    // no section matches — collapse everything.
    if (!matched) {
      setOpenSection(null);
      setOpenGroup(null);
    }
  }, [pathname]);

  function toggleSection(key: string) {
    setOpenSection((p) => (p === key ? null : key));
    setOpenGroup(null);
  }

  async function handleLogout() { await logout(); router.push("/"); }

  function sectionVisible(s: NavSection) {
    return s.entries.some((e) =>
      e.kind === "leaf" ? canView(role, e.permKey) : e.items.some((i) => canView(role, i.permKey))
    );
  }

  function visibleEntries(entries: NavEntry[]) {
    return entries.filter((e) =>
      e.kind === "leaf" ? canView(role, e.permKey) : e.items.some((i) => canView(role, i.permKey))
    );
  }

  function renderSection(section: NavSection) {
    const isOpen = openSection === section.key;
    const entries = visibleEntries(section.entries);
    const sectionActive = entries.some((e) =>
      e.kind === "leaf"
        ? pathname === e.href || (!e.exactMatch && pathname.startsWith(e.href + "/"))
        : e.items.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"))
    );

    // ── Mini (icon-only) rendering ──
    // Show just the colored icon square, centered, with a native tooltip. The
    // active section gets a highlight ring so the current location is visible.
    if (!expanded) {
      return (
        <button key={section.key} onClick={toggleCollapsed} title={section.label}
          aria-label={section.label}
          className={`w-full flex items-center justify-center py-2 rounded-xl transition-all
            ${sectionActive ? "bg-[#00059f]/8" : "hover:bg-slate-50"}`}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
            ${section.iconBg} ${section.iconColor}
            ${sectionActive ? "ring-2 ring-[#00059f] ring-offset-1" : ""}`}>
            {section.icon}
          </span>
        </button>
      );
    }

    return (
      <div key={section.key}>
        <button onClick={() => toggleSection(section.key)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all border-l-2
            ${sectionActive && !isOpen
              ? "text-[#00059f] bg-[#00059f]/8 border-[#00059f]"
              : isOpen
                ? "text-[#00059f] bg-slate-50 border-[#00059f]"
                : "text-slate-700 hover:bg-slate-50 border-transparent"
            }`}
          aria-expanded={isOpen}>
          {/* Colored icon square — always shows its color */}
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
            ${section.iconBg} ${section.iconColor}`}>
            {section.icon}
          </span>
          <span className="flex-1 text-left whitespace-nowrap">{section.label}</span>
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {isOpen && (
          <div className="ml-4 mt-0.5 pl-3 border-l-2 border-slate-100 space-y-0.5">
            {entries.map((entry) => {
              if (entry.kind === "leaf") {
                const active = pathname === entry.href ||
                  (!entry.exactMatch && pathname.startsWith(entry.href + "/"));
                return (
                  <Link key={entry.href} href={entry.href} onClick={onMobileClose}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all
                      ${active
                        ? "text-[#00059f] font-semibold bg-[#00059f]/10"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    aria-current={active ? "page" : undefined}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${active ? "bg-[#00059f]" : "bg-slate-300"}`} />
                    {entry.label}
                  </Link>
                );
              }

              const visibleSubs = entry.items.filter((s) => canView(role, s.permKey));
              if (!visibleSubs.length) return null;
              const grpOpen   = openGroup === entry.label;
              const grpActive = visibleSubs.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"));

              return (
                <div key={entry.label}>
                  <button onClick={() => setOpenGroup((p) => p === entry.label ? null : entry.label)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${grpActive ? "text-[#00059f]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${grpActive ? "bg-[#00059f]" : "bg-slate-300"}`} />
                    <span className="flex-1 text-left">{entry.label}</span>
                    <svg className={`w-3 h-3 transition-transform ${grpOpen ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {grpOpen && (
                    <div className="ml-3 pl-3 border-l border-slate-100 space-y-0.5 mt-0.5">
                      {visibleSubs.map((sub) => {
                        const active = pathname === sub.href || pathname.startsWith(sub.href + "/");
                        return (
                          <Link key={sub.href} href={sub.href} onClick={onMobileClose}
                            className={`block px-2 py-1.5 rounded-lg text-xs transition-all
                              ${active
                                ? "text-[#00059f] font-semibold bg-[#00059f]/10"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}
                            aria-current={active ? "page" : undefined}>
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Flat (non-accordion) item renderer — handles mini + expanded ──
  function renderFlat(item: FlatItem) {
    const active = pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

    if (!expanded) {
      return (
        <Link key={item.href} href={item.href} onClick={onMobileClose} title={item.label}
          aria-label={item.label} aria-current={active ? "page" : undefined}
          className={`w-full flex items-center justify-center py-2 rounded-xl transition-all
            ${active ? "bg-[#00059f]/8" : "hover:bg-slate-50"}`}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
            ${item.iconBg} ${item.iconColor}
            ${active ? "ring-2 ring-[#00059f] ring-offset-1" : ""}`}>
            {item.icon}
          </span>
        </Link>
      );
    }

    return (
      <Link key={item.href} href={item.href} onClick={onMobileClose}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
          ${active
            ? "bg-[#00059f]/8 text-[#00059f] border-l-2 border-[#00059f]"
            : "text-slate-700 hover:bg-slate-50 border-l-2 border-transparent"
          }`}
        aria-current={active ? "page" : undefined}>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
          ${item.iconBg} ${item.iconColor}`}>
          {item.icon}
        </span>
        <span className="whitespace-nowrap">{item.label}</span>
      </Link>
    );
  }

  const initials = userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
          onClick={onMobileClose} aria-hidden="true" />
      )}

      {/*
        The <aside> reserves layout width (w-20 when pinned-mini, w-64 otherwise)
        so the main content never shifts when the rail expands on hover. The inner
        panel floats as an overlay: when mini + hovering it grows to w-64 on top of
        the content (Gmail behavior). On mobile the rail is a full-width drawer and
        the mini concept does not apply.
      */}
      <aside className={`
        hidden lg:block relative flex-shrink-0 transition-[width] duration-300 ease-in-out
        ${collapsed ? "w-20" : "w-64"}
      `}>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`
            absolute top-0 left-0 h-full bg-white border-r border-slate-200 flex flex-col
            transition-[width] duration-300 ease-in-out
            ${expanded ? "w-64" : "w-20"}
            ${collapsed && hovering ? "z-50 shadow-xl" : "z-10"}
          `}>
          {renderPanel()}
        </div>
      </aside>

      {/* Mobile drawer — always full menu, slides in/out */}
      <aside className={`
        lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-40 flex flex-col
        shadow-xl transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {renderPanel(true)}
      </aside>
    </>
  );

  // ── Shared panel body ──
  // `forceMobile` renders the mobile drawer (always expanded, with a close
  // button instead of the collapse toggle).
  function renderPanel(forceMobile = false) {
    const showExpanded = forceMobile ? true : expanded;
    return (
      <>
        {/* ── Logo / collapse toggle ── */}
        <div className={`flex items-center border-b border-slate-100 flex-shrink-0
          ${showExpanded ? "gap-3 px-5 py-4" : "justify-center px-2 py-4"}`}>
          {/* The logo doubles as the expand/collapse toggle on desktop. */}
          <button
            type="button"
            onClick={forceMobile ? onMobileClose : toggleCollapsed}
            title={forceMobile ? "Close menu" : (collapsed ? "Expand sidebar" : "Collapse sidebar")}
            aria-label={forceMobile ? "Close menu" : "Toggle sidebar"}
            className="w-9 h-9 rounded-xl overflow-hidden bg-white border border-slate-100 flex-shrink-0
              hover:ring-2 hover:ring-[#00059f]/30 transition-shadow cursor-pointer">
            <Image
              src="/hos-logo.jpg"
              alt="Sen Hospital Logo"
              width={36}
              height={36}
              className="object-contain w-full h-full"
            />
          </button>
          {showExpanded && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-bold text-sm leading-tight whitespace-nowrap">Sen Hospital</p>
                <p className="text-slate-400 text-xs whitespace-nowrap">Hospital Management</p>
              </div>
              {forceMobile && (
                <button onClick={onMobileClose}
                  className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg
                    text-slate-400 hover:bg-slate-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5
          ${showExpanded ? "px-3" : "px-2"}`} aria-label="Main navigation">

          {showExpanded && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 pt-1 pb-2">
              Main Modules
            </p>
          )}

          {/* Flat items */}
          {FLAT_ITEMS.filter((f) => canView(role, f.permKey)).map((item) => renderFlat(item))}

          {/* Accordion sections that belong under Main Modules (e.g. Appointments) */}
          {MAIN_SECTIONS.filter(sectionVisible).map((section) => renderSection(section))}

          {showExpanded ? (
            <div className="pt-3 pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                Management
              </p>
            </div>
          ) : (
            <div className="my-2 mx-auto w-8 border-t border-slate-100" />
          )}

          {/* Accordion sections */}
          {SECTIONS.filter(sectionVisible).map((section) => renderSection(section))}
        </nav>

        {/* ── User footer ── */}
        <div className={`border-t border-slate-100 flex-shrink-0
          ${showExpanded ? "px-4 py-3" : "px-2 py-3"}`}>
          {showExpanded ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00059f] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 text-xs font-semibold truncate">{userName}</p>
                <p className="text-slate-400 text-xs truncate">{role}</p>
              </div>
              <button onClick={handleLogout} title="Logout"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#00059f] flex items-center justify-center flex-shrink-0"
                title={`${userName} (${role})`}>
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <button onClick={handleLogout} title="Logout" aria-label="Logout"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </>
    );
  }
}
