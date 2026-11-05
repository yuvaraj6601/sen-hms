package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InvestigationRequest {

    // ── Required ──────────────────────────────────────────────────────────────

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @NotBlank(message = "Category is required")
    @Size(max = 100)
    private String category;

    @Size(max = 100)
    private String subcategory;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal price;

    private Status status = Status.ACTIVE;

    // ── Sample & Collection ───────────────────────────────────────────────────

    @Size(max = 50)
    private String sampleType;

    /** Container / tube type, e.g. EDTA, Plain, Fluoride. */
    @Size(max = 50)
    private String container;

    /** e.g. "2 mL" */
    @Size(max = 30)
    private String sampleVolume;

    private Boolean fastingRequired;

    private String patientInstructions;

    // ── Reporting ─────────────────────────────────────────────────────────────

    @Size(max = 50)
    private String turnaroundTime;

    /**
     * NUMERIC | TEXT | POSITIVE_NEGATIVE | DROPDOWN
     */
    @Size(max = 20)
    private String resultType;

    /**
     * JSON array of allowed values for DROPDOWN result type.
     * e.g. ["A+","A-","B+","B-","AB+","AB-","O+","O-"]
     */
    private String resultOptions;

    @Size(max = 100)
    private String normalRange;

    @Size(max = 50)
    private String unit;

    /**
     * Test-level critical low (numeric). Used for simple single-value tests.
     */
    @DecimalMin(value = "0.0", inclusive = true, message = "Critical low must be >= 0")
    private BigDecimal criticalLow;

    @DecimalMin(value = "0.0", inclusive = true, message = "Critical high must be >= 0")
    private BigDecimal criticalHigh;

    /**
     * JSON array of structured result parameters for multi-value tests.
     * Each element: { group, name, unit, normalRange, normalMin, normalMax,
     *                 maleMin, maleMax, femaleMin, femaleMax, childMin, childMax,
     *                 criticalLow, criticalHigh, displayOrder }
     */
    private String parameters;

    // ── Advanced ──────────────────────────────────────────────────────────────

    @Size(max = 100)
    private String testMethod;

    private String specialInstructions;

    private Integer displayOrder;

    private String notes;
}
