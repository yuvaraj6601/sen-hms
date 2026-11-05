package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.PaymentMode;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PaymentRecordResponse {
    private Long id;
    private LocalDate date;
    private BigDecimal amount;
    private PaymentMode paymentMode;
    private String referenceNo;
    private String receivedBy;
    private LocalDateTime createdAt;
    /** UUID shared by all records in the same split-payment session. Null for single-mode payments. */
    private String transactionGroupId;
    /** ADVANCE / SETTLEMENT / REFUND — classifies the receipt on the ledger. */
    private String receiptType;
    /** Receipt number shown on the ledger, e.g. RCPT-YYYYMMDD-XXXX. */
    private String receiptNo;
    /** JSON breakdown for a split (MIXED) payment; null for single-mode. */
    private String paymentSplitsJson;
}
