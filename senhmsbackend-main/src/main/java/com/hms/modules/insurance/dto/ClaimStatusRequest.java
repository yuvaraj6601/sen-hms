package com.hms.modules.insurance.dto;

import com.hms.modules.insurance.enums.ClaimStatus;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ClaimStatusRequest {

    @NotNull(message = "Status is required")
    private ClaimStatus status;

    @DecimalMin("0.0")
    private BigDecimal approvedAmount;

    @DecimalMin("0.0")
    private BigDecimal settledAmount;

    /** Authorized Amount from the insurer's email reply (approval table). */
    @DecimalMin("0.0")
    private BigDecimal authorizedAmount;

    /** Co-Payment Amount (patient's co-pay deduction) from the insurer's reply. */
    @DecimalMin("0.0")
    private BigDecimal coPayAmount;

    private LocalDate settledDate;

    private String rejectionReason;

    private String remarks;
}
