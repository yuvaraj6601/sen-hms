"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "../../../_components/Modal";

// ─── Backend shapes ───────────────────────────────────────────────────────────
interface TariffResponse {
  id: number | null;
  insuranceCompanyId: number;
  serviceCode: string;
  serviceName: string;
  modalityName: string | null;
  sourceType: "BILLING" | "LAB" | "ROOM" | "CUSTOM";
  category: string | null;
  insurerCode: string | null;
  insurerDescription: string | null;
  hospitalRate: number | null;
  tariffPrice: number | null;
  excluded: boolean;
  notes: string | null;
}

// ─── Editable row ─────────────────────────────────────────────────────────────
interface TariffRow {
  serviceCode: string;
  serviceName: string;
  modalityName: string;
  sourceType: "BILLING" | "LAB" | "ROOM" | "CUSTOM";
  category: string;
  insurerCode: string;
  insurerDescription: string;
  hospitalRate: number | null;
  /** tariff price as a string so the input can be edited freely; "" = unpriced */
  tariffPrice: string;
  excluded: boolean;
  hasTariff: boolean;   // a saved tariff row exists (persisted)
  dirty: boolean;
}

function inr(n: number | null) {
  return n == null ? "—" : "₹" + n.toLocaleString("en-IN");
}

/** Selectable categories for grouping the tariff view */
const CATEGORY_OPTIONS = [
  "Wards & Beds", "Lab", "Consultation", "OT", "Procedures", "Scan", "ICU", "Others",
];

/** Preferred display order for category groups; anything else sorts after, alphabetically */
const CATEGORY_ORDER = [
  "Wards & Beds", "ICU", "Consultation", "OT", "Procedures", "Scan", "Lab", "Others",
];

interface Props {
  companyId: number;
  companyName: string;
  /** Current contract dates from the company record (ISO yyyy-MM-dd or null) */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  /** Called after contract dates are saved so the parent can refresh */
  onDatesSaved?: (from: string | null, to: string | null) => void;
}

