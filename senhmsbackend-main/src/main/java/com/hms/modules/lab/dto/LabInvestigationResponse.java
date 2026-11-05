package com.hms.modules.lab.dto;

import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class LabInvestigationResponse {

    private Long id;
    private String labId;
    private String orderGroupId;

    // Patient
    private Long patientId;
    private String patientName;
    private String uhid;
    private String patientType;
    /** Patient age in years — enriched for report printing (CBC/lab report header). */
    private Integer age;
    /** Patient gender — enriched for report printing. */
    private String gender;

    // Doctor
    private String doctorName;
    private Long doctorId;

    // Links
    private Long admissionId;
    /** Formatted admission / IP number (ADM-YYYYMMDD-XXXX) — enriched for report printing. */
    private String admissionNo;
    private Long visitId;

    // Test details
    private String testCode;
    private String investigationName;
    private String category;
    private String sampleType;
    private String normalRange;
    private String unit;
    private String turnaroundTime;
    private Double price;

    // Order
    private LabPriority priority;
    private LocalDate orderedDate;
    private String orderedTime;
    private String orderedBy;

    // Sample collection
    private LocalDate collectedDate;
    private String collectedTime;
    private String collectedBy;

    // Result
    private String result;
    /** JSON array of structured per-parameter results (null for simple tests). */
    private String parameterResults;
    /**
     * JSON array of the test master's parameter template (group/subGroup/name/
     * unit/normalRange/min-max). Enriched from the Investigation master so the
     * result-entry UI can render a structured form. Null when the master has no
     * parameters defined.
     */
    private String parametersTemplate;
    private boolean abnormal;
    private LocalDate completedDate;
    private String completedTime;
    private String completedBy;
    private Integer actualTatMinutes;

    // Cancellation
    private String cancelReason;
    private Long billedInBillId;

    // Status
    private LabStatus status;

    // ── PDF / Image attachments (resultType = PDF) ────────────────────────────
    /** Relative server path for the uploaded PDF report, null when not a PDF-type test. */
    private String reportPdfPath;
    /** JSON array of relative server paths for attached images (morphology charts etc.). */
    private String reportImages;
    /**
     * Result type from the lab master: NUMERIC | TEXT | POSITIVE_NEGATIVE |
     * DROPDOWN | CULTURE_SENSITIVITY | PDF.
     * Enriched from the Investigation master on every response.
     */
    private String resultType;

    // Audit
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
