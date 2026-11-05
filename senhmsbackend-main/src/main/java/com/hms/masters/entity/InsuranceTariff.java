package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Insurance Tariff Master.
 *
 * Stores the agreed rate that a specific insurance company pays for each
 * billable service. When a bill is generated for an insurance patient the
 * billing screen replaces BillingMaster.price with the tariff_price from
 * this table for each line item.
 *
 * Unique constraint: one rate per (insurance_company_id, service_code).
 * If no row exists for a service → billing screen falls back to hospital rate.
 */
@Entity
@Table(
    name = "insurance_tariffs",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_ins_tariff_company_service",
        columnNames = { "insurance_company_id", "service_code" }
    ),
    indexes = {
        @Index(name = "idx_ins_tariff_company",  columnList = "insurance_company_id"),
        @Index(name = "idx_ins_tariff_service",  columnList = "service_code")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InsuranceTariff extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to insurance_companies.id — plain Long, no JPA join (follows project convention) */
    @Column(name = "insurance_company_id", nullable = false)
    private Long insuranceCompanyId;

    /** Snapshot of the company name — avoids a join on every bill load */
    @Column(name = "insurance_company_name", nullable = false, length = 150)
    private String insuranceCompanyName;

    /** Links to billing_masters.service_code */
    @Column(name = "service_code", nullable = false, length = 20)
    private String serviceCode;

    /** Snapshot of service name from BillingMaster — avoids a join */
    @Column(name = "service_name", nullable = false, length = 150)
    private String serviceName;

    /** Modality / category name (e.g. "Room Rent", "Lab", "OT") — for UI grouping */
    @Column(name = "modality_name", length = 100)
    private String modalityName;

    /**
     * The insurer's OWN code for this service, as printed in their rate list.
     * Used on the claim and to match when the insurer releases a new price list.
     * Independent of the hospital's serviceCode.
     */
    @Column(name = "insurer_code", length = 40)
    private String insurerCode;

    /** The insurer's OWN description for this service, from their rate list. */
    @Column(name = "insurer_description", length = 250)
    private String insurerDescription;

    /**
     * Which master this tariff row maps to, so the UI can group and the
     * billing lookup knows how to match. One of:
     *   BILLING (billing_masters service), LAB (investigations),
     *   ROOM (wards), CUSTOM (insurer-only item not in any master).
     */
    @Column(name = "source_type", length = 12)
    private String sourceType = "BILLING";

    /**
     * User-chosen category for grouping in the tariff UI, e.g.
     * "Wards & Beds", "Lab", "Consultation", "OT", "Procedures", "Scan", "Others".
     * Independent of sourceType — the hospital controls this label.
     */
    @Column(name = "category", length = 60)
    private String category;

    /**
     * The insurer's agreed rate for this service.
     * This is the price loaded on the bill for insurance patients.
     * Set to 0.00 when is_excluded = true.
     */
    @Column(name = "tariff_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal tariffPrice = BigDecimal.ZERO;

    /**
     * True = insurer does not cover this service at all.
     * The line item will appear on the bill at ₹0 and will be flagged
     * "Not Covered" so billing desk knows to collect from patient.
     */
    @Column(name = "is_excluded", nullable = false)
    private boolean excluded = false;

    /** Optional tariff start date — null means always active */
    @Column(name = "effective_from")
    private LocalDate effectiveFrom;

    /** Optional tariff end date — null means no expiry */
    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /** Internal note, e.g. "Package inclusive of consumables" */
    @Column(columnDefinition = "TEXT")
    private String notes;
}
