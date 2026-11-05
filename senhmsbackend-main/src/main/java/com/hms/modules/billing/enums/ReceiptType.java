package com.hms.modules.billing.enums;

/**
 * Type of a standalone advance receipt (money collected during a stay,
 * independent of any itemised bill).
 *
 *  ADVANCE    — deposit collected before / during the stay (positive).
 *  SETTLEMENT — payment collected against the stay toward the final bill (positive).
 *  LAB        — money collected toward the admission's lab charges (positive).
 *               Recorded as a receipt against the main IP bill and printed on
 *               the cumulative / split-up ledger as a "Lab" line.
 *  REFUND     — money returned to the patient (recorded as a negative amount).
 */
public enum ReceiptType {
    ADVANCE,
    SETTLEMENT,
    LAB,
    REFUND
}
