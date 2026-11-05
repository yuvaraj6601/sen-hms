package com.hms.modules.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Financial report for the Income / Expense / Net Cash report generators.
 *
 * Accounting basis: CASH (actual received income & actual posted expenses).
 *   - Income  = PaymentRecord amounts (received) on non-cancelled bills.
 *   - Expense = Expense amounts with status APPROVED or PAID (posted).
 *   Draft / cancelled bills and PENDING / REJECTED expenses are excluded.
 *
 * Net Cash = totalIncome - totalExpense.
 */
@Data
@Builder
public class FinancialReportResponse {

    private String type;             // INCOME | EXPENSE | NETCASH
    private String groupBy;          // DAY | MONTH | YEAR
    private LocalDate fromDate;
    private LocalDate toDate;
    private String category;         // applied category filter (null = all)

    private List<Bucket> buckets;

    // ── Totals ────────────────────────────────────────────────────────────────
    private BigDecimal totalIncome;
    private BigDecimal totalExpense;
    private BigDecimal netCash;

    private long incomeTxns;
    private long expenseTxns;

    private BigDecimal avgIncomePerTxn;
    private BigDecimal avgExpensePerTxn;

    // ── Category breakdown (for the active type) ────────────────────────────────
    private List<CategoryRow> categoryBreakdown;

    // ─────────────────────────────────────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Bucket {
        private String label;        // "01 Sep 2026" / "Sep 2026" / "2026"
        private LocalDate start;
        private BigDecimal income;
        private BigDecimal expense;
        private BigDecimal netCash;
        private long incomeTxns;
        private long expenseTxns;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryRow {
        private String category;
        private BigDecimal amount;
        private long txns;
    }
}
