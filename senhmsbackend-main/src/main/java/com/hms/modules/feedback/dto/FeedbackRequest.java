package com.hms.modules.feedback.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Public QR-form payload for a NABH patient-satisfaction submission.
 * Posted from the patient's phone — no authentication required.
 */
@Data
public class FeedbackRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name is too long")
    private String name;

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "\\d{10}", message = "Enter a valid 10-digit mobile number")
    private String mobile;

    @Size(max = 2000, message = "Comments are too long")
    private String comments;

    @Valid
    private List<FeedbackAnswerRequest> answers = new ArrayList<>();
}
