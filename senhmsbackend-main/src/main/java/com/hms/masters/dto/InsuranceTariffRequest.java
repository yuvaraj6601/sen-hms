package com.hms.masters.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class InsuranceTariffRequest {

    @NotNull(message = "Insurance company is required")
    private Long insuranceCompanyId;

    @NotBlank(message = "Service code is required")
    @Size(max = 20)
    private String serviceCode;

    /**
     * BILLING | LAB | ROOM | CUSTOM. Defaults to BILLING.
     * When CUSTOM, the code/name are user-supplied and are NOT validated
     * against any master (insurer-only item).
     */
    @Size(max = 12)
    private String sourceType = "BILLING";

    /**
     * Required only for CUSTOM rows (there is no master to snapshot the name from).
     * Ignored for BILLING/LAB/ROOM where the name is taken from the master.
     */
    @Size(max = 150)
    private String serviceName;

    @Size(max = 100)
    private String modalityName;

    /** User-chosen category for grouping (optional) */
    @Size(max = 60)
    private String category;

    /** Insurer's own code + description from their rate list (optional) */
    @Size(max = 40)
    private String insurerCode;

    @Size(max = 250)
    private String insurerDescription;

    /**
     * Insurer's agreed rate. Must be >= 0.
     * Set to 0 when excluded = true.
     */
    @NotNull(message = "Tariff price is required")
    @DecimalMin(value = "0.0", message = "Tariff price cannot be negative")
    private BigDecimal tariffPrice;

    /** True = insurer does not cover this service */
    private boolean excluded = false;

    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;

    @Size(max = 2000)
    private String notes;
}
