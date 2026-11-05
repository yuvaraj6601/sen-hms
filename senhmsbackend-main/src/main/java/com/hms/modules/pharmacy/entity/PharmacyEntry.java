package com.hms.modules.pharmacy.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Represents a single pharmacy purchase transaction for a patient on a given date.
 * Returns are stored as child {@link PharmacyReturn} records.
 */
@Entity
@Table(name = "pharmacy_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PharmacyEntry extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: PHR-0001, PHR-0002, … */
    @Column(name = "entry_no", unique = true, nullable = false, length = 20)
    private String entryNo;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    /** Sequential display number within the day (1, 2, 3 …) */
    @Column(nullable = false)
    private int sno;

    @Column(name = "patient_name", nullable = false, length = 200)
    private String patientName;

    /** Insurance company / staff / empty if cash patient */
    @Column(name = "insurance_name", length = 100)
    private String insuranceName;

    /** Gross value before any discount (full MRP amount) */
    @Column(name = "gross_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossAmount;

    /** Total value of medicines taken by the patient (after discount) */
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PharmacyReturn> returns = new ArrayList<>();

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PharmacyPayment> payments = new ArrayList<>();
}
