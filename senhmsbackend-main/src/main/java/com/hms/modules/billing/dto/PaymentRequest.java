package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.PaymentMode;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PaymentRequest {

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Payment mode is required")
    private PaymentMode paymentMode;

    private LocalDate date;

    @Size(max = 60)
    private String referenceNo;

    @Size(max = 150)
    private String receivedBy;

    /** UUID shared by all records in the same split-payment session. Null for single-mode payments. */
    @Size(max = 36)
    private String transactionGroupId;
}
