package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.InsuranceStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InsuranceUpdateRequest {

    @Size(max = 150)
    private String insuranceCompany;

    @Size(max = 60)
    private String policyNo;

    @DecimalMin("0.0")
    private BigDecimal claimedAmount;

    @DecimalMin("0.0")
    private BigDecimal insurancePaidAmount;

    private InsuranceStatus insuranceStatus;

    private String insuranceRemarks;
}
