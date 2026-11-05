package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class InvestigationResponse {

    // ── Identity ──────────────────────────────────────────────────────────────
    private Long id;
    private String testCode;
    private String name;
    private String category;
    private String subcategory;
    private BigDecimal price;
    private Status status;

    // ── Sample & Collection ───────────────────────────────────────────────────
    private String sampleType;
    private String container;
    private String sampleVolume;
    private Boolean fastingRequired;
    private String patientInstructions;

    // ── Reporting ─────────────────────────────────────────────────────────────
    private String turnaroundTime;
    private String resultType;
    /** JSON array of dropdown options (non-null only when resultType = DROPDOWN). */
    private String resultOptions;
    private String normalRange;
    private String unit;
    private BigDecimal criticalLow;
    private BigDecimal criticalHigh;
    /**
     * JSON array of structured result parameter templates.
     * Null for simple single-value tests.
     */
    private String parameters;

    // ── Advanced ──────────────────────────────────────────────────────────────
    private String testMethod;
    private String specialInstructions;
    private Integer displayOrder;
    private String notes;

    // ── Audit ─────────────────────────────────────────────────────────────────
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
