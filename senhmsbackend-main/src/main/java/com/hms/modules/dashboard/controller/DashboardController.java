package com.hms.modules.dashboard.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.dashboard.dto.DashboardSummaryResponse;
import com.hms.modules.dashboard.dto.MonthlyRevenueResponse;
import com.hms.modules.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;

    /**
     * KPI dashboard summary.
     * GET /api/dashboard/summary
     * GET /api/dashboard/summary?date=2026-08-24
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DashboardSummaryResponse>> getSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.ok(service.getSummary(targetDate)));
    }

    /**
     * Monthly revenue chart data — bills + insurance + manual cash.
     * Returns 12 months (Jan–Dec) for the given year.
     *
     * GET /api/dashboard/monthly-revenue
     * GET /api/dashboard/monthly-revenue?year=2026
     */
    @GetMapping("/monthly-revenue")
    public ResponseEntity<ApiResponse<MonthlyRevenueResponse>> getMonthlyRevenue(
            @RequestParam(required = false) Integer year) {
        int targetYear = year != null ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(ApiResponse.ok(service.getMonthlyRevenue(targetYear)));
    }
}
