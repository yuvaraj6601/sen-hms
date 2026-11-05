package com.hms.modules.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Monthly revenue breakdown for the dashboard chart.
 * Returns 12 months of data for the requested year.
 *
 * GET /api/dashboard/monthly-revenue?year=2026
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyRevenueResponse {

    private int year;

    /**
     * 12 items — one per month (Jan=1 to Dec=12).
     * All months are always present; revenue is 0 when no data.
     */
    private List<MonthData> months;

    /** Grand totals across the year */
    private BigDecimal totalBillRevenue;
    private BigDecimal totalInsuranceRevenue;
    private BigDecimal totalManualCash;
    private BigDecimal totalRevenue;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthData {
        /** 1 = Jan … 12 = Dec */
        private int month;
        /** Short label: Jan, Feb, … Dec */
        private String monthLabel;
        /** Paid amount from bills (bill.date falls in this month) */
        private BigDecimal billRevenue;
        /** Settled insurance claims (settledDate falls in this month) */
        private BigDecimal insuranceRevenue;
        /** Manual cash collection entries (entryDate falls in this month) */
        private BigDecimal manualCash;
        /** Sum of all three */
        private BigDecimal totalRevenue;
    }
}
