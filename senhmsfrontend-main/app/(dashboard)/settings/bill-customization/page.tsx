"use client";

import { useState, useEffect, useRef } from "react";
import { getSession } from "../../../_lib/auth";
import type {
  HospitalSettings, BillSettings, BillSection,
  WatermarkSettings, DocumentSettings,
} from "../../../_lib/types";
import PageHeader from "../../../_components/PageHeader";
import { FormField, Input, Select, Textarea } from "../../../_components/Modal";

function today() { return new Date().toISOString().slice(0, 10); }

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// Default settings used when backend returns null JSON fields
const DEFAULT_BILL_SETTINGS: BillSettings = {
  showLogo: true, showHospitalName: true, showAddress: true,
  showContactInfo: true, showRegistrationNos: true,
  headerSectionOrder: ["logo", "name", "address", "contact", "regno"],
  headerLayout: "logo-left", logoSize: "md",
  bodySections: [
    { id: "patient",   label: "Patient & Doctor Info", enabled: true },
    { id: "items",     label: "Services / Charges",    enabled: true },
    { id: "totals",    label: "Amount Summary",         enabled: true },
    { id: "insurance", label: "Insurance Details",      enabled: true },
    { id: "payment",   label: "Payment History",        enabled: true },
    { id: "signature", label: "Signature Block",        enabled: true },
  ],
  billLayout: "standard", paperSize: "A4",
  primaryColor: "#00059f", accentColor: "#0ea5e9", headerBgColor: "#f8fafc",
  showPatientDetails: true, showDoctorInfo: true, showItemizedList: true,
  showPaymentBreakdown: true, showTermsConditions: false, termsText: "",
  footerText: "", showSignature: true, signatureName: "", signatureDesignation: "",
  currencySymbol: "₹", dateFormat: "DD/MM/YYYY",
  showBarcode: false, showQRCode: false,
};

const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  tokenLayout: "standard", tokenShowQueueInfo: true, tokenShowDoctorPhoto: false,
  prescriptionShowLetterhead: true, prescriptionShowDoctorQualification: true,
  labReportShowNormalRange: true, labReportHighlightAbnormal: true,
  admissionShowConsent: true, dischargeShowMedications: true, dischargeShowFollowUp: true,
};

const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: false, type: "text", text: "ORIGINAL",
  opacity: 20, fontSize: 72, rotation: -30,
  color: "#94a3b8", position: "diagonal",
};

const DEFAULT_HOSPITAL: HospitalSettings = {
  id: "", hospitalName: "Hospital", address: "", city: "", state: "",
  pincode: "", country: "India", phone: "", email: "",
  billSettings: DEFAULT_BILL_SETTINGS,
  documentSettings: DEFAULT_DOCUMENT_SETTINGS,
  watermarkSettings: DEFAULT_WATERMARK_SETTINGS,
  updatedBy: "", updatedDate: "",
};

/** Map backend HospitalSettingsResponse → frontend HospitalSettings */
function fromBackend(r: Record<string, unknown>): HospitalSettings {
  let billSettings     = DEFAULT_BILL_SETTINGS;
  let documentSettings = DEFAULT_DOCUMENT_SETTINGS;
  let watermarkSettings= DEFAULT_WATERMARK_SETTINGS;
  try { if (r.billSettingsJson)     billSettings     = JSON.parse(r.billSettingsJson as string); } catch {}
  try { if (r.documentSettingsJson) documentSettings = JSON.parse(r.documentSettingsJson as string); } catch {}
  try { if (r.watermarkSettingsJson)watermarkSettings= JSON.parse(r.watermarkSettingsJson as string); } catch {}
  return {
    ...DEFAULT_HOSPITAL,
    hospitalName:          (r.hospitalName as string)          ?? "",
    hospitalNameSecondary: (r.hospitalNameSecondary as string)  ?? "",
    address:               (r.address as string)               ?? "",
    city:                  (r.city as string)                   ?? "",
    state:                 (r.state as string)                  ?? "",
    pincode:               (r.pinCode as string)                ?? "",
    phone:                 (r.phone as string)                  ?? "",
    alternatePhone:        (r.alternatePhone as string)         ?? "",
    email:                 (r.email as string)                  ?? "",
    website:               (r.website as string)                ?? "",
    gstNo:                 (r.gstNo as string)                  ?? "",
    registrationNo:        (r.regNo as string)                  ?? "",
    updatedBy:             (r.updatedBy as string)              ?? "",
    updatedDate:           (r.updatedAt as string)?.slice(0,10) ?? "",
    billSettings:     ensureDefaults(billSettings),
    documentSettings,
    watermarkSettings,
  };
}

