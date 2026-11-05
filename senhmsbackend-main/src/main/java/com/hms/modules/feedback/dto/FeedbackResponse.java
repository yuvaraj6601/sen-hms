package com.hms.modules.feedback.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Full feedback record returned for the detail view and the printable NABH
 * report. Answers are returned in the fixed form order with display text so
 * the frontend can render the exact NABH layout without hard-coding labels.
 */
@Data
public class FeedbackResponse {

    private Long id;
    private String name;
    private String mobile;
    private String comments;
    private Double averageScore;
    private LocalDateTime createdAt;
    private List<Answer> answers = new ArrayList<>();

    @Data
    public static class Answer {
        /** Stable question key, e.g. RECEPTION_SERVICE. */
        private String question;
        private int order;
        private String questionEnglish;
        private String questionTamil;
        /** Rating enum name, e.g. SATISFIED — null when left blank. */
        private String rating;
        /** Numeric weight 1–5, null when left blank. */
        private Integer score;
    }
}
