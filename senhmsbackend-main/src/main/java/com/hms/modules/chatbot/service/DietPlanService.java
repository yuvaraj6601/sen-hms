package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.client.ChatbotAiClient;
import com.hms.modules.chatbot.dto.DietPlanContent;
import com.hms.modules.chatbot.dto.DietPlanInput;
import com.hms.modules.chatbot.dto.DietPlanRequest;
import com.hms.modules.chatbot.dto.DietPlanResponse;
import com.hms.modules.chatbot.entity.DietRule;
import com.hms.modules.chatbot.repository.DietRuleRepository;
import com.hms.modules.prescription.exception.OpenAiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Builds a diet plan: deterministic numbers + clinical safety rules (diet_rules table) around an
 * AI-written meal plan. The AI output is post-checked — forbidden foods and allergens are stripped.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DietPlanService {

    static final Set<String> CONDITION_KEYS = Set.of(
            "DIABETES", "HYPERTENSION", "HEART", "CKD", "WEIGHT_LOSS", "WEIGHT_GAIN", "THYROID",
            "ANEMIA", "PREGNANCY", "POST_SURGERY", "GASTRIC", "GOUT", "LIVER", "GENERAL");

    static final String DISCLAIMER =
            "AI-generated guidance. Review with your doctor or dietitian before following this plan.";

    private final DietRuleRepository ruleRepo;
    private final ChatbotAiClient ai;

    public DietPlanResponse generate(DietPlanRequest req) {
        List<String> conditions = validatedConditions(req);

        double bmi  = DietCalculator.bmi(req.getHeightCm(), req.getWeightKg());
        double bmr  = DietCalculator.bmr(req.getGender(), req.getAge(), req.getHeightCm(), req.getWeightKg());
        double tdee = DietCalculator.tdee(bmr, req.getActivity());

        List<DietRule> rules = ruleRepo.findByConditionKeyInAndActiveTrue(conditions).stream()
                .sorted(Comparator.comparingInt(DietRule::getSafetyPriority)).toList();

        int ruleDelta = rules.stream().map(DietRule::getCalorieDelta).filter(d -> d != null).mapToInt(Integer::intValue).sum();
        int target = DietCalculator.targetCalories(tdee, req.getGoal(), ruleDelta, req.getGender());
        Double proteinCap = rules.stream().map(DietRule::getProteinMaxGPerKg).filter(p -> p != null)
                .min(Double::compare).map(p -> DietCalculator.proteinCapGrams(p, req.getWeightKg())).orElse(null);

        List<String> warnings = new ArrayList<>();
        for (String key : conditions) {
            if (rules.stream().noneMatch(r -> r.getConditionKey().equals(key))) {
                warnings.add("No clinical safety rule exists for: " + key
                        + ". The plan for this condition is AI-generated guidance only, with no enforced nutrient limits.");
            }
        }
        for (DietRule r : rules) {
            if (!r.isDieticianApproved()) {
                warnings.add("The rule for '" + r.getDisplayName() + "' is not yet approved by a dietician — review the plan carefully.");
            }
        }
        if (target == DietCalculator.floor(req.getGender())
                && DietCalculator.rawTarget(tdee, req.getGoal(), ruleDelta) < target) {
            warnings.add("Calories were raised to the safe minimum of " + target + " kcal/day.");
        }

        DietPlanInput in = new DietPlanInput();
        in.setAge(req.getAge());
        in.setGender(req.getGender());
        in.setHeightCm(req.getHeightCm());
        in.setWeightKg(req.getWeightKg());
        in.setConditions(conditions);
        in.setActivity(req.getActivity());
        in.setGoal(req.getGoal());
        in.setFoodPreference(req.getFoodPreference());
        in.setAllergies(req.getAllergies());
        in.setTargetCalories(target);
        in.setProteinCapGrams(proteinCap);
        in.setRules(rules);

        DietPlanContent plan = ai.generateDietPlan(in);
        if (plan == null || plan.getMeals() == null || plan.getMeals().isEmpty()) {
            throw new OpenAiException("The model returned a diet plan without meals");
        }
        enforceForbidden(plan, rules, req.getAllergies(), warnings);

        DietPlanResponse out = new DietPlanResponse();
        out.setBmi(bmi);
        out.setBmiCategory(DietCalculator.bmiCategory(bmi));
        out.setBmr(bmr);
        out.setTdee(tdee);
        out.setTargetCalories(target);
        out.setProteinCapGrams(proteinCap);
        out.setSafetyWarnings(warnings);
        out.setAppliedRules(rules.stream().map(DietRule::getDisplayName).toList());
        out.setPlan(plan);
        out.setDisclaimer(DISCLAIMER);
        log.info("[CHATBOT] diet plan generated conditions={} target={}kcal rules={}", conditions, target, rules.size());
        return out;
    }

    private List<String> validatedConditions(DietPlanRequest req) {
        if (req.getConditions() == null || req.getConditions().isEmpty()) {
            throw new IllegalArgumentException("Select at least one health condition");
        }
        List<String> keys = req.getConditions().stream().map(String::trim).distinct().toList();
        for (String k : keys) {
            if (!CONDITION_KEYS.contains(k)) throw new IllegalArgumentException("Unknown condition: " + k);
        }
        return keys;
    }

    /** Removes any meal item containing a forbidden food or an allergen, and records a warning for each. */
    private void enforceForbidden(DietPlanContent plan, List<DietRule> rules, String allergies, List<String> warnings) {
        for (DietPlanContent.Meal meal : plan.getMeals()) {
            if (meal.getItems() == null) continue;
            List<String> kept = new ArrayList<>();
            for (String item : meal.getItems()) {
                String lower = item == null ? "" : item.toLowerCase();
                String hit = null;
                for (DietRule r : rules) {
                    for (String term : terms(r.getForbiddenFoods())) {
                        if (lower.contains(term)) {
                            warnings.add("Removed '" + item + "' from " + meal.getName() + " — '" + term
                                    + "' is not allowed for " + r.getDisplayName() + ".");
                            hit = term;
                        }
                    }
                }
                for (String term : terms(allergies)) {
                    if (lower.contains(term)) {
                        warnings.add("Removed '" + item + "' from " + meal.getName() + " — allergy: " + term + ".");
                        hit = term;
                    }
                }
                if (hit == null) kept.add(item);
            }
            meal.setItems(kept);
        }
    }

    private static List<String> terms(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split("[,;\\n]")).map(s -> s.trim().toLowerCase()).filter(s -> !s.isEmpty()).toList();
    }
}
