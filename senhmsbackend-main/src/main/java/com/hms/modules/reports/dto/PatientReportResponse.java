package com.hms.modules.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Dynamic patient-count report for the Patient Report Generator screen.
 *
 * Counting definitions (documented & consistent):
 *   - OP count  = OP visits/encounters whose visitDate falls in range
 *   - IP count  = admissions whose admissionDate falls in range
 *   - Free      = visits/admissions flagged free (per-episode)
 *   - Insurance = admissions flagged insurance (paymentMode INSURANCE or insurer set)
 *
 * Surgical / non-surgical split is intentionally NOT included yet (pending
 * hospital confirmation of how surgical cases are classified).
 */
@Data
@Builder
public class PatientReportResponse {

    private String groupBy;          // DAY | MONTH | YEAR
    private LocalDate fromDate;
    private LocalDate toDate;

    private List<Bucket> buckets;
    private Totals totals;

    // ── One time bucket (day / month / year) ─────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Bucket {
        private String label;        // "01 Sep 2026", "Sep 2026", "2026"
        private LocalDate start;

        // OP
        private long opTotal;
        private long opFree;
        private long opPaid;         // opTotal - opFree

        // IP
        private long ipTotal;
        private long ipFree;
        private long ipInsurance;
        private long ipNonInsurance; // ipTotal - ipInsurance

        // combined
        private long combined;       // opTotal + ipTotal
    }

    // ── Range totals ──────────────────────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Totals {
        private long opTotal;
        private long opFree;
        private long opPaid;

        private long ipTotal;
        private long ipFree;
        private long ipInsurance;
        private long ipNonInsurance;

        private long combined;

        // insurance across the board (currently IP-only, OP insurance not tracked at visit level)
        private long insuranceTotal;
        private long freeTotal;      // opFree + ipFree

        // IP category matrix (insurance × surgical)
        private long ipInsuranceSurgical;
        private long ipInsuranceNonSurgical;
        private long ipNonInsuranceSurgical;
        private long ipNonInsuranceNonSurgical;
        private long ipSurgicalTotal;
        private long ipNonSurgicalTotal;
    }
}
