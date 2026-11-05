package com.hms.modules.pharmacy.dto;

import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PharmacyReturnRequest {

    @NotNull(message = "Return date is required")
    private LocalDate returnDate;

    @NotNull(message = "Return amount is required")
    @DecimalMin(value = "0.01", message = "Return amount must be greater than 0")
    private BigDecimal returnAmount;

    @NotNull(message = "Payment mode is required")
    private PharmacyPaymentMode paymentMode;

    private String notes;
}
