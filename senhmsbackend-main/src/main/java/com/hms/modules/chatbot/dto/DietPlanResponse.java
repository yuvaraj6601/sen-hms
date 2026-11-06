package com.hms.modules.chatbot.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class DietPlanResponse {
    private Double bmi;
    private String bmiCategory;
    private Double bmr;
    private Double tdee;
    private Integer targetCalories;
    private Double proteinCapGrams;
    private List<String> safetyWarnings = new ArrayList<>();
    private List<String> appliedRules = new ArrayList<>();
    private DietPlanContent plan;
    private String disclaimer;
}
