package com.hms.modules.pharmacy.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Represents a single payment made against a {@link PharmacyEntry} medicine account.
 * The first payment is typically the advance taken at purchase time; subsequent
 * payments are top-ups collected on later dates until the account is settled.
 * A single purchase account can have multiple payments over time.
 */
@Entity
@Table(name = "pharmacy_payments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PharmacyPayment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private PharmacyEntry entry;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 20)
    private PharmacyPaymentMode paymentMode;

    /**
     * JSON array for split payments, e.g.
     * [{"mode":"CASH","amount":200},{"mode":"UPI","amount":50}]
     * Null / empty when paymentMode != MIXED.
     */
    @Column(name = "payment_splits_json", columnDefinition = "TEXT")
    private String paymentSplitsJson;

    /** True when this is the first (advance) payment recorded with the account */
    @Column(name = "is_advance", nullable = false)
    @Builder.Default
    private boolean advance = false;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
