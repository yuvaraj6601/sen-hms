"use client";

import { useState } from "react";
import { printHtml } from "../../_lib/print";
import type { DietPlanResponse } from "../../_lib/chatbot";

type Plan = DietPlanResponse["plan"];

/** Text-box version of the plan: lists are edited one entry per line. */
interface PlanDraft {
  summary: string;
  meals: { name: string; time: string; items: string }[];
  avoid: string;
  tips: string;
}

function toDraft(p: Plan): PlanDraft {
  return {
    summary: p.summary ?? "",
    meals: p.meals.map(m => ({ name: m.name, time: m.time ?? "", items: m.items.join("\n") })),
    avoid: p.avoid.join("\n"),
    tips: p.tips.join("\n"),
  };
}

function lines(s: string): string[] {
  return s.split("\n").map(l => l.trim()).filter(Boolean);
}

function fromDraft(d: PlanDraft): Plan {
  return {
    summary: d.summary.trim(),
    meals: d.meals.map(m => ({ name: m.name.trim(), time: m.time.trim(), items: lines(m.items) })),
    avoid: lines(d.avoid),
    tips: lines(d.tips),
  };
}

const FIELD = "w-full text-xs text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00059f]/30";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function DietPlanCard({ result, ageGender }: { result: DietPlanResponse; ageGender: string }) {
  const [plan, setPlan] = useState<Plan>(result.plan);
  const [draft, setDraft] = useState<PlanDraft | null>(null);

  function download(p: Plan) {
    const meals = p.meals.map(m =>
      `<h3>${esc(m.name)} <small>${esc(m.time ?? "")}</small></h3><ul>${m.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("");
    printHtml(`<html><head><title>Diet plan</title><style>body{font-family:Arial,sans-serif;padding:24px}
      small{color:#64748b;font-weight:normal}.w{background:#fffbeb;border:1px solid #fde68a;padding:8px;margin:8px 0}</style></head>
      <body><h2>Diet plan — ${esc(ageGender)}</h2>
      <p>BMI ${result.bmi} (${esc(result.bmiCategory)}) · Target ${result.targetCalories} kcal/day</p>
      ${result.safetyWarnings.map(w => `<div class="w">${esc(w)}</div>`).join("")}
      <p>${esc(p.summary ?? "")}</p>${meals}
      <h3>Avoid</h3><ul>${p.avoid.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
      <h3>Tips</h3><ul>${p.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <p><i>${esc(result.disclaimer)}</i></p></body></html>`);
  }

  function saveAndDownload() {
    if (!draft) return;
    const next = fromDraft(draft);
    setPlan(next);
    setDraft(null);
    download(next);
  }

  function updateMeal(idx: number, patch: Partial<PlanDraft["meals"][number]>) {
    setDraft(d => d ? { ...d, meals: d.meals.map((m, i) => i === idx ? { ...m, ...patch } : m) } : d);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 w-full">
      <p className="text-sm font-semibold text-slate-800">Diet plan · {ageGender}</p>

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

      {draft ? (
        <div className="space-y-2">
          <textarea rows={2} value={draft.summary} aria-label="Summary" className={FIELD}
            onChange={e => setDraft({ ...draft, summary: e.target.value })} />
          {draft.meals.map((m, i) => (
            <div key={i} className="border border-slate-100 rounded-lg px-3 py-2 space-y-1">
              <div className="flex gap-2">
                <input value={m.name} aria-label="Meal" className={`${FIELD} font-bold`} onChange={e => updateMeal(i, { name: e.target.value })} />
                <input value={m.time} aria-label="Time" className={`${FIELD} w-28`} onChange={e => updateMeal(i, { time: e.target.value })} />
              </div>
              <textarea rows={Math.max(2, m.items.split("\n").length)} value={m.items} aria-label={`${m.name} items, one per line`}
                className={FIELD} onChange={e => updateMeal(i, { items: e.target.value })} />
            </div>
          ))}
          <p className="text-xs font-bold text-red-600">Avoid <span className="font-normal text-slate-400">(one per line)</span></p>
          <textarea rows={3} value={draft.avoid} aria-label="Avoid" className={FIELD} onChange={e => setDraft({ ...draft, avoid: e.target.value })} />
          <p className="text-xs font-bold text-emerald-700">Tips <span className="font-normal text-slate-400">(one per line)</span></p>
          <textarea rows={3} value={draft.tips} aria-label="Tips" className={FIELD} onChange={e => setDraft({ ...draft, tips: e.target.value })} />
        </div>
      ) : (
        <>
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
        </>
      )}
      <p className="text-[11px] italic text-slate-400">{result.disclaimer}</p>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
        {draft ? (
          <>
            <button type="button" onClick={() => setDraft(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button" onClick={saveAndDownload}
              className="px-3 py-1.5 text-xs font-semibold bg-[#00059f] text-white rounded-lg hover:bg-blue-800">Save &amp; Download</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setDraft(toDraft(plan))}
              className="px-3 py-1.5 text-xs font-semibold border border-[#00059f] text-[#00059f] rounded-lg hover:bg-blue-50">Edit</button>
            <button type="button" onClick={() => download(plan)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#00059f] text-white rounded-lg hover:bg-blue-800">Download</button>
          </>
        )}
      </div>
    </div>
  );
}
