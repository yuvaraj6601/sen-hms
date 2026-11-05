package com.hms.modules.lab.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * A group of lab tests ordered together (one order_group_id), presented as a
 * single expandable row in the pharmacy-style lab collection UI.
 *
 * The parent row carries patient + estimation + payment summary; the nested
 * {@link #tests} are the individual test line items revealed on expand.
 */
@Data
public class LabOrderGroupResponse {

    /** Shared order_group_id — the group key. */
    private String orderGroupId;

    // ── Patient (denormalised from the first test) ──────────────────────────────
    private Long patientId;
    private String patientName;
    private String uhid;
    private String patientType;   // OP / IP
    private Integer age;
    private String gender;
    private String phone;
    private String doctorName;
    private Long admissionId;
    private String admissionNo;
    private Long visitId;

    // ── Order metadata ──────────────────────────────────────────────────────────
    private LocalDate orderedDate;
    private String orderedTime;
    private String orderedBy;

    // ── Estimation / billing ────────────────────────────────────────────────────
    /** Sum of test prices = the estimation total. */
    private Double estimatedTotal;
    /** Bill id raised for this group (null until estimation generated). */
    private Long billId;
    /** Human-readable bill number (null until estimation generated). */
    private String billNo;
    private Double paidAmount;
    private Double dueAmount;

    /**
     * Rolled-up group status driving the UI:
     *   PENDING          — ordered, no estimation yet (show "Generate Estimation")
     *   AWAITING_PAYMENT — estimation/bill raised, not yet paid (show on Bills page)
     *   PAID             — paid, lab may process
     *   IN_PROGRESS      — at least one sample collected
     *   COMPLETED        — all tests resulted
     *   MIXED            — tests in differing states
     */
    private String groupStatus;

    /** Count of tests in the group. */
    private int testCount;

    // ── Line items ────────────────────────────────────────────────────────────
    private List<LabInvestigationResponse> tests;
}
