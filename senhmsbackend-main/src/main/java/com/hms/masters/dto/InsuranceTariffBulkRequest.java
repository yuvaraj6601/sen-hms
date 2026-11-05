package com.hms.masters.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Bulk upsert request — used when entering a full insurer rate list at once.
 *
 * All rows in {@code items} belong to the same insurance company.
 * Each item carries serviceCode + tariffPrice + excluded flag.
 * If a row already exists for (companyId, serviceCode) → it is updated.
 * If it does not exist → it is created.
 */
@Data
public class InsuranceTariffBulkRequest {

    @NotNull(message = "Insurance company is required")
    private Long insuranceCompanyId;

    @NotEmpty(message = "At least one tariff item is required")
    @Valid
    private List<BulkItem> items;

    @Data
    public static class BulkItem {

        @NotNull
        private String     serviceCode;

        /** BILLING | LAB | ROOM | CUSTOM — defaults to BILLING */
        private String     sourceType = "BILLING";

        /** Required for CUSTOM rows; otherwise taken from the source master */
        private String     serviceName;
        private String     modalityName;

        /** User-chosen category for grouping (optional) */
        private String     category;

        /** Insurer's own code + description from their rate list (optional) */
        private String     insurerCode;
        private String     insurerDescription;

        @NotNull
        private java.math.BigDecimal tariffPrice;

        private boolean excluded = false;

        private String notes;
    }
}
