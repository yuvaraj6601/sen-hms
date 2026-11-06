package com.hms.modules.chatbot.service;

import java.util.Map;

/** Pure diet maths: Mifflin-St Jeor BMR, activity multiplier, goal adjustment, safety floors. */
public final class DietCalculator {

    private static final Map<String, Double> ACTIVITY = Map.of(
            "Sedentary", 1.2, "Light", 1.375, "Moderate", 1.55, "Active", 1.725, "Very active", 1.9);

    private static final Map<String, Integer> GOAL_DELTA = Map.of(
            "Weight loss", -500, "Weight gain", 500, "Maintain weight", 0, "Manage condition", 0);

    private DietCalculator() {
    }

    public static double bmi(double heightCm, double weightKg) {
        if (heightCm <= 0 || weightKg <= 0) {
            throw new IllegalArgumentException("Height and weight must be positive");
        }
        double m = heightCm / 100.0;
        return round1(weightKg / (m * m));
    }

    public static String bmiCategory(double bmi) {
        if (bmi < 18.5) return "Underweight";
        if (bmi < 25.0) return "Normal";
        if (bmi < 30.0) return "Overweight";
        return "Obese";
    }

    public static double bmr(String gender, int age, double heightCm, double weightKg) {
        double base = 10 * weightKg + 6.25 * heightCm - 5.0 * age;
        double constant = switch (gender) {
            case "Male" -> 5;
            case "Female" -> -161;
            case "Other" -> -78;
            default -> throw new IllegalArgumentException("Unknown gender: " + gender);
        };
        return round1(base + constant);
    }

    public static double tdee(double bmr, String activity) {
        Double factor = ACTIVITY.get(activity);
        if (factor == null) throw new IllegalArgumentException("Unknown activity level: " + activity);
        return round1(bmr * factor);
    }

    /** Lowest calorie target we will ever recommend. */
    public static int floor(String gender) {
        return "Male".equals(gender) ? 1500 : 1200;
    }

    /** Un-floored target: TDEE + goal adjustment + clinical rule delta. */
    public static double rawTarget(double tdee, String goal, int ruleDelta) {
        Integer adj = GOAL_DELTA.get(goal);
        if (adj == null) throw new IllegalArgumentException("Unknown goal: " + goal);
        return tdee + adj + ruleDelta;
    }

    public static int targetCalories(double tdee, String goal, int ruleDelta, String gender) {
        long target = Math.round(rawTarget(tdee, goal, ruleDelta));
        return (int) Math.max(target, floor(gender));
    }

    public static Double proteinCapGrams(Double gramsPerKg, Double weightKg) {
        if (gramsPerKg == null || weightKg == null) return null;
        return round1(gramsPerKg * weightKg);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
