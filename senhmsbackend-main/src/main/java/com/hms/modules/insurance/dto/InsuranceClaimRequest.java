package com.hms.modules.insurance.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class InsuranceClaimRequest {

    @NotNull(message = "Bill ID is required")
    private Long billId;

    @NotBlank @Size(max = 25)
    private String billNo;

    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank @Size(max = 150)
    private String patientName;

    @NotBlank @Size(max = 25)
    private String uhid;

    @Size(max = 5)
    private String patientType;

    private Long admissionId;

    @Size(max = 25)
    private String admissionNo;

    private LocalDate admissionDate;
    private LocalDate dischargeDate;
    private String diagnosis;

    @NotBlank(message = "Insurance company is required")
    @Size(max = 150)
    private String insuranceCompany;

    private Long insuranceCompanyId;

    @Size(max = 60)
    private String policyNo;

    @Size(max = 150)
    private String tpaName;

    @Size(max = 60)
    private String preAuthNumber;

    @NotNull(message = "Bill amount is required")
    @DecimalMin("0.01")
    private BigDecimal billAmount;

    @NotNull(message = "Claimed amount is required")
    @DecimalMin("0.01")
    private BigDecimal claimedAmount;

    @NotNull(message = "Submitted date is required")
    private LocalDate submittedDate;

    private String remarks;
}
