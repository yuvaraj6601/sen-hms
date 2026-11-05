"use client";

import { useState } from "react";
import Image from "next/image";

// ── NABH rating scale (must match backend FeedbackRating enum) ────────────────
// Star count maps to the 1–5 score: 1★ = Strongly Dissatisfied … 5★ = Strongly Satisfied.
type RatingKey =
  | "STRONGLY_DISSATISFIED"
  | "DISSATISFIED"
  | "NEUTRAL"
  | "SATISFIED"
  | "STRONGLY_SATISFIED";

const STAR_TO_RATING: Record<number, RatingKey> = {
  1: "STRONGLY_DISSATISFIED",
  2: "DISSATISFIED",
  3: "NEUTRAL",
  4: "SATISFIED",
  5: "STRONGLY_SATISFIED",
};

const RATING_LABEL: Record<RatingKey, { en: string; ta: string }> = {
  STRONGLY_DISSATISFIED: { en: "Strongly Dissatisfied", ta: "மிகவும் அதிருப்தி" },
  DISSATISFIED:          { en: "Dissatisfied",          ta: "அதிருப்தி" },
  NEUTRAL:               { en: "Neutral",               ta: "நடுநிலை" },
  SATISFIED:             { en: "Satisfied",             ta: "திருப்தி" },
  STRONGLY_SATISFIED:    { en: "Strongly Satisfied",    ta: "மிகவும் திருப்தி" },
};

// ── 18 NABH questions (must match backend FeedbackQuestion enum names) ────────
interface Question { key: string; en: string; ta: string; }

const QUESTIONS: Question[] = [
  { key: "RECEPTION_SERVICE",        en: "The Reception / Enquiry Service is",            ta: "வரவேற்பு / விசாரணை சேவை" },
  { key: "HOSPITAL_ENVIRONMENT",     en: "The Hospital Environment is",                   ta: "மருத்துவமனையின் சூழ்நிலை" },
  { key: "WARD_FACILITIES",          en: "The Ward Facilities are",                       ta: "வார்டு வசதிகள்" },
  { key: "ADMISSION_PROCESS",        en: "Admission Process",                             ta: "சேர்க்கை முறை" },
  { key: "LABORATORY_SERVICE",       en: "Laboratory Service",                            ta: "ஆய்வக சேவை" },
  { key: "AMBULANCE_SERVICE",        en: "Ambulance Service",                             ta: "அவசர ஊர்தி சேவை" },
  { key: "NURSING_CARE",             en: "Nursing Care",                                  ta: "மருத்துவ பராமரிப்பு" },
  { key: "INTENSIVE_CARE",           en: "Intensive care",                                ta: "தீவிர சிகிச்சை" },
  { key: "SURGICAL_SERVICE",         en: "Surgical Service",                              ta: "அறுவை சிகிச்சை சேவை" },
  { key: "PHARMACY_SERVICE",         en: "Pharmacy Service",                              ta: "மருந்தியல் சேவை" },
  { key: "HOUSEKEEPING",             en: "Housekeeping / Hygienic Practices",             ta: "சுகாதார முறைகள்" },
  { key: "EXPECTED_COSTS_EXPLAINED", en: "Expected Costs are explained",                  ta: "எதிர்பார்க்கப்படும் செலவுகளின் விளக்கம்" },
  { key: "TOILETS_CLEAN",            en: "The Toilet(s) are clean",                       ta: "கழிப்பறைகளின் தூய்மை" },
  { key: "PATIENT_RIGHTS_PROTECTED", en: "Patient's rights is protected",                 ta: "நோயாளியின் உரிமைகள் பாதுகாக்கப்படுகின்றன" },
  { key: "FAMILY_EDUCATED",          en: "Patients / Family Members are Educated in Decisions", ta: "குடும்பத்தினருக்கு முடிவுகள் விளக்கப்படுகின்றன" },
  { key: "HOSPITAL_BILLING",         en: "The Hospital Billing is",                       ta: "மருத்துவமனை கட்டணம்" },
  { key: "DISCHARGE_PROCESS",        en: "Discharge Process",                             ta: "வெளியேறும் முறை" },
  { key: "OVERALL_RATING",           en: "Overall Rating",                                ta: "ஒட்டுமொத்த மதிப்பீடு" },
];

// 3 question pages, 6 questions each.
const PAGES: Question[][] = [
  QUESTIONS.slice(0, 6),
  QUESTIONS.slice(6, 12),
  QUESTIONS.slice(12, 18),
];

// Step model: 0 = welcome, 1..3 = question pages, 4 = thank you.
type Step = 0 | 1 | 2 | 3 | 4;

