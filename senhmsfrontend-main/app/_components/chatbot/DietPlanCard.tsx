"use client";

import { printHtml } from "../../_lib/print";
import type { DietPlanResponse } from "../../_lib/chatbot";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function DietPlanCard({ result, ageGender }: { result: DietPlanResponse; ageGender: string }) {
  const { plan } = result;

  function print() {
    const meals = plan.meals.map(m =>
      `<h3>${esc(m.name)} <small>${esc(m.time ?? "")}</small></h3><ul>${m.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("");
    printHtml(`<html><head><title>Diet plan</title><style>body{font-family:Arial,sans-serif;padding:24px}
      small{color:#64748b;font-weight:normal}.w{background:#fffbeb;border:1px solid #fde68a;padding:8px;margin:8px 0}</style></head>
      <body><h2>Diet plan — ${esc(ageGender)}</h2>
      <p>BMI ${result.bmi} (${esc(result.bmiCategory)}) · Target ${result.targetCalories} kcal/day</p>
      ${result.safetyWarnings.map(w => `<div class="w">${esc(w)}</div>`).join("")}
      <p>${esc(plan.summary ?? "")}</p>${meals}
      <h3>Avoid</h3><ul>${plan.avoid.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
      <h3>Tips</h3><ul>${plan.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <p><i>${esc(result.disclaimer)}</i></p></body></html>`);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 w-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Diet plan · {ageGender}</p>
        <button type="button" onClick={print} className="text-xs font-semibold text-[#00059f] hover:underline">Print</button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["BMI", `${result.bmi} (${result.bmiCategory})`],
          ["Target", `${result.targetCalories} kcal`],
          ["Protein cap", result.proteinCapGrams ? `${result.proteinCapGrams} g` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-slate-50 rounded-lg px-2 py-2">
            <p className="text-[10px] uppercase text-slate-400">{k}</p>
            <p className="text-xs font-semibold text-slate-800">{v}</p>
          </div>
        ))}
      </div>

      {result.safetyWarnings.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1 list-disc list-inside">
          {result.safetyWarnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      {result.appliedRules.length > 0 && (
        <p className="text-[11px] text-slate-500">Clinical rules applied: {result.appliedRules.join(", ")}</p>
      )}

      {plan.summary && <p className="text-sm text-slate-700">{plan.summary}</p>}

      <div className="space-y-2">
        {plan.meals.map((m, i) => (
          <div key={i} className="border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-xs font-bold text-slate-800">{m.name} <span className="font-normal text-slate-400">{m.time}</span></p>
            <ul className="text-xs text-slate-700 mt-1 list-disc list-inside space-y-0.5">
              {m.items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {plan.avoid.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-600 mb-1">Avoid</p>
          <p className="text-xs text-slate-700">{plan.avoid.join(", ")}</p>
        </div>
      )}
      {plan.tips.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-700 mb-1">Tips</p>
          <ul className="text-xs text-slate-700 list-disc list-inside space-y-0.5">{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      <p className="text-[11px] italic text-slate-400">{result.disclaimer}</p>
    </div>
  );
}
