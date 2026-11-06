package com.hms.modules.chatbot.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** Answer to a hospital-data question: a sentence, a table, and optionally a chart. */
@Data
public class DataAnswer {
    private String answer;
    private String toolId;
    private String title;
    private List<String> columns = new ArrayList<>();
    private List<List<String>> rows = new ArrayList<>();
    private ChartData chart;
    private List<String> suggestions = new ArrayList<>();

    @Data
    public static class ChartData {
        /** "bar" | "line" | "pie" */
        private String type;
        private List<String> labels = new ArrayList<>();
        private List<Series> series = new ArrayList<>();
    }

    @Data
    public static class Series {
        private String label;
        private List<Double> values = new ArrayList<>();
    }
}
