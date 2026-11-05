package com.hms.modules.lab.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "lab_investigations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LabInvestigation extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: LAB-YYYYMMDD-XXXXX */
    @Column(name = "lab_id", unique = true, nullable = false, length = 25)
    private String labId;

    /**
     * Shared UUID stamped on every test created in one order() call.
     * Groups the tests a doctor/lab ordered together into a single payable
     * "order" — used by the pharmacy-style grouped collection UI and the
     * estimation→bill flow. Not unique (many rows share one value).
     */
    @Column(name = "order_group_id", length = 36)
    private String orderGroupId;

    // ── Patient (denormalised) ────────────────────────────────────────────────

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    @Column(nullable = false, length = 25)
    private String uhid;

    /** OP or IP */
    @Column(name = "patient_type", length = 5)
    private String patientType;

    // ── Doctor (who ordered) ─────────────────────────────────────────────────

    @Column(name = "doctor_name", length = 150)
    private String doctorName;

    @Column(name = "doctor_id")
    private Long doctorId;

    // ── Optional links ────────────────────────────────────────────────────────

    @Column(name = "admission_id")
    private Long admissionId;

    @Column(name = "visit_id")
    private Long visitId;

    // ── Test details (denormalised from investigation master) ─────────────────

    @Column(name = "test_code", nullable = false, length = 20)
    private String testCode;

    @Column(name = "investigation_name", nullable = false, length = 150)
    private String investigationName;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(name = "sample_type", length = 50)
    private String sampleType;

    @Column(name = "normal_range", length = 100)
    private String normalRange;

    @Column(length = 50)
    private String unit;

    @Column(name = "turnaround_time", length = 50)
    private String turnaroundTime;

    private Double price;

    // ── Order ─────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LabPriority priority = LabPriority.ROUTINE;

    @Column(name = "ordered_date", nullable = false)
    private LocalDate orderedDate;

    @Column(name = "ordered_time", length = 10)
    private String orderedTime;

    @Column(name = "ordered_by", length = 150)
    private String orderedBy;

    // ── Sample collection ─────────────────────────────────────────────────────

    @Column(name = "collected_date")
    private LocalDate collectedDate;

    @Column(name = "collected_time", length = 10)
    private String collectedTime;

    @Column(name = "collected_by", length = 150)
    private String collectedBy;

    // ── Result ────────────────────────────────────────────────────────────────

    @Column(columnDefinition = "TEXT")
    private String result;

    /**
     * JSON array of structured per-parameter results for multi-parameter tests
     * (CBC, Coagulation Profile, LFT, etc.). Null/empty for simple single-value
     * tests, which use {@link #result} instead.
     *
     * Each element shape:
     * {
     *   "group":       "HAEMATOLOGY",
     *   "subGroup":    "PROTHROMBIN TIME",   // optional mid-level heading
     *   "name":        "Patient Time",
     *   "value":       "12.0",
     *   "unit":        "sec",
     *   "normalRange": "10.0 - 15.0",
     *   "abnormal":    false
     * }
     */
    @Column(name = "parameter_results", columnDefinition = "TEXT")
    private String parameterResults;

    @Column(name = "is_abnormal", nullable = false)
    private boolean abnormal = false;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(name = "completed_time", length = 10)
    private String completedTime;

    @Column(name = "completed_by", length = 150)
    private String completedBy;

    /** Actual TAT in minutes (calculated on completion) */
    @Column(name = "actual_tat_minutes")
    private Integer actualTatMinutes;

    // ── Cancellation ──────────────────────────────────────────────────────────

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    // ── Billing ───────────────────────────────────────────────────────────────

    /** Set when this test is included in a bill — prevents double-billing */
    @Column(name = "billed_in_bill_id")
    private Long billedInBillId;

    // ── PDF result attachments (used when resultType = PDF) ───────────────────

    /**
     * Server-relative path to the uploaded PDF report (e.g. lab-reports/LAB-xxx-report.pdf).
     * Populated only when the test result was submitted as a PDF upload.
     */
    @Column(name = "report_pdf_path", length = 500)
    private String reportPdfPath;

    /**
     * JSON array of server-relative paths for inline images attached to the report
     * (e.g. morphology charts, haematology scatter-plots).
     * e.g. ["lab-reports/LAB-xxx-img-1.png","lab-reports/LAB-xxx-img-2.png"]
     */
    @Column(name = "report_images", columnDefinition = "TEXT")
    private String reportImages;

    // ── Status ────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private LabStatus status = LabStatus.PENDING;
}
