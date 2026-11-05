package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "insurance_companies")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InsuranceCompany extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_code", unique = true, nullable = false, length = 20)
    private String companyCode;

    @Column(nullable = false, length = 150)
    private String name;

    /**
     * Primary / legacy single TPA name. Retained for backward compatibility
     * (existing bills, claims and admissions reference a single TPA string).
     * New data should prefer {@link #tpaNames}.
     */
    @Column(name = "tpa_name", length = 150)
    private String tpaName;

    /**
     * Full set of TPA names empanelled for this insurer, stored as a
     * comma-separated list. One insurance company can route claims through
     * many TPAs. Shown as a multi-select in the master and as a dropdown in the
     * admit / insurance forms.
     */
    @Column(name = "tpa_names", columnDefinition = "TEXT")
    private String tpaNames;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    // ── Tariff contract period ────────────────────────────────────────────────
    /**
     * Start date of the current tariff contract with this insurer.
     * Billing only applies this insurer's tariff rates when the bill date
     * falls within [tariffEffectiveFrom, tariffEffectiveTo]. Null = no bound.
     */
    @Column(name = "tariff_effective_from")
    private java.time.LocalDate tariffEffectiveFrom;

    /** End date of the current tariff contract. Extend by editing this date. Null = no expiry. */
    @Column(name = "tariff_effective_to")
    private java.time.LocalDate tariffEffectiveTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
