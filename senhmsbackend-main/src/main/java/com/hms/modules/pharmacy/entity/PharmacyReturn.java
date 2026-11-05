package com.hms.modules.pharmacy.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Represents a partial or full return of medicines against a {@link PharmacyEntry}.
 * A single purchase can have multiple returns over time.
 */
@Entity
@Table(name = "pharmacy_returns")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PharmacyReturn extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private PharmacyEntry entry;

    @Column(name = "return_date", nullable = false)
    private LocalDate returnDate;

    @Column(name = "return_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal returnAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 20)
    private PharmacyPaymentMode paymentMode;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
