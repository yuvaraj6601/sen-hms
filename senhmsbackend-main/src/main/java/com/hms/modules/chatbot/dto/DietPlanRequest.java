package com.hms.modules.chatbot.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** Deliberately carries NO patient identity (name / UHID / phone) — only clinical inputs. */
@Data
public class DietPlanRequest {

    @NotNull(message = "Age is required")
    @Min(value = 1, message = "Age must be between 1 and 120")
    @Max(value = 120, message = "Age must be between 1 and 120")
    private Integer age;

    @NotBlank(message = "Gender is required")
    private String gender;

    @NotNull(message = "Height is required")
    @DecimalMin(value = "50", message = "Height must be between 50 and 250 cm")
    @DecimalMax(value = "250", message = "Height must be between 50 and 250 cm")
    private Double heightCm;

    @NotNull(message = "Weight is required")
    @DecimalMin(value = "10", message = "Weight must be between 10 and 300 kg")
    @DecimalMax(value = "300", message = "Weight must be between 10 and 300 kg")
    private Double weightKg;

    @NotEmpty(message = "Select at least one health condition")
    private List<String> conditions;

    @NotBlank(message = "Activity is required")
    private String activity;

    @NotBlank(message = "Goal is required")
    private String goal;

    @NotBlank(message = "Food preference is required")
    private String foodPreference;

    @Size(max = 300)
    private String allergies;

    @Size(max = 500)
    private String specialNeeds;
}
