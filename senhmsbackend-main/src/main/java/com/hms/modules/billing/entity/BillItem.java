package com.hms.modules.billing.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "bill_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false)
    private Bill bill;

    /**
     * Date this individual service was rendered — used on the split-up bill to
     * show each charge against the day it occurred (e.g. ward day 1, OT date,
     * lab test date). Null for non-dated charges and for OP bills.
     */
    @Column(name = "service_date")
    private LocalDate serviceDate;

    @Column(name = "service_code", length = 20)
    private String serviceCode;

    @Column(name = "modality_name", length = 100)
    private String modalityName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    // ── Insurance tariff fields ───────────────────────────────────────────────

    /**
     * Hospital's standard rate from BillingMaster at the time of billing.
     * Null for cash patients.  Populated for insurance patients so the
     * difference (hospitalRate − unitPrice) is visible in reports.
     */
    @Column(name = "hospital_rate", precision = 10, scale = 2)
    private BigDecimal hospitalRate;

    /**
     * True when this insurer does not cover this service at all.
     * unitPrice will be 0 on the bill and the line is flagged "Not Covered"
     * so billing desk knows to collect it from the patient directly.
     */
    @Column(name = "is_excluded", nullable = false)
    private boolean excluded = false;

    /**
     * Optional note carried over from InsuranceTariff.notes.
     * e.g. "Package rate inclusive of consumables".
     * Printed on the bill for transparency.
     */
    @Column(name = "tariff_note", length = 255)
    private String tariffNote;
}
