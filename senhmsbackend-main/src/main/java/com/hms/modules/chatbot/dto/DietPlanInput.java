package com.hms.modules.chatbot.dto;

import com.hms.modules.chatbot.entity.DietRule;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** Everything sent to the model for a diet plan. Contains no patient identity — keep it that way. */
@Data
public class DietPlanInput {
    private Integer age;
    private String gender;
    private Double heightCm;
    private Double weightKg;
    private List<String> conditions = new ArrayList<>();
    private String activity;
    private String goal;
    private String foodPreference;
    private String allergies;
    private Integer targetCalories;
    private Double proteinCapGrams;
    private List<DietRule> rules = new ArrayList<>();
}
