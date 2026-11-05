package com.hms.modules.feedback.enums;

/**
 * 5-point NABH patient-satisfaction scale.
 *
 * Mirrors the printed NABH feedback form columns:
 *   Strongly Dissatisfied → Dissatisfied → Neutral → Satisfied → Strongly Satisfied
 *
 * {@code score} is the numeric weight (1–5) used for NABH average/score reporting.
 */
public enum FeedbackRating {

    STRONGLY_DISSATISFIED(1),
    DISSATISFIED(2),
    NEUTRAL(3),
    SATISFIED(4),
    STRONGLY_SATISFIED(5);

    private final int score;

    FeedbackRating(int score) {
        this.score = score;
    }

    public int getScore() {
        return score;
    }
}
