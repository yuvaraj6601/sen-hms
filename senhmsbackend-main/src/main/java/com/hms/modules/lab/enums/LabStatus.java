package com.hms.modules.lab.enums;

public enum LabStatus {
    /** Ordered by doctor/lab, estimation not yet generated. */
    PENDING,
    /** Estimation generated, a bill is raised and awaiting payment at reception. */
    AWAITING_PAYMENT,
    /** Payment collected — the lab may now collect the sample and process. */
    PAID,
    /** Sample collected, processing in progress. */
    IN_PROGRESS,
    /** Result entered. */
    COMPLETED,
    /** Cancelled. */
    CANCELLED
}
