import { describe, it, expect } from "vitest";
import {
  calcBmi,
  bmiCategory,
  validateDietForm,
  buildDietRequest,
  groupQuestions,
  toChart,
  DIET_CONDITIONS,
  type DietForm,
  type StaticQuestion,
  type DataAnswer,
} from "../app/_lib/chatbot";

const form = (over: Partial<DietForm> = {}): DietForm => ({
  age: "30", gender: "Male", heightCm: "172", weightKg: "72",
  conditions: ["DIABETES"], activity: "Moderate", goal: "Manage condition",
  foodPreference: "Vegetarian", allergies: "", specialNeeds: "",
  ...over,
});

describe("calcBmi / bmiCategory", () => {
  it("matches the value shown in the reference video (172 cm, 72 kg = 24.3)", () => {
    expect(calcBmi("172", "72")).toBe(24.3);
  });
  it("returns null until both numbers are valid and positive", () => {
    expect(calcBmi("", "72")).toBeNull();
    expect(calcBmi("172", "")).toBeNull();
    expect(calcBmi("0", "72")).toBeNull();
    expect(calcBmi("abc", "72")).toBeNull();
    expect(calcBmi("-5", "72")).toBeNull();
  });
  it("categorises on the standard boundaries", () => {
    expect(bmiCategory(18.4)).toBe("Underweight");
    expect(bmiCategory(18.5)).toBe("Normal");
    expect(bmiCategory(24.9)).toBe("Normal");
    expect(bmiCategory(25)).toBe("Overweight");
    expect(bmiCategory(30)).toBe("Obese");
  });
});

describe("DIET_CONDITIONS", () => {
  it("offers the 14 chips from the video with unique keys", () => {
    expect(DIET_CONDITIONS).toHaveLength(14);
    expect(new Set(DIET_CONDITIONS.map(c => c.key)).size).toBe(14);
    const labels = DIET_CONDITIONS.map(c => c.label);
    expect(labels).toContain("Diabetes");
    expect(labels).toContain("Hypertension (High BP)");
    expect(labels).toContain("General / Healthy");
  });
  it("uses the backend condition keys", () => {
    expect(DIET_CONDITIONS.find(c => c.label === "Kidney Disease")?.key).toBe("CKD");
    expect(DIET_CONDITIONS.find(c => c.label === "Heart / Cholesterol")?.key).toBe("HEART");
  });
});

describe("validateDietForm", () => {
  it("accepts a complete form", () => {
    expect(validateDietForm(form())).toEqual({});
  });
  it("requires age, height, weight, gender and at least one condition", () => {
    const e = validateDietForm(form({ age: "", heightCm: "", weightKg: "", gender: "", conditions: [] }));
    expect(Object.keys(e).sort()).toEqual(["age", "conditions", "gender", "heightCm", "weightKg"]);
  });
  it("rejects out-of-range numbers", () => {
    expect(validateDietForm(form({ age: "0" })).age).toBeDefined();
    expect(validateDietForm(form({ age: "121" })).age).toBeDefined();
    expect(validateDietForm(form({ heightCm: "20" })).heightCm).toBeDefined();
    expect(validateDietForm(form({ heightCm: "300" })).heightCm).toBeDefined();
    expect(validateDietForm(form({ weightKg: "5" })).weightKg).toBeDefined();
    expect(validateDietForm(form({ weightKg: "400" })).weightKg).toBeDefined();
  });
  it("rejects non-numeric input", () => {
    expect(validateDietForm(form({ age: "thirty" })).age).toBeDefined();
  });
});

describe("buildDietRequest", () => {
  it("converts strings to numbers and trims allergies", () => {
    expect(buildDietRequest(form({ allergies: "  peanut, shellfish " }))).toEqual({
      age: 30, gender: "Male", heightCm: 172, weightKg: 72,
      conditions: ["DIABETES"], activity: "Moderate", goal: "Manage condition",
      foodPreference: "Vegetarian", allergies: "peanut, shellfish", specialNeeds: "",
    });
  });
  it("never includes patient identity fields", () => {
    const keys = Object.keys(buildDietRequest(form()));
    expect(keys.some(k => /name|uhid|phone/i.test(k))).toBe(false);
  });
});

describe("groupQuestions", () => {
  const q = (id: string, category: string): StaticQuestion => ({ id, text: id, category });
  it("groups by category keeping first-seen order, and drops empty groups", () => {
    const groups = groupQuestions([q("a", "PATIENTS"), q("b", "REVENUE"), q("c", "PATIENTS")]);
    expect(groups.map(g => g.category)).toEqual(["PATIENTS", "REVENUE"]);
    expect(groups[0].questions.map(x => x.id)).toEqual(["a", "c"]);
  });
  it("returns an empty array for no questions", () => {
    expect(groupQuestions([])).toEqual([]);
  });
});

describe("toChart", () => {
  const base: DataAnswer = {
    answer: "x", toolId: "OP_VS_IP_7D", title: "t", columns: ["Date", "OP", "IP"],
    rows: [["30 Oct", "1", "2"], ["31 Oct", "3", "4"]], suggestions: [],
    chart: { type: "bar", labels: ["30 Oct", "31 Oct"], series: [{ label: "OP", values: [1, 3] }, { label: "IP", values: [2, 4] }] },
  };
  it("returns bar/line-ready data when the answer has a chart", () => {
    const c = toChart(base);
    expect(c?.labels).toEqual(["30 Oct", "31 Oct"]);
    expect(c?.series).toHaveLength(2);
    expect(c?.kind).toBe("bar");
  });
  it("returns null when there is no chart", () => {
    expect(toChart({ ...base, chart: null })).toBeNull();
  });
  it("returns null for an empty or mismatched chart", () => {
    expect(toChart({ ...base, chart: { type: "bar", labels: [], series: [] } })).toBeNull();
    expect(toChart({ ...base, chart: { type: "bar", labels: ["a"], series: [{ label: "x", values: [1, 2] }] } })).toBeNull();
  });
});
