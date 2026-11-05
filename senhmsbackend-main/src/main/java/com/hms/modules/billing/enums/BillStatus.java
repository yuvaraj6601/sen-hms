package com.hms.modules.billing.enums;

public enum BillStatus {
    DRAFT,
    PENDING,
    PARTIAL,
    PAID,
    CANCELLED,
    /**
     * Source bill that has been rolled into a consolidated bill.
     * Preserved for history/audit but excluded from active/pending lists
     * and revenue totals so its amount is not double-counted alongside the
     * consolidated bill that now represents it.
     */
    CONSOLIDATED
}
