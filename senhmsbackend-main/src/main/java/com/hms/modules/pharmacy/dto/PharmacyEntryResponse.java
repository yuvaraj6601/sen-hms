package com.hms.modules.pharmacy.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PharmacyEntryResponse {
    private Long id;
    private String entryNo;
    private LocalDate entryDate;
    private int sno;
    private String patientName;
    private String insuranceName;

    /** Total value of medicines taken by the patient (after discount) */
    private BigDecimal totalAmount;

    /** Gross value before any discount (full MRP amount) */
    private BigDecimal grossAmount;

    /** Sum of all payments (advance + top-ups) made against this account */
    private BigDecimal paidToDate;

    /** Sum of all return amounts for this account */
    private BigDecimal totalReturned;

    /**
     * totalAmount − totalReturned − paidToDate.
     * Positive = balance owed by patient, negative = refund due to patient.
     */
    private BigDecimal outstanding;

    /** Amount collected on the report's selected date (set only by the daily list) */
    private BigDecimal collectedOnDate;

    /** Amount returned on the report's selected date (set only by the daily list) */
    private BigDecimal returnedOnDate;

    private String notes;
    private LocalDateTime createdAt;

    private List<PharmacyPaymentResponse> payments;
    private List<PharmacyReturnResponse> returns;
}
