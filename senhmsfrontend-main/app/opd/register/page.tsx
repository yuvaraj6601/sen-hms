"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { buildOPRegistrationSlipHtml } from "../../_lib/op-slip";
import { printHtml } from "../../_lib/print";

// ── Types ────────────────────────────────────────────────────────────────────
type Gender    = "Male" | "Female" | "Other";
type VisitType = "New" | "Review" | "Follow-up";
type RegType   = "CONSULTATION" | "XRAY" | "SCAN" | "REVIEW" | "PHYSIOTHERAPY" | "OTHERS";

interface TokenEntry {
  id: string;
  uhid: string;
  name: string;
  mobile: string;
  dob: string;
  age: number;
  gender: Gender;
  visitType: VisitType;
  regType: RegType;
  illness: string;
  address: string;
  tokenNo: string;
  visitTime: string | null;
  registeredAt: string;
  date: string;
}

interface IcdOption {
  id: number;
  complaint: string;    // English complaint
  icdCode: string;
  description: string;
}

// ── Bilingual labels (always shown as EN / தமிழ்) ─────────────────────────
const L = {
  hospitalSub:   "OP Token Registration / ஓபி டோக்கன் பதிவு",
  fullName:      "Full Name / முழு பெயர்",
  namePH:        "Enter your full name / முழு பெயர் உள்ளிடவும்",
  mobile:        "Mobile Number / கைபேசி எண்",
  mobilePH:      "10-digit / 10 இலக்க எண்",
  address:       "Address / முகவரி",
  addressPH:     "Door no, street, area, city / முகவரி உள்ளிடவும்",
  dob:           "Date of Birth / பிறந்த தேதி",
  age:           "Age / வயது",
  gender:        "Gender / பாலினம்",
  visitType:     "Visit Type / வருகை வகை",
  regType:       "Reg Type / பதிவு வகை",
  illness:       "Illness / Reason (optional) · நோய் / காரணம் (விருப்பம்)",
  illnessPH:     "Search complaint… / தேடவும்…",
  submit:        "Get My Token / என் டோக்கன் பெறுக",
  submitting:    "Registering… / பதிவு செய்கிறது…",
  nameErr:       "Name is required / பெயர் தேவை",
  mobileErr:     "Enter a valid 10-digit number / சரியான 10 இலக்க எண் உள்ளிடவும்",
  ageErr:        "Age is required / வயது தேவை",
  illnessErr:    "Please select or type your illness / நோயை தேர்ந்தெடுக்கவும்",
  footer:        "© 2026 Sen Hospital · Self-Registration / சுய பதிவு",
  yourToken:     "Your Token Number / உங்கள் டோக்கன் எண்",
  registeredAt:  "Registered at / பதிவு நேரம்",
  labelName:     "Name / பெயர்",
  labelMobile:   "Mobile / கைபேசி",
  labelAge:      "Age / வயது",
  labelGender:   "Gender / பாலினம்",
  labelVisit:    "Visit / வருகை",
  labelComplaint:"Complaint / நோய்",
  labelDate:     "Date / தேதி",
  showToken:     "Please show this token at the reception / ரிசெப்ஷனில் காட்டவும்",
  download:      "Download Token / டோக்கன் பதிவிறக்கம்",
  printSlip:     "Print Slip / ஸ்லிப் அச்சிடு",
  another:       "Register another / மற்றொரு பதிவு",
  years:         "yrs / வ",
  selectPH:      "-- Select illness / நோயை தேர்வு செய்யவும் --",
  otherOption:   "Other (type below) / மற்றவை (கீழே தட்டச்சு செய்யவும்)",
};

const GENDER_OPTS: { en: string; ta: string; val: Gender }[] = [
  { en: "Male",   ta: "ஆண்",    val: "Male"   },
  { en: "Female", ta: "பெண்",   val: "Female" },
  { en: "Other",  ta: "மற்றவை", val: "Other"  },
];

const VISIT_OPTS: { en: string; ta: string; val: VisitType }[] = [
  { en: "New",       ta: "புதியது",       val: "New"       },
  { en: "Review",    ta: "மறுபரிசீலனை",  val: "Review"    },
  { en: "Follow-up", ta: "தொடர்பு",       val: "Follow-up" },
];

