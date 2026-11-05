package com.hms.masters.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Change the tariff price for every service that shares one insurer code
 * (a price group) under a given insurance company. Used when the insurer
 * revises the rate for a code that maps to multiple hospital services.
 */
@Data
public class InsurerCodeRateRequest {

    @NotNull(message = "Insurance company is required")
    private Long insuranceCompanyId;

    @NotBlank(message = "Insurer code is required")
    private String insurerCode;

    @NotNull(message = "New price is required")
    @DecimalMin(value = "0.0", message = "Price cannot be negative")
    private BigDecimal tariffPrice;
}
