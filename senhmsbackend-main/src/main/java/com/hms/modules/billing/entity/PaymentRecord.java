package com.hms.modules.billing.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.billing.enums.PaymentMode;
import com.hms.modules.billing.enums.ReceiptType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "payment_records")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentRecord extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false)
    private Bill bill;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 15)
    private PaymentMode paymentMode;

    @Column(name = "reference_no", length = 60)
    private String referenceNo;

    @Column(name = "received_by", length = 150)
    private String receivedBy;

    /**
     * Groups split-payment records that belong to the same payment session.
     * All records created by one "split payment" action share the same UUID.
     * Single-mode payments leave this null.
     */
    @Column(name = "transaction_group_id", length = 36)
    private String transactionGroupId;

    /**
     * Classifies this payment on the receipt ledger / split-up bill footer:
     *   ADVANCE    — deposit collected before/during the stay
     *   SETTLEMENT — payment against the finalised bill (default; incl. insurance)
     *   REFUND     — money returned to the patient (negative amount)
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "receipt_type", length = 15)
    @Builder.Default
    private ReceiptType receiptType = ReceiptType.SETTLEMENT;

    /** Auto-generated receipt number shown on the ledger, e.g. RCPT-YYYYMMDD-XXXX. */
    @Column(name = "receipt_no", length = 25)
    private String receiptNo;

    /**
     * JSON array for split payments, e.g.
     * [{"mode":"CASH","amount":2500},{"mode":"CARD","amount":2500}].
     * Null / empty for single-mode payments.
     */
    @Column(name = "payment_splits_json", columnDefinition = "TEXT")
    private String paymentSplitsJson;
}