const REG_TYPE_OPTS: { en: string; ta: string; val: RegType }[] = [
  { en: "Consultation",  ta: "ஆலோசனை",       val: "CONSULTATION"  },
  { en: "X-Ray",         ta: "எக்ஸ்-ரே",      val: "XRAY"          },
  { en: "Scan",          ta: "ஸ்கேன்",         val: "SCAN"          },
  { en: "Review",        ta: "மறுபரிசீலனை",  val: "REVIEW"        },
  { en: "Physiotherapy", ta: "பிசியோதெரபி",   val: "PHYSIOTHERAPY" },
  { en: "Others",        ta: "மற்றவை",        val: "OTHERS"        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age < 0 ? 0 : age;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function registerToken(
  payload: Omit<TokenEntry, "id" | "uhid" | "tokenNo" | "visitTime">,
): Promise<TokenEntry> {
  const res = await fetch("/api/tokens", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Registration failed");
  return res.json() as Promise<TokenEntry>;
}

// canvas rounded-rect helper
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | { tl: number; tr: number; br: number; bl: number },
) {
  const rad = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl);
  ctx.quadraticCurveTo(x, y, x + rad.tl, y);
  ctx.closePath();
}

// ── ICD Complaint Dropdown ────────────────────────────────────────────────────
// Tamil mapping for common complaints (for the few we have data for)
const TA_MAP: Record<string, string> = {
  "Fever (unspecified)":                   "காய்ச்சல்",
  "Fever with chills":                     "நடுக்கத்துடன் காய்ச்சல்",
  "Cough (unspecified)":                   "இருமல்",
  "Dry cough":                             "வறட்டு இருமல்",
  "Chronic cough":                         "நாள்பட்ட இருமல்",
  "Common cold":                           "சளி / ஜலதோஷம்",
  "Sore throat":                           "தொண்டை வலி",
  "Headache (unspecified)":               "தலைவலி",
  "Body pain / Myalgia":                   "உடல் வலி",
  "Vomiting (unspecified)":               "வாந்தி",
  "Diarrhea (unspecified)":               "வயிற்றுப்போக்கு",
  "Abdominal pain (unspecified)":         "வயிற்று வலி",
  "Fatigue / Weakness":                   "சோர்வு / பலவீனம்",
  "Nasal congestion / Running nose":      "மூக்கடைப்பு / ஒழுக்கு மூக்கு",
  "Loss of appetite / Anorexia":          "பசியின்மை",
  "Breathlessness / Shortness of breath": "மூச்சுத்திணறல்",
  "Sneezing / Allergic rhinitis":         "தும்மல் / ஒவ்வாமை",
  "Viral fever":                           "வைரஸ் காய்ச்சல்",
  "Upper respiratory tract infection":    "மேல் சுவாசக்குழாய் தொற்று",
  "Fever with cough (URI)":               "இருமலுடன் காய்ச்சல்",
};

function ComplaintDropdown({
  value, onChange, error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [options, setOptions]     = useState<IcdOption[]>([]);
  const [query,   setQuery]       = useState("");
  const [open,    setOpen]        = useState(false);
  const [loading, setLoading]     = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  // Load all active ICD complaints on mount
  useEffect(() => {
    setLoading(true);
    fetch("/api/masters/icd-codes?page=0&size=200&status=ACTIVE")
      .then(r => r.json())
      .then(j => {
        const list: IcdOption[] = [];
        const raw = j?.data;
        if (raw && typeof raw === "object" && "content" in raw) {
          list.push(...(raw as { content: IcdOption[] }).content);
        } else if (Array.isArray(raw)) {
          list.push(...raw);
        }
        setOptions(list);
      })
      .catch(() => {/* keep empty */})
      .finally(() => setLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => {
    const q = query.toLowerCase();
    if (!q) return true;
    const ta = TA_MAP[o.complaint] ?? "";
    return o.complaint.toLowerCase().includes(q) || ta.includes(q);
  });

  function selectOption(opt: IcdOption) {
    onChange(opt.complaint);
    setQuery(opt.complaint);
    setOpen(false);
    setShowCustom(false);
  }

  function handleInputChange(v: string) {
    setQuery(v);
    setOpen(true);
    // If user types something not in options, allow free text
    if (!options.find(o => o.complaint === v)) {
      onChange(v);
    }
  }

  function selectOther() {
    setShowCustom(true);
    setOpen(false);
    setQuery("");
    onChange("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const taLabel = value ? TA_MAP[value] : null;

  return (
    <div>
      <div className="relative" ref={dropRef}>
        {/* Search / selected input */}
        <input
          ref={inputRef}
          type="text"
          value={showCustom ? value : query}
          onFocus={() => { if (!showCustom) setOpen(true); }}
          onChange={e => {
            if (showCustom) {
              onChange(e.target.value);
            } else {
              handleInputChange(e.target.value);
            }
          }}
          placeholder={showCustom
            ? "Describe your illness… / நோயை விவரிக்கவும்…"
            : L.illnessPH}
          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800
            focus:outline-none focus:ring-2 focus:ring-sky-400 transition-shadow
            ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
        />

        {/* Selected Tamil label */}
        {!showCustom && taLabel && (
          <p className="text-xs text-sky-600 mt-1 font-medium">
            {taLabel}
          </p>
        )}

        {/* Dropdown list */}
        {open && !showCustom && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg
            max-h-52 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-xs text-slate-400">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400">
                No match — select &quot;Other&quot; to type freely
              </div>
            )}
            {!loading && filtered.map(opt => {
              const ta = TA_MAP[opt.complaint];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={() => selectOption(opt)}
                  className="w-full text-left px-4 py-2.5 hover:bg-sky-50 transition-colors border-b
                    border-slate-50 last:border-0"
                >
                  <p className="text-sm text-slate-800 font-medium">{opt.complaint}</p>
                  {ta && <p className="text-xs text-sky-600">{ta}</p>}
                  <p className="text-xs text-slate-400 font-mono">{opt.icdCode}</p>
                </button>
              );
            })}
            {/* Other option */}
            <button
              type="button"
              onMouseDown={selectOther}
              className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors
                border-t border-slate-100"
            >
              <p className="text-sm text-amber-700 font-medium">{L.otherOption}</p>
            </button>
          </div>
        )}
      </div>
      {/* Switch back from custom */}
      {showCustom && (
        <button
          type="button"
          onClick={() => { setShowCustom(false); setQuery(""); onChange(""); }}
          className="text-xs text-sky-500 mt-1 hover:underline"
        >
          ← Back to list / பட்டியலுக்கு திரும்பு
        </button>
      )}
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────
export default function OPDRegisterPage() {
  const [step, setStep] = useState<"form" | "done">("form");
  const [token, setToken] = useState<TokenEntry | null>(null);
  const [slipHtml, setSlipHtml] = useState<string>("");

  const [name,       setName]       = useState("");
  const [mobile,     setMobile]     = useState("");
  const [dob,        setDob]        = useState("");
  const [ageInput,   setAgeInput]   = useState("");   // manual age (mandatory)
  const [genderIdx,  setGenderIdx]  = useState(0);
  const [visitIdx,   setVisitIdx]   = useState(0);
  const [regIdx,     setRegIdx]     = useState(0);
  const [illness,    setIllness]    = useState("");
  const [address,    setAddress]    = useState("");
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Age is required: taken from the manual field (auto-filled when a DOB is set).
  const age = ageInput.trim() !== "" ? parseInt(ageInput, 10) : null;

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())                    e.name    = L.nameErr;
    if (!/^\d{10}$/.test(mobile.trim())) e.mobile  = L.mobileErr;
    if (age === null || Number.isNaN(age) || age < 0 || age > 130) e.age = L.ageErr;
    // Illness / complaint is optional now.
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const entry = await registerToken({
        name:        name.trim(),
        mobile:      mobile.trim(),
        dob,
        age:         age ?? 0,
        gender:      GENDER_OPTS[genderIdx].val,
        visitType:   VISIT_OPTS[visitIdx].val,
        regType:     REG_TYPE_OPTS[regIdx].val,
        illness:     illness.trim() || "General",
        address:     address.trim(),
        date:        todayStr(),
        registeredAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      });
      setToken(entry);
      // Build the official OP Registration Slip (same one used in the OP Token Queue)
      const html = await buildOPRegistrationSlipHtml({
        tokenNo:     entry.tokenNo,
        uhid:        entry.uhid || entry.id,
        patientName: entry.name,
        age:         entry.age > 0 ? entry.age : null,
        gender:      entry.gender,
        phone:       entry.mobile,
        address:     entry.address || "",
        visitDate:   entry.date,
        visitTime:   entry.visitTime,
        doctorName:  "General OPD",
        referredBy:  "SELF",
        regType:     entry.regType,
        reason:      entry.illness,
      });
      setSlipHtml(html);
      setStep("done");
    } catch {
      setErrors({ submit: "Registration failed. Please try again. / பதிவு தோல்வி. மீண்டும் முயற்சிக்கவும்." });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStep("form"); setToken(null); setSlipHtml(""); setErrors({});
    setName(""); setMobile(""); setDob(""); setAgeInput("");
    setGenderIdx(0); setVisitIdx(0); setRegIdx(0); setIllness(""); setAddress("");
  }

  // ── Canvas token download ─────────────────────────────────────────────────
  function downloadToken(entry: TokenEntry) {
    const W = 420, H = 660;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    function draw(logo: HTMLImageElement | null) {
      ctx.fillStyle = "#ffffff"; rrect(ctx, 0, 0, W, H, 20); ctx.fill();
      ctx.fillStyle = "#0f172a"; rrect(ctx, 0, 0, W, 72, { tl: 20, tr: 20, br: 0, bl: 0 }); ctx.fill();
      if (logo) {
        ctx.fillStyle = "#ffffff"; rrect(ctx, 14, 14, 44, 44, 10); ctx.fill();
        ctx.drawImage(logo, 16, 16, 40, 40);
      }
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("Sen Hospital", 70, 33);
      ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("OP Token / ஓபி டோக்கன்", 70, 53);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(24, 210); ctx.lineTo(W - 24, 210); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(L.yourToken.toUpperCase(), W / 2, 110);
      ctx.fillStyle = "#0ea5e9"; ctx.font = "bold 96px system-ui, sans-serif";
      ctx.fillText(entry.tokenNo, W / 2, 192);
      ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`${L.registeredAt} ${entry.registeredAt}`, W / 2, 232);
      const rows: [string, string][] = [
        [L.labelName, entry.name], [L.labelMobile, entry.mobile],
        ...(entry.age > 0 ? [[L.labelAge, `${entry.age} yrs`] as [string, string]] : []),
        [L.labelGender, entry.gender], [L.labelVisit, entry.visitType],
        [L.labelComplaint, entry.illness], [L.labelDate, entry.date],
      ];
      let y = 268; const maxVW = W - 175;
      for (const [lbl, val] of rows) {
        ctx.textAlign = "left"; ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(lbl, 32, y); ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillStyle = "#1e293b";
        let v = val;
        while (ctx.measureText(v).width > maxVW && v.length > 2) v = v.slice(0, -1);
        if (v !== val) v += "…";
        ctx.textAlign = "right"; ctx.fillText(v, W - 32, y); y += 28;
      }
      ctx.fillStyle = "#fffbeb"; rrect(ctx, 0, H - 52, W, 52, { tl: 0, tr: 0, br: 20, bl: 20 }); ctx.fill();
      ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H - 52); ctx.lineTo(W, H - 52); ctx.stroke();
      ctx.fillStyle = "#92400e"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`📋 ${L.showToken}`, W / 2, H - 22);
      const a = document.createElement("a");
      a.download = `token-${entry.tokenNo}-${entry.date}.png`;
      a.href = canvas.toDataURL("image/png"); a.click();
    }
    const img = new window.Image();
    img.onload = () => draw(img); img.onerror = () => draw(null);
    img.src = "/hos-logo.jpg";
  }

  // ── Print the official OP Registration Slip (same as OP Token Queue) ───────
  async function printSlip(entry: TokenEntry) {
    const html = await buildOPRegistrationSlipHtml({
      tokenNo:     entry.tokenNo,
      uhid:        entry.uhid || entry.id,
      patientName: entry.name,
      age:         entry.age > 0 ? entry.age : null,
      gender:      entry.gender,
      phone:       entry.mobile,
      address:     entry.address || "",
      visitDate:   entry.date,
      visitTime:   entry.visitTime,
      doctorName:  "General OPD",
      referredBy:  "SELF",
      regType:     entry.regType,
      reason:      entry.illness,
    });
    printHtml(html);
  }

  // ── Token confirmation screen — shows the official OP Registration Slip ────
  if (step === "done" && token) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950
        flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400
              flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Official OP Registration Slip (same layout as OP Token Queue) */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <iframe
              title="OP Registration Slip"
              srcDoc={slipHtml}
              className="w-full block"
              style={{ height: "540px", border: "0" }}
            />
          </div>

          <div className="bg-amber-50/90 rounded-xl px-4 py-3 mt-4">
            <p className="text-xs text-amber-800 text-center">📋 {L.showToken}</p>
          </div>

          <button onClick={() => printSlip(token)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl
              bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors
              shadow-lg shadow-sky-500/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {L.printSlip}
          </button>
          <button onClick={resetForm}
            className="mt-3 w-full py-3 rounded-2xl border border-white/20 text-white/70 text-sm
              hover:bg-white/10 transition-colors">
            {L.another}
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950
      flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header — no language toggle, bilingual always */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white shadow-lg mb-3">
            <Image src="/hos-logo.jpg" alt="Sen Hospital" width={56} height={56}
              className="object-contain w-full h-full" />
          </div>
          <h1 className="text-white font-bold text-xl">Sen Hospital</h1>
          <p className="text-slate-400 text-sm mt-0.5 text-center">{L.hospitalSub}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">

          {/* Full Name */}
          <Field label={L.fullName} required error={errors.name}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={L.namePH} className={inputCls(errors.name)} />
          </Field>

          {/* Mobile */}
          <Field label={L.mobile} required error={errors.mobile}>
            <input type="tel" inputMode="numeric" maxLength={10}
              value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ""))}
              placeholder={L.mobilePH} className={inputCls(errors.mobile)} />
          </Field>

          {/* Address */}
          <Field label={L.address}>
            <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)}
              placeholder={L.addressPH}
              className={`${inputCls()} resize-none`} />
          </Field>

          {/* DOB + Age */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={L.dob}>
              <input type="date" value={dob} max={todayStr()}
                onChange={e => {
                  const d = e.target.value;
                  setDob(d);
                  if (d) setAgeInput(String(calcAge(d)));   // auto-fill age from DOB
                }} className={inputCls()} />
            </Field>
            <Field label={L.age} required error={errors.age}>
              <input
                type="text" inputMode="numeric" maxLength={3}
                value={ageInput}
                onChange={e => setAgeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Age / வயது"
                className={inputCls(errors.age)} />
            </Field>
          </div>

          {/* Gender */}
          <Field label={L.gender}>
            <div className="grid grid-cols-3 gap-2">
              {GENDER_OPTS.map((g, i) => (
                <button key={g.val} type="button" onClick={() => setGenderIdx(i)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-colors leading-tight
                    ${genderIdx === i
                      ? "bg-sky-500 text-white border-sky-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
                  {g.en}<br />
                  <span className="text-[10px] opacity-75">{g.ta}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Visit Type */}
          <Field label={L.visitType}>
            <div className="grid grid-cols-3 gap-2">
              {VISIT_OPTS.map((v, i) => (
                <button key={v.val} type="button" onClick={() => setVisitIdx(i)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-colors leading-tight
                    ${visitIdx === i
                      ? "bg-sky-500 text-white border-sky-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
                  {v.en}<br />
                  <span className="text-[10px] opacity-75">{v.ta}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Reg Type */}
          <Field label={L.regType}>
            <div className="grid grid-cols-3 gap-2">
              {REG_TYPE_OPTS.map((r, i) => (
                <button key={r.val} type="button" onClick={() => setRegIdx(i)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-colors leading-tight
                    ${regIdx === i
                      ? "bg-sky-500 text-white border-sky-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}>
                  {r.en}<br />
                  <span className="text-[10px] opacity-75">{r.ta}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Illness — ICD dropdown (optional) */}
          <Field label={L.illness} error={errors.illness}>
            <ComplaintDropdown value={illness} onChange={setIllness} error={errors.illness} />
          </Field>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50
              text-white font-bold text-base transition-colors shadow-lg shadow-sky-500/30">
            {submitting ? L.submitting : L.submit}
          </button>

          {errors.submit && <p className="text-xs text-red-500 text-center">{errors.submit}</p>}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">{L.footer}</p>
      </div>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function inputCls(error?: string) {
  return `w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800
    focus:outline-none focus:ring-2 focus:ring-sky-400 transition-shadow
    ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`;
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}