type PreviewType = "bill" | "op-token" | "admission-form";

const PREVIEW_OPTIONS: { value: PreviewType; label: string }[] = [
  { value: "bill",           label: "Bill / Invoice" },
  { value: "op-token",       label: "OP Token" },
  { value: "admission-form", label: "Admission Form" },
];

const HEADER_META: Record<string, string> = {
  logo:    "Logo",
  name:    "Hospital Name",
  address: "Address",
  contact: "Contact Info",
  regno:   "Registration Nos",
};

// ─── ensure new fields exist when loading old saved settings ──────────────────
function ensureDefaults(bill: BillSettings): BillSettings {
  return {
    ...bill,
    headerSectionOrder: bill.headerSectionOrder?.length
      ? bill.headerSectionOrder
      : ["logo", "name", "address", "contact", "regno"],
    headerLayout: bill.headerLayout ?? "logo-left",
    logoSize:     bill.logoSize     ?? "md",
    bodySections: bill.bodySections?.length ? bill.bodySections : [
      { id: "patient",   label: "Patient & Doctor Info", enabled: true },
      { id: "items",     label: "Services / Charges",    enabled: true },
      { id: "totals",    label: "Amount Summary",         enabled: true },
      { id: "insurance", label: "Insurance Details",      enabled: true },
      { id: "payment",   label: "Payment History",        enabled: true },
      { id: "signature", label: "Signature Block",        enabled: true },
    ],
  };
}

