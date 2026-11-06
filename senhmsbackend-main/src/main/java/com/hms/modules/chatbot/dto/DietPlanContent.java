package com.hms.modules.chatbot.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** The AI-written part of a diet plan. */
@Data
public class DietPlanContent {
    private String summary;
    private List<Meal> meals = new ArrayList<>();
    private List<String> avoid = new ArrayList<>();
    private List<String> tips = new ArrayList<>();

    @Data
    public static class Meal {
        private String name;
        private String time;
        private List<String> items = new ArrayList<>();
    }
}
