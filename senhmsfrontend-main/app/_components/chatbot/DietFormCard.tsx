"use client";

import { Fragment } from "react";
import {
  ACTIVITY_OPTIONS, DIET_CONDITIONS, FOOD_PREFERENCES, GENDER_OPTIONS, GOAL_OPTIONS,
  bmiCategory, calcBmi, type DietForm,
} from "../../_lib/chatbot";

interface Props {
  form: DietForm;
  errors: Record<string, string>;
  onChange: (patch: Partial<DietForm>) => void;
  onSubmit: () => void;
}

const field = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1";

export default function DietFormCard({ form, errors, onChange, onSubmit }: Props) {
  const bmi = calcBmi(form.heightCm, form.weightKg);

  function toggle(key: string) {
    onChange({
      conditions: form.conditions.includes(key) ? form.conditions.filter(c => c !== key) : [...form.conditions, key],
    });
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 w-full">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="cb-age">Age *</label>
          <input id="cb-age" inputMode="numeric" className={field} value={form.age} onChange={e => onChange({ age: e.target.value })} />
          {errors.age && <p className="text-[11px] text-red-600 mt-1">{errors.age}</p>}
        </div>
        <div>
          <label className={label} htmlFor="cb-gender">Gender *</label>
          <select id="cb-gender" className={field} value={form.gender} onChange={e => onChange({ gender: e.target.value })}>
            <option value="">Select</option>
            {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
          </select>
          {errors.gender && <p className="text-[11px] text-red-600 mt-1">{errors.gender}</p>}
        </div>
        <div>
          <label className={label} htmlFor="cb-height">Height (cm) *</label>
          <input id="cb-height" inputMode="decimal" placeholder="cm" className={field} value={form.heightCm} onChange={e => onChange({ heightCm: e.target.value })} />
          {errors.heightCm && <p className="text-[11px] text-red-600 mt-1">{errors.heightCm}</p>}
        </div>
        <div>
          <label className={label} htmlFor="cb-weight">Weight (kg) *</label>
          <input id="cb-weight" inputMode="decimal" placeholder="kg" className={field} value={form.weightKg} onChange={e => onChange({ weightKg: e.target.value })} />
          {errors.weightKg && <p className="text-[11px] text-red-600 mt-1">{errors.weightKg}</p>}
        </div>
      </div>

      {bmi !== null && (
        <p className="text-xs bg-sky-50 text-sky-800 rounded-lg px-3 py-2">BMI: <b>{bmi}</b> ({bmiCategory(bmi)})</p>
      )}

      <div>
        <p className={label}>Health conditions * (select all that apply)</p>
        <div className="flex flex-wrap gap-1.5">
          {DIET_CONDITIONS.map(c => {
            const on = form.conditions.includes(c.key);
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => toggle(c.key)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${on ? "bg-[#00059f] text-white border-[#00059f]" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}>
                {c.label}
              </button>
            );
          })}
        </div>
        {errors.conditions && <p className="text-[11px] text-red-600 mt-1">{errors.conditions}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          ["Activity", "cb-activity", "activity", ACTIVITY_OPTIONS],
          ["Goal", "cb-goal", "goal", GOAL_OPTIONS],
        ] as const).map(([l, id, key, opts]) => (
          <Fragment key={id}>
            <div>
              <label className={label} htmlFor={id}>{l}</label>
              <select id={id} className={field} value={form[key]} onChange={e => onChange({ [key]: e.target.value })}>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </Fragment>
        ))}
      </div>
      <div>
        <label className={label} htmlFor="cb-food">Food preference</label>
        <select id="cb-food" className={field} value={form.foodPreference} onChange={e => onChange({ foodPreference: e.target.value })}>
          {FOOD_PREFERENCES.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="cb-allergy">Allergies</label>
        <input id="cb-allergy" placeholder="Optional" maxLength={300} className={field} value={form.allergies} onChange={e => onChange({ allergies: e.target.value })} />
      </div>
      <div>
        <label className={label} htmlFor="cb-special">Special needs</label>
        <textarea id="cb-special" rows={2} placeholder="Optional — e.g. difficulty chewing, soft diet, fasting days" maxLength={500} className={field} value={form.specialNeeds} onChange={e => onChange({ specialNeeds: e.target.value })} />
      </div>

      <button type="submit"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-[#00059f] text-white hover:bg-blue-800 transition-colors">
        ✦ Generate Diet Plan
      </button>
    </form>
  );
}
