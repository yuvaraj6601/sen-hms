package com.hms.modules.reports.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.reports.dto.AnalyticsReportResponse;
import com.hms.modules.reports.dto.FinancialReportResponse;
import com.hms.modules.reports.dto.PatientReportResponse;
import com.hms.modules.reports.dto.StatisticsReportResponse;
import com.hms.modules.reports.service.AnalyticsReportService;
import com.hms.modules.reports.service.ReportsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final ReportsService service;
    private final AnalyticsReportService analytics;

    /**
     * Aggregated statistics report for a period.
     *
     * GET /api/reports/statistics?period=DAY
     * GET /api/reports/statistics?period=MONTH&date=2026-09-21
     * GET /api/reports/statistics?period=YEAR&date=2026-09-21
     *
     * @param period DAY | MONTH | YEAR (defaults to DAY)
     * @param date   any date inside the desired period (defaults to today)
     */
    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<StatisticsReportResponse>> getStatistics(
            @RequestParam(required = false, defaultValue = "DAY") String period,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(service.getStatistics(period, date)));
    }

    /**
     * Dynamic patient-count report for the Patient Report Generator.
     *
     * GET /api/reports/patient?from=2026-09-01&to=2026-09-21&groupBy=DAY
     * GET /api/reports/patient?from=2026-01-01&to=2026-12-31&groupBy=MONTH&department=Cardiology
     *
     * @param from       inclusive range start (defaults to today)
     * @param to         inclusive range end   (defaults to today)
     * @param groupBy    DAY | MONTH | YEAR (defaults to DAY)
     * @param department optional department filter
     */
    @GetMapping("/patient")
    public ResponseEntity<ApiResponse<PatientReportResponse>> getPatientReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy,
            @RequestParam(required = false) String department) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getPatientReport(from, to, groupBy, department)));
    }

    /**
     * Financial report generator — Income / Expense / Net Cash.
     *
     * GET /api/reports/financial?type=INCOME&from=2026-09-01&to=2026-09-30&groupBy=DAY
     * GET /api/reports/financial?type=EXPENSE&from=...&to=...&groupBy=MONTH&category=Medicines
     * GET /api/reports/financial?type=NETCASH&from=...&to=...&groupBy=YEAR
     *
     * @param type     INCOME | EXPENSE | NETCASH (defaults to NETCASH)
     * @param from     inclusive range start (defaults to today)
     * @param to       inclusive range end   (defaults to today)
     * @param groupBy  DAY | MONTH | YEAR (defaults to DAY)
     * @param category optional category filter
     */
    @GetMapping("/financial")
    public ResponseEntity<ApiResponse<FinancialReportResponse>> getFinancialReport(
            @RequestParam(required = false, defaultValue = "NETCASH") String type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getFinancialReport(type, from, to, groupBy, category)));
    }

    /**
     * Distinct income categories present in a date range (for the Income report filter).
     * GET /api/reports/income-categories?from=...&to=...
     */
    @GetMapping("/income-categories")
    public ResponseEntity<ApiResponse<List<String>>> getIncomeCategories(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(service.getIncomeCategories(from, to)));
    }

    /**
     * Analytics reports (table + chart payload).
     *
     * GET /api/reports/analytics?type=DOCTOR_OP&from=2026-09-01&to=2026-09-30
     * GET /api/reports/analytics?type=DISCHARGE&from=...&to=...&groupBy=MONTH
     *
     * @param type DEPARTMENT_PATIENTS | DOCTOR_OP | DISCHARGE | INSURANCE_CLAIMS
     *             | BED_OCCUPANCY | LAB_STATUS | PAYMENT_ANALYSIS
     */
    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<AnalyticsReportResponse>> getAnalytics(
            @RequestParam String type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "DAY") String groupBy) {
        return ResponseEntity.ok(ApiResponse.ok(analytics.generate(type, from, to, groupBy)));
    }
}
