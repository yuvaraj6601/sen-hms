import React from "react";

type BadgeVariant =
  | "green" | "red" | "yellow" | "blue" | "purple"
  | "pink" | "gray" | "orange" | "sky" | "indigo";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  "bg-emerald-100 text-emerald-700",
  red:    "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-violet-100 text-violet-700",
  pink:   "bg-pink-100 text-pink-700",
  gray:   "bg-slate-100 text-slate-600",
  orange: "bg-orange-100 text-orange-700",
  sky:    "bg-sky-100 text-sky-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

// Auto-map common status strings → variant
export function statusVariant(status: string): BadgeVariant {
  if (!status) return "gray";
  const s = status.toLowerCase();
  if (["active", "paid", "completed", "discharged (normal)", "approved", "available", "stable"].some(v => s.includes(v))) return "green";
  if (["inactive", "cancelled", "expired", "rejected", "critical"].some(v => s.includes(v))) return "red";
  if (["pending", "waiting", "under review", "reserved", "observation"].some(v => s.includes(v))) return "yellow";
  if (["partial", "in progress", "in consultation", "under observation"].some(v => s.includes(v))) return "blue";
  if (["admitted", "scheduled", "submitted"].some(v => s.includes(v))) return "sky";
  if (["lama", "referred", "maintenance"].some(v => s.includes(v))) return "orange";
  if (["stat"].some(v => s.includes(v))) return "red";
  if (["urgent"].some(v => s.includes(v))) return "orange";
  if (["routine"].some(v => s.includes(v))) return "gray";
  if (["new"].some(v => s.includes(v))) return "purple";
  if (["review", "follow-up"].some(v => s.includes(v))) return "indigo";
  return "gray";
}

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export default function Badge({ label, variant, dot = false, className = "" }: BadgeProps) {
  const v = variant ?? statusVariant(label ?? "");
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap
        ${VARIANT_CLASSES[v]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          v === "green" ? "bg-emerald-500" :
          v === "red" ? "bg-red-500" :
          v === "yellow" ? "bg-amber-500" :
          v === "blue" ? "bg-blue-500" :
          v === "sky" ? "bg-sky-500" :
          v === "orange" ? "bg-orange-500" : "bg-slate-400"
        }`} />
      )}
      {label}
    </span>
  );
}
