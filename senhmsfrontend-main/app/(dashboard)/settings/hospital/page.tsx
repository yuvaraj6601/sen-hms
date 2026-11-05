"use client";

import { useState, useEffect } from "react";
import { getSession } from "../../../_lib/auth";
import type { HospitalSettings } from "../../../_lib/types";
import PageHeader from "../../../_components/PageHeader";
import { FormField, Input, Textarea } from "../../../_components/Modal";

function today() { return new Date().toISOString().slice(0, 10); }

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

/** Map backend response → frontend HospitalSettings shape */
function fromResponse(r: Record<string, unknown>): Partial<HospitalSettings> {
  return {
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
  };
}

export default function HospitalSettingsPage() {
  const session = getSession();
  const userName = session?.name ?? "System";

  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/settings/hospital").then(({ ok, data, error }) => {
      if (ok && data) {
        setSettings(prev => ({ ...(prev ?? {} as HospitalSettings), ...fromResponse(data as Record<string, unknown>) }));
      } else {
        setLoadErr(error);
      }
    });
  }, []);

  function handleChange(field: keyof HospitalSettings, value: string) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setSaved(false);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings({ ...settings, logoBase64: ev.target?.result as string });
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    if (!settings) return;
    setSettings({ ...settings, logoBase64: undefined, logoUrl: undefined });
    setSaved(false);
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!settings) return false;
    if (!settings.hospitalName.trim()) e.hospitalName = "Hospital name is required";
    if (!settings.address.trim()) e.address = "Address is required";
    if (!settings.phone.trim()) e.phone = "Phone is required";
    if (!settings.email.trim()) e.email = "Email is required";
    setFormErr(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validateForm() || !settings) return;
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
    };
    const { ok, data, error } = await apiFetch("/api/settings/hospital", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (ok && data) {
      setSettings(prev => ({ ...(prev ?? {} as HospitalSettings), ...fromResponse(data as Record<string, unknown>) }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert(error ?? "Failed to save");
    }
  }

  if (!settings) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="h-7 bg-slate-200 rounded w-48" />
          <div className="h-9 bg-slate-200 rounded w-24" />
        </div>
        {/* Logo section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 bg-slate-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-3 bg-slate-200 rounded w-2/3" />
              <div className="h-9 bg-slate-100 rounded-lg w-40" />
            </div>
          </div>
        </div>
        {/* Basic info section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded w-40 mb-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-24" />
                <div className="h-9 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        {/* Contact section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded w-36 mb-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-20" />
                <div className="h-9 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        {/* Address section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="h-4 bg-slate-200 rounded w-28 mb-2" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-16" />
                <div className="h-9 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hospital Information"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/hospital" },
          { label: "Hospital Info" },
        ]}
      />

      {saved && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-medium">
          ✓ Settings saved successfully
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* ── Hospital Logo ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            Hospital Logo
          </h2>
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Preview */}
            <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50
              flex items-center justify-center flex-shrink-0 overflow-hidden">
              {settings.logoBase64 || settings.logoUrl ? (
                <img
                  src={settings.logoBase64 || settings.logoUrl}
                  alt="Hospital logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">No logo</p>
                </div>
              )}
            </div>
            {/* Upload controls */}
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-600">
                Upload your hospital logo. It will appear on bills, tokens, and other printed documents.
              </p>
              <p className="text-xs text-slate-400">Recommended: PNG or SVG, min 256×256px, transparent background.</p>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#00059f] text-white
                  text-sm font-semibold rounded-lg cursor-pointer hover:bg-[#00048a] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
                {(settings.logoBase64 || settings.logoUrl) && (
                  <button
                    onClick={removeLogo}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
                      bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Basic Information ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Hospital Name" required error={formErr.hospitalName}>
              <Input
                value={settings.hospitalName}
                onChange={(e) => handleChange("hospitalName", e.target.value)}
                placeholder="e.g., Sen Hospital"
              />
            </FormField>

            <FormField label="Secondary Name (Tamil/Hindi)">
              <Input
                value={settings.hospitalNameSecondary || ""}
                onChange={(e) => handleChange("hospitalNameSecondary", e.target.value)}
                placeholder="e.g., மெடிகேர் மருத்துவமனை (Optional multilingual name)"
              />
            </FormField>

            <FormField label="Tagline">
              <Input
                value={settings.tagline || ""}
                onChange={(e) => handleChange("tagline", e.target.value)}
                placeholder="e.g., Caring for You, Always"
              />
            </FormField>

            <FormField label="Email" required error={formErr.email}>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@hospital.com"
              />
            </FormField>

            <FormField label="Website">
              <Input
                value={settings.website || ""}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://www.hospital.com"
              />
            </FormField>
          </div>
        </section>

        {/* ── Address ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            Address Details
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Address" required error={formErr.address}>
              <Textarea
                value={settings.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Street address, building name, etc."
                rows={2}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="City">
                <Input
                  value={settings.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Chennai"
                />
              </FormField>

              <FormField label="State">
                <Input
                  value={settings.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  placeholder="Tamil Nadu"
                />
              </FormField>

              <FormField label="Pincode">
                <Input
                  value={settings.pincode}
                  onChange={(e) => handleChange("pincode", e.target.value)}
                  placeholder="600001"
                />
              </FormField>

              <FormField label="Country">
                <Input
                  value={settings.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  placeholder="India"
                />
              </FormField>
            </div>
          </div>
        </section>

        {/* ── Contact ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Primary Phone" required error={formErr.phone}>
              <Input
                value={settings.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </FormField>

            <FormField label="Alternate Phone">
              <Input
                value={settings.alternatePhone || ""}
                onChange={(e) => handleChange("alternatePhone", e.target.value)}
                placeholder="+91 98765 43211"
              />
            </FormField>
          </div>
        </section>

        {/* ── Registration ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Registration Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Hospital Registration No.">
              <Input
                value={settings.registrationNo || ""}
                onChange={(e) => handleChange("registrationNo", e.target.value)}
                placeholder="REG123456 (Medical council registration)"
              />
            </FormField>

            <FormField label="GST Number">
              <Input
                value={settings.gstNo || ""}
                onChange={(e) => handleChange("gstNo", e.target.value)}
                placeholder="29ABCDE1234F1Z5 (Goods & Services Tax)"
              />
            </FormField>

            <FormField label="PAN Number">
              <Input
                value={settings.panNo || ""}
                onChange={(e) => handleChange("panNo", e.target.value)}
                placeholder="ABCDE1234F (Permanent Account Number)"
              />
            </FormField>
          </div>
        </section>

        {/* ── Save Button ── */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#00059f] text-white rounded-lg font-semibold
              hover:bg-[#00048a] transition-colors shadow-sm">
            Save Hospital Information
          </button>
        </div>
      </div>

      {/* ── Metadata ── */}
      {settings.updatedBy && (
        <div className="mt-4 text-xs text-slate-400 text-right">
          Last updated by {settings.updatedBy} on {settings.updatedDate}
        </div>
      )}
    </div>
  );
}
