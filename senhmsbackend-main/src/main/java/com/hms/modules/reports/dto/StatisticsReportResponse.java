package com.hms.modules.reports.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Aggregated statistics report for a single period (day / month / year).
 *
 * The period is defined by {@code periodType} plus an inclusive
 * {@code fromDate}..{@code toDate} range that the service resolves from the
 * requested reference date.
 */
@Data
@Builder
public class StatisticsReportResponse {

    /** DAY, MONTH or YEAR. */
    private String periodType;

    /** Inclusive start of the period. */
    private LocalDate fromDate;

    /** Inclusive end of the period. */
    private LocalDate toDate;

    // ── Patient counts ──────────────────────────────────────────────────────
    /** Number of OP visits in the period. */
    private long opCount;

    /** Number of free OP visits in the period. */
    private long opFreeCount;

    /** Number of IP admissions in the period. */
    private long ipCount;

    /** Number of free IP admissions in the period. */
    private long ipFreeCount;

    /** Combined free patients (OP free + IP free). */
    private long freePatientCount;

    /** Number of insurance IP admissions in the period. */
    private long insurancePatientCount;

    // ── IP category breakdown ───────────────────────────────────────────────
    // Surgical vs non-surgical split is planned for a later phase. For now the
    // surgical buckets stay at 0 and everything falls into the non-surgical
    // bucket of its insurance category.
    private long ipInsuranceSurgical;
    private long ipInsuranceNonSurgical;
    private long ipNonInsuranceSurgical;
    private long ipNonInsuranceNonSurgical;

    // ── Financials ──────────────────────────────────────────────────────────
    /** Total income = bills paid + manual collection + insurance settled. */
    private BigDecimal totalIncome;

    /** Bills paid in the period. */
    private BigDecimal billIncome;

    /** Manual daily-summary collection in the period. */
    private BigDecimal manualIncome;

    /** Insurance settled in the period. */
    private BigDecimal insuranceIncome;

    /** Total expenses in the period. */
    private BigDecimal totalExpense;

    /** Net cash = totalIncome - totalExpense. */
    private BigDecimal netCash;
}
