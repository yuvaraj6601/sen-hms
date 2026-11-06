package com.hms.modules.chatbot;

import com.hms.modules.chatbot.service.DietCalculator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pure maths — Mifflin-St Jeor BMR, activity multipliers, goal adjustments, safety floors. */
class DietCalculatorTest {

    // ── BMI ──
    @Test void bmi_roundsToOneDecimal() {
        assertThat(DietCalculator.bmi(172, 72)).isEqualTo(24.3);   // value shown in the reference video
    }
    @Test void bmiCategory_boundaries() {
        assertThat(DietCalculator.bmiCategory(18.4)).isEqualTo("Underweight");
        assertThat(DietCalculator.bmiCategory(18.5)).isEqualTo("Normal");
        assertThat(DietCalculator.bmiCategory(24.9)).isEqualTo("Normal");
        assertThat(DietCalculator.bmiCategory(25.0)).isEqualTo("Overweight");
        assertThat(DietCalculator.bmiCategory(29.9)).isEqualTo("Overweight");
        assertThat(DietCalculator.bmiCategory(30.0)).isEqualTo("Obese");
    }
    @Test void bmi_nonPositiveHeight_throws() {
        assertThatThrownBy(() -> DietCalculator.bmi(0, 70)).isInstanceOf(IllegalArgumentException.class);
    }

    // ── BMR (Mifflin-St Jeor) ──
    @Test void bmr_male() {
        assertThat(DietCalculator.bmr("Male", 30, 172, 72)).isEqualTo(1650.0);   // 10*72+6.25*172-5*30+5
    }
    @Test void bmr_female() {
        assertThat(DietCalculator.bmr("Female", 30, 160, 60)).isEqualTo(1289.0);   // 10*60+6.25*160-5*30-161
    }
    @Test void bmr_other_usesMidpointConstant() {
        assertThat(DietCalculator.bmr("Other", 30, 172, 72)).isEqualTo(1567.0);  // constant -78 (midpoint of +5 and -161)
    }
    @Test void bmr_unknownGender_throws() {
        assertThatThrownBy(() -> DietCalculator.bmr("Robot", 30, 172, 72)).isInstanceOf(IllegalArgumentException.class);
    }

    // ── TDEE ──
    @Test void tdee_activityMultipliers() {
        assertThat(DietCalculator.tdee(1000, "Sedentary")).isEqualTo(1200.0);
        assertThat(DietCalculator.tdee(1000, "Light")).isEqualTo(1375.0);
        assertThat(DietCalculator.tdee(1000, "Moderate")).isEqualTo(1550.0);
        assertThat(DietCalculator.tdee(1000, "Active")).isEqualTo(1725.0);
        assertThat(DietCalculator.tdee(1000, "Very active")).isEqualTo(1900.0);
    }
    @Test void tdee_unknownActivity_throws() {
        assertThatThrownBy(() -> DietCalculator.tdee(1000, "Couch")).isInstanceOf(IllegalArgumentException.class);
    }

    // ── Target calories ──
    @Test void target_weightGain_adds500() {
        assertThat(DietCalculator.targetCalories(2679.6, "Weight gain", 0, "Male")).isEqualTo(3180);
    }
    @Test void target_weightLoss_subtracts500() {
        assertThat(DietCalculator.targetCalories(2557.5, "Weight loss", 0, "Male")).isEqualTo(2058);
    }
    @Test void target_maintainAndManageCondition_unchanged() {
        assertThat(DietCalculator.targetCalories(2000, "Maintain weight", 0, "Male")).isEqualTo(2000);
        assertThat(DietCalculator.targetCalories(2000, "Manage condition", 0, "Female")).isEqualTo(2000);
    }
    @Test void target_appliesRuleDelta_pregnancyPlus350() {
        assertThat(DietCalculator.targetCalories(2000, "Manage condition", 350, "Female")).isEqualTo(2350);
    }
    @Test void target_neverBelowSafetyFloor_femaleAndMale() {
        assertThat(DietCalculator.targetCalories(1300, "Weight loss", 0, "Female")).isEqualTo(1200);
        assertThat(DietCalculator.targetCalories(1600, "Weight loss", 0, "Male")).isEqualTo(1500);
    }
    @Test void target_unknownGoal_throws() {
        assertThatThrownBy(() -> DietCalculator.targetCalories(2000, "Get shredded", 0, "Male"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── Protein cap (CKD) ──
    @Test void proteinCap_gramsPerKgTimesWeight() {
        assertThat(DietCalculator.proteinCapGrams(0.8, 72.0)).isEqualTo(57.6);
        assertThat(DietCalculator.proteinCapGrams(null, 72.0)).isNull();
    }
}