export default function PublicFeedbackPage() {
  const [step, setStep]         = useState<Step>(0);
  const [name, setName]         = useState("");
  const [mobile, setMobile]     = useState("");
  const [comments, setComments] = useState("");
  const [stars, setStars]       = useState<Record<string, number>>({}); // qKey -> 1..5
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const answeredCount = Object.keys(stars).length;

  function setStar(qKey: string, value: number) {
    setStars((prev) => {
      // Tap the same star again to clear (question optional).
      if (prev[qKey] === value) {
        const next = { ...prev };
        delete next[qKey];
        return next;
      }
      return { ...prev, [qKey]: value };
    });
  }

  function validatePersonal() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required / பெயர் தேவை";
    if (!/^\d{10}$/.test(mobile.trim()))
      e.mobile = "Enter a valid 10-digit number / சரியான 10 இலக்க எண் உள்ளிடவும்";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    // Name/mobile live on the first question page (step 1) — validate before leaving it.
    if (step === 1 && !validatePersonal()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep((s) => Math.min(4, s + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goPrev() {
    setStep((s) => Math.max(0, s - 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validatePersonal()) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        mobile: mobile.trim(),
        comments: comments.trim() || undefined,
        answers: QUESTIONS.map((q) => ({
          question: q.key,
          rating: stars[q.key] ? STAR_TO_RATING[stars[q.key]] : null,
        })),
      };
      const res = await fetch("/api/feedback-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error ?? "Submission failed");
      }
      setStep(4);
      window.scrollTo({ top: 0 });
    } catch {
      setErrors({
        submit: "Could not submit. Please try again. / சமர்ப்பிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStep(0);
    setName(""); setMobile(""); setComments("");
    setStars({}); setErrors({});
    window.scrollTo({ top: 0 });
  }

  const progressPct = step === 0 ? 0 : step === 4 ? 100 : Math.round((step / 3) * 100);

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-white to-blue-50 flex flex-col">
      {/* Top bar with brand + progress (hidden on welcome/thankyou) */}
      {step >= 1 && step <= 3 && (
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100">
          <div className="max-w-xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={goPrev}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500
                  hover:bg-slate-100 transition-colors"
                aria-label="Back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-semibold text-slate-500">Page {step} of 3</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col items-center px-4 ${step === 0 ? "pt-4 pb-6 sm:pt-6" : "py-6"}`}>
        <div className="w-full max-w-xl">
          {step === 0 && <Welcome onStart={() => setStep(1)} />}

          {step >= 1 && step <= 3 && (
            <div className="space-y-4">
              {/* Personal info only on the first question page */}
              {step === 1 && (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
                  <h2 className="text-lg font-bold text-slate-800">Your Details</h2>
                  <p className="text-sm text-sky-600 mb-4">உங்கள் விவரங்கள்</p>
                  <div className="space-y-4">
                    <Field label="Full Name / முழு பெயர்" required error={errors.name}>
                      <input
                        type="text" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name / முழு பெயர்"
                        className={inputCls(errors.name)}
                      />
                    </Field>
                    <Field label="Mobile Number / கைபேசி எண்" required error={errors.mobile}>
                      <input
                        type="tel" inputMode="numeric" maxLength={10} value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                        placeholder="10-digit / 10 இலக்கம்"
                        className={inputCls(errors.mobile)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Question cards for this page */}
              {PAGES[step - 1].map((q, i) => {
                const globalNo = (step - 1) * 6 + i + 1;
                return (
                  <QuestionCard
                    key={q.key}
                    no={globalNo}
                    question={q}
                    value={stars[q.key] ?? 0}
                    onChange={(v) => setStar(q.key, v)}
                  />
                );
              })}

              {/* Comments only on the last question page */}
              {step === 3 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <Field label="Special Comments / மேலும் ஏதேனும் விபரங்கள்">
                    <textarea
                      rows={3} value={comments} onChange={(e) => setComments(e.target.value)}
                      placeholder="Your suggestions… / உங்கள் கருத்துகள்…"
                      className={`${inputCls()} resize-none`}
                    />
                  </Field>
                </div>
              )}

              {/* Nav buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={goPrev}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600
                    font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  {step === 1 ? "Cancel / ரத்து" : "Previous / முந்தையது"}
                </button>
                {step < 3 ? (
                  <button
                    onClick={goNext}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600
                      hover:from-sky-600 hover:to-blue-700 text-white font-semibold text-sm
                      transition-colors shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1"
                  >
                    Next / அடுத்து
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit} disabled={submitting}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600
                      hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 text-white
                      font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/25"
                  >
                    {submitting ? "Submitting… / சமர்ப்பிக்கிறது…" : "Submit / சமர்ப்பி"}
                  </button>
                )}
              </div>
              {errors.submit && (
                <p className="text-xs text-red-500 text-center">{errors.submit}</p>
              )}

              <p className="text-center text-slate-400 text-xs pt-1">
                Answered / பதிலளித்தவை: {answeredCount} / {QUESTIONS.length}
              </p>
            </div>
          )}

          {step === 4 && <ThankYou onReset={resetForm} />}
        </div>
      </div>

      {step === 0 && (
        <p className="text-center text-slate-400 text-xs pb-6">
          © 2026 Sen Hospital · Patient Feedback / நோயாளர் கருத்து
        </p>
      )}
    </div>
  );
}

// ── Welcome screen ─────────────────────────────────────────────────────────────
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Brand row: logo + hospital name + tagline */}
      <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 sm:pt-6">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-white ring-1 ring-slate-100 flex-shrink-0">
          <Image src="/hos-logo.jpg" alt="Sen Hospital" width={44} height={44}
            className="object-contain w-full h-full" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-slate-900 font-extrabold text-base sm:text-lg truncate">Sen Hospital</p>
          <p className="text-slate-400 text-[11px] sm:text-xs font-medium tracking-wide truncate">
            Better Health · Brighter Tomorrow
          </p>
        </div>
      </div>

      {/* Hero: headline + hospital image. Stacks on mobile, side-by-side on >=sm. */}
      <div className="relative px-5 sm:px-6 pt-5 pb-2">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-3">
          <div className="flex-1 min-w-0 text-center sm:text-left order-2 sm:order-1">
            <h1 className="text-slate-900 font-extrabold text-2xl sm:text-3xl leading-tight">
              Patient Feedback Survey
            </h1>
            <p className="text-sky-600 font-semibold text-base sm:text-lg mt-1">
              நோயாளர் கருத்து படிவம்
            </p>
          </div>
          {/* Hospital image — rounded square */}
          <div className="flex-shrink-0 order-1 sm:order-2 w-32 h-32 sm:w-36 sm:h-36 rounded-2xl
            overflow-hidden ring-4 ring-sky-50 shadow-md bg-sky-50">
            <Image
              src="/hospital-image.png"
              alt="Hospital"
              width={160}
              height={160}
              className="object-cover w-full h-full"
              priority
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 sm:px-6 pb-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          Your feedback helps us improve our services and provide better care for everyone.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mt-2">
          உங்கள் கருத்து எங்கள் சேவைகளை மேம்படுத்தவும், அனைவருக்கும் சிறந்த சிகிச்சையை வழங்கவும் உதவுகிறது.
        </p>

        <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 mt-5 flex items-center gap-2.5">
          <svg className="w-5 h-5 text-sky-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-sky-800">Your information is kept confidential</p>
            <p className="text-xs text-sky-600">உங்கள் தகவல் ரகசியமாக வைக்கப்படும்</p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic mt-4">
          Please do not answer if anything is not applicable. ·
          பொருந்தாத எதற்கும் பதிலளிக்க வேண்டாம்.
        </p>

        <button
          onClick={onStart}
          className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600
            hover:from-sky-600 hover:to-blue-700 text-white font-bold text-base transition-colors
            shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
        >
          Start Survey / கருத்து படிவத்தை தொடங்கு
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Question card with 5 golden stars ────────────────────────────────────────
function QuestionCard({
  no, question, value, onChange,
}: {
  no: number; question: Question; value: number; onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const label = value ? RATING_LABEL[STAR_TO_RATING[value]] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex gap-3 mb-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-50 text-sky-600 text-sm font-bold
          flex items-center justify-center">
          {no}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{question.en}</p>
          <p className="text-xs text-sky-600 leading-snug mt-0.5">{question.ta}</p>
        </div>
      </div>

      {/* Stars */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-1"
        onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = s <= active;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              onMouseEnter={() => setHover(s)}
              aria-label={`${RATING_LABEL[STAR_TO_RATING[s]].en} (${s} star${s > 1 ? "s" : ""})`}
              aria-pressed={value === s}
              className="p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <svg
                className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                  filled ? "text-amber-400" : "text-slate-200"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 17.27l5.18 3.13a1 1 0 001.49-1.08l-1.38-5.9 4.59-3.97a1 1 0 00-.57-1.75l-6.03-.52-2.36-5.56a1 1 0 00-1.84 0L8.73 7.18l-6.03.52a1 1 0 00-.57 1.75l4.59 3.97-1.38 5.9a1 1 0 001.49 1.08L12 17.27z" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Selected label */}
      <div className="h-5 text-center mt-1">
        {label ? (
          <span className="text-xs font-medium text-amber-600">
            {label.en} · {label.ta}
          </span>
        ) : (
          <span className="text-xs text-slate-300">Tap a star to rate / மதிப்பிட தட்டவும்</span>
        )}
      </div>
    </div>
  );
}

// ── Thank you screen ──────────────────────────────────────────────────────────
function ThankYou({ onReset }: { onReset: () => void }) {
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 px-6 py-10 text-center mt-6">
      <div className="flex justify-center mb-5">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300
          flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Thank You!</h1>
      <p className="text-sky-600 font-semibold text-lg mb-4">நன்றி!</p>
      <p className="text-sm text-slate-600 leading-relaxed">
        Your feedback has been submitted successfully. It helps us serve you better.
      </p>
      <p className="text-xs text-slate-500 mt-2">
        உங்கள் கருத்து வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது. நன்றி.
      </p>
      <button
        onClick={onReset}
        className="mt-8 w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600
          hover:from-sky-600 hover:to-blue-700 text-white font-semibold text-sm transition-colors
          shadow-lg shadow-sky-500/25"
      >
        Start New Response / புதிய கருத்து
      </button>
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
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
