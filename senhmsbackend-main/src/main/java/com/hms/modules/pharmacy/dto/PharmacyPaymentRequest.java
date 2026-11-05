package com.hms.modules.pharmacy.dto;

import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PharmacyPaymentRequest {

    @NotNull(message = "Payment date is required")
    private LocalDate paymentDate;

    @NotNull(message = "Payment amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Payment mode is required")
    private PharmacyPaymentMode paymentMode;

    /** JSON string for split payments — used when paymentMode = MIXED */
    private String paymentSplitsJson;

    private String notes;
}
