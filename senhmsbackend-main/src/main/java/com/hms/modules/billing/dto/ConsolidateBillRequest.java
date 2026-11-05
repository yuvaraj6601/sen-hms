package com.hms.modules.billing.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request to generate a Consolidated / Summary IP bill from several existing
 * bills of one admission.
 *
 * POST /api/bills/consolidate
 *
 * Behaviour (decided with the product owner):
 *  - Creates ONE new consolidated {@code Bill} whose items are copies of the
 *    selected source bills' items (grouped by modality on print).
 *  - Source bills are marked {@code BillStatus.CONSOLIDATED} so they drop out of
 *    active/pending lists and revenue totals (no double counting).
 *  - If a prior consolidated bill already exists for the admission, it is
 *    CANCELLED and linked via {@code supersededByBillId} (supersede-on-regenerate).
 *  - CASH admissions: generation is hard-blocked unless every selected bill is
 *    fully paid (zero balance). INSURANCE admissions: allowed with a balance.
 *  - {@code dischargeDate} is display-only; it does NOT discharge the admission.
 */
@Data
public class ConsolidateBillRequest {

    /** Admission whose bills are being consolidated. */
    @NotNull(message = "admissionId is required")
    private Long admissionId;

    /** IDs of the source bills selected in the grouped view. */
    @NotEmpty(message = "At least one source bill must be selected")
    private List<Long> billIds;

    /** Discharge date to print on the bill header (display-only). */
    @NotNull(message = "dischargeDate is required")
    private LocalDate dischargeDate;

    /**
     * Which view-only documents to create: "CONSOLIDATED" and/or "SUMMARY".
     * Each requested format is saved as its own listed bill. Both are view-only
     * (status CONSOLIDATED) and are excluded from all revenue totals — the money
     * is already carried by the individual source bills, which are left untouched.
     * Defaults to ["CONSOLIDATED"] when omitted.
     */
    private List<String> formats;

    /**
     * Overall (bill-level) discount applied to the merged document. Entered by
     * staff after the head doctor verifies the split-up bill. Produces the
     * Gross → Discount → Bill Amount footer on the Cumulative / Summary bills.
     *
     * Null or zero → no discount (the raw split-up stage, before verification).
     * Clamped server-side to [0, gross]. The dated Split-up bill never carries a
     * discount; only the merged Cumulative / Summary documents do.
     */
    private BigDecimal discount;
}
