package com.hms.modules.chatbot;

import com.hms.modules.chatbot.client.ChatbotAiClient;
import com.hms.modules.chatbot.dto.DietPlanContent;
import com.hms.modules.chatbot.dto.DietPlanInput;
import com.hms.modules.chatbot.dto.DietPlanRequest;
import com.hms.modules.chatbot.dto.DietPlanResponse;
import com.hms.modules.chatbot.entity.DietRule;
import com.hms.modules.chatbot.repository.DietRuleRepository;
import com.hms.modules.chatbot.service.DietPlanService;
import com.hms.modules.prescription.exception.OpenAiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DietPlanServiceTest {

    @Mock DietRuleRepository rules;
    @Mock ChatbotAiClient ai;
    DietPlanService service;

    @BeforeEach
    void setUp() {
        service = new DietPlanService(rules, ai);
    }

    // ── helpers ──
    private DietPlanRequest req(String... conditions) {
        DietPlanRequest r = new DietPlanRequest();
        r.setAge(30);
        r.setGender("Male");
        r.setHeightCm(172.0);
        r.setWeightKg(72.0);
        r.setConditions(List.of(conditions));
        r.setActivity("Moderate");
        r.setGoal("Manage condition");
        r.setFoodPreference("Vegetarian");
        return r;
    }

    private DietRule rule(String key, String name, boolean approved, String forbidden) {
        DietRule d = new DietRule();
        d.setConditionKey(key);
        d.setDisplayName(name);
        d.setDieticianApproved(approved);
        d.setActive(true);
        d.setForbiddenFoods(forbidden);
        return d;
    }

    private DietPlanContent content(String mealName, String... items) {
        DietPlanContent c = new DietPlanContent();
        c.setSummary("Balanced plan");
        DietPlanContent.Meal m = new DietPlanContent.Meal();
        m.setName(mealName);
        m.setTime("8:00 AM");
        m.setItems(new ArrayList<>(List.of(items)));
        c.setMeals(new ArrayList<>(List.of(m)));
        c.setAvoid(new ArrayList<>());
        c.setTips(new ArrayList<>());
        return c;
    }

    private void rulesReturn(DietRule... r) {
        when(rules.findByConditionKeyInAndActiveTrue(any(Collection.class))).thenReturn(List.of(r));
    }

    // ═════════════ happy path ═════════════

    @Test
    void generate_happyPath_returnsComputedNumbersAndAiPlan() {
        rulesReturn(rule("DIABETES", "Diabetes", true, "sugar,sweets"));
        when(ai.generateDietPlan(any())).thenReturn(content("Breakfast", "Oats with nuts"));

        DietPlanResponse out = service.generate(req("DIABETES"));

        assertThat(out.getBmi()).isEqualTo(24.3);
        assertThat(out.getBmiCategory()).isEqualTo("Normal");
        assertThat(out.getBmr()).isEqualTo(1650.0);
        assertThat(out.getTdee()).isEqualTo(2557.5);
        assertThat(out.getTargetCalories()).isEqualTo(2558);   // rounded, Manage condition => no delta
        assertThat(out.getPlan().getMeals()).hasSize(1);
        assertThat(out.getAppliedRules()).containsExactly("Diabetes");
        assertThat(out.getDisclaimer()).containsIgnoringCase("doctor");
    }

    @Test
    void generate_sendsTargetsAndRulesToAi_butNoIdentity() {
        rulesReturn(rule("DIABETES", "Diabetes", true, "sugar,sweets"));
        when(ai.generateDietPlan(any())).thenReturn(content("Breakfast", "Oats"));

        service.generate(req("DIABETES"));

        ArgumentCaptor<DietPlanInput> cap = ArgumentCaptor.forClass(DietPlanInput.class);
        verify(ai).generateDietPlan(cap.capture());
        DietPlanInput in = cap.getValue();
        assertThat(in.getTargetCalories()).isEqualTo(2558);
        assertThat(in.getRules()).hasSize(1);
        assertThat(in.getFoodPreference()).isEqualTo("Vegetarian");
        // DietPlanInput must carry no patient identity fields at all
        assertThat(DietPlanInput.class.getDeclaredFields())
                .noneMatch(f -> f.getName().toLowerCase().contains("name") || f.getName().toLowerCase().contains("uhid"));
    }

    @Test
    void generate_pregnancyRuleDelta_raisesTarget() {
        DietRule p = rule("PREGNANCY", "Pregnancy", true, "papaya");
        p.setCalorieDelta(350);
        rulesReturn(p);
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Dal rice"));
        DietPlanRequest r = req("PREGNANCY");
        r.setGender("Female");

        DietPlanResponse out = service.generate(r);

        // BMR female = 10*72+6.25*172-5*30-161 = 1484 ; TDEE x1.55 = 2300.2 ; +350
        assertThat(out.getTargetCalories()).isEqualTo(2650);
    }

    @Test
    void generate_ckdRule_computesProteinCapAndPassesIt() {
        DietRule ckd = rule("CKD", "Kidney Disease (CKD)", true, "banana");
        ckd.setProteinMaxGPerKg(0.8);
        rulesReturn(ckd);
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Rice"));

        DietPlanResponse out = service.generate(req("CKD"));

        assertThat(out.getProteinCapGrams()).isEqualTo(57.6);
        ArgumentCaptor<DietPlanInput> cap = ArgumentCaptor.forClass(DietPlanInput.class);
        verify(ai).generateDietPlan(cap.capture());
        assertThat(cap.getValue().getProteinCapGrams()).isEqualTo(57.6);
    }

    // ═════════════ safety layer ═════════════

    @Test
    void generate_conditionWithoutRule_addsNoRuleWarning() {
        rulesReturn();   // nothing matches THYROID
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Roti"));

        DietPlanResponse out = service.generate(req("THYROID"));

        assertThat(out.getSafetyWarnings()).anyMatch(w -> w.contains("No clinical safety rule") && w.contains("THYROID"));
    }

    @Test
    void generate_ruleNotDieticianApproved_addsApprovalWarning() {
        rulesReturn(rule("DIABETES", "Diabetes", false, "sugar"));
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Roti"));

        DietPlanResponse out = service.generate(req("DIABETES"));

        assertThat(out.getSafetyWarnings()).anyMatch(w -> w.toLowerCase().contains("not yet approved by a dietician"));
    }

    @Test
    void generate_aiPlanContainsForbiddenFood_itemRemovedAndWarned() {
        rulesReturn(rule("DIABETES", "Diabetes", true, "sugar,white rice"));
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Dal", "White Rice with curry", "Salad"));

        DietPlanResponse out = service.generate(req("DIABETES"));

        assertThat(out.getPlan().getMeals().get(0).getItems()).containsExactly("Dal", "Salad");
        assertThat(out.getSafetyWarnings()).anyMatch(w -> w.contains("White Rice") && w.contains("Diabetes"));
    }

    @Test
    void generate_aiPlanContainsAllergen_itemRemovedAndWarned() {
        rulesReturn(rule("GENERAL", "General / Healthy", true, null));
        when(ai.generateDietPlan(any())).thenReturn(content("Breakfast", "Peanut butter toast", "Banana"));
        DietPlanRequest r = req("GENERAL");
        r.setAllergies("peanut, shellfish");

        DietPlanResponse out = service.generate(r);

        assertThat(out.getPlan().getMeals().get(0).getItems()).containsExactly("Banana");
        assertThat(out.getSafetyWarnings()).anyMatch(w -> w.toLowerCase().contains("allerg") && w.toLowerCase().contains("peanut"));
    }

    @Test
    void generate_calorieFloorApplied_addsWarning() {
        rulesReturn(rule("GENERAL", "General / Healthy", true, null));
        when(ai.generateDietPlan(any())).thenReturn(content("Lunch", "Salad"));
        DietPlanRequest r = req("GENERAL");
        r.setGender("Female");
        r.setHeightCm(150.0);
        r.setWeightKg(40.0);
        r.setActivity("Sedentary");
        r.setGoal("Weight loss");

        DietPlanResponse out = service.generate(r);

        assertThat(out.getTargetCalories()).isEqualTo(1200);
        assertThat(out.getSafetyWarnings()).anyMatch(w -> w.contains("1200"));
    }

    // ═════════════ validation / failure ═════════════

    @Test
    void generate_noConditions_throwsIllegalArgumentWithoutCallingAi() {
        assertThatThrownBy(() -> service.generate(req()))
                .isInstanceOf(IllegalArgumentException.class);
        verify(ai, never()).generateDietPlan(any());
    }

    @Test
    void generate_unknownCondition_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.generate(req("TIME_TRAVEL")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(ai, never()).generateDietPlan(any());
    }

    @Test
    void generate_unknownActivity_throwsIllegalArgument() {
        DietPlanRequest r = req("GENERAL");
        r.setActivity("Couch");
        assertThatThrownBy(() -> service.generate(r)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void generate_aiFails_propagatesOpenAiException() {
        rulesReturn(rule("GENERAL", "General / Healthy", true, null));
        when(ai.generateDietPlan(any())).thenThrow(new OpenAiException("boom"));

        assertThatThrownBy(() -> service.generate(req("GENERAL"))).isInstanceOf(OpenAiException.class);
    }

    @Test
    void generate_aiReturnsNoMeals_throwsOpenAiException() {
        rulesReturn(rule("GENERAL", "General / Healthy", true, null));
        DietPlanContent empty = new DietPlanContent();
        empty.setMeals(new ArrayList<>());
        when(ai.generateDietPlan(any())).thenReturn(empty);

        assertThatThrownBy(() -> service.generate(req("GENERAL"))).isInstanceOf(OpenAiException.class);
    }
}
