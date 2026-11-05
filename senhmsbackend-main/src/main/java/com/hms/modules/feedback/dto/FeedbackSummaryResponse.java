package com.hms.modules.feedback.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Lightweight projection for the staff feedback list / table.
 */
@Data
public class FeedbackSummaryResponse {
    private Long id;
    private String name;
    private String mobile;
    private Double averageScore;
    private int answeredCount;
    private boolean hasComments;
    private LocalDateTime createdAt;
}
