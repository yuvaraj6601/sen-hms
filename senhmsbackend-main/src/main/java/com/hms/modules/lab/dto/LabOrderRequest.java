package com.hms.modules.lab.dto;

import com.hms.modules.lab.enums.LabPriority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * A single request can place multiple tests at once (batch order).
 */
@Data
public class LabOrderRequest {

    // ── Patient ───────────────────────────────────────────────────────────────
    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank(message = "UHID is required")
    private String uhid;

    @NotBlank(message = "Patient name is required")
    @Size(max = 150)
    private String patientName;

    @Size(max = 5)
    private String patientType;  // OP / IP

    // ── Doctor ────────────────────────────────────────────────────────────────
    @Size(max = 150)
    private String doctorName;

    private Long doctorId;

    // ── Links ─────────────────────────────────────────────────────────────────
    private Long admissionId;
    private Long visitId;

    // ── Order metadata ────────────────────────────────────────────────────────
    @NotNull(message = "Ordered date is required")
    private LocalDate orderedDate;

    @Size(max = 10)
    private String orderedTime;

    @NotBlank(message = "Ordered by is required")
    @Size(max = 150)
    private String orderedBy;

    // ── Test lines (1 or more) ────────────────────────────────────────────────
    @NotEmpty(message = "At least one test is required")
    @Valid
    private List<LabOrderLine> tests;

    @Data
    public static class LabOrderLine {

        @NotBlank(message = "Test code is required")
        @Size(max = 20)
        private String testCode;

        @NotBlank(message = "Investigation name is required")
        @Size(max = 150)
        private String investigationName;

        @NotBlank(message = "Category is required")
        @Size(max = 100)
        private String category;

        @Size(max = 50)
        private String sampleType;

        @Size(max = 100)
        private String normalRange;

        @Size(max = 50)
        private String unit;

        @Size(max = 50)
        private String turnaroundTime;

        private Double price;

        private LabPriority priority = LabPriority.ROUTINE;
    }
}
