package com.hms.modules.billing.enums;

public enum PaymentMode {
    CASH,
    CARD,
    CREDIT_CARD,
    DEBIT_CARD,
    UPI,
    CHEQUE,
    INSURANCE,
    /** Split payment — the breakdown is carried in a payment-splits JSON field. */
    MIXED
}
