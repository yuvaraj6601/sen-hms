package com.hms.masters.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceTariffResponse {

    private Long         id;
    private Long         insuranceCompanyId;
    private String       insuranceCompanyName;
    private String       serviceCode;
    private String       serviceName;
    private String       modalityName;
    /** BILLING | LAB | ROOM | CUSTOM — for UI grouping */
    private String       sourceType;

    /** User-chosen display category for grouping */
    private String       category;

    /** Insurer's own code + description from their rate list */
    private String       insurerCode;
    private String       insurerDescription;

    /** Hospital's standard rate (from the source master) — for reference / diff display */
    private BigDecimal   hospitalRate;

    /** Insurer's agreed rate */
    private BigDecimal   tariffPrice;

    /** True = insurer does not cover this service */
    private boolean      excluded;

    private LocalDate    effectiveFrom;
    private LocalDate    effectiveTo;
    private String       notes;

    private String        createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
