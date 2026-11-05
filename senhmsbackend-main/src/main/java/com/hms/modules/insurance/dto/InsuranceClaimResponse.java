package com.hms.modules.insurance.dto;

import com.hms.modules.billing.dto.BillResponse;
import com.hms.modules.insurance.enums.ClaimStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class InsuranceClaimResponse {

    private Long id;
    private String claimNo;

    private Long billId;
    private String billNo;

    private Long patientId;
    private String patientName;
    private String uhid;
    private String patientType;

    private Long admissionId;
    private String admissionNo;
    private LocalDate admissionDate;
    private LocalDate dischargeDate;
    private String diagnosis;

    private String insuranceCompany;
    private Long insuranceCompanyId;
    private String policyNo;
    private String tpaName;
    private String preAuthNumber;

    private BigDecimal billAmount;
    private BigDecimal claimedAmount;
    private BigDecimal approvedAmount;
    private BigDecimal settledAmount;
    private BigDecimal authorizedAmount;
    private BigDecimal coPayAmount;
    private String rejectionReason;

    private ClaimStatus status;
    private LocalDate submittedDate;
    private LocalDate settledDate;
    private String remarks;

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Full bill details (items, ward, bed, doctor, amounts).
     * Populated only when fetching a single claim by ID (for view/print).
     * Null in list responses to keep payload small.
     */
    private BillResponse billDetails;
}
