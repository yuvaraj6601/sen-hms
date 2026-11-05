package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "investigations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Investigation extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "test_code", unique = true, nullable = false, length = 20)
    private String testCode;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 100)
    private String category;

    /** Sub-category within the category, e.g. "Liver Function" under "Biochemistry". */
    @Column(name = "subcategory", length = 100)
    private String subcategory;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    // ── Sample & Collection ───────────────────────────────────────────────────

    @Column(name = "sample_type", length = 50)
    private String sampleType;

    /** Collection container / tube, e.g. EDTA, Plain, Fluoride, Citrate, Heparin. */
    @Column(name = "container", length = 50)
    private String container;

    /** Recommended volume, e.g. "2 mL". */
    @Column(name = "sample_volume", length = 30)
    private String sampleVolume;

    /** Whether the patient must fast before this test. */
    @Column(name = "fasting_required")
    private Boolean fastingRequired;

    /** Patient preparation instructions shown on the collection slip. */
    @Column(name = "patient_instructions", columnDefinition = "TEXT")
    private String patientInstructions;

    // ── Reporting ─────────────────────────────────────────────────────────────

    @Column(name = "turnaround_time", length = 50)
    private String turnaroundTime;

    /**
     * Result type drives the result-entry UI.
     * Values: NUMERIC | TEXT | POSITIVE_NEGATIVE | DROPDOWN
     */
    @Column(name = "result_type", length = 20)
    private String resultType;

    /**
     * JSON array of allowed values when resultType = DROPDOWN.
     * e.g. ["A+","A-","B+","B-","AB+","AB-","O+","O-"]
     * Null for other result types.
     */
    @Column(name = "result_options", columnDefinition = "TEXT")
    private String resultOptions;

    @Column(name = "normal_range", length = 100)
    private String normalRange;

    @Column(length = 50)
    private String unit;

    /**
     * Test-level critical low threshold (numeric string, e.g. "2.5").
     * Used for auto-alerting on simple single-value tests.
     */
    @Column(name = "critical_low", precision = 10, scale = 3)
    private BigDecimal criticalLow;

    /**
     * Test-level critical high threshold (numeric, e.g. "6.9").
     */
    @Column(name = "critical_high", precision = 10, scale = 3)
    private BigDecimal criticalHigh;

    /**
     * JSON array of result parameter templates for structured tests (CBC, LFT, Lipid, etc.).
     * Each element shape:
     * {
     *   "group":      "HAEMATOLOGY",
     *   "name":       "HAEMOGLOBIN",
     *   "unit":       "g/dL",
     *   "normalRange": "14.0–16.0",   // free-text display fallback
     *   "normalMin":  14.0,
     *   "normalMax":  16.0,
     *   "maleMin":    14.0,
     *   "maleMax":    16.0,
     *   "femaleMin":  12.0,
     *   "femaleMax":  15.0,
     *   "childMin":   11.0,
     *   "childMax":   16.0,
     *   "criticalLow":  7.0,
     *   "criticalHigh": 20.0,
     *   "displayOrder": 1
     * }
     * Null for simple single-value tests.
     */
    @Column(name = "parameters", columnDefinition = "TEXT")
    private String parameters;

    // ── Advanced ──────────────────────────────────────────────────────────────

    /** Analytical method, e.g. "Colorimetric", "Immunoassay", "ELISA". */
    @Column(name = "test_method", length = 100)
    private String testMethod;

    /** Special handling notes for lab staff. */
    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;

    /** Ordering weight for arranging tests on reports. */
    @Column(name = "display_order")
    private Integer displayOrder;

    /** Internal notes / remarks (not printed on patient report). */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
