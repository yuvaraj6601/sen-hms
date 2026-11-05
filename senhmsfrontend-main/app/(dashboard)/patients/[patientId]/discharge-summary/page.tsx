"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { getSession } from "../../../../_lib/auth";
import { printHtml } from "../../../../_lib/print";
import HospitalHeader from "../../../../_components/hospital/HospitalHeader";
import { HOSPITAL } from "../../../../_lib/hospital-config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DischargeSummaryForm {
  admissionId:             string;
  admissionNo:             string;
  patientId:               string;
  uhid:                    string;
  patientName:             string;
  ageSex:                  string;
  ipNo:                    string;
  roomNo:                  string;
  consultantName:          string;
  insuranceName:           string;
  claimNo:                 string;
  dateOfAdmission:         string;
  timeOfAdmission:         string;
  dateOfDischarge:         string;
  timeOfDischarge:         string;
  finalDiagnosis:          string;
  chiefComplaints:         string;
  historyOfPresentIllness: string;
  pastHistory:             string;
  clinicalExamination:     string;
  investigations:          string;
  pulmonaryFunctionTest:   string;
  hospitalCourse:          string;
  treatmentInHospital:     string;
  conditionAtDischarge:    string;
  dischargeMedication:     string;
  dischargeAdvice:         string;
  followUp:                string;
  consultantDesignation:   string;
}

interface AdmissionResponse {
  id:                   number;
  admissionNo:          string;
  patientId:            number;
  uhid:                 string;
  patientName:          string;
  age:                  number;
  gender:               string;
  admittingDoctorName:  string;
  wardName:             string;
  bedNumber:            string;
  admissionDate:        string;
  admissionTime:        string;
  dischargeDate:        string;
  dischargeTime:        string;
  insuranceCompany:     string;
  policyNo:             string;
  tpaName:              string;
  preAuthNumber:        string;
  provisionalDiagnosis: string;
  finalDiagnosis:       string;
  dischargeNotes:       string;
  status:               string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(admissionId = "", admissionNo = "", patientId = "", uhid = ""): DischargeSummaryForm {
  return {
    admissionId, admissionNo, patientId, uhid,
    patientName: "", ageSex: "", ipNo: "", roomNo: "",
    consultantName: "", insuranceName: "", claimNo: "",
    dateOfAdmission: "", timeOfAdmission: "",
    dateOfDischarge: "", timeOfDischarge: "",
    finalDiagnosis: "", chiefComplaints: "",
    historyOfPresentIllness: "", pastHistory: "",
    clinicalExamination: "", investigations: "",
    pulmonaryFunctionTest: "", hospitalCourse: "",
    treatmentInHospital: "", conditionAtDischarge: "",
    dischargeMedication: "", dischargeAdvice: "",
    followUp: "", consultantDesignation: "",
  };
}

function prefillFromAdmission(adm: AdmissionResponse): Partial<DischargeSummaryForm> {
  const gender = adm.gender ? adm.gender.charAt(0).toUpperCase() + adm.gender.slice(1).toLowerCase() : "";
  return {
    admissionId:     String(adm.id),
    admissionNo:     adm.admissionNo ?? "",
    patientId:       String(adm.patientId),
    uhid:            adm.uhid ?? "",
    patientName:     adm.patientName ?? "",
    ageSex:          adm.age ? `${adm.age} Years / ${gender}` : "",
    ipNo:            adm.admissionNo ?? "",
    roomNo:          adm.bedNumber ? `${adm.wardName ?? ""} - ${adm.bedNumber}` : (adm.wardName ?? ""),
    consultantName:  adm.admittingDoctorName ?? "",
    insuranceName:   adm.insuranceCompany ?? "",
    dateOfAdmission: adm.admissionDate ?? "",
    timeOfAdmission: adm.admissionTime ?? "",
    dateOfDischarge: adm.dischargeDate ?? "",
    timeOfDischarge: adm.dischargeTime ?? "",
    finalDiagnosis:  adm.finalDiagnosis ?? adm.provisionalDiagnosis ?? "",
  };
}

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, status: res.status, error: json.error ?? "Request failed" };
}