export default function TariffManager({
  companyId, companyName, effectiveFrom, effectiveTo,
  open, onClose, canEdit, onDatesSaved,
}: Props) {
  const [rows,     setRows]     = useState<TariffRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [search,   setSearch]   = useState("");
  const [showOnly, setShowOnly] = useState<"all" | "priced" | "unpriced">("all");

  // Contract dates (local editable copy)
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate,   setToDate]   = useState<string>("");
  const [savingDates, setSavingDates] = useState(false);

  // Custom row form
  const [showCustom, setShowCustom] = useState(false);
  const [custName,  setCustName]  = useState("");
  const [custPrice, setCustPrice] = useState("");
  const [custNote,  setCustNote]  = useState("");
  const [custInsCode, setCustInsCode] = useState("");
  const [custCategory, setCustCategory] = useState(CATEGORY_OPTIONS[0]);

  // Change-rate-by-insurer-code
  const [showRateByCode, setShowRateByCode] = useState(false);
  const [rateCode,  setRateCode]  = useState("");
  const [ratePrice, setRatePrice] = useState("");
  const [rateBusy,  setRateBusy]  = useState(false);

  // ── Load merged catalogue ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setFromDate(effectiveFrom ?? "");
    setToDate(effectiveTo ?? "");
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res  = await fetch(`/api/masters/insurance-tariffs?insuranceCompanyId=${companyId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to load tariff catalogue");
        }
        const list: TariffResponse[] = Array.isArray(json.data) ? json.data : [];
        const merged: TariffRow[] = list.map(t => ({
          serviceCode:  t.serviceCode,
          serviceName:  t.serviceName,
          modalityName: t.modalityName ?? "—",
          sourceType:   t.sourceType,
          category:     t.category ?? t.modalityName ?? "Others",
          insurerCode:        t.insurerCode ?? "",
          insurerDescription: t.insurerDescription ?? "",
          hospitalRate: t.hospitalRate,
          tariffPrice:  t.tariffPrice != null ? String(t.tariffPrice)
                        : (t.hospitalRate != null ? String(t.hospitalRate) : ""),
          excluded:     t.excluded,
          hasTariff:    t.id != null,
          dirty:        false,
        }));
        if (!cancelled) setRows(merged);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tariff data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, companyId, effectiveFrom, effectiveTo]);

  // ── Filtered + grouped view ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchesSearch = !q ||
        r.serviceName.toLowerCase().includes(q) ||
        r.serviceCode.toLowerCase().includes(q) ||
        r.modalityName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.insurerCode.toLowerCase().includes(q);
      const matchesFilter =
        showOnly === "all" ||
        (showOnly === "priced"   && r.hasTariff) ||
        (showOnly === "unpriced" && !r.hasTariff);
      return matchesSearch && matchesFilter;
    });
  }, [rows, search, showOnly]);

  /** Ordered list of category groups present in the filtered rows */
  const groupedCategories = useMemo(() => {
    const g = new Map<string, TariffRow[]>();
    filtered.forEach(r => {
      const key = r.category || "Others";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(r);
    });
    const keys = Array.from(g.keys()).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys.map(k => [k, g.get(k)!] as [string, TariffRow[]]);
  }, [filtered]);

  const dirtyCount  = rows.filter(r => r.dirty).length;
  const pricedCount = rows.filter(r => r.hasTariff).length;

  function updateRow(serviceCode: string, patch: Partial<TariffRow>) {
    setRows(prev => prev.map(r =>
      r.serviceCode === serviceCode ? { ...r, ...patch, dirty: true } : r));
    setSuccess("");
  }

  // ── Save contract dates on the insurance company ────────────────────────────
  async function handleSaveDates() {
    setSavingDates(true);
    setError("");
    setSuccess("");
    try {
      // fetch current company so we don't wipe other fields on PUT
      const cRes  = await fetch(`/api/masters/insurance-companies/${companyId}`);
      const cJson = await cRes.json();
      if (!cRes.ok || !cJson.success) throw new Error(cJson.error ?? "Failed to load company");
      const c = cJson.data;

      const body = {
        name:          c.name,
        tpaName:       c.tpaName,
        contactPerson: c.contactPerson,
        phone:         c.phone,
        email:         c.email || undefined,
        address:       c.address || undefined,
        status:        c.status,
        tariffEffectiveFrom: fromDate || null,
        tariffEffectiveTo:   toDate   || null,
      };
      const res  = await fetch(`/api/masters/insurance-companies/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to save contract dates");
      setSuccess("Contract dates saved");
      onDatesSaved?.(fromDate || null, toDate || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save dates");
    } finally {
      setSavingDates(false);
    }
  }

  // ── Add a custom insurer-only tariff row ────────────────────────────────────
  async function handleAddCustom() {
    const price = Number(custPrice);
    if (!custName.trim()) { setError("Custom tariff needs a name"); return; }
    if (Number.isNaN(price) || price < 0) { setError("Enter a valid custom price"); return; }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const code = "CUSTOM-" + Date.now().toString().slice(-8);
      const body = {
        insuranceCompanyId: companyId,
        serviceCode:  code,
        sourceType:   "CUSTOM",
        serviceName:  custName.trim(),
        modalityName: "Custom",
        category:     custCategory,
        insurerCode:        custInsCode.trim() || undefined,
        insurerDescription: custName.trim(),
        tariffPrice:  price,
        excluded:     false,
        notes:        custNote.trim() || undefined,
      };
      const res  = await fetch(`/api/masters/insurance-tariffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to add custom tariff");

      const t: TariffResponse = json.data;
      setRows(prev => [...prev, {
        serviceCode:  t.serviceCode,
        serviceName:  t.serviceName,
        modalityName: t.modalityName ?? "Custom",
        sourceType:   "CUSTOM",
        category:     t.category ?? custCategory,
        insurerCode:        t.insurerCode ?? "",
        insurerDescription: t.insurerDescription ?? "",
        hospitalRate: null,
        tariffPrice:  String(t.tariffPrice ?? price),
        excluded:     t.excluded,
        hasTariff:    true,
        dirty:        false,
      }]);
      setCustName(""); setCustPrice(""); setCustNote(""); setCustInsCode("");
      setShowCustom(false);
      setSuccess("Custom tariff added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add custom tariff");
    } finally {
      setSaving(false);
    }
  }

  // ── Save dirty rows via bulk upsert ─────────────────────────────────────────
  async function handleSave() {
    const dirtyRows = rows.filter(r => r.dirty);
    if (dirtyRows.length === 0) return;

    for (const r of dirtyRows) {
      const price = Number(r.tariffPrice);
      if (Number.isNaN(price) || price < 0) {
        setError(`Invalid price for "${r.serviceName}"`);
        return;
      }
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        insuranceCompanyId: companyId,
        items: dirtyRows.map(r => ({
          serviceCode: r.serviceCode,
          sourceType:  r.sourceType,
          serviceName: r.serviceName,
          modalityName: r.modalityName,
          category:    r.category || undefined,
          insurerCode:        r.insurerCode || undefined,
          insurerDescription: r.insurerDescription || undefined,
          tariffPrice: r.excluded ? 0 : Number(r.tariffPrice),
          excluded:    r.excluded,
        })),
      };
      const res  = await fetch(`/api/masters/insurance-tariffs/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to save tariff rates");

      setRows(prev => prev.map(r => r.dirty ? { ...r, dirty: false, hasTariff: true } : r));
      setSuccess(`Saved ${dirtyRows.length} tariff rate${dirtyRows.length === 1 ? "" : "s"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Change the tariff price for every service sharing one insurer code.
   * One entry updates all mapped services (e.g. code001 → CBC + HBC).
   */
  async function handleRateByCode() {
    const code  = rateCode.trim();
    const price = Number(ratePrice);
    if (!code) { setError("Enter the insurer code to update"); return; }
    if (Number.isNaN(price) || price < 0) { setError("Enter a valid new price"); return; }

    // How many rows share this code (case-insensitive) — for the confirmation message
    const affected = rows.filter(r => r.insurerCode.trim().toLowerCase() === code.toLowerCase());
    if (affected.length === 0) {
      setError(`No services are mapped to insurer code "${code}". Assign the code to services first, then save.`);
      return;
    }

    setRateBusy(true);
    setError("");
    setSuccess("");
    try {
      const res  = await fetch(`/api/masters/insurance-tariffs/rate-by-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insuranceCompanyId: companyId, insurerCode: code, tariffPrice: price }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to update rate");

      // Reflect the new price on all matching rows in the table
      setRows(prev => prev.map(r =>
        r.insurerCode.trim().toLowerCase() === code.toLowerCase() && !r.excluded
          ? { ...r, tariffPrice: String(price), hasTariff: true, dirty: false }
          : r));
      setSuccess(`Updated ${affected.length} service${affected.length === 1 ? "" : "s"} under code "${code}" to ₹${price.toLocaleString("en-IN")}`);
      setRateCode(""); setRatePrice(""); setShowRateByCode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update rate");
    } finally {
      setRateBusy(false);
    }
  }

  /** Distinct insurer codes present (for the datalist suggestions) */
  const insurerCodes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.insurerCode.trim()) s.add(r.insurerCode.trim()); });
    return Array.from(s).sort();
  }, [rows]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tariff Rates — ${companyName}`}
      size="xl"
      footer={
        <>
          <div className="mr-auto text-xs text-slate-500">
            {pricedCount} of {rows.length} services priced
            {dirtyCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">• {dirtyCount} unsaved</span>
            )}
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Close
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300
                text-white font-medium rounded-lg flex items-center gap-2">
              {saving && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Save {dirtyCount > 0 ? `(${dirtyCount})` : ""}
            </button>
          )}
        </>
      }>

      {/* Contract dates (Option A: one range per insurer) */}
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contract Effective From</label>
            <input type="date" value={fromDate} disabled={!canEdit}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Effective To (extend here)</label>
            <input type="date" value={toDate} disabled={!canEdit}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100" />
          </div>
          {canEdit && (
            <button onClick={handleSaveDates} disabled={savingDates}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white
                hover:bg-slate-100 text-slate-700 font-medium disabled:opacity-50">
              {savingDates ? "Saving…" : "Save Dates"}
            </button>
          )}
          <p className="text-xs text-slate-400 self-center">
            Tariff prices apply only when the bill date falls in this range. Leave blank for no limit.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-4 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2.5 text-xs text-sky-800">
        Set the rate <b>{companyName}</b> pays per service. Services are pulled from Billing Masters,
        Lab Masters and Wards automatically — new items you add there appear here. Unpriced services
        fall back to the hospital rate. Mark <b>Not Covered</b> for items the insurer doesn&apos;t pay —
        these are kept off the insurance bill (₹0 claimed) and collected from the patient directly.
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2.5 rounded-lg">{success}</div>
      )}

      {/* Filters + custom add */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search service, code, category…"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm
            focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <select
          value={showOnly}
          onChange={e => setShowOnly(e.target.value as "all" | "priced" | "unpriced")}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700
            focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
          <option value="all">All services</option>
          <option value="priced">Priced only</option>
          <option value="unpriced">Unpriced only</option>
        </select>
        {canEdit && (
          <button onClick={() => { setShowRateByCode(v => !v); setShowCustom(false); }}
            className="px-3 py-2 text-sm rounded-lg border border-emerald-200 bg-emerald-50
              text-emerald-700 font-medium hover:bg-emerald-100">
            ↻ Change Rate by Code
          </button>
        )}
        {canEdit && (
          <button onClick={() => { setShowCustom(v => !v); setShowRateByCode(false); }}
            className="px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-indigo-50
              text-indigo-700 font-medium hover:bg-indigo-100">
            + Custom Tariff
          </button>
        )}
      </div>

      {/* Change Rate by Insurer Code */}
      {showRateByCode && canEdit && (
        <div className="mb-4 border border-emerald-200 bg-emerald-50/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-emerald-800 mb-2">
            Change rate by insurer code — updates every service sharing that code
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Insurer Code</label>
              <input list="tm-ins-codes" value={rateCode} onChange={e => setRateCode(e.target.value)}
                placeholder="e.g. code001"
                className="w-40 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono
                  focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <datalist id="tm-ins-codes">
                {insurerCodes.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">New Price ₹</label>
              <input type="number" min={0} value={ratePrice} onChange={e => setRatePrice(e.target.value)}
                placeholder="450"
                className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {rateCode.trim() && (
              <p className="text-xs text-slate-500 self-center">
                {rows.filter(r => r.insurerCode.trim().toLowerCase() === rateCode.trim().toLowerCase()).length} service(s) mapped to this code
              </p>
            )}
            <button onClick={handleRateByCode} disabled={rateBusy}
              className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                text-white font-medium rounded-lg">
              {rateBusy ? "Updating…" : "Apply to All"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Assign the same insurer code to multiple services (in the Insurer Code column, then Save),
            then use this to change their shared price in one step.
          </p>
        </div>
      )}

      {/* Custom tariff form */}
      {showCustom && canEdit && (
        <div className="mb-4 border border-indigo-200 bg-indigo-50/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-indigo-800 mb-2">
            Add an insurer-only item (not in any master, e.g. a package rate)
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Insurer Code</label>
              <input value={custInsCode} onChange={e => setCustInsCode(e.target.value)}
                placeholder="e.g. DC-1207"
                className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-600 mb-1">Item name / insurer description</label>
              <input value={custName} onChange={e => setCustName(e.target.value)}
                placeholder="e.g. D&C Insurance Package"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price ₹</label>
              <input type="number" min={0} value={custPrice} onChange={e => setCustPrice(e.target.value)}
                placeholder="12700"
                className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Category</label>
              <select value={custCategory} onChange={e => setCustCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer">
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-slate-600 mb-1">Note (optional)</label>
              <input value={custNote} onChange={e => setCustNote(e.target.value)}
                placeholder="Inclusive of consumables"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <button onClick={handleAddCustom} disabled={saving}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                text-white font-medium rounded-lg">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Grouped table */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Loading catalogue…</div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[48vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Service", "Category", "Insurer Code", "Insurer Description", "Hospital Rate", "Tariff Price", "Not Covered"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500
                      uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No services found</td></tr>
                ) : groupedCategories.flatMap(([cat, list]) => {
                  if (list.length === 0) return [];
                  return [
                    <tr key={`hdr-${cat}`} className="bg-slate-100/70">
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                        {cat} ({list.length})
                      </td>
                    </tr>,
                    ...list.map(r => {
                      const diff = r.hospitalRate != null && r.tariffPrice !== ""
                        ? Number(r.tariffPrice) - r.hospitalRate : 0;
                      return (
                        <tr key={r.serviceCode}
                          className={`hover:bg-slate-50 transition-colors ${r.dirty ? "bg-amber-50/40" : ""}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{r.serviceName}</p>
                            <span className="font-mono text-[10px] text-slate-400">{r.serviceCode}</span>
                            {!r.hasTariff && !r.dirty && (
                              <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                uses hospital rate
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={CATEGORY_OPTIONS.includes(r.category) ? r.category : "Others"}
                              disabled={!canEdit}
                              onChange={e => updateRow(r.serviceCode, { category: e.target.value })}
                              className="px-2 py-1 rounded border border-slate-200 text-xs bg-white
                                focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 cursor-pointer">
                              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={r.insurerCode}
                              disabled={!canEdit}
                              onChange={e => updateRow(r.serviceCode, { insurerCode: e.target.value })}
                              placeholder="—"
                              className="w-24 px-2 py-1 rounded border border-slate-200 text-xs font-mono
                                focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50" />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={r.insurerDescription}
                              disabled={!canEdit}
                              onChange={e => updateRow(r.serviceCode, { insurerDescription: e.target.value })}
                              placeholder="Insurer's description"
                              className="w-44 px-2 py-1 rounded border border-slate-200 text-xs
                                focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50" />
                          </td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{inr(r.hospitalRate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs">₹</span>
                              <input
                                type="number" min={0} step="0.01"
                                value={r.tariffPrice}
                                disabled={!canEdit || r.excluded}
                                onChange={e => updateRow(r.serviceCode, { tariffPrice: e.target.value })}
                                className="w-24 px-2 py-1 rounded border border-slate-200 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-sky-500
                                  disabled:bg-slate-50 disabled:text-slate-400"
                              />
                              {!r.excluded && diff !== 0 && (
                                <span className={`text-[10px] font-medium ${diff < 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                  {diff < 0 ? "▼" : "▲"} {inr(Math.abs(diff))}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer"
                              title="Insurer does not pay this — kept off the insurance bill; patient pays directly">
                              <input
                                type="checkbox"
                                checked={r.excluded}
                                disabled={!canEdit}
                                onChange={e => updateRow(r.serviceCode, { excluded: e.target.checked })}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className="text-xs text-slate-500">{r.excluded ? "Patient pays" : ""}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
