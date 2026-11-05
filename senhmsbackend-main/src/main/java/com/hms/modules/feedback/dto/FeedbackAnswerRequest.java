package com.hms.modules.feedback.dto;

import com.hms.modules.feedback.enums.FeedbackQuestion;
import com.hms.modules.feedback.enums.FeedbackRating;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * A single answer in the feedback submission payload.
 * {@code rating} may be null — the form allows skipping non-applicable questions.
 */
@Data
public class FeedbackAnswerRequest {

    @NotNull(message = "Question is required")
    private FeedbackQuestion question;

    /** Null when the patient left the question blank. */
    private FeedbackRating rating;
}