function fmt(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Print helper ─────────────────────────────────────────────────────────────

function buildPrintHtml(f: DischargeSummaryForm): string {
  const section = (title: string, content: string) =>
    content.trim()
      ? `<div class="section">
           <div class="sec-title">${title}</div>
           <div class="sec-body">${content.replace(/\n/g, "<br/>")}</div>
         </div>`
      : "";

  const headerRow = (label: string, value: string) =>
    `<tr><td class="hl">${label}</td><td class="hc">:</td><td class="hv">${value || "—"}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Discharge Summary — ${f.patientName}</title>
<style>
  @page { size: A4; margin: 10mm 12mm 12mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }

  /* ── Hospital header ── */
  .hosp-header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
  .hosp-logo   { font-size: 18px; font-weight: 900; border: 2px solid #1a1a6e; padding: 4px 8px; line-height: 1.1; color: #1a1a6e; }
  .hosp-sub    { font-size: 8px; font-weight: bold; letter-spacing: 1px; display: block; }
  .hosp-center { text-align: center; flex: 1; padding: 0 10px; }
  .hosp-name   { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
  .hosp-tag    { font-size: 11px; font-weight: bold; }
  .hosp-addr   { font-size: 9px; margin-top: 2px; }
  .hosp-seal   { font-size: 8px; font-weight: bold; border: 1.5px solid #000; padding: 4px 6px; text-align: center; }

  /* ── Doc title ── */
  .doc-title { text-align: center; font-size: 13px; font-weight: bold; border: 1.5px solid #000;
               padding: 3px 0; letter-spacing: 2px; margin-bottom: 8px; }

  /* ── Patient header table ── */
  .pat-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
  .pat-table td { padding: 2px 4px; }
  .hl  { font-weight: bold; width: 130px; white-space: nowrap; }
  .hc  { width: 10px; }
  .hv  { }
  .insurance-row { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
  hr.divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }

  /* ── Sections ── */
  .section     { margin-bottom: 8px; }
  .sec-title   { font-weight: bold; font-size: 11px; border-bottom: 1px solid #000;
                 padding-bottom: 2px; margin-bottom: 3px; letter-spacing: 0.5px; }
  .sec-body    { font-size: 11px; line-height: 1.5; white-space: pre-wrap; }

  /* ── Signature ── */
  .sig-block   { text-align: right; margin-top: 20px; font-size: 11px; }
  .sig-line    { display: inline-block; border-top: 1px solid #000; width: 160px;
                 text-align: center; padding-top: 2px; margin-top: 30px; }
  .footer-note { font-size: 8px; font-style: italic; margin-top: 12px; border-top: 1px dashed #000;
                 padding-top: 4px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

  <!-- Hospital Header -->
  <div class="hosp-header">
    <div class="hosp-logo">SEN<br/><span class="hosp-sub">HOSPITALS</span></div>
    <div class="hosp-center">
      <div class="hosp-name">${HOSPITAL.fullName.toUpperCase()}</div>
      <div class="hosp-tag">${HOSPITAL.tagline}</div>
      <div class="hosp-addr">${HOSPITAL.address}</div>
      <div class="hosp-addr">Tel: ${HOSPITAL.phones.join(", ")} &nbsp;|&nbsp; Pharmacy: ${HOSPITAL.pharmacy}</div>
      <div class="hosp-addr">Email: ${HOSPITAL.email} &nbsp;|&nbsp; ${HOSPITAL.website}</div>
    </div>
    <div class="hosp-seal">NABH<br/>PRE<br/>ACCREDITED</div>
  </div>

  <!-- Document title -->
  <div class="doc-title">DISCHARGE SUMMARY</div>

  <!-- Patient / Admission header -->
  ${f.insuranceName ? `<div class="insurance-row">INSURANCE NAME: ${f.insuranceName.toUpperCase()}${f.claimNo ? " &nbsp;&nbsp; CLAIM NO: " + f.claimNo : ""}</div>` : ""}

  <table class="pat-table">
    <tr>
      <td colspan="3"><b>Patient Name</b> : &nbsp;${f.patientName || "—"} &nbsp;&nbsp;&nbsp; <b>Age / Sex</b> : ${f.ageSex || "—"}</td>
    </tr>
    ${headerRow("IP No", f.ipNo)}
    ${headerRow("UHID", f.uhid)}
    ${headerRow("Room No", f.roomNo)}
    ${headerRow("Consultant", f.consultantName)}
    ${headerRow("Date of Admission", fmt(f.dateOfAdmission) + (f.timeOfAdmission ? "  &nbsp;Time : " + f.timeOfAdmission : ""))}
    ${headerRow("Date of Discharge", fmt(f.dateOfDischarge) + (f.timeOfDischarge ? "  &nbsp;Time : " + f.timeOfDischarge : ""))}
  </table>
  <hr class="divider"/>

  <!-- Clinical sections -->
  ${section("FINAL DIAGNOSIS", f.finalDiagnosis)}
  ${section("2. CHIEF COMPLAINTS", f.chiefComplaints)}
  ${section("HISTORY OF PRESENT ILLNESS", f.historyOfPresentIllness)}
  ${section("PAST HISTORY", f.pastHistory)}
  ${section("CLINICAL EXAMINATION", f.clinicalExamination)}
  ${section("INVESTIGATIONS", f.investigations)}
  ${f.pulmonaryFunctionTest ? section("PULMONARY FUNCTION TEST", f.pulmonaryFunctionTest) : ""}
  ${section("HOSPITAL COURSE", f.hospitalCourse)}
  ${section("MEDICATIONS / TREATMENT GIVEN IN HOSPITAL", f.treatmentInHospital)}
  ${section("CONDITION AT DISCHARGE", f.conditionAtDischarge)}
  ${section("DISCHARGE MEDICATION", f.dischargeMedication)}
  ${section("DISCHARGE ADVICE", f.dischargeAdvice)}
  ${section("FOLLOW-UP", f.followUp)}

  <!-- Signature -->
  <div class="sig-block">
    <div class="sig-line">
      Consultant: ${f.consultantName || "_______________"}<br/>
      ${f.consultantDesignation || ""}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-note">
    * Contents of this report require clinical co-relation before any clinical action. &nbsp;|&nbsp;
    ${HOSPITAL.fullName} &nbsp;|&nbsp; ${HOSPITAL.address}
  </div>

</body>
</html>`;
}

function printSummary(f: DischargeSummaryForm) {
  printHtml(buildPrintHtml(f));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white placeholder-slate-300";
const readCls  = "w-full px-3 py-2 rounded-lg border border-slate-100 text-sm text-slate-700 bg-slate-50 cursor-not-allowed";
const areaCls  = inputCls + " resize-y min-h-[80px]";
const areaReadCls = readCls + " resize-none min-h-[60px]";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DischargeSummaryPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const session  = getSession();
  const role     = session?.role ?? "";

  // Doctor writes the clinical content; Admin and MD can also edit (corrections)
  // Receptionist gets view + print only
  const canEdit  = ["Doctor", "Admin", "Managing Director"].includes(role);

  const [form,        setForm]        = useState<DischargeSummaryForm>(emptyForm());
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");
  const [saveErr,     setSaveErr]     = useState("");
  const [admissionId, setAdmissionId] = useState<string>("");
  const [pageErr,     setPageErr]     = useState("");
  const [isDirty,     setIsDirty]     = useState(false);

  // ── Load: find most recent admission then load or pre-fill summary ──────────
  const load = useCallback(async () => {
    setLoading(true); setPageErr("");
    try {
      // 1. get admission list for patient
      const admRes = await apiFetch(`/api/admissions/patient/${patientId}`);
      if (!admRes.ok) { setPageErr(admRes.error); return; }

      const admissions: AdmissionResponse[] = Array.isArray(admRes.data)
        ? admRes.data : [];

      // Prefer discharged, else most recent
      const adm: AdmissionResponse | undefined =
        admissions.find((a) => a.status === "DISCHARGED") ??
        admissions[admissions.length - 1];

      if (!adm) { setPageErr("No admission found for this patient."); return; }

      setAdmissionId(String(adm.id));

      // 2. try to load existing discharge summary
      const dsRes = await apiFetch(`/api/discharge-summary/by-admission/${adm.id}`);

      if (dsRes.ok && dsRes.data) {
        // Existing summary — populate form
        const d = dsRes.data as Record<string, string>;
        setForm({
          admissionId:             String(adm.id),
          admissionNo:             d.admissionNo             ?? adm.admissionNo ?? "",
          patientId:               String(adm.patientId),
          uhid:                    d.uhid                    ?? adm.uhid ?? "",
          patientName:             d.patientName             ?? adm.patientName ?? "",
          ageSex:                  d.ageSex                  ?? "",
          ipNo:                    d.ipNo                    ?? adm.admissionNo ?? "",
          roomNo:                  d.roomNo                  ?? "",
          consultantName:          d.consultantName          ?? adm.admittingDoctorName ?? "",
          insuranceName:           d.insuranceName           ?? adm.insuranceCompany ?? "",
          claimNo:                 d.claimNo                 ?? "",
          dateOfAdmission:         d.dateOfAdmission         ?? adm.admissionDate ?? "",
          timeOfAdmission:         d.timeOfAdmission         ?? adm.admissionTime ?? "",
          dateOfDischarge:         d.dateOfDischarge         ?? adm.dischargeDate ?? "",
          timeOfDischarge:         d.timeOfDischarge         ?? adm.dischargeTime ?? "",
          finalDiagnosis:          d.finalDiagnosis          ?? adm.finalDiagnosis ?? "",
          chiefComplaints:         d.chiefComplaints         ?? "",
          historyOfPresentIllness: d.historyOfPresentIllness ?? "",
          pastHistory:             d.pastHistory             ?? "",
          clinicalExamination:     d.clinicalExamination     ?? "",
          investigations:          d.investigations          ?? "",
          pulmonaryFunctionTest:   d.pulmonaryFunctionTest   ?? "",
          hospitalCourse:          d.hospitalCourse          ?? "",
          treatmentInHospital:     d.treatmentInHospital     ?? "",
          conditionAtDischarge:    d.conditionAtDischarge    ?? "",
          dischargeMedication:     d.dischargeMedication     ?? "",
          dischargeAdvice:         d.dischargeAdvice         ?? "",
          followUp:                d.followUp                ?? "",
          consultantDesignation:   d.consultantDesignation   ?? "",
        });
      } else {
        // Not yet created — pre-fill from admission
        const prefilled = prefillFromAdmission(adm);
        setForm({ ...emptyForm(String(adm.id), adm.admissionNo, String(adm.patientId), adm.uhid), ...prefilled });
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // ── Field change ───────────────────────────────────────────────────────────
  function set(key: keyof DischargeSummaryForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveMsg(""); setSaveErr("");
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!admissionId) return;
    setSaving(true); setSaveMsg(""); setSaveErr("");
    const body = {
      ...form,
      admissionId: Number(admissionId),
      patientId:   Number(form.patientId),
      dateOfAdmission: form.dateOfAdmission || null,
      dateOfDischarge: form.dateOfDischarge || null,
    };
    const { ok, error } = await apiFetch(
      `/api/discharge-summary/by-admission/${admissionId}`,
      { method: "PUT", body: JSON.stringify(body) }
    );
    setSaving(false);
    if (!ok) { setSaveErr(error); return; }
    setSaveMsg("Saved successfully");
    setIsDirty(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-32" />
        <div className="bg-white rounded-xl border border-slate-200 h-32" />
        {[1,2,3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 h-28" />
        ))}
      </div>
    );
  }

  if (pageErr) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-600 font-medium">{pageErr}</p>
        <button onClick={load} className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600">Retry</button>
        <Link href="/patients" className="text-xs text-sky-600 underline">Back to Patients</Link>
      </div>
    );
  }

  const inputField  = (key: keyof DischargeSummaryForm, placeholder?: string) =>
    canEdit
      ? <input className={inputCls} value={form[key]} placeholder={placeholder ?? ""} onChange={(e) => set(key, e.target.value)} />
      : <div className={readCls}>{form[key] || "—"}</div>;

  const areaField = (key: keyof DischargeSummaryForm, rows = 4, placeholder?: string) =>
    canEdit
      ? <textarea className={areaCls} rows={rows} value={form[key]} placeholder={placeholder ?? "Type here..."} onChange={(e) => set(key, e.target.value)} />
      : <div className={areaReadCls + " whitespace-pre-wrap"}>{form[key] || "—"}</div>;

  return (
    <div className="space-y-4 pb-10">

      {/* ── Back ── */}
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#00059f] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Patients
      </Link>

      {/* ── Page header ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">Discharge Summary</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {form.patientName && <span className="font-semibold text-slate-700">{form.patientName}</span>}
            {form.uhid && <span className="ml-2 font-mono text-[#00059f]">{form.uhid}</span>}
            {form.admissionNo && <span className="ml-2 text-indigo-600">{form.admissionNo}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Save message */}
          {saveMsg && <span className="text-xs text-emerald-600 font-semibold">{saveMsg}</span>}
          {saveErr && <span className="text-xs text-red-600">{saveErr}</span>}
          {isDirty && canEdit && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {/* Print button — always visible */}
          <button
            onClick={() => printSummary(form)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200
              bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          {/* Save button — only for permitted roles */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00059f] text-white
                text-xs font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* ── Print preview header (visible on screen, matches print) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 print:block">
        <HospitalHeader formTitle="DISCHARGE SUMMARY" />

        {/* Patient / Admission header grid */}
        <div className="mt-4 space-y-1 text-sm">
          {form.insuranceName && (
            <p className="font-bold text-sm">
              INSURANCE NAME: {form.insuranceName.toUpperCase()}
              {form.claimNo && <span className="ml-4">CLAIM NO: {form.claimNo}</span>}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-700 mt-2">
            <div><span className="font-bold w-36 inline-block">Patient Name</span>: {form.patientName || "—"}</div>
            <div><span className="font-bold w-36 inline-block">Age / Sex</span>: {form.ageSex || "—"}</div>
            <div><span className="font-bold w-36 inline-block">IP No</span>: {form.ipNo || "—"}</div>
            <div><span className="font-bold w-36 inline-block">UHID</span>: {form.uhid || "—"}</div>
            <div><span className="font-bold w-36 inline-block">Room No</span>: {form.roomNo || "—"}</div>
            <div><span className="font-bold w-36 inline-block">Consultant</span>: {form.consultantName || "—"}</div>
            <div>
              <span className="font-bold w-36 inline-block">Date of Admission</span>:&nbsp;
              {fmt(form.dateOfAdmission)}{form.timeOfAdmission ? <span className="ml-2 text-slate-500">Time: {form.timeOfAdmission}</span> : ""}
            </div>
            <div>
              <span className="font-bold w-36 inline-block">Date of Discharge</span>:&nbsp;
              {fmt(form.dateOfDischarge)}{form.timeOfDischarge ? <span className="ml-2 text-slate-500">Time: {form.timeOfDischarge}</span> : ""}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Insurance + header fields ── */}
      <SectionCard title="Patient & Admission Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Patient Name">{inputField("patientName", "Mr. / Mrs.")}</Field>
          <Field label="Age / Sex">{inputField("ageSex", "e.g. 18 Years / Male")}</Field>
          <Field label="IP No">{inputField("ipNo")}</Field>
          <Field label="UHID">{inputField("uhid")}</Field>
          <Field label="Room No">{inputField("roomNo", "e.g. Room 204")}</Field>
          <Field label="Consultant">{inputField("consultantName", "Doctor name")}</Field>
          <Field label="Consultant Designation">{inputField("consultantDesignation", "e.g. MBBS, MS, MCh")}</Field>
          <Field label="Insurance Company">{inputField("insuranceName", "e.g. Star Health")}</Field>
          <Field label="Claim No">{inputField("claimNo", "e.g. CIR/2027/121300/...")}</Field>
          <div className="sm:col-span-1">
            <Field label="Date of Admission">
              {canEdit
                ? <input type="date" className={inputCls} value={form.dateOfAdmission} onChange={(e) => set("dateOfAdmission", e.target.value)} />
                : <div className={readCls}>{fmt(form.dateOfAdmission)}</div>}
            </Field>
          </div>
          <Field label="Time of Admission">{inputField("timeOfAdmission", "e.g. 10:45 PM")}</Field>
          <div className="sm:col-span-1">
            <Field label="Date of Discharge">
              {canEdit
                ? <input type="date" className={inputCls} value={form.dateOfDischarge} onChange={(e) => set("dateOfDischarge", e.target.value)} />
                : <div className={readCls}>{fmt(form.dateOfDischarge)}</div>}
            </Field>
          </div>
          <Field label="Time of Discharge">{inputField("timeOfDischarge", "e.g. 03:45 PM")}</Field>
        </div>
      </SectionCard>

      {/* ── Section 2: Final Diagnosis ── */}
      <SectionCard title="Final Diagnosis">
        <Field label="Final Diagnosis">
          {areaField("finalDiagnosis", 3, "e.g. Viral Febrile Illness — Swine Flu")}
        </Field>
      </SectionCard>

      {/* ── Section 3: Chief Complaints ── */}
      <SectionCard title="Chief Complaints">
        <Field label="Chief Complaints">
          {areaField("chiefComplaints", 4, "e.g. High-grade fever with chills for 3 days\nNausea and body pain for 3 days")}
        </Field>
      </SectionCard>

      {/* ── Section 4: History ── */}
      <SectionCard title="History of Present Illness">
        <Field label="">
          {areaField("historyOfPresentIllness", 5, "Describe the history of present illness...")}
        </Field>
      </SectionCard>

      {/* ── Section 5: Past History ── */}
      <SectionCard title="Past History">
        <Field label="Past History (Diabetes, Hypertension, CAD, Drug Allergy, etc.)">
          {areaField("pastHistory", 4, "e.g. Diabetes mellitus – No. Hypertension – No. Coronary artery disease – No.\nBronchial asthma – No. Drug allergy – Nil.")}
        </Field>
      </SectionCard>

      {/* ── Section 6: Clinical Examination ── */}
      <SectionCard title="Clinical Examination">
        <Field label="Findings (CVS, RS, Abdomen, CNS, Hydration, etc.)">
          {areaField("clinicalExamination", 5, "Systemic examination:\nCVS – No significant abnormality.\nRespiratory system – bilateral air entry present.\nAbdomen – No significant abnormality.\nCNS – No focal neurological deficit.\nHydration: Adequate")}
        </Field>
      </SectionCard>

      {/* ── Section 7: Investigations ── */}
      <SectionCard title="Investigations">
        <Field label="Lab results, imaging findings, etc.">
          {areaField("investigations", 5, "List key investigation results...")}
        </Field>
      </SectionCard>

      {/* ── Section 8: Pulmonary Function Test (optional) ── */}
      <SectionCard title="Pulmonary Function Test (if applicable)">
        <Field label="PFT findings">
          {areaField("pulmonaryFunctionTest", 3, "e.g. Reduced FVC/FEV1 values compared with predicted values.\nPattern suggestive of restrictive ventilatory defect.")}
        </Field>
      </SectionCard>

      {/* ── Section 9: Hospital Course ── */}
      <SectionCard title="Hospital Course">
        <Field label="">
          {areaField("hospitalCourse", 6, "Describe the clinical course during hospital stay...")}
        </Field>
      </SectionCard>

      {/* ── Section 10: Treatment in Hospital ── */}
      <SectionCard title="Medications / Treatment Given in Hospital">
        <Field label="IVF, Injections, Tablets, Syrups — with route, dose and duration">
          {areaField("treatmentInHospital", 7,
            "IVF\nInj Pan 40mg + 100 ml NS   IV 1-0-1 × 5 days\nInj Emeset 4mg + 20 ml D/W  IV 1-0-1 × 5 days\nTab Tamiflu 75mg             P/O 1-0-1 × 5 days")}
        </Field>
      </SectionCard>

      {/* ── Section 11: Condition at Discharge ── */}
      <SectionCard title="Condition at Discharge">
        <Field label="">
          {areaField("conditionAtDischarge", 3,
            "At the time of discharge, the patient was clinically improved and haemodynamically stable, with supportive treatment.")}
        </Field>
      </SectionCard>

      {/* ── Section 12: Discharge Medication ── */}
      <SectionCard title="Discharge Medication">
        <Field label="Drugs to be taken at home — with dosage and duration">
          {areaField("dischargeMedication", 6,
            "Cap RARA D (B/F)    PO 1-0-1 × 5 DAYS\nTab BILVAS          PO 1-0-1 × 5 DAYS\nSYP BROZEDEX 20ML   PO 1-0-1 ml × 3 days\nT MORTEGA 200MG     PO1-0-1 × 5 days")}
        </Field>
      </SectionCard>

      {/* ── Section 13: Discharge Advice ── */}
      <SectionCard title="Discharge Advice">
        <Field label="">
          {areaField("dischargeAdvice", 8,
            "Adequate oral fluids and good hydration.\nTake medications strictly as prescribed by the treating doctor.\nAdequate rest and nutritious diet.\nMonitor for recurrence/persistence of fever.\nFollow up with the treating physician as advised.\nReturn immediately if any of the following develop:\n  • Persistent/high-grade fever\n  • Bleeding from nose/gums or blood in vomit/stool\n  • Severe abdominal pain\n  • Persistent vomiting\n  • Breathlessness\n  • Reduced urine output")}
        </Field>
      </SectionCard>

      {/* ── Section 14: Follow-up ── */}
      <SectionCard title="Follow-Up">
        <Field label="">
          {areaField("followUp", 3,
            "Follow-up with treating physician: As advised.\nRepeat CBC/platelet count: As clinically indicated.")}
        </Field>
      </SectionCard>

      {/* ── Bottom save bar ── */}
      {canEdit && (
        <div className="sticky bottom-4 z-10">
          <div className="bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 flex items-center justify-between gap-3 max-w-3xl mx-auto">
            <div className="text-xs text-slate-500">
              {isDirty
                ? <span className="text-amber-600 font-semibold">You have unsaved changes</span>
                : saveMsg
                ? <span className="text-emerald-600 font-semibold">{saveMsg}</span>
                : "All changes saved"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => printSummary(form)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600
                  text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                🖨 Print
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-4 py-1.5 rounded-lg bg-[#00059f] text-white text-xs font-semibold
                  hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
