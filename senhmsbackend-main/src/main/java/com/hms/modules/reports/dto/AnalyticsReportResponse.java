package com.hms.modules.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Generic table + chart payload used by the analytics reports (department-wise
 * patients, doctor-wise OP, discharge trends, insurance claims, bed occupancy,
 * lab status, payment analysis). One shape lets a single screen render any of them.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsReportResponse {

    private String type;
    private String title;
    private LocalDate fromDate;
    private LocalDate toDate;
    private String groupBy;          // DAY | MONTH | YEAR (time-series reports only, else null)
    private String note;             // basis / definition shown under the title

    private List<String> headers;
    private List<List<Object>> rows; // last row is the grand total when hasTotalRow
    private boolean hasTotalRow;
    private List<Integer> moneyColumns; // header indexes formatted as ₹

    private List<Stat> summary;

    private List<String> chartLabels;
    private List<Series> chartSeries;
    private List<Slice> pie;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Stat {
        private String label;
        private String value;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Series {
        private String label;
        private List<Double> values;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Slice {
        private String label;
        private double value;
    }
}
