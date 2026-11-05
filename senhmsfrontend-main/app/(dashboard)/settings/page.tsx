"use client";

import Link from "next/link";
import PageHeader from "../../_components/PageHeader";
import { getSession, canView } from "../../_lib/auth";

const SETTING_CARDS = [
  {
    href: "/settings/hospital",
    title: "Hospital Information",
    description: "Manage hospital name, address, contact details, and registration numbers",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    href: "/settings/bill-customization",
    title: "Bill & Document Customization",
    description: "Customize bill layout, colors, watermark, and document templates with live preview",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
];

// Managing Director-only cards, appended when the current user has access.
const AUDIT_CARD = {
  href: "/settings/audit",
  title: "Audit Logs",
  description: "Review system activity by date range and user. Restricted to the Managing Director.",
  icon: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  iconBg: "bg-amber-100",
  iconColor: "text-amber-600",
  permKey: "settings/audit",
};

export default function SettingsPage() {
  const session = getSession();
  const role = session?.role ?? "Admin";

  const cards = [...SETTING_CARDS];
  if (canView(role, AUDIT_CARD.permKey)) {
    cards.push(AUDIT_CARD);
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block bg-white rounded-xl border border-slate-200 shadow-sm
              hover:shadow-md hover:border-[#00059f]/20 transition-all p-6 group">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0
                group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-[#00059f] transition-colors">
                  {card.title}
                </h2>
                <p className="text-sm text-slate-600">
                  {card.description}
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-[#00059f] group-hover:translate-x-1 transition-all"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-2">
              About Settings
            </h3>
            <p className="text-sm text-blue-800">
              Configure hospital details and customize how your bills, tokens, and documents appear. 
              Changes apply immediately to all new documents. Existing documents remain unchanged.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              <strong>Tip:</strong> Use the live preview feature in Bill Customization to see your changes before saving.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
