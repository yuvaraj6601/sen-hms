// Pure helpers + types for the AI chatbot (no React, no fetch) — unit tested in __tests__/chatbot.test.ts.

export interface DietForm {
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  conditions: string[];
  activity: string;
  goal: string;
  foodPreference: string;
  allergies: string;
}

/** Sent to the backend. Deliberately has no patient identity fields. */
export interface DietRequest {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  conditions: string[];
  activity: string;
  goal: string;
  foodPreference: string;
  allergies: string;
}

export interface DietMeal { name: string; time: string; items: string[]; }

export interface DietPlanResponse {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinCapGrams: number | null;
  safetyWarnings: string[];
  appliedRules: string[];
  plan: { summary: string; meals: DietMeal[]; avoid: string[]; tips: string[] };
  disclaimer: string;
}

export interface StaticQuestion { id: string; text: string; category: string; }

export interface ChartPayload {
  type: string;
  labels: string[];
  series: { label: string; values: number[] }[];
}

export interface DataAnswer {
  answer: string;
  toolId: string | null;
  title: string;
  columns: string[];
  rows: string[][];
  chart: ChartPayload | null;
  suggestions: string[];
}

export interface ChartData {
  kind: "bar" | "line" | "pie";
  labels: string[];
  series: { label: string; values: number[] }[];
}

export const DIET_CONDITIONS: { key: string; label: string }[] = [
  { key: "DIABETES", label: "Diabetes" },
  { key: "HYPERTENSION", label: "Hypertension (High BP)" },
  { key: "HEART", label: "Heart / Cholesterol" },
  { key: "CKD", label: "Kidney Disease" },
  { key: "WEIGHT_LOSS", label: "Weight Loss" },
  { key: "WEIGHT_GAIN", label: "Weight Gain" },
  { key: "THYROID", label: "Thyroid" },
  { key: "ANEMIA", label: "Anemia" },
  { key: "PREGNANCY", label: "Pregnancy" },
  { key: "POST_SURGERY", label: "Post-Surgery Recovery" },
  { key: "GASTRIC", label: "Gastric / Acidity" },
  { key: "GOUT", label: "Gout (High Uric Acid)" },
  { key: "LIVER", label: "Liver Disease" },
  { key: "GENERAL", label: "General / Healthy" },
];

export const ACTIVITY_OPTIONS = ["Sedentary", "Light", "Moderate", "Active", "Very active"];
export const GOAL_OPTIONS = ["Manage condition", "Weight loss", "Weight gain", "Maintain weight"];
export const FOOD_PREFERENCES = ["Vegetarian", "Non-vegetarian", "Eggetarian", "Vegan"];
export const GENDER_OPTIONS = ["Male", "Female", "Other"];

export const CATEGORY_LABELS: Record<string, string> = {
  PATIENTS: "Patients", REVENUE: "Revenue", EXPENSES: "Expenses",
  INSURANCE: "Insurance", LAB: "Lab", BEDS: "Beds",
};

function positive(s: string): number | null {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function calcBmi(heightCm: string, weightKg: string): number | null {
  const h = positive(heightCm);
  const w = positive(weightKg);
  if (h === null || w === null) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function inRange(s: string, min: number, max: number): boolean {
  const n = positive(s);
  return n !== null && n >= min && n <= max;
}

export function validateDietForm(f: DietForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!inRange(f.age, 1, 120)) e.age = "Enter an age between 1 and 120";
  if (!f.gender) e.gender = "Select a gender";
  if (!inRange(f.heightCm, 50, 250)) e.heightCm = "Height must be 50–250 cm";
  if (!inRange(f.weightKg, 10, 300)) e.weightKg = "Weight must be 10–300 kg";
  if (f.conditions.length === 0) e.conditions = "Select at least one condition";
  return e;
}

export function buildDietRequest(f: DietForm): DietRequest {
  return {
    age: Number(f.age),
    gender: f.gender,
    heightCm: Number(f.heightCm),
    weightKg: Number(f.weightKg),
    conditions: f.conditions,
    activity: f.activity,
    goal: f.goal,
    foodPreference: f.foodPreference,
    allergies: f.allergies.trim(),
  };
}

export function groupQuestions(qs: StaticQuestion[]): { category: string; questions: StaticQuestion[] }[] {
  const order: string[] = [];
  const map = new Map<string, StaticQuestion[]>();
  for (const q of qs) {
    if (!map.has(q.category)) { map.set(q.category, []); order.push(q.category); }
    map.get(q.category)!.push(q);
  }
  return order.map(category => ({ category, questions: map.get(category)! }));
}

export function toChart(a: DataAnswer): ChartData | null {
  const c = a.chart;
  if (!c || c.labels.length === 0 || c.series.length === 0) return null;
  if (c.series.some(s => s.values.length !== c.labels.length)) return null;
  const kind = c.type === "line" || c.type === "pie" ? c.type : "bar";
  return { kind, labels: c.labels, series: c.series };
}

/** RFC-4180 style CSV of a table answer, for the download button. */
export function answerToCsv(a: DataAnswer): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [a.columns, ...a.rows].map(r => r.map(esc).join(",")).join("\n");
}