// ─── Drag-reorderable list ────────────────────────────────────────────────────
function DragList<T extends { id: string; label?: string; enabled?: boolean }>({
  items,
  labelFn,
  onReorder,
  onToggle,
  renderBadge,
}: {
  items: T[];
  labelFn?: (item: T) => string;
  onReorder: (newItems: T[]) => void;
  onToggle?: (id: string, enabled: boolean) => void;
  renderBadge?: (item: T) => React.ReactNode;
}) {
  // Use refs so drag handlers always see the latest values (no stale closures)
  const dragIdx  = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function handleDragStart(idx: number) { dragIdx.current = idx; }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function handleDrop(toIdx: number) {
    const from = dragIdx.current;
    if (from === null || from === toIdx) { dragIdx.current = null; setOverIdx(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    dragIdx.current = null;
    setOverIdx(null);
  }

  function handleDragEnd() { dragIdx.current = null; setOverIdx(null); }

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const label = labelFn ? labelFn(item) : (item.label ?? item.id);
        const isFrom = dragIdx.current === idx;
        const isOver = overIdx === idx && !isFrom;
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-all cursor-grab",
              isFrom ? "opacity-30 border-dashed border-slate-300 bg-slate-50" : "bg-white border-slate-200 hover:border-slate-300",
              isOver  ? "border-indigo-400 bg-indigo-50 scale-[1.01]" : "",
            ].join(" ")}
          >
            {/* grip */}
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 12h16M4 16h16" />
            </svg>

            {/* toggle checkbox */}
            {onToggle && (
              <button
                type="button"
                onClick={() => onToggle(item.id, !(item.enabled ?? true))}
                className={[
                  "w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                  (item.enabled ?? true) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300",
                ].join(" ")}
              >
                {(item.enabled ?? true) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}

            <span className={[
              "flex-1 text-sm font-medium",
              (item.enabled ?? true) ? "text-slate-700" : "text-slate-400 line-through",
            ].join(" ")}>
              {label}
            </span>

            {renderBadge && renderBadge(item)}
            <span className="text-xs text-slate-400">#{idx + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Live Bill Preview ────────────────────────────────────────────────────────
function BillPreview({ settings }: { settings: HospitalSettings }) {
  const bill   = settings.billSettings;
  const wm     = settings.watermarkSettings;
  const primary   = bill.primaryColor   || "#00059f";
  const headerBg  = bill.headerBgColor  || "#f8fafc";
  const layout    = bill.headerLayout   || "logo-left";
  const logoSizePx = bill.logoSize === "lg" ? "64px" : bill.logoSize === "sm" ? "36px" : "48px";

  const logoEl = bill.showLogo ? (
    <div className="flex-shrink-0 rounded-lg flex items-center justify-center font-black text-white"
      style={{ background: primary, width: logoSizePx, height: logoSizePx, fontSize: "18px" }}>
      ✚
    </div>
  ) : null;

  const textEl = (
    <div className={layout === "logo-center" || layout === "logo-above" ? "text-center" : "flex-1"}>
      {bill.showHospitalName && (
        <div className="font-black text-sm uppercase tracking-wide" style={{ color: primary }}>
          {settings.hospitalName}
        </div>
      )}
      {settings.hospitalNameSecondary && bill.showHospitalName && (
        <div className="text-[9px] text-slate-500">{settings.hospitalNameSecondary}</div>
      )}
      {bill.showAddress && (
        <div className="text-[9px] text-slate-500 mt-0.5">{settings.address}, {settings.city}</div>
      )}
      {bill.showContactInfo && (
        <div className="text-[9px] text-slate-500">📞 {settings.phone}</div>
      )}
      {bill.showRegistrationNos && settings.gstNo && (
        <div className="text-[8px] text-slate-400">GST: {settings.gstNo}</div>
      )}
    </div>
  );

  function renderHeaderInner() {
    switch (layout) {
      case "logo-left":
        return <div className="flex items-center gap-3">{logoEl}{textEl}</div>;
      case "logo-right":
        return <div className="flex items-center gap-3">{textEl}{logoEl}</div>;
      case "logo-center":
        return (
          <div className="text-center space-y-1">
            {logoEl && <div className="flex justify-center">{logoEl}</div>}
            {textEl}
          </div>
        );
      case "logo-above":
        return (
          <div className="text-center space-y-1">
            {logoEl && <div className="flex justify-center mb-1">{logoEl}</div>}
            {textEl}
          </div>
        );
      case "text-only":
        return <div className="text-center">{textEl}</div>;
      default:
        return <div className="flex items-center gap-3">{logoEl}{textEl}</div>;
    }
  }

  return (
    <div className="relative bg-white border border-slate-200 rounded-lg shadow overflow-hidden select-none text-slate-800"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>

      {/* Watermark */}
      {wm.enabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
          {wm.type === "text" ? (
            <span style={{
              color: wm.color, opacity: wm.opacity / 100,
              fontSize: `${wm.fontSize * 0.22}px`,
              transform: `rotate(${wm.rotation}deg)`,
              fontWeight: 900, whiteSpace: "nowrap", letterSpacing: "4px",
            }}>
              {wm.text}
            </span>
          ) : wm.imageUrl ? (
            <img src={wm.imageUrl} alt="wm"
              style={{ opacity: wm.opacity / 100, transform: `rotate(${wm.rotation}deg)`, maxWidth: "50%" }} />
          ) : null}
        </div>
      )}

      {/* Header */}
      <div className="p-3 border-b-2 border-slate-800 flex items-start justify-between gap-2" style={{ background: headerBg }}>
        <div className="flex-1">{renderHeaderInner()}</div>
        <div className="text-right text-[9px] flex-shrink-0">
          <div className="text-[8px] font-bold uppercase text-slate-500 tracking-wide">Tax Invoice</div>
          <div className="font-mono font-black text-sm" style={{ color: primary }}>INV-2026-001</div>
          <div className="text-slate-500">21/08/2026</div>
          <div className="font-bold text-emerald-600 text-[10px] mt-0.5">PAID</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {bill.bodySections?.filter(s => s.enabled).map(sec => {
          switch (sec.id) {
            case "patient":
              return (
                <div key="patient" className="grid grid-cols-2 gap-1 border border-slate-200 rounded p-2 text-[9px]">
                  <div><div className="text-[7px] text-slate-400 uppercase font-bold">Patient</div>
                    <div className="font-semibold">Sample Patient</div><div className="text-slate-500">UH-00001 | 35y/M</div></div>
                  <div><div className="text-[7px] text-slate-400 uppercase font-bold">Doctor</div>
                    <div className="font-semibold">Dr. Sample</div><div className="text-slate-500">General Medicine</div></div>
                </div>
              );
            case "items":
              return (
                <div key="items" className="text-[8px]">
                  <div className="font-bold text-[7px] uppercase border-t border-b border-slate-300 py-0.5 px-1 bg-slate-50">Services / Charges</div>
                  <table className="w-full border-collapse mt-0.5">
                    <thead><tr className="bg-slate-100">{["#","Service","Qty","Price","Total"].map(h=><th key={h} className="px-1 py-0.5 text-left border border-slate-200">{h}</th>)}</tr></thead>
                    <tbody>
                      {[["1","Consultation","1","₹500","₹500"],["2","Lab Test","2","₹300","₹600"]].map((r,i)=>(
                        <tr key={i} className={i%2===1?"bg-slate-50":""}>{r.map((c,j)=><td key={j} className="px-1 py-0.5 border border-slate-200">{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case "totals":
              return (
                <div key="totals" className="flex justify-end">
                  <div className="w-28 text-[8px] space-y-0.5">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>₹1,100</span></div>
                    <div className="flex justify-between font-bold border-t border-slate-300 pt-0.5">
                      <span>Net Total</span><span style={{ color: primary }}>₹1,100</span>
                    </div>
                    <div className="flex justify-between text-emerald-600"><span>Paid</span><span>₹1,100</span></div>
                    <div className="flex justify-between"><span>Balance</span><span className="font-bold text-emerald-600">Nil</span></div>
                  </div>
                </div>
              );
            case "insurance":
              return (
                <div key="insurance" className="text-[8px] border border-slate-200 rounded p-1.5">
                  <div className="text-[7px] font-bold uppercase text-slate-500 mb-0.5">Insurance Details</div>
                  <span className="text-slate-600">Star Health — <b className="text-amber-600">Pending</b></span>
                </div>
              );
            case "payment":
              return (
                <div key="payment" className="text-[8px]">
                  <div className="font-bold text-[7px] uppercase border-t border-b border-slate-300 py-0.5 px-1 bg-slate-50">Payment History</div>
                  <table className="w-full border-collapse mt-0.5">
                    <thead><tr className="bg-slate-100">{["Date","Mode","Amount"].map(h=><th key={h} className="px-1 py-0.5 text-left border border-slate-200">{h}</th>)}</tr></thead>
                    <tbody><tr><td className="px-1 py-0.5 border border-slate-200">21/08/26</td><td className="px-1 py-0.5 border border-slate-200">Cash</td><td className="px-1 py-0.5 border border-slate-200">₹1,100</td></tr></tbody>
                  </table>
                </div>
              );
            case "signature":
              return bill.showSignature ? (
                <div key="signature" className="flex justify-between pt-1 mt-1 border-t border-slate-200 text-[8px] text-center">
                  {["Patient","Cashier"].map(l=>(
                    <div key={l}><div className="border-t border-slate-400 w-8 mx-auto mt-3 mb-0.5"/><div className="text-slate-500">{l}</div></div>
                  ))}
                  <div><div className="border-t border-slate-400 w-8 mx-auto mt-3 mb-0.5"/>
                    <div className="font-semibold text-slate-700">{bill.signatureName||"Dr. Admin"}</div></div>
                </div>
              ) : null;
            default: return null;
          }
        })}

        {bill.footerText && (
          <div className="text-center text-[8px] text-slate-400 border-t border-slate-200 pt-1">{bill.footerText}</div>
        )}
        {bill.showTermsConditions && bill.termsText && (
          <div className="text-[7px] text-slate-400 italic border-t border-slate-100 pt-1">{bill.termsText}</div>
        )}
      </div>
    </div>
  );
}

// ─── Live OP Token Preview ────────────────────────────────────────────────────
function TokenPreview({ settings }: { settings: HospitalSettings }) {
  const doc     = settings.documentSettings;
  const bill    = settings.billSettings;
  const primary = bill.primaryColor || "#00059f";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-w-[200px] mx-auto overflow-hidden text-[10px]">
      <div className="px-4 py-3 text-center border-b border-slate-100" style={{ background: bill.headerBgColor || "#f0f4ff" }}>
        <div className="font-black text-sm" style={{ color: primary }}>{settings.hospitalName}</div>
        <div className="text-slate-500 text-[9px]">{settings.city}</div>
      </div>
      <div className="px-4 py-3 text-center border-b border-slate-100">
        <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">OP Token</div>
        <div className="font-black leading-none" style={{ fontSize: "48px", color: primary }}>42</div>
        <div className="text-slate-500 text-[9px] mt-1">21 Aug 2026 · 10:30 AM</div>
      </div>
      <div className="px-4 py-2 space-y-1 border-b border-slate-100">
        {[["Patient","Sample Patient"],["UHID","UH-00001"],["Doctor","Dr. Sample"],["Dept","General Med"]].map(([l,v])=>(
          <div key={l} className="flex justify-between">
            <span className="text-slate-400">{l}</span>
            <span className="font-semibold text-slate-700">{v}</span>
          </div>
        ))}
      </div>
      {doc.tokenShowQueueInfo && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-center">
          <span className="text-slate-500">Waiting: </span>
          <strong style={{ color: primary }}>3</strong>
          <span className="text-slate-500"> ahead of you</span>
        </div>
      )}
      <div className="px-4 py-2 text-center">
        <span className="text-[8px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {doc.tokenLayout} layout
        </span>
      </div>
    </div>
  );
}

// ─── Live Admission Preview ───────────────────────────────────────────────────
function AdmissionPreview({ settings }: { settings: HospitalSettings }) {
  const doc     = settings.documentSettings;
  const primary = settings.billSettings.primaryColor || "#00059f";
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow text-[10px] p-3 space-y-2">
      <div className="text-center border-b border-slate-200 pb-2">
        <div className="font-black" style={{ color: primary }}>{settings.hospitalName}</div>
        <div className="font-bold text-sm text-slate-700 mt-1">PATIENT ADMISSION FORM</div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {["Patient Name","UHID","Age / Gender","DOB","Phone","Address","Doctor","Department","Ward / Bed","Admitted Date"].map(l=>(
          <div key={l} className="border-b border-dotted border-slate-200 pb-0.5">
            <div className="text-[8px] text-slate-400 uppercase font-bold">{l}</div>
            <div className="h-3 bg-slate-50 rounded mt-0.5"/>
          </div>
        ))}
      </div>
      {doc.admissionShowConsent && (
        <div className="border border-slate-200 rounded p-1.5 bg-slate-50">
          <div className="text-[8px] font-bold uppercase text-slate-500 mb-1">Consent Declaration</div>
          <div className="text-[8px] text-slate-400 italic">I hereby consent to all medical procedures…</div>
          <div className="flex gap-8 mt-2">
            {["Patient / Guardian","Witness"].map(l=>(
              <div key={l} className="text-[8px]">
                <div className="border-t border-slate-400 w-16 mt-4 mb-0.5"/>
                <span className="text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BillCustomizationPage() {
  const session  = getSession();
  const userName = session?.name ?? "System";

  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [activeTab, setActiveTab] = useState<"bill" | "document" | "watermark">("bill");
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [previewType, setPreviewType] = useState<PreviewType>("bill");

  useEffect(() => {
    apiFetch("/api/settings/hospital").then(({ ok, data }) => {
      if (ok && data) {
        setSettings(fromBackend(data as Record<string, unknown>));
      } else {
        // Backend has no record yet — use defaults so the page is still usable
        setSettings({ ...DEFAULT_HOSPITAL, billSettings: ensureDefaults(DEFAULT_BILL_SETTINGS) });
      }
    });
  }, []);

  // ── Generic setter helpers ──
  function setBillField(field: keyof BillSettings, value: unknown) {
    setSettings(prev => prev ? {
      ...prev, billSettings: { ...prev.billSettings, [field]: value },
    } : prev);
    setSaved(false);
  }

  function setDocField(field: keyof DocumentSettings, value: unknown) {
    setSettings(prev => prev ? {
      ...prev, documentSettings: { ...prev.documentSettings, [field]: value },
    } : prev);
    setSaved(false);
  }

  function setWmField(field: keyof WatermarkSettings, value: unknown) {
    setSettings(prev => prev ? {
      ...prev, watermarkSettings: { ...prev.watermarkSettings, [field]: value },
    } : prev);
    setSaved(false);
  }

  // ── Drag reorder (uses functional updater — no stale closures) ──
  function reorderHeader(newOrder: { id: string }[]) {
    setSettings(prev => prev ? {
      ...prev,
      billSettings: {
        ...prev.billSettings,
        headerSectionOrder: newOrder.map(x => x.id),
      },
    } : prev);
    setSaved(false);
  }

  function reorderBody(newSecs: BillSection[]) {
    setSettings(prev => prev ? {
      ...prev,
      billSettings: { ...prev.billSettings, bodySections: newSecs },
    } : prev);
    setSaved(false);
  }

  function toggleBodySection(id: string, enabled: boolean) {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        billSettings: {
          ...prev.billSettings,
          bodySections: prev.billSettings.bodySections.map(s =>
            s.id === id ? { ...s, enabled } : s
          ),
        },
      };
    });
    setSaved(false);
  }

  function toggleHeaderSection(field: keyof BillSettings, value: boolean) {
    setBillField(field, value);
  }

  function handleWatermarkImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setWmField("imageUrl", ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    const body = {
      hospitalName:          settings.hospitalName,
      hospitalNameSecondary: settings.hospitalNameSecondary ?? null,
      address:               settings.address,
      city:                  settings.city,
      state:                 settings.state,
      pinCode:               settings.pincode,
      phone:                 settings.phone,
      alternatePhone:        settings.alternatePhone ?? null,
      email:                 settings.email,
      website:               settings.website ?? null,
      gstNo:                 settings.gstNo ?? null,
      regNo:                 settings.registrationNo ?? null,
      billSettingsJson:      JSON.stringify(settings.billSettings),
      documentSettingsJson:  JSON.stringify(settings.documentSettings),
      watermarkSettingsJson: JSON.stringify(settings.watermarkSettings),
    };
    const { ok, data, error } = await apiFetch("/api/settings/hospital", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (ok && data) {
      setSettings(fromBackend(data as Record<string, unknown>));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert(error ?? "Failed to save settings");
    }
  }

  if (!settings) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 bg-slate-200 rounded w-64" />
          <div className="h-9 bg-slate-200 rounded w-24" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 bg-slate-200 rounded-lg w-32" />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded w-24" />
                  <div className="h-9 bg-slate-100 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-96" />
        </div>
      </div>
    );
  }

  const bill = settings.billSettings;
  const doc  = settings.documentSettings;
  const wm   = settings.watermarkSettings;

  // Build header items for DragList (with visibility state)
  const TOGGLE_MAP: Record<string, keyof BillSettings> = {
    logo: "showLogo", name: "showHospitalName", address: "showAddress",
    contact: "showContactInfo", regno: "showRegistrationNos",
  };
  const headerItems = bill.headerSectionOrder.map(id => ({
    id,
    label: HEADER_META[id] ?? id,
    enabled: id in TOGGLE_MAP ? !!(bill as unknown as Record<string, unknown>)[TOGGLE_MAP[id]] : true,
  }));

  const TABS = [
    { id: "bill",      label: "Bill / Invoice" },
    { id: "document",  label: "Documents" },
    { id: "watermark", label: "Watermark" },
  ] as const;

  // Logo layout options
  const LOGO_LAYOUTS: { value: BillSettings["headerLayout"]; label: string; icon: string }[] = [
    { value: "logo-left",   label: "Left",    icon: "◀ ▬▬" },
    { value: "logo-center", label: "Center",  icon: "▬◀▬" },
    { value: "logo-right",  label: "Right",   icon: "▬▬ ▶" },
    { value: "logo-above",  label: "Above",   icon: "▲\n▬▬" },
    { value: "text-only",   label: "No Logo", icon: "▬▬▬" },
  ];

  return (
    <div>
      <PageHeader
        title="Bill & Document Customization"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/hospital" },
          { label: "Bill Customization" },
        ]}
      />

      {saved && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Saved — changes will reflect on all new prints.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">

        {/* ── Left: Controls ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={[
                  "flex-1 px-3 py-3 text-sm font-semibold transition-colors border-b-2",
                  activeTab === t.id
                    ? "text-indigo-700 border-indigo-600"
                    : "text-slate-500 border-transparent hover:text-slate-700",
                ].join(" ")}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-7 max-h-[calc(100vh-260px)]">

            {/* ══════ BILL TAB ══════ */}
            {activeTab === "bill" && (
              <>
                {/* Logo position */}
                <Sect title="Logo & Header Layout">
                  <p className="text-xs text-slate-400 mb-3">Choose how the logo sits relative to the hospital name and address.</p>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {LOGO_LAYOUTS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBillField("headerLayout", opt.value)}
                        className={[
                          "flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition-all",
                          bill.headerLayout === opt.value
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                            : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <span className="text-base font-mono leading-tight whitespace-pre-line text-center">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {bill.headerLayout !== "text-only" && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Logo Size</p>
                      <div className="flex gap-2">
                        {(["sm","md","lg"] as const).map(sz => (
                          <button key={sz} type="button"
                            onClick={() => setBillField("logoSize", sz)}
                            className={[
                              "flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                              bill.logoSize === sz
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400",
                            ].join(" ")}>
                            {sz === "sm" ? "Small" : sz === "md" ? "Medium" : "Large"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Sect>

                {/* Header section drag */}
                <Sect title="Header Section Order"
                  hint="Drag to reorder. Checkbox to show/hide each part.">
                  <DragList
                    items={headerItems}
                    onReorder={reorderHeader}
                    onToggle={(id, enabled) => {
                      const field = TOGGLE_MAP[id];
                      if (field) toggleHeaderSection(field, enabled);
                    }}
                  />
                </Sect>

                {/* Body section drag */}
                <Sect title="Body Section Order"
                  hint="Drag to reorder. Uncheck to hide a section from prints.">
                  <DragList
                    items={bill.bodySections}
                    onReorder={newSecs => reorderBody(newSecs as BillSection[])}
                    onToggle={toggleBodySection}
                  />
                </Sect>

                {/* Layout */}
                <Sect title="Layout & Format">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Bill Layout">
                      <Select value={bill.billLayout} onChange={e => setBillField("billLayout", e.target.value)}>
                        <option value="compact">Compact</option>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed</option>
                      </Select>
                    </FormField>
                    <FormField label="Paper Size">
                      <Select value={bill.paperSize} onChange={e => setBillField("paperSize", e.target.value)}>
                        <option value="A4">A4</option>
                        <option value="A5">A5</option>
                        <option value="thermal-80mm">Thermal 80mm</option>
                      </Select>
                    </FormField>
                    <FormField label="Date Format">
                      <Select value={bill.dateFormat} onChange={e => setBillField("dateFormat", e.target.value)}>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </Select>
                    </FormField>
                  </div>
                </Sect>

                {/* Colors */}
                <Sect title="Colors & Branding">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Primary Color",    field: "primaryColor"  as const },
                      { label: "Accent Color",      field: "accentColor"   as const },
                      { label: "Header Background", field: "headerBgColor" as const },
                    ].map(({ label, field }) => (
                      <FormField key={field} label={label}>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={(bill as unknown as Record<string,string>)[field] || "#000000"}
                            onChange={e => setBillField(field, e.target.value)}
                            className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5" />
                          <Input value={(bill as unknown as Record<string,string>)[field] || ""}
                            onChange={e => setBillField(field, e.target.value)}
                            placeholder="#000000" />
                        </div>
                      </FormField>
                    ))}
                  </div>
                </Sect>

                {/* Footer */}
                <Sect title="Footer & Signature">
                  <div className="space-y-4">
                    <FormField label="Footer Text">
                      <Input value={bill.footerText || ""}
                        onChange={e => setBillField("footerText", e.target.value)}
                        placeholder="Thank you for choosing us!" />
                    </FormField>
                    <ChkRow label="Show Terms & Conditions"
                      checked={bill.showTermsConditions}
                      onChange={v => setBillField("showTermsConditions", v)} />
                    {bill.showTermsConditions && (
                      <FormField label="Terms Text">
                        <Textarea value={bill.termsText || ""}
                          onChange={e => setBillField("termsText", e.target.value)}
                          placeholder="Enter terms and conditions" rows={3} />
                      </FormField>
                    )}
                    <ChkRow label="Show Signature Block"
                      checked={bill.showSignature}
                      onChange={v => setBillField("showSignature", v)} />
                    {bill.showSignature && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Signatory Name">
                          <Input value={bill.signatureName || ""}
                            onChange={e => setBillField("signatureName", e.target.value)} />
                        </FormField>
                        <FormField label="Designation">
                          <Input value={bill.signatureDesignation || ""}
                            onChange={e => setBillField("signatureDesignation", e.target.value)} />
                        </FormField>
                      </div>
                    )}
                  </div>
                </Sect>

                <Sect title="Advanced">
                  <div className="space-y-2">
                    <ChkRow label="Show Barcode" checked={bill.showBarcode} onChange={v => setBillField("showBarcode", v)} />
                    <ChkRow label="Show QR Code (UPI)" checked={bill.showQRCode} onChange={v => setBillField("showQRCode", v)} />
                  </div>
                </Sect>
              </>
            )}

            {/* ══════ DOCUMENT TAB ══════ */}
            {activeTab === "document" && (
              <>
                <Sect title="OP Token">
                  <div className="space-y-4">
                    <FormField label="Token Layout">
                      <Select value={doc.tokenLayout} onChange={e => setDocField("tokenLayout", e.target.value)}>
                        <option value="compact">Compact</option>
                        <option value="standard">Standard</option>
                      </Select>
                    </FormField>
                    <ChkRow label="Show Queue Information" checked={doc.tokenShowQueueInfo} onChange={v => setDocField("tokenShowQueueInfo", v)} />
                    <ChkRow label="Show Doctor Photo" checked={doc.tokenShowDoctorPhoto} onChange={v => setDocField("tokenShowDoctorPhoto", v)} />
                  </div>
                </Sect>
                <Sect title="Prescriptions">
                  <div className="space-y-2">
                    <ChkRow label="Show Hospital Letterhead" checked={doc.prescriptionShowLetterhead} onChange={v => setDocField("prescriptionShowLetterhead", v)} />
                    <ChkRow label="Show Doctor Qualifications" checked={doc.prescriptionShowDoctorQualification} onChange={v => setDocField("prescriptionShowDoctorQualification", v)} />
                  </div>
                </Sect>
                <Sect title="Lab Reports">
                  <div className="space-y-2">
                    <ChkRow label="Show Normal Range" checked={doc.labReportShowNormalRange} onChange={v => setDocField("labReportShowNormalRange", v)} />
                    <ChkRow label="Highlight Abnormal Values" checked={doc.labReportHighlightAbnormal} onChange={v => setDocField("labReportHighlightAbnormal", v)} />
                  </div>
                </Sect>
                <Sect title="Admission & Discharge">
                  <div className="space-y-2">
                    <ChkRow label="Show Consent Form in Admission" checked={doc.admissionShowConsent} onChange={v => setDocField("admissionShowConsent", v)} />
                    <ChkRow label="Show Medications in Discharge" checked={doc.dischargeShowMedications} onChange={v => setDocField("dischargeShowMedications", v)} />
                    <ChkRow label="Show Follow-up Instructions" checked={doc.dischargeShowFollowUp} onChange={v => setDocField("dischargeShowFollowUp", v)} />
                  </div>
                </Sect>
              </>
            )}

            {/* ══════ WATERMARK TAB ══════ */}
            {activeTab === "watermark" && (
              <>
                <Sect title="Watermark">
                  <ChkRow label="Enable Watermark on Documents" checked={wm.enabled} onChange={v => setWmField("enabled", v)} />
                </Sect>

                {wm.enabled && (
                  <>
                    <Sect title="Type">
                      <div className="flex gap-2">
                        {(["text","image"] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => setWmField("type", t)}
                            className={[
                              "flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors",
                              wm.type === t
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400",
                            ].join(" ")}>
                            {t === "text" ? "Text" : "Image"}
                          </button>
                        ))}
                      </div>
                    </Sect>

                    {wm.type === "text" ? (
                      <Sect title="Text Settings">
                        <div className="space-y-4">
                          <FormField label="Watermark Text">
                            <Input value={wm.text} onChange={e => setWmField("text", e.target.value)}
                              placeholder="ORIGINAL, COPY, CONFIDENTIAL" />
                          </FormField>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="Color">
                              <div className="flex gap-2 items-center">
                                <input type="color" value={wm.color} onChange={e => setWmField("color", e.target.value)}
                                  className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5" />
                                <Input value={wm.color} onChange={e => setWmField("color", e.target.value)} />
                              </div>
                            </FormField>
                            <FormField label={`Font Size: ${wm.fontSize}px`}>
                              <input type="range" min={24} max={120} value={wm.fontSize}
                                onChange={e => setWmField("fontSize", parseInt(e.target.value))}
                                className="w-full mt-2" />
                            </FormField>
                          </div>
                        </div>
                      </Sect>
                    ) : (
                      <Sect title="Image Settings">
                        <div className="flex gap-4 items-start">
                          <div className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {wm.imageUrl
                              ? <img src={wm.imageUrl} alt="wm" className="w-full h-full object-contain p-1" />
                              : <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">PNG with transparent background works best.</p>
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors">
                              Choose Image
                              <input type="file" accept="image/*" className="hidden" onChange={handleWatermarkImage} />
                            </label>
                            {wm.imageUrl && (
                              <button onClick={() => setWmField("imageUrl", undefined)}
                                className="block text-xs text-red-500 hover:text-red-700">Remove</button>
                            )}
                          </div>
                        </div>
                      </Sect>
                    )}

                    <Sect title="Position & Visibility">
                      <div className="space-y-4">
                        <FormField label={`Opacity: ${wm.opacity}%`}>
                          <input type="range" min={5} max={50} value={wm.opacity}
                            onChange={e => setWmField("opacity", parseInt(e.target.value))} className="w-full" />
                        </FormField>
                        <FormField label={`Rotation: ${wm.rotation}°`}>
                          <input type="range" min={-45} max={45} value={wm.rotation}
                            onChange={e => setWmField("rotation", parseInt(e.target.value))} className="w-full" />
                        </FormField>
                        <FormField label="Position">
                          <Select value={wm.position} onChange={e => setWmField("position", e.target.value)}>
                            <option value="diagonal">Diagonal (center)</option>
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                          </Select>
                        </FormField>
                      </div>
                    </Sect>
                  </>
                )}
              </>
            )}
          </div>

          {/* Save bar */}
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <p className="text-xs text-slate-400">Preview updates live. Save to apply to all prints.</p>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {PREVIEW_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPreviewType(opt.value)}
                className={[
                  "flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors",
                  previewType === opt.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 shadow-sm sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Live Preview</span>
              <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                Real-time
              </span>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {previewType === "bill"           && <BillPreview      settings={settings} />}
              {previewType === "op-token"       && <TokenPreview     settings={settings} />}
              {previewType === "admission-form" && <AdmissionPreview settings={settings} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Sect({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ChkRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div onClick={() => onChange(!checked)}
        className={[
          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
          checked ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300 group-hover:border-indigo-400",
        ].join(" ")}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
